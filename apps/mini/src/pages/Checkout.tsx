import React, { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import cart from '@shared/cart';
import { fmtVND } from '@shared/utils/fmtVND';

const API_BASE  = import.meta.env.VITE_API_BASE;
const API_TOKEN = (import.meta.env.VITE_API_TOKEN || '');

const FALLBACK_PRICING = {
  'Viettel Post': [{limit:1000,price:18000},{limit:2000,price:23000},{limit:3000,price:28000},{limit:4000,price:33000},{limit:5000,price:38000},{limit:6000,price:43000}],
  'SPX Express': [{limit:1000,price:15000},{limit:2000,price:25000},{limit:3000,price:35000},{limit:4000,price:45000},{limit:5000,price:55000},{limit:6000,price:65000}],
  'J&T Express': [{limit:1000,price:20000},{limit:2000,price:20000},{limit:3000,price:25000},{limit:4000,price:23000},{limit:5000,price:35000},{limit:6000,price:40000}],
  'Lazada Express': [{limit:1000,price:19000},{limit:2000,price:19000},{limit:3000,price:19000},{limit:4000,price:23000},{limit:5000,price:27000},{limit:6000,price:31000}],
  'GHN': [{limit:1000,price:19000},{limit:2000,price:19000},{limit:3000,price:24000},{limit:4000,price:29000},{limit:5000,price:34000},{limit:6000,price:39000}],
  'BEST Express': [{limit:1000,price:18000},{limit:2000,price:18000},{limit:3000,price:18000},{limit:4000,price:23000},{limit:5000,price:28000},{limit:6000,price:33000}],
};
const CARRIER_ORDER = Object.keys(FALLBACK_PRICING);

function calcFallbackFee(weightGram, carrier){
  const arr = FALLBACK_PRICING[carrier] || [];
  for (const step of arr){
    if (weightGram <= step.limit) return step.price;
  }
  if (arr.length){ 
    const last = arr[arr.length-1];
    const extra = Math.ceil((weightGram - last.limit)/500) * 5000;
    return last.price + Math.max(0, extra);
  }
  return 0;
}

export default function Checkout() {
  const [st, setSt] = useState(cart.get());
  const [form, setForm] = useState({ name: '', phone: '', province: '', district: '', ward: '', address: '' });
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);
  const disabled = st.lines.length === 0;

  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);

  const totalWeightGram = useMemo(()=> st.lines.reduce((s,l)=> s + (l.weight_gram ?? l.weight ?? 0) * (l.qty ?? 1), 0), [st]);
  const [shippingList, setShippingList] = useState([]);
  const [shippingFee, setShippingFee] = useState(0);
  const [carrier, setCarrier] = useState('');

  useEffect(()=>{ (async()=>{
    try{
      const r = await fetch(API_BASE + '/v1/platform/areas/province', { headers: { 'Authorization': 'Bearer ' + API_TOKEN } });
      if(r.ok){ const js = await r.json(); const arr = Array.isArray(js?.data)?js.data:(Array.isArray(js)?js:[]); setProvinces(arr); }
    }catch{}
  })(); }, []);

  useEffect(()=>{ setDistricts([]); setWards([]); if(!form.province) return; (async()=>{
    try{
      const r = await fetch(API_BASE + '/v1/platform/areas/district?province_code=' + encodeURIComponent(form.province), { headers: { 'Authorization': 'Bearer ' + API_TOKEN } });
      if(r.ok){ const js = await r.json(); const arr = Array.isArray(js?.data)?js.data:(Array.isArray(js)?js:[]); setDistricts(arr); }
    }catch{}
  })(); }, [form.province]);

  useEffect(()=>{ setWards([]); if(!form.district) return; (async()=>{
    try{
      const r = await fetch(API_BASE + '/v1/platform/areas/commune?district_code=' + encodeURIComponent(form.district), { headers: { 'Authorization': 'Bearer ' + API_TOKEN } });
      if(r.ok){ const js = await r.json(); const arr = Array.isArray(js?.data)?js.data:(Array.isArray(js)?js:[]); setWards(arr); }
    }catch{}
  })(); }, [form.district]);

  useEffect(()=>{ (async()=>{
    if(!form.province || !form.district || totalWeightGram <= 0){
      const arr = CARRIER_ORDER.map(c=>({carrier:c, fee: calcFallbackFee(totalWeightGram || 1000, c)}));
      setShippingList(arr); setCarrier(arr[0]?.carrier || ''); setShippingFee(arr[0]?.fee || 0); return;
    }
    try{
      const r = await fetch(API_BASE + '/v1/platform/orders/price', {
        method:'POST', headers: { 'content-type':'application/json', 'Authorization': 'Bearer ' + API_TOKEN },
        body: JSON.stringify({ to_province: form.province, to_district: form.district, weight_gram: totalWeightGram })
      });
      if(r.ok){
        const js = await r.json();
        const items = Array.isArray(js?.data)?js.data:(Array.isArray(js)?js:[]);
        const mapped = items.map(x=>({carrier: x?.carrier_name || x?.carrier || 'Khác', fee: Number(x?.fee || x?.price || 0)}));
        if(mapped.length){ setShippingList(mapped); setCarrier(mapped[0].carrier); setShippingFee(mapped[0].fee); return; }
      }
    }catch{}
    const arr = CARRIER_ORDER.map(c=>({carrier:c, fee: calcFallbackFee(totalWeightGram, c)}));
    setShippingList(arr); setCarrier(arr[0]?.carrier || ''); setShippingFee(arr[0]?.fee || 0);
  })(); }, [form.province, form.district, totalWeightGram]);

  const grandTotal = st.total + (shippingFee || 0);

  const submit = async () => {
    setError(null);
    if (!form.name || !form.phone) { setError('Vui lòng nhập họ tên và số điện thoại'); return; }
    if (!carrier) { setError('Vui lòng chọn đơn vị vận chuyển'); return; }

    const order = {
      contact: { name: form.name, phone: form.phone, province: form.province, district: form.district, ward: form.ward, address: form.address },
      lines: st.lines,
      shipping: { carrier, fee: shippingFee, weight_gram: totalWeightGram },
      totals: { subtotal: st.subtotal, savings: st.savings, shipping: shippingFee, total: grandTotal },
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch(API_BASE + '/v1/platform/orders/create', { method: 'POST', headers: { 'content-type':'application/json', 'Authorization': 'Bearer ' + API_TOKEN }, body: JSON.stringify(order) });
      if(res.ok){ const data = await res.json().catch(()=>({})); setDone({kind:'server', data, endpoint:'/v1/platform/orders/create'}); cart.clear(); setSt(cart.get()); return; }
    } catch {}

    const candidates = ['/orders','/api/orders','/v1/orders','/checkout/order'];
    for(const p of candidates){
      try{
        const res = await fetch((window.API_BASE ? window.API_BASE.replace(/\/+$/,'') + p : p), { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(order) });
        if(res.ok){ const data = await res.json().catch(()=>({})); setDone({kind:'server', data, endpoint:p}); cart.clear(); setSt(cart.get()); return; }
      }catch{}
    }

    try{ localStorage.setItem('shv_last_order', JSON.stringify(order)); }catch{}
    setDone({kind:'local', data: order}); cart.clear(); setSt(cart.get());
  };

  return (<div>
    <Header />
    <main className="max-w-4xl mx-auto p-3">
      <h1 className="text-xl font-bold mb-3">Thanh toán</h1>
      {st.lines.length === 0 && !done && <div>Giỏ hàng trống.</div>}
      {done ? (
        <div className="bg-white rounded-2xl p-4 shadow">
          <div className="text-lg font-semibold mb-2">Đặt hàng thành công!</div>
          {done.kind === 'server' ? (<div className="text-sm text-gray-600">Đã gửi đơn lên máy chủ ({done.endpoint}).</div>) : (<div className="text-sm text-gray-600">Đơn tạm lưu trong máy (chưa gửi server).</div>)}
          <div className="mt-2 text-sm">Cảm ơn bạn đã mua hàng.</div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl p-3 shadow">
            {st.lines.map((l)=> (<div key={String(l.id)} className="flex justify-between py-1 text-sm"><span className="line-clamp-1 pr-2">{l.name} × {l.qty}</span><span>{fmtVND(l.price * l.qty)}</span></div>))}
            <div className="flex justify-between py-2 border-t mt-2 font-semibold"><span>Tạm tính</span><span>{fmtVND(st.total)}</span></div>
          </div>
          <div className="bg-white rounded-2xl p-3 shadow space-y-2">
            <div className="font-semibold">Thông tin nhận hàng</div>
            <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="Họ tên" className="w-full rounded-xl border px-3 py-2" />
            <input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} placeholder="Số điện thoại" className="w-full rounded-xl border px-3 py-2" />
            <div className="grid grid-cols-3 gap-2">
              <select value={form.province} onChange={e=>setForm({...form, province:e.target.value, district:'', ward:''})} className="rounded-xl border px-2 py-2"><option value="">Tỉnh/Thành</option>{provinces.map((p)=>(<option key={p.code||p.id} value={p.code||p.id}>{p.name||p.label}</option>))}</select>
              <select value={form.district} onChange={e=>setForm({...form, district:e.target.value, ward:''})} className="rounded-xl border px-2 py-2"><option value="">Quận/Huyện</option>{districts.map((d)=>(<option key={d.code||d.id} value={d.code||d.id}>{d.name||d.label}</option>))}</select>
              <select value={form.ward} onChange={e=>setForm({...form, ward:e.target.value})} className="rounded-xl border px-2 py-2"><option value="">Phường/Xã</option>{wards.map((w)=>(<option key={w.code||w.id} value={w.code||w.id}>{w.name||w.label}</option>))}</select>
            </div>
            <input value={form.address} onChange={e=>setForm({...form, address:e.target.value})} placeholder="Địa chỉ" className="w-full rounded-xl border px-3 py-2" />
          </div>
          <div className="bg-white rounded-2xl p-3 shadow space-y-2">
            <div className="font-semibold">Vận chuyển</div>
            <div className="text-xs text-gray-500">Khối lượng: {Math.max(1, Math.ceil((totalWeightGram||0)/1000))} kg</div>
            <div className="grid grid-cols-1 gap-2">
              {shippingList.map((x,idx)=>(
                <label key={idx} className="flex items-center justify-between rounded-xl border p-2">
                  <div className="flex items-center gap-2">
                    <input type="radio" name="ship" checked={carrier===x.carrier} onChange={()=>{ setCarrier(x.carrier); setShippingFee(x.fee); }} />
                    <span>{x.carrier}</span>
                  </div>
                  <div className="font-semibold">{fmtVND(x.fee)}</div>
                </label>
              ))}
            </div>
            {!shippingList.length && <div className="text-sm text-gray-500">Không lấy được báo giá. Vui lòng nhập địa chỉ hoặc thử lại.</div>}
          </div>
          <div className="bg-white rounded-2xl p-3 shadow">
            <div className="flex justify-between py-1 text-sm"><span>Tạm tính</span><span>{fmtVND(st.total)}</span></div>
            <div className="flex justify-between py-1 text-sm"><span>Phí vận chuyển</span><span>{fmtVND(shippingFee)}</span></div>
            <div className="flex justify-between py-2 border-t mt-2 font-semibold"><span>Tổng cộng</span><span>{fmtVND(st.total + (shippingFee||0))}</span></div>
            {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
            <button disabled={disabled} onClick={submit} className="w-full rounded-2xl bg-sky-500 disabled:bg-gray-300 text-white py-2 mt-2">Đặt hàng</button>
          </div>
        </div>
      )}
    </main>
    <Footer />
  </div>); }