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
    const settings = await getJSON(env, 'settings:facebook_ads', null);
    if (settings) return settings;

    // Fallback to env vars
    return {
      app_id: env.FB_APP_ID,
      app_secret: env.FB_APP_SECRET,
      access_token: env.FB_ACCESS_TOKEN,
      ad_account_id: env.FB_AD_ACCOUNT_ID,
      page_id: env.FB_PAGE_ID
    };
  } catch (e) {
    console.error('[FB Ads] Get credentials error:', e);
    return null;
  }
}

/**
 * Call Facebook Graph API
 */
async function callFacebookAPI(endpoint, method = 'GET', body = null, accessToken) {
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
      const response = await fetch(fullUrl, options);
      return await response.json();
    } else {
      options.body = JSON.stringify(body);
    }
  }

  const response = await fetch(url, options);
  return await response.json();
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
        error: 'Chưa cấu hình Facebook credentials'
      }, { status: 400 }, req);
    }

    // Test by getting ad account info
    const result = await callFacebookAPI(
      `${creds.ad_account_id}`,
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
    const creds = await getFBCredentials(env);
    if (!creds || !creds.access_token) {
      return json({ ok: false, error: 'Chưa cấu hình credentials' }, { status: 400 }, req);
    }

    const result = await callFacebookAPI(
      `${creds.ad_account_id}/campaigns`,
      'GET',
      {
        fields: 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time',
        access_token: creds.access_token
      },
      creds.access_token
    );

    if (result.error) {
      return json({ ok: false, error: result.error }, { status: 400 }, req);
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

    if (!name || !daily_budget) {
      return json({
        ok: false,
        error: 'Thiếu tên campaign hoặc ngân sách'
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

    // Format price
    const price = product.price || product.price_sale || 0;
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

console.log('✅ facebook-ads.js loaded');