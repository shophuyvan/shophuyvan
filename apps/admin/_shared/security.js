// ===================================================================
// security.js - Advanced Security System with Toggle
// ===================================================================

(function() {
  'use strict';

  // ===================================================================
  // CONFIGURATION
  // ===================================================================
  
  const CONFIG = {
    // 🔧 TOGGLE: Bật/tắt security (lưu trong Cookie - share giữa admin & FE)
    get enabled() {
      const value = document.cookie.split('; ').find(row => row.startsWith('security_enabled='));
      if (!value) return true; // Mặc định bật
      return value.split('=')[1] === 'true';
    },
    set enabled(value) {
      // Set cookie với domain .shophuyvan.vn để share
      const val = value ? 'true' : 'false';
      document.cookie = `security_enabled=${val}; path=/; domain=.shophuyvan.vn; max-age=31536000; SameSite=Lax`;
      console.log(value ? '🔒 Security ENABLED' : '🔓 Security DISABLED');
    },

    // Tự động detect môi trường
    get isProduction() {
      return !['localhost', '127.0.0.1'].includes(location.hostname) &&
             !location.hostname.includes('192.168') &&
             !location.hostname.includes('.local') &&
             !location.hostname.includes('.pages.dev'); // Cloudflare Pages preview
    },

    // Level bảo mật (có thể điều chỉnh)
    disableConsole: true,
    blockDevTools: true,
    disableRightClick: true,
    disableKeyboardShortcuts: true,
    disableTextSelection: true,
    disableCopy: true
  };

  // ===================================================================
  // SECURITY TOGGLE UI (Floating Button)
  // ===================================================================
  
async function createSecurityToggle() {
    // Chỉ hiện toggle trong admin pages
    // Detect admin domain hoặc local dev
    const isAdminSite = 
      location.hostname.includes('admin.shophuyvan') || // Production
      location.hostname === 'localhost' || // Local dev
      location.hostname.includes('192.168') || // Local network
      location.hostname.includes('.pages.dev'); // Cloudflare preview

    if (!isAdminSite) {
      return; // Chỉ show toggle ở admin site
    }

    // Check Super Admin
    try {
      if (typeof Admin !== 'undefined' && Admin.me) {
        const me = await Admin.me();
        if (!me?.ok || !me?.admin) return;
        
        // Chỉ show nút cho Super Admin
        const isSuperAdmin = me.admin.role?.name === 'Super Admin' || 
                             me.admin.role?.slug === 'super_admin' ||
                             me.admin.role?.name === 'super_admin';
        
        if (!isSuperAdmin) return;
      }
    } catch(e) {
      console.warn('Could not check admin role:', e);
      return;
    }

    const toggleHTML = `
      <div id="security-toggle" style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999999;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 16px;
        border-radius: 50px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      ">
        <span id="security-icon">🔒</span>
        <span id="security-text">Security</span>
        <div style="
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
          background-color: rgba(255,255,255,0.3);
          border-radius: 24px;
          transition: .4s;
        ">
          <span style="
            position: absolute;
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
            transform: ${CONFIG.enabled ? 'translateX(20px)' : 'translateX(0)'};
          "></span>
        </div>
      </div>
    `;

    // Inject vào body khi DOM ready
    if (document.body) {
      document.body.insertAdjacentHTML('beforeend', toggleHTML);
      setupToggleEvents();
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.insertAdjacentHTML('beforeend', toggleHTML);
        setupToggleEvents();
      });
    }
  }

  function setupToggleEvents() {
    const toggle = document.getElementById('security-toggle');
    const icon = document.getElementById('security-icon');
    const slider = document.querySelector('#security-toggle span span');

    if (!toggle) return;

    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Toggle state
      const newState = !CONFIG.enabled;
      CONFIG.enabled = newState;
      
      // Update UI
      icon.textContent = newState ? '🔒' : '🔓';
      if (slider) {
        slider.style.transform = newState ? 'translateX(20px)' : 'translateX(0)';
      }
      
      // Show notification
      showNotification(
        newState ? 'Security Enabled' : 'Security Disabled',
        newState ? '🔒' : '🔓'
      );

      // Reload page để apply changes
      setTimeout(() => location.reload(), 1000);
    });

    // Hover effect
    toggle.addEventListener('mouseenter', () => {
      toggle.style.transform = 'scale(1.05)';
      toggle.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
    });

    toggle.addEventListener('mouseleave', () => {
      toggle.style.transform = 'scale(1)';
      toggle.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    });
  }

  function showNotification(message, icon) {
    const notif = document.createElement('div');
    notif.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000000;
      background: white;
      color: #111827;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: slideIn 0.3s ease-out;
    `;
    notif.innerHTML = `<span style="font-size: 20px;">${icon}</span> ${message}`;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 2000);
  }

  // ===================================================================
  // 1. DISABLE CONSOLE
  // ===================================================================
  
  function disableConsole() {
    if (!CONFIG.enabled || !CONFIG.disableConsole) return;

    const noop = function() {};
    const consoleMethods = [
      'log', 'debug', 'info', 'warn', 'error', 
      'table', 'trace', 'dir', 'dirxml', 'group', 
      'groupCollapsed', 'groupEnd', 'clear', 'count', 
      'countReset', 'assert', 'profile', 'profileEnd', 
      'time', 'timeLog', 'timeEnd', 'timeStamp'
    ];

    consoleMethods.forEach(method => {
      if (console[method]) {
        console[method] = noop;
      }
    });

    Object.freeze(console);
  }

  // ===================================================================
  // 2. DETECT & BLOCK DEVTOOLS
  // ===================================================================
  
  let devtoolsOpen = false;

  function detectDevTools() {
    if (!CONFIG.enabled || !CONFIG.blockDevTools) return;

    const threshold = 160;
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    
    if (widthThreshold || heightThreshold) {
      if (!devtoolsOpen) {
        devtoolsOpen = true;
        handleDevToolsOpen();
      }
    } else {
      devtoolsOpen = false;
    }
  }

  function checkDebugger() {
    if (!CONFIG.enabled || !CONFIG.blockDevTools) return;

    const start = performance.now();
    debugger;
    const end = performance.now();
    
    if (end - start > 100) {
      handleDevToolsOpen();
    }
  }

  function handleDevToolsOpen() {
    // Blur content
    document.body.style.filter = 'blur(10px)';
    document.body.style.pointerEvents = 'none';

    // Show warning overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.95);
      z-index: 9999999;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    overlay.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 80px; margin-bottom: 20px;">⛔</div>
        <h1 style="font-size: 32px; margin-bottom: 12px;">DevTools Detected</h1>
        <p style="font-size: 16px; color: #9ca3af; margin-bottom: 30px;">
          Vui lòng đóng Developer Tools để tiếp tục
        </p>
        <button onclick="location.reload()" style="
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 12px 32px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        ">
          🔄 Reload Page
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  // ===================================================================
  // 3. DISABLE RIGHT CLICK & KEYBOARD SHORTCUTS
  // ===================================================================
  
  function setupEventBlockers() {
    if (!CONFIG.enabled) return;

    // Chặn chuột phải
    if (CONFIG.disableRightClick) {
      document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        showNotification('Right-click disabled', '🚫');
        return false;
      });
    }

    // Chặn phím tắt
    if (CONFIG.disableKeyboardShortcuts) {
      document.addEventListener('keydown', function(e) {
        // F12
        if (e.key === 'F12' || e.keyCode === 123) {
          e.preventDefault();
          showNotification('F12 disabled', '🚫');
          return false;
        }

        // Ctrl+Shift+I/J/C (DevTools)
        if (e.ctrlKey && e.shiftKey && 
            ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
          e.preventDefault();
          showNotification('Shortcut disabled', '🚫');
          return false;
        }

        // Ctrl+U (View Source)
        if (e.ctrlKey && e.key.toUpperCase() === 'U') {
          e.preventDefault();
          showNotification('View source disabled', '🚫');
          return false;
        }

        // Ctrl+S (Save)
        if (e.ctrlKey && e.key.toUpperCase() === 'S') {
          e.preventDefault();
          showNotification('Save disabled', '🚫');
          return false;
        }
      });
    }

    // Chặn select text
    if (CONFIG.disableTextSelection) {
      document.addEventListener('selectstart', function(e) {
        if (!e.target.matches('input, textarea')) {
          e.preventDefault();
          return false;
        }
      });
    }

    // Chặn copy
    if (CONFIG.disableCopy) {
      document.addEventListener('copy', function(e) {
        if (!e.target.matches('input, textarea')) {
          e.preventDefault();
          showNotification('Copy disabled', '🚫');
          return false;
        }
      });
    }
  }

  // ===================================================================
  // 4. INIT SECURITY SYSTEM
  // ===================================================================
  
  function initSecurity() {
    // Always show toggle (even when disabled)
    createSecurityToggle();

    // Only apply security if enabled
    if (CONFIG.enabled) {
      console.log('🔒 Security System: ACTIVE');

      // Disable console
      disableConsole();

      // Setup event blockers
      setupEventBlockers();

      // Start DevTools detection
      if (CONFIG.blockDevTools) {
        setInterval(detectDevTools, 1000);
        setInterval(checkDebugger, 3000);
        window.addEventListener('resize', detectDevTools);
      }
    } else {
      console.log('🔓 Security System: DISABLED (Dev Mode)');
    }
  }

  // Run on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSecurity);
  } else {
    initSecurity();
  }

})();