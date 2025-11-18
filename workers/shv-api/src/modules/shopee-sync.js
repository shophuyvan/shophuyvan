// workers/shv-api/src/modules/shopee-sync.js
// Đồng bộ dữ liệu giữa Shopee và hệ thống SHV

/**
 * Convert Shopee product -> SHV product schema
 */
export function convertShopeeProductToSHV(shopeeProduct) {
  // Shopee product structure:
  // {
  //   item_id, item_name, item_sku, description,
  //   price_info: { original_price, current_price },
  //   stock_info: { current_stock },
  //   image: { image_id_list, image_url_list },
  //   variation: [ { name, stock, price } ]
  // }

  const baseProduct = {
    // Basic info
    name: shopeeProduct.item_name || '',
    slug: generateSlug(shopeeProduct.item_name),
    description: shopeeProduct.description || '',
    
    // Shopee metadata
    shopee_item_id: shopeeProduct.item_id,
    shopee_item_sku: shopeeProduct.item_sku,
    
    // Category
    category_id: null, // TODO: Map Shopee category -> SHV category
    
    // Status
    status: shopeeProduct.item_status === 'NORMAL' ? 'active' : 'inactive',
    
    // Media
    images: shopeeProduct.image?.image_url_list || [],
    
    // Timestamps
    created_at: Date.now(),
    updated_at: Date.now(),
    source: 'shopee'
  };

  // Convert variants
  const variants = [];
  
  if (shopeeProduct.has_model === true && shopeeProduct.model_list?.length > 0) {
 
    shopeeProduct.model_list.forEach(model => {
      // âœ… LẤY TÊN BIẾN THỂ: Ưu tiên model_name từ Shopee
      const variantName = model.model_name 
        || (model.tier_index ? getVariantName(shopeeProduct, model.tier_index) : baseProduct.name);
      
      // âœ… LẤY HÌNH ẢNH BIẾN THỂ: Ưu tiên ảnh riêng của variant, fallback sang ảnh product
      const variantImage = model.image?.image_url || baseProduct.images[0] || '';
      
      variants.push({
        // Shopee model info
        shopee_model_id: model.model_id,
        shopee_model_sku: model.model_sku,
        
        // âœ… Variant details - TÊN BIẾN THỂ TỪ SHOPEE
        name: variantName,
        sku: model.model_sku || `SP-${shopeeProduct.item_id}-${model.model_id}`,
        
        price: model.price_info?.original_price || 0,
        compare_at_price: model.price_info?.current_price || 0,
        
        stock: model.stock_info_v2?.current_stock || 0,
       
        weight: shopeeProduct.weight || 0, // gram
        
        // Status
        status: model.stock_info_v2?.current_stock > 0 ? 'active' : 'out_of_stock',
        
        image: variantImage,
      });
    });
  } else {
    // ❌ Sản phẩm KHÔNG CÓ biến thể - Tạo 1 variant với giá/stock = 0
    variants.push({
      shopee_model_id: null,
      shopee_model_sku: shopeeProduct.item_sku,
      
      name: baseProduct.name,
      sku: shopeeProduct.item_sku || `SP-${shopeeProduct.item_id}`,
      
      // ✅ Giá & Stock = 0 (sẽ sync sau)
      price: 0,
      compare_at_price: 0,
      stock: 0,
      
      // ✅ Weight
      weight: shopeeProduct.weight || 0,
      
      status: 'active',
      image: baseProduct.images[0] || '',
    });
  }

  return {
    product: baseProduct,
    variants
  };
}

/**
 * Convert Shopee order -> SHV order schema
 */
export function convertShopeeOrderToSHV(shopeeOrder) {
  // Shopee order structure:
  // {
  //   order_sn, order_status, create_time, update_time,
  //   buyer_user_id, buyer_username,
  //   recipient_address: { name, phone, full_address, district, city, state, zipcode },
  //   item_list: [ { item_id, item_name, model_id, model_name, model_sku, quantity, item_price } ],
  //   total_amount, actual_shipping_cost, payment_method
  // }

  const items = shopeeOrder.item_list?.map(item => ({
    product_id: null, // TODO: Map từ shopee_item_id
    variant_id: null, // TODO: Map từ shopee_model_id
    
    // Product info
    name: item.item_name,
    variant_name: item.model_name || '',
    sku: item.model_sku || '',
    
    // Shopee IDs
    shopee_item_id: item.item_id,
    shopee_model_id: item.model_id,
    
    // Pricing
    price: item.model_discounted_price || item.model_original_price || 0,
    quantity: item.model_quantity_purchased || 1,
    
    // Subtotal
    subtotal: (item.model_discounted_price || item.model_original_price || 0) * (item.model_quantity_purchased || 1)
  })) || [];

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const shipping = shopeeOrder.actual_shipping_cost || 0;
  const total = subtotal + shipping;

  return {
    // Order info
    order_number: `SHOPEE-${shopeeOrder.order_sn}`,
    shopee_order_sn: shopeeOrder.order_sn,
    
    // Status mapping
    status: mapShopeeOrderStatus(shopeeOrder.order_status),
    payment_status: shopeeOrder.order_status === 'COMPLETED' ? 'paid' : 'pending',
    fulfillment_status: mapShopeeFulfillmentStatus(shopeeOrder.order_status),
    
    // Customer info
    customer: {
      name: shopeeOrder.recipient_address?.name || '',
      phone: shopeeOrder.recipient_address?.phone || '',
      email: '', // Shopee không cung cấp email
      
      // Shopee user info
      shopee_user_id: shopeeOrder.buyer_user_id,
      shopee_username: shopeeOrder.buyer_username,
    },
    
    // Shipping address
    shipping_address: {
      name: shopeeOrder.recipient_address?.name || '',
      phone: shopeeOrder.recipient_address?.phone || '',
      address: shopeeOrder.recipient_address?.full_address || '',
      district: shopeeOrder.recipient_address?.district || '',
      city: shopeeOrder.recipient_address?.city || '',
      province: shopeeOrder.recipient_address?.state || '',
      zipcode: shopeeOrder.recipient_address?.zipcode || '',
    },
    
    // Items
    items,
    
    // Financial
    subtotal,
    shipping_fee: shipping,
    discount: 0, // TODO: Calculate from voucher/discount info
    total,
    
    // Payment
    payment_method: mapShopeePaymentMethod(shopeeOrder.payment_method),
    
    // Notes
    customer_note: shopeeOrder.message_to_seller || '',
    
    // ✅ Shopee Shipping Info (MỚI)
    tracking_number: shopeeOrder.tracking_number || null,
    shipping_carrier: shopeeOrder.shipping_carrier || null,
    
    // ✅ Shopee Financial Info (MỚI)
    coin_used: shopeeOrder.coin_offset || 0,
    voucher_code: shopeeOrder.voucher_code || null,
    voucher_seller: shopeeOrder.voucher_from_seller || 0,
    voucher_shopee: shopeeOrder.voucher_from_shopee || 0,
    commission_fee: shopeeOrder.commission_fee || 0,
    service_fee: shopeeOrder.service_fee || 0,
    escrow_amount: shopeeOrder.escrow_amount || 0,
    buyer_paid_amount: shopeeOrder.buyer_paid_amount || 0,
    
    // ✅ Shopee Logistics Detail (MỚI)
    estimated_shipping_fee: shopeeOrder.estimated_shipping_fee || 0,
    actual_shipping_fee_confirmed: shopeeOrder.actual_shipping_fee_confirmed || 0,
    
    // Source
    source: 'shopee',
    channel: 'shopee'
  };
}

/**
 * Map Shopee order status -> SHV order status
 */
function mapShopeeOrderStatus(shopeeStatus) {
  const statusMap = {
    'UNPAID': 'pending',
    'READY_TO_SHIP': 'processing',
    'PROCESSED': 'processing',
    'SHIPPED': 'shipped',
    'TO_CONFIRM_RECEIVE': 'shipped',
    'IN_CANCEL': 'cancelled',
    'CANCELLED': 'cancelled',
    'TO_RETURN': 'returned',
    'COMPLETED': 'completed',
    'INVOICE_PENDING': 'pending'
  };
  
  return statusMap[shopeeStatus] || 'pending';
}

/**
 * Map Shopee fulfillment status
 */
function mapShopeeFulfillmentStatus(shopeeStatus) {
  const statusMap = {
    'UNPAID': 'unfulfilled',
    'READY_TO_SHIP': 'unfulfilled',
    'PROCESSED': 'unfulfilled',
    'SHIPPED': 'fulfilled',
    'TO_CONFIRM_RECEIVE': 'fulfilled',
    'COMPLETED': 'fulfilled',
    'IN_CANCEL': 'unfulfilled',
    'CANCELLED': 'unfulfilled',
    'TO_RETURN': 'unfulfilled'
  };
  
  return statusMap[shopeeStatus] || 'unfulfilled';
}

/**
 * Map Shopee payment method
 */
function mapShopeePaymentMethod(shopeeMethod) {
  // Shopee payment methods: COD, CREDIT_CARD, BANK_TRANSFER, SHOPEE_PAY, etc.
  const methodMap = {
    'COD': 'cod',
    'CREDIT_CARD': 'credit_card',
    'BANK_TRANSFER': 'bank_transfer',
    'SHOPEE_PAY': 'shopee_pay',
    'INSTALLMENT': 'installment'
  };
  
  return methodMap[shopeeMethod] || 'other';
}

/**
 * Generate slug from product name
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Get variant name from tier_index
 */
function getVariantName(product, tierIndex) {
  // tierIndex format: [0, 1] -> Tier1[0], Tier2[1]
  const tierVariation = product.tier_variation || [];
  const names = [];
  
  tierIndex.forEach((idx, tierIdx) => {
    if (tierVariation[tierIdx]) {
      const option = tierVariation[tierIdx].option_list[idx];
      if (option) {
        names.push(option.option);
      }
    }
  });
  
  return names.join(' - ') || product.item_name;
}

/**
 * Cập nhật stock từ SHV -> Shopee
 */
export function prepareSHVStockUpdateForShopee(variantData) {
  // Chuẩn bị data để update stock lên Shopee
  // API: /api/v2/product/update_stock
  
  return {
    item_id: variantData.shopee_item_id,
    stock_list: [{
      model_id: variantData.shopee_model_id,
      normal_stock: variantData.stock
    }]
  };
}

/**
 * Cập nhật giá từ SHV -> Shopee
 */
export function prepareSHVPriceUpdateForShopee(variantData) {
  // Chuẩn bị data để update price lên Shopee
  // API: /api/v2/product/update_price
  
  return {
    item_id: variantData.shopee_item_id,
    price_list: [{
      model_id: variantData.shopee_model_id,
      original_price: variantData.price
    }]
  };
}

/**
 * Lưu product vào KV/D1
 */
export async function saveProductToD1(env, productData, variants) {
  // ✅ Lưu vào D1 Database với UPSERT (tránh duplicate)
  
  const now = Date.now();
  
  try {
    // 1. Insert hoặc Update product
    const productResult = await env.DB.prepare(`
      INSERT INTO products (
        title, slug, shortDesc, desc, category_slug,
        images, status, on_website, on_mini,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        title = excluded.title,
        shortDesc = excluded.shortDesc,
        desc = excluded.desc,
        images = excluded.images,
        status = excluded.status,
        updated_at = excluded.updated_at
      RETURNING id
    `).bind(
      productData.name,
      productData.slug,
      productData.description?.substring(0, 200) || '',
      productData.description || '',
      productData.category_slug || null,
      JSON.stringify(productData.images),
      productData.status,
      1, // on_website
      1, // on_mini
      now,
      now
    ).first();
    
    const productId = productResult.id;
    
    // 2. Insert hoặc Update variants
    const savedVariants = [];
    
    for (const variant of variants) {
      const variantResult = await env.DB.prepare(`
        INSERT INTO variants (
          product_id, sku, name,
          price, price_sale, stock, weight,
          image, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(sku) DO UPDATE SET
          name = excluded.name,
          price = excluded.price,
          price_sale = excluded.price_sale,
          stock = excluded.stock,
          weight = excluded.weight,
          image = excluded.image,
          status = excluded.status,
          updated_at = excluded.updated_at
        RETURNING id
      `).bind(
        productId,
        variant.sku,
        variant.name,
        variant.price,
        variant.compare_at_price,
        variant.stock,
        variant.weight,
        variant.image || null,
        variant.status,
        now,
        now
      ).first();
      
      const variantId = variantResult.id;
      
      // 3. Lưu mapping Shopee ↔ Variant
      await env.DB.prepare(`
        INSERT INTO channel_products (
          channel, channel_item_id, channel_model_id, channel_sku,
          product_id, variant_id,
          channel_price, channel_price_sale,
          is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(channel, channel_item_id, channel_model_id) DO UPDATE SET
          channel_sku = excluded.channel_sku,
          variant_id = excluded.variant_id,
          channel_price = excluded.channel_price,
          channel_price_sale = excluded.channel_price_sale,
          updated_at = excluded.updated_at
      `).bind(
        'shopee',
        productData.shopee_item_id,
        variant.shopee_model_id || null,
        variant.sku,
        productId,
        variantId,
        variant.price,
        variant.compare_at_price,
        1, // is_active
        now,
        now
      ).run();
      
      savedVariants.push({ variant_id: variantId, sku: variant.sku });
    }
    
    return { 
      product_id: productId, 
      variants: savedVariants.length,
      variant_details: savedVariants
    };
    
  } catch (error) {
    console.error('[Shopee Sync] Error saving to D1:', error);
    throw error;
  }
}

/**
 * Lưu order vào D1 Database
 */
export async function saveOrderToSHV(env, orderData) {
  const now = Date.now();
  
  try {
    // Tạo order_number unique
    const orderNumber = orderData.order_number || `SHOPEE-${orderData.shopee_order_sn}`;
    
    // ✅ 1. INSERT ORDER (bỏ cột items)
    const orderResult = await env.DB.prepare(`
      INSERT INTO orders (
        order_number, channel, channel_order_id,
        status, payment_status, fulfillment_status,
        customer_name, customer_phone, customer_email,
        shipping_name, shipping_phone, shipping_address,
        shipping_district, shipping_city, shipping_province, shipping_zipcode,
        shipping_fee, discount, subtotal, total,
        payment_method, customer_note,
        tracking_number, shipping_carrier,
        coin_used, voucher_code, voucher_seller, voucher_shopee,
        commission_fee, service_fee, escrow_amount, buyer_paid_amount,
        estimated_shipping_fee, actual_shipping_fee_confirmed,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(order_number) DO UPDATE SET
        status = excluded.status,
        payment_status = excluded.payment_status,
        fulfillment_status = excluded.fulfillment_status,
        shipping_fee = excluded.shipping_fee,
        discount = excluded.discount,
        subtotal = excluded.subtotal,
        total = excluded.total,
        tracking_number = excluded.tracking_number,
        shipping_carrier = excluded.shipping_carrier,
        coin_used = excluded.coin_used,
        voucher_code = excluded.voucher_code,
        voucher_seller = excluded.voucher_seller,
        voucher_shopee = excluded.voucher_shopee,
        commission_fee = excluded.commission_fee,
        service_fee = excluded.service_fee,
        escrow_amount = excluded.escrow_amount,
        buyer_paid_amount = excluded.buyer_paid_amount,
        estimated_shipping_fee = excluded.estimated_shipping_fee,
        actual_shipping_fee_confirmed = excluded.actual_shipping_fee_confirmed,
        updated_at = excluded.updated_at
      RETURNING id
    `).bind(
      orderNumber,
      'shopee',
      orderData.shopee_order_sn || '',
      orderData.status || 'pending',
      orderData.payment_status || 'pending',
      orderData.fulfillment_status || 'unfulfilled',
      orderData.customer?.name || '',
      orderData.customer?.phone || '',
      orderData.customer?.email || '',
      orderData.shipping_address?.name || '',
      orderData.shipping_address?.phone || '',
      orderData.shipping_address?.address || '',
      orderData.shipping_address?.district || '',
      orderData.shipping_address?.city || '',
      orderData.shipping_address?.province || '',
      orderData.shipping_address?.zipcode || '',
      orderData.shipping_fee || 0,
      orderData.discount || 0,
      orderData.subtotal || 0,
      orderData.total || 0,
      orderData.payment_method || 'other',
      orderData.customer_note || '',
      orderData.tracking_number || null,
      orderData.shipping_carrier || null,
      orderData.coin_used || 0,
      orderData.voucher_code || null,
      orderData.voucher_seller || 0,
      orderData.voucher_shopee || 0,
      orderData.commission_fee || 0,
      orderData.service_fee || 0,
      orderData.escrow_amount || 0,
      orderData.buyer_paid_amount || 0,
      orderData.estimated_shipping_fee || 0,
      orderData.actual_shipping_fee_confirmed || 0,
      orderData.created_at || now,
      now
    ).first();
    
    const orderId = orderResult.id;
    
    // ✅ 2. INSERT ORDER_ITEMS
    const items = orderData.items || [];
    let itemCount = 0;
    
    for (const item of items) {
      try {
        // Tìm variant_id từ mapping
        let variantId = null;
        let productId = null;
        
        if (item.shopee_item_id && item.shopee_model_id) {
          const mapping = await env.DB.prepare(`
            SELECT product_id, variant_id 
            FROM channel_products 
            WHERE channel = 'shopee' 
              AND channel_item_id = ? 
              AND channel_model_id = ?
            LIMIT 1
          `).bind(Number(item.shopee_item_id), Number(item.shopee_model_id)).first();
          
          if (mapping) {
            productId = mapping.product_id;
            variantId = mapping.variant_id;
          }
        }
        
        await env.DB.prepare(`
          INSERT INTO order_items (
            order_id, product_id, variant_id,
            sku, name, variant_name,
            price, quantity, subtotal,
            channel_item_id, channel_model_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          orderId,
          productId,
          variantId,
          item.sku || '',
          item.name || '',
          item.variant_name || '',
          item.price || 0,
          item.quantity || 1,
          item.subtotal || 0,
          item.shopee_item_id ? String(item.shopee_item_id) : null,
          item.shopee_model_id ? String(item.shopee_model_id) : null
        ).run();
        
        itemCount++;
        
      } catch (itemErr) {
        console.error('[Shopee Sync] Error saving order item:', itemErr.message);
      }
    }
    
    console.log('[Shopee Sync] Saved order to D1:', orderId, orderNumber, `(${itemCount} items)`);
    
    return { order_id: orderId, order_number: orderNumber, items: itemCount };
    
  } catch (error) {
    console.error('[Shopee Sync] Error saving order to D1:', error);
    throw error;
  }
}

/**
 * Tìm product trong hệ thống bằng shopee_item_id
 */
export async function findProductByShopeeId(env, shopeeItemId) {
  const list = await env.SHV.list({ prefix: 'product:' });
  
  for (const key of list.keys) {
    const data = await env.SHV.get(key.name);
    if (data) {
      const product = JSON.parse(data);
      if (product.shopee_item_id === shopeeItemId) {
        return product;
      }
    }
  }
  
  return null;
}

/**
 * Tìm variant trong hệ thống bằng shopee_model_id
 */
export async function findVariantByShopeeId(env, shopeeItemId, shopeeModelId) {
  const list = await env.SHV.list({ prefix: 'variant:' });
  
  for (const key of list.keys) {
    const data = await env.SHV.get(key.name);
    if (data) {
      const variant = JSON.parse(data);
      const product = await findProductByShopeeId(env, shopeeItemId);
      
      if (product && variant.shopee_model_id === shopeeModelId) {
        return variant;
      }
    }
  }
  
  return null;
}