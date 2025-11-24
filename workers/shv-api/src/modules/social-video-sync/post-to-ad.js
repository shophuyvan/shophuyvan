/**
 * Post to Ad Converter
 * Tạo Facebook Ads Campaign từ published posts
 * 
 * Flow: Job → Posts → Campaign → Ad Set → Ads
 */

import { json, errorResponse } from '../../lib/response.js';
import { getJSON } from '../../lib/kv.js';

// ===================================================================
// MAIN FUNCTION: Create Ads from Automation Job
// ===================================================================

export async function createAdsFromJob(req, env, jobId) {
  try {
    const body = await req.json();
    const { 
      campaignName, 
      dailyBudget = 50000, 
      targetUrl,
      targeting 
    } = body;

    // Validation
    if (!campaignName || campaignName.length < 3) {
      return errorResponse('Tên campaign phải có ít nhất 3 ký tự', 400, req);
    }

    if (dailyBudget < 50000) {
      return errorResponse('Ngân sách tối thiểu 50,000 VNĐ/ngày', 400, req);
    }

    const now = Date.now();

    // 1. Get job info
    const job = await env.DB.prepare(`
      SELECT * FROM automation_jobs WHERE id = ?
    `).bind(jobId).first();

    if (!job) {
      return errorResponse('Job not found', 404, req);
    }

    if (job.status !== 'published') {
      return errorResponse('Job chưa publish. Vui lòng đăng bài trước.', 400, req);
    }

    // 2. Get successful posts
    const { results: posts } = await env.DB.prepare(`
      SELECT fanpage_id, post_id, post_url, fanpage_name
      FROM fanpage_assignments
      WHERE job_id = ? AND status = 'published' AND post_id IS NOT NULL
    `).bind(jobId).all();

    if (posts.length === 0) {
      return errorResponse('Không có bài viết nào để tạo ads', 400, req);
    }

    // 3. Get Facebook credentials
    const fbSettings = await getJSON(env, 'settings:facebook_ads', null);
    if (!fbSettings || !fbSettings.access_token) {
      return errorResponse('Chưa đăng nhập Facebook. Vui lòng login trước.', 400, req);
    }

    const accessToken = fbSettings.access_token;
    const adAccountId = fbSettings.ad_account_id;

    if (!adAccountId) {
      return errorResponse('Chưa cấu hình Ad Account ID', 400, req);
    }

    // 4. Build targeting config
    const targetingConfig = buildTargetingConfig(targeting);

    // 5. Create campaign record (save early to get campaign_id)
    const campaignResult = await env.DB.prepare(`
      INSERT INTO job_campaigns
      (job_id, campaign_name, daily_budget, target_url, targeting_config, status, total_ads, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'creating', 0, ?, ?)
    `).bind(
      jobId,
      campaignName,
      dailyBudget,
      targetUrl || job.product_url,
      JSON.stringify(targetingConfig),
      now,
      now
    ).run();

    const localCampaignId = campaignResult.meta.last_row_id;

    try {
      // 6. Create Facebook Campaign
      const campaign = await createFacebookCampaign(
        adAccountId,
        campaignName,
        accessToken
      );

      // 7. Create Ad Set
      const adSet = await createFacebookAdSet(
        adAccountId,
        campaign.id,
        campaignName,
        dailyBudget,
        targetingConfig,
        accessToken
      );

      // 8. Create Ads from posts
      const adsData = [];
      let successCount = 0;

      for (const post of posts) {
        try {
          const ad = await createFacebookAd(
            adAccountId,
            adSet.id,
            `${job.product_name} - ${post.fanpage_name}`,
            post.fanpage_id,
            post.post_id,
            accessToken
          );

          adsData.push({
            postId: post.post_id,
            fanpageName: post.fanpage_name,
            adId: ad.id,
            status: 'created'
          });

          successCount++;
        } catch (adError) {
          console.error('[Post to Ad] Create ad error:', adError);
          adsData.push({
            postId: post.post_id,
            fanpageName: post.fanpage_name,
            error: adError.message,
            status: 'failed'
          });
        }
      }

      // 9. Update campaign record with Facebook IDs
      await env.DB.prepare(`
        UPDATE job_campaigns
        SET fb_campaign_id = ?, fb_adset_id = ?, status = 'active', 
            total_ads = ?, ads_data = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        campaign.id,
        adSet.id,
        successCount,
        JSON.stringify(adsData),
        now,
        localCampaignId
      ).run();

      // 10. Update job status
      await env.DB.prepare(`
        UPDATE automation_jobs
        SET status = 'completed', campaign_id = ?, campaign_name = ?, updated_at = ?, completed_at = ?
        WHERE id = ?
      `).bind(campaign.id, campaignName, now, now, jobId).run();

      return json({
        ok: true,
        jobId,
        campaign: {
          id: campaign.id,
          name: campaignName,
          status: 'PAUSED',
          dashboardUrl: `https://business.facebook.com/adsmanager/manage/campaigns?act=${adAccountId}&selected_campaign_ids=${campaign.id}`
        },
        adSet: {
          id: adSet.id,
          dailyBudget: dailyBudget
        },
        ads: adsData,
        totalAds: successCount,
        message: `✅ Đã tạo ${successCount}/${posts.length} ads. Campaign đang ở trạng thái PAUSED, vui lòng vào Ads Manager để bật.`
      }, {}, req);

    } catch (fbError) {
      // Update campaign record with error
      await env.DB.prepare(`
        UPDATE job_campaigns
        SET status = 'failed', error_message = ?, updated_at = ?
        WHERE id = ?
      `).bind(fbError.message, now, localCampaignId).run();

      throw fbError;
    }

  } catch (error) {
    console.error('[Post to Ad] Error:', error);
    return errorResponse(error.message, 500, req);
  }
}

// ===================================================================
// HELPER: Build Targeting Config
// ===================================================================

function buildTargetingConfig(customTargeting) {
  // Default targeting: Việt Nam, 25-45 tuổi, quan tâm Gia Dụng
  const defaultTargeting = {
    geo_locations: { countries: ['VN'] },
    age_min: 25,
    age_max: 45,
    genders: [0], // All genders (0 = all, 1 = male, 2 = female)
    publisher_platforms: ['facebook', 'instagram'],
    facebook_positions: ['feed', 'right_hand_column', 'instant_article', 'marketplace'],
    instagram_positions: ['stream', 'story', 'explore'],
    interests: [
      { id: '6003139266461', name: 'Home Appliances' },
      { id: '6003020834693', name: 'Cooking' },
      { id: '6003348442136', name: 'Home Decor' },
      { id: '6003700344840', name: 'Kitchen' },
      { id: '6003050185109', name: 'Homemaking' }
    ]
  };

  // Merge với custom targeting nếu có
  if (customTargeting) {
    return {
      ...defaultTargeting,
      ...customTargeting,
      geo_locations: customTargeting.geo_locations || defaultTargeting.geo_locations,
      interests: customTargeting.interests || defaultTargeting.interests
    };
  }

  return defaultTargeting;
}

// ===================================================================
// FACEBOOK API: Create Campaign
// ===================================================================

async function createFacebookCampaign(adAccountId, campaignName, accessToken) {
  const url = `https://graph.facebook.com/v19.0/act_${adAccountId}/campaigns`;
  
  const params = new URLSearchParams({
    access_token: accessToken,
    name: campaignName,
    objective: 'OUTCOME_TRAFFIC', // Traffic to website
    status: 'PAUSED', // Tạo ở trạng thái PAUSED để admin review trước
    special_ad_categories: '[]' // Empty array = no special categories
  });

  const response = await fetch(url, {
    method: 'POST',
    body: params
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(`Facebook API Error: ${JSON.stringify(data.error)}`);
  }

  return data; // {id: "campaign_id"}
}

// ===================================================================
// FACEBOOK API: Create Ad Set
// ===================================================================

async function createFacebookAdSet(
  adAccountId, 
  campaignId, 
  campaignName, 
  dailyBudget, 
  targeting, 
  accessToken
) {
  const url = `https://graph.facebook.com/v19.0/act_${adAccountId}/adsets`;
  
  // Convert VND to cents (Facebook dùng đơn vị cents)
  // 50,000 VND = 5,000,000 cents
  const dailyBudgetCents = dailyBudget * 100;

  const body = {
    access_token: accessToken,
    name: `${campaignName} - Ad Set`,
    campaign_id: campaignId,
    optimization_goal: 'LINK_CLICKS',
    billing_event: 'IMPRESSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    daily_budget: dailyBudgetCents,
    status: 'PAUSED',
    targeting: JSON.stringify(targeting)
  };

  const params = new URLSearchParams(body);

  const response = await fetch(url, {
    method: 'POST',
    body: params
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(`Facebook Ad Set Error: ${JSON.stringify(data.error)}`);
  }

  return data; // {id: "adset_id"}
}

// ===================================================================
// FACEBOOK API: Create Ad from Post
// ===================================================================

async function createFacebookAd(
  adAccountId, 
  adSetId, 
  adName, 
  pageId, 
  postId, 
  accessToken
) {
  const url = `https://graph.facebook.com/v19.0/act_${adAccountId}/ads`;
  
  // CRITICAL: object_story_id format = {page_id}_{post_id}
  const objectStoryId = `${pageId}_${postId}`;

  const body = {
    access_token: accessToken,
    name: adName,
    adset_id: adSetId,
    status: 'PAUSED',
    creative: JSON.stringify({
      object_story_id: objectStoryId
    })
  };

  const params = new URLSearchParams(body);

  const response = await fetch(url, {
    method: 'POST',
    body: params
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(`Facebook Ad Creation Error: ${JSON.stringify(data.error)}`);
  }

  return data; // {id: "ad_id"}
}

// ===================================================================
// EXPORT HELPER (để index-sync.js gọi)
// ===================================================================

export { createAdsFromJob };

console.log('✅ post-to-ad.js loaded');