/* File: apps/admin/douyin/douyin-wizard.js */

// Hàm load script thủ công (tránh dùng import tĩnh gây lỗi)
async function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

// Hàm lấy API Admin và tự vá lỗi thiếu hàm post/get
async function getAdminApi() {
    // 1. Đảm bảo Admin Core đã load (để có window.Admin)
    if (!window.Admin) {
        console.log('⏳ Loading admin-core.js...');
        await loadScript('../../_shared/admin-core.js');
    }

    // 2. Đảm bảo API Shared đã load
    if (!window.SHARED || !window.SHARED.api) {
        console.log('⏳ Loading api-admin.js...');
        await loadScript('../../_shared/api-admin.js');
    }

    const api = window.SHARED.api;

    // 3. ✅ VÁ LỖI: Thêm hàm get/post nếu chưa có
    // Mượn hàm window.Admin.req(url, method, body) của hệ thống cũ
    if (!api.post) {
        api.post = async (url, body) => {
            return await window.Admin.req(url, 'POST', body);
        };
    }

    if (!api.get) {
        api.get = async (url) => {
            return await window.Admin.req(url, 'GET');
        };
    }

    return api;
}

let currentVideoId = null;

window.startAnalyze = async function() {
    const urlInput = document.getElementById('douyin-url');
    const url = urlInput ? urlInput.value : '';
    
    if (!url) return alert('Vui lòng nhập link!');

    // Chuyển sang Step 2
    showStep(2);
    
    try {
        // Lấy API (đã được vá lỗi)
        const api = await getAdminApi();

        // 1. Gọi API Analyze
        console.log('🚀 Sending request to:', '/api/douyin/analyze');
        const res = await api.post('/api/douyin/analyze', { url });
        
        // Kiểm tra kết quả trả về
        if (!res || (!res.ok && !res.success)) {
            throw new Error(res.error || res.message || 'Lỗi không xác định từ Server');
        }

        currentVideoId = res.data.video_id;
        console.log("✅ Video ID:", currentVideoId);

        // 2. Polling trạng thái (Check mỗi 2 giây)
        document.getElementById('loading-status').innerText = "Gemini đang dịch nội dung...";
        
        const checkStatus = async () => {
            const statusRes = await api.get(`/api/douyin/${currentVideoId}`);
            
            if (statusRes && statusRes.data) {
                // Nếu đã có kết quả phân tích
                if (statusRes.data.status === 'waiting_approval' || statusRes.data.ai_analysis) {
                    const scripts = statusRes.data.ai_analysis?.scripts || [];
                    if (scripts.length > 0) {
                        renderScripts(scripts);
                        
                        // Fill data vào preview
                        if (statusRes.data.ai_analysis.product_name) {
                            document.getElementById('product-name').innerText = statusRes.data.ai_analysis.product_name;
                        }
                        
                        showStep(3);
                        return; // Dừng polling
                    }
                }
            }
            // Nếu chưa xong, tiếp tục check sau 2s
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
        <div class="border border-gray-200 p-4 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all" onclick="selectScript(this, \`${s.text.replace(/`/g, "\\`")}\`)">
            <div class="font-bold text-sm text-blue-600 mb-2 flex justify-between">
                <span>${s.style}</span>
                <span class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">v${s.version}</span>
            </div>
            <div class="text-sm text-gray-700 leading-relaxed">${s.text}</div>
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
        // Reset icon bg
        const badge = el.querySelector('span');
        if(badge) badge.className = "w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center font-bold";
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