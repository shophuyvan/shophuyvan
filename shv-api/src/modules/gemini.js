// shv-api/src/modules/gemini.js (v6)
async function callGeminiJSON(apiKey, model, sysPrompt, userPrompt) {
  const endpoint = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
  const payload = { contents: [{ role: "user", parts: [{ text: `${sysPrompt}\n\n${userPrompt}` }]}], generationConfig: { temperature: 0.6, maxOutputTokens: 2048 } };
  const res = await fetch(endpoint, { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join(" ").trim() || "";
  const cleaned = text.replace(/^```[a-zA-Z]*\n?|```$/g, "").trim();
  try { return JSON.parse(cleaned); } catch { const m = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/); if (m) return JSON.parse(m[0]); return { text: cleaned }; }
}
function forceRange100_120(s, kw=""){ let t=(s||"").replace(/\s+/g," ").trim(); if (t.length>120) return t.slice(0,120).replace(/\s+\S*$/,"").trim(); if (t.length<100){ const pad=[kw,"giá tốt","giao nhanh","chính hãng","bảo hành","ưu đãi"].filter(Boolean); let i=0; while(t.length<100 && i<pad.length*3){ t += " " + pad[i%pad.length]; i++; t=t.trim(); } t=t.slice(0,120);} return t; }
export async function handleAI(req, env) {
  let body={}; try{ body=await req.json(); }catch{}
  const { mode, title="", description="" } = body;
  const t=String(title||"").trim(); const d=String(description||"").trim();
  const apiKey=env.GEMINI_API_KEY; const model=env.GEMINI_MODEL||"gemini-1.5-flash";
  async function safeCall(sys, up){ try{ return await callGeminiJSON(apiKey, model, sys, up); } catch(e){ return { error:String(e?.message||e) }; } }
  function fallbackTitle(){ const base=t||d.slice(0,60)||"Sản phẩm"; return { suggestions:[ base.slice(0,120), `${base} – Giá Tốt, Giao Nhanh`.slice(0,120), `${base} Chính Hãng, Bảo Hành`.slice(0,120) ]}; }
  if(!apiKey) return new Response(JSON.stringify(fallbackTitle()), { headers:{ "content-type":"application/json" } });
  if(mode==="title"){ const out=await safeCall('Trả JSON { "suggestions": string[] } (≤120).', `Tiêu đề: ${t}\nMô tả: ${d}\nViết 3–5 tiêu đề.`); const sug=Array.isArray(out?.suggestions)?out.suggestions:fallbackTitle().suggestions; return new Response(JSON.stringify({ suggestions:sug.slice(0,5) }), { headers:{ "content-type":"application/json" } }); }
  if(mode==="desc"){ const out=await safeCall('Viết mô tả chuẩn SEO, giữ nguyên/chuẩn hoá các thông tin kỹ thuật (kích thước, chất liệu, phân loại, thuộc tính, hướng dẫn). Trả JSON { "text": string }.', `Tiêu đề: ${t}\nMô tả hiện tại:\n${d}\nYêu cầu: văn phong gọn, dễ đọc; đưa thông số thành bullet; không bỏ sót thông tin.`); const text=out.text||out.description||d; return new Response(JSON.stringify({ text }), { headers:{ "content-type":"application/json" } }); }
  if(mode==="seo"){ const out=await safeCall('Trả JSON { "seo_title": string, "seo_description": string, "seo_keywords": string }. "seo_title" phải DÀI 100–120 ký tự.', `Tạo SEO cho: ${t}\n${d}`); const raw=out.seo_title||(t||"Sản phẩm nổi bật"); const seo_title=forceRange100_120(raw, t); const res={ seo_title, seo_description: out.seo_description || (d||`${t} chất lượng, giao nhanh.`), seo_keywords: out.seo_keywords || [t,"giá rẻ","khuyến mãi"].filter(Boolean).join(", ") }; return new Response(JSON.stringify(res), { headers:{ "content-type":"application/json" } }); }
  if(mode==="faq"){ const out=await safeCall('Viết 4–5 Q/A tiếng Việt. JSON { "items":[{"q":"...","a":"..."}] }', `Tiêu đề: ${t}\n${d}`); const items=Array.isArray(out.items)&&out.items.length?out.items:[ {q:"Thời gian giao hàng?",a:"Nội thành 1–2 ngày, tỉnh 2–5 ngày."}, {q:"Đổi trả thế nào?",a:"Đổi trả trong 7 ngày nếu lỗi NSX."}, {q:"Bảo hành?",a:"Theo chính sách của shop/NSX."}, {q:"Hướng dẫn sử dụng?",a:"Kèm HDSD trong hộp."} ]; return new Response(JSON.stringify({ items }), { headers:{ "content-type":"application/json" } }); }
  if(mode==="reviews"){ const out=await safeCall('Sinh 5–8 đánh giá tiếng Việt. JSON { "items":[{"name":"...","rating":1-5,"content":"...","avatar":""}] }', `Sản phẩm: ${t}\n${d}`); const items=Array.isArray(out.items)&&out.items.length?out.items:[ {name:"Ngọc",rating:5,content:"Hài lòng, giao nhanh.",avatar:""}, {name:"Minh",rating:5,content:"Chất lượng tốt so với giá.",avatar:""}, {name:"Trang",rating:4,content:"Đóng gói chắc chắn, sẽ ủng hộ tiếp.",avatar:""} ]; return new Response(JSON.stringify({ items }), { headers:{ "content-type":"application/json" } }); }
  if(mode==="alt"){ const out=await safeCall('Sinh ALT ảnh ngắn (≤10 từ). JSON { "items": string[] }', `Tiêu đề: ${t}\n${d}`); const items=Array.isArray(out.items)&&out.items.length?out.items:[ t || "Ảnh sản phẩm" ]; return new Response(JSON.stringify({ items }), { headers:{ "content-type":"application/json" } }); }
  return new Response(JSON.stringify(fallbackTitle()), { headers:{ "content-type":"application/json" } });
}
