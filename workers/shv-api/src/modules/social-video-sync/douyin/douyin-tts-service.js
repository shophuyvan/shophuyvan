/**
 * File: workers/shv-api/src/modules/social-video-sync/douyin/tts-service.js
 * Text-to-Speech Service using FPT.AI Voice API
 */

/**
 * Generate Vietnamese voiceover using FPT.AI
 * Docs: https://fpt.ai/vi/voice
 * 
 * @param {string} script - Vietnamese script text
 * @param {string} voice - Voice ID (leminh, myan, lannhi, etc.)
 * @param {number} speed - Speed from -3 to +3
 * @param {Env} env - Worker env
 * @returns {Promise<{audioBuffer: ArrayBuffer, r2Key: string, r2Url: string}>}
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

    if (!data.async && !data.audio) {
      throw new Error('FPT.AI không trả về audio data');
    }

    // Decode base64 audio
    const audioBase64 = data.audio;
    const audioBuffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));

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
 * Estimate audio duration based on script length
 * Average: 150 words per minute for Vietnamese
 */
function estimateDuration(script) {
  const words = script.split(/\s+/).length;
  const minutes = words / 150;
  return Math.round(minutes * 60); // seconds
}

/**
 * Get available voices
 */
export const AVAILABLE_VOICES = {
  // Nam miền Bắc
  leminh: {
    id: 'leminh',
    name: 'Lê Minh',
    gender: 'male',
    region: 'north',
    description: 'Giọng nam trẻ, năng động'
  },
  thuminh: {
    id: 'thuminh',
    name: 'Thu Minh',
    gender: 'male',
    region: 'south',
    description: 'Giọng nam miền Nam, trầm ấm'
  },
  
  // Nữ miền Bắc
  myan: {
    id: 'myan',
    name: 'My An',
    gender: 'female',
    region: 'north',
    description: 'Giọng nữ dễ thương, trẻ trung'
  },
  
  // Nữ miền Nam
  lannhi: {
    id: 'lannhi',
    name: 'Lan Nhi',
    gender: 'female',
    region: 'south',
    description: 'Giọng nữ nhẹ nhàng, dịu dàng'
  },
  
  // Nữ miền Trung
  banmai: {
    id: 'banmai',
    name: 'Ban Mai',
    gender: 'female',
    region: 'central',
    description: 'Giọng nữ chuyên nghiệp'
  }
};

/**
 * Test TTS API connection
 */
export async function testTTSConnection(env) {
  try {
    const result = await generateVietnameseVoiceover(
      'Xin chào, đây là test.',
      'myan',
      0,
      env
    );
    return {
      success: true,
      message: 'FPT.AI TTS hoạt động bình thường',
      testAudioUrl: result.r2Url
    };
  } catch (error) {
    return {
      success: false,
      message: 'FPT.AI TTS gặp lỗi',
      error: error.message
    };
  }
}

console.log('✅ douyin-tts-service.js loaded');
