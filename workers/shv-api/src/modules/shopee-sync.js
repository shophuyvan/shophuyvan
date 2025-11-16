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
  
  if (shopeeProduct.model?.length > 0) {
    // Sản phẩm có biến thể
    shopeeProduct.model.forEach(model => {
      variants.push({
        // Shopee model info
        shopee_model_id: model.model_id,
        shopee_model_sku: model.model_sku,
        
        // Variant details
        name: model.tier_index ? getVariantName(shopeeProduct, model.tier_index) : baseProduct.name,
        sku: model.model_sku || `SP-${shopeeProduct.item_id}-${model.model_id}`,
        
        // ✅ Pricing (QUAN TRỌNG: Giá ở variants)
        price: model.price_info?.original_price || 0,
        compare_at_price: model.price_info?.current_price || 0,
        
        // ✅ Stock (QUAN TRỌNG: Tồn kho ở variants)
        stock: model.stock_info_v2?.current_stock || 0,
        
        // ✅ Weight (QUAN TRỌNG: Cân nặng ở variants)
        weight: shopeeProduct.weight || 0, // gram
        
        // Status
        status: model.stock_info_v2?.current_stock > 0 ? 'active' : 'out_of_stock',
        
        // Media
        image: model.image?.image_url || (baseProduct.images[0] || ''),
      });
    });
  } else {
    // Sản phẩm không có biến thể - tạo 1 variant mặc định
    variants.push({
      shopee_model_id: null,
      shopee_model_sku: shopeeProduct.item_sku,
      
      name: baseProduct.name,
      sku: shopeeProduct.item_sku || `SP-${shopeeProduct.item_id}`,
      
      // ✅ Pricing
      price: shopeeProduct.price_info?.original_price || 0,
      compare_at_price: shopeeProduct.price_info?.current_price || 0,
      
      // ✅ Stock
      stock: shopeeProduct.stock_info_v2?.current_stock || 0,
      
      // ✅ Weight
      weight: shopeeProduct.weight || 0,
      
      status: shopeeProduct.stock_info_v2?.current_stock > 0 ? 'active' : 'out_of_stock',
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
    
    // Timestamps
    created_at: shopeeOrder.create_time * 1000, // Convert to ms
    updated_at: shopeeOrder.update_time * 1000,
    
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
 * Lưu order vào KV/D1
 */
export async function saveOrderToSHV(env, orderData) {
  // TODO: Implement save to your database
  
  const orderId = `shopee_${orderData.shopee_order_sn}`;
  
  await env.SHV.put(
    `order:${orderId}`,
    JSON.stringify(orderData)
  );
  
  return { order_id: orderId };
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