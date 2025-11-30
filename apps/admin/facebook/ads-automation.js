// ads-automation.js - FACEBOOK ADS AUTOMATION (AUTO-PILOT MODE)
(function() {
  'use strict';
  
  const API = (window.Admin && Admin.getApiBase && Admin.getApiBase()) || 'https://api.shophuyvan.vn';
  const DOMAIN = 'https://shophuyvan.vn';

  function toast(msg) {
    if (window.Admin && Admin.toast) Admin.toast(msg);
    else alert(msg);
  }
  
  function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
  }
  
  function formatTime(isoStr) {
    if (!isoStr) return '--';
    const d = new Date(isoStr);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')} ${d.getDate()}/${d.getMonth()+1}`;
  }

  // ============================================================
  // 1. MODULE INPUT: WIZARD NHẬP LIỆU
  // ============================================================
  const InputWizard = {
    open() {
      document.getElementById('modal-input-wizard').style.display = 'flex';
      this.clearProduct();
      document.getElementById('wiz-video-file').value = '';
      document.getElementById('wiz-file-name').innerText = '';
    },

    close() {
      document.getElementById('modal-input-wizard').style.display = 'none';
    },

    // Tìm kiếm sản phẩm trong D1
    async searchProduct(keyword) {
      if (!keyword || keyword.length < 2) return;
      
      const list = document.getElementById('wiz-product-list');
      list.style.display = 'block';
      list.innerHTML = '<div style="padding:15px; color:#666; text-align:center;">⏳ Đang tìm kiếm...</div>';

      try {
        // ✅ FIX: Gọi đúng route API mới
        const r = await Admin.req(`/api/auto-sync/search-products?search=${keyword}&limit=5`, { method: 'GET' });
        
        if (r && r.ok && r.data && r.data.length > 0) {
          list.innerHTML = r.data.map(p => `
            <div class="product-option" onclick="InputWizard.selectProduct(${p.id}, '${p.title}', '${p.sku}', ${p.price}, '${p.image}')" style="display:flex; align-items:center; gap:10px; padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
                <img src="${p.image || '/placeholder.jpg'}" style="width:50px; height:50px; object-fit:cover; border-radius:4px; flex-shrink:0;">
                <div>
                    <div style="font-weight:600; font-size:13px; color:#1f2937; line-height:1.2;">${p.title}</div>
                    <div style="font-size:11px; color:#059669; margin-top:3px;">SKU: ${p.sku} • ${formatVND(p.price)}</div>
                </div>
            </div>
          `).join('');
        } else {
          list.innerHTML = '<div style="padding:15px; text-align:center; color:#999;">Không tìm thấy sản phẩm nào.</div>';
        }
      } catch (e) {
        console.error(e);
      }
    },

    selectProduct(id, title, sku, price, image) {
      document.getElementById('wiz-selected-product-id').value = id;
      document.getElementById('wiz-sel-name').innerText = title;
      document.getElementById('wiz-sel-link').innerText = `${DOMAIN}/san-pham/${sku || id}`; // Giả lập link
      document.getElementById('wiz-sel-img').src = image || '/placeholder.jpg';
      
      document.getElementById('wiz-selected-preview').style.display = 'flex';
      document.getElementById('wiz-product-list').style.display = 'none';
      document.getElementById('wiz-product-search').value = '';
    },

    clearProduct() {
      document.getElementById('wiz-selected-product-id').value = '';
      document.getElementById('wiz-selected-preview').style.display = 'none';
    },

    handleFileSelect(input) {
        if(input.files && input.files[0]) {
            document.getElementById('wiz-file-name').innerText = `📄 ${input.files[0].name} (${(input.files[0].size/1024/1024).toFixed(1)} MB)`;
        }
    },

   // Upload 2 bước: Stream -> Finalize (CODE CHUẨN ĐÃ FIX)
    async submit() {
      const productId = document.getElementById('wiz-selected-product-id').value;
      const fileInput = document.getElementById('wiz-video-file');
      const file = fileInput.files[0];

      if (!productId || !file) { toast('❌ Thiếu dữ liệu!'); return; }

      const btn = document.getElementById('wiz-btn-submit');
      const oldText = btn.innerHTML;
      btn.disabled = true;

      try {
        // BƯỚC 1: Lấy URL upload
        btn.innerHTML = '⏳ Đang khởi tạo...';
        const r1 = await Admin.req('/api/auto-sync/jobs/get-upload-url', {
            method: 'POST',
            body: { fileName: file.name, fileType: file.type }
        });

        if (!r1 || !r1.ok) throw new Error(r1.error || 'Không lấy được URL upload');

        // BƯỚC 2: Upload Binary trực tiếp
        const xhr = new XMLHttpRequest();
        // Dùng URL trả về từ backend
        xhr.open('PUT', API + r1.uploadUrl, true);
        
        // Lấy Token (Chỉ set 1 lần duy nhất)
        const token = (window.Admin && Admin.token) ? Admin.token : localStorage.getItem('admin_token');
        xhr.setRequestHeader('X-Token', token);
        xhr.setRequestHeader('Content-Type', file.type);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const p = Math.round((e.loaded / e.total) * 100);
                btn.innerHTML = `🚀 Đang tải lên: ${p}%`;
            }
        };

        xhr.onload = async () => {
            if (xhr.status === 200) {
                // BƯỚC 3: Xác nhận xong -> Tạo Job
                btn.innerHTML = '🤖 Đang xử lý AI (Sẽ mất khoảng 30s)...';
                
                try {
                    // Gọi API finalize
                    const r2 = await Admin.req('/api/auto-sync/jobs/finalize-upload', {
                        method: 'POST',
                        body: { productId, fileKey: r1.fileKey, fileSize: file.size }
                    });

                    if (r2 && r2.ok) {
                        // Trigger AI
                        await Admin.req(`/api/auto-sync/jobs/${r2.jobId}/generate-variants`, { method: 'POST' });
                        toast('✅ Thành công! Video đã lên.');
                        InputWizard.close();
                        FanpageManager.loadRepository();
                    } else {
                        toast('❌ Lỗi tạo Job: ' + (r2.error || 'Unknown error'));
                    }
                } catch (err) {
                    console.error(err);
                    toast('❌ Lỗi xử lý cuối: ' + err.message);
                }
            } else {
                toast('❌ Lỗi Upload: ' + xhr.statusText);
            }
            btn.disabled = false;
            btn.innerHTML = oldText;
        };

        xhr.onerror = () => { toast('❌ Lỗi mạng'); btn.disabled = false; btn.innerHTML = oldText; };
        
        xhr.send(file); // Gửi raw file

      } catch (e) {
        console.error(e);
        toast('❌ Lỗi: ' + e.message);
        btn.disabled = false;
        btn.innerHTML = oldText;
      }
    },
  };

  // ============================================================
  // 2. MODULE DASHBOARD: QUẢN LÝ & 1-CLICK AUTO
  const FanpageManager = {
    init() {
      this.loadRepository();
      // Auto refresh mỗi 30s để cập nhật thanh tiến độ
      setInterval(() => {
          if(document.getElementById('tab-autopost').style.display !== 'none') {
             this.loadRepository(); 
          }
      }, 30000);
    },

    async loadRepository() {
      const container = document.getElementById('repo-table-body');
      if (!container) return;

      try {
        const r = await Admin.req('/api/auto-sync/jobs?limit=20', { method: 'GET' });
        if (r && r.ok && r.jobs) {
           this.renderRepository(r.jobs);
        } else {
           container.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px;">Chưa có Job nào. Hãy tạo mới!</td></tr>';
        }
      } catch(e) {
         console.error(e);
      }
    },

    renderRepository(jobs) {
      const container = document.getElementById('repo-table-body');
      
      // Biến thống kê cho Widget
      let stats = { pending: 0, published: 0, failed: 0, cleanup: 0 };

      container.innerHTML = jobs.map(job => {
         const total = job.total_fanpages_assigned || 0;
         const published = job.total_posts_published || 0;
         const failed = job.total_posts_failed || 0;
         
         // Tính % tiến độ
         let percent = 0;
         if (total > 0) percent = Math.round(((published + failed) / total) * 100);

         // Xác định màu thanh tiến độ
         let barColor = '#3b82f6'; // Xanh dương (Chuẩn)
         if (failed > 0) barColor = '#ef4444'; // Đỏ (Có lỗi)
         if (percent === 100 && failed === 0) barColor = '#10b981'; // Xanh lá (Hoàn tất đẹp)

         // Xác định nút bấm
         let actionBtn = '';
         if (job.status === 'ai_generated' || job.status === 'video_uploaded') {
            actionBtn = `<button onclick="FanpageManager.oneClickAuto(${job.id})" class="btn-auto">⚡ 1-Click Auto</button>`;
         } else {
            actionBtn = `<button onclick="FanpageManager.viewLog(${job.id}, '${job.product_name}')" class="btn-log">👁️ Xem Chi tiết</button>`;
         }

         // Cộng dồn Stats
         if (job.status === 'assigned') stats.pending += (total - published - failed);
         stats.published += published;
         stats.failed += failed;

         return `
           <tr>
             <td style="padding:15px; border-bottom:1px solid #f3f4f6;">
                <div style="display:flex; align-items:center; gap:15px;">
                   <div style="width:70px; height:70px; border-radius:8px; background:#000; overflow:hidden; position:relative;">
                        <video src="${job.video_r2_url}" style="width:100%; height:100%; object-fit:cover;"></video>
                        <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:white; font-size:24px;">▶</div>
                   </div>
                   <div>
                      <div style="font-weight:700; font-size:14px; color:#111827;">${job.product_name}</div>
                      <div style="font-size:12px; color:#059669; margin-top:3px;">Link: ${job.product_url ? 'Có' : 'Chưa có'}</div>
                      <div style="font-size:11px; color:#9ca3af; margin-top:2px;">ID: ${job.id} • ${formatTime(job.created_at)}</div>
                   </div>
                </div>
             </td>
             <td style="padding:15px; border-bottom:1px solid #f3f4f6; vertical-align:middle;">
                ${total > 0 ? `
                   <div class="progress-container">
                       <div class="progress-track"><div class="progress-fill" style="width:${percent}%; background:${barColor};"></div></div>
                       <div class="progress-text">
                          <span style="color:${barColor}; font-weight:700;">${percent}%</span>
                          <span>${published}/${total} Đã đăng (${failed} Lỗi)</span>
                       </div>
                   </div>
                ` : `<span style="font-size:12px; color:#94a3b8; font-style:italic;">Chờ phân phối...</span>`}
             </td>
             <td style="padding:15px; border-bottom:1px solid #f3f4f6; vertical-align:middle;">
                <span style="font-size:11px; font-weight:700; padding:4px 10px; border-radius:20px; text-transform:uppercase; 
                   background:${job.status === 'published' ? '#d1fae5' : '#eff6ff'}; 
                   color:${job.status === 'published' ? '#047857' : '#1d4ed8'};">
                   ${job.status}
                </span>
             </td>
             <td style="padding:15px; border-bottom:1px solid #f3f4f6; text-align:center; vertical-align:middle;">
                ${actionBtn}
             </td>
           </tr>
         `;
      }).join('');
      
      this.updateStats(stats);
    },

    updateStats(stats) {
        document.querySelector('.widget-pending .number').innerText = stats.pending;
        document.querySelector('.widget-success .number').innerText = stats.published;
        document.querySelector('.widget-failed .number').innerText = stats.failed;
    },

    // ⚡ NÚT KÍCH HOẠT QUY TRÌNH TỰ ĐỘNG
    async oneClickAuto(jobId) {
        if(!confirm('⚡ Kích hoạt Phân phối Tự động?\n\n- Hệ thống sẽ chia bài cho tất cả Fanpage.\n- Tự động chọn Giờ Vàng.\n- Tự động gắn Link Mua Hàng.\n\nBạn có chắc chắn?')) return;

        toast('⏳ Đang tính toán ma trận phân phối...');
        try {
            // Gọi API backend mới tạo ở bước 1
            const r = await Admin.req(`/api/auto-sync/jobs/${jobId}/distribute`, { method: 'POST' });

            if(r && r.ok) {
                toast(`✅ Đã lên lịch thành công cho ${r.count} Fanpage!`);
                this.loadRepository(); // Refresh lại bảng
            } else {
                toast('❌ Lỗi: ' + (r.error || 'Không thể phân phối'));
            }
        } catch(e) {
            toast('❌ Lỗi hệ thống: ' + e.message);
        }
    },

    // 👁️ XEM CHI TIẾT (MONITORING)
    async viewLog(jobId, name) {
        const modal = document.getElementById('modal-monitoring');
        // Reset tiêu đề bảng để thêm cột Nội dung
        const thead = document.querySelector('#modal-monitoring thead tr');
        if(thead) {
            thead.innerHTML = `
                <th style="text-align:left; padding:10px;">Fanpage</th>
                <th style="text-align:left; padding:10px;">Thời gian đăng</th>
                <th style="text-align:left; padding:10px;">Phiên bản (Tone)</th>
                <th style="text-align:left; padding:10px; width:40%;">Nội dung Preview</th>
            `;
        }

        const tbody = document.getElementById('monitor-table-body');
        document.getElementById('monitor-job-title').innerText = `Job #${jobId} - ${name}`;
        modal.style.display = 'flex';
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">⏳ Đang tải lịch trình và nội dung...</td></tr>';

        try {
            // THÊM NÚT "ĐĂNG NGAY" VÀO TIÊU ĐỀ
        document.getElementById('monitor-job-title').innerHTML = `
            Job #${jobId} - ${name} 
            <button onclick="FanpageManager.forcePublish(${jobId})" class="btn-sm" style="background:#ef4444; color:white; border:none; padding:5px 10px; border-radius:4px; font-size:12px; cursor:pointer; margin-left:15px; font-weight:bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                ⚡ Đăng Ngay (Test Hệ Thống)
            </button>
        `;

        try {
            // Lấy danh sách Assignments kèm nội dung
            const r = await Admin.req(`/api/auto-sync/jobs/${jobId}/preview`, { method: 'GET' });
            
            if(r && r.ok && r.preview && r.preview.length > 0) {
                tbody.innerHTML = r.preview.map(row => {
                    // Xử lý hiển thị thời gian
                    const date = row.scheduledTime ? new Date(row.scheduledTime) : null;
                    const timeStr = date ? 
                        `<div style="font-weight:700; color:#2563eb;">${date.getHours()}:${String(date.getMinutes()).padStart(2,'0')}</div>
                         <div style="font-size:11px; color:#64748b;">${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}</div>` 
                        : '<span style="color:gray">Chưa lên lịch</span>';

                    // Xử lý hiển thị nội dung (Cắt ngắn nếu dài)
                    const fullCaption = (row.caption || '').replace(/\n/g, '<br>');
                    const shortCaption = (row.caption || '').substring(0, 100) + '...';
                    
                    return `
                        <tr>
                            <td style="padding:12px; border-bottom:1px solid #f1f5f9;">
                                <div style="font-weight:600; color:#1e293b;">${row.fanpageName}</div>
                                <div style="font-size:11px; color:#64748b;">ID: ${row.fanpageId}</div>
                            </td>
                            <td style="padding:12px; border-bottom:1px solid #f1f5f9;">${timeStr}</td>
                            <td style="padding:12px; border-bottom:1px solid #f1f5f9;">
                                <span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600; text-transform:uppercase;">
                                    ${row.tone || 'Mặc định'}
                                </span>
                            </td>
                            <td style="padding:12px; border-bottom:1px solid #f1f5f9; font-size:12px; line-height:1.4;">
                                <div style="color:#334155; margin-bottom:5px;">${shortCaption}</div>
                                <details style="cursor:pointer; color:#2563eb;">
                                    <summary>Xem toàn bộ</summary>
                                    <div style="margin-top:5px; padding:8px; background:#f8fafc; border-radius:4px; color:#0f172a; max-height:200px; overflow-y:auto;">
                                        ${fullCaption}
                                        <div style="margin-top:8px; color:#059669; font-weight:600;">
                                            ${(row.hashtags || []).map(t => `#${t}`).join(' ')}
                                        </div>
                                    </div>
                                </details>
                            </td>
                        </tr>
                    `;
                }).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Chưa có dữ liệu phân phối.</td></tr>';
            }
        } catch(e) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Lỗi: ${e.message}</td></tr>`;
        }
    },

    // ⚡ FORCE PUBLISH: Kích hoạt đăng ngay lập tức để kiểm tra hệ thống
    async forcePublish(jobId) {
        if(!confirm('⚠️ BẠN MUỐN ĐĂNG NGAY LẬP TỨC?\n\nHệ thống sẽ BỎ QUA lịch hẹn giờ và tiến hành đăng tất cả bài viết đang chờ của Job này lên Facebook ngay bây giờ.\n\nDùng tính năng này để kiểm tra xem Token/Video có hoạt động tốt không.\n\nNhấn OK để thực hiện.')) return;

        const btn = document.querySelector(`button[onclick="FanpageManager.forcePublish(${jobId})"]`);
        const oldText = btn ? btn.innerText : '';
        if(btn) { btn.innerText = '⏳ Đang xử lý...'; btn.disabled = true; }

        toast('🚀 Đang kích hoạt tiến trình đăng bài...');

        try {
            // Gọi API Bulk Publish (Backend đã có sẵn route này)
            const r = await Admin.req(`/api/auto-sync/jobs/${jobId}/publish`, { method: 'POST' });

            if(r && r.ok) {
                // Hiển thị kết quả chi tiết
                if (r.failedCount > 0) {
                     toast(`⚠️ Đã chạy xong: ${r.successCount} Thành công / ${r.failedCount} Thất bại. Kiểm tra bảng bên dưới để xem lỗi.`);
                } else {
                     toast(`✅ Tuyệt vời! Tất cả ${r.successCount} bài viết đã được đăng thành công.`);
                }
                
                // Refresh lại bảng để thấy trạng thái mới (Published/Failed)
                this.viewLog(jobId, '...'); 
                this.loadRepository(); 
            } else {
                toast('❌ Lỗi hệ thống: ' + (r.error || 'Unknown error'));
            }
        } catch(e) {
            toast('❌ Lỗi kết nối: ' + e.message);
        } finally {
            if(btn) { btn.innerText = oldText; btn.disabled = false; }
        }
    }
  };

  window.InputWizard = InputWizard;
  window.FanpageManager = FanpageManager;
  document.addEventListener('DOMContentLoaded', () => FanpageManager.init());

})();