/**
 * File: workers/shv-api/src/modules/social-video-sync/douyin/batch-analyzer.js
 * [OPTIMIZED] Sử dụng Product Core Engine & Fix CORS
 */

import { json } from '../../../lib/response.js';
import { GeminiContentGenerator } from '../ai-content-generator.js';
// ✅ IMPORT CORE ENGINE (Đảm bảo đường dẫn đúng tới file product-core.js)
import { loadProductNormalized } from '../../../core/product-core.js';

/**
 * API: Batch Analyze Videos
 * POST /api/social/douyin/batch-analyze
 * Body: { video_ids: string[], product_id: string }
 */
export async function batchAnalyzeVideos(req, env) {
  try {
    const body = await req.json();
    const { video_ids, product_id } = body;

    // 1. Validate Input (Có req để fix CORS)
    if (!video_ids || !Array.isArray(video_ids) || video_ids.length === 0) {
      return json({ ok: false, error: 'Thiếu video_ids hoặc mảng rỗng' }, { status: 400 }, req);
    }

    if (!product_id) {
      return json({ ok: false, error: 'Thiếu product_id' }, { status: 400 }, req);
    }

    // 2. [CORE INTEGRATION] Lấy dữ liệu sản phẩm chuẩn từ Core
    // Hàm này đã bao gồm: Query DB, Join Variants, Tính giá, Cache KV
    const product = await loadProductNormalized(env, product_id);

    if (!product) {
      return json({ ok: false, error: 'Sản phẩm không tồn tại' }, { status: 404 }, req);
    }

    // Update status ban đầu cho tất cả video (Dùng Promise.all)
    const now = Date.now();
    if (video_ids.length > 0) {
        const placeholders = video_ids.map(() => '?').join(',');
        await env.DB.prepare(`
            UPDATE douyin_videos
            SET status = 'analyzing', updated_at = ?
            WHERE id IN (${placeholders}) AND product_id = ?
        `).bind(now, ...video_ids, product_id).run();
    }

    // 3. Initialize Gemini AI
    const gemini = new GeminiContentGenerator(env.GEMINI_API_KEY);
    const results = [];

    // 4. Xử lý từng video
    for (const videoId of video_ids) {
      try {
        // Lấy thông tin video
        const video = await env.DB.prepare(`
          SELECT * FROM douyin_videos WHERE id = ?
        `).bind(videoId).first();

        if (!video) {
          results.push({ video_id: videoId, status: 'error', error: 'Video not found' });
          continue;
        }

        // 5. Chuẩn bị Context cho AI từ dữ liệu Core
        const productInfo = {
          name: product.name, // Lấy từ Core (đã chuẩn hóa)
          description: product.short_description || product.description, // Ưu tiên mô tả ngắn
          price: product.price_final, // ✅ Lấy giá bán cuối cùng (đã tính sale/flash sale)
          original_price: product.price_original,
          category: product.category_slug,
          brand: product.brand || 'Shop Huy Vân',
          url: `https://shophuyvan.vn/product/${product.slug || product.id}`
        };

        const analysisCtx = {
          source: video.source_type === 'upload' ? 'upload' : 'douyin',
          url: video.original_video_url || 'Uploaded video',
          analyzed_at: Date.now()
        };

        // Gọi AI Generate
        const aiContent = await gemini.generateFacebookContent(
          analysisCtx,
          'friendly',
          productInfo
        );

        // Transform AI output thành Scripts
        const scripts = [
          {
            version: 1,
            style: '🎯 Casual & Friendly',
            tone: 'casual',
            text: aiContent.version1?.caption || `Sản phẩm ${product.name} này xịn lắm luôn! 😍`,
            hashtags: aiContent.version1?.hashtags || ['#GiaDung', '#HuyVan'],
            cta: aiContent.version1?.cta || 'Mua ngay tại Shop Huy Vân'
          },
          {
            version: 2,
            style: '🔥 Sale Sập Sàn',
            tone: 'sale-heavy',
            text: aiContent.version2?.caption || `FLASH SALE: ${product.name} chỉ còn ${product.price_final}đ!`,
            hashtags: aiContent.version2?.hashtags || ['#FlashSale', '#GiamGia'],
            cta: aiContent.version2?.cta || 'Săn deal ngay'
          },
          {
            version: 3,
            style: '📖 Storytelling',
            tone: 'storytelling',
            text: aiContent.version3?.caption || 'Câu chuyện khách hàng trải nghiệm...',
            hashtags: aiContent.version3?.hashtags || ['#Review', '#Feedback'],
            cta: aiContent.version3?.cta || 'Xem chi tiết'
          }
        ];

        // Lưu kết quả vào DB
        await env.DB.prepare(`
          UPDATE douyin_videos
          SET 
            ai_analysis_json = ?,
            status = 'waiting_approval',
            updated_at = ?
          WHERE id = ?
        `).bind(
          JSON.stringify({
            product_name: product.name,
            product_price: product.price_final,
            key_selling_points: extractKeyPoints(product.short_description),
            scripts: scripts,
            analyzed_at: Date.now()
          }),
          now,
          videoId
        ).run();

        results.push({ video_id: videoId, status: 'success' });

      } catch (analyzeError) {
        console.error(`[Batch Analyze] Error for video ${videoId}:`, analyzeError);
        
        await env.DB.prepare(`
          UPDATE douyin_videos
          SET status = 'error', error_message = ?, updated_at = ?
          WHERE id = ?
        `).bind(analyzeError.message, now, videoId).run();

        results.push({ video_id: videoId, status: 'error', error: analyzeError.message });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;

    // ✅ Return với req để fix CORS
    return json({
      ok: true,
      message: `Đã phân tích ${successCount}/${video_ids.length} video(s)`,
      results
    }, {}, req);

  } catch (error) {
    console.error('[Batch Analyze] Critical Error:', error);
    return json({ ok: false, error: error.message }, { status: 500 }, req);
  }
}

/**
 * API: Get Batch Status
 * GET /api/social/douyin/batch-status?ids=vid1,vid2,vid3
 */
export async function getBatchStatus(req, env) {
  try {
    const url = new URL(req.url);
    const idsParam = url.searchParams.get('ids');

    if (!idsParam) return json({ ok: false, error: 'Thiếu ids parameter' }, { status: 400 }, req);

    const videoIds = idsParam.split(',').map(id => id.trim()).filter(Boolean);
    if (videoIds.length === 0) return json({ ok: false, error: 'Danh sách IDs rỗng' }, { status: 400 }, req);

    const placeholders = videoIds.map(() => '?').join(',');
    const query = `
      SELECT 
        id as video_id,
        status,
        original_filename,
        original_cover_url,
        duration,
        ai_analysis_json,
        error_message,
        created_at,
        updated_at
      FROM douyin_videos
      WHERE id IN (${placeholders})
    `;

    const { results: videos } = await env.DB.prepare(query).bind(...videoIds).all();

    const data = videos.map(video => {
      let aiAnalysis = null;
      try {
        if (video.ai_analysis_json) aiAnalysis = JSON.parse(video.ai_analysis_json);
      } catch (e) {}

      let progress = 0;
      if (video.status === 'uploaded') progress = 20;
      else if (video.status === 'analyzing') progress = 50;
      else if (video.status === 'waiting_approval') progress = 100;
      else if (video.status === 'error') progress = 0;

      return {
        video_id: video.video_id,
        status: video.status,
        progress,
        filename: video.original_filename,
        thumbnail_url: video.original_cover_url,
        duration: video.duration,
        ai_analysis: aiAnalysis,
        error_message: video.error_message,
        created_at: video.created_at,
        updated_at: video.updated_at
      };
    });

    return json({ ok: true, data }, {}, req);

  } catch (error) {
    console.error('[Batch Status] Error:', error);
    return json({ ok: false, error: error.message }, { status: 500 }, req);
  }
}

/**
 * Helper: Extract key selling points
 */
function extractKeyPoints(description) {
  if (!description) return [];
  const bullets = description.match(/[-•]\s*(.+?)(?=[-•]|$)/g);
  if (bullets) {
    return bullets.map(b => b.replace(/^[-•]\s*/, '').trim()).slice(0, 5);
  }
  return description.split(/[.!?]/).filter(Boolean).slice(0, 3).map(s => s.trim());
}

console.log('✅ douyin-batch-analyzer.js loaded (Core Integrated)');