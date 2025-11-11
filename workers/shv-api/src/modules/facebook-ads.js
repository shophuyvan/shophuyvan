// File: workers/shv-api/src/modules/facebook-ads.js
// Facebook Marketing API Integration - Auto Campaign & Ads Management
// ===================================================================

import { json, errorResponse } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getJSON, putJSON } from '../lib/kv.js';

/**
 * Main handler for Facebook Ads routes
 */
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // ===== ADMIN ROUTES =====
  
  // THÊM MỚI: Dashboard Analytics
  if (path === '/admin/facebook/dashboard/analytics' && method === 'GET') {
    return getDashboardAnalytics(req, env);
  }

  // THÊM MỚI: Export PDF
  if (path === '/admin/facebook/dashboard/export/pdf' && method === 'POST') {
    return exportDashboardPDF(req, env);
  }

  // THÊM MỚI: Auto Post to Fanpage
  if (path === '/admin/facebook/posts' && method === 'POST') {
    return createFanpagePost(req, env);
  }

  // THÊM MỚI: Create A/B Test Campaign
  if (path === '/admin/facebook/campaigns/ab-test' && method === 'POST') {
    return createABTest(req, env);
  }

  // THÊM MỚI: Get A/B Test Results (Dashboard)
  if (path.match(/^\/admin\/facebook\/ab-test\/([^\/]+)\/results$/) && method === 'GET') {
    const adSetId = path.match(/^\/admin\/facebook\/ab-test\/([^\/]+)\/results$/)[1];
    return getABTestResults(req, env, adSetId);
  }

  // THÊM MỚI: Optimize A/B Test (Cron Job)
  if (path.match(/^\/admin\/facebook\/ab-test\/([^\/]+)\/optimize$/) && method === 'POST') {
    const adSetId = path.match(/^\/admin\/facebook\/ab-test\/([^\/]+)\/optimize$/)[1];
    return optimizeABTest(req, env, adSetId);
  }

  // Test connection
  if (path === '/admin/facebook/test' && method === 'GET') {
    return testFacebookConnection(req, env);
  }

  // List campaigns
  if (path === '/admin/facebook/campaigns' && method === 'GET') {
    return listCampaigns(req, env);
  }

  // Create campaign from products
  if (path === '/admin/facebook/campaigns' && method === 'POST') {
    return createCampaign(req, env);
  }

  // Get campaign stats
  if (path.match(/^\/admin\/facebook\/campaigns\/([^\/]+)\/stats$/) && method === 'GET') {
    const campaignId = path.match(/^\/admin\/facebook\/campaigns\/([^\/]+)\/stats$/)[1];
    return getCampaignStats(req, env, campaignId);
  }

  // Pause/Resume campaign
  if (path.match(/^\/admin\/facebook\/campaigns\/([^\/]+)\/(pause|resume)$/) && method === 'POST') {
    const match = path.match(/^\/admin\/facebook\/campaigns\/([^\/]+)\/(pause|resume)$/);
    const campaignId = match[1];
    const action = match[2];
    return toggleCampaign(req, env, campaignId, action);
  }

  // Delete campaign
  if (path.match(/^\/admin\/facebook\/campaigns\/([^\/]+)$/) && method === 'DELETE') {
    const campaignId = path.match(/^\/admin\/facebook\/campaigns\/([^\/]+)$/)[1];
    return deleteCampaign(req, env, campaignId);
  }

  // ===== FANPAGE MANAGEMENT ROUTES =====
  
  // Get fanpages list
  if (path === '/admin/facebook/fanpages' && method === 'GET') {
    return listFanpages(req, env);
  }

  // Add new fanpage
  if (path === '/admin/facebook/fanpages' && method === 'POST') {
    return addFanpage(req, env);
  }

  // Delete fanpage
  if (path.match(/^\/admin\/facebook\/fanpages\/([^\/]+)$/) && method === 'DELETE') {
    const fanpageId = path.match(/^\/admin\/facebook\/fanpages\/([^\/]+)$/)[1];
    return deleteFanpage(req, env, fanpageId);
  }

  // Set default fanpage
  if (path.match(/^\/admin\/facebook\/fanpages\/([^\/]+)\/default$/) && method === 'POST') {
    const fanpageId = path.match(/^\/admin\/facebook\/fanpages\/([^\/]+)\/default$/)[1];
    return setDefaultFanpage(req, env, fanpageId);
  }

  // Create ad from single product
  if (path === '/admin/facebook/ads' && method === 'POST') {
    return createAd(req, env);
  }

  // Get ad performance
  if (path.match(/^\/admin\/facebook\/ads\/([^\/]+)\/stats$/) && method === 'GET') {
    const adId = path.match(/^\/admin\/facebook\/ads\/([^\/]+)\/stats$/)[1];
    return getAdStats(req, env, adId);
  }

  return errorResponse('Route not found', 404, req);
}

// ===================================================================
// FACEBOOK API HELPERS
// ===================================================================

/**
 * Get Facebook credentials from KV
 */
async function getFBCredentials(env) {
  try {
    // Thử lấy từ KV với key 'settings:facebook_ads'
    let settings = await getJSON(env, 'settings:facebook_ads', null);
    
    // Nếu không có, thử lấy từ key 'settings' với path facebook_ads
    if (!settings) {
      const allSettings = await getJSON(env, 'settings', null);
      settings = allSettings?.facebook_ads || null;
    }
    
    if (settings) {
      console.log('[FB Ads] Loaded credentials from KV');
      return settings;
    }

    // Fallback to env vars
    console.log('[FB Ads] Using fallback env vars');
    return {
      app_id: env.FB_APP_ID,
      app_secret: env.FB_APP_SECRET,
      access_token: env.FB_ACCESS_TOKEN,
      ad_account_id: env.FB_AD_ACCOUNT_ID,
      page_id: env.FB_PAGE_ID,
      pixel_id: env.FB_PIXEL_ID
    };
  } catch (e) {
    console.error('[FB Ads] Get credentials error:', e);
    return null;
  }
}

/**
 * Call Facebook Graph API with retry logic
 */
async function callFacebookAPI(endpoint, method = 'GET', body = null, accessToken, retries = 3) {
  const url = `https://graph.facebook.com/v19.0/${endpoint}`;
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    if (method === 'GET') {
      const params = new URLSearchParams(body);
      const fullUrl = `${url}?${params.toString()}`;
      
      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch(fullUrl, options);
          const data = await response.json();
          
          // Kiểm tra rate limit error
          if (data.error && data.error.code === 80004) {
            console.warn(`[FB API] Rate limit hit, retry ${i + 1}/${retries}`);
            await new Promise(resolve => setTimeout(resolve, (i + 1) * 2000)); // Exponential backoff
            continue;
          }
          
          return data;
        } catch (e) {
          if (i === retries - 1) throw e;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } else {
      options.body = JSON.stringify(body);
    }
  }

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      
      // Kiểm tra rate limit error
      if (data.error && data.error.code === 80004) {
        console.warn(`[FB API] Rate limit hit, retry ${i + 1}/${retries}`);
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 2000));
        continue;
      }
      
      return data;
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// ===================================================================
// TEST CONNECTION
// ===================================================================

async function testFacebookConnection(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const creds = await getFBCredentials(env);
    if (!creds || !creds.access_token) {
      return json({
        ok: false,
        error: 'Chưa cấu hình credentials. Vui lòng Login Facebook để lấy access token với đúng permissions.',
        need_oauth: true
      }, { status: 400 }, req);
    }

    // Validate permissions
    const permissionsCheck = await validatePermissions(creds.access_token, env);
    if (!permissionsCheck.valid) {
      return json({
        ok: false,
        error: 'Access token thiếu quyền cần thiết',
        missing_permissions: permissionsCheck.missing,
        need_oauth: true,
        message: '(#200) Ad account owner has NOT grant ads_management or ads_read permission. Vui lòng login lại Facebook.'
      }, { status: 403 }, req);
    }

    // Auto-fix Ad Account ID
    let adAccountId = creds.ad_account_id;
    if (adAccountId && !adAccountId.startsWith('act_')) {
      adAccountId = `act_${adAccountId}`;
    }

    // Test by getting ad account info
    const result = await callFacebookAPI(
      `${adAccountId}`,
      'GET',
      { 
        fields: 'name,account_status,currency,timezone_name',
        access_token: creds.access_token 
      },
      creds.access_token
    );

    if (result.error) {
      return json({
        ok: false,
        error: 'Facebook API Error',
        details: result.error
      }, { status: 400 }, req);
    }

    return json({
      ok: true,
      message: 'Kết nối Facebook thành công!',
      account: result
    }, {}, req);

  } catch (e) {
    console.error('[FB Ads] Test connection error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// LIST CAMPAIGNS
// ===================================================================

async function listCampaigns(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    console.log('[FB Ads] listCampaigns called');
    const creds = await getFBCredentials(env);
// Auto-fix Ad Account ID format
    let adAccountId = creds.ad_account_id;
    if (adAccountId && !adAccountId.startsWith('act_')) {
      adAccountId = `act_${adAccountId}`;
      console.log('[FB Ads] Auto-fixed Ad Account ID:', adAccountId);
    }
    
    console.log('[FB Ads] Credentials check:', { 
      hasCreds: !!creds, 
      hasToken: !!(creds?.access_token),
      hasAdAccount: !!adAccountId,
      adAccountId: adAccountId
    });
    
    if (!creds || !creds.access_token) {
      return json({ ok: false, error: 'Chưa cấu hình credentials' }, { status: 400 }, req);
    }

    const result = await callFacebookAPI(
      `${adAccountId}/campaigns`,
      'GET',
      {
        fields: 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time',
        access_token: creds.access_token
      },
      creds.access_token
    );

    console.log('[FB Ads] Facebook API result:', JSON.stringify(result).substring(0, 500));

    if (result.error) {
      console.error('[FB Ads] Facebook API error:', result.error);
      
      let userMessage = result.error.message || 'Unknown error';
      
      // Friendly error messages
      if (result.error.code === 100 && result.error.error_subcode === 33) {
        userMessage = '❌ Ad Account ID không hợp lệ hoặc thiếu quyền truy cập. Vui lòng kiểm tra:\n' +
          '1. Ad Account ID phải có dạng: act_XXXXXXXXXX\n' +
          '2. Access Token phải có quyền truy cập Ad Account này\n' +
          '3. Kiểm tra tại: https://business.facebook.com/settings/ad-accounts';
      }
      
      return json({ 
        ok: false, 
        error: 'Facebook API Error',
        details: result.error,
        message: userMessage
      }, { status: 400 }, req);
    }

    return json({
      ok: true,
      campaigns: result.data || [],
      total: result.data?.length || 0
    }, {}, req);

  } catch (e) {
    console.error('[FB Ads] List campaigns error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// THÊM MỚI: TÍNH NĂNG 1: AUTO POST TO FANPAGE

async function createFanpagePost(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await req.json();
    const {
      product_id,
      caption,
      post_type = 'single_image',
      cta = 'SHOP_NOW'
    } = body;

    if (!product_id || !caption) {
      return errorResponse('Thiếu product_id hoặc caption', 400, req);
    }

    const creds = await getFBCredentials(env);
    if (!creds || !creds.page_id) {
      return errorResponse('Chưa cấu hình Page ID', 400, req);
    }

    const product = await getJSON(env, `product:${product_id}`, null);
    if (!product) {
      return errorResponse('Không tìm thấy sản phẩm', 404, req);
    }

    const productUrl = `https://shophuyvan.vn/product/${product.slug || product.id}`;
    let apiBody = {
      message: caption,
      call_to_action: {
        type: cta,
        value: { link: productUrl }
      },
      published: false, // <-- Quan trọng: Tạo Dark Post
      access_token: creds.access_token
    };

    if (post_type === 'carousel' && product.images && product.images.length > 1) {
      // Để làm đúng, bạn cần:
      // 1. Upload từng ảnh (POST /{page-id}/photos, published=false) để lấy ID
      // 2. Gắn các ID đó vào attached_media
      
      // Ví dụ đơn giản hóa dùng child_attachments:
      apiBody.child_attachments = product.images.slice(0, 5).map(imgUrl => ({
        link: productUrl,
        image_url: imgUrl,
        name: product.name,
        call_to_action: {
          type: cta,
          value: { link: productUrl }
        }
      }));
      // Xóa link đính kèm chính
      delete apiBody.call_to_action;
      apiBody.link = productUrl; // Link chính cho carousel

    } else {
      // Single Image
      apiBody.link = productUrl;
      // Lấy ảnh đầu tiên, nếu không có thì dùng ảnh rỗng
      const imageUrl = (product.images && product.images.length > 0) ? product.images[0] : 'https://shophuyvan.vn/placeholder.jpg';
      apiBody.image_url = imageUrl;
    }

    const result = await callFacebookAPI(
      `${creds.page_id}/feed`, // Dùng /feed
      'POST',
      apiBody,
      creds.access_token
    );

    if (result.error) {
      return errorResponse(result.error, 400, req);
    }

    return json({
      ok: true,
      message: 'Tạo dark post thành công!',
      post_id: result.id // Đây là post_id bạn cần
    }, {}, req);

  } catch (e) {
    console.error('[FB Ads] Create post error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// THÊM MỚI: TÍNH NĂNG 2: A/B TESTING
// ===================================================================

async function createABTest(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await req.json();
    const {
      name,
      daily_budget,
      product_id,
      variants = [] // [{ image_url, caption }, { image_url, caption }]
    } = body;

    if (!name || !daily_budget || !product_id || variants.length === 0) {
      return errorResponse('Thiếu thông tin A/B Test', 400, req);
    }
    
    const creds = await getFBCredentials(env);
    if (!creds) return errorResponse('Chưa cấu hình credentials', 400, req);
    
    const product = await getJSON(env, `product:${product_id}`, null);
    if (!product) return errorResponse('Không tìm thấy sản phẩm', 404, req);

    // 1. Tạo Campaign
    const campaignResult = await callFacebookAPI(
      `${creds.ad_account_id}/campaigns`, 'POST', {
        name: name,
        objective: 'OUTCOME_SALES',
        status: 'PAUSED',
        special_ad_categories: [],
        daily_budget: Math.round(daily_budget * 100),
        access_token: creds.access_token
      }, creds.access_token);
    if (campaignResult.error) return errorResponse(campaignResult.error, 400, req);
    const campaignId = campaignResult.id;

    // 2. Tạo Ad Set
    const adSetResult = await callFacebookAPI(
      `${creds.ad_account_id}/adsets`, 'POST', {
        name: `${name} - A/B Test Ad Set`,
        campaign_id: campaignId,
        daily_budget: Math.round(daily_budget * 100),
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        status: 'PAUSED',
        targeting: {
          geo_locations: { countries: ['VN'] },
          age_min: 18,
          age_max: 65,
        },
        access_token: creds.access_token
      }, creds.access_token);
    if (adSetResult.error) return errorResponse(adSetResult.error, 400, req);
    const adSetId = adSetResult.id;

    // 3. Tạo Ad Creatives & Ads cho từng Variant
    const productUrl = `https://shophuyvan.vn/product/${product.slug || product.id}`;
    const adsCreated = [];

    for (const [index, variant] of variants.entries()) {
      try {
        const creativeName = `${name} - Creative ${String.fromCharCode(65 + index)}`; // A, B, C...
        
        // 3a. Tạo Ad Creative
        const creativeResult = await callFacebookAPI(
          `${creds.ad_account_id}/adcreatives`, 'POST', {
            name: creativeName,
            object_story_spec: {
              page_id: creds.page_id,
              link_data: {
                link: productUrl,
                message: variant.caption,
                name: product.name,
                image_url: variant.image_url,
                call_to_action: { type: 'SHOP_NOW' }
              }
            },
            access_token: creds.access_token
          }, creds.access_token);
        if (creativeResult.error) throw new Error(JSON.stringify(creativeResult.error));
        
        // 3b. Tạo Ad
        const adResult = await callFacebookAPI(
          `${creds.ad_account_id}/ads`, 'POST', {
            name: `Ad ${String.fromCharCode(65 + index)}`,
            adset_id: adSetId,
            creative: { creative_id: creativeResult.id },
            status: 'ACTIVE', // Bật Ad
            access_token: creds.access_token
          }, creds.access_token);
        if (adResult.error) throw new Error(JSON.stringify(adResult.error));
        
        adsCreated.push({ id: adResult.id, name: creativeName });
      } catch (e) {
        console.error(`[FB Ads] Lỗi tạo Variant ${index}:`, e.message);
      }
    }

    // 4. Bật Ad Set và Campaign
    await callFacebookAPI(adSetId, 'POST', { status: 'ACTIVE', access_token: creds.access_token }, creds.access_token);
    await callFacebookAPI(campaignId, 'POST', { status: 'ACTIVE', access_token: creds.access_token }, creds.access_token);

    return json({
      ok: true,
      message: `Đã tạo A/B test với ${adsCreated.length} variants.`,
      campaign_id: campaignId,
      ad_set_id: adSetId,
      ads: adsCreated
    }, {}, req);

  } catch (e) {
    console.error('[FB Ads] Create A/B test error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// THÊM MỚI: TÍNH NĂNG 3: PERFORMANCE DASHBOARD
// ===================================================================

async function getABTestResults(req, env, adSetId) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const creds = await getFBCredentials(env);
    if (!creds) return errorResponse('Chưa cấu hình credentials', 400, req);

    // Lấy insights, chia nhỏ theo ad_id
    const result = await callFacebookAPI(
      `${adSetId}/insights`,
      'GET',
      {
        fields: 'ad_id,ad_name,impressions,clicks,spend,ctr,cpc',
        breakdowns: 'ad_id', // <-- Quan trọng
        date_preset: 'last_7d',
        access_token: creds.access_token
      },
      creds.access_token
    );

    if (result.error) {
      return errorResponse(result.error, 400, req);
    }
    
    // Lấy status của từng Ad
    const adsResult = await callFacebookAPI(
      `${adSetId}/ads`,
      'GET',
      {
        fields: 'id,status',
        access_token: creds.access_token
      },
      creds.access_token
    );
    
    const adStatuses = {};
    if (adsResult.data) {
      for (const ad of adsResult.data) {
        adStatuses[ad.id] = ad.status;
      }
    }

    const stats = (result.data || []).map(adStat => ({
      creative: adStat.ad_name,
      ad_id: adStat.ad_id,
      impressions: parseInt(adStat.impressions || 0),
      clicks: parseInt(adStat.clicks || 0),
      ctr: parseFloat(adStat.ctr || 0).toFixed(2),
      cpc: parseFloat(adStat.cpc || 0).toFixed(2),
      status: adStatuses[adStat.ad_id] || 'N/A'
    }));

    return json({
      ok: true,
      results: stats
    }, {}, req);

  } catch (e) {
    console.error('[FB Ads] Get A/B results error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// THÊM MỚI: TỐI ƯU A/B TEST (LOGIC CHO CRON)
// ===================================================================

async function optimizeABTest(req, env, adSetId) {
  // (Đây là hàm logic, bạn cần một Cron Job để gọi nó)
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }
  
  try {
    const creds = await getFBCredentials(env);
    if (!creds) return errorResponse('Chưa cấu hình credentials', 400, req);

    // 1. Lấy kết quả
    const resultsResponse = await getABTestResults(req, env, adSetId);
    if (!resultsResponse.ok) {
        // Nếu getABTestResults trả về Response object, cần đọc JSON
        const errorData = await resultsResponse.json();
        return errorResponse(errorData.error || 'Failed to get results', resultsResponse.status, req);
    }
    
    // Nếu getABTestResults trả về JSON (do dùng hàm json()), thì data nằm trong .results
    // Giả sử getABTestResults trả về Response, ta cần parse nó
    // --> Sửa: Hàm getABTestResults dùng `json()` nên nó trả về Response.
    // --> Ta cần gọi nội bộ hàm logic thay vì gọi qua fetch.
    
    // Gọi hàm nội bộ để lấy data, không phải response
    const resultsData = await getABTestResultsInternal(req, env, adSetId);
    if (!resultsData.ok) {
        return errorResponse(resultsData.error, 400, req);
    }

    const stats = resultsData.results;
    if (stats.length === 0) {
      return errorResponse('Không có dữ liệu stats', 404, req);
    }

    // 2. Tìm variant tốt nhất (ví dụ: CTR cao nhất)
    let winner = stats[0];
    for (const adStat of stats) {
      if (parseFloat(adStat.ctr) > parseFloat(winner.ctr)) {
        winner = adStat;
      }
    }
    
    // 3. Tắt các variant kém
    const actions = [];
    for (const adStat of stats) {
      if (adStat.ad_id !== winner.ad_id && adStat.status === 'ACTIVE') {
        // Tắt Ad này
        const pauseResult = await callFacebookAPI(
          adStat.ad_id, 'POST',
          { status: 'PAUSED', access_token: creds.access_token },
          creds.access_token
        );
        actions.push({ ad: adStat.creative, action: 'PAUSED', ok: pauseResult.success });
      } else if (adStat.ad_id === winner.ad_id) {
         actions.push({ ad: adStat.creative, action: 'KEEP', ok: true });
      } else {
         actions.push({ ad: adStat.creative, action: 'IGNORED', ok: true, status: adStat.status });
      }
    }
    
    return json({
      ok: true,
      message: `Đã tối ưu A/B test. Winner: ${winner.creative}`,
      winner_ad_id: winner.ad_id,
      actions: actions
    }, {}, req);
    
  } catch (e) {
    console.error('[FB Ads] Optimize A/B test error:', e);
    return errorResponse(e, 500, req);
  }
}

// Hàm nội bộ để optimizeABTest gọi, tránh lỗi response
async function getABTestResultsInternal(req, env, adSetId) {
  try {
    const creds = await getFBCredentials(env);
    if (!creds) return { ok: false, error: 'Chưa cấu hình credentials' };
    
    const result = await callFacebookAPI(`${adSetId}/insights`, 'GET', {
        fields: 'ad_id,ad_name,impressions,clicks,spend,ctr,cpc',
        breakdowns: 'ad_id',
        date_preset: 'last_7d',
        access_token: creds.access_token
    }, creds.access_token);
    if (result.error) return { ok: false, error: result.error };

    const adsResult = await callFacebookAPI(`${adSetId}/ads`, 'GET', {
        fields: 'id,status',
        access_token: creds.access_token
    }, creds.access_token);
    
    const adStatuses = {};
    if (adsResult.data) {
      for (const ad of adsResult.data) {
        adStatuses[ad.id] = ad.status;
      }
    }
    
    const stats = (result.data || []).map(adStat => ({
      creative: adStat.ad_name,
      ad_id: adStat.ad_id,
      impressions: parseInt(adStat.impressions || 0),
      clicks: parseInt(adStat.clicks || 0),
      ctr: parseFloat(adStat.ctr || 0).toFixed(2),
      cpc: parseFloat(adStat.cpc || 0).toFixed(2),
      status: adStatuses[adStat.ad_id] || 'N/A'
    }));
    
    return { ok: true, results: stats };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

// ===================================================================
// CREATE CAMPAIGN (Hàm cũ của bạn)
// ===================================================================

// ===================================================================
// CREATE CAMPAIGN
// ===================================================================

async function createCampaign(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await req.json();
    const {
      name,
      objective = 'OUTCOME_SALES', // OUTCOME_SALES, OUTCOME_TRAFFIC, OUTCOME_ENGAGEMENT
      daily_budget, // VNĐ
      product_ids = [], // Array of product IDs
      targeting = {}
    } = body;

    // Validation đầy đủ
    if (!name || name.length < 3) {
      return json({
        ok: false,
        error: 'Tên campaign phải có ít nhất 3 ký tự'
      }, { status: 400 }, req);
    }

    if (!daily_budget || daily_budget < 50000) {
      return json({
        ok: false,
        error: 'Ngân sách tối thiểu 50,000 VNĐ'
      }, { status: 400 }, req);
    }

    if (product_ids.length === 0) {
      return json({
        ok: false,
        error: 'Vui lòng chọn ít nhất 1 sản phẩm'
      }, { status: 400 }, req);
    }

    if (product_ids.length > 10) {
      return json({
        ok: false,
        error: 'Chỉ được chọn tối đa 10 sản phẩm'
      }, { status: 400 }, req);
    }

    const creds = await getFBCredentials(env);
    if (!creds || !creds.access_token) {
      return json({ ok: false, error: 'Chưa cấu hình credentials' }, { status: 400 }, req);
    }

    // Convert VND to smallest unit (xu)
    const budgetInXu = Math.round(daily_budget * 100);

    // 1. Create Campaign
    const campaignResult = await callFacebookAPI(
      `${creds.ad_account_id}/campaigns`,
      'POST',
      {
        name: name,
        objective: objective,
        status: 'PAUSED', // Start as paused
        special_ad_categories: [],
        daily_budget: budgetInXu,
        access_token: creds.access_token
      },
      creds.access_token
    );

    if (campaignResult.error) {
      return json({
        ok: false,
        error: 'Tạo campaign thất bại',
        details: campaignResult.error
      }, { status: 400 }, req);
    }

    const campaignId = campaignResult.id;

    // 2. Create Ad Set with targeting
    const adSetResult = await callFacebookAPI(
      `${creds.ad_account_id}/adsets`,
      'POST',
      {
        name: `${name} - Ad Set`,
        campaign_id: campaignId,
        daily_budget: budgetInXu,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        status: 'PAUSED',
        targeting: {
          geo_locations: {
            countries: ['VN']
          },
          age_min: targeting.age_min || 18,
          age_max: targeting.age_max || 65,
          ...(targeting.genders ? { genders: targeting.genders } : {}),
          ...(targeting.interests ? { flexible_spec: [{ interests: targeting.interests }] } : {})
        },
        access_token: creds.access_token
      },
      creds.access_token
    );

    if (adSetResult.error) {
      return json({
        ok: false,
        error: 'Tạo Ad Set thất bại',
        details: adSetResult.error
      }, { status: 400 }, req);
    }

    const adSetId = adSetResult.id;

    // 3. Create Ads for each product
    const adsCreated = [];
    for (const productId of product_ids.slice(0, 10)) { // Limit 10 products per campaign
      try {
        const product = await getJSON(env, `product:${productId}`, null);
        if (!product) continue;

        const adResult = await createAdForProduct(
          env,
          creds,
          adSetId,
          product
        );

        if (adResult.ok) {
          adsCreated.push(adResult.ad);
        }
      } catch (e) {
        console.error(`[FB Ads] Error creating ad for product ${productId}:`, e);
      }
    }

    // 4. Save campaign info to KV
    const campaignData = {
      id: campaignId,
      name: name,
      ad_set_id: adSetId,
      product_ids: product_ids,
      ads_created: adsCreated.length,
      daily_budget: daily_budget,
      status: 'PAUSED',
      created_at: new Date().toISOString()
    };

    await putJSON(env, `facebook:campaign:${campaignId}`, campaignData);

    // Update campaigns list
    const listData = await getJSON(env, 'facebook:campaigns:list', []);
    listData.unshift(campaignId);
    await putJSON(env, 'facebook:campaigns:list', listData);

    return json({
      ok: true,
      campaign: campaignData,
      message: `Đã tạo campaign với ${adsCreated.length} quảng cáo`
    }, {}, req);

  } catch (e) {
    console.error('[FB Ads] Create campaign error:', e);
    return errorResponse(e, 500, req);
  }
}

/**
 * Create Ad for single product
 */
async function createAdForProduct(env, creds, adSetId, product) {
  try {
    const title = product.title || product.name || '';
    const description = product.description || product.short_description || '';
    const image = (product.images && product.images[0]) || '';
    const productUrl = `https://shophuyvan.vn/product/${product.slug || product.id}`;

    // Format price - LƯU Ý: Giá chỉ có trong variants, không có ở product
    const price = (product.variants && product.variants[0] && product.variants[0].price) || 0;
    const priceStr = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);

    // 1. Create Ad Creative
    const creativeResult = await callFacebookAPI(
      `${creds.ad_account_id}/adcreatives`,
      'POST',
      {
        name: `Creative - ${title.substring(0, 50)}`,
        object_story_spec: {
          page_id: creds.page_id,
          link_data: {
            link: productUrl,
            message: `🛒 ${title}\n\n💰 Chỉ ${priceStr}\n\n${description.substring(0, 100)}...`,
            name: title,
            description: description.substring(0, 200),
            image_url: image,
            call_to_action: {
              type: 'SHOP_NOW'
            }
          }
        },
        access_token: creds.access_token
      },
      creds.access_token
    );

    if (creativeResult.error) {
      throw new Error(`Creative error: ${JSON.stringify(creativeResult.error)}`);
    }

    // 2. Create Ad
    const adResult = await callFacebookAPI(
      `${creds.ad_account_id}/ads`,
      'POST',
      {
        name: title.substring(0, 100),
        adset_id: adSetId,
        creative: { creative_id: creativeResult.id },
        status: 'PAUSED',
        access_token: creds.access_token
      },
      creds.access_token
    );

    if (adResult.error) {
      throw new Error(`Ad error: ${JSON.stringify(adResult.error)}`);
    }

    return {
      ok: true,
      ad: {
        id: adResult.id,
        product_id: product.id,
        creative_id: creativeResult.id
      }
    };

  } catch (e) {
    console.error('[FB Ads] Create ad for product error:', e);
    return { ok: false, error: e.message };
  }
}

// ===================================================================
// TOGGLE CAMPAIGN (PAUSE/RESUME)
// ===================================================================

async function toggleCampaign(req, env, campaignId, action) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const creds = await getFBCredentials(env);
    if (!creds || !creds.access_token) {
      return json({ ok: false, error: 'Chưa cấu hình credentials' }, { status: 400 }, req);
    }

    const status = action === 'pause' ? 'PAUSED' : 'ACTIVE';

    const result = await callFacebookAPI(
      campaignId,
      'POST',
      {
        status: status,
        access_token: creds.access_token
      },
      creds.access_token
    );

    if (result.error) {
      return json({ ok: false, error: result.error }, { status: 400 }, req);
    }

    // Update local cache
    const campaignData = await getJSON(env, `facebook:campaign:${campaignId}`, null);
    if (campaignData) {
      campaignData.status = status;
      campaignData.updated_at = new Date().toISOString();
      await putJSON(env, `facebook:campaign:${campaignId}`, campaignData);
    }

    return json({
      ok: true,
      message: action === 'pause' ? 'Đã tạm dừng campaign' : 'Đã kích hoạt campaign',
      status: status
    }, {}, req);

  } catch (e) {
    console.error('[FB Ads] Toggle campaign error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// GET CAMPAIGN STATS
// ===================================================================

async function getCampaignStats(req, env, campaignId) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const creds = await getFBCredentials(env);
    if (!creds || !creds.access_token) {
      return json({ ok: false, error: 'Chưa cấu hình credentials' }, { status: 400 }, req);
    }

    const result = await callFacebookAPI(
      `${campaignId}/insights`,
      'GET',
      {
        fields: 'impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,action_values',
        date_preset: 'last_7d',
        access_token: creds.access_token
      },
      creds.access_token
    );

    if (result.error) {
      return json({ ok: false, error: result.error }, { status: 400 }, req);
    }

    const stats = result.data && result.data[0] ? result.data[0] : {};

    return json({
      ok: true,
      stats: {
        impressions: parseInt(stats.impressions || 0),
        clicks: parseInt(stats.clicks || 0),
        spend: parseFloat(stats.spend || 0),
        ctr: parseFloat(stats.ctr || 0),
        cpc: parseFloat(stats.cpc || 0),
        cpm: parseFloat(stats.cpm || 0),
        reach: parseInt(stats.reach || 0),
        frequency: parseFloat(stats.frequency || 0),
        conversions: stats.actions ? stats.actions.find(a => a.action_type === 'offsite_conversion')?.value || 0 : 0
      }
    }, {}, req);

  } catch (e) {
    console.error('[FB Ads] Get stats error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// DELETE CAMPAIGN
// ===================================================================

async function deleteCampaign(req, env, campaignId) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const creds = await getFBCredentials(env);
    if (!creds || !creds.access_token) {
      return json({ ok: false, error: 'Chưa cấu hình credentials' }, { status: 400 }, req);
    }

    // Delete from Facebook
    const result = await callFacebookAPI(
      campaignId,
      'DELETE',
      {
        access_token: creds.access_token
      },
      creds.access_token
    );

    if (result.error) {
      return json({ ok: false, error: result.error }, { status: 400 }, req);
    }

    // Delete from KV
    await env.SHV.delete(`facebook:campaign:${campaignId}`);

    const listData = await getJSON(env, 'facebook:campaigns:list', []);
    const newList = listData.filter(id => id !== campaignId);
    await putJSON(env, 'facebook:campaigns:list', newList);

    return json({
      ok: true,
      message: 'Đã xóa campaign'
    }, {}, req);

  } catch (e) {
    console.error('[FB Ads] Delete campaign error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// DASHBOARD ANALYTICS
// ===================================================================

async function getDashboardAnalytics(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const creds = await getFBCredentials(env);
    if (!creds || !creds.access_token) {
      return json({ ok: false, error: 'Chưa cấu hình credentials' }, { status: 400 }, req);
    }

    // Get all campaigns
    const campaignsResult = await callFacebookAPI(
      `${creds.ad_account_id}/campaigns`,
      'GET',
      {
        fields: 'id,name,status,objective,daily_budget',
        access_token: creds.access_token
      },
      creds.access_token
    );

    if (campaignsResult.error) {
      return json({ ok: false, error: campaignsResult.error }, { status: 400 }, req);
    }

    const campaigns = campaignsResult.data || [];
    
    // Get insights for each campaign
    const enrichedCampaigns = [];
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;

    for (const campaign of campaigns) {
      try {
        const insightsResult = await callFacebookAPI(
          `${campaign.id}/insights`,
          'GET',
          {
            fields: 'impressions,clicks,spend,ctr,cpc,actions',
            date_preset: 'last_7d',
            access_token: creds.access_token
          },
          creds.access_token
        );

        const insights = insightsResult.data && insightsResult.data[0] ? insightsResult.data[0] : {};
        
        const spend = parseFloat(insights.spend || 0);
        const impressions = parseInt(insights.impressions || 0);
        const clicks = parseInt(insights.clicks || 0);
        const ctr = parseFloat(insights.ctr || 0);
        const cpc = parseFloat(insights.cpc || 0);
        const conversions = insights.actions 
          ? (insights.actions.find(a => a.action_type === 'offsite_conversion')?.value || 0)
          : 0;

        enrichedCampaigns.push({
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          spend,
          impressions,
          clicks,
          ctr,
          cpc,
          conversions: parseInt(conversions)
        });

        totalSpend += spend;
        totalImpressions += impressions;
        totalClicks += clicks;
        totalConversions += parseInt(conversions);
      } catch (e) {
        console.error(`[Dashboard] Error getting insights for campaign ${campaign.id}:`, e);
      }
    }

    // Calculate totals
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0;
    const avgCpc = totalClicks > 0 ? (totalSpend / totalClicks) : 0;

    // Generate alerts
    const alerts = [];
    enrichedCampaigns.forEach(c => {
      if (c.cpc > 50000 && c.clicks > 10) {
        alerts.push({
          type: 'warning',
          message: `Campaign "${c.name}" có CPC cao: ${c.cpc.toLocaleString('vi-VN')} VNĐ`,
          timestamp: new Date().toISOString(),
          campaign_id: c.id
        });
      }
      if (c.ctr < 1.0 && c.impressions > 1000) {
        alerts.push({
          type: 'danger',
          message: `Campaign "${c.name}" có CTR thấp: ${c.ctr.toFixed(2)}%`,
          timestamp: new Date().toISOString(),
          campaign_id: c.id
        });
      }
    });

    return json({
      ok: true,
      data: {
        campaigns: enrichedCampaigns,
        totals: {
          spend: totalSpend,
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr: avgCtr,
          cpc: avgCpc,
          conversions: totalConversions
        },
        alerts: alerts,
        generated_at: new Date().toISOString()
      }
    }, {}, req);

  } catch (e) {
    console.error('[Dashboard] Get analytics error:', e);
    return errorResponse(e, 500, req);
  }
}

async function exportDashboardPDF(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    // TODO: Implement PDF generation (use jsPDF or server-side library)
    // For now, return a placeholder response
    
    return json({
      ok: true,
      message: 'PDF export chưa được triển khai',
      url: null
    }, {}, req);

  } catch (e) {
    console.error('[Dashboard] Export PDF error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// FANPAGE MANAGEMENT
// ===================================================================

/**
 * List all fanpages
 */
async function listFanpages(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const fanpages = await getJSON(env, 'facebook:fanpages:list', []);
    
    return json({
      ok: true,
      fanpages: fanpages
    }, {}, req);

  } catch (e) {
    console.error('[FB Fanpages] List error:', e);
    return errorResponse(e, 500, req);
  }
}

/**
 * Add new fanpage
 */
async function addFanpage(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await req.json();
    const { page_id, page_name } = body;

    if (!page_id || !page_name) {
      return json({
        ok: false,
        error: 'Thiếu thông tin page_id hoặc page_name'
      }, { status: 400 }, req);
    }

    // Get current list
    const fanpages = await getJSON(env, 'facebook:fanpages:list', []);

    // Check duplicate
    if (fanpages.find(fp => fp.page_id === page_id)) {
      return json({
        ok: false,
        error: 'Fanpage này đã tồn tại'
      }, { status: 400 }, req);
    }

    // Create new fanpage object
    const newFanpage = {
      id: `fp_${Date.now()}`,
      page_id: page_id,
      page_name: page_name,
      status: 'active',
      is_default: fanpages.length === 0, // First fanpage is default
      created_at: new Date().toISOString()
    };

    // Add to list
    fanpages.push(newFanpage);

    // Save to KV
    await putJSON(env, 'facebook:fanpages:list', fanpages);

    return json({
      ok: true,
      message: 'Thêm fanpage thành công',
      fanpage: newFanpage
    }, {}, req);

  } catch (e) {
    console.error('[FB Fanpages] Add error:', e);
    return errorResponse(e, 500, req);
  }
}

/**
 * Delete fanpage
 */
async function deleteFanpage(req, env, fanpageId) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    // Get current list
    const fanpages = await getJSON(env, 'facebook:fanpages:list', []);

    // Find fanpage
    const fanpage = fanpages.find(fp => fp.id === fanpageId);
    if (!fanpage) {
      return json({
        ok: false,
        error: 'Không tìm thấy fanpage'
      }, { status: 404 }, req);
    }

    // Cannot delete default fanpage if there are others
    if (fanpage.is_default && fanpages.length > 1) {
      return json({
        ok: false,
        error: 'Không thể xóa fanpage mặc định. Vui lòng đặt fanpage khác làm mặc định trước.'
      }, { status: 400 }, req);
    }

    // Remove from list
    const newList = fanpages.filter(fp => fp.id !== fanpageId);

    // If deleted was default and there are remaining pages, set first as default
    if (fanpage.is_default && newList.length > 0) {
      newList[0].is_default = true;
    }

    // Save to KV
    await putJSON(env, 'facebook:fanpages:list', newList);

    return json({
      ok: true,
      message: 'Đã xóa fanpage'
    }, {}, req);

  } catch (e) {
    console.error('[FB Fanpages] Delete error:', e);
    return errorResponse(e, 500, req);
  }
}

/**
 * Set default fanpage
 */
async function setDefaultFanpage(req, env, fanpageId) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    // Get current list
    const fanpages = await getJSON(env, 'facebook:fanpages:list', []);

    // Find fanpage
    const fanpage = fanpages.find(fp => fp.id === fanpageId);
    if (!fanpage) {
      return json({
        ok: false,
        error: 'Không tìm thấy fanpage'
      }, { status: 404 }, req);
    }

    // Update all fanpages: set only selected one as default
    fanpages.forEach(fp => {
      fp.is_default = (fp.id === fanpageId);
    });

    // Save to KV
    await putJSON(env, 'facebook:fanpages:list', fanpages);

    return json({
      ok: true,
      message: 'Đã đặt fanpage mặc định'
    }, {}, req);

  } catch (e) {
    console.error('[FB Fanpages] Set default error:', e);
    return errorResponse(e, 500, req);
  }
}
// ===================================================================
// CREATE AD (Single)
// ===================================================================

async function createAd(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await req.json();
    const { product_id, ad_set_id } = body;

    if (!product_id || !ad_set_id) {
      return json({
        ok: false,
        error: 'Thiếu product_id hoặc ad_set_id'
      }, { status: 400 }, req);
    }

    const creds = await getFBCredentials(env);
    if (!creds || !creds.access_token) {
      return json({ ok: false, error: 'Chưa cấu hình credentials' }, { status: 400 }, req);
    }

    const product = await getJSON(env, `product:${product_id}`, null);
    if (!product) {
      return json({
        ok: false,
        error: 'Không tìm thấy sản phẩm'
      }, { status: 404 }, req);
    }

    const adResult = await createAdForProduct(env, creds, ad_set_id, product);

    if (!adResult.ok) {
      return json({
        ok: false,
        error: 'Tạo ad thất bại',
        details: adResult.error
      }, { status: 400 }, req);
    }

    return json({
      ok: true,
      ad: adResult.ad,
      message: 'Đã tạo ad thành công'
    }, {}, req);

  } catch (e) {
    console.error('[FB Ads] Create ad error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// GET AD STATS
// ===================================================================

async function getAdStats(req, env, adId) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const creds = await getFBCredentials(env);
    if (!creds || !creds.access_token) {
      return json({ ok: false, error: 'Chưa cấu hình credentials' }, { status: 400 }, req);
    }

    const result = await callFacebookAPI(
      `${adId}/insights`,
      'GET',
      {
        fields: 'impressions,clicks,spend,ctr,cpc,cpm,reach,frequency',
        date_preset: 'last_7d',
        access_token: creds.access_token
      },
      creds.access_token
    );

    if (result.error) {
      return json({ ok: false, error: result.error }, { status: 400 }, req);
    }

    const stats = result.data && result.data[0] ? result.data[0] : {};

    return json({
      ok: true,
      stats: {
        impressions: parseInt(stats.impressions || 0),
        clicks: parseInt(stats.clicks || 0),
        spend: parseFloat(stats.spend || 0),
        ctr: parseFloat(stats.ctr || 0),
        cpc: parseFloat(stats.cpc || 0),
        cpm: parseFloat(stats.cpm || 0),
        reach: parseInt(stats.reach || 0),
        frequency: parseFloat(stats.frequency || 0)
      }
    }, {}, req);

  } catch (e) {
    console.error('[FB Ads] Get ad stats error:', e);
    return errorResponse(e, 500, req);
  }
}

/**
 * Validate if access token has required permissions
 */
async function validatePermissions(accessToken, env) {
  try {
    const settings = await getJSON(env, 'settings:facebook_ads', null) || {};
    const appId = settings.app_id || env.FB_APP_ID;
    const appSecret = settings.app_secret || env.FB_APP_SECRET;

    if (!appId || !appSecret) {
      return { valid: false, missing: ['app_credentials'], message: 'Thiếu App ID/Secret' };
    }

    // Debug token to get permissions
    const url = new URL('https://graph.facebook.com/v19.0/debug_token');
    url.searchParams.set('input_token', accessToken);
    url.searchParams.set('access_token', `${appId}|${appSecret}`);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.error) {
      return { valid: false, missing: [], message: data.error.message };
    }

    const tokenData = data.data;
    const scopes = tokenData.scopes || [];

    // Required permissions
    const required = ['ads_management', 'ads_read'];
    const missing = required.filter(p => !scopes.includes(p));

    if (missing.length > 0) {
      return { 
        valid: false, 
        missing: missing,
        current: scopes,
        message: `Thiếu permissions: ${missing.join(', ')}`
      };
    }

    return { valid: true, scopes: scopes };

  } catch (e) {
    console.error('[FB Ads] Validate permissions error:', e);
    return { valid: false, missing: [], message: e.message };
  }
}

console.log('✅ facebook-ads.js loaded');