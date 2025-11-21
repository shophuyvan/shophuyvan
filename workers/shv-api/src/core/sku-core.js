// ===============================================
// SHOP HUY VÂN - SKU MAPPING CORE
// Xử lý ánh xạ SKU Sàn <-> SKU Hệ thống
// Tốc độ: 0.5ms (KV) vs 150ms (DB)
// ===============================================

import { getJSON, putJSON } from '../lib/kv.js';

/**
 * 1. Lấy SKU nội bộ từ SKU sàn (Shopee/Lazada/TikTok)
 * @param {string} channel - 'shopee', 'lazada', 'tiktok'
 * @param {string} channelSku - SKU trên sàn
 */
export async function getInternalSku(env, channel, channelSku) {
  if (!channelSku) return null;
  
  // 1. Tra cứu nhanh từ KV Cache
  const cacheKey = `sku_map:${channel}:${channelSku}`;
  const cached = await getJSON(env, cacheKey);
  
  if (cached) {
    return cached; // { variant_id, product_id, sku }
  }

  // 2. Nếu không có cache, tìm trong DB (channel_products)
  // Tìm mapping đã lưu
  const mapping = await env.DB.prepare(`
    SELECT variant_id, product_id, channel_sku 
    FROM channel_products 
    WHERE channel = ? AND channel_sku = ?
  `).bind(channel, channelSku).first();

  if (mapping) {
    // Tìm thấy mapping -> lấy chi tiết variant nội bộ
    const variant = await env.DB.prepare(`
      SELECT id, product_id, sku FROM variants WHERE id = ?
    `).bind(mapping.variant_id).first();

    if (variant) {
      const result = {
        variant_id: variant.id,
        product_id: variant.product_id,
        sku: variant.sku
      };
      // Lưu cache vĩnh viễn (cho đến khi có thay đổi)
      await putJSON(env, cacheKey, result); 
      return result;
    }
  }

  // 3. Cơ chế Auto-Match: Nếu SKU sàn trùng 100% với SKU hệ thống
  // Ví dụ: Sàn đặt là "VIT-NO-6", Hệ thống cũng là "VIT-NO-6"
  const directMatch = await env.DB.prepare(`
    SELECT id, product_id, sku FROM variants WHERE sku = ?
  `).bind(channelSku).first();

  if (directMatch) {
    const result = {
      variant_id: directMatch.id,
      product_id: directMatch.product_id,
      sku: directMatch.sku
    };
    
    // Tự động lưu mapping vào DB để lần sau query nhanh hơn
    try {
      await env.DB.prepare(`
        INSERT INTO channel_products (channel, channel_sku, variant_id, product_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        channel, channelSku, directMatch.id, directMatch.product_id, Date.now(), Date.now()
      ).run();
    } catch (e) {
      // Ignore duplicate insert errors
    }

    // Lưu cache
    await putJSON(env, cacheKey, result);
    return result;
  }

  return null; // Không tìm thấy
}

/**
 * 2. Map thủ công (Dùng khi user chọn map bằng tay trên Admin)
 */
export async function mapSku(env, channel, channelSku, internalSku) {
  // Tìm variant nội bộ
  const variant = await env.DB.prepare(`
    SELECT id, product_id FROM variants WHERE sku = ?
  `).bind(internalSku).first();

  if (!variant) throw new Error('Internal SKU not found');

  // Lưu DB
  // Upsert: Xóa cũ -> Thêm mới (đơn giản hóa)
  await env.DB.prepare(`
    DELETE FROM channel_products WHERE channel = ? AND channel_sku = ?
  `).bind(channel, channelSku).run();

  await env.DB.prepare(`
    INSERT INTO channel_products (channel, channel_sku, variant_id, product_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    channel, channelSku, variant.id, variant.product_id, Date.now(), Date.now()
  ).run();

  // Update Cache
  const cacheKey = `sku_map:${channel}:${channelSku}`;
  const result = {
    variant_id: variant.id,
    product_id: variant.product_id,
    sku: internalSku
  };
  await putJSON(env, cacheKey, result);

  return result;
}