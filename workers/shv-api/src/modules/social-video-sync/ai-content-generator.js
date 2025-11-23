import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiContentGenerator {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Sử dụng Gemini 1.5 Flash để tối ưu tốc độ và cost
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  /**
   * Phân tích nội dung video (Simulation cho Version 1)
   * Lưu ý: Worker khó upload video file lớn trực tiếp lên Gemini File API do giới hạn RAM/Time.
   * V1: Ta sẽ generate caption dựa trên prompt kỹ thuật.
   * V2: Sẽ update upload file buffer nếu cần thiết.
   */
  async analyzeVideo(videoUrl) {
    // Trong V1, trả về metadata để context cho hàm generate
    return {
      source: "tiktok",
      url: videoUrl,
      analyzed_at: Date.now()
    };
  }

  /**
   * Tạo 3 phiên bản nội dung Facebook
   */
  async generateFacebookContent(analysis, brandVoice = "friendly") {
    try {
      const prompt = `
        Bạn là một chuyên gia Social Media Marketing. Hãy viết nội dung cho bài đăng Facebook Reel dựa trên video từ TikTok.
        
        Yêu cầu:
        1. Tone giọng: ${brandVoice} (ví dụ: vui vẻ, chuyên nghiệp, hài hước).
        2. Tạo ra 3 phiên bản (Version A, Version B, Version C) khác nhau hoàn toàn.
        3. Mỗi phiên bản gồm: 
           - Caption thu hút (2-3 dòng đầu cực dính).
           - Kêu gọi hành động (CTA) tự nhiên.
           - 5-10 Hashtag phù hợp xu hướng tại Việt Nam.
        
        Output định dạng JSON chính xác như sau (không markdown):
        {
          "versionA": { "caption": "...", "hashtags": ["#tag1"] },
          "versionB": { "caption": "...", "hashtags": ["#tag1"] },
          "versionC": { "caption": "...", "hashtags": ["#tag1"] }
        }
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Clean markdown nếu Gemini lỡ thêm vào
      const jsonStr = text.replace(/```json|```/g, "").trim();
      return JSON.parse(jsonStr);

    } catch (error) {
      console.error("[Gemini] Generate Error:", error);
      // Fallback nếu AI lỗi
      return {
        versionA: { caption: "Video cực hay mời cả nhà xem nhé! ❤️", hashtags: ["#viral", "#trending"] },
        versionB: { caption: "Không thể bỏ qua video này đâu ạ 😍", hashtags: ["#reels", "#facebook"] },
        versionC: { caption: "Hot trend hôm nay 🔥", hashtags: ["#xuhuong"] }
      };
    }
  }
}