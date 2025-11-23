import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiContentGenerator {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    // Sử dụng model 'gemini-1.5-flash' hoặc 'gemini-pro' (ổn định hơn)
    // Lưu ý: Đôi khi cần chỉ định rõ version nếu model mới ra mắt
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  /**
   * Phân tích nội dung video (Simulation cho Version 1)
   */
  async analyzeVideo(videoUrl) {
    // Hiện tại chỉ trả về metadata, sau này có thể nâng cấp gửi file
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
        Bạn là chuyên gia Content Marketing. Hãy viết 3 kịch bản đăng Facebook Reels cho video này.
        Link gốc: ${analysis.url}
        Phong cách: ${brandVoice} (Vui vẻ, gần gũi).

        Yêu cầu Output JSON thuần túy (không Markdown, không code block):
        {
          "versionA": { "caption": "Viết caption ngắn < 3 dòng", "hashtags": ["#tag1", "#tag2"] },
          "versionB": { "caption": "Caption kích thích tò mò", "hashtags": ["#tag1", "#tag2"] },
          "versionC": { "caption": "Caption bán hàng khéo léo", "hashtags": ["#tag1", "#tag2"] }
        }
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();
      
      // Clean markdown block nếu có
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      
      return JSON.parse(text);

    } catch (error) {
      console.error("[Gemini] Generate Error:", error);
      
      // Fallback khi AI lỗi để không làm crash luồng chính
      return {
        versionA: { caption: "Video siêu hot hôm nay! Mời cả nhà xem nhé ❤️", hashtags: ["#viral", "#trending"] },
        versionB: { caption: "Không xem phí cả đời! 👇👇👇", hashtags: ["#reels", "#xuhuong"] },
        versionC: { caption: "Sản phẩm hot nhất tại Shop Huy Vân 🔥", hashtags: ["#shophuyvan"] }
      };
    }
  }
}