import React, { useEffect, useState } from 'react';
import { Page, useNavigate, useLocation } from 'zmp-ui';
import Header from '../components/Header';
import ProductCard from '../components/ProductCard';
import { api } from '@shared/api';

const LABELS: Record<string, string> = {
  'dien-nuoc': 'Thiết Bị Điện & Nước',
  'nha-cua-doi-song': 'Nhà Cửa Đời Sống',
  'hoa-chat-gia-dung': 'Hoá Chất Gia Dụng',
  'dung-cu-thiet-bi-tien-ich': 'Dụng Cụ & Thiết Bị Tiện Ích',
};

export default function Category() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Parse URL params
  const searchParams = new URLSearchParams(location.search);
  const categorySlug = (searchParams.get('c') || searchParams.get('cat') || '').trim();
  const searchKeyword = (searchParams.get('q') || searchParams.get('keyword') || '').trim();
  const price_max = (searchParams.get('price_max') || '').trim();
        
  // State phân trang
  const [page, setPage] = useState(1);
  const LIMIT = 20; 
  
  const [allItems, setAllItems] = useState<any[]>([]); 
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Reset trang khi đổi bộ lọc
  useEffect(() => {
    setPage(1);
    setAllItems([]);
    setItems([]);
  }, [categorySlug, searchKeyword, price_max]);
       
  // LOGIC TẢI DỮ LIỆU
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        let res: any = [];

        // 1. Nếu lọc theo Giá Rẻ -> Gọi API chuyên biệt
        if (price_max) {
           console.log('🔍 Mode: Săn deal giá rẻ dưới', price_max);
           res = await api.products.cheap(100, Number(price_max));
        } 
        // 2. Nếu Tìm kiếm hoặc Danh mục -> Gọi API List
        else {
           console.log('🔍 Mode: Tìm kiếm / Danh mục', { categorySlug, searchKeyword });
           const params = { 
             limit: 100,
             q: searchKeyword, 
             category: categorySlug
           };
           res = await api.products.list(params);
        }

        if (isMounted) {
          let data = Array.isArray(res) ? res : (res?.data || res?.items || []);
          
          // --- BỘ LỌC CLIENT (FIXED) ---

          // [FIX] Lọc Giá: Xử lý đúng cấu trúc Object {base, original} do normalizeProduct tạo ra
          if (price_max) {
             const maxPrice = Number(price_max);
             data = data.filter((p: any) => {
               let finalPrice = 0;

               // Trường hợp 1: p.price là object { base: 15000, ... }
               if (typeof p.price === 'object' && p.price?.base) {
                 finalPrice = p.price.base;
               } 
               // Trường hợp 2: p.price là số
               else if (typeof p.price === 'number') {
                 finalPrice = p.price;
               }

               // Ưu tiên giá sale nếu có (và nhỏ hơn giá gốc)
               if (p.price_sale && typeof p.price_sale === 'number' && p.price_sale > 0) {
                 finalPrice = p.price_sale;
               }

               return finalPrice > 0 && finalPrice <= maxPrice;
             });
          }

          // [FIX] Lọc Danh Mục: BỎ BỘ LỌC CLIENT
          // Lý do: Server đã lọc rồi (?category=...), lọc lại ở đây dễ bị sai do thiếu field category_slug trong object trả về.
          if (categorySlug && data.length > 0) {
             console.log(`✅ Server đã lọc theo danh mục: ${categorySlug}`);
          }

          console.log(`📦 [DEBUG] Kết quả cuối cùng: ${data.length} sản phẩm`);
          setAllItems(data);
        }
      } catch (e: any) {
        console.error('Category Load Error:', e);
        if (isMounted) setError(e?.message || 'Không tải được sản phẩm');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [categorySlug, searchKeyword, price_max]);

  // Cắt trang hiển thị
  useEffect(() => {
    if (page > 1) {
       // Scroll nhẹ lên đầu khi chuyển trang
       const el = document.getElementById('page-top');
       if (el) el.scrollIntoView({ behavior: 'smooth' });
    }

    const startIndex = (page - 1) * LIMIT;
    const endIndex = startIndex + LIMIT;
    
    if (allItems.length >= 0) {
      const pageItems = allItems.slice(startIndex, endIndex);
      setItems(pageItems);
    }
  }, [page, allItems]);

  // Tiêu đề
  let title = 'Tất cả sản phẩm';
  if (searchKeyword) title = `Tìm kiếm: "${searchKeyword}"`;
  else if (price_max) title = `Săn Deal dưới ${Number(price_max).toLocaleString('vi-VN')}đ`;
  else if (categorySlug) title = LABELS[categorySlug] || 'Danh mục sản phẩm';

  return (
    <Page className="bg-gray-100 min-h-screen">
      <div id="page-top"></div>
      <Header forceShow showBack variant="mini" />
      
      <main className="max-w-4xl mx-auto p-3">
        <div className="mb-4">
          <h1 className="text-lg font-bold text-gray-800 truncate">{title}</h1>
          {!loading && (
            <p className="text-xs text-gray-500 mt-1">
              Tìm thấy {allItems.length} kết quả phù hợp
            </p>
          )}
        </div>

        {loading && (
           <div className="grid grid-cols-2 gap-3 animate-pulse">
             {[1,2,3,4,5,6].map(i => (
               <div key={i} className="bg-white h-64 rounded-xl"></div>
             ))}
           </div>
        )}

        {!loading && error && (
          <div className="text-center py-10 bg-white rounded-xl">
             <p className="text-red-500">{error}</p>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm">Không tìm thấy sản phẩm nào phù hợp.</p>
            {price_max && (
               <p className="text-xs mt-1 text-amber-600">Thử tăng mức giá tìm kiếm lên xem sao?</p>
            )}
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="pb-24">
            <div className="grid grid-cols-2 gap-3 mb-6">
              {items.map((p) => (
                <ProductCard key={p.id || Math.random()} p={p} />
              ))}
            </div>

            {allItems.length > LIMIT && (
              <div className="flex justify-center items-center gap-4 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    page === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-50 text-blue-600 active:scale-95 hover:bg-blue-100'
                  }`}
                >
                  &lt; Trước
                </button>
                
                <span className="text-gray-700 font-bold min-w-[60px] text-center">
                  Trang {page}
                </span>
                
                <button
                  disabled={page * LIMIT >= allItems.length}
                  onClick={() => setPage((p) => p + 1)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    page * LIMIT >= allItems.length
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-50 text-blue-600 active:scale-95 hover:bg-blue-100'
                  }`}
                >
                  Sau &gt;
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </Page>
  );
}