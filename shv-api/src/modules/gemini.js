async function callGeminiJSON(apiKey, model, sysPrompt, userPrompt) {
  const endpoint = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: `${sysPrompt}\n\n${userPrompt}` }]}],
    generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
  };
  const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p=>p.text).join(' ') || '';
  // strip code fences
  const cleaned = text.replace(/^```[a-zA-Z]*\n?|```$/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // try to extract JSON substring
    const m = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]);
    // fallback as text
    return { text: cleaned };
  }
}

export async function handleAI(req, env) {
  let body = {};
  try { body = await req.json(); } catch {}
  const { mode, title = '', description = '' } = body;
  const t = String(title||'').trim();
  const d = String(description||'').trim();
  const apiKey = env.GEMINI_API_KEY;
  const model  = env.GEMINI_MODEL || 'gemini-1.5-flash';

  // If no API key, return simple mock (fallback)
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY missing' , suggestions: [ (t||d).slice(0,120) ] }), { headers: { 'content-type':'application/json' } });
  }

  if (mode === 'title') {
    const sys = 'Bạn là trợ lý viết tiêu đề bán hàng tiếng Việt. Trả JSON: { "suggestions": string[] }. Mỗi đề xuất tối đa 120 ký tự.';
    const up  = `Tiêu đề gốc: ${t}\nMô tả: ${d}\nViết 5 đề xuất tiêu đề hấp dẫn (≤120 ký tự), tránh trùng lặp, không spam từ khóa.`;
    const out = await callGeminiJSON(apiKey, model, sys, up);
    return new Response(JSON.stringify({ suggestions: (out.suggestions||[]).slice(0,5) }), { headers: { 'content-type':'application/json' } });
  }

  if (mode === 'seo') {
    const sys = 'Bạn là chuyên gia SEO. Trả JSON: { "seo_title": string, "seo_description": string, "seo_keywords": string }.';
    const up  = `Tiêu đề: ${t}\nMô tả: ${d}\nTạo SEO title (≤150), meta description (ngắn gọn), và keywords (phẩy , cách).`;
    const out = await callGeminiJSON(apiKey, model, sys, up);
    return new Response(JSON.stringify(out), { headers: { 'content-type':'application/json' } });
  }

  if (mode === 'faq') {
    const sys = 'Viết FAQ tiếng Việt. Trả JSON: { "items": Array<{ "q": string, "a": string }> } với 4-5 cặp Q/A.';
    const up  = `Dựa trên: ${t}\n${d}\nTạo FAQ 4-5 câu hỏi phổ biến và trả lời rõ ràng.`;
    const out = await callGeminiJSON(apiKey, model, sys, up);
    return new Response(JSON.stringify({ items: out.items||[] }), { headers: { 'content-type':'application/json' } });
  }

  if (mode === 'reviews') {
    const sys = 'Tạo 5-10 đánh giá tiếng Việt chân thực. Trả JSON: { "items": Array<{ "name": string, "rating": number, "content": string, "avatar": string }> } . Avatar có thể là chuỗi rỗng.';
    const up  = `Sản phẩm: ${t}.\nMô tả: ${d}.\nSinh 6-8 review với tên người Việt, rating 4-5 sao, nội dung 1-2 câu.`;
    const out = await callGeminiJSON(apiKey, model, sys, up);
    return new Response(JSON.stringify({ items: out.items||[] }), { headers: { 'content-type':'application/json' } });
  }

  if (mode === 'alt') {
    const sys = 'Sinh ALT ảnh ngắn tiếng Việt. Trả JSON: { "items": string[] }';
    const up  = `Tiêu đề: ${t}. Mô tả: ${d}. Hãy tạo 5 ALT ảnh ≤ 10 từ, không ký tự đặc biệt.`;
    const out = await callGeminiJSON(apiKey, model, sys, up);
    return new Response(JSON.stringify({ items: out.items||[] }), { headers: { 'content-type':'application/json' } });
  }

  // default
  const out = await callGeminiJSON(apiKey, model, 'Trả JSON { "text": string }', (t||d||'OK'));
  return new Response(JSON.stringify(out), { headers: { 'content-type':'application/json' } });
}
