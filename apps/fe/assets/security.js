// ===================================================================
// security.js - Security System for FE (Frontend)
// Version: FE Only - No Toggle Button
// ===================================================================

(function() {
  'use strict';

  // ===================================================================
  // CONFIGURATION
  // ===================================================================
  
  const CONFIG = {
    // FE luôn bật security (không có toggle)
    enabled: true,

    // Tự động detect môi trường
    get isProduction() {
      return !['localhost', '127.0.0.1'].includes(location.hostname) &&
             !location.hostname.includes('192.168') &&
             !location.hostname.includes('.local') &&
             !location.hostname.includes('.pages.dev');
    },

    // Level bảo mật
    disableConsole: true,
    blockDevTools: true,
    disableRightClick: true,
    disableKeyboardShortcuts: true,
    disableTextSelection: false, // Cho phép select text trên FE
    disableCopy: false // Cho phép copy trên FE
  };

  // ===================================================================
  // 1. DISABLE CONSOLE
  // ===================================================================
  
  function disableConsole() {
    if (!CONFIG.enabled || !CONFIG.disableConsole || !CONFIG.isProduction) return;

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

    try {
      Object.freeze(console);
    } catch(e) {}
  }

  // ===================================================================
  // 2. DETECT & BLOCK DEVTOOLS
  // ===================================================================
  
  let devtoolsOpen = false;

  function detectDevTools() {
    if (!CONFIG.enabled || !CONFIG.blockDevTools || !CONFIG.isProduction) return;

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
    if (!CONFIG.enabled || !CONFIG.blockDevTools || !CONFIG.isProduction) return;

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
    if (!CONFIG.enabled || !CONFIG.isProduction) return;

    // Chặn chuột phải
    if (CONFIG.disableRightClick) {
      document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
      }, { passive: false });
    }

    // Chặn phím tắt
    if (CONFIG.disableKeyboardShortcuts) {
      document.addEventListener('keydown', function(e) {
        // F12
        if (e.key === 'F12' || e.keyCode === 123) {
          e.preventDefault();
          return false;
        }

        // Ctrl+Shift+I/J/C (DevTools)
        if (e.ctrlKey && e.shiftKey && 
            ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
          e.preventDefault();
          return false;
        }

        // Ctrl+U (View Source)
        if (e.ctrlKey && e.key.toUpperCase() === 'U') {
          e.preventDefault();
          return false;
        }

        // Ctrl+S (Save)
        if (e.ctrlKey && e.key.toUpperCase() === 'S') {
          e.preventDefault();
          return false;
        }
      }, { passive: false });
    }

    // Chặn select text (nếu enabled)
    if (CONFIG.disableTextSelection) {
      document.addEventListener('selectstart', function(e) {
        if (!e.target.matches('input, textarea')) {
          e.preventDefault();
          return false;
        }
      }, { passive: false });
    }

    // Chặn copy (nếu enabled)
    if (CONFIG.disableCopy) {
      document.addEventListener('copy', function(e) {
        if (!e.target.matches('input, textarea')) {
          e.preventDefault();
          return false;
        }
      }, { passive: false });
    }
  }

  // ===================================================================
  // 4. INIT SECURITY SYSTEM
  // ===================================================================
  
  function initSecurity() {
    if (!CONFIG.isProduction) {
      console.log('🔓 Security System: DISABLED (Dev Mode)');
      return;
    }

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
  }

  // Run on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSecurity);
  } else {
    initSecurity();
  }

})();
