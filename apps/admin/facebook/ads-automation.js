// ads-automation.js - Facebook Ads Automation & Scheduler
(function() {
  'use strict';

  const API = (window.Admin && Admin.getApiBase && Admin.getApiBase()) || 'https://api.shophuyvan.vn';
  
  function toast(msg) {
    if (window.Admin && Admin.toast) {
      Admin.toast(msg);
    } else {
      alert(msg);
    }
  }

  // ============================================================
  // MODULE 1: FANPAGE MANAGER (Group Seeding Scheduler)
  // ============================================================

  const FanpageManager = {
    currentJobId: null,
    fanpagesCache: [],
    groupsCache: [],

    // Khởi tạo module
    init() {
      console.log('[FanpageManager] Initializing...');
      this.loadScheduledGroupPosts();
      this.loadFanpages();
    },

    // Load danh sách bài đã lên lịch cho Group
    async loadScheduledGroupPosts() {
      const container = document.getElementById('scheduled-group-posts-list');
      if (!container) return;

      container.innerHTML = '<div class="loading">Đang tải...</div>';

      try {
        const r = await Admin.req('/admin/facebook/groups/scheduled', { method: 'GET' });
        
        if (r && r.ok && Array.isArray(r.posts)) {
          this.renderScheduledGroupPosts(r.posts);
        } else {
          container.innerHTML = '<div class="alert alert-error">Không thể tải danh sách</div>';
        }
      } catch (e) {
        console.error('[FanpageManager] Load error:', e);
        container.innerHTML = '<div class="alert alert-error">Lỗi: ' + e.message + '</div>';
      }
    },

    // Render danh sách scheduled posts
    renderScheduledGroupPosts(posts) {
      const container = document.getElementById('scheduled-group-posts-list');
      if (!container) return;

      if (!posts || posts.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📅</div>
            <div class="empty-text">Chưa có bài đăng nào được lên lịch</div>
            <div class="empty-hint">Tạo lịch đăng bài bằng nút "⚙️ Phân phối" bên dưới</div>
          </div>
        `;
        return;
      }

      const html = posts.map(post => {
        const scheduledDate = new Date(post.scheduled_time);
        const isPast = scheduledDate < new Date();
        const status = post.status || 'pending';
        
        let statusBadge = '';
        if (status === 'pending') {
          statusBadge = '<span class="badge-scheduled">⏰ Chờ đăng</span>';
        } else if (status === 'published') {
          statusBadge = '<span class="badge-running">✅ Đã đăng</span>';
        } else if (status === 'failed') {
          statusBadge = '<span class="badge-ended">❌ Thất bại</span>';
        } else if (status === 'publishing') {
          statusBadge = '<span class="badge-running">🔄 Đang đăng...</span>';
        }

        const groupIds = Array.isArray(post.group_ids) ? post.group_ids : [];
        const groupCount = groupIds.length;

        return `
          <div class="schedule-card">
            <div class="schedule-header">
              <div class="schedule-name">${post.fanpage_name || 'Unknown Fanpage'}</div>
              ${statusBadge}
            </div>
            <div class="schedule-body">
              <div class="schedule-time">
                <span class="schedule-label">⏰ Thời gian:</span>
                <span class="schedule-value">${scheduledDate.toLocaleString('vi-VN')}</span>
              </div>
              <div class="schedule-time">
                <span class="schedule-label">📢 Số nhóm:</span>
                <span class="schedule-value">${groupCount} nhóm</span>
              </div>
              <div class="schedule-time">
                <span class="schedule-label">📝 Caption:</span>
                <span class="schedule-value" style="font-size:12px; color:#6b7280;">${(post.caption || '').substring(0, 100)}${post.caption && post.caption.length > 100 ? '...' : ''}</span>
              </div>
              ${post.error_message ? `<div class="alert alert-error" style="margin-top:8px; font-size:12px;">❌ ${post.error_message}</div>` : ''}
              ${post.results ? `
                <details style="margin-top:8px; font-size:12px;">
                  <summary style="cursor:pointer; color:#2563eb;">📊 Chi tiết kết quả</summary>
                  <pre style="background:#f9fafb; padding:8px; border-radius:4px; margin-top:4px; overflow:auto;">${JSON.stringify(JSON.parse(post.results), null, 2)}</pre>
                </details>
              ` : ''}
            </div>
            <div class="rule-footer">
              ${status === 'failed' ? `
                <button class="btn-icon" onclick="FanpageManager.retryScheduledPost(${post.id})" title="Thử lại">
                  🔄
                </button>
              ` : ''}
              ${status === 'pending' ? `
                <button class="btn-icon btn-danger" onclick="FanpageManager.deleteScheduledPost(${post.id})" title="Xóa">
                  🗑️
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');

      container.innerHTML = html;
    },

   // Load danh sách Fanpage vào dropdown
    async loadFanpages() {
      try {
        const r = await Admin.req('/admin/facebook/fanpages', { method: 'GET' });
        
        if (r && r.ok && Array.isArray(r.items)) {
          this.fanpagesCache = r.items;
          this.renderFanpageDropdown();
        }
      } catch (e) {
        console.error('[FanpageManager] Load fanpages error:', e);
      }
    },

    renderFanpageDropdown() {
      const select = document.getElementById('sched-fanpage-select');
      if (!select) return;

      if (this.fanpagesCache.length === 0) {
        select.innerHTML = '<option value="">-- Chưa có fanpage nào --</option>';
        return;
      }

      const html = '<option value="">-- Chọn fanpage --</option>' + 
        this.fanpagesCache.map(fp => 
          `<option value="${fp.page_id}" data-name="${fp.page_name}">${fp.page_name}</option>`
        ).join('');
      
      select.innerHTML = html;
    },

    // Load danh sách Group vào dropdown
    async loadGroups(fanpageId) {
      const select = document.getElementById('sched-group-select');
      if (!select) return;

      if (!fanpageId) {
        select.innerHTML = '<option value="">-- Chọn fanpage trước --</option>';
        return;
      }

      select.innerHTML = '<option value="">-- Đang tải... --</option>';

      try {
        const r = await Admin.req(`/admin/facebook/groups?fanpage_id=${fanpageId}`, { method: 'GET' });
        
        if (r && r.ok && Array.isArray(r.groups)) {
          this.groupsCache = r.groups;
          this.renderGroupDropdown();
        } else {
          select.innerHTML = '<option value="">-- Không tìm thấy group --</option>';
        }
      } catch (e) {
        console.error('[FanpageManager] Load groups error:', e);
        select.innerHTML = '<option value="">-- Lỗi tải groups --</option>';
      }
    },

    renderGroupDropdown() {
      const select = document.getElementById('sched-group-select');
      if (!select) return;

      if (this.groupsCache.length === 0) {
        select.innerHTML = '<option value="">-- Chưa có group nào --</option>';
        return;
      }

      const html = '<option value="">-- Chọn nhóm để share --</option>' + 
        this.groupsCache.map(g => 
          `<option value="${g.id}">${g.name}</option>`
        ).join('');
      
      select.innerHTML = html;
    },

    // Mở modal scheduler
    openScheduler(jobId, postLink) {
      this.currentJobId = jobId;
      
      const modal = document.getElementById('modal-scheduler');
      if (!modal) return;

      // Load fanpages nếu chưa có
      if (this.fanpagesCache.length === 0) {
        this.loadFanpages();
      }

      // Set job ID và post link
      const jobIdInput = document.getElementById('sched-job-id');
      if (jobIdInput) jobIdInput.value = jobId;

      // Lưu post link để dùng khi submit
      modal.dataset.postLink = postLink;

      modal.style.display = 'flex';
    },

    // Submit lịch đăng bài
    async submitSchedule() {
      const fanpageSelect = document.getElementById('sched-fanpage-select');
      const groupSelect = document.getElementById('sched-group-select');
      const timeInput = document.getElementById('sched-time');
      const captionInput = document.getElementById('sched-share-msg');
      const modal = document.getElementById('modal-scheduler');

      const fanpageId = fanpageSelect?.value;
      const groupId = groupSelect?.value;
      const scheduledTime = timeInput?.value;
      const caption = captionInput?.value?.trim() || '';
      const postLink = modal?.dataset?.postLink || '';

      if (!fanpageId) {
        toast('❌ Vui lòng chọn fanpage');
        return;
      }

      if (!groupId) {
        toast('❌ Vui lòng chọn nhóm');
        return;
      }

      if (!postLink) {
        toast('❌ Không tìm thấy link bài đăng');
        return;
      }

      // Chuyển đổi datetime-local sang timestamp
      let timestamp = Date.now();
      if (scheduledTime) {
        timestamp = new Date(scheduledTime).getTime();
        
        if (timestamp < Date.now()) {
          toast('⚠️ Thời gian đã qua, sẽ đăng ngay lập tức');
          timestamp = Date.now();
        }
      }

      // Lấy tên fanpage
      const selectedOption = fanpageSelect.options[fanpageSelect.selectedIndex];
      const fanpageName = selectedOption?.dataset?.name || 'Unknown';

      try {
        const r = await Admin.req('/admin/facebook/scheduler/group-posts', {
          method: 'POST',
          body: {
            fanpage_id: fanpageId,
            fanpage_name: fanpageName,
            group_ids: [groupId],
            post_link: postLink,
            caption: caption,
            scheduled_time: timestamp
          }
        });

        if (r && r.ok) {
          toast('✅ Đã lưu lịch đăng bài');
          modal.style.display = 'none';
          
          // Reset form
          fanpageSelect.selectedIndex = 0;
          groupSelect.selectedIndex = 0;
          timeInput.value = '';
          captionInput.value = '';
          
          // Reload danh sách
          this.loadScheduledGroupPosts();
        } else {
          toast('❌ ' + (r.error || 'Lưu lịch thất bại'));
        }
      } catch (e) {
        console.error('[FanpageManager] Submit error:', e);
        toast('❌ Lỗi: ' + e.message);
      }
    },

    // AI tạo caption cho group seeding
    async aiGroupCaption() {
      const btn = document.getElementById('btn-ai-seed');
      const input = document.getElementById('sched-share-msg');
      
      if (!input) return;

      const modal = document.getElementById('modal-scheduler');
      const postLink = modal?.dataset?.postLink || '';

      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Đang tạo...';
      }

      try {
        const r = await Admin.req('/admin/facebook/ai-caption', {
          method: 'POST',
          body: {
            type: 'group_seeding',
            post_link: postLink
          }
        });

        if (r && r.ok && r.caption) {
          input.value = r.caption;
          toast('✅ Đã tạo caption');
        } else {
          toast('❌ ' + (r.error || 'Tạo caption thất bại'));
        }
      } catch (e) {
        console.error('[FanpageManager] AI caption error:', e);
        toast('❌ Lỗi: ' + e.message);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '✨ AI Viết';
        }
      }
    },

    // Retry scheduled post bị lỗi
    async retryScheduledPost(id) {
      if (!confirm('Thử lại đăng bài này?')) return;

      try {
        const r = await Admin.req('/admin/facebook/scheduler/retry-group', {
          method: 'POST',
          body: { id }
        });

        if (r && r.ok) {
          toast('✅ Đã đưa vào hàng đợi thử lại');
          this.loadScheduledGroupPosts();
        } else {
          toast('❌ ' + (r.error || 'Retry thất bại'));
        }
      } catch (e) {
        toast('❌ Lỗi: ' + e.message);
      }
    },

    // Xóa scheduled post
    async deleteScheduledPost(id) {
      if (!confirm('Xóa lịch đăng bài này?')) return;

      try {
        const r = await Admin.req(`/admin/facebook/scheduler/group-posts/${id}`, {
          method: 'DELETE'
        });

        if (r && r.ok) {
          toast('✅ Đã xóa');
          this.loadScheduledGroupPosts();
        } else {
          toast('❌ ' + (r.error || 'Xóa thất bại'));
        }
      } catch (e) {
        toast('❌ Lỗi: ' + e.message);
      }
    },

    // Load scheduled posts với filter (cho dropdown filter)
    async loadScheduledPosts() {
      const statusFilter = document.getElementById('filter-post-status');
      const status = statusFilter ? statusFilter.value : null;
      
      if (status) {
        this.loadScheduledGroupPosts(); // Reload với filter nếu cần
      } else {
        this.loadScheduledGroupPosts();
      }
    },

    // Tìm kiếm viral content
    searchViral() {
      const keyword = document.getElementById('viralKeyword')?.value?.trim();
      
      if (!keyword) {
        toast('❌ Vui lòng nhập từ khóa tìm kiếm');
        return;
      }

      const resultsContainer = document.getElementById('viralResults');
      if (resultsContainer) {
        resultsContainer.innerHTML = '<div class="loading">🔍 Đang tìm kiếm viral content...</div>';
        
        // TODO: Implement viral search API
        setTimeout(() => {
          resultsContainer.innerHTML = `
            <div class="alert alert-info">
              🚧 Tính năng đang phát triển<br/>
              Sẽ tìm kiếm content viral theo từ khóa: <strong>${keyword}</strong>
            </div>
          `;
        }, 1000);
      }
    },

    // Mở modal scheduler (không cần params)
    openScheduler(jobId = null, postLink = null) {
      if (jobId) {
        this.currentJobId = jobId;
      }
      
      const modal = document.getElementById('modal-scheduler');
      if (!modal) return;

      // Load fanpages nếu chưa có
      if (this.fanpagesCache.length === 0) {
        this.loadFanpages();
      }

      // Set job ID và post link nếu có
      const jobIdInput = document.getElementById('sched-job-id');
      if (jobIdInput && jobId) {
        jobIdInput.value = jobId;
      }

      if (postLink) {
        modal.dataset.postLink = postLink;
      }

      modal.style.display = 'flex';
    },

    // Bắt đầu seeding
    startSeeding() {
      const seedingUrl = document.getElementById('seedingUrl')?.value?.trim();
      
      if (!seedingUrl) {
        toast('❌ Vui lòng nhập link bài viết');
        return;
      }

      const logContainer = document.getElementById('seedingLog');
      const btnStart = document.getElementById('btnStartSeeding');

      if (btnStart) {
        btnStart.disabled = true;
        btnStart.textContent = '⏳ Đang seeding...';
      }

      if (logContainer) {
        logContainer.innerHTML = '> Starting seeding process...\n';
        
        // TODO: Implement seeding API
        setTimeout(() => {
          logContainer.innerHTML += '> 🚧 Tính năng đang phát triển\n';
          logContainer.innerHTML += '> Sẽ seeding cho URL: ' + seedingUrl + '\n';
          
          if (btnStart) {
            btnStart.disabled = false;
            btnStart.textContent = '🚀 Bắt đầu Seeding';
          }
        }, 2000);
      }
    }
  };

  // ============================================================
  // MODULE 2: SCHEDULER MANAGER (Fanpage Posts Scheduler)
  // ============================================================

  const SchedulerManager = {
    // Load danh sách bài đã lên lịch cho Fanpage
    async loadScheduledPosts(status = null) {
      const container = document.getElementById('fanpage-scheduled-posts-list');
      if (!container) return;

      container.innerHTML = '<div class="loading">Đang tải...</div>';

      try {
        let url = '/admin/facebook/scheduler/posts';
        if (status) {
          url += `?status=${status}`;
        }

        const r = await Admin.req(url, { method: 'GET' });
        
        if (r && r.ok && Array.isArray(r.posts)) {
          this.renderScheduledPosts(r.posts);
        } else {
          container.innerHTML = '<div class="alert alert-error">Không thể tải danh sách</div>';
        }
      } catch (e) {
        console.error('[SchedulerManager] Load error:', e);
        container.innerHTML = '<div class="alert alert-error">Lỗi: ' + e.message + '</div>';
      }
    },

    renderScheduledPosts(posts) {
      const container = document.getElementById('fanpage-scheduled-posts-list');
      if (!container) return;

      if (!posts || posts.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📅</div>
            <div class="empty-text">Chưa có bài nào được lên lịch</div>
          </div>
        `;
        return;
      }

      const html = posts.map(post => {
        const scheduledDate = new Date(post.scheduled_time);
        const status = post.status || 'pending';
        
        let statusBadge = '';
        if (status === 'pending') {
          statusBadge = '<span class="badge-scheduled">⏰ Chờ đăng</span>';
        } else if (status === 'published') {
          statusBadge = '<span class="badge-running">✅ Đã đăng</span>';
        } else if (status === 'failed') {
          statusBadge = '<span class="badge-ended">❌ Thất bại</span>';
        }

        return `
          <div class="schedule-card">
            <div class="schedule-header">
              <div>
                <div class="schedule-name">${post.product_name || 'Unknown Product'}</div>
                <div style="font-size:12px; color:#6b7280; margin-top:2px;">${post.fanpage_name || 'Unknown Fanpage'}</div>
              </div>
              ${statusBadge}
            </div>
            <div class="schedule-body">
              <div class="schedule-time">
                <span class="schedule-label">⏰ Thời gian:</span>
                <span class="schedule-value">${scheduledDate.toLocaleString('vi-VN')}</span>
              </div>
              ${post.published_at ? `
                <div class="schedule-time">
                  <span class="schedule-label">✅ Đã đăng:</span>
                  <span class="schedule-value">${new Date(post.published_at).toLocaleString('vi-VN')}</span>
                </div>
              ` : ''}
              ${post.post_url ? `
                <div class="schedule-time">
                  <span class="schedule-label">🔗 Link:</span>
                  <a href="${post.post_url}" target="_blank" class="schedule-value" style="color:#2563eb;">Xem bài đăng</a>
                </div>
              ` : ''}
              ${post.error_message ? `
                <div class="alert alert-error" style="margin-top:8px; font-size:12px;">❌ ${post.error_message}</div>
              ` : ''}
            </div>
            ${status === 'failed' ? `
              <div class="rule-footer">
                <button class="btn-icon" onclick="SchedulerManager.retryFailedPost(${post.id})" title="Thử lại">
                  🔄 Thử lại
                </button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      container.innerHTML = html;
    },

    // Lên lịch hàng loạt cho Job
    async batchSchedule(jobId) {
      if (!jobId) {
        toast('❌ Không tìm thấy Job ID');
        return;
      }

      if (!confirm('Lên lịch tự động cho tất cả bài viết trong Job này?')) {
        return;
      }

      try {
        const r = await Admin.req('/admin/facebook/scheduler/batch', {
          method: 'POST',
          body: { jobId }
        });

        if (r && r.ok) {
          toast(`✅ Đã lên lịch cho ${r.count || 0} bài viết`);
          this.loadScheduledPosts();
        } else {
          toast('❌ ' + (r.error || 'Lên lịch thất bại'));
        }
      } catch (e) {
        toast('❌ Lỗi: ' + e.message);
      }
    },

    // Retry bài đăng thất bại
    async retryFailedPost(id) {
      if (!confirm('Thử lại đăng bài này?')) return;

      try {
        const r = await Admin.req('/admin/facebook/scheduler/retry', {
          method: 'POST',
          body: { id }
        });

        if (r && r.ok) {
          toast('✅ Đã đưa vào hàng đợi thử lại');
          this.loadScheduledPosts();
        } else {
          toast('❌ ' + (r.error || 'Retry thất bại'));
        }
      } catch (e) {
        toast('❌ Lỗi: ' + e.message);
      }
    }
  };

  // ============================================================
  // MODULE 3: AUTOMATION RULES
  // ============================================================

  const AutomationRules = {
    rulesCache: [],

    async loadRules() {
      const container = document.getElementById('automation-rules-list');
      if (!container) return;

      container.innerHTML = '<div class="loading">Đang tải...</div>';

      try {
        const r = await Admin.req('/admin/facebook/automation/rules', { method: 'GET' });
        
        if (r && r.ok && Array.isArray(r.rules)) {
          this.rulesCache = r.rules;
          this.renderRules(r.rules);
        } else {
          container.innerHTML = '<div class="alert alert-error">Không thể tải rules</div>';
        }
      } catch (e) {
        console.error('[AutomationRules] Load error:', e);
        container.innerHTML = '<div class="alert alert-error">Lỗi: ' + e.message + '</div>';
      }
    },

    renderRules(rules) {
      const container = document.getElementById('automation-rules-list');
      if (!container) return;

      if (!rules || rules.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🤖</div>
            <div class="empty-text">Chưa có automation rule nào</div>
            <div class="empty-hint">Tạo rule để tự động hóa quảng cáo</div>
          </div>
        `;
        return;
      }

      const html = rules.map(rule => {
        const isActive = rule.status === 'active';
        const cardClass = isActive ? 'rule-card' : 'rule-card rule-inactive';

        return `
          <div class="${cardClass}">
            <div class="rule-header">
              <div class="rule-info">
                <div class="rule-icon">${rule.icon || '⚙️'}</div>
                <div>
                  <div class="rule-name">${rule.name}</div>
                  <div class="rule-type">${rule.type || 'Custom Rule'}</div>
                </div>
              </div>
              <div class="rule-actions">
                <button class="btn-icon" onclick="AutomationRules.toggleRule(${rule.id})" title="${isActive ? 'Tắt' : 'Bật'}">
                  ${isActive ? '⏸️' : '▶️'}
                </button>
                <button class="btn-icon" onclick="AutomationRules.editRule(${rule.id})" title="Sửa">
                  ✏️
                </button>
                <button class="btn-icon btn-danger" onclick="AutomationRules.deleteRule(${rule.id})" title="Xóa">
                  🗑️
                </button>
              </div>
            </div>
            <div class="rule-body">
              <div class="rule-conditions">
                <strong>Điều kiện:</strong> ${rule.conditions || 'N/A'}
              </div>
              <div class="rule-actions-desc">
                <strong>Hành động:</strong> ${rule.actions || 'N/A'}
              </div>
            </div>
            <div class="rule-footer">
              <div class="rule-stat">🔥 Đã chạy: ${rule.execution_count || 0} lần</div>
              <div class="rule-stat">⏰ Cập nhật: ${new Date(rule.updated_at).toLocaleDateString('vi-VN')}</div>
            </div>
          </div>
        `;
      }).join('');

      container.innerHTML = html;
    },

    async toggleRule(id) {
      try {
        const rule = this.rulesCache.find(r => r.id === id);
        if (!rule) return;

        const newStatus = rule.status === 'active' ? 'inactive' : 'active';

        const r = await Admin.req(`/admin/facebook/automation/rules/${id}`, {
          method: 'PATCH',
          body: { status: newStatus }
        });

        if (r && r.ok) {
          toast(`✅ Đã ${newStatus === 'active' ? 'bật' : 'tắt'} rule`);
          this.loadRules();
        } else {
          toast('❌ ' + (r.error || 'Cập nhật thất bại'));
        }
      } catch (e) {
        toast('❌ Lỗi: ' + e.message);
      }
    },

    async deleteRule(id) {
      if (!confirm('Xóa rule này?')) return;

      try {
        const r = await Admin.req(`/admin/facebook/automation/rules/${id}`, {
          method: 'DELETE'
        });

        if (r && r.ok) {
          toast('✅ Đã xóa');
          this.loadRules();
        } else {
          toast('❌ ' + (r.error || 'Xóa thất bại'));
        }
      } catch (e) {
        toast('❌ Lỗi: ' + e.message);
      }
    },

    editRule(id) {
      toast('🚧 Tính năng đang phát triển');
      // TODO: Implement edit rule modal
    }
  };

  // ============================================================
  // EVENT LISTENERS - Fanpage select change
  // ============================================================

  function attachEventListeners() {
    const fanpageSelect = document.getElementById('sched-fanpage-select');
    if (fanpageSelect) {
      fanpageSelect.addEventListener('change', function() {
        const fanpageId = this.value;
        if (fanpageId) {
          FanpageManager.loadGroups(fanpageId);
        }
      });
    }
  }

  // ============================================================
  // INIT
  // ============================================================

  function init() {
    console.log('[Automation] Initializing modules...');
    attachEventListeners();
  }

  // ============================================================
  // EXPORT TO WINDOW
  // ============================================================

  window.FanpageManager = FanpageManager;
  window.SchedulerManager = SchedulerManager;
  window.AutomationRules = AutomationRules;

  // Auto init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

console.log('✅ ads-automation.js loaded');
