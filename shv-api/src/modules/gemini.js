export async function handleAI(req, env) {
  let body = {};
  try { body = await req.json(); } catch {}
  const { mode, title = '', description = '' } = body;
  const t = String(title||'').trim();
  const d = String(description||'').trim();

  function dedupe(arr){ return Array.from(new Set(arr.filter(Boolean))); }

  if (mode === 'title') {
    const base = t || (d.slice(0,60));
    const suggestions = dedupe([
      base,
      `${base} – Giá Tốt, Giao Nhanh`,
      `${base} Chính Hãng, Bảo Hành`,
      `Mua ${base} Giá Rẻ Hôm Nay`,
      `${base} – Deal Sốc`,
    ]).map(s => s.slice(0,120));
    return new Response(JSON.stringify({ suggestions: suggestions.slice(0,5) }), { headers: { 'content-type':'application/json' } });
  }

  if (mode === 'seo') {
    const seo_title = (t || d.split('.')[0] || 'Sản phẩm nổi bật').slice(0,150);
    const seo_description = (d || (`${t} chất lượng, giao nhanh, đổi trả dễ dàng.`)).slice(0,300);
    const keywords = dedupe([
      t, t.split(' ').slice(0,3).join(' '), 'giá rẻ', 'chính hãng', 'khuyến mãi', 'mua ngay'
    ]).filter(Boolean).join(', ');
    return new Response(JSON.stringify({ seo_title, seo_description, seo_keywords: keywords }), { headers: { 'content-type':'application/json' } });
  }

  if (mode === 'faq') {
    const set = [
      { q: `Sản phẩm ${t||'này'} có bảo hành không?`, a: 'Có, theo chính sách của shop và nhà sản xuất.' },
      { q: 'Thời gian giao hàng bao lâu?', a: 'Nội thành 1–2 ngày, tỉnh 2–5 ngày tuỳ địa chỉ.' },
      { q: 'Đổi trả thế nào?', a: 'Hỗ trợ đổi trả trong 7 ngày nếu lỗi nhà sản xuất.' },
      { q: 'Có hướng dẫn sử dụng không?', a: 'Đóng gói kèm HDSD. Vui lòng đọc kỹ trước khi dùng.' },
      { q: 'Phù hợp với đối tượng nào?', a: 'Phù hợp đa số người dùng; xem thêm mô tả để lựa chọn đúng.' }
    ];
    return new Response(JSON.stringify({ items: set }), { headers: { 'content-type':'application/json' } });
  }

  if (mode === 'reviews') {
    const names = ['Ngọc','Tú','Anh','Huyền','Lan','Minh','Hải','Phúc','Dũng','Trang','Quân','Vy','Hạnh','Thảo','Dương'];
    const items = names.slice(0,8).map((n,i)=>({ name:n, rating:5-(i%2==0?0:1), content:'Đóng gói chắc chắn, chất lượng tốt.', avatar:`data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='100%' height='100%' fill='#e5e7eb'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='18' fill='#374151'>${n[0]}</text></svg>`)}` }));
    return new Response(JSON.stringify({ items }), { headers: { 'content-type':'application/json' } });
  }

  if (mode === 'alt') {
    const base = t || 'Ảnh sản phẩm';
    const items = [1,2,3,4,5].map((i)=>`${base} góc ${i}`);
    return new Response(JSON.stringify({ items }), { headers: { 'content-type':'application/json' } });
  }

  // default passthrough for legacy prompt
  const text = (t || d || 'OK');
  return new Response(JSON.stringify({ text }), { headers: { 'content-type':'application/json' } });
}
