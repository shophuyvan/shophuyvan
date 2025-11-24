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
Bạn là Content Marketing Expert chuyên về ngành Gia Dụng & Nhà cửa tại Việt Nam.

NHIỆM VỤ: Tạo 5 bài đăng Facebook HOÀN TOÀN KHÁC NHAU về sản phẩm/video này.

${productContext}

VIDEO TIKTOK: ${analysis.url}

YÊU CẦU QUAN TRỌNG:
1. Mỗi version phải có TONE KHÁC BIỆT:
   - Version 1 (casual): Gần gũi, thân thiện, emoji nhiều, nói chuyện như bạn bè
   - Version 2 (sale-heavy): Sale mạnh, urgency, CAPS, giảm giá, số lượng có hạn
   - Version 3 (storytelling): Kể chuyện khách hàng, review thực tế, cảm xúc
   - Version 4 (professional): Chuyên gia tư vấn, formal, focus tính năng kỹ thuật
   - Version 5 (tips): Mẹo vặt, hướng dẫn sử dụng, chia sẻ kinh nghiệm

2. KHÔNG TRÙNG LẶP:
   - Từ ngữ khác nhau hoàn toàn
   - Hashtags khác nhau 100%
   - Độ dài khác nhau (ngắn/vừa/dài)
   - CTA khác nhau

3. ĐỐI TƯỢNG: Việt Nam, 25-45 tuổi, quan tâm nấu ăn & chăm sóc nhà cửa

OUTPUT JSON THUẦN TÚY (không markdown, không code block):
{
  "version1": {
    "tone": "casual",
    "caption": "Caption ngắn gọn, emoji nhiều, dễ thương",
    "hashtags": ["#GiaDung", "#NhaBep"],
    "cta": "Xem ngay tại ShopHuyVan.vn"
  },
  "version2": {
    "tone": "sale-heavy",
    "caption": "Caption kích thích mua ngay, urgency",
    "hashtags": ["#FlashSale", "#GiamGia"],
    "cta": "Đặt ngay kẻo hết!"
  },
  "version3": {
    "tone": "storytelling",
    "caption": "Kể chuyện khách hàng thực tế",
    "hashtags": ["#Review", "#ChiaSeThucTe"],
    "cta": "Xem thêm feedback"
  },
  "version4": {
    "tone": "professional",
    "caption": "Phân tích tính năng chuyên sâu",
    "hashtags": ["#ChuyenGia", "#TuVan"],
    "cta": "Tư vấn miễn phí"
  },
  "version5": {
    "tone": "tips",
    "caption": "Mẹo vặt, hướng dẫn sử dụng",
    "hashtags": ["#MeoVat", "#HuongDan"],
    "cta": "Học thêm tips"
  }
}
`;

      console.log("[Gemini] Sending prompt, length:", prompt.length);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();
      console.log("[Gemini] Received response, length:", text.length);
      
      // Clean markdown block nếu có
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      
      return JSON.parse(text);

    } catch (error) {
      console.error("[Gemini] Generate Error:", error);
      console.error("[Gemini] Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // Fallback khi AI lỗi - 5 versions mặc định
      return {
        version1: { 
          tone: "casual",
          caption: "Sản phẩm này xịn lắm luôn! 😍 Dùng rồi mê mệt, cả nhà nên thử nha ❤️", 
          hashtags: ["#GiaDung", "#ShopHuyVan"],
          cta: "Mua ngay tại ShopHuyVan.vn"
        },
        version2: { 
          tone: "sale-heavy",
          caption: "🔥 FLASH SALE 24H - GIẢM SỐC 30%! Chỉ còn 15 cái → Đặt ngay kẻo hết! ⚡", 
          hashtags: ["#FlashSale", "#Deal"],
          cta: "ORDER NGAY!"
        },
        version3: { 
          tone: "storytelling",
          caption: "Chị Hương (Q7) chia sẻ: 'Mua về dùng thấy tiện lắm, tiết kiệm được thời gian nấu ăn 🤗'", 
          hashtags: ["#Review", "#KhachHangThucTe"],
          cta: "Xem thêm review"
        },
        version4: { 
          tone: "professional",
          caption: "Công nghệ hiện đại, tiết kiệm điện năng lên đến 50%. Bảo hành 24 tháng chính hãng.", 
          hashtags: ["#ChuyenGia", "#CongNghe"],
          cta: "Tư vấn: 0909..."
        },
        version5: { 
          tone: "tips",
          caption: "Mẹo hay: Dùng sản phẩm này kết hợp với X sẽ cho hiệu quả gấp đôi đấy! 💡", 
          hashtags: ["#MeoVat", "#TipHay"],
          cta: "Học thêm tips"
        }
      };
    }
  }
  }