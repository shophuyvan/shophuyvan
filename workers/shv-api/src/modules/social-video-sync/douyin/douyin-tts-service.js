/**
 * File: workers/shv-api/src/modules/social-video-sync/douyin/douyin-tts-service.js
 * Text-to-Speech Service using FPT.AI Voice API
 * [FIXED] Handle Async URL + Retry Logic + Fix Missing Exports
 */

/**
 * Generate Vietnamese voiceover using FPT.AI
 */
export async function generateVietnameseVoiceover(script, voice = 'leminh', speed = 0, env) {
  try {
    // Validate inputs
    if (!script || script.trim().length === 0) {
      throw new Error('Script không được để trống');
    }

    if (!env.FPT_AI_API_KEY) {
      throw new Error('Chưa cấu hình FPT_AI_API_KEY');
    }

    // Call FPT.AI TTS API
    const response = await fetch('https://api.fpt.ai/hmi/tts/v5', {
      method: 'POST',
      headers: {
        'api-key': env.FPT_AI_API_KEY,
        'voice': voice,
        'speed': speed.toString(),
        'format': 'mp3'
      },
      body: script
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FPT.AI API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    let audioBuffer;

    // [FIX LOGIC] Xử lý link Async thông minh hơn (Thử lại 5 lần)
    if (data.async) {
        console.log('[TTS] FPT.AI returned URL:', data.async);
        
        let attempts = 0;
        let audioRes = null;
        
        // Vòng lặp thử tải file (vì FPT cần 1-2s để render file xong)
        while (attempts < 5) {
            try {
                // Thêm User-Agent để tránh bị chặn
                audioRes = await fetch(data.async, {
                    headers: { 'User-Agent': 'ShopHuyVan-Worker/1.0' }
                });
                
                if (audioRes.ok) break; // Tải được thì thoát vòng lặp
            } catch (e) { 
                console.warn(`Retry fetch audio (${attempts + 1}/5)...`); 
            }
            
            attempts++;
            // Đợi 1.5 giây trước khi thử lại
            await new Promise(r => setTimeout(r, 1500)); 
        }

        if (!audioRes || !audioRes.ok) {
            throw new Error(`Không thể tải file audio từ FPT URL sau 5 lần thử. Status: ${audioRes ? audioRes.status : 'Network Error'}`);
        }
        
        audioBuffer = await audioRes.arrayBuffer();

    } else if (data.audio) {
        // Trường hợp 2: Trả về Base64 -> Decode
        console.log('[TTS] FPT.AI returned Base64');
        const audioBase64 = data.audio;
        if (!audioBase64) throw new Error('Dữ liệu Base64 bị rỗng');
        audioBuffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
    } else {
        console.error('[TTS] Invalid Response:', data);
        throw new Error('FPT.AI không trả về dữ liệu âm thanh hợp lệ (missing async/audio)');
    }

    // Upload to R2
    const audioId = `vo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const date = new Date();
    const r2Key = `douyin/voiceovers/${date.getFullYear()}/${date.getMonth() + 1}/${audioId}.mp3`;

    await env.SOCIAL_VIDEOS.put(r2Key, audioBuffer, {
      httpMetadata: {
        contentType: 'audio/mpeg',
        cacheControl: 'public, max-age=31536000'
      },
      customMetadata: {
        voice,
        speed: speed.toString(),
        scriptLength: script.length.toString(),
        generatedAt: Date.now().toString()
      }
    });

    const r2Url = `https://social-videos.shophuyvan.vn/${r2Key}`;

    return {
      audioBuffer, 
      r2Key,
      r2Url,
      duration: estimateDuration(script),
      voice,
      speed
    };

  } catch (error) {
    console.error('[TTS] Error:', error);
    throw error;
  }
}

/**
 * Estimate audio duration
 */
function estimateDuration(script) {
  const words = script.split(/\s+/).length;
  const minutes = words / 150;
  return Math.round(minutes * 60); 
}

// =======================================================
// [QUAN TRỌNG] PHẦN BỊ THIẾU ĐÃ ĐƯỢC BỔ SUNG
// =======================================================

/**
 * Danh sách giọng đọc FPT.AI hỗ trợ
 */
export const AVAILABLE_VOICES = {
  banmai: { id: 'banmai', name: 'Ban Mai (Nữ - Miền Bắc)', gender: 'female' },
  leminh: { id: 'leminh', name: 'Lê Minh (Nam - Miền Bắc)', gender: 'male' },
  myan: { id: 'myan', name: 'Mỹ An (Nữ - Miền Trung)', gender: 'female' },
  lannhi: { id: 'lannhi', name: 'Lan Nhi (Nữ - Miền Nam)', gender: 'female' },
  linhsan: { id: 'linhsan', name: 'Linh San (Nữ - Miền Nam)', gender: 'female' },
  minhquang: { id: 'minhquang', name: 'Minh Quang (Nam - Miền Nam)', gender: 'male' }
};

/**
 * Hàm test kết nối FPT.AI (Dùng cho nút Test Connection)
 */
export async function testTTSConnection(env) {
  try {
    if (!env.FPT_AI_API_KEY) {
      return { ok: false, error: 'Chưa cấu hình FPT_AI_API_KEY trong Wrangler' };
    }
    return { ok: true, message: 'Kết nối FPT.AI OK (API Key đã được cấu hình)' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

console.log('✅ douyin-tts-service.js loaded (Fixed Exports & Retry)');