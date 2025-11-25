// ✅ FIX: Load API từ Global (Shared Library) thay vì Import ES6
let currentVideoId = null;

// Hàm helper: Tự động lấy API từ window hoặc load file nếu chưa có
async function getAdminApi() {
    // 1. Nếu đã có sẵn trong window
    if (window.SHARED && window.SHARED.api) return window.SHARED.api;

    // 2. Nếu chưa có, tự động inject thẻ script để load
    console.log('⏳ Auto-loading api-admin.js...');
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '../../_shared/api-admin.js'; // Đường dẫn lùi 2 cấp
        script.onload = () => {
            if (window.SHARED && window.SHARED.api) resolve(window.SHARED.api);
            else reject(new Error('Loaded api-admin.js but SHARED.api is missing'));
        };
        script.onerror = () => reject(new Error('Failed to load api-admin.js'));
        document.head.appendChild(script);
    });
}

window.startAnalyze = async function() {
    const url = document.getElementById('douyin-url').value;
    if (!url) return alert('Vui lòng nhập link!');

    // Chuyển sang Step 2
    showStep(2);
    
    try {
        // ✅ Lấy API trước khi dùng
        const api = await getAdminApi();

        // 1. Gọi API Analyze
        const res = await api.post('/api/douyin/analyze', { url });
        if (!res.ok && !res.success) throw new Error(res.error || res.message); // Support cả 2 chuẩn response

        currentVideoId = res.data.video_id;
        console.log("Video ID:", currentVideoId);

        // 2. Polling trạng thái (Giả lập chờ 2s rồi check)
        document.getElementById('loading-status').innerText = "Gemini đang dịch nội dung...";
        
        setTimeout(async () => {
            const api = await getAdminApi(); // Lấy lại api trong scope này
            const statusRes = await api.get(`/api/douyin/${currentVideoId}`);
            
            // Check status và render (hỗ trợ cả mock data và real data)
            if (statusRes && statusRes.data) {
                if (statusRes.data.status === 'waiting_approval' || statusRes.data.ai_analysis) {
                    // Nếu có script thì render
                    const scripts = statusRes.data.ai_analysis?.scripts || [];
                    if (scripts.length > 0) {
                        renderScripts(scripts);
                        showStep(3);
                    }
                }
            }
        }, 2000);

    } catch (e) {
        alert('Lỗi: ' + e.message);
        showStep(1);
    }
};

function renderScripts(scripts) {
    const container = document.getElementById('script-options');
    container.innerHTML = scripts.map((s, idx) => `
        <div class="border p-3 rounded cursor-pointer hover:bg-blue-50" onclick="selectScript('${s.text}')">
            <div class="font-bold text-sm text-blue-600 mb-1">${s.style}</div>
            <div class="text-sm text-gray-700">${s.text}</div>
        </div>
    `).join('');
    
    // Auto select first
    if(scripts.length > 0) selectScript(scripts[0].text);
}

window.selectScript = function(text) {
    document.getElementById('final-script').value = text;
}

function showStep(stepNum) {
    document.querySelectorAll('.wizard-step').forEach(el => el.classList.add('hidden'));
    document.getElementById(`step-${stepNum}`).classList.remove('hidden');
    
    // Update Header
    document.querySelectorAll('[id$="-ind"]').forEach(el => el.classList.remove('step-active'));
    document.getElementById(`step-${stepNum}-ind`).classList.add('step-active');
}

// Expose functions globally for HTML onClick
window.showStep = showStep;
window.goToStep4 = () => alert('Đã chốt kịch bản! Tiếp theo sẽ làm phần TTS...');