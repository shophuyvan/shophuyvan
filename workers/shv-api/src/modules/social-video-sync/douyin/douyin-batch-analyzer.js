/**
 * File: workers/shv-api/src/modules/social-video-sync/douyin/batch-analyzer.js
 * Phân tích nhiều video Douyin cùng lúc bằng Gemini AI
 */

import { json } from '../../../lib/response.js';
import { GeminiContentGenerator } from '../ai-content-generator.js';

/**
 * API: Batch Analyze Videos
 * POST /api/social/douyin/batch-analyze
 * Body: { video_ids: string[], product_id: string }
 */
export async function batchAnalyzeVideos(req, env) {
  try {
    const body = await req.json();
    const { video_ids, product_id } = body;

    if (!video_ids || !Array.isArray(video_ids) || video_ids.length === 0) {
      return json({ 
        ok: false, 
        error: 'Thiếu video_ids hoặc mảng rỗng' 
      }, { status: 400 });
    }

    if (!product_id) {
      return json({ ok: false, error: 'Thiếu product_id' }, { status: 400 });
    }

    // Get product info (Lưu ý: Bảng products không có cột price, phải lấy từ variants)
    const product = await env.DB.prepare(`
      SELECT id, title, shortDesc, category_slug, brand
      FROM products
      WHERE id = ?
    `).bind(product_id).first();

    if (!product) {
      return json({ ok: false, error: 'Sản phẩm không tồn tại' }, { status: 404 });
    }

    // [CORE FIX] Lấy giá từ bảng variants (Lấy giá thấp nhất làm đại diện)
    const variant = await env.DB.prepare(`
        SELECT price FROM variants WHERE product_id = ? ORDER BY price ASC LIMIT 1
    `).bind(product_id).first();

    // Gán giá vào object product để dùng cho AI
    product.price = variant ? variant.price : 0;

    // Update all videos to "analyzing" status
    const now = Date.now();
    for (const videoId of video_ids) {
      await env.DB.prepare(`
        UPDATE douyin_videos
        SET status = 'analyzing', updated_at = ?
        WHERE id = ? AND product_id = ?
      `).bind(now, videoId, product_id).run();
    }

    // Start background analysis (in production, use Queue)
    // For now, process sequentially
    const results = [];

    // Initialize Gemini
    const gemini = new GeminiContentGenerator(env.GEMINI_API_KEY);

    for (const videoId of video_ids) {
      try {
        // Get video info
        const video = await env.DB.prepare(`
          SELECT * FROM douyin_videos WHERE id = ?
        `).bind(videoId).first();

        if (!video) {
          results.push({
            video_id: videoId,
            status: 'error',
            error: 'Video không tồn tại'
          });
          continue;
        }

        // Build product info for AI
        const productInfo = {
          name: product.title,
          description: product.shortDesc,
          price: product.price,
          category: product.category_slug,
          brand: product.brand || 'Shop Huy Vân',
          url: `https://shophuyvan.vn/product/${product.id}`
        };

        // Generate Vietnamese scripts using Gemini
        const analysis = {
          source: video.source_type === 'upload' ? 'upload' : 'douyin',
          url: video.original_video_url || 'Uploaded video',
          analyzed_at: Date.now()
        };

        const aiContent = await gemini.generateFacebookContent(
          analysis,
          'friendly',
          productInfo
        );

        // Transform AI output to scripts format
        const scripts = [
          {
            version: 1,
            style: '🎯 Casual & Friendly',
            tone: 'casual',
            text: aiContent.version1?.caption || 'Sản phẩm này xịn lắm luôn! 😍',
            hashtags: aiContent.version1?.hashtags || ['#GiaDung'],
            cta: aiContent.version1?.cta || 'Mua ngay tại ShopHuyVan.vn'
          },
          {
            version: 2,
            style: '🔥 Sale Sập Sàn',
            tone: 'sale-heavy',
            text: aiContent.version2?.caption || 'FLASH SALE 24H - GIẢM SỐC 30%!',
            hashtags: aiContent.version2?.hashtags || ['#FlashSale'],
            cta: aiContent.version2?.cta || 'Đặt ngay kẻo hết!'
          },
          {
            version: 3,
            style: '📖 Storytelling',
            tone: 'storytelling',
            text: aiContent.version3?.caption || 'Chị Hương (Q7) chia sẻ: "Mua về dùng thấy tiện lắm..."',
            hashtags: aiContent.version3?.hashtags || ['#Review'],
            cta: aiContent.version3?.cta || 'Xem thêm review'
          },
          {
            version: 4,
            style: '👨‍💼 Professional',
            tone: 'professional',
            text: aiContent.version4?.caption || 'Công nghệ hiện đại, tiết kiệm điện năng...',
            hashtags: aiContent.version4?.hashtags || ['#ChuyenGia'],
            cta: aiContent.version4?.cta || 'Tư vấn miễn phí'
          },
          {
            version: 5,
            style: '💡 Tips & Tricks',
            tone: 'tips',
            text: aiContent.version5?.caption || 'Mẹo hay: Dùng sản phẩm này kết hợp với...',
            hashtags: aiContent.version5?.hashtags || ['#MeoVat'],
            cta: aiContent.version5?.cta || 'Học thêm tips'
          }
        ];

        // Save AI analysis to database
        await env.DB.prepare(`
          UPDATE douyin_videos
          SET 
            ai_analysis_json = ?,
            status = 'waiting_approval',
            updated_at = ?
          WHERE id = ?
        `).bind(
          JSON.stringify({
            product_name: product.title,
            product_price: product.price,
            key_selling_points: extractKeyPoints(product.shortDesc),
            scripts: scripts,
            analyzed_at: Date.now()
          }),
          now,
          videoId
        ).run();

        results.push({
          video_id: videoId,
          status: 'success',
          scripts_count: scripts.length
        });

      } catch (analyzeError) {
        console.error(`[Batch Analyze] Error for video ${videoId}:`, analyzeError);
        
        // Update video status to error
        await env.DB.prepare(`
          UPDATE douyin_videos
          SET status = 'error', error_message = ?, updated_at = ?
          WHERE id = ?
        `).bind(analyzeError.message, now, videoId).run();

        results.push({
          video_id: videoId,
          status: 'error',
          error: analyzeError.message
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;

    return json({
      ok: true,
      message: `Đã phân tích ${successCount}/${video_ids.length} video(s)`,
      results
    });

  } catch (error) {
    console.error('[Batch Analyze] Error:', error);
    return json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
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

    if (!idsParam) {
      return json({ ok: false, error: 'Thiếu ids parameter' }, { status: 400 });
    }

    const videoIds = idsParam.split(',').map(id => id.trim()).filter(Boolean);

    if (videoIds.length === 0) {
      return json({ ok: false, error: 'Danh sách IDs rỗng' }, { status: 400 });
    }

    // Build query with placeholders
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

    const stmt = env.DB.prepare(query);
    const { results: videos } = await stmt.bind(...videoIds).all();

    // Parse JSON fields
    const data = videos.map(video => {
      let aiAnalysis = null;
      try {
        if (video.ai_analysis_json) {
          aiAnalysis = JSON.parse(video.ai_analysis_json);
        }
      } catch (e) {
        console.warn('Failed to parse ai_analysis_json for video:', video.video_id);
      }

      // Calculate progress
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

    return json({
      ok: true,
      data
    });

  } catch (error) {
    console.error('[Batch Status] Error:', error);
    return json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
}

/**
 * Helper: Extract key selling points from description
 */
function extractKeyPoints(description) {
  if (!description) return [];
  
  // Simple extraction: find bullet points or numbered lists
  const bullets = description.match(/[-•]\s*(.+?)(?=[-•]|$)/g);
  if (bullets) {
    return bullets.map(b => b.replace(/^[-•]\s*/, '').trim()).slice(0, 5);
  }

  // Fallback: split by periods and take first 3
  const sentences = description.split(/[.!?]/).filter(Boolean);
  return sentences.slice(0, 3).map(s => s.trim());
}

console.log('✅ douyin-batch-analyzer.js loaded');
