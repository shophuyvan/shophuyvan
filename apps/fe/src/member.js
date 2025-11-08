// apps/fe/src/member.js
// Trang thông tin thành viên

const API_BASE = window.API_BASE || 'https://api.shophuyvan.vn';

// API Helper
async function api(endpoint, options = {}) {
  const token = localStorage.getItem('customer_token') || 
                localStorage.getItem('x-customer-token') || 
                localStorage.getItem('x-token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Lỗi mạng' }));
    throw new Error(err.message || err.error || 'Lỗi không xác định');
  }
  
  return response.json();
}

const TIER_INFO = {
  retail: {
    name: 'Thành viên thường',
    icon: '👤',
    color: '#6b7280',
    minPoints: 0,
    discount: 0,
    benefits: [
      '✓ Tích lũy điểm mỗi lần mua hàng',
      '✓ Truy cập các khuyến mãi độc quyền',
      '✓ Hỗ trợ khách hàng 24/7'
    ]
  },
  silver: {
    name: 'Thành viên bạc',
    icon: '🥈',
    color: '#94a3b8',
    minPoints: 1000000,
    discount: 3,
    benefits: [
      '✓ Giảm giá 3% cho tất cả sản phẩm',
      '✓ Tích lũy điểm nhanh hơn',
      '✓ Giao hàng ưu tiên',
      '✓ Khuyến mãi độc quyền hàng tháng'
    ]
  },
  gold: {
    name: 'Thành viên vàng',
    icon: '🥇',
    color: '#fbbf24',
    minPoints: 3000000,
    discount: 5,
    benefits: [
      '✓ Giảm giá 5% cho tất cả sản phẩm',
      '✓ Tích lũy điểm nhanh nhất',
      '✓ Giao hàng ưu tiên + miễn phí',
      '✓ Khuyến mãi độc quyền hàng tuần',
      '✓ Hỗ trợ VIP riêng'
    ]
  },
  diamond: {
    name: 'Thành viên kim cương',
    icon: '💎',
    color: '#06b6d4',
    minPoints: 5000000,
    discount: 8,
    benefits: [
      '✓ Giảm giá 8% cho tất cả sản phẩm',
      '✓ Tích lũy điểm cực nhanh',
      '✓ Giao hàng ưu tiên + miễn phí toàn quốc',
      '✓ Khuyến mãi đặc biệt mỗi tuần',
      '✓ Hỗ trợ VIP độc quyền 24/7',
      '✓ Quà tặng sinh nhật hàng năm'
    ]
  }
};

// DOM Elements
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const mainContent = document.getElementById('mainContent');
const errorMessage = document.getElementById('errorMessage');
const tierCard = document.getElementById('tierCard');
const tierIcon = document.getElementById('tierIcon');
const tierName = document.getElementById('tierName');
const tierPoints = document.getElementById('tierPoints');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const tierList = document.getElementById('tierList');

function formatNumber(n) {
  return new Intl.NumberFormat('vi-VN').format(n);
}

function getCurrentTier(points) {
  const p = Number(points || 0);
  if (p >= TIER_INFO.diamond.minPoints) return 'diamond';
  if (p >= TIER_INFO.gold.minPoints) return 'gold';
  if (p >= TIER_INFO.silver.minPoints) return 'silver';
  return 'retail';
}

function getNextTier(currentTier) {
  const tiers = ['retail', 'silver', 'gold', 'diamond'];
  const idx = tiers.indexOf(currentTier);
  return idx < tiers.length - 1 ? tiers[idx + 1] : null;
}

function showLoading() {
  loadingState.style.display = 'block';
  errorState.style.display = 'none';
  mainContent.style.display = 'none';
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorState.style.display = 'block';
  loadingState.style.display = 'none';
  mainContent.style.display = 'none';
}

// Form OTP login / kích hoạt bằng SĐT + OTP
function renderOtpLogin() {
  loadingState.style.display = 'none';
  mainContent.style.display = 'none';
  errorState.style.display = 'block';

  // Tiêu đề trên ô lỗi
  errorMessage.textContent = 'Đăng nhập / kích hoạt tài khoản bằng số điện thoại';

  let wrapper = document.getElementById('otpLoginWrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.id = 'otpLoginWrapper';
    wrapper.style.marginTop = '12px';
    wrapper.innerHTML = `
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;">
        <div style="font-weight: 500; margin-bottom: 8px;">
          Nhập số điện thoại để nhận mã OTP (Zalo / SMS)
        </div>
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
          <input
            id="otpPhone"
            type="tel"
            placeholder="Số điện thoại"
            style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid #d1d5db;"
          />
          <button
            id="btnSendOtp"
            style="padding: 8px 12px; border-radius: 6px; border: none; background: #0ea5e9; color: white; font-weight: 500; white-space:nowrap;"
          >
            Gửi mã OTP
          </button>
        </div>
        <div
          id="otpCodeRow"
          style="display: none; gap: 8px; margin-bottom: 8px;"
        >
          <input
            id="otpCode"
            type="text"
            maxlength="6"
            placeholder="Mã OTP"
            style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid #d1d5db;"
          />
          <button
            id="btnVerifyOtp"
            style="padding: 8px 12px; border-radius: 6px; border: none; background: #16a34a; color: white; font-weight: 500; white-space:nowrap;"
          >
            Xác nhận
          </button>
        </div>
        <div
          id="otpMessage"
          style="font-size: 13px; color: #6b7280;"
        ></div>
      </div>
    `;
    errorState.appendChild(wrapper);

    const phoneInput = document.getElementById('otpPhone');
    const codeInput = document.getElementById('otpCode');
    const sendBtn = document.getElementById('btnSendOtp');
    const verifyBtn = document.getElementById('btnVerifyOtp');
    const codeRow = document.getElementById('otpCodeRow');
    const otpMessage = document.getElementById('otpMessage');

    // Gửi OTP
    sendBtn.addEventListener('click', async () => {
      const phone = phoneInput.value.trim();
      if (!phone) {
        otpMessage.textContent = 'Vui lòng nhập số điện thoại.';
        otpMessage.style.color = '#dc2626';
        return;
      }

      otpMessage.textContent = 'Đang gửi mã OTP...';
      otpMessage.style.color = '#6b7280';

      try {
        const res = await api('/auth/otp/send', {
          method: 'POST',
          body: JSON.stringify({ phone }),
        });

        // Nếu backend trả { ok: true, ... }
        if (!res || res.ok === false) {
          throw new Error(res?.error || 'Gửi mã OTP thất bại');
        }

        otpMessage.textContent = 'Đã gửi mã OTP. Vui lòng kiểm tra Zalo hoặc SMS.';
        otpMessage.style.color = '#16a34a';
        codeRow.style.display = 'flex';
      } catch (e) {
        otpMessage.textContent =
          e.message || 'Gửi mã OTP thất bại. Vui lòng thử lại.';
        otpMessage.style.color = '#dc2626';
      }
    });

    // Xác thực OTP
    verifyBtn.addEventListener('click', async () => {
      const phone = phoneInput.value.trim();
      const code = codeInput.value.trim();

      if (!phone || !code) {
        otpMessage.textContent = 'Vui lòng nhập đầy đủ số điện thoại và mã OTP.';
        otpMessage.style.color = '#dc2626';
        return;
      }

      otpMessage.textContent = 'Đang xác thực...';
      otpMessage.style.color = '#6b7280';

      try {
        const res = await api('/auth/otp/verify', {
          method: 'POST',
          body: JSON.stringify({
            phone,
            code,
            channel: 'web_member',
          }),
        });

        if (!res || res.ok === false || !res.token) {
          throw new Error(res?.error || 'Xác thực OTP thất bại');
        }

        // Lưu token & user_id để các trang khác dùng chung
        localStorage.setItem('customer_token', res.token);
        localStorage.setItem('x-token', res.token);
        if (res.customer && res.customer.id) {
          localStorage.setItem('user_id', res.customer.id);
        }

        otpMessage.textContent = 'Đăng nhập thành công, đang tải dữ liệu...';
        otpMessage.style.color = '#16a34a';

        // Gọi lại init() để load thông tin thành viên bằng token mới
        init();
      } catch (e) {
        otpMessage.textContent =
          e.message || 'Xác thực OTP thất bại. Vui lòng thử lại.';
        otpMessage.style.color = '#dc2626';
      }
    });
  }
}

function showContent() {
  mainContent.style.display = 'block';
  loadingState.style.display = 'none';
  errorState.style.display = 'none';
}


function renderTierCard(tier, points) {
  const info = TIER_INFO[tier];
  tierIcon.textContent = info.icon;
  tierName.textContent = info.name;
  tierPoints.textContent = `${formatNumber(points)} điểm`;
  tierCard.style.background = `linear-gradient(135deg, ${info.color} 0%, ${adjustBrightness(info.color, -20)} 100%)`;
}

function renderProgress(currentTier, points) {
  const nextTier = getNextTier(currentTier);
  
  if (!nextTier) {
    // Đã là tier cao nhất
    progressText.textContent = '🎉 Bạn đã đạt hạng thành viên cao nhất!';
    progressFill.style.width = '100%';
    return;
  }
  
  const currentMinPoints = TIER_INFO[currentTier].minPoints;
  const nextMinPoints = TIER_INFO[nextTier].minPoints;
  const pointsNeeded = nextMinPoints - points;
  const progress = ((points - currentMinPoints) / (nextMinPoints - currentMinPoints)) * 100;
  
  progressFill.style.width = Math.min(100, Math.max(0, progress)) + '%';
  progressText.textContent = `Tích lũy ${formatNumber(pointsNeeded)} điểm nữa để lên ${TIER_INFO[nextTier].name}`;
}

function renderTierList() {
  const tiers = ['retail', 'silver', 'gold', 'diamond'];
  const token = localStorage.getItem('customer_token') || localStorage.getItem('x-customer-token');
  const customerInfo = JSON.parse(localStorage.getItem('customer_info') || '{}');
  const currentTier = customerInfo.tier || 'retail';
  
  tierList.innerHTML = tiers.map(tier => {
    const info = TIER_INFO[tier];
    const isCurrent = tier === currentTier;
    const isLocked = tier !== currentTier && Object.keys(TIER_INFO).indexOf(tier) > Object.keys(TIER_INFO).indexOf(currentTier);
    
    return `
      <div class="tier-item ${isCurrent ? 'active' : ''} ${isLocked ? 'locked' : ''}">
        <div class="tier-header">
          <div>
            <div class="tier-title">${info.icon} ${info.name}</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
              Từ ${formatNumber(info.minPoints)} điểm
            </div>
          </div>
          <div>
            ${isCurrent ? '<span class="tier-badge badge-current">Hiện tại</span>' : ''}
            ${!isCurrent && !isLocked ? '<span class="tier-badge badge-next">Tiếp theo</span>' : ''}
            ${info.discount > 0 ? `<span style="font-weight: 700; color: #10b981; font-size: 14px;">-${info.discount}%</span>` : ''}
          </div>
        </div>
        <div style="margin-top: 12px;">
          ${info.benefits.map(b => `<div class="tier-benefit">${b}</div>`).join('')}
        </div>
      </div>
    `;
  }).join('');
}

async function init() {
  showLoading();
  
  try {
    const token = localStorage.getItem('customer_token') || 
                  localStorage.getItem('x-customer-token') || 
                  localStorage.getItem('x-token');
    
        if (!token) {
      // Chưa có token -> hiển thị form OTP để kích hoạt / đăng nhập
      renderOtpLogin();
      return;
    }

    
    // Gọi API để lấy thông tin mới nhất
    // Chúng ta dùng /orders/my vì nó trả về cả 'customer' object (sẽ được cấu hình ở bước 2)
    const data = await api('/orders/my');
    
    if (!data.customer || !data.customer.id) {
      // Fallback nếu API /orders/my chưa có customer
      const customerInfo = JSON.parse(localStorage.getItem('customer_info') || '{}');
      if (customerInfo.id) {
        console.warn('[Member] Using stale data from localStorage');
        const points = customerInfo.points || 0;
        const tier = customerInfo.tier || getCurrentTier(points);
        renderTierCard(tier, points);
        renderProgress(tier, points);
      } else {
        throw new Error('Không thể lấy thông tin khách hàng');
      }
    } else {
      // Sử dụng dữ liệu mới nhất từ API
      const customerInfo = data.customer;
      const points = customerInfo.points || 0;
      const tier = customerInfo.tier_name || getCurrentTier(points); // Ưu tiên tier_name từ API
      
      // Cập nhật lại localStorage
      localStorage.setItem('customer_info', JSON.stringify(customerInfo));
      
      renderTierCard(tier, points);
      renderProgress(tier, points);
    }

    // Render danh sách tier (việc này không cần data động)
    renderTierList();
    
    showContent();
    
  } catch (error) {
    console.error('[Member] Error:', error);
    showError('Lỗi khi tải thông tin: ' + error.message);
  }
}

function adjustBrightness(color, percent) {
  let r = parseInt(color.substring(1, 3), 16);
  let g = parseInt(color.substring(3, 5), 16);
  let b = parseInt(color.substring(5, 7), 16);

  r = Math.floor(r * (100 + percent) / 100);
  g = Math.floor(g * (100 + percent) / 100);
  b = Math.floor(b * (100 + percent) / 100);

  r = (r < 255) ? r : 255;
  g = (g < 255) ? g : 255;
  b = (b < 255) ? b : 255;
  
  r = (r > 0) ? r : 0;
  g = (g > 0) ? g : 0;
  b = (b > 0) ? b : 0;

  const RR = ((r.toString(16).length === 1) ? "0" + r.toString(16) : r.toString(16));
  const GG = ((g.toString(16).length === 1) ? "0" + g.toString(16) : g.toString(16));
  const BB = ((b.toString(16).length === 1) ? "0" + b.toString(16) : b.toString(16));

  return "#" + RR + GG + BB;
}

// Initialize
document.addEventListener('DOMContentLoaded', init);