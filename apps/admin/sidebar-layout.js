// ===================================================================
// sidebar-layout.js - Shared Sidebar Component
// Inject this into all admin pages for consistent layout
// ===================================================================

(function() {
  // Common styles for sidebar layout
  const styles = `
    <style id="admin-sidebar-styles">
      /* Reset */
      body.admin-layout {
        margin: 0;
        display: flex;
        min-height: 100vh;
        background: #f8fafc;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      /* Sidebar */
      .admin-sidebar {
        width: 260px;
        background: #fff;
        border-right: 1px solid #e5e7eb;
        display: flex;
        flex-direction: column;
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
        overflow-y: auto;
        transition: transform 0.3s ease;
        z-index: 100;
      }

      .admin-sidebar.collapsed {
        transform: translateX(-100%);
      }

      /* Logo */
      .admin-sidebar-logo {
        padding: 20px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .admin-sidebar-logo img {
        width: 32px;
        height: 32px;
        border-radius: 8px;
      }

      .admin-sidebar-logo-text {
        font-weight: 700;
        font-size: 16px;
        color: #0f172a;
      }

      /* Menu */
      .admin-sidebar-menu {
        padding: 12px 0;
        flex: 1;
      }

      .admin-menu-section {
        margin-bottom: 24px;
      }

      .admin-menu-section-title {
        padding: 8px 20px;
        font-size: 11px;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .admin-menu-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 20px;
        color: #475569;
        text-decoration: none;
        transition: all 0.2s;
        border-left: 3px solid transparent;
      }

      .admin-menu-item:hover {
        background: #f1f5f9;
        color: #0f172a;
        text-decoration: none;
      }

      .admin-menu-item.active {
        background: #eff6ff;
        color: #2563eb;
        border-left-color: #2563eb;
        font-weight: 600;
      }

      .admin-menu-icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      /* Main Content */
      .admin-main-content {
        margin-left: 260px;
        flex: 1;
        display: flex;
        flex-direction: column;
        transition: margin-left 0.3s ease;
      }

      .admin-main-content.expanded {
        margin-left: 0;
      }

      /* Top Bar */
      .admin-topbar {
        background: #fff;
        border-bottom: 1px solid #e5e7eb;
        padding: 12px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: sticky;
        top: 0;
        z-index: 50;
      }

      .admin-topbar-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .admin-menu-toggle {
        display: none;
        background: none;
        border: none;
        padding: 8px;
        cursor: pointer;
        color: #64748b;
      }

      .admin-topbar-title {
        font-size: 20px;
        font-weight: 700;
        color: #0f172a;
      }

      .admin-topbar-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .admin-topbar-user {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: #f8fafc;
        border-radius: 8px;
        cursor: pointer;
      }

      .admin-topbar-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 600;
        font-size: 14px;
      }

      /* Content Area */
      .admin-content-area {
        padding: 24px;
        flex: 1;
      }

      /* Sidebar Footer */
      .admin-sidebar-footer {
        padding: 16px;
        border-top: 1px solid #e5e7eb;
        font-size: 11px;
        color: #94a3b8;
      }

      /* Mobile */
      @media (max-width: 768px) {
        .admin-sidebar {
          transform: translateX(-100%);
        }

        .admin-sidebar.open {
          transform: translateX(0);
        }

        .admin-main-content {
          margin-left: 0;
        }

        .admin-menu-toggle {
          display: block;
        }

        .admin-sidebar-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 90;
        }

        .admin-sidebar-overlay.show {
          display: block;
        }
      }
    </style>
  `;

  // Sidebar HTML template
  const sidebarHTML = `
    <aside class="admin-sidebar" id="adminSidebar">
      <div class="admin-sidebar-logo">
        <img src="/public/logo.png" alt="Logo" onerror="this.style.display='none'">
        <div class="admin-sidebar-logo-text">SHOP HUY VÂN</div>
      </div>

      <nav class="admin-sidebar-menu">
        <div class="admin-menu-section">
          <div class="admin-menu-section-title">Quản lý chính</div>
          
          <a href="/index.html" class="admin-menu-item" data-page="index">
            <svg class="admin-menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
            </svg>
            Trang Chủ
          </a>

          <a href="/orders.html" class="admin-menu-item" data-page="orders">
            <svg class="admin-menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            Đơn Hàng
          </a>

          <a href="/products.html" class="admin-menu-item" data-page="products">
            <svg class="admin-menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
            </svg>
            Sản Phẩm
          </a>

          <a href="/categories.html" class="admin-menu-item" data-page="categories">
            <svg class="admin-menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
            </svg>
            Danh Mục
          </a>

          <a href="/vouchers.html" class="admin-menu-item" data-page="vouchers">
            <svg class="admin-menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
            Vouchers
          </a>

          <a href="/banners.html" class="admin-menu-item" data-page="banners">
            <svg class="admin-menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            Banners
          </a>

          <a href="/stats.html" class="admin-menu-item" data-page="stats">
            <svg class="admin-menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            Thống Kê
          </a>

          <a href="/shipping.html" class="admin-menu-item" data-page="shipping">
            <svg class="admin-menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/>
            </svg>
            Vận Chuyển
          </a>

          <a href="/shipping-providers.html" class="admin-menu-item" data-page="shipping-providers">
            <svg class="admin-menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            Đơn Vị Vận Chuyển
          </a>
        </div>

        <div class="admin-menu-section">
          <div class="admin-menu-section-title">Quản trị viên</div>
          
          <a href="/admin-users.html" class="admin-menu-item" data-page="admin-users">
            <svg class="admin-menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
            Danh Sách Admin
          </a>
		  <a href="/customers.html" class="admin-menu-item" data-page="customers">
            <svg class="admin-menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            Khách Hàng
          </a>
        </div>

        <div class="admin-menu-section">
          <div class="admin-menu-section-title">Cài đặt</div>
          
          <a href="/ads.html" class="admin-menu-item" data-page="ads">
            <svg class="admin-menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/>
            </svg>
            Marketing & Ads
          </a>

          <a href="/costs.html" class="admin-menu-item" data-page="costs">
            <svg class="admin-menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2-1.343-2-3-2zM3 10c0-1.105 1.343-2 3-2m0 0c1.657 0 3 .895 3 2s-1.343 2-3 2m0-4c-1.657 0-3 .895-3 2s1.343 2 3 2m0-4c-1.657 0-3 .895-3 2s1.343 2 3 2m12 0c0 1.105-1.343 2-3 2m0 0c-1.657 0-3-.895-3-2s1.343-2 3-2m0 4c1.657 0 3-.895 3-2s-1.343-2-3-2m0 4c1.657 0 3-.895 3-2s-1.343-2-3-2m-6 4c0 1.105-1.343 2-3 2m0 0c-1.657 0-3-.895-3-2s1.343-2 3-2m0 4c1.657 0 3-.895 3-2s-1.343-2-3-2"/>
            </svg>
            Quản lý Chi Phí
          </a>
        </div>
      </nav>

      <div class="admin-sidebar-footer">
        API: <span data-api-base></span>
      </div>
    </aside>

    <div class="admin-sidebar-overlay" id="adminSidebarOverlay"></div>
  `;

  // Topbar HTML template
  const topbarHTML = (pageTitle) => `
    <div class="admin-topbar">
      <div class="admin-topbar-left">
        <button class="admin-menu-toggle" id="adminMenuToggle">
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        <div class="admin-topbar-title">${pageTitle}</div>
      </div>

      <div class="admin-topbar-right">
        <div class="admin-topbar-user" onclick="AdminLayout.toggleUserMenu()">
          <div class="admin-topbar-avatar" id="adminUserAvatar">A</div>
          <div style="display: flex; flex-direction: column;">
            <div style="font-size: 13px; font-weight: 600;" id="adminUserName">Admin</div>
            <div style="font-size: 11px; color: #64748b;" id="adminUserRole">Super Admin</div>
          </div>
        </div>
        <button class="btn danger" onclick="AdminLayout.logout()">Đăng xuất</button>
      </div>
    </div>
  `;

  // Main layout wrapper
  window.AdminLayout = {
    init: function(pageTitle = 'Admin Panel') {
      // Add styles
      if (!document.getElementById('admin-sidebar-styles')) {
        document.head.insertAdjacentHTML('beforeend', styles);
      }

      // Add admin-layout class to body
      document.body.classList.add('admin-layout');

      // Wrap existing content
      const existingContent = document.body.innerHTML;
      document.body.innerHTML = '';

      // Create sidebar
      document.body.insertAdjacentHTML('afterbegin', sidebarHTML);

      // Create main content wrapper
      const mainContent = document.createElement('div');
      mainContent.className = 'admin-main-content';
      mainContent.id = 'adminMainContent';
      
      // Add topbar
      mainContent.insertAdjacentHTML('afterbegin', topbarHTML(pageTitle));
      
      // Add content area
      const contentArea = document.createElement('div');
      contentArea.className = 'admin-content-area';
      contentArea.id = 'adminContentArea';
      contentArea.innerHTML = existingContent;
      mainContent.appendChild(contentArea);
      
      document.body.appendChild(mainContent);

      // Set active menu item
      this.setActiveMenuItem();

      // Setup event listeners
      this.setupEventListeners();

      // Load user info
      this.loadUserInfo();
    },

    setActiveMenuItem: function() {
      const currentPath = location.pathname;
      const currentPage = currentPath.split('/').pop().replace('.html', '') || 'index';
      
      document.querySelectorAll('.admin-menu-item').forEach(item => {
        const page = item.getAttribute('data-page');
        if (page === currentPage || 
            (currentPage === '' && page === 'index') ||
            item.getAttribute('href') === currentPath) {
          item.classList.add('active');
        }
      });
    },

    setupEventListeners: function() {
      // Mobile menu toggle
      const sidebar = document.getElementById('adminSidebar');
      const overlay = document.getElementById('adminSidebarOverlay');
      const menuToggle = document.getElementById('adminMenuToggle');

      if (menuToggle) {
        menuToggle.addEventListener('click', () => {
          sidebar.classList.toggle('open');
          overlay.classList.toggle('show');
        });
      }

      if (overlay) {
        overlay.addEventListener('click', () => {
          sidebar.classList.remove('open');
          overlay.classList.remove('show');
        });
      }
    },

    toggleUserMenu: function() {
      // TODO: Implement dropdown menu
      console.log('User menu clicked');
    },

    logout: function() {
      if (confirm('Bạn có chắc muốn đăng xuất?')) {
        if (window.Admin) {
          window.Admin.token('');
        }
        location.href = '/login_admin.html';
      }
    },

    async loadUserInfo() {
      try {
        if (!window.Admin) return;
        
        const me = await window.Admin.me();
        if (me && me.ok && me.admin) {
          const admin = me.admin;
          document.getElementById('adminUserName').textContent = admin.full_name || admin.email;
          document.getElementById('adminUserRole').textContent = admin.role?.name || 'Admin';
          
          const firstLetter = (admin.full_name || admin.email || 'A').charAt(0).toUpperCase();
          document.getElementById('adminUserAvatar').textContent = firstLetter;
        }
      } catch(e) {
        console.warn('Load user info failed:', e);
      }
    }
  };

  // Auto-init when script is loaded (optional)
  // You can also call AdminLayout.init(pageTitle) manually in each page
})();