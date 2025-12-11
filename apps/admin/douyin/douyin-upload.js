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
    if (fileCount) fileCount.innerText = '0'; // ✅ FIX: Check null
    return;
  }
  
  container.innerHTML = state.uploadedFiles.map((item, index) => `
    <div class="file-card">
      <video src="${item.preview}" controls></video>
      <div class="p-3">
        <p class="text-sm font-medium truncate">${item.file.name}</p>
        <p class="text-xs text-gray-500">${(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
        ${item.status === 'pending' ? `
          <button onclick="removeFile(${index})" class="text-red-600 text-xs mt-2">🗑️ Xóa</button>
        ` : ''}
        ${item.status === 'uploading' ? `
          <div class="text-xs text-blue-600 mt-2">⏳ Đang upload...</div>
        ` : ''}
        ${item.status === 'uploaded' ? `
          <div class="text-xs text-green-600 mt-2">✅ Đã upload</div>
        ` : ''}
      </div>
      ${item.progress !== undefined ? `
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width: ${item.progress || 0}%"></div>
        </div>
      ` : ''}
    </div>
  `).join('');
  
  uploadBtn.disabled = false;
  if (fileCount) fileCount.innerText = state.uploadedFiles.length; // ✅ FIX: Check null
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
  
  // Disable upload button
  const uploadBtn = document.getElementById('upload-btn');
  uploadBtn.disabled = true;
  uploadBtn.innerHTML = '⏳ Đang upload...';
  
  try {
    // Prepare FormData
    const formData = new FormData();
    formData.append('product_id', state.selectedProduct.id);
    
    state.uploadedFiles.forEach(item => {
      formData.append('files', item.file);
      item.status = 'uploading';
      item.progress = 0;
    });
    
    renderFileList();
    
    // Upload với progress simulation
    console.log('📤 Uploading videos...');
    
    // Simulate progress (vì FormData upload không track được chính xác)
    const progressInterval = setInterval(() => {
      state.uploadedFiles.forEach(item => {
        if (item.status === 'uploading' && item.progress < 90) {
          item.progress = Math.min(90, item.progress + Math.random() * 10);
        }
      });
      renderFileList();
    }, 300);
    
    const data = await callApi('/api/social/douyin/upload', 'POST', formData, true);
    
    clearInterval(progressInterval);
    
    // Set 100% progress
    state.uploadedFiles.forEach(item => {
      item.status = 'uploaded';
      item.progress = 100;
    });
    renderFileList();
    
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
    
    // Wait a bit to show 100% then go to next step
    setTimeout(() => {
      showStep(3);
      renderVideoReview();
    }, 500);
    
  } catch (error) {
    console.error('Upload error:', error);
    alert('Lỗi upload: ' + error.message);
    
    state.uploadedFiles.forEach(item => {
      item.status = 'error';
      item.progress = 0;
    });
    renderFileList();
    
    // Re-enable button
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = `📤 Upload (<span id="file-count">${state.uploadedFiles.length}</span> videos)`;
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
        // [UPDATE] Lưu dữ liệu mới nhất vào state để dùng cho bước sau
        state.analyzedVideos = data.data;
        
        setTimeout(() => {
          showStep(5);
          renderScriptSelection(); // Gọi hàm vẽ giao diện chọn kịch bản
        }, 500);
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
// STEP 5: SCRIPT SELECTION & VOICE CONFIG
// ==========================================

window.renderScriptSelection = function() {
  const container = document.getElementById('script-selection-container');
  
  if (!state.analyzedVideos || state.analyzedVideos.length === 0) {
    container.innerHTML = '<p class="text-red-500">Không có dữ liệu video.</p>';
    return;
  }

  container.innerHTML = state.analyzedVideos.map((video, vIdx) => {
    // Mặc định chọn script đầu tiên nếu chưa chọn
    if (!video.selectedScriptIndex) video.selectedScriptIndex = 0;
    if (!video.selectedVoice) video.selectedVoice = 'banmai'; // Giọng nữ miền Trung chuẩn
    if (!video.selectedSpeed) video.selectedSpeed = 0;

    const scripts = video.ai_analysis?.scripts || [];

    return `
      <div class="border rounded-lg p-6 bg-gray-50 mb-8">
        <div class="flex gap-4 mb-6 border-b pb-4">
          <img src="${video.thumbnail_url}" class="w-24 h-32 object-cover rounded shadow">
          <div class="flex-1">
            <h3 class="font-bold text-lg text-blue-800 mb-1">${video.filename}</h3>
            <p class="text-sm text-gray-600 mb-2">Duration: ${video.duration}s</p>
            <div class="flex gap-2">
               <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">✅ AI Đã phân tích</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h4 class="font-bold mb-3 flex items-center gap-2">📝 Chọn Kịch Bản (Content)</h4>
            <div class="space-y-3 max-h-96 overflow-y-auto pr-2">
              ${scripts.map((script, sIdx) => `
                <div class="script-card cursor-pointer border rounded p-3 bg-white hover:shadow-md transition-all ${video.selectedScriptIndex === sIdx ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'}"
                     onclick="selectScript(${vIdx}, ${sIdx})">
                  <div class="flex justify-between mb-1">
                    <span class="font-bold text-sm text-gray-700">${script.style}</span>
                    ${video.selectedScriptIndex === sIdx ? '<span class="text-blue-600 text-xs font-bold">● Đang chọn</span>' : ''}
                  </div>
                  <p class="text-sm text-gray-600 line-clamp-3 italic">"${script.text}"</p>
                </div>
              `).join('')}
            </div>
          </div>

          <div>
            <h4 class="font-bold mb-3 flex items-center gap-2">🎙️ Cấu hình Giọng đọc (Voice)</h4>
            <div class="bg-white p-4 rounded border border-gray-200">
              
              <div class="mb-4">
                <label class="block text-sm font-medium mb-1">Giọng đọc mẫu</label>
                <select class="w-full border p-2 rounded bg-gray-50" onchange="updateVoice(${vIdx}, this.value)">
                  <option value="banmai" ${video.selectedVoice === 'banmai' ? 'selected' : ''}>👩 Ban Mai (Nữ Miền Trung - Chuẩn)</option>
                  <option value="leminh" ${video.selectedVoice === 'leminh' ? 'selected' : ''}>👨 Lê Minh (Nam Miền Bắc)</option>
                  <option value="myan" ${video.selectedVoice === 'myan' ? 'selected' : ''}>👩 My An (Nữ Miền Bắc - Trẻ)</option>
                  <option value="lannhi" ${video.selectedVoice === 'lannhi' ? 'selected' : ''}>👩 Lan Nhi (Nữ Miền Nam)</option>
                </select>
              </div>

              <div class="mb-4">
                <label class="block text-sm font-medium mb-1">Tốc độ đọc: <span id="speed-label-${vIdx}">${video.selectedSpeed}</span></label>
                <input type="range" min="-3" max="3" step="1" value="${video.selectedSpeed}" 
                       class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                       oninput="updateSpeed(${vIdx}, this.value)">
                <div class="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Chậm</span>
                  <span>Chuẩn</span>
                  <span>Nhanh</span>
                </div>
              </div>

              <div class="mt-4 mb-4 pt-4 border-t border-dashed">
                <button onclick="playVoicePreview(${vIdx})" id="btn-preview-${vIdx}" 
                        class="w-full border border-blue-500 text-blue-600 px-4 py-2 rounded hover:bg-blue-50 flex items-center justify-center gap-2 transition font-medium">
                  <span>🔊</span> Nghe thử giọng đọc này
                </button>
                <div id="audio-container-${vIdx}" class="mt-2 hidden"></div>
              </div>

              <div class="p-3 bg-blue-50 rounded text-sm text-blue-800">
                💡 <strong>Review kịch bản đã chọn:</strong><br>
                <p class="mt-1 italic text-gray-700" id="preview-text-${vIdx}">
                  ${scripts[video.selectedScriptIndex || 0]?.text || ''}
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

// Hàm chọn script
window.selectScript = function(videoIdx, scriptIdx) {
  state.analyzedVideos[videoIdx].selectedScriptIndex = scriptIdx;
  renderScriptSelection(); // Re-render để update UI
};

// Hàm update giọng
window.updateVoice = function(videoIdx, voiceId) {
  state.analyzedVideos[videoIdx].selectedVoice = voiceId;
};

// Hàm update tốc độ
window.updateSpeed = function(videoIdx, speed) {
  state.analyzedVideos[videoIdx].selectedSpeed = parseInt(speed);
  document.getElementById(`speed-label-${videoIdx}`).innerText = speed;
};

// ==========================================
// STEP 6: RENDER EXECUTION
// ==========================================

window.confirmRender = async function() {
  if (!confirm('Bạn có chắc chắn muốn Render tất cả video với cấu hình đã chọn?')) return;

  try {
    showStep(6);
    const container = document.getElementById('render-progress-container');
    container.innerHTML = ''; // Clear cũ

    // 1. Tạo UI Progress cho từng video
    state.analyzedVideos.forEach(video => {
        container.innerHTML += `
            <div class="border rounded p-4 mb-3 bg-white shadow-sm">
                <div class="flex justify-between mb-2">
                    <span class="font-bold">${video.filename}</span>
                    <span id="render-status-${video.video_id}" class="text-sm text-blue-600">Đang chờ...</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2.5">
                    <div id="render-bar-${video.video_id}" class="bg-blue-600 h-2.5 rounded-full" style="width: 0%"></div>
                </div>
            </div>
        `;
    });

    // 2. Gửi lệnh Render từng video (Tuần tự để tránh quá tải)
    for (const video of state.analyzedVideos) {
        const script = video.ai_analysis.scripts[video.selectedScriptIndex || 0];
        
        updateRenderStatus(video.video_id, 30, '⏳ Đang tạo giọng đọc (TTS)...');
        
        // Gọi API Render
        const res = await callApi('/api/social/douyin/render', 'POST', {
            video_id: video.video_id,
            script_text: script.text,
            voice_id: video.selectedVoice || 'banmai',
            voice_speed: video.selectedSpeed || 0,
            output_options: { save_to_library: true, download: true }
        });

        if (res.ok) {
            updateRenderStatus(video.video_id, 100, '✅ Render thành công!', 'bg-green-600');
            // Hiện nút download hoặc link
        } else {
            updateRenderStatus(video.video_id, 100, '❌ Lỗi: ' + res.error, 'bg-red-600');
        }
    }
    
    alert('🎉 Quá trình Render hoàn tất!');

  } catch (e) {
    console.error(e);
    alert('Lỗi Render: ' + e.message);
  }
};

function updateRenderStatus(videoId, percent, text, colorClass = 'bg-blue-600') {
    const bar = document.getElementById(`render-bar-${videoId}`);
    const status = document.getElementById(`render-status-${videoId}`);
    
    if (bar) {
        bar.style.width = `${percent}%`;
        bar.className = `h-2.5 rounded-full ${colorClass}`;
    }
    if (status) status.innerText = text;
}

// ==========================================
// FEATURE: VOICE PREVIEW
// ==========================================

window.playVoicePreview = async function(videoIdx) {
  const video = state.analyzedVideos[videoIdx];
  const script = video.ai_analysis.scripts[video.selectedScriptIndex || 0];
  const btn = document.getElementById(`btn-preview-${videoIdx}`);
  const container = document.getElementById(`audio-container-${videoIdx}`);

  if (!script) return alert('Vui lòng chọn kịch bản trước');

  try {
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Đang tạo audio...';
    btn.disabled = true;

    // Gọi API Preview mới
    const res = await callApi('/api/social/douyin/preview-voice', 'POST', {
      text: script.text.substring(0, 150), // Lấy 150 ký tự đầu để test nhanh
      voice_id: video.selectedVoice || 'banmai',
      speed: video.selectedSpeed || 0
    });

    // Tạo Audio Player
    container.innerHTML = `
      <audio controls autoplay class="w-full mt-2" src="${res.audio_url}"></audio>
      <p class="text-xs text-gray-500 mt-1 text-center">Bản nghe thử (Demo 150 ký tự)</p>
    `;
    container.classList.remove('hidden');
    
    btn.innerHTML = originalText;
    btn.disabled = false;

  } catch (e) {
    console.error(e);
    alert('Lỗi: ' + e.message);
    btn.innerHTML = '🔊 Nghe thử lại';
    btn.disabled = false;
  }
};