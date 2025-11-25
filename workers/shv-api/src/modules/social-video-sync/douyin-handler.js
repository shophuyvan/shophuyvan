// File: workers/shv-api/src/modules/social-video-sync/douyin-handler.js

import { json, error } from '../../lib/response.js';
import { createId } from '../../lib/utils.js'; // Đảm bảo utils.js có hàm createId hoặc dùng uuid

/**
 * Hàm tạo ID ngắn gọn nếu utils chưa có
 */
function generateId(prefix = 'vid') {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
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
            return error('Vui lòng nhập link Douyin/TikTok hợp lệ', 400);
        }

        const videoId = generateId('douyin');
        const now = Date.now();

        // 1. Lưu vào DB trạng thái "analyzing"
        // Lưu ý: Dùng prepare statement để tránh SQL Injection
        const stmt = env.DB.prepare(`
            INSERT INTO douyin_videos (
                id, product_id, douyin_url, status, created_at, updated_at
            ) VALUES (?, ?, ?, 'analyzing', ?, ?)
        `);
        
        await stmt.bind(videoId, product_id || null, url, now, now).run();

        // 2. [TODO] Trigger Worker Queue / Cloud Run để tải video thật
        // Tạm thời bỏ qua bước này để test giao diện trước

        // Return ngay ID để Frontend polling
        return json({
            success: true,
            data: {
                video_id: videoId,
                status: 'analyzing',
                message: 'Đang phân tích video...'
            }
        });

    } catch (e) {
        console.error('[Douyin] Analyze Error:', e);
        return error('Lỗi server: ' + e.message, 500);
    }
}

/**
 * API: Lấy trạng thái xử lý (Polling)
 * GET /api/douyin/:id
 */
export async function getDouyinStatus(req, env) {
    try {
        // Lấy ID từ URL (đã được parse ở admin.js hoặc index.js)
        const url = new URL(req.url);
        const id = url.pathname.split('/').pop();
        
        const video = await env.DB.prepare('SELECT * FROM douyin_videos WHERE id = ?').bind(id).first();
        
        if (!video) return error('Video không tồn tại', 404);

        // --- MOCK DATA START ---
        // Giả lập Gemini đã phân tích xong sau 3 giây (để test UI)
        // Logic thực tế: Worker khác sẽ update DB, API này chỉ việc đọc DB
        const timeDiff = Date.now() - video.created_at;
        
        if (video.status === 'analyzing' && timeDiff > 3000) {
            // Giả vờ update DB thành công (chỉ trả về data giả, không update DB thật để test lại được)
            return json({
                success: true,
                data: {
                    ...video,
                    status: 'waiting_approval',
                    original_cover_url: 'https://via.placeholder.com/300x533/000000/FFFFFF/?text=Video+Preview', // Placeholder ảnh dọc
                    ai_analysis: {
                        product_name: "Vòi sen tăng áp Inox 304",
                        key_selling_points: ["Áp lực nước mạnh 300%", "Tiết kiệm nước", "Chất liệu Inox bền bỉ"],
                        scripts: [
                            { 
                                version: 1, 
                                style: '🔥 TikTok Trend', 
                                text: "Trời ơi tin được không? Vòi sen này mạnh dã man! Tắm bao phê, nước phun ầm ầm mà vẫn tiết kiệm. Chốt đơn ngay kẻo hết bà con ơi!" 
                            },
                            { 
                                version: 2, 
                                style: '👨‍⚕️ Chuyên Gia Review', 
                                text: "Đánh giá chi tiết vòi sen tăng áp Inox 304. Thiết kế vi lỗ công nghệ Nhật Bản giúp tăng áp lực nước gấp 3 lần. Sản phẩm đáng mua nhất năm nay." 
                            },
                            { 
                                version: 3, 
                                style: '💰 Sale Sập Sàn', 
                                text: "Xả kho vòi sen tăng áp giá sốc chỉ hôm nay! Mua 1 tặng 1, freeship toàn quốc. Nhanh tay bấm vào giỏ hàng bên dưới nhé!" 
                            }
                        ]
                    }
                }
            });
        }
        // --- MOCK DATA END ---

        // Trả về data thực từ DB (nếu chưa xong hoặc đã xong thật)
        let aiAnalysis = null;
        try {
            if (video.ai_analysis_json) aiAnalysis = JSON.parse(video.ai_analysis_json);
        } catch (e) {}

        return json({ 
            success: true, 
            data: {
                ...video,
                ai_analysis: aiAnalysis
            }
        });

    } catch (e) {
        console.error('[Douyin] Get Status Error:', e);
        return error(e.message, 500);
    }
}