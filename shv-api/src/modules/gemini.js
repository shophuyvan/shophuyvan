// shv-api/src/modules/gemini.js (v6.2)
export async function handleAI(req, env) {
  let body={}; try{ body=await req.json(); }catch{}
  const { mode, title="", description="" } = body;
  const t=String(title||"").trim(); const d=String(description||"").trim();
  function forceRange100_120(s, kw=""){ let x=(s||"").replace(/\s+/g," ").trim(); if(x.length>120) return x.slice(0,120).replace(/\s+\S*$/,"").trim(); if(x.length<100){ const pad=[kw,"giá tốt","giao nhanh","chính hãng","bảo hành","ưu đãi"].filter(Boolean); let i=0; while(x.length<100 && i<pad.length*3){ x += " " + pad[i%pad.length]; i++; x=x.trim(); } x=x.slice(0,120);} return x; }
  if(mode==="title"){ return new Response(JSON.stringify({ suggestions:[ (t||d.slice(0,60)||'Sản phẩm').slice(0,120) ]}), {headers:{'content-type':'application/json'}}); }
  if(mode==="desc"){ return new Response(JSON.stringify({ text: d||t }), {headers:{'content-type':'application/json'}}); }
  if(mode==="seo"){ return new Response(JSON.stringify({ seo_title: forceRange100_120(t||'Sản phẩm nổi bật', t), seo_description: d||`${t} chất lượng, giao nhanh.`, seo_keywords: [t,'giá rẻ','khuyến mãi'].filter(Boolean).join(', ') }), {headers:{'content-type':'application/json'}}); }
  if(mode==="faq"){ return new Response(JSON.stringify({ items:[ {q:'Thời gian giao hàng?',a:'Nội thành 1–2 ngày, tỉnh 2–5 ngày.'}, {q:'Đổi trả thế nào?',a:'Đổi trả trong 7 ngày nếu lỗi NSX.'}, {q:'Bảo hành?',a:'Theo chính sách của shop/NSX.'}, {q:'Hướng dẫn sử dụng?',a:'Kèm HDSD trong hộp.'} ] }), {headers:{'content-type':'application/json'}}); }
  if(mode==="reviews"){ return new Response(JSON.stringify({ items:[ {name:'Ngọc',rating:5,content:'Hài lòng, giao nhanh.',avatar:''}, {name:'Minh',rating:5,content:'Chất lượng tốt so với giá.',avatar:''}, {name:'Trang',rating:4,content:'Đóng gói chắc chắn, sẽ ủng hộ tiếp.',avatar:''} ] }), {headers:{'content-type':'application/json'}}); }
  if(mode==="alt"){ return new Response(JSON.stringify({ items:[ t||'Ảnh sản phẩm' ] }), {headers:{'content-type':'application/json'}}); }
  return new Response(JSON.stringify({}), {headers:{'content-type':'application/json'}});
}
