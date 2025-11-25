/* File: apps/admin/douyin/douyin-wizard.js */

// ==========================================
// PHẦN 1: HÀM XỬ LÝ API & TOKEN ĐỘC LẬP
// ==========================================

// Hàm lấy Token chuẩn xác nhất
function getAuthToken() {
    // 1. Ưu tiên key bạn vừa cung cấp
    let token = localStorage.getItem('xtoken');
    
    // 2. Nếu không có, tìm các key dự phòng khác
    if (!token) token = localStorage.getItem('x-token');
    if (!token) token = localStorage.getItem('admin_token');
    if (!token) token = sessionStorage.getItem('xtoken');
    
    // 3. Nếu hệ thống cũ đã có window.Admin, thử lấy từ đó
    if (!token && window.Admin && typeof window.Admin.token === 'function') {
        token = window.Admin.token();
    }
    
    return token;
}

// Hàm gọi API trực tiếp (Thay thế api-admin.js)
async function callApi(endpoint, method = 'GET', body = null) {
    const token = getAuthToken();
    
    if (!token) {
        throw new Error('Không tìm thấy Token đăng nhập! Vui lòng đăng xuất và đăng nhập lại trang Admin.');
    }

    // Xử lý URL
    const apiBase = 'https://api.shophuyvan.vn';
    const url = endpoint.startsWith('http') ? endpoint : `${apiBase}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers = {
        'Content-Type': 'application/json',
        'x-token': token // ✅ Header quan trọng nhất để xác thực
    };

    const options = { method, headers };
    if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
    }

    console.log(`📡 API Request: ${method} ${url}`);
    
    const res = await fetch(url, options);
    
    // Xử lý lỗi 401 (Hết hạn session)
    if (res.status === 401) {
        throw new Error('Phiên đăng nhập hết hạn (401). Vui lòng F5 và đăng nhập lại.');
    }

    const data = await res.json();
    
    // Xử lý lỗi logic từ Server trả về
    if (!res.ok && !data.ok && !data.success) {
        throw new Error(data.error || data.message || `Lỗi Server (${res.status})`);
    }

    return data;
}

// ==========================================
// PHẦN 2: LOGIC WIZARD (UI/UX)
// ==========================================

let currentVideoId = null;

// Hàm bắt đầu phân tích (Gắn vào nút bấm)
window.startAnalyze = async function() {
    const urlInput = document.getElementById('douyin-url');
    const url = urlInput ? urlInput.value.trim() : '';
    
    if (!url) return alert('Vui lòng nhập link Douyin/TikTok!');

    // Chuyển sang Step 2 (Loading)
    showStep(2);
    
    try {
        // 1. Gọi API Analyze
        console.log('🚀 Đang gửi yêu cầu phân tích...');
        const res = await callApi('/api/douyin/analyze', 'POST', { url });
        
        // Lấy Video ID an toàn
        const data = res.data || res; // Support cả format {ok: true, data: ...} và {video_id: ...}
        const videoId = data.video_id || (res.success ? res.data?.video_id : null);

        if (!videoId) {
            console.error('API Response:', res);
            throw new Error('Server không trả về Video ID. Vui lòng thử lại.');
        }

        currentVideoId = videoId;
        console.log("✅ Nhận được Video ID:", currentVideoId);

        // 2. Polling trạng thái (Check mỗi 2 giây)
        const loadingStatus = document.getElementById('loading-status');
        if(loadingStatus) loadingStatus.innerText = "Gemini đang dịch nội dung...";
        
        let retryCount = 0;
        const checkStatus = async () => {
            try {
                const statusRes = await callApi(`/api/douyin/${currentVideoId}`, 'GET');
                console.log('Polling status:', statusRes);
                
                if (statusRes && statusRes.data) {
                    const d = statusRes.data;
                    
                    // Nếu đã có kết quả (Status xong HOẶC có data analysis)
                    if (d.status === 'waiting_approval' || (d.ai_analysis && d.ai_analysis.scripts)) {
                        const scripts = d.ai_analysis?.scripts || [];
                        if (scripts.length > 0) {
                            renderScripts(scripts);
                            
                            // Điền thông tin vào Preview
                            if (d.ai_analysis.product_name) {
                                const prodNameEl = document.getElementById('product-name');
                                if(prodNameEl) prodNameEl.innerText = d.ai_analysis.product_name;
                            }
                            
                            showStep(3);
                            return; // Dừng polling
                        }
                    }
                }
            } catch (err) {
                console.warn('Polling error (sẽ thử lại):', err.message);
                retryCount++;
            }
            
            // Timeout sau 60s
            if (retryCount > 30) {
                alert('Quá thời gian chờ AI xử lý. Vui lòng thử lại sau.');
                showStep(1);
                return;
            }

            // Tiếp tục check sau 2s
            setTimeout(checkStatus, 2000);
        };
        
        setTimeout(checkStatus, 2000);

    } catch (e) {
        console.error(e);
        alert('Lỗi: ' + e.message);
        showStep(1);
    }
};

// Hàm render danh sách kịch bản ra HTML
function renderScripts(scripts) {
    const container = document.getElementById('script-options');
    if (!container) return;

    container.innerHTML = scripts.map((s, idx) => `
        <div class="border border-gray-200 p-4 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all" 
             onclick="selectScript(this, \`${(s.text || '').replace(/`/g, "\\`").replace(/"/g, "&quot;")}\`)">
            <div class="font-bold text-sm text-blue-600 mb-2 flex justify-between">
                <span>${s.style || 'Kịch bản ' + (idx+1)}</span>
                <span class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">v${s.version || idx+1}</span>
            </div>
            <div class="text-sm text-gray-700 leading-relaxed">${s.text || ''}</div>
        </div>
    `).join('');
    
    // Tự động chọn kịch bản đầu tiên
    const firstOption = container.firstElementChild;
    if (firstOption) selectScript(firstOption, scripts[0].text);
}

// Hàm chọn kịch bản (Highlight UI + Set value)
window.selectScript = function(el, text) {
    document.querySelectorAll('#script-options > div').forEach(div => {
        div.classList.remove('bg-blue-50', 'border-blue-500', 'ring-1', 'ring-blue-500');
        div.classList.add('border-gray-200');
    });
    
    if (el) {
        el.classList.remove('border-gray-200');
        el.classList.add('bg-blue-50', 'border-blue-500', 'ring-1', 'ring-blue-500');
    }

    const textarea = document.getElementById('final-script');
    if (textarea) textarea.value = text;
}

// Hàm chuyển bước Wizard
function showStep(stepNum) {
    document.querySelectorAll('.wizard-step').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`step-${stepNum}`);
    if (target) target.classList.remove('hidden');
    
    // Update thanh tiến trình ở trên
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

// Export các hàm Global để HTML gọi được
window.showStep = showStep;
window.goToStep4 = () => alert('Đã chốt kịch bản! Tiếp theo sẽ làm phần TTS...');