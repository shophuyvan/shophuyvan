import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiContentGenerator {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY");
    }
    
    console.log("[Gemini] Initializing with API key length:", apiKey?.length);
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    // Cập nhật model name chuẩn
    const modelName = "models/gemini-2.5-flash";
    console.log("[Gemini] Using model:", modelName);
    this.model = this.genAI.getGenerativeModel({ model: modelName });
  }

  /**
   * Test connection với Gemini API
   * @returns {Promise<string>} Message từ Gemini
   */
  async testConnection() {
    try {
      const result = await this.model.generateContent("Reply 'OK' if you can read this message.");
      const response = await result.response;
      const text = response.text();
      return text;
    } catch (error) {
      console.error("[Gemini] Test connection error:", error);
      throw new Error(`Gemini API test failed: ${error.message}`);
    }
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
   * Tạo 5 phiên bản nội dung Facebook KHÁC NHAU (Anti-spam)
   * Dành cho ngành Gia Dụng & Nhà cửa
   */
  async generateFacebookContent(analysis, brandVoice = "friendly", productInfo = null) {
    try {
      // Build product context nếu có
      let productContext = '';
      if (productInfo) {
        productContext = `
THÔNG TIN SẢN PHẨM:
- Tên: ${productInfo.name || 'N/A'}
- Mô tả: ${productInfo.description || 'N/A'}
- Giá: ${productInfo.price ? new Intl.NumberFormat('vi-VN', {style: 'currency', currency: 'VND'}).format(productInfo.price) : 'N/A'}
- Link: ${productInfo.url || 'https://shophuyvan.vn'}
`;
      }

     const prompt = `
Bạn là Chuyên gia Content Marketing của Shop Huy Vân.
Nhiệm vụ: Viết 5 mẫu quảng cáo Facebook Ads cho sản phẩm dưới đây.

${productContext}

YÊU CẦU QUAN TRỌNG VỀ FORMAT JSON:
1. Output phải là **RAW JSON** hợp lệ.
2. **TUYỆT ĐỐI KHÔNG** dùng ký tự xuống dòng (Enter) trực tiếp trong chuỗi giá trị.
3. Mọi ký tự xuống dòng trong nội dung bài viết PHẢI được viết là \\n (ký tự escape).
4. Không thêm markdown block \`\`\`json.

CẤU TRÚC BÀI VIẾT (Áp dụng cho cả 5 version):
- Dòng 1: Tiêu đề thu hút (Viết hoa chữ cái đầu).
- Thân bài: Chia đoạn rõ ràng bằng \\n\\n. Dùng icon (✅, 🔥, 👉) hợp lý.
- Cuối bài: Hashtag #ShopHuyVan #ShopHuyVanVN + Link mua hàng.

YÊU CẦU 5 TONE GIỌNG:
1. Version 1 (Thân thiện): Như lời khuyên từ bạn bè.
2. Version 2 (Sale Sốc): Nhấn mạnh giảm giá, khan hiếm.
3. Version 3 (Storytelling): Kể chuyện trải nghiệm khách hàng.
4. Version 4 (Chuyên gia): Phân tích kỹ thuật, độ bền.
5. Version 5 (Mẹo vặt): Chia sẻ tips sử dụng.

OUTPUT JSON FORMAT:
{
  "version1": {
    "tone": "friendly",
    "caption": "Tiêu đề...\\n\\nNội dung...\\n\\n👉 Link: ...",
    "hashtags": ["#Tag1"],
    "cta": "Mua ngay"
  },
  "version2": { "tone": "sale", "caption": "...", "hashtags": [], "cta": "..." },
  "version3": { "tone": "story", "caption": "...", "hashtags": [], "cta": "..." },
  "version4": { "tone": "expert", "caption": "...", "hashtags": [], "cta": "..." },
  "version5": { "tone": "tips", "caption": "...", "hashtags": [], "cta": "..." }
}
`;

      console.log("[Gemini] Sending prompt, length:", prompt.length);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();
      console.log("[Gemini] Received response, length:", text.length);
      
      // 1. Clean Markdown blocks
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      
      // 2. Sanitize: Loại bỏ các ký tự điều khiển rác (Bad control characters)
      // Giữ lại \n, \r, \t, còn lại (0x00-0x1F) xóa hết để tránh lỗi parse
      text = text.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, "");

      try {
        const parsed = JSON.parse(text);
        
        // Kiểm tra sơ bộ cấu trúc
        if (!parsed.version1 || !parsed.version1.caption) {
           throw new Error("JSON thiếu trường version1 hoặc caption");
        }
        
        return parsed;

      } catch (parseError) {
        console.error("[Gemini] JSON Parse Failed. Raw Text:", text);
        throw new Error(`Lỗi đọc dữ liệu từ AI (Invalid JSON): ${parseError.message}`);
      }

    } catch (error) {
      console.error("[Gemini] Generate Error:", error);
      // 🔥 CRITICAL CHANGE: Không dùng Fallback. Throw error để Worker xử lý.
      throw new Error(`Gemini API Error: ${error.message}`);
    }
  }
}