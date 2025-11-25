// File: workers/shv-api/src/modules/social-video-sync/douyin-handler.js

import { json } from '../../lib/response.js'; 

/**
 * Hàm tạo ID ngắn gọn
 */
function generateId(prefix = 'vid') {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Helper trả về lỗi chuẩn
 * QUAN TRỌNG: Phải truyền req vào tham số thứ 3 của json()
 */
function errorResponse(req, msg, status = 400) {
    return json(
        { ok: false, error: msg }, 
        { status }, 
        req // ✅ FIX: Truyền req để lib/response.js tự tạo CORS headers
    );
}

/**
 * API: Phân tích Video Douyin (Bước 1)
 * POST /api/douyin/analyze
 */
export async function analyzeDouyinVideo(req, env) {
    try {
        const body = await req.json();
        const { url, product_id } = body;

        if (!url || (!url.includes('douyin.com') && !url.includes('tiktok.com'))) {
            return errorResponse(req, 'Vui lòng nhập link Douyin/TikTok hợp lệ', 400);
        }

        const videoId = generateId('douyin');
        const now = Date.now();

        // Kiểm tra DB connection
        if (!env.DB) {
            throw new Error('Database (env.DB) chưa được kết nối!');
        }

        const stmt = env.DB.prepare(`
            INSERT INTO douyin_videos (
                id, product_id, douyin_url, status, created_at, updated_at
            ) VALUES (?, ?, ?, 'analyzing', ?, ?)
        `);
        
        await stmt.bind(videoId, product_id || null, url, now, now).run();

        // ✅ FIX: Truyền req vào tham số thứ 3
        return json({
            ok: true,      
            success: true, 
            data: {
                video_id: videoId,
                status: 'analyzing',
                message: 'Đang phân tích video...'
            }
        }, {}, req); 

    } catch (e) {
        console.error('[Douyin] Analyze Error:', e);
        return errorResponse(req, 'Lỗi server: ' + e.message, 500);
    }
}

/**
 * API: Lấy trạng thái xử lý (Polling)
 * GET /api/douyin/:id
 */
export async function getDouyinStatus(req, env) {
    try {
        const url = new URL(req.url);
        const id = url.pathname.split('/').pop();
        
        if (!env.DB) {
             throw new Error('Database (env.DB) chưa được kết nối!');
        }

        const video = await env.DB.prepare('SELECT * FROM douyin_videos WHERE id = ?').bind(id).first();
        
        if (!video) return errorResponse(req, 'Video không tồn tại', 404);

        // --- MOCK DATA (Giả lập trả về kết quả sau 3s) ---
        const timeDiff = Date.now() - video.created_at;
        
        if (video.status === 'analyzing' && timeDiff > 3000) {
            return json({
                ok: true,
                success: true,
                data: {
                    ...video,
                    status: 'waiting_approval',
                    original_cover_url: 'https://via.placeholder.com/300x533/000000/FFFFFF/?text=Video+Preview',
                    ai_analysis: {
                        product_name: "Sản phẩm Demo Douyin",
                        key_selling_points: ["Hàng nội địa Trung", "Giá rẻ", "Chất lượng cao"],
                        scripts: [
                            { 
                                version: 1, 
                                style: '🔥 TikTok Trend', 
                                text: "Mọi người ơi, phát hiện ra một siêu phẩm cực hot..." 
                            },
                            { 
                                version: 2, 
                                style: '👨‍⚕️ Review Chi Tiết', 
                                text: "Trên tay mình là sản phẩm đang làm mưa làm gió..." 
                            },
                            { 
                                version: 3, 
                                style: '💰 Chốt Đơn Gấp', 
                                text: "Xả kho giá sốc chỉ trong livestream hôm nay..." 
                            }
                        ]
                    }
                }
            }, {}, req); // ✅ FIX: Truyền req
        }

        // Parse JSON nếu có
        let aiAnalysis = null;
        try {
            if (video.ai_analysis_json) aiAnalysis = JSON.parse(video.ai_analysis_json);
        } catch (e) {}

        return json({ 
            ok: true,
            success: true, 
            data: {
                ...video,
                ai_analysis: aiAnalysis
            }
        }, {}, req); // ✅ FIX: Truyền req

    } catch (e) {
        console.error('[Douyin] Get Status Error:', e);
        return errorResponse(req, e.message, 500);
    }
}