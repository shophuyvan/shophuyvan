/**
 * AUTO VIDEO SYNC - FRONTEND LOGIC
 * Quản lý Workflow 5 bước: Product -> Video -> AI -> Fanpage -> Ads
 */

const API_BASE = '/api/auto-sync';
let currentJob = {
    id: null,
    productId: null,
    videoUrl: null,
    variants: [],
    fanpages: []
};

// ================= STATE MANAGEMENT =================
const wizard = {
    currentStep: 1,
    
    goToStep(step) {
        // Hide all steps
        document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
        
        // Show target step
        document.getElementById(`step-${step}`).classList.add('active');
        
        // Update indicator
        for (let i = 1; i <= 5; i++) {
            const indicator = document.getElementById(`indicator-${i}`);
            if (i < step) indicator.classList.add('completed');
            else indicator.classList.remove('completed');
            
            if (i === step) indicator.classList.add('active');
        }
        
        this.currentStep = step;
        
        // Trigger specific logic for step
        if (step === 1) loadProducts();
        if (step === 3 && currentJob.variants.length === 0) generateVariants();
        if (step === 4) loadFanpagesForAssign();
    }
};

// ================= STEP 1: PRODUCT SELECTION =================
async function loadProducts() {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = '<div class="text-center">Đang tải...</div>';
    
    try {
        // Gọi API lấy danh sách sản phẩm (Giả sử bạn đã có API này, nếu chưa thì dùng API cũ)
        // Ở đây tôi dùng đường dẫn chuẩn: /workers/shv-api/src/modules/products.js -> router GET /api/products
        const res = await fetch('/api/products?limit=20'); 
        const data = await res.json();
        
        if (!data.products && !data.data) throw new Error('Không có dữ liệu sản phẩm');
        const products = data.products || data.data;

        grid.innerHTML = '';
        products.forEach(p => {
            const img = p.images ? JSON.parse(p.images)[0] : 'https://placehold.co/300x200?text=No+Image';
            const price = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.price || 0);
            
            const card = document.createElement('div');
            card.className = 'product-card';
            card.onclick = () => selectProduct(p.id, card);
            card.innerHTML = `
                <img src="${img}" alt="${p.title}">
                <div class="info">
                    <div style="font-weight: bold; margin-bottom: 5px; height: 40px; overflow: hidden;">${p.title}</div>
                    <div style="color: #ef4444; font-weight: bold;">${price}</div>
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (e) {
        grid.innerHTML = `<div style="color:red">Lỗi tải sản phẩm: ${e.message}</div>`;
    }
}

function selectProduct(id, cardEl) {
    currentJob.productId = id;
    // Highlight UI
    document.querySelectorAll('.product-card').forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');
    document.getElementById('btnStep1Next').disabled = false;
}

document.getElementById('btnStep1Next').addEventListener('click', () => wizard.goToStep(2));


// ================= STEP 2: VIDEO DOWNLOAD =================
document.getElementById('btnDownload').addEventListener('click', async () => {
    const url = document.getElementById('tiktokUrl').value;
    if (!url) return alert('Vui lòng nhập link TikTok');
    
    if (!currentJob.productId) return alert('Chưa chọn sản phẩm');

    const btn = document.getElementById('btnDownload');
    const loader = document.getElementById('loaderDownload');
    
    btn.disabled = true;
    loader.classList.remove('hidden');

    try {
        const res = await fetch(`${API_BASE}/jobs/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: currentJob.productId,
                tiktokUrl: url
            })
        });
        const data = await res.json();

        if (!data.ok) throw new Error(data.error);

        // Success
        currentJob.id = data.jobId;
        currentJob.videoUrl = data.videoUrl;
        
        // Show Preview
        const videoEl = document.getElementById('videoPlayer');
        videoEl.src = data.videoUrl;
        document.getElementById('videoInfo').innerText = `Size: ${(data.fileSize / 1024 / 1024).toFixed(2)} MB`;
        document.getElementById('videoPreviewArea').classList.remove('hidden');
        document.getElementById('btnStep2Next').disabled = false;

    } catch (e) {
        alert('Lỗi tải video: ' + e.message);
    } finally {
        btn.disabled = false;
        loader.classList.add('hidden');
    }
});

document.getElementById('btnStep2Next').addEventListener('click', () => wizard.goToStep(3));


// ================= STEP 3: AI GENERATION =================
async function generateVariants() {
    const loading = document.getElementById('aiLoading');
    const contentArea = document.getElementById('aiContentArea');
    
    loading.classList.remove('hidden');
    contentArea.classList.add('hidden');
    document.getElementById('btnStep3Next').disabled = true;

    try {
        // Check if already have variants
        if (currentJob.variants.length > 0) {
             renderVariantsUI();
             return;
        }

        const res = await fetch(`${API_BASE}/jobs/${currentJob.id}/generate-variants`, { method: 'POST' });
        const data = await res.json();

        if (!data.ok) throw new Error(data.error);

        currentJob.variants = data.variants;
        renderVariantsUI();

    } catch (e) {
        alert('Lỗi AI: ' + e.message);
    } finally {
        loading.classList.add('hidden');
        contentArea.classList.remove('hidden');
        document.getElementById('btnStep3Next').disabled = false;
    }
}

function renderVariantsUI() {
    const tabsContainer = document.getElementById('variantTabs');
    tabsContainer.innerHTML = '';

    currentJob.variants.forEach((v, index) => {
        const tab = document.createElement('div');
        tab.className = `tab-item ${index === 0 ? 'active' : ''}`;
        tab.innerText = `Version ${v.version} (${v.tone})`;
        tab.onclick = () => switchVariantTab(index);
        tabsContainer.appendChild(tab);
    });

    // Load first variant
    switchVariantTab(0);
}

let activeVariantIndex = 0;

function switchVariantTab(index) {
    activeVariantIndex = index;
    const v = currentJob.variants[index];
    
    // Update Tabs UI
    document.querySelectorAll('.tab-item').forEach((el, i) => {
        if (i === index) el.classList.add('active');
        else el.classList.remove('active');
    });

    // Fill Data
    document.getElementById('variantCaption').value = v.caption;
    document.getElementById('variantTone').innerText = v.tone.toUpperCase();
    
    // Parse hashtags if string
    let tags = v.hashtags;
    if (typeof tags === 'string') {
        try { tags = JSON.parse(tags); } catch(e) { tags = []; }
    }
    document.getElementById('variantHashtags').innerText = Array.isArray(tags) ? tags.join(' ') : tags;
}

// Save edited caption
document.getElementById('btnSaveVariant').addEventListener('click', async () => {
    const v = currentJob.variants[activeVariantIndex];
    const newCaption = document.getElementById('variantCaption').value;
    
    // Update local
    v.caption = newCaption;
    
    // API Update (Optional but recommended)
    await fetch(`${API_BASE}/variants/${v.id}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ caption: newCaption })
    });
    
    alert('Đã lưu thay đổi!');
});

document.getElementById('btnStep3Next').addEventListener('click', () => wizard.goToStep(4));
document.getElementById('btnRegenerate').addEventListener('click', () => {
    if(confirm('Bạn có chắc muốn tạo lại nội dung? Dữ liệu cũ sẽ mất.')) {
        currentJob.variants = [];
        generateVariants();
    }
});


// ================= STEP 4: ASSIGN FANPAGES =================
async function loadFanpagesForAssign() {
    const tbody = document.getElementById('fanpageList');
    tbody.innerHTML = '<tr><td colspan="3" class="text-center">Đang tải danh sách Page...</td></tr>';

    try {
        // Get fanpages
        const res = await fetch('/api/fanpages'); // Từ module fb-page-manager.js bạn đã làm
        const data = await res.json();
        
        if (!data.success && !data.ok) throw new Error('Lỗi tải Fanpage');
        const pages = data.data || data.items || [];
        currentJob.fanpages = pages;

        tbody.innerHTML = '';
        
        if (pages.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-red-500">Chưa kết nối Fanpage nào. Vui lòng vào mục Cài đặt Fanpage.</td></tr>';
            document.getElementById('btnPublish').disabled = true;
            return;
        }

        pages.forEach((p, i) => {
            const tr = document.createElement('tr');
            
            // Select Version Options
            let optionsHtml = '';
            currentJob.variants.forEach(v => {
                // Default logic: Page 1 -> Ver 1, Page 2 -> Ver 2...
                const selected = (v.version === (i % 5) + 1) ? 'selected' : '';
                optionsHtml += `<option value="${v.id}" ${selected}>Version ${v.version} - ${v.tone}</option>`;
            });

            tr.innerHTML = `
                <td style="padding: 10px;">
                    <div style="font-weight:bold">${p.page_name}</div>
                    <div style="font-size:11px; color:#666">ID: ${p.page_id}</div>
                </td>
                <td style="padding: 10px;">
                    <select class="assign-select" data-page-id="${p.page_id}" style="width:100%; padding:5px; border-radius:4px; border:1px solid #ddd;">
                        ${optionsHtml}
                    </select>
                </td>
                <td style="padding: 10px; text-align: center;">
                    <input type="checkbox" class="assign-checkbox" data-page-id="${p.page_id}" checked style="width:18px; height:18px;">
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('btnPublish').disabled = false;

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-red-500">${e.message}</td></tr>`;
    }
}

document.getElementById('btnPublish').addEventListener('click', async () => {
    const btn = document.getElementById('btnPublish');
    btn.disabled = true;
    btn.innerText = '⏳ Đang xử lý...';

    // Gather assignments
    const assignments = [];
    document.querySelectorAll('.assign-checkbox:checked').forEach(cb => {
        const pageId = cb.dataset.pageId;
        const select = document.querySelector(`.assign-select[data-page-id="${pageId}"]`);
        const variantId = select.value;
        assignments.push({ fanpageId: pageId, variantId: parseInt(variantId) });
    });

    if (assignments.length === 0) {
        alert('Vui lòng chọn ít nhất 1 Fanpage để đăng');
        btn.disabled = false;
        btn.innerText = '🚀 Đăng bài ngay';
        return;
    }

    try {
        // 1. Save Assignments
        await fetch(`${API_BASE}/jobs/${currentJob.id}/assign-fanpages`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ assignments })
        });

        // 2. Trigger Bulk Publish
        const res = await fetch(`${API_BASE}/jobs/${currentJob.id}/publish`, { method: 'POST' });
        const data = await res.json();

        if (!data.ok) throw new Error(data.error);

        renderResults(data.results);
        wizard.goToStep(5);

    } catch (e) {
        alert('Lỗi đăng bài: ' + e.message);
        btn.disabled = false;
        btn.innerText = '🚀 Đăng bài ngay';
    }
});


// ================= STEP 5: RESULTS & ADS =================
function renderResults(results) {
    const container = document.getElementById('publishResults');
    container.innerHTML = '';

    results.forEach(r => {
        const div = document.createElement('div');
        div.className = 'result-item';
        
        let statusHtml = r.success 
            ? `<span class="status-badge status-success">Thành công</span> <a href="${r.postUrl}" target="_blank" style="margin-left:10px; font-size:13px;">Xem bài viết ↗</a>`
            : `<span class="status-badge status-failed">Thất bại</span> <span style="color:red; font-size:12px; margin-left:10px;">${r.error}</span>`;

        div.innerHTML = `
            <div>
                <strong>${r.fanpageName}</strong>
                <div style="font-size:11px; color:#666">ID: ${r.fanpageId}</div>
            </div>
            <div>${statusHtml}</div>
        `;
        container.appendChild(div);
    });
    
    // Auto-fill Campaign Name Suggestion
    const productName = document.querySelector('.product-card.selected .info div').innerText || 'Product';
    document.getElementById('campaignName').value = `Ads: ${productName} - ${new Date().toLocaleDateString('vi-VN')}`;
}

// Toggle Ads Form
document.getElementById('cbCreateAds').addEventListener('change', (e) => {
    const form = document.getElementById('adsConfigArea');
    if (e.target.checked) form.classList.remove('hidden');
    else form.classList.add('hidden');
});

// Create Ads
document.getElementById('btnCreateAds').addEventListener('click', async () => {
    const btn = document.getElementById('btnCreateAds');
    btn.disabled = true;
    btn.innerText = '⏳ Đang tạo Campaign...';

    const name = document.getElementById('campaignName').value;
    const budget = parseInt(document.getElementById('dailyBudget').value);

    try {
        const res = await fetch(`${API_BASE}/jobs/${currentJob.id}/create-ads`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                campaignName: name,
                dailyBudget: budget,
                // Targeting mặc định cho gia dụng
                targeting: {
                    age_min: 25, 
                    age_max: 45,
                    interests: [{ id: '6003139266461', name: 'Home Appliances' }] 
                }
            })
        });
        const data = await res.json();
        
        if (!data.ok) throw new Error(data.error);

        alert(`✅ ${data.message}`);
        btn.innerText = '✅ Đã tạo xong';

    } catch (e) {
        alert('Lỗi tạo Ads: ' + e.message);
        btn.disabled = false;
        btn.innerText = '⚡ Tạo Ads Campaign';
    }
});