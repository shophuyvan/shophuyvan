// apps/fe/src/lib/quick-register.js
const API_BASE = (window.API_BASE || 'https://api.shophuyvan.vn').replace(/\/+$/, '');

export async function quickRegister() {
  try {
    const response = await fetch(`${API_BASE}/auth/quick-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Không thể tạo tài khoản');
    }

    localStorage.setItem('customer_token', data.token);
    localStorage.setItem('x-customer-token', data.token);
    localStorage.setItem('x-token', data.token);
    
    if (data.customer) {
      localStorage.setItem('customer_info', JSON.stringify(data.customer));
    }

    showQuickRegisterPopup(data.user);

    return data;
  } catch (error) {
    console.error('[QuickRegister Error]', error);
    throw error;
  }
}

export function checkLoginBeforeAddCart(callback) {
  const token = localStorage.getItem('customer_token');
  
  if (!token) {
    showAddCartLoginPopup(callback);
    return false;
  }
  
  return true;
}

function showAddCartLoginPopup(callback) {
  const popup = document.createElement('div');
  popup.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s;" id="add-cart-login-popup">
      <div style="background:white;border-radius:20px;padding:32px;width:90%;max-width:400px;text-align:center;animation:slideUp 0.3s;">
        <div style="font-size:48px;margin-bottom:16px;">🛒</div>
        <h3 style="font-size:20px;font-weight:700;margin-bottom:12px;color:#111827;">Tạo tài khoản để lưu giỏ hàng?</h3>
        <p style="color:#6b7280;font-size:14px;margin-bottom:24px;">Chỉ mất 2 giây, không cần điền thông tin phức tạp!</p>
        
        <button id="popup-quick-register" style="width:100%;padding:14px;background:#007bff;color:white;border:none;border-radius:10px;font-weight:700;margin-bottom:8px;cursor:pointer;font-size:16px;">
          🚀 Tạo tài khoản nhanh
        </button>
        
        <button id="popup-skip" style="width:100%;padding:12px;background:#f3f4f6;border:none;border-radius:10px;font-weight:600;cursor:pointer;margin-bottom:8px;">
          Bỏ qua (không lưu giỏ hàng)
        </button>

        <button id="popup-login" style="width:100%;padding:10px;background:transparent;border:none;color:#6b7280;font-size:13px;text-decoration:underline;cursor:pointer;">
          Đã có tài khoản? Đăng nhập
        </button>
      </div>
    </div>
    <style>
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    </style>
  `;
  
  document.body.appendChild(popup);
  
  document.getElementById('popup-quick-register')?.addEventListener('click', async () => {
    try {
      document.getElementById('add-cart-login-popup').remove();
      await quickRegister();
      if (callback) callback();
    } catch (error) {
      alert('❌ Lỗi: ' + error.message);
    }
  });

  document.getElementById('popup-skip')?.addEventListener('click', () => {
    document.getElementById('add-cart-login-popup').remove();
    if (callback) callback();
  });

  document.getElementById('popup-login')?.addEventListener('click', () => {
    window.location.href = '/login.html?return=' + encodeURIComponent(window.location.pathname);
  });
}

function showQuickRegisterPopup(user) {
  const popup = document.createElement('div');
  popup.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s;" id="quick-register-popup">
      <div style="background:white;border-radius:20px;padding:32px;width:90%;max-width:440px;box-shadow:0 20px 60px rgba(0,0,0,0.3);animation:slideUp 0.3s;">
        
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:48px;margin-bottom:12px;">✅</div>
          <h2 style="font-size:24px;font-weight:700;color:#111827;margin-bottom:8px;">Tài khoản đã được tạo!</h2>
          <p style="color:#6b7280;font-size:14px;">Vui lòng lưu lại thông tin đăng nhập</p>
        </div>

        <div style="background:#f9fafb;border:2px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:20px;">
          <div style="margin-bottom:16px;">
            <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">📝 Tên đăng nhập</div>
            <div style="font-size:20px;font-weight:700;color:#111827;font-family:monospace;">${user.username}</div>
          </div>
          
          <div style="margin-bottom:16px;">
            <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">🔑 Mật khẩu</div>
            <div style="font-size:20px;font-weight:700;color:#111827;font-family:monospace;">${user.password}</div>
          </div>

          <div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">📧 Email tạm thời</div>
            <div style="font-size:13px;color:#6b7280;word-break:break-all;">${user.email}</div>
          </div>
        </div>

        <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;border-radius:8px;margin-bottom:20px;">
          <div style="font-size:13px;color:#92400e;">
            ⚠️ <strong>Quan trọng:</strong> Vui lòng chụp màn hình hoặc ghi lại thông tin này!<br>
            💡 Bạn có thể cập nhật email/SĐT trong phần <strong>Tài khoản của tôi</strong>
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <button onclick="copyQuickRegisterInfo('${user.username}', '${user.password}')" style="flex:1;padding:12px;background:#f3f4f6;border:2px solid #e5e7eb;border-radius:10px;font-weight:600;cursor:pointer;font-size:14px;">
            📋 Copy thông tin
          </button>
          <button onclick="window.location.href='/account.html'" style="flex:1;padding:12px;background:#f3f4f6;border:2px solid #e5e7eb;border-radius:10px;font-weight:600;cursor:pointer;font-size:14px;">
            👤 Tài khoản
          </button>
        </div>

        <button onclick="document.getElementById('quick-register-popup').remove();window.location.reload()" style="width:100%;padding:14px;background:#007bff;color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:16px;">
          🛍️ Tiếp tục mua sắm
        </button>
      </div>
    </div>
    <style>
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    </style>
  `;

  document.body.appendChild(popup);
  
  window.copyQuickRegisterInfo = (username, password) => {
    const text = `Thông tin đăng nhập Shop Huy Vân\n\nTên đăng nhập: ${username}\nMật khẩu: ${password}\n\nVui lòng lưu lại!`;
    
    navigator.clipboard.writeText(text).then(() => {
      alert('✅ Đã copy thông tin!');
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('✅ Đã copy thông tin!');
    });
  };
}