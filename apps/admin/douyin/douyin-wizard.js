// File: workers/shv-api/src/modules/social-video-sync/douyin-handler.js

// ✅ FIX 1: Import thêm corsHeaders
import { json, corsHeaders } from '../../lib/response.js'; 

/**
 * Hàm tạo ID ngắn gọn (Dùng nội bộ)
 */
function generateId(prefix = 'vid') {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Helper để trả về lỗi chuẩn format KÈM CORS HEADER
 */
function errorResponse(req, msg, status = 400) {
    return json(
        { ok: false, error: msg }, 
        { 
            status, 
            headers: corsHeaders(req) // ✅ Luôn trả về CORS headers khi lỗi
        }
    );
}

/**
 * API: Phân tích Video Douyin (Bước 1)
 * POST /api/douyin/analyze
 * Body: { url, product_id }
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

        // 1. Lưu vào DB trạng thái "analyzing"
        // Kiểm tra xem env.DB có tồn tại không trước khi gọi
        if (!env.DB) {
            throw new Error('Database (env.DB) chưa được kết nối!');
        }

        const stmt = env.DB.prepare(`
            INSERT INTO douyin_videos (
                id, product_id, douyin_url, status, created_at, updated_at
            ) VALUES (?, ?, ?, 'analyzing', ?, ?)
        `);
        
        await stmt.bind(videoId, product_id || null, url, now, now).run();

        // Return ngay ID để Frontend polling
        return json({
            ok: true,      
            success: true, // Support UI cũ
            data: {
                video_id: videoId,
                status: 'analyzing',
                message: 'Đang phân tích video...'
            }
        }, {
            headers: corsHeaders(req) // ✅ Luôn trả về CORS headers khi thành công
        });

    } catch (e) {
        console.error('[Douyin] Analyze Error:', e);
        // Trả về lỗi 500 kèm chi tiết để debug
        return errorResponse(req, 'Lỗi server: ' + e.message, 500);
    }
}

/**
 * API: Lấy trạng thái xử lý (Polling)
 * GET /api/douyin/:id
 */
export async function getDouyinStatus(req, env) {
    try {
        // Lấy ID từ URL
        const url = new URL(req.url);
        const id = url.pathname.split('/').pop();
        
        if (!env.DB) {
             throw new Error('Database (env.DB) chưa được kết nối!');
        }

        const video = await env.DB.prepare('SELECT * FROM douyin_videos WHERE id = ?').bind(id).first();
        
        if (!video) return errorResponse(req, 'Video không tồn tại', 404);

        // --- MOCK DATA START (Giả lập để test UI) ---
        const timeDiff = Date.now() - video.created_at;
        
        // Sau 3 giây thì trả về kết quả giả
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
                        key_selling_points: ["Tính năng 1", "Tính năng 2", "Giá tốt"],
                        scripts: [
                            { 
                                version: 1, 
                                style: '🔥 TikTok Trend', 
                                text: "Mẫu câu trend: Sản phẩm này đang hot rần rần trên TikTok..." 
                            },
                            { 
                                version: 2, 
                                style: '👨‍⚕️ Chuyên Gia', 
                                text: "Góc nhìn chuyên gia: Đây là giải pháp tối ưu cho gia đình bạn..." 
                            },
                            { 
                                version: 3, 
                                style: '💰 Sale Sốc', 
                                text: "Xả kho giá sốc! Chỉ còn vài xuất ưu đãi trong hôm nay..." 
                            }
                        ]
                    }
                }
            }, { headers: corsHeaders(req) });
        }
        // --- MOCK DATA END ---

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
        }, { headers: corsHeaders(req) });

    } catch (e) {
        console.error('[Douyin] Get Status Error:', e);
        return errorResponse(req, e.message, 500);
    }
}