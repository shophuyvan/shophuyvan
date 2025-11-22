// workers/shv-api/src/modules/shopee-sync.js
// Shopee Sync Helper - CORE INTEGRATED
// Chỉ phụ trách convert PRODUCT và lưu vào DB + Cache Core.
// Phần Order đã được shopee.js xử lý trực tiếp qua Order Core.

import { loadProductNormalized } from '../core/product-core.js';

/**
 * 1. Convert Shopee Product -> SHV Schema
 */
export function convertShopeeProductToSHV(shopeeProduct) {
  // Base Info
  const baseProduct = {
    name: shopeeProduct.item_name || '',
    slug: generateSlug(shopeeProduct.item_name),
    description: shopeeProduct.description || '',
    
    // Shopee Meta
    shopee_item_id: shopeeProduct.item_id,
    shopee_item_sku: shopeeProduct.item_sku,
    
    status: shopeeProduct.item_status === 'NORMAL' ? 'active' : 'inactive',
    images: shopeeProduct.image?.image_url_list || []
  };

  // Variants Handling
  const variants = [];
  
  if (shopeeProduct.has_model === true && shopeeProduct.model_list?.length > 0) {
    shopeeProduct.model_list.forEach(model => {
      // Tên biến thể
      const variantName = model.model_name || 
        (model.tier_index ? getVariantName(shopeeProduct, model.tier_index) : baseProduct.name);
      
      // Ảnh biến thể
      const variantImage = model.image?.image_url || baseProduct.images[0] || '';
      
      variants.push({
        shopee_model_id: model.model_id,
        shopee_model_sku: model.model_sku,
        name: variantName,
        sku: model.model_sku || `SP-${shopeeProduct.item_id}-${model.model_id}`,
        price: model.price_info?.original_price || 0,
        compare_at_price: model.price_info?.current_price || 0, // Giá khuyến mãi
        stock: model.stock_info_v2?.summary_info?.total_available_stock || model.stock_info_v2?.current_stock || 0,
        weight: shopeeProduct.weight || 0,
        status: 'active',
        image: variantImage
      });
    });
  } else {
    // Sản phẩm đơn (Không biến thể) -> Tạo 1 variant mặc định
    variants.push({
      shopee_model_id: null,
      shopee_model_sku: shopeeProduct.item_sku,
      name: baseProduct.name,
      sku: shopeeProduct.item_sku || `SP-${shopeeProduct.item_id}`,
      price: 0, // Sẽ update sau khi có price_info
      compare_at_price: 0,
      stock: 0,
      weight: shopeeProduct.weight || 0,
      status: 'active',
      image: baseProduct.images[0] || ''
    });
  }

  return { product: baseProduct, variants };
}

/**
 * 2. Save Product to D1 + Update Core Cache
 */
export async function saveProductToD1(env, productData, variants) {
  const now = Date.now();
  
  try {
    // A. UPSERT PRODUCT
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
      null, // category_slug (map sau)
      JSON.stringify(productData.images),
      productData.status,
      1, 1, // on_website, on_mini
      now, now
    ).first();
    
    const productId = productResult.id;
    const savedVariants = [];
    
    // B. UPSERT VARIANTS + MAPPING
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
        now, now
      ).first();
      
      const variantId = variantResult.id;
      
      // C. SAVE MAPPING (Channel Products)
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
          updated_at = excluded.updated_at
      `).bind(
        'shopee',
        productData.shopee_item_id,
        variant.shopee_model_id || 0, // Dùng 0 thay null cho composite key
        variant.sku,
        productId,
        variantId,
        variant.price,
        variant.compare_at_price,
        1,
        now, now
      ).run();
      
      savedVariants.push({ variant_id: variantId, sku: variant.sku });
    }

    // D. UPDATE CORE CACHE (Quan trọng!)
    // Gọi hàm loadProductNormalized với forceRefresh=true để cập nhật KV ngay lập tức
    // Giúp Frontend hiển thị giá/stock mới nhất
    try {
        await loadProductNormalized(env, productId, true);
    } catch (cacheError) {
        console.warn('[Shopee Sync] ⚠️ Failed to refresh cache, but DB saved ok:', cacheError);
    }
    
    return { 
      product_id: productId, 
      variants: savedVariants.length,
      variant_details: savedVariants,
      status: 'synced'
    };
    
  } catch (error) {
    console.error('[Shopee Sync] Error saving to D1:', error);
    throw error;
  }
}

// --- HELPERS ---

function generateSlug(name) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getVariantName(product, tierIndex) {
  const tierVariation = product.tier_variation || [];
  const names = [];
  tierIndex.forEach((idx, tierIdx) => {
    if (tierVariation[tierIdx]?.option_list[idx]) {
      names.push(tierVariation[tierIdx].option_list[idx].option);
    }
  });
  return names.join(' - ') || product.item_name;
}