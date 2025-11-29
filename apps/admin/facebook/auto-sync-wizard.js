// ===================================================================
// auto-sync-wizard.js - Auto Video Sync Wizard Module
// Tách từ ads_real.js để dễ bảo trì
// Version: 2.0
// ===================================================================

(function() {
  'use strict';

  const API = (window.Admin && Admin.getApiBase && Admin.getApiBase()) || 'https://api.shophuyvan.vn';

  // Utility functions (Shared với ads_real.js)
  function toast(msg) {
    if (window.Admin && Admin.toast) {
      Admin.toast(msg);
    } else {
      alert(msg);
    }
  }
  
      // ============================================================
    // AUTO SYNC WIZARD LOGIC (New Module)
    // ============================================================
    const AutoSyncWizard = {
        currentStep: 1,
        jobData: {
            id: null, productId: null, videoUrl: null, variants: [], fanpages: []
        },
     
     init: function() {
            console.log('Wizard Init');
            this.loadWizardProducts();
        },
     
        // HÀM CHECK AI MỚI
        testAI: async function() {
            const btn = event.target;
            const oldText = btn.innerText;
            btn.disabled = true;
            btn.innerText = "⏳ Checking...";
     
            try {
                const r = await Admin.req('/api/auto-sync/test-ai', { method: 'GET' });
                if (r.ok) {
                    alert(`✅ KẾT NỐI THÀNH CÔNG!\n\nGemini phản hồi: "${r.message}"`);
                } else {
                    alert(`❌ LỖI KẾT NỐI:\n${r.error}`);
                }
            } catch (e) {
                alert('❌ Lỗi hệ thống: ' + e.message);
            } finally {
                btn.disabled = false;
                btn.innerText = oldText;
            }
        },
     
        goToStep: function(step) {
        // Chặn nếu chưa có Job ID (chưa upload xong) mà muốn qua bước 3
        if (step > 2 && !this.jobData.id) {
            alert("⚠️ Vui lòng tải video lên hoặc nhập link TikTok và bấm nút 'Tải/Upload' trước!");
            return;
        }

        // UI Switching
            document.querySelectorAll('.wiz-content').forEach(el => el.classList.remove('active'));
            document.getElementById(`wiz-step-${step}`).classList.add('active');
            
            // Indicators
            for(let i=1; i<=5; i++) {
                const el = document.getElementById(`wiz-step-${i}-ind`);
                if(i < step) el.className = 'wizard-step completed';
                else if(i === step) el.className = 'wizard-step active';
                else el.className = 'wizard-step';
            }
            
            this.currentStep = step;
            
            // Logic Trigger
        if(step === 2) {
             // Đảm bảo DOM đã load xong mới render UI
             setTimeout(() => this.renderUploadUI(), 100); 
        }
        if(step === 3 && this.jobData.variants.length === 0) this.generateVariants();
        if(step === 4) this.loadFanpages(); // Đây là hàm loadFanpages của Wizard (Review Content)
    },

    // HÀM MỚI: Vẽ giao diện Upload File
    renderUploadUI: function() {
        const container = document.querySelector('#wiz-step-2 .card-body') || document.querySelector('#wiz-step-2');
        if(!container) return;

        // Kiểm tra nếu đã chèn rồi thì thôi
        if(document.getElementById('wiz-upload-container')) return;

        // Tạo vùng upload
        const uploadDiv = document.createElement('div');
        uploadDiv.id = 'wiz-upload-container';
        uploadDiv.style.marginTop = '20px';
        uploadDiv.style.paddingTop = '20px';
        uploadDiv.style.borderTop = '1px dashed #eee';
        uploadDiv.innerHTML = `
            <div style="font-weight:bold; margin-bottom:10px; color:#666;">HOẶC: Tải video từ máy tính</div>
            <div style="display:flex; gap:10px; align-items:center;">
                <input type="file" id="wiz-file-upload" accept="video/*" class="input" style="flex:1;">
                <button class="btn primary" onclick="AutoSyncWizard.processVideo()">⬆️ Upload Ngay</button>
            </div>
            <div style="font-size:12px; color:#999; margin-top:5px;">Max: 100MB (MP4)</div>
        `;
        
        // Chèn vào sau ô nhập link TikTok
        const inputUrl = document.getElementById('wiz-tiktokUrl');
        if(inputUrl && inputUrl.parentElement) {
            inputUrl.parentElement.after(uploadDiv);
        }
    },

    // STEP 1: Tải sản phẩm (Đổi tên để tránh trùng với hàm loadProducts bên ngoài)
    loadWizardProducts: async function(keyword = '', page = 1) {
        const grid = document.getElementById('wiz-product-grid');
        if (!grid) return;
        
        // Hiển thị loading
        grid.innerHTML = '<div class="loading">⏳ Đang tải...</div>';
        
        try {
            // Xây dựng URL tìm kiếm
            // Backend products.js dùng ?search= cho tìm kiếm và ?page= cho phân trang
            let url = `/admin/products?limit=20&page=${page}`;
            
            if (keyword) {
                url += `&search=${encodeURIComponent(keyword)}`;
            }

            console.log('[Wizard] Fetching products:', url);

            // Gọi API
            const r = await Admin.req(url, { method: 'GET' });
            
            // Xử lý dữ liệu trả về
            const list = r.items || r.products || r.data || [];
            const total = r.pagination?.total || r.total || 0;
            const totalPages = r.pagination?.totalPages || Math.ceil(total / 20) || 1;

            if (r.ok && list.length > 0) {
                this.renderProducts(list);
                this.renderPagination(page, totalPages, keyword);
            } else {
                grid.innerHTML = '<div style="text-align:center; padding:40px; color:#666;">🔍 Không tìm thấy sản phẩm nào phù hợp.</div>';
                // Xóa phân trang nếu không có kết quả
                const pag = document.getElementById('wiz-pagination');
                if(pag) pag.innerHTML = '';
            }
        } catch(e) { 
            console.error(e);
            grid.innerHTML = `<div style="color:red; text-align:center; padding:20px;">Lỗi tải sản phẩm: ${e.message}</div>`; 
        }
    },

    // Hàm hiển thị phân trang (Mới thêm)
    renderPagination: function(currentPage, totalPages, keyword) {
        let container = document.getElementById('wiz-pagination');
        if (!container) {
            // Tạo container nếu chưa có
            container = document.createElement('div');
            container.id = 'wiz-pagination';
            container.style.cssText = 'display:flex; justify-content:center; gap:10px; margin-top:15px; align-items:center;';
            document.getElementById('wiz-product-grid').after(container);
        }

        const prevDisabled = currentPage <= 1 ? 'disabled' : '';
        const nextDisabled = currentPage >= totalPages ? 'disabled' : '';

        container.innerHTML = `
            <button class="btn btn-sm" ${prevDisabled} onclick="AutoSyncWizard.loadWizardProducts('${keyword}', ${currentPage - 1})">← Trước</button>
            <span style="font-size:13px; color:#666;">Trang ${currentPage} / ${totalPages}</span>
            <button class="btn btn-sm" ${nextDisabled} onclick="AutoSyncWizard.loadWizardProducts('${keyword}', ${currentPage + 1})">Sau →</button>
        `;
    },

    renderProducts: function(list) {
        const grid = document.getElementById('wiz-product-grid');
        grid.innerHTML = list.map(p => {
            // 1. Xử lý ảnh: Hỗ trợ cả dạng mảng và dạng chuỗi JSON từ Database
            let img = '/placeholder.jpg';
            if (p.images) {
                try {
                    const parsed = typeof p.images === 'string' ? JSON.parse(p.images) : p.images;
                    if (parsed && parsed.length > 0) img = parsed[0];
                } catch (e) { img = p.images; }
            }

            // 2. Xử lý tên: Ưu tiên 'title' (theo DB), backup 'name'
            const title = p.title || p.name || 'Sản phẩm chưa đặt tên';

            // 3. Xử lý giá
            const price = p.variants?.[0]?.price || p.price || 0;

            return `
                <div class="wiz-card" onclick="AutoSyncWizard.selectProduct('${p.id}', this)">
                    <img src="${img}">
                    <div style="font-weight:bold; font-size:13px; margin-top:5px; height:36px; overflow:hidden;">${title}</div>
                    <div style="color:#dc2626; font-size:12px;">${new Intl.NumberFormat('vi-VN').format(price)}đ</div>
                </div>
            `;
        }).join('');
    },

    // Xử lý tìm kiếm với Debounce (chờ 500ms mới gọi API)
    filterProducts: function(keyword) {
        // Xóa timeout cũ nếu người dùng đang gõ tiếp
        if (this.searchTimeout) clearTimeout(this.searchTimeout);

       // Đặt timeout mới
        this.searchTimeout = setTimeout(() => {
            // Khi tìm kiếm mới, luôn load từ trang 1
            // ✅ FIX: Gọi đúng hàm loadWizardProducts
            this.loadWizardProducts(keyword, 1);
        }, 500);
    },

    selectProduct: function(id, el) {
        this.jobData.productId = id;
        document.querySelectorAll('.wiz-card').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        document.getElementById('wiz-btn-step1').disabled = false;
    },

    // STEP 2: Xử lý Video (TikTok hoặc Upload Local)
    processVideo: async function() {
        const urlInput = document.getElementById('wiz-tiktokUrl');
        const fileInput = document.getElementById('wiz-file-upload');
        const url = urlInput ? urlInput.value.trim() : '';
        const file = fileInput ? fileInput.files[0] : null;

        if(!url && !file) return alert('❌ Vui lòng nhập Link TikTok HOẶC chọn Video từ máy tính!');
        
        const btn = document.getElementById('wiz-btn-download');
        const originalText = btn.innerHTML;
        btn.disabled = true; 
        btn.innerHTML = '⏳ Đang xử lý...';
        
        try {
            let r;
            
            if (file) {
                // CASE 1: Upload File
                btn.innerHTML = '⏳ Đang upload video (Vui lòng chờ)...';
                const formData = new FormData();
                formData.append('productId', this.jobData.productId);
                formData.append('videoFile', file);

                // Dùng fetch trực tiếp vì Admin.req thường gửi JSON
                // ✅ FIX V2: Ưu tiên lấy từ window.Admin (Vì Widget đang báo token Xanh)
                let token = '';
                if (window.Admin && typeof window.Admin.token === 'function') {
                    token = window.Admin.token();
                }
                
                // Nếu window.Admin lỗi mới tìm về localStorage
                if (!token) token = localStorage.getItem('x-token');
                if (!token) token = localStorage.getItem('admin_token');

                console.log('[Wizard] Upload Token Length:', token ? token.length : 0);

                console.log('[Wizard] Upload Token:', token ? 'OK' : 'Missing');

                const res = await fetch(API + '/api/auto-sync/jobs/create-upload', {
                    method: 'POST',
                    headers: { 
                        'x-token': token, // Header quan trọng nhất
                        'Authorization': 'Bearer ' + token
                    },
                    body: formData,
                    credentials: 'include' // Quan trọng: Gửi kèm Cookie xác thực
                });
                r = await res.json();
            } else {
                // CASE 2: TikTok URL
                btn.innerHTML = '⏳ Đang tải từ TikTok...';
                r = await Admin.req('/api/auto-sync/jobs/create', {
                    method: 'POST',
                    body: { productId: this.jobData.productId, tiktokUrl: url }
                });
            }
            
            if(r.ok) {
                this.jobData.id = r.jobId;
                this.jobData.videoUrl = r.videoUrl;
                
                // Show preview
                const vid = document.getElementById('wiz-player');
                if(vid) vid.src = r.videoUrl;
                
                const previewDiv = document.getElementById('wiz-video-preview');
                if(previewDiv) previewDiv.style.display = 'block';
                
                const nextBtn = document.getElementById('wiz-btn-step2');
                if(nextBtn) nextBtn.disabled = false;
                
                // Ẩn inputs để tránh sửa
                if(urlInput) urlInput.disabled = true;
                if(fileInput) fileInput.disabled = true;

            } else { 
                alert('❌ Lỗi: ' + (r.error || 'Không xác định')); 
            }
        } catch(e) { 
            alert('❌ Lỗi hệ thống: ' + e.message); 
        } finally { 
            btn.disabled = false; 
            btn.innerHTML = originalText; 
        }
    },

    // STEP 3
    generateVariants: async function(force = false) {
        if(!force && this.jobData.variants.length > 0) return;
        
        document.getElementById('wiz-ai-loading').classList.remove('hidden');
        document.getElementById('wiz-ai-area').classList.add('hidden');
        
        try {
            const r = await Admin.req(`/api/auto-sync/jobs/${this.jobData.id}/generate-variants`, { method: 'POST' });
            if(r.ok) {
                this.jobData.variants = r.variants;
                this.renderVariants();
            }
        } catch(e) { alert(e.message); }
        finally {
            document.getElementById('wiz-ai-loading').classList.add('hidden');
            document.getElementById('wiz-ai-area').classList.remove('hidden');
        }
    },

    renderVariants: function() {
        const tabs = document.getElementById('wiz-ai-tabs');
        tabs.innerHTML = this.jobData.variants.map((v, i) => 
            `<div class="ai-tab ${i===0?'active':''}" onclick="AutoSyncWizard.switchVariant(${i}, this)">Version ${v.version} (${v.tone})</div>`
        ).join('');
        this.switchVariant(0, tabs.children[0]);
    },

    switchVariant: function(index, el) {
        document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
        if(el) el.classList.add('active');
        
        const v = this.jobData.variants[index];
        const captionEdit = document.getElementById('wiz-caption-edit');
        if (captionEdit) captionEdit.value = v.caption;
        
        let tags = v.hashtags;
        if(typeof tags === 'string') try { tags = JSON.parse(tags); } catch(e){}
        const hashtagsEl = document.getElementById('wiz-hashtags');
        const toneBadgeEl = document.getElementById('wiz-tone-badge');
        if (hashtagsEl) hashtagsEl.innerText = Array.isArray(tags) ? tags.join(' ') : tags;
        if (toneBadgeEl) toneBadgeEl.innerText = v.tone.toUpperCase();
        
        // Update logic: khi edit caption, cần lưu lại vào mảng variants
        document.getElementById('wiz-caption-edit').onchange = (e) => {
            this.jobData.variants[index].caption = e.target.value;
        };
    },

// STEP 4: Load Fanpages (Đã sửa lỗi cú pháp & Thêm nút Xem thử)
   // STEP 4: Review Nội dung (Có checkbox chọn phiên bản)
    loadFanpages: function() {
        const container = document.getElementById('wiz-fanpage-list');
        if (!container) return;

        // 1. Ẩn các thành phần thừa cũ
        const step4 = document.getElementById('wiz-step-4');
        if(step4) {
            const dates = step4.querySelectorAll('input[type="datetime-local"], input[type="date"]');
            dates.forEach(el => { const row = el.closest('.row'); if(row) row.style.display = 'none'; });
            const thead = step4.querySelector('thead');
            if(thead) thead.style.display = 'none';
        }

        // Render danh sách Variants
        const variants = this.jobData.variants || [];
        
        if(variants.length === 0) {
            container.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:red;">⚠️ Không có nội dung. Vui lòng quay lại Bước 3.</td></tr>`;
            return;
        }

        // Render với Checkbox
        const html = variants.map((v, i) => `
            <tr style="border-bottom: 10px solid #f9fafb;">
                <td colspan="4" style="padding: 15px; background: #fff;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <input type="checkbox" class="wiz-ver-select" id="wiz-check-${i}" data-index="${i}" checked style="width:18px; height:18px; cursor:pointer;">
                            
                            <label for="wiz-check-${i}" style="cursor:pointer; margin:0;">
                                <strong style="color:#2563eb;">Version ${v.version} (${v.tone?.toUpperCase()})</strong>
                            </label>
                        </div>
                        <span style="font-size:11px; background:#eee; padding:2px 6px; border-radius:4px;">ID: ${v.id}</span>
                    </div>
                    
                    <textarea 
                        id="wiz-area-${i}"
                        class="input" 
                        style="width:100%; height:80px; font-family:sans-serif; font-size:13px; border:1px solid #e5e7eb; border-radius:6px; padding:8px;"
                        onchange="AutoSyncWizard.updateVariantContent(${i}, this.value)"
                    >${v.caption}</textarea>
                    
                    <div style="margin-top:5px; font-size:12px; color:#666;">
                        Hashtags: <span style="color:#059669;">${Array.isArray(v.hashtags) ? v.hashtags.join(' ') : v.hashtags}</span>
                    </div>
                </td>
            </tr>
        `).join('');

        container.innerHTML = html;
        
        // Note
        const noteRow = document.createElement('tr');
        noteRow.innerHTML = `
            <td colspan="4" style="text-align:center; padding:15px; background:#f0fdf4; border-top:1px solid #dcfce7;">
                <div style="color:#15803d; font-weight:bold;">👉 Hướng dẫn: Tích chọn các Version bạn muốn dùng, sau đó bấm "Lưu vào kho".</div>
            </td>
        `;
        container.appendChild(noteRow);
    },

    // Hàm phụ trợ để cập nhật data khi user sửa text trên màn hình
    updateVariantContent: function(index, newCaption) {
        if(this.jobData.variants[index]) {
            this.jobData.variants[index].caption = newCaption;
        }
    },

    // Hàm xem trước nội dung (Đã tách ra đúng vị trí)
    showPreview: function(pageId, pageName) {
        const select = document.querySelector(`.wiz-assign-select[data-page="${pageId}"]`);
        const variantId = select ? parseInt(select.value) : 0;
        const variant = this.jobData.variants.find(v => v.id === variantId);

        if (!variant) return alert("Chưa có nội dung để xem.");

        // Check xem Modal có trong HTML chưa
        const modal = document.getElementById('previewModal');
        if(!modal) return alert('Thiếu HTML Modal Preview trong file ads.html');

        document.getElementById('previewPageName').innerText = pageName;
        
        // Xử lý hashtags
        let tags = variant.hashtags;
        if (typeof tags === 'string') try { tags = JSON.parse(tags); } catch(e){}
        const tagStr = Array.isArray(tags) ? tags.join(' ') : tags;

        document.getElementById('previewCaption').innerText = `${variant.caption}\n\n${tagStr}`;
        modal.style.display = 'flex';
    },
    // STEP 5
    renderResults: function(results) {
        const div = document.getElementById('wiz-results');
        div.innerHTML = results.map(r => `
            <div style="display:flex; justify-content:space-between; padding:10px; border:1px solid #eee; margin-bottom:5px; border-radius:6px;">
                <span>${r.fanpageName}</span>
                ${r.success 
                    ? `<a href="${r.postUrl}" target="_blank" style="color:green; font-weight:bold;">✅ Thành công</a>` 
                    : `<span style="color:red;">❌ ${r.error}</span>`}
            </div>
        `).join('');
        
        // Auto-fill campaign name
        document.getElementById('wiz-camp-name').value = `Ads Job #${this.jobData.id} - ${new Date().toLocaleDateString('vi-VN')}`;
    },

    // HÀM MỚI: Lưu các Version ĐƯỢC CHỌN vào kho
    saveToRepository: async function() {
        const btn = document.getElementById('wiz-btn-save');
        const oldText = btn ? btn.innerHTML : 'Lưu';
        
        // 1. Lọc các phiên bản được check
        const checkboxes = document.querySelectorAll('.wiz-ver-select:checked');
        if (checkboxes.length === 0) {
            alert("⚠️ Vui lòng tích chọn ít nhất 1 phiên bản để lưu!");
            return;
        }

        const selectedVariants = [];
        checkboxes.forEach(cb => {
            const idx = parseInt(cb.dataset.index);
            // Lấy nội dung mới nhất từ Textarea (đề phòng chưa onchange kịp)
            const textarea = document.getElementById(`wiz-area-${idx}`);
            const variantData = this.jobData.variants[idx];
            
            if (variantData && textarea) {
                variantData.caption = textarea.value; // Cập nhật text mới nhất
                selectedVariants.push(variantData);
            }
        });

        if(btn) { btn.disabled = true; btn.innerHTML = `⏳ Đang lưu ${selectedVariants.length} versions...`; }

        try {
            // 2. Gửi API
            const r = await Admin.req(`/api/auto-sync/jobs/${this.jobData.id}/save-pending`, {
                method: 'POST',
                body: { 
                    scheduledTime: null,
                    variants: selectedVariants // ✅ Chỉ gửi danh sách đã chọn
                }
            });

            if (r.ok) {
                if(confirm(`✅ Đã lưu thành công ${selectedVariants.length} phiên bản!\n\nBạn có muốn chuyển sang tab "Kho Nội dung" để quản lý ngay không?`)) {
                     const hubTab = document.querySelector('.tab[data-tab="fanpage-hub"]');
                     if(hubTab) hubTab.click();
                }
                // Reset về bước 1
                this.currentStep = 1;
                this.goToStep(1);
            } else {
                alert('⚠️ Lỗi: ' + (r.error || 'Unknown error'));
            }
        } catch (e) {
            alert('❌ Lỗi hệ thống: ' + e.message);
            console.error(e);
        } finally {
            if(btn) { btn.disabled = false; btn.innerHTML = oldText; }
        }
    },

    createAds: async function() {
        const name = document.getElementById('wiz-camp-name').value;
        const budget = document.getElementById('wiz-budget').value;
        
        try {
            const r = await Admin.req(`/api/auto-sync/jobs/${this.jobData.id}/create-ads`, {
                method: 'POST',
                body: { campaignName: name, dailyBudget: parseInt(budget) }
            });
            if(r.ok) alert(r.message);
            else alert(r.error);
        } catch(e) { alert(e.message); }
    }
};
		 
      // ============================================================
      // EXPORT PUBLIC API
      // ============================================================
      
      window.AutoSyncWizard = AutoSyncWizard;
    
      // Module export for ES6
      if (typeof module !== 'undefined' && module.exports) {
        module.exports = { AutoSyncWizard };
      }
    
    })();
    
    console.log('✅ auto-sync-wizard.js loaded');
    		 