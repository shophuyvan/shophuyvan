/* shv admin v7.1 patched
 * - Fix: click "Sửa" không xoá dữ liệu form (prefill ổn định)
 * - Fix: chặn đệ quy showEditor gây "Maximum call stack size exceeded"
 * - Fix: không gửi x‑token trong fetch (dùng Authorization duy nhất)
 * - Gemini/Cloudinary hooks giữ nguyên hành vi bạn đang có
 *
 * Lưu ý: thay file này vào FE /src/admin.js
 */

const $ = (sel, p=document) => p.querySelector(sel);
const $$ = (sel, p=document) => [...p.querySelectorAll(sel)];

const apiBase = (typeof window !== "undefined" && window.__API_BASE__) || "https://shv-api.shophuyvan.workers.dev";

// ---- thin client api (no x-token) ----
const adminApi = {
  async listProducts({limit=50, cursor=""}={}){
    const url = new URL(`${apiBase}/admin/products`);
    if (limit) url.searchParams.set("limit", limit);
    if (cursor) url.searchParams.set("cursor", cursor);
    const r = await fetch(url, {
      headers: authHeader(),
      method: "GET",
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async getProduct(id){
    const r = await fetch(`${apiBase}/admin/products?id=${encodeURIComponent(id)}`, {
      headers: authHeader(),
      method: "GET",
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async upsertProduct(it){
    const r = await fetch(`${apiBase}/admin/products`, {
      method: "POST",
      headers: {...authHeader(), "content-type": "application/json"},
      body: JSON.stringify(it),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async deleteProduct(id){
    const r = await fetch(`${apiBase}/admin/products?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeader(),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  // AI endpoints — server sẽ đọc Authorization nếu cần
  async aiSuggest(body){
    const r = await fetch(`${apiBase}/ai/suggest`, {
      method: "POST",
      headers: {...authHeader(), "content-type": "application/json"},
      body: JSON.stringify(body||{}),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
};

function authHeader(){
  const token = ($("#token")?.value || $(".token-input")?.value || "").trim();
  const h = {};
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

// ---------- UI ----------
const state = {
  pageCursor: null,
  cache: new Map(),   // id -> product
  busy: false,
};

function toast(msg){ alert(msg); }

function qid(id){ return document.getElementById(id); }

function html(strings, ...vals){
  const out = strings.reduce((a, s, i)=> a + s + (i<vals.length?(vals[i]??""):""), "");
  const tpl = document.createElement("template");
  tpl.innerHTML = out.trim();
  return tpl.content;
}

// render list
async function renderList(){
  if (state.busy) return;
  state.busy = true;
  const wrap = qid("list");
  wrap.innerHTML = `<div class="p-4 text-slate-400">Đang tải...</div>`;
  try{
    const {items} = await adminApi.listProducts({limit:100});
    wrap.innerHTML = "";
    items.forEach(it => {
      state.cache.set(it.id, it);
      wrap.append(
        html`
        <div class="item flex items-center gap-3 py-3 border-b border-slate-800">
          <img class="w-14 h-14 object-cover rounded bg-slate-800" src="${(it.images?.[0]||"").replace(/^,/, "")||"/public/logo.png"}" onerror="this.src='/public/logo.png'"/>
          <div class="flex-1">
            <div class="text-slate-100">${it.name||"Không tên"}</div>
            <div class="text-xs text-slate-500">Giá: ${it.price||0} • Tồn: ${it.stock||0} ${it.is_active? "• Active ✓" : ""}</div>
          </div>
          <button class="btn-edit px-3 py-1 bg-sky-600/20 text-sky-300 rounded" data-id="${it.id}">Sửa</button>
        </div>
        `
      );
    });
    // attach
    wrap.querySelectorAll(".btn-edit").forEach(b => b.addEventListener("click", onEdit));
  }catch(e){
    wrap.innerHTML = `<div class="p-4 text-red-400">Lỗi tải sản phẩm: ${e.message}</div>`;
  }finally{
    state.busy = false;
  }
}

// single flight guard to avoid recursive showEditor
let showing = false;

async function onEdit(ev){
  const id = ev.currentTarget.getAttribute("data-id");
  if (!id) return;
  if (showing) return; // guard
  showing = true;
  try{
    // fetch from cache first
    let it = state.cache.get(id);
    if (!it) {
      const r = await adminApi.getProduct(id);
      it = r?.item || r || null;
      if (it) state.cache.set(it.id, it);
    }
    // show editor with the loaded data
    showEditor(it || {id, is_active:true});
  }catch(e){
    toast("Lỗi mở editor: "+e.message);
  }finally{
    showing = false;
  }
}

function collectForm(){
  const v = (sel)=> ($(sel)?.value||"").trim();
  const nums = s => (s? Number(s.replace(/[^\d.-]/g,""))||0 : 0);
  const csv = s => (s||"").split(",").map(x=>x.trim()).filter(Boolean);

  // variants block (if you have)
  let variants = [];
  $$(".variant-row").forEach(row => {
    variants.push({
      name: $(".v-name", row)?.value?.trim()||"",
      price: Number($(".v-price", row)?.value||0),
      sale_price: Number($(".v-sale", row)?.value||0),
      compare_at_price: Number($(".v-compare", row)?.value||0),
      weight: Number($(".v-weight", row)?.value||0),
      sku: $(".v-sku", row)?.value?.trim()||"",
      stock: Number($(".v-stock", row)?.value||0),
      image: $(".v-image", row)?.value?.trim()||""
    });
  });

  const item = {
    id: qid("id")?.textContent?.trim() || "mới",
    name: v("#name"),
    category: v("#category") || "default",
    description: v("#description"),
    price: nums("#price"),
    sale_price: nums("#sale_price"),
    stock: nums("#stock"),
    weight: nums("#weight"),
    alt_images: csv("#alt_csv"),
    images: csv("#img_csv"),
    videos: csv("#video_csv"),
    seo_title: v("#seo_title"),
    seo_description: v("#seo_desc"),
    seo_keywords: v("#seo_kw"),
    is_active: $("#active")?.checked ?? true,
    faq: readFAQ(),
    reviews: readReviews(),
    variants,
  };
  return item;
}

// prefill form (idempotent)
function fillForm(it){
  $("#name").value = it.name||"";
  $("#category").value = it.category||"default";
  $("#description").value = it.description||"";
  $("#price").value = it.price||0;
  $("#sale_price").value = it.sale_price||"";
  $("#stock").value = it.stock||0;
  $("#weight").value = it.weight||"";
  $("#alt_csv").value = (it.alt_images||[]).join(",");
  $("#img_csv").value = (it.images||[]).join(",");
  $("#video_csv").value = (it.videos||[]).join(",");
  $("#seo_title").value = it.seo_title||"";
  $("#seo_desc").value = it.seo_description||"";
  $("#seo_kw").value = (it.seo_keywords||[]).join(", ");
  $("#active").checked = !!it.is_active;
  qid("id").textContent = it.id||"mới";

  // FAQ / Reviews / Variants render (safe replace)
  renderFAQ(it.faq||[]);
  renderReviews(it.reviews||[]);
  renderVariants(it.variants||[]);
}

function showEditor(it){
  // important: DO NOT rebind recursive listeners within itself — only rebind once in init()
  fillForm(it||{});
}

// ----- FAQ / Reviews / Variants (very lite, same structure you had) -----
function renderFAQ(list){
  const box = qid("faq");
  box.innerHTML = "";
  (list||[]).forEach((f,i)=>{
    box.append(html`
      <div class="faq-row grid grid-cols-1 gap-1 mb-2">
        <input class="faq-q border rounded px-2 py-1 bg-slate-800/50" placeholder="Câu hỏi" value="${f.q||""}"/>
        <textarea class="faq-a border rounded px-2 py-1 bg-slate-800/50" placeholder="Trả lời">${f.a||""}</textarea>
      </div>
    `);
  });
}
function readFAQ(){
  const out=[];
  $$("#faq .faq-row").forEach(r => out.push({q: $(".faq-q", r).value.trim(), a: $(".faq-a", r).value.trim()}));
  return out.filter(x=>x.q||x.a);
}

function renderReviews(list){
  const box = qid("reviews");
  box.innerHTML = "";
  (list||[]).forEach(rv=>{
    box.append(html`
      <div class="rv-row flex gap-2 mb-2">
        <input class="rv-name border rounded px-2 py-1 bg-slate-800/50" placeholder="Tên" value="${rv.name||""}"/>
        <input class="rv-avatar border rounded px-2 py-1 bg-slate-800/50" placeholder="Avatar URL" value="${rv.avatar||""}"/>
        <input class="rv-stars border rounded px-2 py-1 bg-slate-800/50 w-16" placeholder="5" value="${rv.stars||5}"/>
        <input class="rv-text border rounded px-2 py-1 bg-slate-800/50 flex-1" placeholder="Nội dung" value="${rv.text||""}"/>
      </div>
    `);
  });
}
function readReviews(){
  const out=[];
  $$("#reviews .rv-row").forEach(r => out.push({
    name: $(".rv-name", r).value.trim(),
    avatar: $(".rv-avatar", r).value.trim(),
    stars: Number($(".rv-stars", r).value||5),
    text: $(".rv-text", r).value.trim(),
  }));
  return out.filter(x=>x.text);
}

function renderVariants(list){
  const box = qid("variants");
  box.innerHTML = "";
  (list||[]).forEach(v => {
    box.append(html`
      <div class="variant-row grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
        <input class="v-name border rounded px-2 py-1 bg-slate-800/50" placeholder="Tên phân loại" value="${v.name||""}"/>
        <input class="v-image border rounded px-2 py-1 bg-slate-800/50" placeholder="Ảnh" value="${v.image||""}"/>
        <input class="v-price border rounded px-2 py-1 bg-slate-800/50" placeholder="Giá" value="${v.price||0}"/>
        <input class="v-sale border rounded px-2 py-1 bg-slate-800/50" placeholder="Giá sale" value="${v.sale_price||""}"/>
        <input class="v-compare border rounded px-2 py-1 bg-slate-800/50" placeholder="Giá gốc" value="${v.compare_at_price||""}"/>
        <input class="v-weight border rounded px-2 py-1 bg-slate-800/50" placeholder="Cân nặng" value="${v.weight||""}"/>
        <input class="v-sku border rounded px-2 py-1 bg-slate-800/50" placeholder="SKU" value="${v.sku||""}"/>
        <input class="v-stock border rounded px-2 py-1 bg-slate-800/50" placeholder="Tồn kho" value="${v.stock||0}"/>
      </div>
    `);
  });
}

// ---------- AI buttons next to fields ----------
function bindAI(){
  $("#btn-ai-title")?.addEventListener("click", async ()=>{
    try{
      const name = $("#name").value.trim();
      const r = await adminApi.aiSuggest({type:"title", name, maxLen:120});
      if (Array.isArray(r?.titles)) {
        // pick the longest not exceeding 120 chars
        const p = r.titles.sort((a,b)=>b.length-a.length).find(s=>s.length<=120) || r.titles[0];
        $("#name").value = p || $("#name").value;
      }
    }catch(e){ toast("AI tiêu đề lỗi: "+e.message); }
  });
  $("#btn-ai-desc")?.addEventListener("click", async ()=>{
    try{
      const name = $("#name").value.trim();
      const description = $("#description").value.trim();
      const r = await adminApi.aiSuggest({type:"desc", name, description});
      if (r?.description) $("#description").value = r.description;
    }catch(e){ toast("AI mô tả lỗi: "+e.message); }
  });
  $("#btn-ai-seo")?.addEventListener("click", async ()=>{
    try{
      const name = $("#name").value.trim();
      const description = $("#description").value.trim();
      const r = await adminApi.aiSuggest({type:"seo", name, description});
      if (r?.seo){
        $("#seo_title").value = r.seo.title||"";
        $("#seo_desc").value = r.seo.description||"";
        $("#seo_kw").value = (r.seo.keywords||[]).join(", ");
      }
    }catch(e){ toast("AI SEO lỗi: "+e.message); }
  });
  $("#btn-ai-faq")?.addEventListener("click", async ()=>{
    try{
      const name = $("#name").value.trim();
      const description = $("#description").value.trim();
      const r = await adminApi.aiSuggest({type:"faq", name, description});
      if (Array.isArray(r?.faq)) renderFAQ(r.faq);
    }catch(e){ toast("AI FAQ lỗi: "+e.message); }
  });
  $("#btn-ai-reviews")?.addEventListener("click", async ()=>{
    try{
      const name = $("#name").value.trim();
      const r = await adminApi.aiSuggest({type:"reviews", name});
      if (Array.isArray(r?.reviews)) renderReviews(r.reviews);
    }catch(e){ toast("AI đánh giá lỗi: "+e.message); }
  });
}

// ---------- Cloudinary unsigned upload (if preset provided in Settings) ----------
async function uploadToCloudinary(file, folder="products"){
  // expect window.CLOUDINARY (url or {cloud_name, api_key, upload_preset})
  const cfg = window.CLOUDINARY || {};
  let url = "";
  if (typeof cfg === "string"){
    url = cfg; // cloudinary://<key>:<secret>@<cloud_name>/<preset>
  }else if (cfg.cloud_name && cfg.upload_preset){
    url = `https://api.cloudinary.com/v1_1/${cfg.cloud_name}/upload`;
  }
  if (!url) throw new Error("Thiếu cấu hình Cloudinary");
  const fd = new FormData();
  if (cfg.upload_preset) fd.append("upload_preset", cfg.upload_preset);
  fd.append("folder", folder);
  fd.append("file", file);
  const r = await fetch(url, { method:"POST", body: fd });
  if (!r.ok) throw new Error((await r.text()).slice(0,300));
  const j = await r.json();
  return j.secure_url || j.url;
}

function bindUploads(){
  $("#btn-up-images")?.addEventListener("change", async (ev)=>{
    const files = [...(ev.currentTarget.files||[])];
    if (!files.length) return;
    try{
      const out = [];
      for (const f of files){
        const u = await uploadToCloudinary(f, "products");
        out.push(u);
      }
      const csv = $("#img_csv").value.trim();
      $("#img_csv").value = (csv? csv.split(",").map(s=>s.trim()).filter(Boolean): []).concat(out).join(",");
    }catch(e){ toast("Upload ảnh lỗi: "+e.message); }
  });
  $("#btn-up-video")?.addEventListener("change", async (ev)=>{
    const files = [...(ev.currentTarget.files||[])];
    if (!files.length) return;
    try{
      const out = [];
      for (const f of files){
        const u = await uploadToCloudinary(f, "videos");
        out.push(u);
      }
      const csv = $("#video_csv").value.trim();
      $("#video_csv").value = (csv? csv.split(",").map(s=>s.trim()).filter(Boolean): []).concat(out).join(",");
    }catch(e){ toast("Upload video lỗi: "+e.message); }
  });
}

// ---------- init ----------
function bindCommon(){
  $("#btn-save")?.addEventListener("click", async ()=>{
    try{
      const it = collectForm();
      const ok = await adminApi.upsertProduct(it);
      toast("Đã lưu!");
      if (ok?.item) {
        state.cache.set(ok.item.id, ok.item);
        showEditor(ok.item); // refresh current form
        renderList(); // refresh list
      }else{
        renderList();
      }
    }catch(e){ toast("Lưu thất bại: "+e.message); }
  });
  $("#btn-new")?.addEventListener("click", ()=> showEditor({id:"mới", is_active:true}));
  $("#btn-delete")?.addEventListener("click", async ()=>{
    const id = qid("id").textContent.trim();
    if (!id || id==="mới") return;
    if (!confirm("Xoá sản phẩm này?")) return;
    try{
      await adminApi.deleteProduct(id);
      toast("Đã xoá");
      showEditor({id:"mới", is_active:true});
      renderList();
    }catch(e){ toast("Xoá thất bại: "+e.message); }
  });
  $("#btn-ai-title")&&bindAI();
  bindUploads();
}

function init(){
  // token field
  const tokenInput = $("#token");
  tokenInput?.addEventListener("change", ()=> localStorage.setItem("ADMIN_TOKEN", tokenInput.value.trim()));
  const mem = localStorage.getItem("ADMIN_TOKEN");
  if (mem && tokenInput) tokenInput.value = mem;

  bindCommon();
  renderList();
  showEditor({id:"mới", is_active:true}); // default blank
}

document.addEventListener("DOMContentLoaded", init);



// === BANNERS & VOUCHERS ADMIN ===
const Banners = {
  async list(){
    const data = await api('/banners?limit=50').catch(()=>({items:[]}));
    const items = data.items || data || [];
    const wrap = document.getElementById('banners-list');
    if (!wrap) return;
    wrap.innerHTML = items.map(b => `
      <div class="bg-white/5 rounded p-3 flex items-center gap-3 border border-white/10">
        <img src="${b.image||b.img||''}" class="w-24 h-14 object-cover rounded" onerror="this.src='/assets/no-image.png'">
        <div class="flex-1">
          <div class="font-medium">${b.title||''}</div>
          <div class="text-xs text-gray-400">${b.link||''}</div>
        </div>
        <button class="px-2 py-1 text-sm bg-blue-600 rounded text-white" data-edit="${b.id}">Sửa</button>
        <button class="px-2 py-1 text-sm bg-rose-600 rounded text-white" data-del="${b.id}">Xoá</button>
      </div>
    `).join('');
    wrap.querySelectorAll('[data-del]').forEach(btn=>btn.onclick = async ()=>{
      if(!confirm('Xoá banner này?')) return;
      await api('/admin/banners/'+btn.dataset.del, {method:'DELETE'}).catch(()=>{});
      this.list();
    });
    wrap.querySelectorAll('[data-edit]').forEach(btn=>btn.onclick = ()=> openBannerModal(items.find(x=>x.id==btn.dataset.edit)));
  }
};

const Vouchers = {
  async list(){
    const data = await api('/vouchers?limit=50').catch(()=>({items:[]}));
    const items = data.items || data || [];
    const wrap = document.getElementById('vouchers-list');
    if (!wrap) return;
    wrap.innerHTML = items.map(v => `
      <div class="bg-white/5 rounded p-3 flex items-center gap-3 border border-white/10">
        <div class="flex-1">
          <div class="font-medium">${v.code||v.title||'Voucher'}</div>
          <div class="text-xs text-gray-400">Giảm: ${v.discount||v.off||0}${(v.type||'percent')==='percent'?'%':'đ'} | HSD: ${v.expires||''}</div>
        </div>
        <button class="px-2 py-1 text-sm bg-blue-600 rounded text-white" data-edit="${v.id}">Sửa</button>
        <button class="px-2 py-1 text-sm bg-rose-600 rounded text-white" data-del="${v.id}">Xoá</button>
      </div>
    `).join('');
    wrap.querySelectorAll('[data-del]').forEach(btn=>btn.onclick = async ()=>{
      if(!confirm('Xoá voucher này?')) return;
      await api('/admin/vouchers/'+btn.dataset.del, {method:'DELETE'}).catch(()=>{});
      this.list();
    });
    wrap.querySelectorAll('[data-edit]').forEach(btn=>btn.onclick = ()=> openVoucherModal(items.find(x=>x.id==btn.dataset.edit)));
  }
};

function openBannerModal(item={}){
  const html = `
    <div class="space-y-3">
      <label class="block text-sm">Tiêu đề<input id="bn-title" class="w-full mt-1 bg-white/10 rounded p-2" value="${item.title||''}"/></label>
      <label class="block text-sm">Liên kết<input id="bn-link" class="w-full mt-1 bg-white/10 rounded p-2" value="${item.link||''}"/></label>
      <label class="block text-sm">Ảnh banner (URL)
        <div class="flex gap-2 mt-1">
          <input id="bn-image" class="flex-1 bg-white/10 rounded p-2" value="${item.image||item.img||''}"/>
          <input id="bn-file" type="file" class="hidden" accept="image/*"/>
          <button id="bn-upload" class="px-3 py-2 bg-sky-600 rounded text-white">Tải từ máy</button>
        </div>
      </label>
      <label class="inline-flex items-center gap-2"><input id="bn-active" type="checkbox" ${item.active?'checked':''}/> Active</label>
    </div>`;
  openModal(item.id?'Cập nhật banner':'Thêm banner', html, async ()=>{
    const body = {
      title: document.getElementById('bn-title').value.trim(),
      link: document.getElementById('bn-link').value.trim(),
      image: document.getElementById('bn-image').value.trim(),
      active: document.getElementById('bn-active').checked,
    };
    const url = item.id? '/admin/banners/'+item.id : '/admin/banners';
    await api(url, {method: item.id?'PUT':'POST', body: JSON.stringify(body)}).catch(()=>{});
    Banners.list();
  });
  const file = document.getElementById('bn-file');
  document.getElementById('bn-upload').onclick = ()=> file.click();
  file.onchange = async ()=>{
    const f = file.files[0]; if (!f) return;
    try {
      if (window.UPLOAD_TO_CLOUDINARY) {
        const res = await window.UPLOAD_TO_CLOUDINARY(f);
        document.getElementById('bn-image').value = res.secure_url || res.url || '';
      } else {
        const data = await toBase64(f); document.getElementById('bn-image').value = data;
      }
    }catch(e){ alert('Upload lỗi'); }
  };
}

function openVoucherModal(item={}){
  const html = `
    <div class="grid gap-3">
      <label class="block text-sm">Mã code<input id="vc-code" class="w-full mt-1 bg-white/10 rounded p-2" value="${item.code||''}" /></label>
      <label class="block text-sm">Giảm (%)<input id="vc-off" type="number" class="w-full mt-1 bg-white/10 rounded p-2" value="${item.discount||item.off||0}"/></label>
      <label class="block text-sm">Hết hạn<input id="vc-exp" class="w-full mt-1 bg-white/10 rounded p-2" value="${item.expires||''}" placeholder="YYYY-MM-DD"/></label>
      <label class="inline-flex items-center gap-2"><input id="vc-active" type="checkbox" ${item.active?'checked':''}/> Active</label>
    </div>`;
  openModal(item.id?'Cập nhật voucher':'Thêm voucher', html, async ()=>{
    const body = {
      code: document.getElementById('vc-code').value.trim(),
      discount: Number(document.getElementById('vc-off').value||0),
      expires: document.getElementById('vc-exp').value.trim(),
      active: document.getElementById('vc-active').checked,
    };
    const url = item.id? '/admin/vouchers/'+item.id : '/admin/vouchers';
    await api(url, {method: item.id?'PUT':'POST', body: JSON.stringify(body)}).catch(()=>{});
    Vouchers.list();
  });
}

// utils
function toBase64(file){
  return new Promise((res, rej)=>{
    const r = new FileReader();
    r.onload = ()=> res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// Left nav switching
document.addEventListener('DOMContentLoaded', ()=>{
  const map = {
    'view-products':'products',
    'view-editor':'editor',
    'view-banners':'banners',
    'view-vouchers':'vouchers',
  };
  document.querySelectorAll('[data-view]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      Object.values(map).forEach(v => document.querySelector('#view-'+v)?.classList.add('hidden'));
      const id = btn.getAttribute('data-view');
      document.querySelector('#view-'+id)?.classList.remove('hidden');
      if (id==='banners') Banners.list();
      if (id==='vouchers') Vouchers.list();
    });
  });
  // default stay on products view
});


    // sidebar delegation fix
    (function(){
      const sb = document.getElementById('sidebar') || document.querySelector('.sidebar');
      if (sb && !sb.__bound_view_clicks) {
        sb.addEventListener('click', (e)=>{
          const el = e.target.closest('[data-view]');
          if (!el) return;
          e.preventDefault();
          e.stopPropagation();
          const view = el.getAttribute('data-view');
          if (typeof showEditor === 'function') showEditor(view); __toggleViewFallback(view);
        });
        sb.__bound_view_clicks = true;
      }
    })();
    

    // cloudinary settings ui
    (function(){
      function getEl(id){ return document.getElementById(id); }
      function getCfg(){
        const cfg = JSON.parse(localStorage.getItem('cloudinary_cfg')||'{}');
        return cfg;
      }
      function setCfg(cfg){
        localStorage.setItem('cloudinary_cfg', JSON.stringify(cfg));
      }
      function fill(){
        const c = getCfg();
        (getEl('cld_cloud_name')||{}).value = c.cloud_name||'';
        (getEl('cld_upload_preset')||{}).value = c.upload_preset||'';
        (getEl('cld_folder')||{}).value = c.folder||'';
        (getEl('cld_api_key')||{}).value = c.api_key||'';
        (getEl('cld_signature')||{}).value = c.signature||'';
        (getEl('cld_timestamp')||{}).value = c.timestamp||'';
      }
      function save(){
        const cfg = {
          cloud_name: (getEl('cld_cloud_name')||{}).value || '',
          upload_preset: (getEl('cld_upload_preset')||{}).value || '',
          folder: (getEl('cld_folder')||{}).value || '',
          api_key: (getEl('cld_api_key')||{}).value || '',
          signature: (getEl('cld_signature')||{}).value || '',
          timestamp: (getEl('cld_timestamp')||{}).value || ''
        };
        setCfg(cfg);
        const out = getEl('cloudinary_result');
        if (out) out.textContent = 'Đã lưu cấu hình.';
      }
      async function ping(){
        const out = getEl('cloudinary_result');
        const cfg = getCfg();
        if (!cfg.cloud_name || (!cfg.upload_preset && !cfg.signature)) {
          if (out) out.textContent = 'Thiếu cloud_name và upload_preset (unsigned) hoặc signature (signed).';
          return;
        }
        // Tiny transparent PNG
        const tiny = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P4z8DwHwAFgwJ/9kJ4vwAAAABJRU5ErkJggg==';
        const url = `https://api.cloudinary.com/v1_1/${cfg.cloud_name}/auto/upload`;
        const form = new FormData();
        form.append('file', tiny);
        if (cfg.upload_preset) form.append('upload_preset', cfg.upload_preset);
        if (cfg.folder) form.append('folder', cfg.folder);
        if (cfg.api_key) form.append('api_key', cfg.api_key);
        if (cfg.signature && cfg.timestamp) {
          form.append('signature', cfg.signature);
          form.append('timestamp', cfg.timestamp);
        }
        try {
          const res = await fetch(url, { method:'POST', body: form });
          const txt = await res.text();
          if (out) out.textContent = `Status ${res.status}: ${txt.slice(0,500)}`;
        } catch (err){
          if (out) out.textContent = 'Ping lỗi: ' + (err && err.message || err);
        }
      }
      document.addEventListener('DOMContentLoaded', ()=>{
        fill();
        const sbtn = document.getElementById('btn_save_cloudinary');
        const pbtn = document.getElementById('btn_ping_cloudinary');
        if (sbtn) sbtn.addEventListener('click', save);
        if (pbtn) pbtn.addEventListener('click', ping);
      });
    })();
    

    /* delegation fallback toggle */
    function __toggleViewFallback(view){
      const all = document.querySelectorAll('[id^="view-"]');
      all.forEach(el=>{ el.hidden = true; });
      const sec = document.getElementById('view-'+view);
      if (sec) sec.hidden = false;
    }
    