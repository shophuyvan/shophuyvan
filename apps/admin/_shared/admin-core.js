/* [FILE: apps/admin/_shared/admin-core.js] */
(function () {
  'use strict';

  const API_BASE = 'https://api.shophuyvan.vn';

  window.Admin = {
    // Get/Set token
    token: function(val) {
      if (arguments.length === 0) {
        return localStorage.getItem('admin_token') || '';
      }
      if (!val) {
        localStorage.removeItem('admin_token');
      } else {
        localStorage.setItem('admin_token', val);
      }
    },

    // API request helper
    req: async function(path, method = 'GET', body = null) {
      const token = this.token();
      
      const opts = {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (token) {
        opts.headers['Authorization'] = `Bearer ${token}`;
      }

      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        opts.body = JSON.stringify(body);
      }

      const url = path.startsWith('http') ? path : API_BASE + path;
      const res = await fetch(url, opts);
      
      return await res.json();
    },

    // Get current admin info
    me: async function() {
      return await this.req('/admin/me');
    },

    // Toast notification
    toast: function(msg) {
      alert(msg); // Tạm dùng alert, sau có thể làm fancy hơn
    }
  };

  console.log('[Admin Core] window.Admin created');
})();