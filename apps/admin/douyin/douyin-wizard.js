/* File: apps/admin/douyin/douyin-wizard.js */

// ==========================================
// KHÔNG IMPORT BẤT CỨ CÁI GÌ Ở ĐÂY
// ==========================================

// Hàm lấy Token chuẩn xác nhất
function getAuthToken() {
    let token = localStorage.getItem('xtoken');
    if (!token) token = localStorage.getItem('x-token');
    if (!token) token = localStorage.getItem('admin_token');
    if (!token) token = sessionStorage.getItem('xtoken');
    
    // Nếu hệ thống cũ đã có window.Admin
    if (!token && window.Admin && typeof window.Admin.token === 'function') {
        token = window.Admin.token();
    }
    return token;
}

// Hàm gọi API trực tiếp
async function callApi(endpoint, method = 'GET', body = null) {
    const token = getAuthToken();
    
    if (!token) {
        throw new Error('Không tìm thấy Token. Vui lòng đăng nhập lại Admin.');
    }

    const apiBase = 'https://api.shophuyvan.vn';
    const url = endpoint.startsWith('http') ? endpoint : `${apiBase}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers = {
        'Content-Type': 'application/json',
        'x-token': token
    };

    const options = { method, headers };
    if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
    }

    console.log(`📡 API Request: ${method} ${url}`);
    
    let res;
    try {
        res = await fetch(url, options);
    } catch (netErr) {
        // Bắt lỗi khi mạng rớt hoặc Server sập 500 không trả CORS
        console.error("Fetch Error:", netErr);
        throw new Error("Không thể kết nối Server (Lỗi CORS hoặc Server 500).");
    }

    let data;
    try {
        // Thử đọc JSON (nếu Server trả về HTML lỗi thì sẽ nhảy xuống catch)
        data = await res.json();
    } catch (jsonErr) {
        throw new Error(`Lỗi Server (${res.status}): Phản hồi không phải JSON (Có thể lỗi code 500).`);
    }
    
    // Kiểm tra logic lỗi từ API trả về
    if (!res.ok || (data && !data.ok && !data.success)) {
        throw new Error(data.error || data.message || `Lỗi Server (${res.status})`);
    }

    return data;
}

// ==========================================
// LOGIC UI WIZARD
// ==========================================

let currentVideoId = null;

// Gán hàm vào window để HTML gọi được
window.startAnalyze = async function() {
    const urlInput = document.getElementById('douyin-url');
    const url = urlInput ? urlInput.value.trim() : '';
    
    if (!url) return alert('Vui lòng nhập link Douyin/TikTok!');

    showStep(2);
    
    try {
        console.log('🚀 Đang gửi yêu cầu phân tích...');
        const res = await callApi('/api/douyin/analyze', 'POST', { url });
        
        const data = res.data || res;
        const videoId = data.video_id || (res.success ? res.data?.video_id : null);

        if (!videoId) throw new Error('Không nhận được Video ID.');

        currentVideoId = videoId;
        console.log("✅ Video ID:", currentVideoId);

        // Polling trạng thái
        const loadingStatus = document.getElementById('loading-status');
        if(loadingStatus) loadingStatus.innerText = "Gemini đang dịch nội dung...";
        
        let retryCount = 0;
        const checkStatus = async () => {
            try {
                const statusRes = await callApi(`/api/douyin/${currentVideoId}`, 'GET');
                if (statusRes && statusRes.data) {
                    const d = statusRes.data;
                    if (d.status === 'waiting_approval' || (d.ai_analysis && d.ai_analysis.scripts)) {
                        const scripts = d.ai_analysis?.scripts || [];
                        if (scripts.length > 0) {
                            renderScripts(scripts);
                            if (d.ai_analysis.product_name) {
                                document.getElementById('product-name').innerText = d.ai_analysis.product_name;
                            }
                            showStep(3);
                            return; 
                        }
                    }
                }
            } catch (err) { console.warn('Polling...', err.message); retryCount++; }
            
            if (retryCount > 30) {
                alert('Quá thời gian chờ. Thử lại sau.');
                showStep(1);
                return;
            }
            setTimeout(checkStatus, 2000);
        };
        setTimeout(checkStatus, 2000);

    } catch (e) {
        console.error(e);
        alert('Lỗi: ' + e.message);
        showStep(1);
    }
};

function renderScripts(scripts) {
    const container = document.getElementById('script-options');
    if (!container) return;
    container.innerHTML = scripts.map((s, idx) => `
        <div class="border border-gray-200 p-4 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all" 
             onclick="selectScript(this, \`${(s.text || '').replace(/`/g, "\\`").replace(/"/g, "&quot;")}\`)">
            <div class="font-bold text-sm text-blue-600 mb-2 flex justify-between">
                <span>${s.style || 'Kịch bản ' + (idx+1)}</span>
                <span class="text-xs bg-gray-100 text-gray-500 rounded">v${s.version || idx+1}</span>
            </div>
            <div class="text-sm text-gray-700 leading-relaxed">${s.text || ''}</div>
        </div>
    `).join('');
    const firstOption = container.firstElementChild;
    if (firstOption) selectScript(firstOption, scripts[0].text);
}

window.selectScript = function(el, text) {
    document.querySelectorAll('#script-options > div').forEach(div => {
        div.classList.remove('bg-blue-50', 'border-blue-500', 'ring-1', 'ring-blue-500');
        div.classList.add('border-gray-200');
    });
    if (el) {
        el.classList.remove('border-gray-200');
        el.classList.add('bg-blue-50', 'border-blue-500', 'ring-1', 'ring-blue-500');
    }
    document.getElementById('final-script').value = text;
}

window.showStep = function(stepNum) {
    document.querySelectorAll('.wizard-step').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`step-${stepNum}`);
    if (target) target.classList.remove('hidden');
    
    // Update UI Progress bar (giữ nguyên logic cũ của bạn)
    document.querySelectorAll('[id$="-ind"]').forEach(el => {
        el.className = "flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-gray-400";
        const badge = el.querySelector('span');
        if(badge) badge.className = "w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center font-bold";
    });
    const activeInd = document.getElementById(`step-${stepNum}-ind`);
    if (activeInd) {
        activeInd.className = "flex items-center gap-2 border-b-2 px-4 py-2 step-active text-blue-600 border-blue-600";
        const badge = activeInd.querySelector('span');
        if(badge) badge.className = "w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold";
    }
}

window.goToStep4 = () => alert('Đã chốt kịch bản! Tiếp theo sẽ làm phần TTS...');