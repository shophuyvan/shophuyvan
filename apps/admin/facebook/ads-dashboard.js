// ===================================================================
// ads-dashboard.js - Facebook Ads Dashboard Analytics
// Real-time metrics, ROI comparison, Alerts, Export
// ===================================================================

(function() {
  'use strict';

  const API = (window.Admin && Admin.getApiBase && Admin.getApiBase()) || 'https://api.shophuyvan.vn';
  let dashboardData = null;
  let autoRefreshInterval = null;
  let alertThresholds = {
    cpc_max: 50000, // VNĐ
    ctr_min: 1.0,   // %
    roas_min: 2.0
  };

  // ============================================================
  // UTILITIES
  // ============================================================

  function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount || 0);
  }

  function formatNumber(num) {
    return new Intl.NumberFormat('vi-VN').format(num || 0);
  }

  function formatPercent(num) {
    return (num || 0).toFixed(2) + '%';
  }

  function toast(msg) {
    if (window.Admin && Admin.toast) {
      Admin.toast(msg);
    } else {
      alert(msg);
    }
  }

  // ============================================================
  // API CALLS
  // ============================================================

  async function loadDashboardData() {
    try {
      // 1. Gọi API Facebook
      const fbPromise = Admin.req('/admin/facebook/dashboard/analytics', { method: 'GET' });
      
      // 2. Gọi API Zalo
      const zaloPromise = Admin.req('/admin/marketing/zalo/campaigns', { method: 'GET' });

      // Chạy song song cả 2 request
      const [fbRes, zaloRes] = await Promise.all([fbPromise, zaloPromise]);

      let allCampaigns = [];
      let combinedTotals = { spend: 0, impressions: 0, clicks: 0, conversions: 0, ctr: 0, cpc: 0 };

      // Xử lý dữ liệu Facebook
      if (fbRes && fbRes.ok && fbRes.data) {
        const fbData = fbRes.data;
        // Gán nhãn platform='facebook'
        if (fbData.campaigns) {
            allCampaigns = allCampaigns.concat(fbData.campaigns.map(c => ({...c, platform: 'facebook'})));
        }
        
        // Cộng dồn totals từ Facebook
        if (fbData.totals) {
            combinedTotals.spend += fbData.totals.spend || 0;
            combinedTotals.impressions += fbData.totals.impressions || 0;
            combinedTotals.clicks += fbData.totals.clicks || 0;
            combinedTotals.conversions += fbData.totals.conversions || 0;
        }
      }

      // Xử lý dữ liệu Zalo
      if (zaloRes && zaloRes.ok && zaloRes.data) {
         // API Zalo trả về danh sách campaigns, đã được module zalo-ads.js chuẩn hóa
         const zaloCampaigns = zaloRes.data.campaigns || [];
         
         // Gán nhãn platform='zalo' (nếu backend chưa gán) và gộp vào list chung
         allCampaigns = allCampaigns.concat(zaloCampaigns.map(c => ({...c, platform: c.platform || 'zalo'})));

         // Cộng dồn totals từ các campaign Zalo (vì Zalo API chưa trả totals sẵn)
         zaloCampaigns.forEach(c => {
             combinedTotals.spend += c.spend || 0;
             combinedTotals.impressions += c.impressions || 0;
             combinedTotals.clicks += c.clicks || 0;
             // Zalo Ads API cơ bản chưa trả về conversion, có thể bổ sung sau
         });
      }

      // Tính toán lại các chỉ số phần trăm trung bình (CTR, CPC) cho toàn bộ hệ thống
      if (combinedTotals.impressions > 0) {
          combinedTotals.ctr = (combinedTotals.clicks / combinedTotals.impressions) * 100;
      }
      if (combinedTotals.clicks > 0) {
          combinedTotals.cpc = combinedTotals.spend / combinedTotals.clicks;
      }

      // Cập nhật dữ liệu vào biến toàn cục và render
      dashboardData = { campaigns: allCampaigns, totals: combinedTotals };
      renderDashboard(dashboardData);
      checkAlerts(dashboardData);
      return true;

    } catch (e) {
      console.error(e);
      showError('dashboardContainer', 'Lỗi tải dữ liệu đa kênh: ' + e.message);
      return false;
    }
  }

  function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.innerHTML = `<div class="alert alert-error">${message}</div>`;
    }
  }

  // ============================================================
  // RENDER DASHBOARD
  // ============================================================

  function renderDashboard(data) {
    const container = document.getElementById('dashboardContainer');
    if (!container) return;

    const campaigns = data.campaigns || [];
    const totals = data.totals || {};

    // 1. Tổng quan metrics
    const overviewHTML = `
      <div class="analytics-overview">
        <div class="metric-card">
          <div class="metric-icon">📊</div>
          <div class="metric-value">${campaigns.length}</div>
          <div class="metric-label">Campaigns đang chạy</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">💰</div>
          <div class="metric-value">${formatVND(totals.spend || 0)}</div>
          <div class="metric-label">Tổng chi phí (7 ngày)</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">👁️</div>
          <div class="metric-value">${formatNumber(totals.impressions || 0)}</div>
          <div class="metric-label">Lượt hiển thị</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">🖱️</div>
          <div class="metric-value">${formatNumber(totals.clicks || 0)}</div>
          <div class="metric-label">Lượt click</div>
        </div>
        <div class="metric-card ${(totals.ctr || 0) < alertThresholds.ctr_min ? 'metric-alert' : ''}">
          <div class="metric-icon">📈</div>
          <div class="metric-value">${formatPercent(totals.ctr || 0)}</div>
          <div class="metric-label">CTR trung bình</div>
        </div>
        <div class="metric-card ${(totals.cpc || 0) > alertThresholds.cpc_max ? 'metric-alert' : ''}">
          <div class="metric-icon">💵</div>
          <div class="metric-value">${formatVND(totals.cpc || 0)}</div>
          <div class="metric-label">CPC trung bình</div>
        </div>
      </div>
    `;

    // 2. ROI Comparison Table
    const roiTableHTML = renderROITable(campaigns);

    // 3. Performance Chart (simplified)
    const chartHTML = renderPerformanceChart(campaigns);

    // 4. Alert notifications
    const alertsHTML = renderAlerts(data.alerts || []);

    container.innerHTML = `
      <div class="dashboard-header">
        <h2>📊 Dashboard Analytics</h2>
        <div class="dashboard-actions">
          <button id="btnRefreshDashboard" class="btn primary">🔄 Làm mới</button>
          <button id="btnExportPDF" class="btn">📄 Export PDF</button>
          <button id="btnExportExcel" class="btn">📊 Export Excel</button>
          <label class="auto-refresh-toggle">
            <input type="checkbox" id="autoRefreshToggle" ${autoRefreshInterval ? 'checked' : ''}/>
            <span>Auto-refresh (30s)</span>
          </label>
        </div>
      </div>

      ${alertsHTML}
      ${overviewHTML}
      
      <div class="dashboard-section">
        <h3>💹 So sánh ROI giữa các Campaigns</h3>
        ${roiTableHTML}
      </div>

      <div class="dashboard-section">
        <h3>📈 Performance Trends</h3>
        ${chartHTML}
      </div>
    `;

    // Attach event listeners
    attachDashboardEvents();
  }

  function renderROITable(campaigns) {
    if (!campaigns || campaigns.length === 0) {
      return '<div class="alert">Không có campaign nào</div>';
    }

    // Tính ROI và enrich dữ liệu
    const enriched = campaigns.map(c => {
      const revenue = (c.conversions || 0) * 500000; // Giả định
      const roi = c.spend > 0 ? ((revenue - c.spend) / c.spend * 100) : 0;
      const roas = c.spend > 0 ? (revenue / c.spend) : 0;
      return { ...c, revenue, roi, roas };
    });

    // Sắp xếp: Ưu tiên ROI cao nhất lên đầu
    enriched.sort((a, b) => b.roi - a.roi);

    const rows = enriched.map((c, idx) => {
      const isWinner = idx === 0 && c.roi > 0;
      const isLoser = c.roi < 0;
      const rowClass = isWinner ? 'roi-winner' : (isLoser ? 'roi-loser' : '');
      
      // Xác định Icon nền tảng
      const platformIcon = c.platform === 'zalo' 
          ? '<img src="https://zalo-ads-static.zadn.vn/ads-public/favicon.ico" width="20" title="Zalo Ads" style="vertical-align:middle">' 
          : '<img src="https://static.xx.fbcdn.net/rsrc.php/yD/r/d4ZIVX-5C-b.ico" width="20" title="Facebook Ads" style="vertical-align:middle">';

      return `
        <tr class="${rowClass}">
          <td class="text-center">${platformIcon}</td>
          <td>
            ${isWinner ? '🏆 ' : ''}<strong>${c.name || c.id}</strong>
            <br/>
            ${c.status === 'ACTIVE' ? '<span class="badge-active" style="font-size:0.8em">ACTIVE</span>' : '<span class="badge-paused" style="font-size:0.8em">PAUSED</span>'}
          </td>
          <td class="text-right">${formatVND(c.spend || 0)}</td>
          <td class="text-right">${formatVND(c.revenue || 0)}</td>
          <td class="text-right" style="color:${c.roi >= 0 ? 'green' : 'red'}"><strong>${c.roi.toFixed(1)}%</strong></td>
          <td class="text-right">${c.roas.toFixed(2)}x</td>
          <td class="text-right">${formatNumber(c.conversions || 0)}</td>
          <td class="text-right">${formatPercent(c.ctr || 0)}</td>
          <td class="text-right">${formatVND(c.cpc || 0)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="roi-table-wrapper">
        <table class="roi-table">
          <thead>
            <tr>
              <th class="text-center" width="50">Nền tảng</th>
              <th>Campaign</th>
              <th class="text-right">Chi phí</th>
              <th class="text-right">Doanh thu (ước tính)</th>
              <th class="text-right">ROI</th>
              <th class="text-right">ROAS</th>
              <th class="text-right">Chuyển đổi</th>
              <th class="text-right">CTR</th>
              <th class="text-right">CPC</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPerformanceChart(campaigns) {
    // Simplified chart (text-based bars for now)
    if (!campaigns || campaigns.length === 0) {
      return '<div class="alert">Không có dữ liệu</div>';
    }

    const maxSpend = Math.max(...campaigns.map(c => c.spend || 0));

    const bars = campaigns.slice(0, 5).map(c => {
      const width = maxSpend > 0 ? (c.spend / maxSpend * 100) : 0;
      return `
        <div class="chart-bar-row">
          <div class="chart-label">${(c.name || c.id).substring(0, 30)}</div>
          <div class="chart-bar-container">
            <div class="chart-bar" style="width: ${width}%"></div>
            <span class="chart-value">${formatVND(c.spend || 0)}</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="performance-chart">
        <div class="chart-title">Chi phí Top 5 Campaigns</div>
        ${bars}
      </div>
    `;
  }

  function renderAlerts(alerts) {
    if (!alerts || alerts.length === 0) {
      return '';
    }

    const alertItems = alerts.map(alert => {
      const icon = alert.type === 'warning' ? '⚠️' : (alert.type === 'danger' ? '🚨' : 'ℹ️');
      return `
        <div class="alert-item alert-${alert.type}">
          <span class="alert-icon">${icon}</span>
          <span class="alert-message">${alert.message}</span>
          <span class="alert-time">${new Date(alert.timestamp).toLocaleTimeString('vi-VN')}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="alerts-container">
        <div class="alerts-header">
          <h3>🔔 Cảnh báo</h3>
          <button id="btnClearAlerts" class="btn-text">Xóa tất cả</button>
        </div>
        <div class="alerts-list">
          ${alertItems}
        </div>
      </div>
    `;
  }

  // ============================================================
  // ALERTS SYSTEM
  // ============================================================

  function checkAlerts(data) {
    const alerts = [];
    const campaigns = data.campaigns || [];

    campaigns.forEach(c => {
      // Check CPC threshold
      if ((c.cpc || 0) > alertThresholds.cpc_max) {
        alerts.push({
          type: 'warning',
          message: `Campaign "${c.name}" có CPC cao (${formatVND(c.cpc)}) > ${formatVND(alertThresholds.cpc_max)}`,
          timestamp: new Date().toISOString(),
          campaign_id: c.id
        });
      }

      // Check CTR threshold
      if ((c.ctr || 0) < alertThresholds.ctr_min && c.impressions > 1000) {
        alerts.push({
          type: 'danger',
          message: `Campaign "${c.name}" có CTR thấp (${formatPercent(c.ctr)}) < ${alertThresholds.ctr_min}%`,
          timestamp: new Date().toISOString(),
          campaign_id: c.id
        });
      }

      // Check ROAS threshold
      const revenue = (c.conversions || 0) * 500000;
      const roas = c.spend > 0 ? (revenue / c.spend) : 0;
      if (roas < alertThresholds.roas_min && c.spend > 100000) {
        alerts.push({
          type: 'warning',
          message: `Campaign "${c.name}" có ROAS thấp (${roas.toFixed(2)}x) < ${alertThresholds.roas_min}x`,
          timestamp: new Date().toISOString(),
          campaign_id: c.id
        });
      }
    });

    // Show browser notifications if enabled
    if (alerts.length > 0 && Notification.permission === 'granted') {
      alerts.forEach(alert => {
        new Notification('Facebook Ads Alert', {
          body: alert.message,
          icon: '/icon.png'
        });
      });
    }

    return alerts;
  }

  // ============================================================
  // AUTO REFRESH
  // ============================================================

  function startAutoRefresh() {
    if (autoRefreshInterval) return;
    
    autoRefreshInterval = setInterval(() => {
      console.log('[Dashboard] Auto-refreshing...');
      loadDashboardData();
    }, 30000); // 30 seconds

    toast('✅ Đã bật auto-refresh (30s)');
  }

  function stopAutoRefresh() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
      toast('⏸️ Đã tắt auto-refresh');
    }
  }

  // ============================================================
  // EXPORT FUNCTIONS
  // ============================================================

  async function exportPDF() {
    toast('⏳ Đang tạo PDF...');
    try {
      const r = await Admin.req('/admin/facebook/dashboard/export/pdf', {
        method: 'POST',
        body: { data: dashboardData }
      });

      if (r && r.ok && r.url) {
        window.open(r.url, '_blank');
        toast('✅ Đã export PDF');
      } else {
        toast('❌ Export PDF thất bại');
      }
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    }
  }

  async function exportExcel() {
    toast('⏳ Đang tạo Excel...');
    try {
      // Simple CSV export
      if (!dashboardData || !dashboardData.campaigns) {
        toast('❌ Không có dữ liệu');
        return;
      }

      const campaigns = dashboardData.campaigns;
      let csv = 'Campaign,Chi phí,Hiển thị,Clicks,CTR,CPC,Chuyển đổi\n';
      
      campaigns.forEach(c => {
        csv += `"${c.name || c.id}",${c.spend || 0},${c.impressions || 0},${c.clicks || 0},${c.ctr || 0},${c.cpc || 0},${c.conversions || 0}\n`;
      });

      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `facebook-ads-report-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      toast('✅ Đã export Excel (CSV)');
    } catch (e) {
      toast('❌ Lỗi: ' + e.message);
    }
  }

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  function attachDashboardEvents() {
    const btnRefresh = document.getElementById('btnRefreshDashboard');
    if (btnRefresh) {
      btnRefresh.onclick = () => loadDashboardData();
    }

    const btnExportPDF = document.getElementById('btnExportPDF');
    if (btnExportPDF) {
      btnExportPDF.onclick = exportPDF;
    }

    const btnExportExcel = document.getElementById('btnExportExcel');
    if (btnExportExcel) {
      btnExportExcel.onclick = exportExcel;
    }

    const toggleAutoRefresh = document.getElementById('autoRefreshToggle');
    if (toggleAutoRefresh) {
      toggleAutoRefresh.onchange = (e) => {
        if (e.target.checked) {
          startAutoRefresh();
        } else {
          stopAutoRefresh();
        }
      };
    }

    const btnClearAlerts = document.getElementById('btnClearAlerts');
    if (btnClearAlerts) {
      btnClearAlerts.onclick = () => {
        const alertsContainer = document.querySelector('.alerts-container');
        if (alertsContainer) alertsContainer.remove();
      };
    }
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

function init() {
    console.log('[Dashboard Analytics] Initializing...');
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Đảm bảo container tồn tại
    const container = document.getElementById('dashboardContainer');
    if (!container) {
      console.error('[Dashboard] Container not found!');
      return;
    }

    loadDashboardData();
  }

  // ============================================================
  // EXPORT PUBLIC API
  // ============================================================

  window.FacebookAdsDashboard = {
    init,
    loadDashboardData,
    startAutoRefresh,
    stopAutoRefresh,
    exportPDF,
    exportExcel,
    setAlertThresholds: (thresholds) => {
      Object.assign(alertThresholds, thresholds);
    }
  };

})();

console.log('✅ ads-dashboard.js loaded');
