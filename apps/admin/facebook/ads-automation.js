// ===================================================================
// ads-automation.js - Facebook Ads Automation & Scheduling
// Auto-pause, Budget scaling, Campaign scheduling, A/B optimization
// ===================================================================

(function() {
  'use strict';

  const API = (window.Admin && Admin.getApiBase && Admin.getApiBase()) || 'https://api.shophuyvan.vn';
  let automationRules = [];
  let scheduledCampaigns = [];

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
    attachAutomationEvents();
  }

  // ============================================================
  // EXPORT PUBLIC API
  // ============================================================

  window.FacebookAdsAutomation = {
    init,
    loadRules: loadAutomationRules,
    loadSchedules: loadScheduledCampaigns,
    createRule: createAutomationRule,
    deleteRule: deleteAutomationRule,
    toggleRule: toggleAutomationRule,
    createSchedule: createCampaignSchedule,
    testCron: testCronExecution
  };

})();

console.log('✅ ads-automation.js loaded');
