const API = '/api/content';
const CATALOG = 'https://huyvan-worker-api.nghiemchihuy.workers.dev/api/core/products/public-catalog?limit=110';
const root = document.querySelector('#admin-root');
const state = { session: sessionStorage.getItem('shv-content-token') || '', user: null, products: [], selected: null, overrides: {}, banners: [], settings: {}, media: [], tab: 'basic', page: 'overview' };

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const mojibakePattern = new RegExp('[\\u00c3\\u00c4]|\\u00e1[\\u00ba\\u00bb]');
const text = (value) => {
  let result = value === null || value === undefined ? '' : String(value).trim();
  if (!mojibakePattern.test(result)) return result;
  for (let index = 0; index < 2; index += 1) {
    try {
      const bytes = Uint8Array.from(Array.from(result), (char) => char.codePointAt(0) & 255);
      const next = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (!next || next.includes('�') || next === result) break;
      result = next;
      if (!mojibakePattern.test(result)) break;
    } catch { break; }
  }
  return result;
};
const parse = (value, fallback = []) => { try { return Array.isArray(value) ? value : JSON.parse(value || '[]'); } catch { return fallback; } };
const money = (value) => value === null || value === undefined || value === '' ? 'Giá lấy từ kho' : `${new Intl.NumberFormat('vi-VN').format(value)}đ`;

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.session) headers.set('authorization', `Bearer ${state.session}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('content-type', 'application/json');
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `api_${response.status}`);
  return payload;
}

function normalize(item) {
  const images = parse(item.images).filter(Boolean);
  const detailImages = [...parse(item.product_images), ...parse(item.detail_images)].filter(Boolean);
  const variants = Array.isArray(item.variants) ? item.variants : parse(item.variants);
  return { id:text(item.id ?? item.sku), sku:text(item.sku), name:text(item.name ?? item.title ?? item.product_name) || 'Sản phẩm chưa có tên', description:text(item.description), category:text(item.category_name ?? item.category ?? item.category_slug), image:text(item.image ?? item.image_url ?? images[0]), images:[...new Set([text(item.image ?? item.image_url), ...images, ...detailImages].filter(Boolean))], video:text(item.video_url), stock:item.stock ?? null, price:item.price_display ?? item.price_final ?? item.price ?? null, variants };
}

async function loadCatalog() {
  const response = await fetch(CATALOG, { headers:{accept:'application/json'} });
  if (!response.ok) throw new Error(`catalog_${response.status}`);
  const body = await response.json();
  state.products = (Array.isArray(body) ? body : body.products || body.items || body.data || []).map(normalize);
  if (!state.selected && state.products[0]) selectProduct(state.products[0].id, false);
}

async function loadSession() {
  if (!state.session) return;
  try { const result = await request('/v1/session/me'); state.user = result.user; } catch { state.session = ''; sessionStorage.removeItem('shv-content-token'); }
}

async function loadAdminContent() {
  const [banners, settings, media] = await Promise.all([
    request('/v1/site/banners').catch(() => ({ items: [] })),
    request('/v1/site/settings').catch(() => ({ settings: {} })),
    request('/v1/site/media').catch(() => ({ items: [] }))
  ]);
  state.banners = banners.items || [];
  state.settings = settings.settings || {};
  state.media = media.items || [];
}

async function hydrateAdmin() {
  const results = await Promise.allSettled([loadCatalog(), loadAdminContent()]);
  const failed = results.some((result) => result.status === 'rejected');
  if (failed) toast('Đã đăng nhập, nhưng một phần dữ liệu nội dung chưa tải được. Hãy tải lại trang để thử lại.');
  render();
}

async function selectProduct(id, redraw = true) {
  state.selected = state.products.find((item) => item.id === id) || null;
  if (!state.selected) return;
  try { const result = await request(`/v1/site/products/${encodeURIComponent(id)}`); state.overrides[id] = result.item || {}; } catch { state.overrides[id] = {}; }
  if (redraw) render();
}

function current() { return state.selected; }
function currentOverride() { return state.overrides[current()?.id] || {}; }
function sourceValue(key) { const product = current(); const override = currentOverride(); return text(override[key] ?? product?.[key] ?? ''); }

function loginView() {
  return `<main class="login"><form class="login-card" data-login><span class="eyebrow">Shop Huy Vân</span><h1>Quản trị nội dung website</h1><p class="lead">Khu vực này chỉ chỉnh phần hiển thị của website. Không liên kết quyền đơn hàng, SKU, tồn kho hay hệ thống sàn.</p><div class="field"><label for="email">Tài khoản</label><input id="email" name="email" type="email" autocomplete="username" required></div><div class="field"><label for="password">Mật khẩu</label><input id="password" name="password" type="password" autocomplete="current-password" required></div><button class="button primary" type="submit" style="margin-top:22px;width:100%">Đăng nhập</button><p class="warning" data-login-error></p></form></main>`;
}

function productList() {
  const q = document.querySelector('[data-product-filter]')?.value?.toLocaleLowerCase('vi') || '';
  const items = state.products.filter((product) => !q || `${product.name} ${product.sku}`.toLocaleLowerCase('vi').includes(q));
  return `<aside class="card product-list"><h2>Sản phẩm website</h2><input class="product-search" data-product-filter placeholder="Tìm tên hoặc SKU…"><div class="product-items">${items.length ? items.map((product) => `<button class="product-item ${current()?.id === product.id ? 'active' : ''}" data-product="${escapeHtml(product.id)}">${product.image ? `<img src="${escapeHtml(product.image)}" alt="">` : '<span class="source-preview">Không ảnh</span>'}<span><b>${escapeHtml(product.name)}</b><span>${escapeHtml(product.sku || 'Chưa có SKU')}</span></span></button>`).join('') : '<p class="empty">Không có sản phẩm phù hợp.</p>'}</div></aside>`;
}

function editor() {
  const product = current();
  if (!product) return '<section class="card form-card"><div class="empty">Đang lấy sản phẩm từ kho…</div></section>';
  const images = product.images;
  return `<section class="card form-card"><div class="form-heading"><div><span class="eyebrow">Chỉ chỉnh nội dung website</span><h2>${escapeHtml(product.name)}</h2><p>Dữ liệu nguồn đang có được nạp sẵn. Chỉ khi bấm lưu thì nội dung hiển thị riêng mới thay đổi.</p></div><span class="source-note">Nguồn: Warehouse/Product<br>Không sửa giá, tồn kho hoặc SKU sàn tại đây.</span></div><div class="tabs"><button class="${state.tab==='basic'?'active':''}" data-tab="basic">Cơ bản</button><button class="${state.tab==='media'?'active':''}" data-tab="media">Hình ảnh &amp; video</button><button class="${state.tab==='variants'?'active':''}" data-tab="variants">Phân loại &amp; giá hiển thị</button><button class="${state.tab==='description'?'active':''}" data-tab="description">Mô tả</button></div><form data-product-form>${state.tab==='basic'?basicFields():state.tab==='media'?mediaFields(images):state.tab==='variants'?variantFields():descriptionFields()}<div class="form-actions"><button class="button outline" type="button" data-reset>Bỏ thay đổi</button><button class="button primary" type="submit">Lưu nội dung website</button></div></form></section>`;
}

function basicFields(){return `<div class="grid-two"><div class="field"><label>Tên hiển thị trên website</label><input name="display_title" value="${escapeHtml(sourceValue('display_title') || current().name)}"><small class="small">Nguồn đang có: ${escapeHtml(current().name)}</small></div><div class="field"><label>Danh mục hiển thị</label><input name="category" value="${escapeHtml(sourceValue('category'))}" placeholder="Chỉ chọn danh mục đúng của sản phẩm"></div><div class="field"><label>Giá hiển thị trên website</label><input name="display_price" inputmode="numeric" value="${escapeHtml(sourceValue('display_price') || current().price || '')}" placeholder="Để trống để lấy giá từ kho"></div><div class="field"><label>Trạng thái website</label><select name="published"><option value="true" ${sourceValue('published')!=='false'?'selected':''}>Hiển thị</option><option value="false" ${sourceValue('published')==='false'?'selected':''}>Ẩn khỏi website</option></select></div></div>`;}
function mediaFields(images){return `<div class="field"><label>Ảnh đang có từ sản phẩm</label><div class="image-source">${images.length?images.map((image,index)=>`<label><input type="radio" name="primary_image" value="${escapeHtml(image)}" ${sourceValue('primary_image')===image||(!sourceValue('primary_image')&&index===0)?'checked':''}><img src="${escapeHtml(image)}" alt="Ảnh sản phẩm"></label>`).join(''):'<p class="small">Sản phẩm chưa có ảnh nguồn.</p>'}</div></div><div class="upload"><input type="file" data-upload accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"><button class="button outline" type="button" data-upload-button>Tải ảnh/video mới</button><span class="small">Tải từ máy tính; file sẽ vào thư viện nội dung website.</span></div><div class="field"><label>Video giới thiệu</label><input name="video_url" value="${escapeHtml(sourceValue('video_url') || current().video)}" placeholder="Sau khi tải lên, đường dẫn sẽ được điền tự động"></div>`;}
function variantFields(){const currentVariants=current().variants||[];return `<div class="field"><label>Phân loại / lựa chọn</label><textarea name="variants" placeholder="Mỗi dòng là một phân loại, ví dụ: Màu: Trắng">${escapeHtml(sourceValue('variants') || currentVariants.map(v=>v.name||v.sku).filter(Boolean).join('\n'))}</textarea><small class="small">Phân loại nguồn đang có: ${currentVariants.length?escapeHtml(currentVariants.map(v=>v.name||v.sku).join(', ')):'Chưa có dữ liệu phân loại từ kho.'}</small></div><div class="field"><label>Giá hiển thị (không ghi giá sàn)</label><input name="display_price" inputmode="numeric" value="${escapeHtml(sourceValue('display_price') || current().price || '')}" placeholder="Để trống để đọc giá từ kho"></div>`;}
function descriptionFields(){return `<div class="field"><label>Mô tả ngắn</label><textarea name="short_description">${escapeHtml(sourceValue('short_description'))}</textarea></div><div class="field"><label>Mô tả chi tiết</label><textarea name="description">${escapeHtml(sourceValue('description') || current().description)}</textarea><small class="small">Nội dung nguồn đã nạp sẵn để bạn điều chỉnh, không phải một form sản phẩm trống.</small></div>`;}

function preview(){const product=current();if(!product)return '';const title=sourceValue('display_title')||product.name;const image=sourceValue('primary_image')||product.image;const price=sourceValue('display_price')||product.price;return `<aside class="card preview"><h2>Tóm tắt đang chỉnh</h2><div class="preview-card">${image?`<img src="${escapeHtml(image)}" alt="">`:''}<p class="eyebrow">Bản xem trước</p><h3>${escapeHtml(title)}</h3><div class="preview-price">${money(price)}</div><p class="small">${escapeHtml(sourceValue('category')||product.category||'Chưa có danh mục')}</p><p class="small">Dữ liệu nguồn: chỉ đọc<br>SKU: ${escapeHtml(product.sku||'Chưa có')}</p></div></aside>`;}

function dashboard(){return `<section class="card dashboard"><span class="eyebrow">Quản trị nội dung website</span><h2>Chào ${escapeHtml(state.user?.email || '')}</h2><p>Chỉnh banner, nội dung hiển thị và thông tin website. Khu vực này không chứa quản lý đơn hàng, sản phẩm sàn, tồn kho, báo cáo hoặc quảng cáo.</p><div class="stats"><div class="stat"><span>Sản phẩm có thể chỉnh nội dung</span><b>${state.products.length}</b></div><div class="stat"><span>Banner website</span><b>${state.banners.length}</b></div><div class="stat"><span>Ảnh/Video nội dung</span><b>${state.media.length}</b></div></div></section>`;}

function productOptions(sourceId = '') { return `<option value="">Không gắn sản phẩm</option>${state.products.map((product) => `<option value="${escapeHtml(product.id)}" ${product.id===sourceId?'selected':''}>${escapeHtml(product.name)}</option>`).join('')}`; }
function bannerPage(){return `<section class="card dashboard"><div class="form-heading"><div><span class="eyebrow">Banner trang chủ</span><h2>Ảnh bán hàng, slogan và thông tin uy tín</h2><p>Mỗi banner có ảnh desktop/mobile riêng, gắn với đúng sản phẩm đang có trong website và dẫn khách tới sản phẩm đó.</p></div><button class="button outline" data-banner-add>Thêm banner</button></div><form data-banners>${state.banners.length?state.banners.map((banner,index)=>`<section class="card" data-banner style="padding:18px;margin-top:14px"><div class="form-heading"><h2>Banner ${index+1}</h2><button class="button outline" type="button" data-banner-remove="${index}">Bỏ banner</button></div><div class="grid-two"><div class="field"><label>Tiêu đề</label><input name="title" value="${escapeHtml(banner.title)}" placeholder="Ví dụ: Đồ gia dụng tiện ích"></div><div class="field"><label>Dòng nhấn</label><input name="accent" value="${escapeHtml(banner.accent)}" placeholder="Ví dụ: Giá tốt mỗi ngày"></div><div class="field"><label>Sản phẩm liên kết</label><select name="source_id">${productOptions(banner.source_id)}</select></div><div class="field"><label>Trạng thái</label><select name="enabled"><option value="true" ${banner.enabled!==false?'selected':''}>Đang hiển thị</option><option value="false" ${banner.enabled===false?'selected':''}>Tạm ẩn</option></select></div><div class="field"><label>Ảnh desktop</label><input name="desktop_image" value="${escapeHtml(banner.desktop_image)}" placeholder="Tải ảnh từ máy hoặc dán URL ảnh thư viện"></div><div class="field"><label>Ảnh mobile</label><input name="mobile_image" value="${escapeHtml(banner.mobile_image)}" placeholder="Tải ảnh dọc riêng cho mobile"></div></div><div class="field"><label>Thông điệp phụ</label><textarea name="description" placeholder="Nêu rõ nhóm sản phẩm shop đang chuyên bán và lợi ích khách nhận được.">${escapeHtml(banner.description)}</textarea></div><input type="hidden" name="id" value="${escapeHtml(banner.id||'')}"><input type="hidden" name="sort_order" value="${index+1}"><div class="upload"><input type="file" data-banner-file="${index}" accept="image/png,image/jpeg,image/webp"><span class="small">Chọn ảnh từ máy để tải vào thư viện, sau đó URL được điền vào ảnh desktop.</span></div></section>`).join(''):'<div class="empty">Chưa có banner. Hãy thêm banner có ảnh thật và gắn với sản phẩm đang bán.</div>'}<div class="form-actions"><button class="button primary" type="submit">Lưu banner</button></div></form></section>`;}
function settingsPage(){return `<section class="card dashboard"><span class="eyebrow">Thông tin website</span><h2>Menu &amp; thông tin liên hệ</h2><p>Thông tin này xuất hiện ở header, banner và footer website; không liên quan đến thông tin sàn.</p><form data-settings class="grid-two"><div class="field"><label>Tên thương hiệu</label><input name="brand_name" value="${escapeHtml(state.settings.brand_name||'SHOP HUY VÂN')}"></div><div class="field"><label>Slogan</label><input name="slogan" value="${escapeHtml(state.settings.slogan||'Đồ gia dụng tiện ích, giá tốt mỗi ngày')}"></div><div class="field"><label>Địa chỉ</label><input name="address" value="${escapeHtml(state.settings.address||'')}"></div><div class="field"><label>Hotline</label><input name="hotline" value="${escapeHtml(state.settings.hotline||'')}"></div><div class="field"><label>Zalo</label><input name="zalo" value="${escapeHtml(state.settings.zalo||'')}"></div><div class="form-actions" style="align-items:end"><button class="button primary" type="submit">Lưu thông tin website</button></div></form></section>`;}
function mediaPage(){return `<section class="card dashboard"><div class="form-heading"><div><span class="eyebrow">Thư viện nội dung</span><h2>Ảnh và video đã tải từ máy</h2><p>Chỉ media thực đã tải lên API mới hiển thị tại đây.</p></div></div>${state.media.length?`<div class="image-source">${state.media.map(item=>`<a href="${escapeHtml(item.url)}" target="_blank"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.filename)}"></a>`).join('')}</div>`:'<div class="empty">Chưa có ảnh hoặc video trong thư viện.</div>'}</section>`;}

function passwordPage(){return `<section class="card dashboard"><span class="eyebrow">Bảo mật tài khoản</span><h2>Đổi mật khẩu quản trị</h2><p>Mật khẩu mới phải có ít nhất 12 ký tự. Sau khi đổi, bạn đăng nhập lại bằng mật khẩu mới.</p><form data-password class="password-form"><div class="field"><label>Mật khẩu hiện tại</label><input name="old_password" type="password" autocomplete="current-password" required></div><div class="field"><label>Mật khẩu mới</label><input name="new_password" type="password" autocomplete="new-password" minlength="12" required></div><div class="field"><label>Nhập lại mật khẩu mới</label><input name="confirm_password" type="password" autocomplete="new-password" minlength="12" required></div><div class="form-actions"><button class="button primary" type="submit">Đổi mật khẩu</button></div></form></section>`;}

function appView(){const body=state.page==='products'?`<section class="editor">${productList()}${editor()}${preview()}</section>`:state.page==='banners'?bannerPage():state.page==='menus'?settingsPage():state.page==='media'?mediaPage():state.page==='password'?passwordPage():dashboard();const title=state.page==='products'?'Sản phẩm website':state.page==='banners'?'Banner':state.page==='menus'?'Menu & thông tin':state.page==='media'?'Thư viện ảnh':state.page==='password'?'Đổi mật khẩu':'Tổng quan nội dung';return `<div class="app shell"><aside class="aside"><div class="aside-brand">SHOP HUY VÂN<span>QUẢN TRỊ NỘI DUNG WEBSITE</span></div><div class="user">${escapeHtml(state.user?.email||'')}</div><nav class="nav"><button class="${state.page==='overview'?'active':''}" data-page="overview">Tổng quan</button><button class="${state.page==='banners'?'active':''}" data-page="banners">Banner</button><button class="${state.page==='products'?'active':''}" data-page="products">Sản phẩm website</button><button class="${state.page==='menus'?'active':''}" data-page="menus">Menu &amp; thông tin</button><button class="${state.page==='media'?'active':''}" data-page="media">Thư viện ảnh</button></nav></aside><main class="main"><header class="topbar"><h1>${title}</h1><div class="top-actions"><button class="button outline" data-page="password">Đổi mật khẩu</button><button class="button outline" data-logout>Đăng xuất</button></div></header><div class="workspace">${body}</div></main></div>`;}

function render(){root.innerHTML=state.user?appView():loginView();bind();}
function toast(message){const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),3000)}
function bindProductItems(){root.querySelectorAll('[data-product]').forEach(button=>button.addEventListener('click',()=>selectProduct(button.dataset.product)));}
function bind(){root.querySelector('[data-login]')?.addEventListener('submit',async(event)=>{event.preventDefault();const form=new FormData(event.currentTarget);try{const result=await request('/v1/session',{method:'POST',body:JSON.stringify({email:form.get('email'),password:form.get('password')})});state.session=result.token;state.user=result.user;sessionStorage.setItem('shv-content-token',state.session);render();await hydrateAdmin()}catch(error){root.querySelector('[data-login-error]').textContent='Không thể đăng nhập. Kiểm tra tài khoản hoặc API quản trị mới.'}});root.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>{state.page=button.dataset.page;render()}));root.querySelector('[data-logout]')?.addEventListener('click',()=>{state.session='';state.user=null;sessionStorage.removeItem('shv-content-token');render()});bindProductItems();root.querySelector('[data-product-filter]')?.addEventListener('input',()=>{const value=document.querySelector('[data-product-filter]').value;const holder=document.querySelector('.product-items');const q=value.toLocaleLowerCase('vi');holder.innerHTML=state.products.filter(p=>`${p.name} ${p.sku}`.toLocaleLowerCase('vi').includes(q)).map(p=>`<button class="product-item ${current()?.id===p.id?'active':''}" data-product="${escapeHtml(p.id)}">${p.image?`<img src="${escapeHtml(p.image)}" alt="">`:''}<span><b>${escapeHtml(p.name)}</b><span>${escapeHtml(p.sku)}</span></span></button>`).join('');bindProductItems()});root.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{state.tab=button.dataset.tab;render()}));root.querySelector('[data-reset]')?.addEventListener('click',()=>{delete state.overrides[current().id];render()});root.querySelector('[data-product-form]')?.addEventListener('submit',saveProduct);root.querySelector('[data-upload-button]')?.addEventListener('click',uploadMedia);root.querySelector('[data-banner-add]')?.addEventListener('click',()=>{state.banners.push({enabled:true,sort_order:state.banners.length+1});render()});root.querySelectorAll('[data-banner-remove]').forEach(button=>button.addEventListener('click',()=>{state.banners.splice(Number(button.dataset.bannerRemove),1);render()}));root.querySelector('[data-banners]')?.addEventListener('submit',saveBanners);root.querySelectorAll('[data-banner-file]').forEach(input=>input.addEventListener('change',()=>uploadBanner(input)));root.querySelector('[data-settings]')?.addEventListener('submit',saveSettings);root.querySelector('[data-password]')?.addEventListener('submit',changePassword)}
async function uploadMedia(){const input=root.querySelector('[data-upload]');const file=input?.files?.[0];if(!file)return toast('Hãy chọn ảnh hoặc video từ máy tính.');try{const data=new FormData();data.append('file',file);const result=await request('/v1/media',{method:'POST',body:data});const video=root.querySelector('[name="video_url"]');if(video&&result.item?.url)video.value=result.item.url;toast('Đã tải file vào thư viện nội dung.')}catch(error){toast('Chưa tải được file. API media cần được deploy và cấu hình R2 mới.') }}
async function saveProduct(event){event.preventDefault();const form=new FormData(event.currentTarget);const item={};for(const [key,value]of form.entries())item[key]=key==='published'?value==='true':value;try{const result=await request(`/v1/site/products/${encodeURIComponent(current().id)}`,{method:'PUT',body:JSON.stringify(item)});state.overrides[current().id]=result.item||item;render();toast('Đã lưu nội dung hiển thị riêng trên website.')}catch(error){toast('Chưa lưu được. Kiểm tra API quản trị mới.')}}
async function uploadBanner(input){const file=input.files?.[0];if(!file)return;try{const data=new FormData();data.append('file',file);const result=await request('/v1/media',{method:'POST',body:data});const index=Number(input.dataset.bannerFile);state.banners[index].desktop_image=result.item.url;await loadAdminContent();render();toast('Đã tải ảnh banner. Bạn có thể chọn ảnh mobile riêng nếu cần.')}catch(error){toast('Chưa tải được ảnh banner. Kiểm tra cấu hình R2 của API nội dung.')}}
async function saveBanners(event){event.preventDefault();const rows=[...root.querySelectorAll('[data-banner]')].map((row)=>{const form=new FormData(row);const item={};for(const [key,value]of form.entries())item[key]=key==='enabled'?value==='true':value;return item});try{const result=await request('/v1/site/banners',{method:'PUT',body:JSON.stringify({items:rows})});state.banners=result.items||[];render();toast('Đã lưu banner website.')}catch(error){toast('Chưa lưu được banner. Kiểm tra API nội dung mới.')}}
async function saveSettings(event){event.preventDefault();const form=new FormData(event.currentTarget);const settings=Object.fromEntries(form.entries());try{const result=await request('/v1/site/settings',{method:'PUT',body:JSON.stringify({settings})});state.settings=result.settings||{};render();toast('Đã lưu thông tin website.')}catch(error){toast('Chưa lưu được thông tin website.')}}
async function changePassword(event){event.preventDefault();const form=new FormData(event.currentTarget);const oldPassword=String(form.get('old_password')||'');const newPassword=String(form.get('new_password')||'');if(newPassword!==String(form.get('confirm_password')||''))return toast('Nhập lại mật khẩu mới chưa khớp.');try{await request('/v1/password',{method:'PUT',body:JSON.stringify({old_password:oldPassword,new_password:newPassword})});state.session='';state.user=null;sessionStorage.removeItem('shv-content-token');render();toast('Đã đổi mật khẩu. Hãy đăng nhập lại.')}catch(error){toast('Chưa đổi được mật khẩu. Kiểm tra lại mật khẩu hiện tại.')}}
async function boot(){await loadSession();render();if(state.user)await hydrateAdmin()}
boot();
