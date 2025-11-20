// File: workers/shv-api/src/modules/facebook-ads-automation.js
// Facebook Ads Automation - Auto-pause, Budget scaling, Scheduling, A/B optimization
// ===================================================================

import { json, errorResponse } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getJSON, putJSON } from '../lib/kv.js';

/**
 * Main handler for automation routes
 */
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Get automation rules
  if (path === '/admin/facebook/automation/rules' && method === 'GET') {
    return getAutomationRules(req, env);
  }

  // Create automation rule
  if (path === '/admin/facebook/automation/rules' && method === 'POST') {
    return createAutomationRule(req, env);
  }

  // Toggle automation rule
  if (path.match(/^\/admin\/facebook\/automation\/rules\/([^\/]+)\/toggle$/) && method === 'POST') {
    const ruleId = path.match(/^\/admin\/facebook\/automation\/rules\/([^\/]+)\/toggle$/)[1];
    return toggleAutomationRule(req, env, ruleId);
  }

  // Delete automation rule
  if (path.match(/^\/admin\/facebook\/automation\/rules\/([^\/]+)$/) && method === 'DELETE') {
    const ruleId = path.match(/^\/admin\/facebook\/automation\/rules\/([^\/]+)$/)[1];
    return deleteAutomationRule(req, env, ruleId);
  }

  // Get schedules
  if (path === '/admin/facebook/automation/schedules' && method === 'GET') {
    return getCampaignSchedules(req, env);
  }

  // Create schedule
  if (path === '/admin/facebook/automation/schedules' && method === 'POST') {
    return createCampaignSchedule(req, env);
  }

  // Test cron execution
  if (path === '/admin/facebook/automation/cron/test' && method === 'POST') {
    return testCronExecution(req, env);
  }

  return errorResponse('Route not found', 404, req);
}

// ===================================================================
// AUTOMATION RULES MANAGEMENT
// ===================================================================

async function getAutomationRules(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const rules = await getJSON(env, 'facebook:automation:rules', []);
    
    return json({
      ok: true,
      rules: rules,
      total: rules.length
    }, {}, req);

  } catch (e) {
    console.error('[Automation] Get rules error:', e);
    return errorResponse(e, 500, req);
  }
}

async function createAutomationRule(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await req.json();
    const { name, type, enabled, conditions, actions } = body;

    // Validation
    if (!name || name.length < 3) {
      return json({ ok: false, error: 'Tên rule phải có ít nhất 3 ký tự' }, { status: 400 }, req);
    }

    if (!type || !['auto_pause', 'budget_scale', 'ab_optimize', 'alert'].includes(type)) {
      return json({ ok: false, error: 'Type không hợp lệ' }, { status: 400 }, req);
    }

    // Create rule object
    const ruleId = 'rule_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const rule = {
      id: ruleId,
      name,
      type,
      enabled: enabled !== false,
      conditions: conditions || {},
      actions: actions || {},
      execution_count: 0,
      last_execution: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Save to KV
    const rules = await getJSON(env, 'facebook:automation:rules', []);
    rules.push(rule);
    await putJSON(env, 'facebook:automation:rules', rules);

    return json({
      ok: true,
      rule: rule,
      message: 'Đã tạo automation rule'
    }, {}, req);

  } catch (e) {
    console.error('[Automation] Create rule error:', e);
    return errorResponse(e, 500, req);
  }
}

async function toggleAutomationRule(req, env, ruleId) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await req.json();
    const { enabled } = body;

    const rules = await getJSON(env, 'facebook:automation:rules', []);
    const ruleIndex = rules.findIndex(r => r.id === ruleId);

    if (ruleIndex === -1) {
      return json({ ok: false, error: 'Không tìm thấy rule' }, { status: 404 }, req);
    }

    rules[ruleIndex].enabled = enabled !== false;
    rules[ruleIndex].updated_at = new Date().toISOString();

    await putJSON(env, 'facebook:automation:rules', rules);

    return json({
      ok: true,
      message: enabled ? 'Đã bật rule' : 'Đã tắt rule'
    }, {}, req);

  } catch (e) {
    console.error('[Automation] Toggle rule error:', e);
    return errorResponse(e, 500, req);
  }
}

async function deleteAutomationRule(req, env, ruleId) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const rules = await getJSON(env, 'facebook:automation:rules', []);
    const newRules = rules.filter(r => r.id !== ruleId);

    if (newRules.length === rules.length) {
      return json({ ok: false, error: 'Không tìm thấy rule' }, { status: 404 }, req);
    }

    await putJSON(env, 'facebook:automation:rules', newRules);

    return json({
      ok: true,
      message: 'Đã xóa rule'
    }, {}, req);

  } catch (e) {
    console.error('[Automation] Delete rule error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// CAMPAIGN SCHEDULING
// ===================================================================

async function getCampaignSchedules(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const schedules = await getJSON(env, 'facebook:automation:schedules', []);
    
    return json({
      ok: true,
      schedules: schedules,
      total: schedules.length
    }, {}, req);

  } catch (e) {
    console.error('[Automation] Get schedules error:', e);
    return errorResponse(e, 500, req);
  }
}

async function createCampaignSchedule(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await req.json();
    const { campaign_name, start_time, end_time, daily_budget, auto_start, auto_stop } = body;

    // Validation
    if (!campaign_name || campaign_name.length < 3) {
      return json({ ok: false, error: 'Tên campaign phải có ít nhất 3 ký tự' }, { status: 400 }, req);
    }

    if (!start_time) {
      return json({ ok: false, error: 'Thiếu start_time' }, { status: 400 }, req);
    }

    if (!daily_budget || daily_budget < 50000) {
      return json({ ok: false, error: 'Ngân sách tối thiểu 50,000 VNĐ' }, { status: 400 }, req);
    }

    // Create schedule object
    const scheduleId = 'schedule_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const schedule = {
      id: scheduleId,
      campaign_name,
      start_time,
      end_time: end_time || null,
      daily_budget,
      auto_start: auto_start !== false,
      auto_stop: auto_stop !== false,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    // Save to KV
    const schedules = await getJSON(env, 'facebook:automation:schedules', []);
    schedules.push(schedule);
    await putJSON(env, 'facebook:automation:schedules', schedules);

    return json({
      ok: true,
      schedule: schedule,
      message: 'Đã tạo lịch campaign'
    }, {}, req);

  } catch (e) {
    console.error('[Automation] Create schedule error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// CRON JOB EXECUTION
// ===================================================================

async function testCronExecution(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    console.log('[Automation Cron] Test execution started');

    const results = {
      auto_pause: [],
      budget_scale: [],
      schedules: [],
      ab_optimize: []
    };

    // 1. Execute auto-pause rules
    const autoPauseResults = await executeAutoPauseRules(env);
    results.auto_pause = autoPauseResults;

    // 2. Execute budget scaling rules
    const budgetScaleResults = await executeBudgetScaleRules(env);
    results.budget_scale = budgetScaleResults;

    // 3. Check scheduled campaigns
    const scheduleResults = await processScheduledCampaigns(env);
    results.schedules = scheduleResults;

    // 4. Optimize A/B tests
    const abOptimizeResults = await executeABOptimization(env);
    results.ab_optimize = abOptimizeResults;

    console.log('[Automation Cron] Test execution completed');

    return json({
      ok: true,
      message: 'Cron job đã chạy thành công',
      results: results,
      timestamp: new Date().toISOString()
    }, {}, req);

  } catch (e) {
    console.error('[Automation] Test cron error:', e);
    return errorResponse(e, 500, req);
  }
}

/**
 * Execute auto-pause rules (check CTR/CPC thresholds)
 */
async function executeAutoPauseRules(env) {
  const results = [];
  
  try {
    const rules = await getJSON(env, 'facebook:automation:rules', []);
    const autoPauseRules = rules.filter(r => r.type === 'auto_pause' && r.enabled);

    for (const rule of autoPauseRules) {
      console.log(`[Automation] Executing auto-pause rule: ${rule.name}`);
      
      // TODO: Check campaigns against rule conditions
      // For now, just log and increment execution count
      
      rule.execution_count = (rule.execution_count || 0) + 1;
      rule.last_execution = new Date().toISOString();
      
      results.push({
        rule_id: rule.id,
        rule_name: rule.name,
        status: 'executed',
        actions_taken: 0
      });
    }

    // Save updated rules
    await putJSON(env, 'facebook:automation:rules', rules);

  } catch (e) {
    console.error('[Automation] Auto-pause execution error:', e);
    results.push({ error: e.message });
  }

  return results;
}

/**
 * Execute budget scaling rules (increase budget for winning campaigns)
 */
async function executeBudgetScaleRules(env) {
  const results = [];
  
  try {
    const rules = await getJSON(env, 'facebook:automation:rules', []);
    const budgetScaleRules = rules.filter(r => r.type === 'budget_scale' && r.enabled);

    for (const rule of budgetScaleRules) {
      console.log(`[Automation] Executing budget scale rule: ${rule.name}`);
      
      // TODO: Check campaigns ROAS and scale budget
      
      rule.execution_count = (rule.execution_count || 0) + 1;
      rule.last_execution = new Date().toISOString();
      
      results.push({
        rule_id: rule.id,
        rule_name: rule.name,
        status: 'executed',
        actions_taken: 0
      });
    }

    // Save updated rules
    await putJSON(env, 'facebook:automation:rules', rules);

  } catch (e) {
    console.error('[Automation] Budget scale execution error:', e);
    results.push({ error: e.message });
  }

  return results;
}

/**
 * Process scheduled campaigns (start/stop based on schedule)
 */
async function processScheduledCampaigns(env) {
  const results = [];
  
  try {
    const schedules = await getJSON(env, 'facebook:automation:schedules', []);
    const now = new Date();

    for (const schedule of schedules) {
      const startTime = new Date(schedule.start_time);
      const endTime = schedule.end_time ? new Date(schedule.end_time) : null;

      // Check if should start
      if (schedule.auto_start && schedule.status === 'pending' && now >= startTime) {
        console.log(`[Automation] Starting scheduled campaign: ${schedule.campaign_name}`);
        
        // TODO: Start campaign via Facebook API
        
        schedule.status = 'running';
        results.push({
          schedule_id: schedule.id,
          action: 'started',
          campaign_name: schedule.campaign_name
        });
      }

      // Check if should stop
      if (schedule.auto_stop && schedule.status === 'running' && endTime && now >= endTime) {
        console.log(`[Automation] Stopping scheduled campaign: ${schedule.campaign_name}`);
        
        // TODO: Stop campaign via Facebook API
        
        schedule.status = 'completed';
        results.push({
          schedule_id: schedule.id,
          action: 'stopped',
          campaign_name: schedule.campaign_name
        });
      }
    }

    // Save updated schedules
    await putJSON(env, 'facebook:automation:schedules', schedules);

  } catch (e) {
    console.error('[Automation] Schedule processing error:', e);
    results.push({ error: e.message });
  }

  return results;
}

/**
 * Execute A/B test optimization (pause losing variants)
 */
async function executeABOptimization(env) {
  const results = [];
  
  try {
    const rules = await getJSON(env, 'facebook:automation:rules', []);
    const abOptimizeRules = rules.filter(r => r.type === 'ab_optimize' && r.enabled);

    for (const rule of abOptimizeRules) {
      console.log(`[Automation] Executing A/B optimize rule: ${rule.name}`);
      
      // TODO: Find A/B tests and pause losing variants
      
      rule.execution_count = (rule.execution_count || 0) + 1;
      rule.last_execution = new Date().toISOString();
      
      results.push({
        rule_id: rule.id,
        rule_name: rule.name,
        status: 'executed',
        actions_taken: 0
      });
    }

    // Save updated rules
    await putJSON(env, 'facebook:automation:rules', rules);

  } catch (e) {
    console.error('[Automation] A/B optimization error:', e);
    results.push({ error: e.message });
  }

  return results;
}

/**
 * Scheduled cron trigger (called by Cloudflare Workers)
 */
export async function scheduledHandler(event, env, ctx) {
  console.log('[Automation Cron] Scheduled execution triggered');

  try {
    // Execute all automation tasks
    await executeAutoPauseRules(env);
    await executeBudgetScaleRules(env);
    await processScheduledCampaigns(env);
    await executeABOptimization(env);

    console.log('[Automation Cron] Scheduled execution completed');
  } catch (e) {
    console.error('[Automation Cron] Scheduled execution error:', e);
  }
}

console.log('✅ facebook-ads-automation.js loaded');
