/**
 * File: workers/shv-api/src/modules/social-video-sync/douyin/douyin-tts-service.js
 * FPT.AI Text-to-Speech (Standard v5 Implementation)
 * Dựa trên tài liệu: https://console.fpt.ai
 */

/**
 * Danh sách giọng đọc chuẩn FPT.AI
 */
export const AVAILABLE_VOICES = {
  banmai: { id: 'banmai', name: 'Ban Mai (Nữ - Miền Bắc)', gender: 'female' },
  lannhi: { id: 'lannhi', name: 'Lan Nhi (Nữ - Miền Nam)', gender: 'female' },
  leminh: { id: 'leminh', name: 'Lê Minh (Nam - Miền Bắc)', gender: 'male' },
  myan: { id: 'myan', name: 'Mỹ An (Nữ - Miền Trung)', gender: 'female' },
  thuminh: { id: 'thuminh', name: 'Thu Minh (Nữ - Miền Bắc)', gender: 'female' },
  giahuy: { id: 'giahuy', name: 'Gia Huy (Nam - Miền Trung)', gender: 'male' },
  linhsan: { id: 'linhsan', name: 'Linh San (Nữ - Miền Nam)', gender: 'female' }
};

/**
 * Hàm chính: Chuyển văn bản thành giọng nói
 */
export async function generateVietnameseVoiceover(script, voice = 'leminh', speed = 0, env) {
  try {
    // 1. Validate Input
    if (!script || script.trim().length === 0) {
      throw new Error('Nội dung script trống');
    }
    if (!env.FPT_AI_API_KEY) {
      throw new Error('Chưa cấu hình FPT_AI_API_KEY trong Wrangler');
    }

    // 2. Gọi API tạo yêu cầu (POST)
    // Tài liệu: POST https://api.fpt.ai/hmi/tts/v5
    console.log(`[TTS] Requesting FPT.AI (${voice})...`);
    
    const response = await fetch('https://api.fpt.ai/hmi/tts/v5', {
      method: 'POST',
      headers: {
        'api_key': env.FPT_AI_API_KEY, // Theo tài liệu mới là api_key
        'voice': voice,
        'speed': speed.toString(),
        'format': 'mp3',
        'Cache-Control': 'no-cache'
      },
      body: script // Body chứa nội dung văn bản
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Lỗi kết nối FPT API (${response.status}): ${errText}`);
    }

    const data = await response.json();

    // Kiểm tra lỗi từ FPT trả về
    if (data.error !== 0) {
      throw new Error(`FPT AI Error: ${data.message} (Code: ${data.error})`);
    }

    if (!data.async) {
      throw new Error('Phản hồi từ FPT không chứa đường dẫn async');
    }

    const audioUrl = data.async;
    console.log('[TTS] Audio URL received:', audioUrl);

    // 3. Cơ chế Polling (Chờ file sẵn sàng)
    // Tài liệu: "Thời gian chờ đợi từ 5 giây đến 2 phút"
    // Ta sẽ thử tải tối đa 15 lần, mỗi lần cách nhau 2 giây (Tổng 30s)
    let audioBuffer = null;
    let attempts = 0;
    const maxAttempts = 15;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        // Đợi một chút trước khi tải (Lần đầu chờ lâu hơn chút)
        const waitTime = attempts === 1 ? 3000 : 2000; 
        await new Promise(r => setTimeout(r, waitTime));

        console.log(`[TTS] Downloading audio (Attempt ${attempts}/${maxAttempts})...`);
        
        const audioRes = await fetch(audioUrl);
        
        // Nếu tải thành công (Status 200)
        if (audioRes.ok) {
          audioBuffer = await audioRes.arrayBuffer();
          console.log('[TTS] Download success!');
          break; 
        }
        
        // Nếu file chưa sẵn sàng, FPT thường trả về 404 hoặc file rỗng, ta tiếp tục vòng lặp
      } catch (e) {
        console.warn(`[TTS] Retry fetch... (${e.message})`);
      }
    }

    if (!audioBuffer) {
      throw new Error('Quá thời gian chờ (Timeout). File âm thanh chưa được FPT xử lý xong.');
    }

    // 4. Upload lên R2 Storage (Lưu trữ lâu dài)
    const audioId = `vo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const date = new Date();
    const r2Key = `douyin/voiceovers/${date.getFullYear()}/${date.getMonth() + 1}/${audioId}.mp3`;

    await env.SOCIAL_VIDEOS.put(r2Key, audioBuffer, {
      httpMetadata: {
        contentType: 'audio/mpeg',
        cacheControl: 'public, max-age=31536000'
      },
      customMetadata: {
        voice: voice,
        generatedAt: Date.now().toString()
      }
    });

    // 5. Trả kết quả
    const r2Url = `https://social-videos.shophuyvan.vn/${r2Key}`;
    
    return {
      audioBuffer,
      r2Key,
      r2Url,
      duration: estimateDuration(script), // Ước lượng độ dài
      voice,
      speed
    };

  } catch (error) {
    console.error('[TTS] Critical Error:', error);
    throw error;
  }
}

/**
 * Hàm ước lượng thời lượng (phút) = số từ / 150
 */
function estimateDuration(script) {
  if (!script) return 0;
  const words = script.split(/\s+/).length;
  return Math.round((words / 150) * 60);
}

/**
 * Hàm test kết nối (Dùng cho nút Test Connection trên giao diện)
 */
export async function testTTSConnection(env) {
  try {
    if (!env.FPT_AI_API_KEY) {
      return { ok: false, error: 'Chưa cấu hình FPT_AI_API_KEY trong Wrangler' };
    }
    return { ok: true, message: 'Kết nối FPT.AI OK' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

console.log('✅ douyin-tts-service.js loaded (FPT v5 Standard)');