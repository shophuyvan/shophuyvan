/**
 * File: apps/admin/douyin/douyin-upload.js
 * Frontend logic for Douyin Upload with Product Selection
 */

// ==========================================
// STATE MANAGEMENT
// ==========================================

const state = {
  selectedProduct: null,
  uploadedFiles: [], // { file: File, preview: string, videoId: null, status: 'pending' }
  uploadedVideoIds: [], // After upload to R2
  currentStep: 1,
  currentMode: 'upload' // 'upload' or 'link'
};

// ==========================================
// AUTH & API
// ==========================================

function getAuthToken() {
  let token = localStorage.getItem('xtoken');
  if (!token) token = localStorage.getItem('x-token');
  if (!token) token = localStorage.getItem('admin_token');
  if (!token) token = sessionStorage.getItem('xtoken');
  if (!token && window.Admin && typeof window.Admin.token === 'function') {
    token = window.Admin.token();
  }
  return token;
}

async function callApi(endpoint, method = 'GET', body = null, isFormData = false) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Không tìm thấy Token. Vui lòng đăng nhập lại Admin.');
  }

  const apiBase = 'https://api.shophuyvan.vn';
  const url = endpoint.startsWith('http') ? endpoint : `${apiBase}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = { 'x-token': token };
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const options = { method, headers };
  if (body && method !== 'GET') {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  console.log(`📡 API Request: ${method} ${url}`);

  const res = await fetch(url, options);
  const data = await res.json();

  if (!res.ok || (data && !data.ok && !data.success)) {
    throw new Error(data.error || data.message || `Lỗi Server (${res.status})`);
  }

  return data;
}

// ==========================================
// STEP NAVIGATION
// ==========================================

function showStep(stepNum) {
  // Hide all steps
  document.querySelectorAll('.wizard-step').forEach(el => el.classList.add('hidden'));
  
  // Show target step
  const target = document.getElementById(`step-${stepNum}`);
  if (target) target.classList.remove('hidden');
  
  // Update progress indicators
  document.querySelectorAll('[id$="-ind"]').forEach(el => {
    el.className = "py-2 px-4 border-b-2 border-transparent";
  });
  
  const activeInd = document.getElementById(`step-${stepNum}-ind`);
  if (activeInd) {
    activeInd.className = "py-2 px-4 border-b-2 step-active";
  }
  
  state.currentStep = stepNum;
}

// ==========================================
// STEP 1: PRODUCT SELECTION
// ==========================================

window.searchProducts = async function() {
  const searchInput = document.getElementById('product-search');
  const query = searchInput.value.trim();
  
  try {
    // Call products API
    // [SHV Fix] Đổi thành /admin/products để đúng chuẩn Backend
    const data = await callApi(`/admin/products?search=${encodeURIComponent(query)}&limit=20`);
    
    const products = data.items || data.products || [];
    renderProductGrid(products);
    
  } catch (error) {
    console.error('Search error:', error);
    alert('Lỗi: ' + error.message);
  }
};

function renderProductGrid(products) {
  const grid = document.getElementById('product-grid');
  
  if (products.length === 0) {
    grid.innerHTML = '<p class="col-span-4 text-center text-gray-500">Không tìm thấy sản phẩm</p>';
    return;
  }
  
  grid.innerHTML = products.map(product => {
    // Fix: Xử lý 3 trường hợp: array, JSON string, hoặc URL string
    let imageUrl = '/no-image.svg';
    if (Array.isArray(product.images) && product.images.length > 0) {
      imageUrl = product.images[0];
    } else if (typeof product.images === 'string') {
      // Nếu là URL trực tiếp (bắt đầu bằng http)
      if (product.images.startsWith('http')) {
        imageUrl = product.images;
      } else {
        // Nếu là JSON string
        try {
          const parsed = JSON.parse(product.images);
          imageUrl = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : '/no-image.svg';
        } catch (e) {
          imageUrl = '/no-image.svg';
        }
      }
    }
    const price = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price || 0);
    
    return `
      <div class="product-card border rounded-lg p-3 ${state.selectedProduct?.id === product.id ? 'selected' : ''}" 
           onclick="selectProduct(${product.id}, '${product.title.replace(/'/g, "\\'")}', '${imageUrl}', ${product.price})">
        <img src="${imageUrl}" class="w-full h-32 object-cover rounded mb-2" onerror="this.src='/no-image.svg'">
        <h4 class="font-medium text-sm truncate" title="${product.title}">${product.title}</h4>
        <p class="text-blue-600 font-bold text-sm">${price}</p>
        ${state.selectedProduct?.id === product.id ? '<div class="text-green-600 text-sm mt-1">✅ Đã chọn</div>' : ''}
      </div>
    `;
  }).join('');
}

window.selectProduct = function(id, title, imageUrl, price) {
  state.selectedProduct = { id, title, imageUrl, price };
  
  // Update UI
  document.getElementById('selected-product-name').innerText = title;
  document.getElementById('selected-product-price').innerText = 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  document.getElementById('selected-product-image').src = imageUrl;
  
  document.getElementById('selected-summary').classList.remove('hidden');
  
  // Highlight selected product
  document.querySelectorAll('.product-card').forEach(card => {
    card.classList.remove('selected');
  });
  event.currentTarget.classList.add('selected');
};

window.changeProduct = function() {
  state.selectedProduct = null;
  document.getElementById('selected-summary').classList.add('hidden');
};

window.goToStep2 = function() {
  if (!state.selectedProduct) {
    alert('Vui lòng chọn sản phẩm trước!');
    return;
  }
  showStep(2);
};

// ==========================================
// STEP 2: FILE UPLOAD
// ==========================================

window.switchTab = function(mode) {
  state.currentMode = mode;
  
  // Update tabs
  document.getElementById('tab-upload').className = mode === 'upload' 
    ? 'tab-btn px-4 py-2 border-b-2 border-blue-600 text-blue-600 font-bold'
    : 'tab-btn px-4 py-2 border-b-2 border-transparent text-gray-500';
  
  document.getElementById('tab-link').className = mode === 'link'
    ? 'tab-btn px-4 py-2 border-b-2 border-blue-600 text-blue-600 font-bold'
    : 'tab-btn px-4 py-2 border-b-2 border-transparent text-gray-500';
  
  // Show/hide sections
  document.getElementById('upload-section').classList.toggle('hidden', mode !== 'upload');
  document.getElementById('link-section').classList.toggle('hidden', mode !== 'link');
};

// Drag & Drop
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');

dropzone?.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone?.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone?.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
  handleFileSelect(files);
});

fileInput?.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  handleFileSelect(files);
});

function handleFileSelect(files) {
  // Validate
  const MAX_FILES = 10;
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB
  
  if (state.uploadedFiles.length + files.length > MAX_FILES) {
    alert(`Tối đa ${MAX_FILES} videos mỗi lần!`);
    return;
  }
  
  let totalSize = state.uploadedFiles.reduce((sum, f) => sum + f.file.size, 0);
  
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      alert(`File ${file.name} vượt quá 50MB`);
      return;
    }
    totalSize += file.size;
  }
  
  if (totalSize > MAX_TOTAL_SIZE) {
    alert('Tổng dung lượng vượt quá 500MB');
    return;
  }
  
  // Add files
  files.forEach(file => {
    const preview = URL.createObjectURL(file);
    state.uploadedFiles.push({
      file,
      preview,
      videoId: null,
      status: 'pending'
    });
  });
  
  renderFileList();
}

function renderFileList() {
  const container = document.getElementById('uploaded-files');
  const uploadBtn = document.getElementById('upload-btn');
  const fileCount = document.getElementById('file-count');
  
  if (state.uploadedFiles.length === 0) {
    container.innerHTML = '';
    uploadBtn.disabled = true;
    return;
  }
  
  container.innerHTML = state.uploadedFiles.map((item, idx) => `
    <div class="file-card">
      <video src="${item.preview}" class="w-full"></video>
      <div class="p-3">
        <p class="text-sm font-medium truncate">${item.file.name}</p>
        <p class="text-xs text-gray-500">${(item.file.size / (1024 * 1024)).toFixed(1)} MB</p>
        <button onclick="removeFile(${idx})" class="text-red-600 text-xs mt-1">❌ Xóa</button>
      </div>
      ${item.status === 'uploading' ? `
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width: ${item.progress || 0}%"></div>
        </div>
      ` : ''}
    </div>
  `).join('');
  
  uploadBtn.disabled = false;
  fileCount.innerText = state.uploadedFiles.length;
}

window.removeFile = function(index) {
  URL.revokeObjectURL(state.uploadedFiles[index].preview);
  state.uploadedFiles.splice(index, 1);
  renderFileList();
};

window.clearAllFiles = function() {
  state.uploadedFiles.forEach(item => URL.revokeObjectURL(item.preview));
  state.uploadedFiles = [];
  renderFileList();
};

window.startUpload = async function() {
  if (state.uploadedFiles.length === 0) {
    alert('Chưa có file nào để upload!');
    return;
  }
  
  try {
    // Prepare FormData
    const formData = new FormData();
    formData.append('product_id', state.selectedProduct.id);
    
    state.uploadedFiles.forEach(item => {
      formData.append('files', item.file);
      item.status = 'uploading';
    });
    
    renderFileList();
    
    // Upload
    console.log('📤 Uploading videos...');
    const data = await callApi('/api/social/douyin/upload', 'POST', formData, true);
    
    console.log('✅ Upload success:', data);
    
    // Save video IDs
    state.uploadedVideoIds = data.videos.map(v => ({
      video_id: v.video_id,
      filename: v.filename,
      thumbnail_url: v.thumbnail_url,
      size: v.size,
      duration: v.duration,
      selected: true
    }));
    
    // Go to confirm step
    showStep(3);
    renderVideoReview();
    
  } catch (error) {
    console.error('Upload error:', error);
    alert('Lỗi upload: ' + error.message);
    
    state.uploadedFiles.forEach(item => item.status = 'pending');
    renderFileList();
  }
};

// ==========================================
// STEP 3: CONFIRM VIDEOS
// ==========================================

function renderVideoReview() {
  const grid = document.getElementById('video-review-grid');
  const countSpan = document.getElementById('selected-video-count');
  
  grid.innerHTML = state.uploadedVideoIds.map((video, idx) => `
    <div class="border rounded-lg p-4">
      <img src="${video.thumbnail_url}" class="w-full h-32 object-cover rounded mb-2" onerror="this.src='/no-image.svg'">
      <p class="text-sm font-medium">${video.filename}</p>
      <p class="text-xs text-gray-500">${(video.size / (1024 * 1024)).toFixed(1)} MB | ${video.duration}s</p>
      <label class="flex items-center gap-2 mt-2">
        <input type="checkbox" checked onchange="toggleVideoSelection(${idx}, this.checked)">
        <span class="text-sm">Phân tích video này</span>
      </label>
    </div>
  `).join('');
  
  updateSelectedCount();
}

window.toggleVideoSelection = function(idx, checked) {
  state.uploadedVideoIds[idx].selected = checked;
  updateSelectedCount();
};

function updateSelectedCount() {
  const count = state.uploadedVideoIds.filter(v => v.selected).length;
  document.getElementById('selected-video-count').innerText = count;
}

window.confirmAnalyze = async function() {
  const selectedVideoIds = state.uploadedVideoIds
    .filter(v => v.selected)
    .map(v => v.video_id);
  
  if (selectedVideoIds.length === 0) {
    alert('Vui lòng chọn ít nhất 1 video!');
    return;
  }
  
  try {
    showStep(4);
    renderAnalyzeProgress(selectedVideoIds);
    
    // Call batch analyze API
    console.log('🤖 Starting AI analysis...');
    const data = await callApi('/api/social/douyin/batch-analyze', 'POST', {
      video_ids: selectedVideoIds,
      product_id: state.selectedProduct.id
    });
    
    console.log('✅ Analysis started:', data);
    
    // Start polling
    pollAnalyzeStatus(selectedVideoIds);
    
  } catch (error) {
    console.error('Analyze error:', error);
    alert('Lỗi phân tích: ' + error.message);
  }
};

function renderAnalyzeProgress(videoIds) {
  const container = document.getElementById('analyze-progress');
  
  container.innerHTML = videoIds.map(videoId => {
    const video = state.uploadedVideoIds.find(v => v.video_id === videoId);
    return `
      <div class="border rounded-lg p-4" id="progress-${videoId}">
        <div class="flex items-center gap-4">
          <img src="${video.thumbnail_url}" class="w-20 h-20 object-cover rounded">
          <div class="flex-1">
            <p class="font-medium">${video.filename}</p>
            <div class="progress-bar mt-2">
              <div class="progress-bar-fill" id="bar-${videoId}" style="width: 0%"></div>
            </div>
            <p class="text-sm text-gray-600 mt-1" id="status-${videoId}">Đang chuẩn bị...</p>
          </div>
          <div id="icon-${videoId}" class="text-2xl">⏳</div>
        </div>
      </div>
    `;
  }).join('');
}

async function pollAnalyzeStatus(videoIds) {
  const maxRetries = 30;
  let retryCount = 0;
  
  const checkStatus = async () => {
    try {
      const data = await callApi(`/api/social/douyin/batch-status?ids=${videoIds.join(',')}`);
      
      let allDone = true;
      
      data.data.forEach(video => {
        const bar = document.getElementById(`bar-${video.video_id}`);
        const status = document.getElementById(`status-${video.video_id}`);
        const icon = document.getElementById(`icon-${video.video_id}`);
        
        if (bar) bar.style.width = `${video.progress}%`;
        
        if (video.status === 'waiting_approval') {
          if (status) status.innerText = 'Hoàn thành ✅';
          if (icon) icon.innerText = '✅';
        } else if (video.status === 'analyzing') {
          if (status) status.innerText = 'Đang phân tích AI...';
          allDone = false;
        } else if (video.status === 'error') {
          if (status) status.innerText = 'Lỗi: ' + video.error_message;
          if (icon) icon.innerText = '❌';
        } else {
          allDone = false;
        }
      });
      
      if (allDone) {
        setTimeout(() => {
          alert('Phân tích hoàn tất! Bước tiếp theo: chọn kịch bản.');
          // TODO: Go to step 5 (script selection)
        }, 1000);
        return;
      }
      
      retryCount++;
      if (retryCount > maxRetries) {
        alert('Quá thời gian chờ. Vui lòng thử lại.');
        return;
      }
      
      setTimeout(checkStatus, 2000);
      
    } catch (error) {
      console.warn('Polling error:', error);
      retryCount++;
      if (retryCount < maxRetries) {
        setTimeout(checkStatus, 2000);
      }
    }
  };
  
  checkStatus();
}

// ==========================================
// LINK MODE (Step 2 alternative)
// ==========================================

window.addLinkInput = function() {
  const container = document.getElementById('link-inputs');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'link-input w-full border p-2 rounded';
  input.placeholder = 'https://v.douyin.com/...';
  container.appendChild(input);
};

window.submitLinks = async function() {
  const inputs = document.querySelectorAll('.link-input');
  const urls = Array.from(inputs)
    .map(input => input.value.trim())
    .filter(url => url.length > 0);
  
  if (urls.length === 0) {
    alert('Vui lòng nhập ít nhất 1 link!');
    return;
  }
  
  alert('Link mode chưa implement. Sẽ có trong Phase 2.');
  // TODO: Implement link download logic
};

// ==========================================
// INIT
// ==========================================

// Load initial products on page load
window.addEventListener('DOMContentLoaded', () => {
  searchProducts();
});

console.log('✅ douyin-upload.js loaded');
