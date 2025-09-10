export async function handleAI(req, env) {
  const body = await req.json();
  const { mode, title, description } = body;
  // TODO: call Gemini via env.GEMINI_API_KEY. For now, return mock suggestions.
  if (mode === 'title') {
    return new Response(JSON.stringify({ suggestions: [
      'Tiêu đề gợi ý 1', 'Tiêu đề gợi ý 2', 'Tiêu đề gợi ý 3', 'Tiêu đề gợi ý 4'
    ]}), { headers: { 'content-type':'application/json' }});
  }
  if (mode === 'seo') {
    return new Response(JSON.stringify({ seo_title: title || 'SEO Title', keywords: ['shop','phu kien'], meta_description: (description||'').slice(0,150) }), { headers: { 'content-type':'application/json' }});
  }
  if (mode === 'faq') {
    return new Response(JSON.stringify({ items: [
      { q: 'Sản phẩm có bảo hành không?', a: 'Có, theo chính sách của hãng.' },
      { q: 'Freeship thế nào?', a: 'Áp dụng theo quy định shop.' }
    ]}), { headers: { 'content-type':'application/json' }});
  }
  if (mode === 'reviews') {
    return new Response(JSON.stringify({ items: [
      { name: 'Ngọc', rating: 5, content: 'Sản phẩm tốt' },
      { name: 'Tú', rating: 5, content: 'Đóng gói chắc chắn' }
    ]}), { headers: { 'content-type':'application/json' }});
  }
  if (mode === 'alt') {
    return new Response(JSON.stringify({ items: ['Ảnh sản phẩm góc nghiêng', 'Chi tiết chất liệu', 'Phụ kiện kèm theo'] }), { headers: { 'content-type':'application/json' }});
  }
  return new Response(JSON.stringify({ suggestions: []}), { headers: { 'content-type':'application/json' }});
}

export async function handleAI(req, env) {
  let body={}; try{ body = await req.json(); }catch{}
  const { mode, title='', description='' } = body;
  const t=String(title||'').trim(); const d=String(description||'').trim();
  const apiKey=env.GEMINI_API_KEY; const model=env.GEMINI_MODEL||'gemini-1.5-flash';

  async function callGeminiJSON(apiKey, model, sys, up){
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(endpoint, { method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ contents:[{role:'user',parts:[{text:`${sys}\n\n${up}`}]}], generationConfig:{ temperature:0.6, maxOutputTokens:1024 } }) });
    if(!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p=>p.text).join(' ') || '';
    const cleaned = text.replace(/^```[a-zA-Z]*\n?|```$/g, '').trim();
    try { return JSON.parse(cleaned); } catch(e){ const m = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/); if(m) return JSON.parse(m[0]); return { text: cleaned }; }
  }

  async function safeCall(sys, up){ try{ return await callGeminiJSON(apiKey, model, sys, up); }catch(e){ return { error:String(e?.message||e) }; } }
  function fallbackTitle(){ const base = t || d.slice(0,60) || 'Sản phẩm'; return { suggestions:[ base.slice(0,120), `${base} – Giá Tốt, Giao Nhanh`.slice(0,120), `${base} Chính Hãng, Bảo Hành`.slice(0,120) ]}; }

  if(!apiKey) return new Response(JSON.stringify(fallbackTitle()), { headers:{'content-type':'application/json'} });

  if(mode==='title'){
    const out = await safeCall('Trả JSON { "suggestions": string[] }', `Tiêu đề: ${t}\nMô tả: ${d}\nViết 3–5 tiêu đề ngắn (≤120).`);
    const sug = Array.isArray(out?.suggestions)?out.suggestions:fallbackTitle().suggestions;
    return new Response(JSON.stringify({ suggestions: sug.slice(0,5) }), { headers:{'content-type':'application/json'} });
  }
  if(mode==='seo'){
    const out = await safeCall('Trả JSON { "seo_title","seo_description","seo_keywords" }', `Tạo SEO cho: ${t}\n${d}`);
    const res = { seo_title: out.seo_title || (t||'Sản phẩm nổi bật').slice(0,150), seo_description: out.seo_description || (d||`${t} chất lượng, giao nhanh.`), seo_keywords: out.seo_keywords || [t,'giá rẻ','khuyến mãi'].filter(Boolean).join(', ') };
    return new Response(JSON.stringify(res), { headers:{'content-type':'application/json'} });
  }
  if(mode==='faq'){
    const out = await safeCall('Trả JSON { "items": Array<{q,a}> } (4–5)', `Dựa trên: ${t}\n${d}`);
    const items = Array.isArray(out.items)&&out.items.length?out.items:[
      { q:'Thời gian giao hàng?', a:'Nội thành 1–2 ngày, tỉnh 2–5 ngày.' },
      { q:'Đổi trả?', a:'Trong 7 ngày nếu lỗi nhà sản xuất.' },
      { q:'Bảo hành?', a:'Theo chính sách của shop/NSX.' },
      { q:'HDSD?', a:'Đóng gói kèm hướng dẫn chi tiết.' },
    ];
    return new Response(JSON.stringify({ items }), { headers:{'content-type':'application/json'} });
  }
  if(mode==='reviews'){
    const out = await safeCall('Trả JSON { "items": Array<{name,rating,content,avatar}> } (5–8)', `Sản phẩm: ${t}\n${d}`);
    const items = Array.isArray(out.items)&&out.items.length?out.items:[
      { name:'Ngọc', rating:5, content:'Hài lòng, giao nhanh.', avatar:'' },
      { name:'Minh', rating:5, content:'Chất lượng tốt so với giá.', avatar:'' },
      { name:'Trang', rating:4, content:'Đóng gói chắc chắn.', avatar:'' },
    ];
    return new Response(JSON.stringify({ items }), { headers:{'content-type':'application/json'} });
  }
  if(mode==='alt'){
    const out = await safeCall('Trả JSON { "items": string[] }', `Tiêu đề: ${t}\nMô tả: ${d}`);
    const items = Array.isArray(out.items)&&out.items.length?out.items:[ (t||'Ảnh sản phẩm') ];
    return new Response(JSON.stringify({ items }), { headers:{'content-type':'application/json'} });
  }
  return new Response(JSON.stringify(fallbackTitle()), { headers:{'content-type':'application/json'} });
}
