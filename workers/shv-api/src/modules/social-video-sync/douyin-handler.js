// File: workers/shv-api/src/modules/social-video-sync/douyin-handler.js

// Import cần thiết
import { json } from '../../lib/response.js'; 

/**
 * Hàm tạo ID ngắn gọn (Dùng nội bộ)
 */
function generateId(prefix = 'vid') {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Helper để trả về lỗi chuẩn format (Thay thế cho hàm error bị thiếu)
 */
function errorResponse(msg, status = 400) {
    return json({ ok: false, error: msg }, { status });
}

/**
 * API: Upload Videos từ máy tính
 * POST /api/social/douyin/upload
 * Body: FormData với files[] và product_id
 */
export async function uploadDouyinVideos(req, env) {
    try {
        const formData = await req.formData();
        const productId = formData.get('product_id');
        const files = formData.getAll('files');

        if (!files || files.length === 0) {
            return errorResponse('Vui lòng chọn ít nhất 1 video', 400);
        }

        console.log(`[Douyin Upload] 📤 Received ${files.length} files for product ${productId}`);

        const uploadedVideos = [];
        const now = Date.now();

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const videoId = generateId('dyup');
            
            // Đọc file content
            const buffer = await file.arrayBuffer();
            const size = buffer.byteLength;
            const filename = file.name || `video_${i + 1}.mp4`;

            console.log(`[Douyin Upload] ⚙️ Processing: ${filename} (${(size / 1024 / 1024).toFixed(2)} MB)`);

            // Upload lên R2 storage
            const r2Key = `douyin/uploads/${videoId}/${filename}`;
            await env.R2_BUCKET.put(r2Key, buffer, {
                httpMetadata: {
                    contentType: file.type || 'video/mp4'
                }
            });

            // Tạo public URL (sử dụng R2 public domain của bạn)
            // TODO: Thay YOUR_R2_PUBLIC_DOMAIN bằng domain thật
            const videoUrl = `https://pub-YOUR_R2_PUBLIC_ID.r2.dev/${r2Key}`;
            
            // TODO: Generate thumbnail (tạm thời dùng placeholder)
            const thumbnailUrl = 'https://via.placeholder.com/300x533/000000/FFFFFF/?text=Video';

            // Lưu metadata vào D1
            await env.DB.prepare(`
                INSERT INTO douyin_videos (
                    id, product_id, filename, file_size, video_url, thumbnail_url,
                    status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'uploaded', ?, ?)
            `).bind(
                videoId, 
                productId || null, 
                filename, 
                size, 
                videoUrl, 
                thumbnailUrl,
                now, 
                now
            ).run();

            uploadedVideos.push({
                video_id: videoId,
                filename: filename,
                size: size,
                thumbnail_url: thumbnailUrl,
                duration: 0, // TODO: Extract từ video metadata
                status: 'uploaded'
            });

            console.log(`[Douyin Upload] ✅ Uploaded: ${videoId}`);
        }

        console.log(`[Douyin Upload] 🎉 All done! ${uploadedVideos.length} videos`);

        return json({
            ok: true,
            success: true,
            message: `Đã upload ${uploadedVideos.length} videos thành công`,
            videos: uploadedVideos
        });

    } catch (e) {
        console.error('[Douyin Upload] ❌ Error:', e);
        return errorResponse('Lỗi upload: ' + e.message, 500);
    }
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
            return errorResponse('Vui lòng nhập link Douyin/TikTok hợp lệ', 400);
        }

        const videoId = generateId('douyin');
        const now = Date.now();

        // 1. Lưu vào DB trạng thái "analyzing"
        const stmt = env.DB.prepare(`
            INSERT INTO douyin_videos (
                id, product_id, douyin_url, status, created_at, updated_at
            ) VALUES (?, ?, ?, 'analyzing', ?, ?)
        `);
        
        await stmt.bind(videoId, product_id || null, url, now, now).run();

        // Return ngay ID để Frontend polling
        return json({
            success: true, // Giữ field này cho UI cũ nếu cần
            ok: true,      // Chuẩn mới
            data: {
                video_id: videoId,
                status: 'analyzing',
                message: 'Đang phân tích video...'
            }
        });

    } catch (e) {
        console.error('[Douyin] Analyze Error:', e);
        return errorResponse('Lỗi server: ' + e.message, 500);
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
        
        const video = await env.DB.prepare('SELECT * FROM douyin_videos WHERE id = ?').bind(id).first();
        
        if (!video) return errorResponse('Video không tồn tại', 404);

        // --- MOCK DATA START (Giả lập để test UI) ---
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
        });

    } catch (e) {
        console.error('[Douyin] Get Status Error:', e);
        return errorResponse(e.message, 500);
    }
}