import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';
import { api } from '@shared/api';

const LABELS: Record<string, string> = {
  'dien-nuoc': 'Thiết Bị Điện & Nước',
  'nha-cua-doi-song': 'Nhà Cửa Đời Sống',
  'hoa-chat-gia-dung': 'Hoá Chất Gia Dụng',
  'dung-cu-thiet-bi-tien-ich': 'Dụng Cụ & Thiết Bị Tiện Ích',
};

function useSlug() {
  const get = () => {
    try {
      const u = new URL(location.href);
      return (u.searchParams.get('c') || '').trim();
    } catch {
      const m = location.search?.match(/[?&]c=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : '';
    }
  };
  const [slug, setSlug] = useState(get());
  useEffect(() => {
    const fn = () => setSlug(get());
    window.addEventListener('popstate', fn);
    window.addEventListener('hashchange', fn);
    return () => { window.removeEventListener('popstate', fn); window.removeEventListener('hashchange', fn); };
  }, []);
  return slug;
}


function __toSlug(input: any): string{
  const s = String(input || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}
function __collectCatVals(obj: any): string[]{
  const vals:any[] = [];
  const push=(v:any)=>{ if(v!==undefined && v!==null && v!=='') vals.push(v); };
  const raw = (obj&&obj.raw)||{}; const meta = (obj&&obj.meta) || raw?.meta || {};
  [obj, raw, meta].forEach((o:any)=>{
    if(!o) return;
    push(o.category); push(o.category_slug); push(o.cate); push(o.categoryId);
    push(o.group); push(o.group_slug); push(o.type); push(o.collection);
  });
  if(Array.isArray(obj?.categories)) vals.push(...obj.categories);
  if(Array.isArray(raw?.categories)) vals.push(...raw.categories);
  if(Array.isArray(obj?.tags)) vals.push(...obj.tags);
  if(Array.isArray(raw?.tags)) vals.push(...raw.tags);
  return vals.flatMap((v:any)=>{
    if(Array.isArray(v)) return v.map((x:any)=> __toSlug(x?.slug||x?.code||x?.name||x?.title||x?.label||x?.text||x));
    if(typeof v === 'object') return [__toSlug(v?.slug||v?.code||v?.name||v?.title||v?.label||v?.text)];
    return [__toSlug(v)];
  }).filter(Boolean);
}
function __matchCategoryStrict(doc:any, categorySlug:string): boolean{
  if(!categorySlug) return true;
  const want = __toSlug(categorySlug);
  const alias: Record<string,string[]> = {
    'dien-nuoc': ['điện & nước','điện nước','dien nuoc','thiet bi dien nuoc'],
    'nha-cua-doi-song': ['nhà cửa đời sống','nha cua doi song','do gia dung'],
    'hoa-chat-gia-dung': ['hoá chất gia dụng','hoa chat gia dung','hoa chat'],
    'dung-cu-thiet-bi-tien-ich': ['dụng cụ thiết bị tiện ích','dung cu thiet bi tien ich','dung cu tien ich']
  };
  const wants = [want, ...((alias[want]||[]).map(__toSlug))];
  const cands = __collectCatVals(doc);
  return cands.some(v => wants.includes(v));
}



export default function Category() {
  const slug = useSlug();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const VIEW = 24;
        const FETCH_LIMIT = 200; // lấy nhiều hơn rồi lọc client để chắc chắn

        // 1) Lấy nhanh (chưa có giá) và lọc theo danh mục ở client (fallback)
        const first = await api.products.list({ limit: FETCH_LIMIT, category: slug || undefined });
        const filtered1 = (first || []).filter((p:any) => __matchCategoryStrict(p, slug)).slice(0, VIEW);
        setItems(filtered1);

        // 2) Lấy kèm giá và lọc lại
        const full = await api.products.listWithPrices({ limit: FETCH_LIMIT, category: slug || undefined, concurrency: 4 });
        const filtered2 = (full || []).filter((p:any) => __matchCategoryStrict(p, slug)).slice(0, VIEW);
        if (filtered2.length) setItems(filtered2);
      } catch (e:any) {
        console.error(e);
        setError(e?.message || 'Lỗi tải dữ liệu');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const title = LABELS[slug] || 'Danh mục';

  return (
    <div>
      <Header />
      <main className="max-w-4xl mx-auto p-3">
        <h1 className="text-xl font-bold mb-3">{title}</h1>
        {loading && <div>Đang tải…</div>}
        {!loading && error && <div className="text-red-600 text-sm">{error}</div>}
        {!loading && !error && (
          <div className="grid grid-cols-2 gap-3">
            {items.map((p) => <ProductCard key={String(p.id)} p={p as any} />)}
            {items.length === 0 && <div>Chưa có sản phẩm.</div>}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

    // R2 storage logic added for Cloudinary images
    const r2Url = (cloudinaryUrl) => {
        const cloudinaryDomain = "https://res.cloudinary.com/dtemskptf/image/upload/";
        return cloudinaryUrl.replace(cloudinaryDomain, "https://r2-cloud-storage.example.com/");
    };
    