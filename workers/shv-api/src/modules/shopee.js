// workers/shv-api/src/modules/shopee.js
// Shopee API Integration Module

import { json, corsHeaders } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { 
  convertShopeeProductToSHV, 
  convertShopeeOrderToSHV,
  saveProductToD1,
  saveOrderToSHV
} from './shopee-sync.js';

/**
 * Shopee API Configuration
 */
const SHOPEE_CONFIG = {
  // Test environment
  test: {
    host: 'https://partner.test-stable.shopeemobile.com',
    partnerId: '1197440',
    // Partner Key sẽ lấy từ env.SHOPEE_TEST_KEY
  },
  // Production environment
  live: {
    host: 'https://partner.shopeemobile.com',
    partnerId: '2013730',
    // Partner Key sẽ lấy từ env.SHOPEE_LIVE_KEY
  }
};

/**
 * Tạo chữ ký cho Shopee API request
 */
async function generateSignature(partnerId, path, timestamp, accessToken, shopId, partnerKey) {
  const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  
  // ✅ Cloudflare Workers sử dụng Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(partnerKey);
  const messageData = encoder.encode(baseString);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Gọi Shopee API
 * ✅ EXPORT để dùng trong cron job
 */
export async function callShopeeAPI(env, method, path, shopData, params = null) {
  console.log('[Shopee API] Request:', method, path);
  const response = await fetch(url.toString(), options);
  const data = await response.json();
  
  // ✅ CHỈ LOG ERROR, KHÔNG LOG SUCCESS RESPONSE (tiết kiệm log quota)
  if (!response.ok || data.error) {
    console.error('[Shopee API] Error Response:', data);
    throw new Error(data.message || data.error || 'Shopee API error');
  }

  return data;
}

/**
 * Lưu shop data vào KV
 */
async function saveShopData(env, shopId, data) {
  const key = `shopee:shop:${shopId}`;
  await env.SHV.put(key, JSON.stringify({
    ...data,
    updated_at: Date.now()
  }));
}

/**
 * Lấy shop data từ KV
 * ✅ EXPORT để dùng trong cron job
 */
export async function getShopData(env, shopId) {
  const key = `shopee:shop:${shopId}`;
  const data = await env.SHV.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Lấy tất cả shops từ KV
 */
async function getAllShops(env) {
  const list = await env.SHV.list({ prefix: 'shopee:shop:' });
  const shops = [];
  
  for (const key of list.keys) {
    const data = await env.SHV.get(key.name);
    if (data) {
      shops.push(JSON.parse(data));
    }
  }
  
  return shops;
}

/**
 * Xóa shop khỏi KV
 */
async function deleteShopData(env, shopId) {
  const key = `shopee:shop:${shopId}`;
  await env.SHV.delete(key);
}

/**
 * Main request handler
 */
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  try {
    // ============================================
    // PUBLIC ROUTES - Auth flow
    // ============================================

    // Bước 1: Bắt đầu kết nối Shopee
    if (path === '/channels/shopee/connect' && method === 'GET') {
      const redirect = url.searchParams.get('redirect') || 'https://admin.shophuyvan.vn/channels.html';
      const env_type = url.searchParams.get('env') || 'live'; // test hoặc live
      
      const config = SHOPEE_CONFIG[env_type];
      const partnerKey = env_type === 'test' ? env.SHOPEE_TEST_KEY : env.SHOPEE_LIVE_KEY;
      
      if (!partnerKey) {
        return json({ ok: false, error: 'Shopee not configured' }, { status: 500 }, req);
      }

      const authPath = '/api/v2/shop/auth_partner';
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = await generateSignature(config.partnerId, authPath, timestamp, '', '', partnerKey);

      const authUrl = new URL(config.host + authPath);
      authUrl.searchParams.set('partner_id', config.partnerId);
      authUrl.searchParams.set('timestamp', timestamp);
      authUrl.searchParams.set('sign', sign);
      authUrl.searchParams.set('redirect', `https://api.shophuyvan.vn/channels/shopee/callback?redirect=${encodeURIComponent(redirect)}&env=${env_type}`);

      return Response.redirect(authUrl.toString(), 302);
    }

    // Bước 2: Callback từ Shopee sau khi shop owner authorize
    if (path === '/channels/shopee/callback' && method === 'GET') {
      const code = url.searchParams.get('code');
      const shopId = url.searchParams.get('shop_id');
      const redirect = url.searchParams.get('redirect') || 'https://admin.shophuyvan.vn/channels.html';
      const env_type = url.searchParams.get('env') || 'live';

      if (!code || !shopId) {
        const errorUrl = new URL(redirect);
        errorUrl.searchParams.set('sp_status', 'error');
        errorUrl.searchParams.set('reason', 'missing_code_or_shop_id');
        return Response.redirect(errorUrl.toString(), 302);
      }

      try {
        const config = SHOPEE_CONFIG[env_type];
        const partnerKey = env_type === 'test' ? env.SHOPEE_TEST_KEY : env.SHOPEE_LIVE_KEY;

        // Lấy access token từ code
        const tokenPath = '/api/v2/auth/token/get';
        const timestamp = Math.floor(Date.now() / 1000);
        const sign = await generateSignature(config.partnerId, tokenPath, timestamp, '', '', partnerKey);

        const tokenUrl = new URL(config.host + tokenPath);
        tokenUrl.searchParams.set('partner_id', config.partnerId);
        tokenUrl.searchParams.set('timestamp', timestamp);
        tokenUrl.searchParams.set('sign', sign);

        const tokenResponse = await fetch(tokenUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            shop_id: parseInt(shopId),
            partner_id: parseInt(config.partnerId)
          })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
          console.error('[Shopee] Token error:', tokenData);
          const errorUrl = new URL(redirect);
          errorUrl.searchParams.set('sp_status', 'error');
          errorUrl.searchParams.set('reason', tokenData.message || 'token_error');
          return Response.redirect(errorUrl.toString(), 302);
        }

        // Lưu thông tin shop vào KV
        await saveShopData(env, shopId, {
          shop_id: shopId,
          partner_id: config.partnerId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_in: tokenData.expire_in,
          env: env_type,
          created_at: Date.now(),
          region: 'VN' // Mặc định Vietnam
        });

        // Redirect về admin với success
        const successUrl = new URL(redirect);
        successUrl.searchParams.set('sp_status', 'success');
        return Response.redirect(successUrl.toString(), 302);

      } catch (e) {
        console.error('[Shopee] Callback error:', e);
        const errorUrl = new URL(redirect);
        errorUrl.searchParams.set('sp_status', 'error');
        errorUrl.searchParams.set('reason', e.message || 'callback_error');
        return Response.redirect(errorUrl.toString(), 302);
      }
    }

    // ============================================
    // WEBHOOK - Nhận events từ Shopee
    // ============================================
    if (path === '/channels/shopee/webhook' && method === 'POST') {
      const body = await req.json();
      console.log('[Shopee Webhook] Received:', body);

      // Verify webhook signature
      const timestamp = req.headers.get('x-shopee-timestamp');
      const sign = req.headers.get('x-shopee-sign');
      
      // TODO: Implement signature verification
      
      // Xử lý các event types
      switch (body.event) {
        case 'order_status_update':
          // Đồng bộ đơn hàng khi có thay đổi
          console.log('[Shopee Webhook] Order updated:', body.data);
          // TODO: Implement order sync
          break;
          
        case 'product_update':
          // Đồng bộ sản phẩm khi có thay đổi
          console.log('[Shopee Webhook] Product updated:', body.data);
          // TODO: Implement product sync
          break;
          
        default:
          console.log('[Shopee Webhook] Unknown event:', body.event);
      }

      return json({ ok: true, message: 'Webhook received' }, {}, req);
    }

    // ============================================
    // ADMIN ROUTES - Yêu cầu auth
    // ============================================

// Check admin authentication
    const isAdmin = await adminOK(req, env);
    if (!isAdmin) {
      return json({ ok: false, error: 'Unauthorized' }, { status: 401 }, req);
    }

    // Lấy danh sách shops đã kết nối
    if (path === '/admin/shopee/shops' && method === 'GET') {
      const shops = await getAllShops(env);
      return json({ ok: true, shops }, {}, req);
    }

    // Ngắt kết nối shop
    if (path === '/admin/shopee/shops/disconnect' && method === 'DELETE') {
      const shopId = url.searchParams.get('shop_id');
      
      if (!shopId) {
        return json({ ok: false, error: 'missing_shop_id' }, { status: 400 }, req);
      }

      await deleteShopData(env, shopId);
      return json({ ok: true, message: 'Shop disconnected' }, {}, req);
    }

    // Đồng bộ sản phẩm
    if (path === '/admin/shopee/sync-products' && method === 'POST') {
      const body = await req.json();
      const shopId = body.shop_id;

      if (!shopId) {
        return json({ ok: false, error: 'missing_shop_id' }, { status: 400 }, req);
      }

      const shopData = await getShopData(env, shopId);
      if (!shopData) {
        return json({ ok: false, error: 'shop_not_found' }, { status: 404 }, req);
      }

      try {
        // ✅ PAGINATION: Lấy TẤT CẢ sản phẩm từ Shopee
        const itemListPath = '/api/v2/product/get_item_list';
        
        let allItemIds = [];
        let offset = 0;
        let hasNextPage = true;
        
        // Loop để lấy hết tất cả products
        while (hasNextPage) {
          const itemListData = await callShopeeAPI(env, 'GET', itemListPath, shopData, {
            offset: offset,
            page_size: 50,
            item_status: 'NORMAL'
          });
          
          // ✅ TẮT LOG RESPONSE ĐỂ TIẾT KIỆM QUOTA
          const items = itemListData.response?.item || [];
          const itemIds = items.map(i => i.item_id);
          allItemIds.push(...itemIds);
          
          // Check có trang tiếp không
          const totalCount = itemListData.response?.total_count || 0;
          hasNextPage = itemListData.response?.has_next_page || false;
          offset = itemListData.response?.next_offset || (offset + 50);
          
          console.log(`[Shopee] Fetched ${items.length} items (offset: ${offset - 50}, total so far: ${allItemIds.length}/${totalCount})`);
          
          // Safety: Tránh infinite loop
          if (offset > 1000) {
            console.warn('[Shopee] Reached safety limit (1000 items)');
            break;
          }
        }
        
        if (allItemIds.length === 0) {
          return json({ ok: true, total: 0, message: 'No products found' }, {}, req);
        }
        
        console.log(`[Shopee] Total items to fetch details: ${allItemIds.length}`);
        
        // ✅ Lấy chi tiết sản phẩm theo batch 20 items/lần (Shopee giới hạn)
        let allItems = [];
        const BATCH_SIZE = 20;
        
        for (let i = 0; i < allItemIds.length; i += BATCH_SIZE) {
          const batch = allItemIds.slice(i, i + BATCH_SIZE);
          
          const detailPath = '/api/v2/product/get_item_base_info';
          const detailData = await callShopeeAPI(env, 'GET', detailPath, shopData, {
            item_id_list: batch.join(','),
            need_tax_info: false,
            need_complaint_policy: false,
            need_stock_info: true,
            need_price_info: true
          });
          
          const items = detailData.response?.item_list || [];
          allItems.push(...items);
          
          // ✅ DEBUG: Log response structure của batch đầu tiên
          if (i === 0 && items.length > 0) {
            console.log('[DEBUG] First batch response keys:', Object.keys(detailData.response || {}));
            console.log('[DEBUG] First item keys:', Object.keys(items[0] || {}));
          }
          
         console.log(`[Shopee] Fetched details for batch ${Math.floor(i/BATCH_SIZE) + 1}: ${items.length} items`);
        }
        
        // ✅ BỔ SUNG: Lấy variants + giá + stock CHỈ cho products CÓ has_model = true
        console.log('[Shopee] Fetching variants, price & stock for products with variants...');
        
        for (let item of allItems) {
          try {
            // ✅ KIỂM TRA has_model TRƯỚC KHI GỌI API
            if (item.has_model === true) {
              // Gọi API get_model_list để lấy variants
              const modelPath = '/api/v2/product/get_model_list';
              const modelData = await callShopeeAPI(env, 'GET', modelPath, shopData, {
                item_id: item.item_id
              });
              
              // Gắn variants vào item
              item.model_list = modelData.response?.model || [];
              item.price_info = modelData.response?.price_info || [];
              item.stock_info_v2 = modelData.response?.stock_info_v2 || {};
            } else {
              // ❌ Product KHÔNG CÓ variants - Để trống
              item.model_list = [];
              item.price_info = [];
              item.stock_info_v2 = {};
            }
            
            // Debug log cho item đầu tiên
            if (allItems.indexOf(item) === 0) {
              console.log('[DEBUG] First product:', {
                item_id: item.item_id,
                has_model: item.has_model,
                model_count: item.model_list.length,
                has_price_info: item.price_info.length > 0,
                has_stock_info: !!item.stock_info_v2.stock_breakdown_by_location
              });
            }
          } catch (err) {
            console.error(`[Shopee] Error fetching models for item ${item.item_id}:`, err.message);
            // Tiếp tục với items khác nếu có lỗi
            item.model_list = [];
            item.price_info = [];
            item.stock_info_v2 = {};
          }
        }
        
        const items = allItems;
        
        // ✅ DEBUG: Log 3 products đầu tiên để xem structure
        if (items.length > 0) {
          console.log('[DEBUG] Total items received:', items.length);
          console.log('[DEBUG] Sample product #1:', JSON.stringify(items[0], null, 2));
          
          // Log thêm 2 products nữa nếu có
          if (items.length > 1) {
            console.log('[DEBUG] Sample product #2 (name only):', items[1].item_name || 'N/A');
          }
          if (items.length > 2) {
            console.log('[DEBUG] Sample product #3 (name only):', items[2].item_name || 'N/A');
          }
          
          // Log các fields quan trọng của product đầu tiên
          const p = items[0];
          console.log('[DEBUG] Product structure check:', {
            has_item_id: !!p.item_id,
            has_item_name: !!p.item_name,
            has_item_sku: !!p.item_sku,
            has_price_info: !!p.price_info || (p.price_info?.length > 0),
            has_stock_info: !!p.stock_info || !!p.stock_info_v2,
            has_image: !!p.image,
            has_description: !!p.description,
            model_count: p.model_list?.length || 0
          });
          
          // Log chi tiết variants nếu có
          if (p.model_list?.length > 0) {
            console.log('[DEBUG] First variant sample:', JSON.stringify(p.model_list[0], null, 2));
          }
          if (p.price_info?.length > 0) {
            console.log('[DEBUG] Price info sample:', JSON.stringify(p.price_info[0], null, 2));
          }
        }
        
        // ✅ Lưu products vào database của hệ thống
        const savedProducts = [];
        
        for (const item of items) {
          try {
            // Convert Shopee product -> SHV product schema
            const { product, variants } = convertShopeeProductToSHV(item);
            
            // Lưu vào D1
            const result = await saveProductToD1(env, product, variants);
            savedProducts.push({
              product_id: result.product_id,
              name: product.name,
              variants: result.variants
            });
            
            console.log(`[Shopee] Saved product: ${product.name} (${result.variants} variants)`);
          } catch (err) {
            console.error(`[Shopee] Error saving product ${item.item_id}:`, err.message);
          }
        }
        
        console.log('[Shopee] Synced products:', savedProducts.length);

        return json({
          ok: true,
          total: savedProducts.length,
          products: savedProducts,
          message: `Synced ${savedProducts.length} products`
        }, {}, req);

      } catch (e) {
        console.error('[Shopee] Sync products error:', e);
        return json({
          ok: false,
          error: e.message || 'sync_error'
        }, { status: 500 }, req);
      }
    }

    // ✅ THÊM: Đồng bộ TỒN KHO từ Shopee về Website
    if (path === '/admin/shopee/sync-stock' && method === 'POST') {
      const body = await req.json();
      const shopId = body.shop_id;

      if (!shopId) {
        return json({ ok: false, error: 'missing_shop_id' }, { status: 400 }, req);
      }

      const shopData = await getShopData(env, shopId);
      if (!shopData) {
        return json({ ok: false, error: 'shop_not_found' }, { status: 404 }, req);
      }

      try {
        console.log('[Shopee Stock Sync] 🔄 Starting stock sync for shop:', shopId);

        // 1️⃣ Lấy list items từ Shopee
        const itemListPath = '/api/v2/product/get_item_list';
        let allItemIds = [];
        let offset = 0;
        let hasNextPage = true;
        
        while (hasNextPage) {
          const itemListData = await callShopeeAPI(env, 'GET', itemListPath, shopData, {
            offset: offset,
            page_size: 50,
            item_status: 'NORMAL'
          });
          
          const items = itemListData.response?.item || [];
          const itemIds = items.map(i => i.item_id);
          allItemIds.push(...itemIds);
          
          hasNextPage = itemListData.response?.has_next_page || false;
          offset = itemListData.response?.next_offset || (offset + 50);
          
          console.log(`[Shopee Stock] Fetched ${items.length} items (total: ${allItemIds.length})`);
          
          if (offset > 1000) break; // Safety limit
        }
        
        if (allItemIds.length === 0) {
          return json({ ok: true, total: 0, message: 'No products found' }, {}, req);
        }

        // 2️⃣ Lấy stock info từ Shopee (batch 50 items/lần)
        const stockUpdates = [];
        const BATCH_SIZE = 50;
        
        for (let i = 0; i < allItemIds.length; i += BATCH_SIZE) {
          const batch = allItemIds.slice(i, i + BATCH_SIZE);
          
          // Get item details với stock info
          const detailPath = '/api/v2/product/get_item_base_info';
          const detailData = await callShopeeAPI(env, 'GET', detailPath, shopData, {
            item_id_list: batch.join(','),
            need_stock_info: true
          });
          
          const items = detailData.response?.item_list || [];
          
          for (const item of items) {
            try {
              // Check if product has variants
              if (item.has_model === true) {
                // Lấy stock từ model_list
                const modelPath = '/api/v2/product/get_model_list';
                const modelData = await callShopeeAPI(env, 'GET', modelPath, shopData, {
                  item_id: item.item_id
                });
                
                const models = modelData.response?.model || [];
                
                for (const model of models) {
                  const shopeeStock = model.stock_info_v2?.current_stock || 0;
                  const shopeeModelId = model.model_id;
                  
                  // 3️⃣ Tìm variant tương ứng trong D1
                  const mapping = await env.DB.prepare(`
                    SELECT variant_id 
                    FROM channel_products 
                    WHERE channel = 'shopee' 
                      AND channel_item_id = ? 
                      AND channel_model_id = ?
                    LIMIT 1
                  `).bind(String(item.item_id), String(shopeeModelId)).first();
                  
                  if (mapping && mapping.variant_id) {
                    // 4️⃣ Update stock vào variants table
                    await env.DB.prepare(`
                      UPDATE variants 
                      SET stock = ?, updated_at = ?
                      WHERE id = ?
                    `).bind(shopeeStock, Date.now(), mapping.variant_id).run();
                    
                    stockUpdates.push({
                      variant_id: mapping.variant_id,
                      shopee_item_id: item.item_id,
                      shopee_model_id: shopeeModelId,
                      old_stock: null, // Không query old stock để tiết kiệm
                      new_stock: shopeeStock
                    });
                    
                    console.log(`[Shopee Stock] ✅ Updated variant ${mapping.variant_id}: stock=${shopeeStock}`);
                  }
                }
              } else {
                // Product không có variants - lấy stock từ stock_info_v2
                const shopeeStock = item.stock_info_v2?.current_stock || 0;
                
                const mapping = await env.DB.prepare(`
                  SELECT variant_id 
                  FROM channel_products 
                  WHERE channel = 'shopee' 
                    AND channel_item_id = ?
                  LIMIT 1
                `).bind(String(item.item_id)).first();
                
                if (mapping && mapping.variant_id) {
                  await env.DB.prepare(`
                    UPDATE variants 
                    SET stock = ?, updated_at = ?
                    WHERE id = ?
                  `).bind(shopeeStock, Date.now(), mapping.variant_id).run();
                  
                  stockUpdates.push({
                    variant_id: mapping.variant_id,
                    shopee_item_id: item.item_id,
                    shopee_model_id: null,
                    old_stock: null,
                    new_stock: shopeeStock
                  });
                  
                  console.log(`[Shopee Stock] ✅ Updated variant ${mapping.variant_id}: stock=${shopeeStock}`);
                }
              }
            } catch (err) {
              console.error(`[Shopee Stock] Error processing item ${item.item_id}:`, err.message);
            }
          }
        }

        console.log('[Shopee Stock Sync] ✅ Completed:', stockUpdates.length, 'variants updated');

        return json({
          ok: true,
          total: stockUpdates.length,
          updates: stockUpdates,
          message: `✅ Synced stock for ${stockUpdates.length} variants from Shopee`
        }, {}, req);

      } catch (e) {
        console.error('[Shopee Stock Sync] ❌ Error:', e);
        return json({
          ok: false,
          error: e.message || 'sync_stock_error'
        }, { status: 500 }, req);
      }
    }

    // Đồng bộ đơn hàng
    if (path === '/admin/shopee/sync-orders' && method === 'POST') {
      try {
        // Lấy danh sách đơn hàng trong 7 ngày qua
        const timeFrom = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
        const timeTo = Math.floor(Date.now() / 1000);

        const orderListPath = '/api/v2/order/get_order_list';
        const orderListData = await callShopeeAPI(env, 'GET', orderListPath, shopData, {
          time_range_field: 'create_time',
          time_from: timeFrom,
          time_to: timeTo,
          page_size: 100,
          order_status: 'READY_TO_SHIP'
        });

        const orderSns = orderListData.response?.order_list?.map(o => o.order_sn) || [];
        
        if (orderSns.length === 0) {
          return json({ ok: true, total: 0, message: 'No orders found' }, {}, req);
        }

        // Lấy chi tiết đơn hàng
        const detailPath = '/api/v2/order/get_order_detail';
        const detailData = await callShopeeAPI(env, 'POST', detailPath, shopData, {
          order_sn_list: orderSns
        });

        const orders = detailData.response?.order_list || [];
        
        // ✅ CHỈ LƯU ORDERS, KHÔNG TRỪ STOCK (stock sync từ Shopee)
        const savedOrders = [];
        
        for (const order of orders) {
          try {
            // Convert Shopee order -> SHV order schema
            const orderData = convertShopeeOrderToSHV(order);
            
            // ⚠️ QUAN TRỌNG: Đánh dấu đơn từ Shopee để KHÔNG TRỪ STOCK
            orderData.source = 'shopee';
            orderData.skip_stock_adjustment = true; // Flag để orders.js biết
            
            // Lưu vào KV (hoặc D1 nếu có)
            const result = await saveOrderToSHV(env, orderData);
            savedOrders.push({
              order_id: result.order_id,
              order_number: orderData.order_number,
              total: orderData.total,
              status: orderData.status
            });
            
            console.log(`[Shopee] ✅ Saved order (NO stock adjustment): ${orderData.order_number}`);
          } catch (err) {
            console.error(`[Shopee] Error saving order ${order.order_sn}:`, err.message);
          }
        }
        
        console.log('[Shopee] Synced orders:', savedOrders.length);

        return json({
          ok: true,
          total: savedOrders.length,
          orders: savedOrders,
          message: `Synced ${savedOrders.length} orders (stock NOT adjusted - sync from Shopee)`
        }, {}, req);

      } catch (e) {
        console.error('[Shopee] Sync orders error:', e);
        return json({
          ok: false,
          error: e.message || 'sync_error'
        }, { status: 500 }, req);
      }
    }

    // Route không khớp
    return json({ ok: false, error: 'route_not_found' }, { status: 404 }, req);

  } catch (e) {
    console.error('[Shopee] Handler error:', e);
    return json({
      ok: false,
      error: String(e?.message || e)
    }, { status: 500 }, req);
  }
}