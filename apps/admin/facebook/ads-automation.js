// ===================================================================
// ads-automation.js - Facebook Ads Automation & Scheduling
// Auto-pause, Budget scaling, Campaign scheduling, A/B optimization
// ===================================================================

(function() {
  'use strict';

  const API = (window.Admin && Admin.getApiBase && Admin.getApiBase()) || 'https://api.shophuyvan.vn';
  let automationRules = [];
  let scheduledCampaigns = [];
  let availableFanpages = []; // ✅ NEW: Lưu danh sách Fanpage

  // ============================================================
  // UTILITIES
  // ============================================================

  function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount || 0);
  }

  function toast(msg) {
    if (window.Admin && Admin.toast) {
      Admin.toast(msg);
    } else {
      alert(msg);
    }
  }

  function showLoading(elementId, message = 'Đang tải...') {
    const el = document.getElementById(elementId);
    if (el) {
      el.innerHTML = `<div class="loading">${message}</div>`;
    }
  }

  function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.innerHTML = `<div class="alert alert-error">${message}</div>`;
    }
  }

 // ============================================================
  // API CALLS
  // ============================================================

 // ✅ NEW: Hàm tải danh sách Fanpage từ Backend (API Chuẩn)
  async function loadFanpages() {
    try {
      // Gọi API chuẩn /admin/fanpages (do fb-page-manager.js xử lý)
      const r = await Admin.req('/admin/fanpages', { method: 'GET' });
      
      if (r && r.ok) {
        // Map dữ liệu từ 'items' (backend chuẩn)
        availableFanpages = r.items || r.pages || [];
        console.log('[Automation] Loaded Fanpages:', availableFanpages.length);
        
        // Render vào tab Automation (mặc định)
        renderFanpageSelectOptions('fanpageSelect');
        // ✅ QUAN TRỌNG: Render ngay vào Modal Scheduler nếu đang mở
        renderFanpageSelectOptions('sched-fanpage-select');
        
        return true;
      } else {
        console.warn('[Automation] Không tải được danh sách Fanpage:', r.error);
        return false;
      }
    } catch (e) {
      console.error('[Automation] Lỗi tải Fanpage:', e);
      return false;
    }
  }

  async function loadAutomationRules() {
    try {
      const r = await Admin.req('/admin/facebook/automation/rules', { method: 'GET' });
      if (r && r.ok) {
        automationRules = r.rules || [];
        renderAutomationRules(automationRules);
        return true;
      } else {
        showError('automationRulesContainer', r.error || 'Không thể tải rules');
        return false;
      }
    } catch (e) {
      showError('automationRulesContainer', 'Lỗi: ' + e.message);
      return false;
    }
  }

  async function createAutomationRule(ruleData) {
    try {
      const r = await Admin.req('/admin/facebook/automation/rules', {
        method: 'POST',
        body: ruleData
      });

      if (r && r.ok) {
        toast('✅ Đã tạo automation rule');
        loadAutomationRules();
        return true;
      } else {
        toast('❌ ' + (r.error || 'Tạo rule thất bại'));
        return false;
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
      return false;
    }
  }

  async function deleteAutomationRule(ruleId) {
    if (!confirm('Bạn có chắc muốn xóa rule này?')) return;

    try {
      const r = await Admin.req(`/admin/facebook/automation/rules/${ruleId}`, {
        method: 'DELETE'
      });

      if (r && r.ok) {
        toast('✅ Đã xóa rule');
        loadAutomationRules();
      } else {
        toast('❌ ' + (r.error || 'Xóa thất bại'));
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    }
  }

  async function toggleAutomationRule(ruleId, enabled) {
    try {
      const r = await Admin.req(`/admin/facebook/automation/rules/${ruleId}/toggle`, {
        method: 'POST',
        body: { enabled }
      });

      if (r && r.ok) {
        toast(enabled ? '✅ Đã bật rule' : '⏸️ Đã tắt rule');
        loadAutomationRules();
      } else {
        toast('❌ ' + (r.error || 'Toggle thất bại'));
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    }
  }

  async function loadScheduledCampaigns() {
    try {
      const r = await Admin.req('/admin/facebook/automation/schedules', { method: 'GET' });
      if (r && r.ok) {
        scheduledCampaigns = r.schedules || [];
        renderScheduledCampaigns(scheduledCampaigns);
        return true;
      } else {
        showError('scheduledCampaignsContainer', r.error || 'Không thể tải schedules');
        return false;
      }
    } catch (e) {
      showError('scheduledCampaignsContainer', 'Lỗi: ' + e.message);
      return false;
    }
  }

  async function createCampaignSchedule(scheduleData) {
    try {
      const r = await Admin.req('/admin/facebook/automation/schedules', {
        method: 'POST',
        body: scheduleData
      });

      if (r && r.ok) {
        toast('✅ Đã tạo lịch campaign');
        loadScheduledCampaigns();
        return true;
      } else {
        toast('❌ ' + (r.error || 'Tạo lịch thất bại'));
        return false;
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
      return false;
    }
  }

  async function testCronExecution() {
    toast('⏳ Đang chạy test cron job...');
    try {
      const r = await Admin.req('/admin/facebook/automation/cron/test', {
        method: 'POST'
      });

      if (r && r.ok) {
        toast('✅ Cron job đã chạy thành công');
        if (r.results) {
          alert(`Kết quả:\n${JSON.stringify(r.results, null, 2)}`);
        }
      } else {
        toast('❌ ' + (r.error || 'Cron test thất bại'));
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    }
  }

  // ============================================================
  // RENDER FUNCTIONS
  // ============================================================

  // ✅ NEW: Hàm render danh sách Fanpage vào thẻ Select hoặc Div
  function renderFanpageSelectOptions(targetId = 'fanpageSelect') {
    const container = document.getElementById(targetId);
    if (!container) return;

    if (!availableFanpages || availableFanpages.length === 0) {
      container.innerHTML = '<option value="">-- Chưa có Fanpage kết nối --</option>';
      return;
    }

    // Render dạng Options cho thẻ <select>
    const optionsHTML = availableFanpages.map(page => 
      `<option value="${page.page_id}">${page.page_name}</option>`
    ).join('');

    container.innerHTML = `<option value="">-- Chọn Fanpage đăng bài --</option>` + optionsHTML;
  }

  function renderAutomationRules(rules) {
    const container = document.getElementById('automationRulesContainer');
    if (!container) return;

    if (!rules || rules.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🤖</div>
          <div class="empty-text">Chưa có automation rule nào</div>
          <div class="empty-hint">Tạo rule đầu tiên bằng form bên trái</div>
        </div>
      `;
      return;
    }

    const rulesHTML = rules.map(rule => {
      const statusClass = rule.enabled ? 'rule-active' : 'rule-inactive';
      const statusIcon = rule.enabled ? '✅' : '⏸️';
      
      return `
        <div class="rule-card ${statusClass}">
          <div class="rule-header">
            <div class="rule-info">
              <span class="rule-icon">${getRuleIcon(rule.type)}</span>
              <div>
                <div class="rule-name">${rule.name}</div>
                <div class="rule-type">${getRuleTypeLabel(rule.type)}</div>
              </div>
            </div>
            <div class="rule-actions">
              <button class="btn-icon" onclick="FacebookAdsAutomation.toggleRule('${rule.id}', ${!rule.enabled})" title="${rule.enabled ? 'Tắt' : 'Bật'}">
                ${statusIcon}
              </button>
              <button class="btn-icon btn-danger" onclick="FacebookAdsAutomation.deleteRule('${rule.id}')" title="Xóa">
                🗑️
              </button>
            </div>
          </div>
          
          <div class="rule-body">
            <div class="rule-conditions">
              <strong>Điều kiện:</strong>
              ${renderRuleConditions(rule)}
            </div>
            <div class="rule-actions-desc">
              <strong>Hành động:</strong>
              ${renderRuleActions(rule)}
            </div>
          </div>
          
          <div class="rule-footer">
            <span class="rule-stat">Đã chạy: ${rule.execution_count || 0} lần</span>
            <span class="rule-stat">Lần cuối: ${rule.last_execution ? new Date(rule.last_execution).toLocaleString('vi-VN') : 'Chưa chạy'}</span>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = rulesHTML;
  }

  function getRuleIcon(type) {
    const icons = {
      'auto_pause': '⏸️',
      'budget_scale': '📈',
      'ab_optimize': '🧪',
      'alert': '🔔'
    };
    return icons[type] || '⚙️';
  }

  function getRuleTypeLabel(type) {
    const labels = {
      'auto_pause': 'Auto Pause',
      'budget_scale': 'Budget Scaling',
      'ab_optimize': 'A/B Optimization',
      'alert': 'Alert Notification'
    };
    return labels[type] || type;
  }

  function renderRuleConditions(rule) {
    const conditions = [];
    
    if (rule.conditions) {
      if (rule.conditions.ctr_below) {
        conditions.push(`CTR < ${rule.conditions.ctr_below}%`);
      }
      if (rule.conditions.cpc_above) {
        conditions.push(`CPC > ${formatVND(rule.conditions.cpc_above)}`);
      }
      if (rule.conditions.roas_below) {
        conditions.push(`ROAS < ${rule.conditions.roas_below}x`);
      }
      if (rule.conditions.spend_above) {
        conditions.push(`Chi phí > ${formatVND(rule.conditions.spend_above)}`);
      }
      if (rule.conditions.duration_hours) {
        conditions.push(`Sau ${rule.conditions.duration_hours}h`);
      }
    }

    return conditions.length > 0 ? conditions.join(' và ') : 'Không có điều kiện';
  }

  function renderRuleActions(rule) {
    const actions = [];
    
    if (rule.actions) {
      if (rule.actions.pause_campaign) {
        actions.push('Tạm dừng campaign');
      }
      if (rule.actions.pause_ad) {
        actions.push('Tạm dừng ad');
      }
      if (rule.actions.scale_budget) {
        actions.push(`Tăng ngân sách ${rule.actions.scale_budget}%`);
      }
      if (rule.actions.send_notification) {
        actions.push('Gửi thông báo');
      }
      if (rule.actions.optimize_ab_test) {
        actions.push('Tối ưu A/B test');
      }
    }

    return actions.length > 0 ? actions.join(', ') : 'Không có hành động';
  }

  function renderScheduledCampaigns(schedules) {
    const container = document.getElementById('scheduledCampaignsContainer');
    if (!container) return;

    if (!schedules || schedules.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <div class="empty-text">Chưa có campaign được lên lịch</div>
        </div>
      `;
      return;
    }

    const schedulesHTML = schedules.map(schedule => {
      const startDate = new Date(schedule.start_time);
      const endDate = schedule.end_time ? new Date(schedule.end_time) : null;
      const now = new Date();
      
      let statusBadge = '';
      if (now < startDate) {
        statusBadge = '<span class="badge-scheduled">Chờ chạy</span>';
      } else if (endDate && now > endDate) {
        statusBadge = '<span class="badge-ended">Đã kết thúc</span>';
      } else {
        statusBadge = '<span class="badge-running">Đang chạy</span>';
      }

      return `
        <div class="schedule-card">
          <div class="schedule-header">
            <div class="schedule-name">${schedule.campaign_name}</div>
            ${statusBadge}
          </div>
          <div class="schedule-body">
            <div class="schedule-time">
              <span class="schedule-label">⏰ Bắt đầu:</span>
              <span class="schedule-value">${startDate.toLocaleString('vi-VN')}</span>
            </div>
            ${endDate ? `
              <div class="schedule-time">
                <span class="schedule-label">🏁 Kết thúc:</span>
                <span class="schedule-value">${endDate.toLocaleString('vi-VN')}</span>
              </div>
            ` : ''}
            <div class="schedule-time">
              <span class="schedule-label">💰 Ngân sách:</span>
              <span class="schedule-value">${formatVND(schedule.daily_budget)}/ngày</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = schedulesHTML;
  }

  // ============================================================
  // FORM HANDLERS
  // ============================================================

  function handleCreateAutoPauseRule() {
    const name = document.getElementById('autoPauseRuleName')?.value?.trim();
    const ctrThreshold = parseFloat(document.getElementById('autoPauseCTR')?.value || 0);
    const durationHours = parseInt(document.getElementById('autoPauseDuration')?.value || 48);

    if (!name || name.length < 3) {
      toast('❌ Tên rule phải có ít nhất 3 ký tự');
      return;
    }

    if (ctrThreshold <= 0 || ctrThreshold > 10) {
      toast('❌ CTR threshold phải từ 0.1% đến 10%');
      return;
    }

    const ruleData = {
      name,
      type: 'auto_pause',
      enabled: true,
      conditions: {
        ctr_below: ctrThreshold,
        duration_hours: durationHours,
        min_impressions: 1000
      },
      actions: {
        pause_campaign: false,
        pause_ad: true,
        send_notification: true
      }
    };

    createAutomationRule(ruleData);
  }

  function handleCreateBudgetScaleRule() {
    const name = document.getElementById('budgetScaleRuleName')?.value?.trim();
    const roasThreshold = parseFloat(document.getElementById('budgetScaleROAS')?.value || 3.0);
    const scalePercent = parseInt(document.getElementById('budgetScalePercent')?.value || 20);

    if (!name || name.length < 3) {
      toast('❌ Tên rule phải có ít nhất 3 ký tự');
      return;
    }

    if (roasThreshold <= 0) {
      toast('❌ ROAS threshold phải > 0');
      return;
    }

    if (scalePercent <= 0 || scalePercent > 100) {
      toast('❌ Scale percent phải từ 1% đến 100%');
      return;
    }

    const ruleData = {
      name,
      type: 'budget_scale',
      enabled: true,
      conditions: {
        roas_above: roasThreshold,
        min_conversions: 5
      },
      actions: {
        scale_budget: scalePercent,
        send_notification: true
      }
    };

    createAutomationRule(ruleData);
  }

  function handleCreateSchedule() {
    const campaignName = document.getElementById('scheduleCampaignName')?.value?.trim();
    const startTime = document.getElementById('scheduleStartTime')?.value;
    const endTime = document.getElementById('scheduleEndTime')?.value;
    const dailyBudget = parseInt(document.getElementById('scheduleDailyBudget')?.value || 0);

    if (!campaignName || campaignName.length < 3) {
      toast('❌ Tên campaign phải có ít nhất 3 ký tự');
      return;
    }

    if (!startTime) {
      toast('❌ Vui lòng chọn thời gian bắt đầu');
      return;
    }

    if (dailyBudget < 50000) {
      toast('❌ Ngân sách tối thiểu 50,000 VNĐ');
      return;
    }

    const scheduleData = {
      campaign_name: campaignName,
      start_time: new Date(startTime).toISOString(),
      end_time: endTime ? new Date(endTime).toISOString() : null,
      daily_budget: dailyBudget,
      auto_start: true,
      auto_stop: !!endTime
    };

    createCampaignSchedule(scheduleData);
  }

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  function attachAutomationEvents() {
    const btnAutoPause = document.getElementById('btnCreateAutoPauseRule');
    if (btnAutoPause) {
      btnAutoPause.onclick = handleCreateAutoPauseRule;
    }

    const btnBudgetScale = document.getElementById('btnCreateBudgetScaleRule');
    if (btnBudgetScale) {
      btnBudgetScale.onclick = handleCreateBudgetScaleRule;
    }

    const btnSchedule = document.getElementById('btnCreateSchedule');
    if (btnSchedule) {
      btnSchedule.onclick = handleCreateSchedule;
    }

    const btnTestCron = document.getElementById('btnTestCron');
    if (btnTestCron) {
      btnTestCron.onclick = testCronExecution;
    }

    const btnRefreshRules = document.getElementById('btnRefreshRules');
    if (btnRefreshRules) {
      btnRefreshRules.onclick = loadAutomationRules;
    }

    const btnRefreshSchedules = document.getElementById('btnRefreshSchedules');
    if (btnRefreshSchedules) {
      btnRefreshSchedules.onclick = loadScheduledCampaigns;
    }
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    console.log('[Automation] Initializing...');
    
    loadAutomationRules();
    loadScheduledCampaigns();
    loadFanpages(); // ✅ NEW: Tải Fanpage ngay khi vào trang
    attachAutomationEvents();
  }
  
  // ============================================================
  // FANPAGE HUB MANAGER (Moved from ads_real.js)
  // Quản lý Modal Lên lịch, Kho nội dung, Viral, Seeding
  // ============================================================

  window.FanpageManager = {
    init: function() {
       this.loadRepository();
    },
    
    // 1. Tải danh sách bài trong kho (Pending & Scheduled)
    loadRepository: async function() {
       const tbody = document.getElementById('repo-table-body');
       if(!tbody) return;
       tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">⏳ Đang tải kho nội dung...</td></tr>';

       try {
          const r = await Admin.req('/api/auto-sync/jobs?limit=50', { method: 'GET' });
          
          if(r.ok && r.jobs) {
            const pendingJobs = r.jobs.filter(j => j.status === 'assigned' || j.status === 'scheduled' || j.status === 'pending');
             
             if(pendingJobs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#666;">Kho trống. Hãy sang tab "Đăng bài" để tạo bài mới.</td></tr>';
                return;
             }

             tbody.innerHTML = pendingJobs.map(job => {
                const thumb = job.product_image || 'https://via.placeholder.com/50';
                let dateDisplay = '<span style="color:#f59e0b; font-size:12px;">⏳ Chờ lên lịch</span>';
                if (job.scheduled_time && job.scheduled_time > Date.now()) {
                    dateDisplay = `<span style="color:#2563eb; font-weight:bold; font-size:12px;">🕒 ${new Date(job.scheduled_time).toLocaleString('vi-VN')}</span>`;
                }

                return `
                   <tr style="border-bottom:1px solid #eee;">
                      <td style="padding:10px;">
                         <div style="display:flex; gap:10px; align-items:center;">
                            <img src="${thumb}" style="width:50px; height:50px; border-radius:4px; object-fit:cover; border:1px solid #eee;">
                            <div>
                               <div style="font-weight:bold; font-size:13px; color:#1f2937;">#${job.id} - ${job.product_name || 'Sản phẩm không tên'}</div>
                               <div style="font-size:11px; color:#6b7280;">Tạo lúc: ${new Date(job.created_at).toLocaleDateString('vi-VN')}</div>
                            </div>
                         </div>
                      </td>
                      <td style="padding:10px; font-size:12px; color:#374151;">
                         <div style="display:flex; align-items:center; gap:5px;">
                            <span>🎬 Video Sync</span>
                            ${job.total_variants ? `<span style="background:#e0e7ff; color:#3730a3; padding:2px 6px; border-radius:4px; font-size:10px;">${job.total_variants} Versions</span>` : ''}
                         </div>
                      </td>
                      <td style="padding:10px;">
                         ${dateDisplay}
                      </td>
                      <td style="padding:10px; text-align:center;">
                         <button class="btn-sm primary" onclick="FanpageManager.openScheduler(${job.id})" style="background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe;">⚙️ Cấu hình</button>
                      </td>
                   </tr>
                `;
             }).join('');
          } else {
             tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Không có dữ liệu.</td></tr>';
          }
       } catch(e) {
          console.error(e);
          tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Lỗi tải dữ liệu: ${e.message}</td></tr>`;
       }
    },

    // 2. Mở Modal Cấu hình & Load thông tin
    openScheduler: async function(jobId) {
        if (!jobId) {
            console.error('❌ Lỗi: openScheduler được gọi nhưng thiếu jobId');
            alert('Lỗi: Không tìm thấy ID bài viết!');
            return;
        }
        
        // Gán jobId vào input ẩn để dùng sau này
        const hiddenInput = document.getElementById('sched-job-id');
        if (hiddenInput) hiddenInput.value = jobId;
        
        const modal = document.getElementById('modal-scheduler');
        modal.style.display = 'flex';

        // --- ✅ LOGIC HIỂN THỊ FANPAGE (Đã sửa đổi) ---
        const fanpageSelect = document.getElementById('sched-fanpage-select');
        if (fanpageSelect) {
             // Nếu chưa có dữ liệu, hiện loading và gọi tải
             if (!availableFanpages || availableFanpages.length === 0) {
                 fanpageSelect.innerHTML = '<option value="">⏳ Đang tải danh sách...</option>';
                 await loadFanpages(); 
             } 
             // Nếu đã có (hoặc vừa tải xong), render ngay
             // Lưu ý: loadFanpages ở trên đã gọi render, nhưng gọi lại ở đây để chắc chắn
             renderFanpageSelectOptions('sched-fanpage-select');
        }
        // -----------------------------------------------------------------------

        // Reset form
        document.getElementById('sched-time').value = '';
        document.getElementById('sched-share-msg').value = '';
        const groupSelect = document.getElementById('sched-group-select');
        groupSelect.innerHTML = '<option>⏳ Đang tải dữ liệu...</option>';

        // Hiển thị thông tin Job
        let infoBox = document.getElementById('sched-fanpage-info');
        if (!infoBox) {
            infoBox = document.createElement('div');
            infoBox.id = 'sched-fanpage-info';
            infoBox.style.cssText = "background:#e0f2fe; color:#0369a1; padding:10px; border-radius:6px; margin-bottom:15px; font-size:13px; border:1px solid #bae6fd;";
            const modalBody = modal.querySelector('div[style*="overflow-y:auto"]');
            if(modalBody) modalBody.insertBefore(infoBox, modalBody.firstChild);
        }
        infoBox.innerHTML = '⏳ Đang lấy thông tin Job...';

        try {
            // A. Gọi API lấy chi tiết Job
            const rJob = await Admin.req(`/api/auto-sync/jobs/${jobId}`, { method: 'GET' });

            if(rJob.ok && rJob.job) {
                const pages = rJob.job.fanpages || [];
                const pageNames = pages.length > 0 ? pages.join(', ') : 'Chưa gán Fanpage nào';
                infoBox.innerHTML = `<strong>📢 Bài viết này sẽ được đăng lên:</strong><br>👉 ${pageNames}`;
            } else {
                infoBox.innerHTML = '⚠️ Không lấy được thông tin Job.';
            }

            // B. Gọi API lấy danh sách Group (Thêm log debug)
            console.log('[Automation] Fetching groups...');
            const rGroups = await Admin.req('/api/facebook/groups/fetch', { method: 'GET' });
            
            if(rGroups && rGroups.ok && rGroups.groups) {
                // Xử lý cả trường hợp rGroups.groups là mảng hoặc object {data: []}
                const list = Array.isArray(rGroups.groups) ? rGroups.groups : (rGroups.groups.data || []);
                
                if (list.length > 0) {
                    groupSelect.innerHTML = '<option value="">-- Chọn nhóm để share --</option>' + 
                        list.map(g => `<option value="${g.id}">${g.name} (${g.privacy || 'Group'})</option>`).join('');
                } else {
                    groupSelect.innerHTML = '<option value="">⚠️ Không tìm thấy nhóm nào (Token chưa có quyền)</option>';
                }
            } else {
                groupSelect.innerHTML = '<option value="">⚠️ Lỗi tải danh sách nhóm</option>';
            }
        } catch(e) {
            console.error(e);
            if (infoBox) infoBox.innerHTML = '❌ Lỗi kết nối: ' + e.message;
            if (groupSelect) groupSelect.innerHTML = '<option value="">❌ Lỗi tải dữ liệu</option>';
        }
    },

    // 3. AI Viết Caption Seeding
    aiGroupCaption: async function() {
        const btn = document.getElementById('btn-ai-seed');
        const input = document.getElementById('sched-share-msg');
        const oldText = btn.innerText;
        btn.disabled = true; btn.innerText = '🤖...';
        
        const seeds = [
            "Mọi người ơi, em mới săn được món này hay quá nè, ai cần không ạ? 👇",
            "Góc pass đồ: Shop em còn dư vài mẫu này xả lỗ, bác nào lấy ới em nhé.",
            "Hàng về đẹp xuất sắc, quay video thực tế cho cả nhà xem luôn ạ!",
            "Cứu cánh cho chị em nội trợ đây ạ, xem video mê luôn. 😍",
            "Em gom đơn món này giá siêu tốt, ai chung đơn không ạ?"
        ];
        
        setTimeout(() => {
            input.value = seeds[Math.floor(Math.random() * seeds.length)];
            btn.disabled = false; btn.innerText = oldText;
        }, 800);
    },

    // 4. Lưu & Kích hoạt Lịch
    submitSchedule: async function() {
        // ✅ FIX: Lấy jobId và kiểm tra kỹ
        const jobId = document.getElementById('sched-job-id').value;
        
        if (!jobId || jobId === 'undefined') {
            alert('❌ Lỗi: Không tìm thấy ID bài viết (Job ID bị thiếu). Vui lòng tải lại trang.');
            return;
        }

        const timeStr = document.getElementById('sched-time').value;
        const groupId = document.getElementById('sched-group-select').value;
        const fanpageId = document.getElementById('sched-fanpage-select')?.value; // Lấy Fanpage ID nếu có chọn

        let scheduledTime = null;
        if(timeStr) {
            scheduledTime = new Date(timeStr).getTime();
            if(scheduledTime < Date.now()) return alert('❌ Thời gian hẹn phải ở tương lai!');
        }

        const btn = event.target;
        const oldText = btn.innerText;
        btn.disabled = true; btn.innerText = '⏳ Đang lưu...';

        try {
            let r1;
            
            // LOGIC MỚI: Nếu không chọn giờ -> Đăng ngay (Publish)
            if (!scheduledTime) {
                // Kiểm tra xem đã chọn Fanpage chưa
                if (!fanpageId) throw new Error('Vui lòng chọn Fanpage để đăng ngay!');

                // 1. Gán Fanpage vào Job trước (nếu chưa gán)
                await Admin.req(`/api/auto-sync/jobs/${jobId}/assign-fanpages`, {
                    method: 'POST',
                    body: { assignments: [{ fanpageId: fanpageId, variantId: 1 }] } // Mặc định variant 1 hoặc lấy từ UI nếu có
                });

                // 2. Gọi lệnh Đăng Ngay
                btn.innerText = '🚀 Đang đăng...';
                r1 = await Admin.req(`/api/auto-sync/jobs/${jobId}/publish`, { method: 'POST' });
            } else {
                // Nếu có chọn giờ -> Lưu pending (như cũ)
                r1 = await Admin.req(`/api/auto-sync/jobs/${jobId}/save-pending`, {
                    method: 'POST',
                    body: { scheduledTime: scheduledTime }
                });
            }

            if(!r1.ok) throw new Error(r1.error || 'Lỗi xử lý');

            // Bước 2: Thông báo
            let msg = '✅ Đã lưu cấu hình thành công!';
            if (scheduledTime) msg += '\n⏰ Hệ thống sẽ tự động đăng vào giờ đã hẹn.';
            else msg += '\n🚀 Hệ thống sẽ xử lý đăng ngay bây giờ.';

            if (groupId) {
                 msg += `\n📢 Đã ghi nhận lệnh share vào Group.`;
            }

            alert(msg);
            document.getElementById('modal-scheduler').style.display = 'none';
            this.loadRepository();

        } catch(e) {
            alert('❌ Lỗi: ' + e.message);
        } finally {
            btn.disabled = false; btn.innerText = oldText;
        }
    },
    
    // Tìm kiếm Viral
    searchViral: function() {
       const keyword = document.getElementById('viralKeyword').value;
       const container = document.getElementById('viralResults');
       if(!keyword) return alert('❌ Vui lòng nhập từ khóa!');
       container.innerHTML = '<div class="loading">Đang quét Big Data...</div>';
       setTimeout(() => {
          container.innerHTML = `
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:16px;">
               <div class="card" style="padding:10px; border:1px solid #eee;">
                  <img src="https://via.placeholder.com/300x200?text=Viral+Trend" style="width:100%; border-radius:8px;">
                  <h4 style="margin:8px 0; font-size:14px;">Trend: ${keyword} #1</h4>
                  <div style="font-size:12px; color:#666;">🔥 1.2M Views • 👍 50k Likes</div>
                  <button class="btn-sm primary" style="width:100%; margin-top:8px;">📥 Lấy nội dung này</button>
               </div>
            </div>`;
       }, 1000);
    },

    // Seeding Tool
    startSeeding: function() {
       const url = document.getElementById('seedingUrl').value;
       if(!url) return alert('❌ Nhập link bài viết cần seeding');
       const btn = document.getElementById('btnStartSeeding');
       btn.disabled = true; btn.innerHTML = '⏳ Đang chạy seeding...';
       setTimeout(() => {
          btn.disabled = false; btn.innerHTML = '🚀 Bắt đầu Seeding';
          document.getElementById('seedingLog').innerHTML += `<div style="font-size:11px; margin-top:4px; color:#10b981;">✅ [${new Date().toLocaleTimeString()}] Done: ${url}</div>`;
       }, 2000);
    }
  };

  // ============================================================
  // EXPORT PUBLIC API
  // ============================================================

  window.FacebookAdsAutomation = {
    init,
    loadRules: loadAutomationRules,
    loadSchedules: loadScheduledCampaigns,
    loadFanpages, // ✅ Public hàm này
    renderFanpages: renderFanpageSelectOptions, // ✅ Public hàm render
    getFanpages: () => availableFanpages, // ✅ Getter lấy data
    createRule: createAutomationRule,
    deleteRule: deleteAutomationRule,
    toggleRule: toggleAutomationRule,
    createSchedule: createCampaignSchedule,
    testCron: testCronExecution
  };

})();

console.log('✅ ads-automation.js loaded');
