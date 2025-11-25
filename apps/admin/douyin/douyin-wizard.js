import { api } from '../_shared/api-admin.js'; [cite_start]// [cite: 5]

let currentVideoId = null;

window.startAnalyze = async function() {
    const url = document.getElementById('douyin-url').value;
    if (!url) return alert('Vui lòng nhập link!');

    // Chuyển sang Step 2
    showStep(2);
    
    try {
        // 1. Gọi API Analyze
        const res = await api.post('/api/douyin/analyze', { url });
        if (!res.success) throw new Error(res.message);

        currentVideoId = res.data.video_id;
        console.log("Video ID:", currentVideoId);

        // 2. Polling trạng thái (Giả lập chờ 2s rồi check)
        document.getElementById('loading-status').innerText = "Gemini đang dịch nội dung...";
        
        setTimeout(async () => {
            const statusRes = await api.get(`/api/douyin/${currentVideoId}`);
            if (statusRes.data.status === 'waiting_approval') {
                renderScripts(statusRes.data.ai_analysis.scripts);
                showStep(3);
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