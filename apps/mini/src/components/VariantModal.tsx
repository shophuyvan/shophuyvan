import React, { useMemo, useState } from 'react';
import { pickPrice, priceRange } from '@shared/utils/price';
import { fmtVND } from '@shared/utils/fmtVND';

function imagesOf(p:any){ const a:any[]=[]; if(Array.isArray(p?.images)) a.push(...p.images); if(p?.image) a.unshift(p.image); if(p?.thumb||p?.thumbnail) a.push(p.thumb||p.thumbnail); return a.filter(Boolean).map(String); }

export default function VariantModal({product, variants, open, onClose, onAdd, mode='cart'}: any){
  const [picked, setPicked] = useState<any>(()=>{
    // default: lowest-price variant
    let best = variants?.[0] || null;
    let bestVal = Number.MAX_SAFE_INTEGER;
    for(const v of (variants||[])){
      const b = pickPrice(product?.raw || product, v).base;
      if(b>0 && b<bestVal){ best=v; bestVal=b; }
    }
    return best;
  });
  const [qty, setQty] = useState(1);
  const price = useMemo(()=> picked ? pickPrice(product?.raw||product, picked) : null, [product, picked]);
  if(!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={()=>onClose?.()}>
      <div className="w-full max-w-md bg-white rounded-t-2xl p-3" onClick={(e)=>e.stopPropagation()}>
        <div className="flex gap-2">
          <img src={(imagesOf(picked)[0] || product.image)} className="w-16 h-16 object-contain rounded-lg border bg-gray-50"/>
          <div className="flex-1">
            <div className="font-semibold text-sm line-clamp-2">{product.name}</div>
            <div className="text-rose-600 font-bold">{price ? fmtVND(price.base) : '--'}</div>
          </div>
        </div>
        <div className="mt-3">
          <div className="font-medium mb-1 text-sm">Chọn phân loại</div>
          <div className="flex flex-wrap gap-2">
            {(variants||[]).map((v:any, i:number)=>{
              const act = picked===v;
              const img = imagesOf(v)[0];
              const p = pickPrice(product?.raw || product, v).base;
              return (
                <button key={i} onClick={()=>setPicked(v)} className={"px-3 py-2 rounded-xl border flex items-center gap-2 " + (act? "border-rose-500 text-rose-600 bg-rose-50":"")}>
                  {img ? <img src={img} className="w-6 h-6 object-contain rounded" /> : null}
                  <span className="text-sm">{v.name || v.sku || `Loại ${i+1}`}{p?` — ${fmtVND(p)}`:''}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="min-w-[72px] text-sm">Số lượng</span>
          <button className="w-8 h-8 rounded border" onClick={()=>setQty(q=>Math.max(1, q-1))}>−</button>
          <input type="number" min={1} value={qty} onChange={e=>setQty(Math.max(1, Number(e.target.value||1)))} className="w-14 rounded border px-1 py-1 text-center"/>
          <button className="w-8 h-8 rounded border" onClick={()=>setQty(q=>q+1)}>+</button>
          <div className="ml-auto flex gap-2">
            <button onClick={()=>{ const _img = (imagesOf(picked)[0] || (picked && (picked.image || (Array.isArray(picked.images)?picked.images[0]:undefined))) || product?.image); const _v:any = picked ? {...picked} : null; if(_v){ _v.name = _v.name || _v.sku || "Biến thể"; if(_img){ _v.image = _img; _v.images = _v.images || [_img]; } } onAdd?.(_v, qty, 'cart'); }} className="rounded-xl bg-rose-600 text-white font-extrabold px-3 py-2 text-sm">
              Thêm Vào Giỏ Hàng
            </button>
            <button onClick={()=>{ const _img = (imagesOf(picked)[0] || (picked && (picked.image || (Array.isArray(picked.images)?picked.images[0]:undefined))) || product?.image); const _v:any = picked ? {...picked} : null; if(_v){ _v.name = _v.name || _v.sku || "Biến thể"; if(_img){ _v.image = _img; _v.images = _v.images || [_img]; } } onAdd?.(_v, qty, 'buy'); }} className="rounded-xl bg-sky-600 text-white font-extrabold px-3 py-2 text-sm">
              Mua Ngay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
