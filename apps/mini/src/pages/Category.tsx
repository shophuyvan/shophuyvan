import React, { useEffect, useState } from 'react';
import { Page, useNavigate } from 'zmp-ui';
import Header from '../components/Header'; // Sử dụng Header chung của App
import ProductCard from '../components/ProductCard';
import { api } from '@shared/api';

const LABELS: Record<string, string> = {
  'dien-nuoc': 'Thiết Bị Điện & Nước',
  'nha-cua-doi-song': 'Nhà Cửa Đời Sống',
  'hoa-chat-gia-dung': 'Hoá Chất Gia Dụng',
  'dung-cu-thiet-bi-tien-ich': 'Dụng Cụ & Thiết Bị Tiện Ích',
};

// Hook: Lấy params từ URL (hỗ trợ cả Search Core 'q', Category 'c', Price Max)
function useQueryParams() {
  // [FIX] Thêm price_max vào state
  const [params, setParams] = useState({ c: '', q: '', price_max: '' });

  useEffect(() => {
    const getParams = () => {
      try {
        const u = new URL(location.href);
        return {
          c: (u.searchParams.get('c') || u.searchParams.get('cat') || '').trim(),
          q: (u.searchParams.get('q') || u.searchParams.get('keyword') || '').trim(),
          price_max: (u.searchParams.get('price_max') || '').trim() // [FIX] Đọc tham số giá
        };
      } catch {
        // Fallback an toàn
        const s = location.search;
        const cMatch = s?.match(/[?&](c|cat)=([^&]+)/);
        const qMatch = s?.match(/[?&](q|keyword)=([^&]+)/);
        const pMatch = s?.match(/[?&]price_max=([^&]+)/); // [FIX] Regex giá
        return {
          c: cMatch ? decodeURIComponent(cMatch[2]) : '',
          q: qMatch ? decodeURIComponent(qMatch[2]) : '',
          price_max: pMatch ? decodeURIComponent(pMatch[1]) : ''
        };
      }
    };

    setParams(getParams());

    // Lắng nghe sự thay đổi URL (khi search từ Header)
    const handlePopState = () => setParams(getParams());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return params;
}

       export default function Category() {
         // [FIX] Lấy thêm tham số price_max
        const { c: categorySlug, q: searchKeyword, price_max } = useQueryParams();
        
        // [PAGING] State phân trang
        const [page, setPage] = useState(1);
        const LIMIT = 20; 
        
        const [items, setItems] = useState<any[]>([]);
        const [loading, setLoading] = useState(true);
        
        // [PAGING] Reset về trang 1 khi thay đổi bộ lọc (Category, Search, Price)
        useEffect(() => {
          setPage(1);
        }, [categorySlug, searchKeyword, price_max]);
         const [error, setError] = useState<string | null>(null);
       
         // LOGIC SEARCH CORE: Gọi API với tham số chuẩn
         useEffect(() => {
           let isMounted = true;
       
           const fetchData = async () => {
        setLoading(true);
        setError(null);
        // Không xóa items ngay để tránh nháy trang quá nhiều khi chuyển trang
        if (page === 1) setItems([]); 
  
        try {
          // [PAGING] Scroll lên đầu khi đổi trang
          if (page > 1) window.scrollTo({ top: 0, behavior: 'smooth' });

          const params = { limit: LIMIT, page };
          let res: any = [];

          // Ưu tiên 1: Search Core (nếu có từ khóa q)
          if (searchKeyword) {
            res = await api.products.list({ ...params, q: searchKeyword });
          } 
          // Ưu tiên 2: Filter theo Price Max
          else if (price_max) {
             res = await api.products.list({ 
               ...params, 
               price_max: Number(price_max) 
             });
          }
          // Ưu tiên 3: Filter theo Category Slug
          else if (categorySlug) {
            res = await api.products.list({ 
              ...params, 
              category: categorySlug 
            });
          } 
          // Mặc định: Lấy tất cả
          else {
            res = await api.products.list(params);
          }

        if (isMounted) {
          const data = Array.isArray(res) ? res : (res?.data || res?.items || []);
          setItems(data);
        }
      } catch (e: any) {
        console.error('Category/Search Error:', e);
        if (isMounted) setError(e?.message || 'Không tải được sản phẩm');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => { isMounted = false; };
  }, [categorySlug, searchKeyword, price_max, page]);

  // Xử lý tiêu đề trang
  let title = 'Tất cả sản phẩm';
  if (searchKeyword) title = `Tìm kiếm: "${searchKeyword}"`;
  else if (price_max) title = `Săn Deal dưới ${Number(price_max).toLocaleString('vi-VN')}đ`; // [FIX] Tiêu đề giá rẻ
  else if (categorySlug) title = LABELS[categorySlug] || 'Danh mục sản phẩm';

  return (
    <Page className="bg-gray-100 min-h-screen">
      <Header forceShow showBack variant="mini" />
      
      <main className="max-w-4xl mx-auto p-3">
        {/* Breadcrumb / Title Info */}
        <div className="mb-4">
          <h1 className="text-lg font-bold text-gray-800 truncate">{title}</h1>
          {searchKeyword && items.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Tìm thấy {items.length} kết quả phù hợp
            </p>
          )}
        </div>

        {/* Loading State */}
        {loading && (
           <div className="grid grid-cols-2 gap-3 animate-pulse">
             {[1,2,3,4,5,6].map(i => (
               <div key={i} className="bg-white h-64 rounded-xl"></div>
             ))}
           </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="text-center py-10 bg-white rounded-xl">
             <p className="text-red-500">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm">Không tìm thấy sản phẩm nào phù hợp.</p>
            {searchKeyword && (
               <p className="text-xs mt-1">Hãy thử tìm với từ khóa khác (VD: đèn, ổ cắm...)</p>
            )}
          </div>
        )}

        {/* Product List & Pagination */}
        {!loading && !error && items.length > 0 && (
          <div className="pb-24">
            <div className="grid grid-cols-2 gap-3 mb-6">
              {items.map((p) => (
                <ProductCard key={p.id || Math.random()} p={p} />
              ))}
            </div>

            {/* [PAGING] Controls */}
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
                disabled={items.length < LIMIT}
                onClick={() => setPage((p) => p + 1)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  items.length < LIMIT
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-50 text-blue-600 active:scale-95 hover:bg-blue-100'
                }`}
              >
                Sau &gt;
              </button>
            </div>
          </div>
        )}
      </main>
    </Page>
  );
}