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
