/* File: apps/admin/douyin/douyin-wizard.js */

// Hàm load script thủ công
async function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        
        // Thử các đường dẫn tương đối và tuyệt đối
        const paths = [
            src, 
            `../${src}`, 
            `../../${src}`,
            `/_shared/${src}`
        ];
        
        // Hàm đệ quy để thử từng path
        const tryPath = (index) => {
            if (index >= paths.length) {
                return reject(new Error(`Không thể tải file: ${src}`));
            }
            
            const s = document.createElement('script');
            s.src = paths[index];
            s.onload = () => {
                console.log(`✅ Loaded: ${paths[index]}`);
                resolve();
            };
            s.onerror = () => {
                s.remove(); // Xóa thẻ lỗi
                tryPath(index + 1); // Thử path tiếp theo
            };
            document.head.appendChild(s);
        };
        
        tryPath(0);
    });
}

// ✅ FIX: Tự tạo môi trường Admin giả lập (Polyfill)
function ensureAdminEnv() {
    if (!window.Admin) {
        console.log('🛠️ Creating Admin Polyfill...');
        window.Admin = {
            // Lấy token từ localStorage (Thử các key phổ biến)
            token: () => {
                return localStorage.getItem('admin_token') || 
                       localStorage.getItem('token') || 
                       sessionStorage.getItem('admin_token') || '';
            },
            // Hàm gọi API chuẩn (Thay thế admin-core.js)
            req: async (url, method = 'GET', body = null) => {
                const token = window.Admin.token();
                const headers = {
                    'Content-Type': 'application/json',
                    'x-token': token,
                    'Authorization': token ? `Bearer ${token}` : ''
                };

                // Xử lý URL (nếu chưa có domain)
                const apiBase = 'https://api.shophuyvan.vn';
                const fullUrl = url.startsWith('http') ? url : `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;

                const opts = { method, headers };
                if (body && method !== 'GET') {
                    opts.body = JSON.stringify(body);
                }

                const res = await fetch(fullUrl, opts);
                const data = await res.json();
                
                // Chuẩn hóa lỗi
                if (!res.ok && !data.ok && !data.success) {
                    throw new Error(data.error || data.message || `Lỗi API (${res.status})`);
                }
                
                return data;
            },
            toast: (msg) => console.log('Toast:', msg)
        };
    }
}

// Hàm lấy API Admin
async function getAdminApi() {
    // 1. Tạo môi trường Admin giả lập trước
    ensureAdminEnv();

    // 2. Load utils-admin.js (Optional - giúp tránh lỗi dependency)
    try { await loadScript('_shared/utils-admin.js'); } catch(e) {}

    // 3. Load api-admin.js (Quan trọng nhất)
    if (!window.SHARED || !window.SHARED.api) {
        console.log('⏳ Loading api-admin.js...');
        await loadScript('_shared/api-admin.js');
    }

    if (!window.SHARED || !window.SHARED.api) {
        throw new Error('Không thể tải window.SHARED.api. Kiểm tra lại kết nối mạng.');
    }

    const api = window.SHARED.api;

    // 4. Vá lỗi hàm post/get nếu api-admin.js chưa có
    if (!api.post) {
        api.post = async (url, body) => window.Admin.req(url, 'POST', body);
    }
    if (!api.get) {
        api.get = async (url) => window.Admin.req(url, 'GET');
    }

    return api;
}

let currentVideoId = null;

window.startAnalyze = async function() {
    const urlInput = document.getElementById('douyin-url');
    const url = urlInput ? urlInput.value.trim() : '';
    
    if (!url) return alert('Vui lòng nhập link!');

    // Chuyển sang Step 2
    showStep(2);
    
    try {
        // Lấy API (đã được vá lỗi)
        const api = await getAdminApi();

        // 1. Gọi API Analyze
        console.log('🚀 Sending request to:', '/api/douyin/analyze');
        const res = await api.post('/api/douyin/analyze', { url });
        
        // Kiểm tra kết quả trả về (Hỗ trợ nhiều chuẩn response)
        const data = res.data || res;
        const videoId = data.video_id || (res.success ? res.data?.video_id : null);

        if (!videoId) {
            console.error('API Response:', res);
            throw new Error(res.error || res.message || 'Không nhận được Video ID từ server');
        }

        currentVideoId = videoId;
        console.log("✅ Video ID:", currentVideoId);

        // 2. Polling trạng thái (Check mỗi 2 giây)
        const loadingStatus = document.getElementById('loading-status');
        if(loadingStatus) loadingStatus.innerText = "Gemini đang dịch nội dung...";
        
        let retryCount = 0;
        const checkStatus = async () => {
            try {
                const statusRes = await api.get(`/api/douyin/${currentVideoId}`);
                console.log('Polling status:', statusRes);
                
                if (statusRes && statusRes.data) {
                    const data = statusRes.data;
                    
                    // Nếu đã có kết quả phân tích
                    if (data.status === 'waiting_approval' || (data.ai_analysis && data.ai_analysis.scripts)) {
                        const scripts = data.ai_analysis?.scripts || [];
                        if (scripts.length > 0) {
                            renderScripts(scripts);
                            
                            // Fill data vào preview
                            if (data.ai_analysis.product_name) {
                                const prodNameEl = document.getElementById('product-name');
                                if(prodNameEl) prodNameEl.innerText = data.ai_analysis.product_name;
                            }
                            
                            showStep(3);
                            return; // Dừng polling
                        }
                    }
                }
            } catch (err) {
                console.warn('Polling error:', err);
                retryCount++;
            }
            
            // Dừng nếu thử quá 30 lần (60s)
            if (retryCount > 30) {
                alert('Quá thời gian chờ phản hồi từ AI. Vui lòng thử lại.');
                showStep(1);
                return;
            }

            // Tiếp tục check sau 2s
            setTimeout(checkStatus, 2000);
        };
        
        setTimeout(checkStatus, 2000);

    } catch (e) {
        console.error(e);
        alert('Lỗi: ' + (e.message || JSON.stringify(e)));
        showStep(1);
    }
};

function renderScripts(scripts) {
    const container = document.getElementById('script-options');
    if (!container) return;

    container.innerHTML = scripts.map((s, idx) => `
        <div class="border border-gray-200 p-4 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all" onclick="selectScript(this, \`${(s.text || '').replace(/`/g, "\\`").replace(/"/g, "&quot;")}\`)">
            <div class="font-bold text-sm text-blue-600 mb-2 flex justify-between">
                <span>${s.style || 'Kịch bản ' + (idx+1)}</span>
                <span class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">v${s.version || idx+1}</span>
            </div>
            <div class="text-sm text-gray-700 leading-relaxed">${s.text || ''}</div>
        </div>
    `).join('');
    
    // Auto select first option
    const firstOption = container.firstElementChild;
    if (firstOption) selectScript(firstOption, scripts[0].text);
}

window.selectScript = function(el, text) {
    // Highlight UI
    document.querySelectorAll('#script-options > div').forEach(div => {
        div.classList.remove('bg-blue-50', 'border-blue-500', 'ring-1', 'ring-blue-500');
        div.classList.add('border-gray-200');
    });
    
    if (el) {
        el.classList.remove('border-gray-200');
        el.classList.add('bg-blue-50', 'border-blue-500', 'ring-1', 'ring-blue-500');
    }

    // Set value
    const textarea = document.getElementById('final-script');
    if (textarea) textarea.value = text;
}

function showStep(stepNum) {
    document.querySelectorAll('.wizard-step').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`step-${stepNum}`);
    if (target) target.classList.remove('hidden');
    
    // Update Header Progress
    document.querySelectorAll('[id$="-ind"]').forEach(el => {
        el.classList.remove('step-active', 'text-blue-600', 'border-blue-600');
        el.classList.add('border-transparent', 'text-gray-400');
        const badge = el.querySelector('span');
        if(badge) badge.className = "w-6 h-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center font-bold";
    });

    const activeInd = document.getElementById(`step-${stepNum}-ind`);
    if (activeInd) {
        activeInd.classList.add('step-active', 'text-blue-600', 'border-blue-600');
        activeInd.classList.remove('border-transparent', 'text-gray-400');
        const badge = activeInd.querySelector('span');
        if(badge) badge.className = "w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold";
    }
}

// Expose functions globally
window.showStep = showStep;
window.goToStep4 = () => alert('Đã chốt kịch bản! Tiếp theo sẽ làm phần TTS...');