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
Bạn là Chuyên gia Content Marketing cấp cao của Shop Huy Vân - Chuyên Gia Dụng & Nhà Cửa thông minh.

NHIỆM VỤ: Viết 5 bài quảng cáo Facebook Ads CHUYÊN NGHIỆP, TRÌNH BÀY ĐẸP cho sản phẩm dưới đây.

${productContext}

YÊU CẦU BẮT BUỘC VỀ TRÌNH BÀY (FORMAT):
1. **TIÊU ĐỀ**: Chỉ viết hoa dòng đầu tiên (Headline) để thu hút. KHÔNG viết hoa toàn bộ bài viết.
2. **CẤU TRÚC**: Phải chia đoạn rõ ràng. Giữa các ý phải có dòng trống (\n\n).
3. **LỢI ÍCH**: Sử dụng gạch đầu dòng (✅, 🔸, 🔹, ⭐) để liệt kê 3-4 tính năng nổi bật nhất. Mỗi tính năng 1 dòng.
4. **GIÁ & ƯU ĐÃI**: Ghi rõ giá và ưu đãi ở riêng một khu vực nổi bật.
5. **HASHTAG**: BẮT BUỘC PHẢI CÓ bộ hashtag thương hiệu: #ShopHuyVan #ShopHuyVanVN bên cạnh các hashtag về sản phẩm.
6. **LINK**: Link mua hàng phải để riêng ở dòng cuối cùng (sau hashtag), có icon mũi tên (👉).

YÊU CẦU VỀ 5 TONE GIỌNG KHÁC BIỆT:
1. Version 1 (Thân thiện): Giọng thủ thỉ, tâm tình, như người bạn khuyên dùng cho gia đình.
2. Version 2 (Sale Sốc/Khan Hiếm): Nhấn mạnh giảm giá, chỉ còn ít hàng, giật tít mạnh (Flash Sale).
3. Version 3 (Storytelling/Kể chuyện): "Hôm qua chị Lan hàng xóm sang chơi...", kể trải nghiệm thực tế.
4. Version 4 (Chuyên gia/Review): Phân tích kỹ thuật, độ bền, chất liệu, so sánh sự vượt trội.
5. Version 5 (Mẹo vặt/Góc Bếp): Chia sẻ mẹo hay cuộc sống liên quan đến sản phẩm này.

LƯU Ý QUAN TRỌNG:
- KHÔNG dùng quá nhiều icon gây rối mắt.
- KHÔNG viết dính chùm một cục.
- Link mua hàng lấy từ thông tin sản phẩm: ${productInfo.url || 'https://shophuyvan.vn'}

OUTPUT JSON FORMAT (Raw JSON, no markdown):
{
  "version1": {
    "tone": "friendly",
    "caption": "TIÊU ĐỀ HẤP DẪN\n\nLời dẫn dắt thân thiện...\n\n✅ Lợi ích 1\n✅ Lợi ích 2\n✅ Lợi ích 3\n\n💰 Giá siêu yêu: ...\n\n#ShopHuyVan #ShopHuyVanVN #GiaDung\n\n👉 Mua ngay tại đây: ${productInfo.url || '...'}",
    "hashtags": ["#ShopHuyVan", "#ShopHuyVanVN", "#GiaDung"],
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