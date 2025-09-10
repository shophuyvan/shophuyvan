// shv-api/src/modules/gemini.js
// Single export: handleAI. Safe wrapper + fallback results. No duplicate exports.

/**
 * Call Gemini JSON API and try to parse JSON even if model wraps in code fences.
 */
async function callGeminiJSON(apiKey, model, sysPrompt, userPrompt) {
  const endpoint = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${sysPrompt}\n\n${userPrompt}` }],
      },
    ],
    generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
  };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}`);
  }
  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join(" ")
      .trim() || "";
  const cleaned = text.replace(/^```[a-zA-Z]*\n?|```$/g, "").trim();
  // Try strict JSON parse first; fall back to extracting first JSON-like block
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) {
      return JSON.parse(m[0]);
    }
    return { text: cleaned };
  }
}

export async function handleAI(req, env) {
  let body = {};
  try {
    body = await req.json();
  } catch {}
  const { mode, title = "", description = "" } = body;
  const t = String(title || "").trim();
  const d = String(description || "").trim();
  const apiKey = env.GEMINI_API_KEY;
  const model = env.GEMINI_MODEL || "gemini-1.5-flash";

  async function safeCall(sys, up) {
    try {
      return await callGeminiJSON(apiKey, model, sys, up);
    } catch (e) {
      return { error: String(e?.message || e) };
    }
  }

  function fallbackTitle() {
    const base = t || d.slice(0, 60) || "Sản phẩm";
    return {
      suggestions: [
        base.slice(0, 120),
        `${base} – Giá Tốt, Giao Nhanh`.slice(0, 120),
        `${base} Chính Hãng, Bảo Hành`.slice(0, 120),
      ],
    };
  }

  // Nếu thiếu API key vẫn trả kết quả hợp lệ (không 500)
  if (!apiKey) {
    return new Response(JSON.stringify(fallbackTitle()), {
      headers: { "content-type": "application/json" },
    });
  }

  if (mode === "title") {
    const sys =
      'Bạn là trợ lý viết tiêu đề tiếng Việt. Trả JSON: { "suggestions": string[] } (≤120 ký tự mỗi mục).';
    const up = `Tiêu đề: ${t}\nMô tả: ${d}\nViết 3–5 tiêu đề ngắn gọn, không spam.`;
    const out = await safeCall(sys, up);
    const sug = Array.isArray(out?.suggestions)
      ? out.suggestions
      : fallbackTitle().suggestions;
    return new Response(JSON.stringify({ suggestions: sug.slice(0, 5) }), {
      headers: { "content-type": "application/json" },
    });
  }

  if (mode === "seo") {
    const sys =
      'Trả JSON: { "seo_title": string, "seo_description": string, "seo_keywords": string }.';
    const up = `Tạo SEO title ≤150, meta description ngắn, keywords (phẩy , cách) cho: ${t}\n${d}`;
    const out = await safeCall(sys, up);
    const res = {
      seo_title: out.seo_title || (t || "Sản phẩm nổi bật").slice(0, 150),
      seo_description:
        out.seo_description || d || `${t} chất lượng, giao nhanh.`,
      seo_keywords:
        out.seo_keywords ||
        [t, "giá rẻ", "khuyến mãi"].filter(Boolean).join(", "),
    };
    return new Response(JSON.stringify(res), {
      headers: { "content-type": "application/json" },
    });
  }

  if (mode === "faq") {
    const sys =
      'Viết FAQ tiếng Việt. JSON: { "items": Array<{ "q": string, "a": string }> } (4-5 mục).';
    const up = `Dựa trên ${t}\n${d}`;
    const out = await safeCall(sys, up);
    const items =
      Array.isArray(out.items) && out.items.length
        ? out.items
        : [
            {
              q: "Thời gian giao hàng?",
              a: "Nội thành 1–2 ngày, tỉnh 2–5 ngày.",
            },
            { q: "Đổi trả thế nào?", a: "Đổi trả trong 7 ngày nếu lỗi NSX." },
            { q: "Bảo hành?", a: "Theo chính sách của shop/NSX." },
            { q: "Hướng dẫn sử dụng?", a: "Kèm HDSD trong hộp." },
          ];
    return new Response(JSON.stringify({ items }), {
      headers: { "content-type": "application/json" },
    });
  }

  if (mode === "reviews") {
    const sys =
      'Sinh 5-8 review tiếng Việt. JSON: { "items": Array<{ "name": string, "rating": number, "content": string, "avatar": string }> }';
    const up = `Sản phẩm: ${t}\n${d}`;
    const out = await safeCall(sys, up);
    const items =
      Array.isArray(out.items) && out.items.length
        ? out.items
        : [
            { name: "Ngọc", rating: 5, content: "Hài lòng, giao nhanh.", avatar: "" },
            {
              name: "Minh",
              rating: 5,
              content: "Chất lượng tốt so với giá.",
              avatar: "",
            },
            {
              name: "Trang",
              rating: 4,
              content: "Đóng gói chắc chắn, sẽ ủng hộ tiếp.",
              avatar: "",
            },
          ];
    return new Response(JSON.stringify({ items }), {
      headers: { "content-type": "application/json" },
    });
  }

  if (mode === "alt") {
    const sys = 'Sinh ALT ảnh ngắn (≤10 từ). JSON: { "items": string[] }';
    const up = `Tiêu đề: ${t}\nMô tả: ${d}`;
    const out = await safeCall(sys, up);
    const items =
      Array.isArray(out.items) && out.items.length ? out.items : [t || "Ảnh sản phẩm"];
    return new Response(JSON.stringify({ items }), {
      headers: { "content-type": "application/json" },
    });
  }

  // default: trả fallback
  return new Response(JSON.stringify(fallbackTitle()), {
    headers: { "content-type": "application/json" },
  });
}
