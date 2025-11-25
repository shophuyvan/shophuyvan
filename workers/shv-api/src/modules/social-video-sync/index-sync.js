/**
 * Social Video Sync - Main Router
 * TikTok → Facebook Auto Sync with AI
 * 
 * Hỗ trợ 2 workflow:
 * 1. Legacy: Manual TikTok URL → 1 Fanpage (giữ nguyên)
 * 2. NEW: Product-based → 5 AI variants → Bulk Fanpages → Ads
 */

import { json, errorResponse } from '../../lib/response.js';
import { adminOK } from '../../lib/auth.js';
import { downloadTikTokVideo } from './tiktok-downloader.js';
import { GeminiContentGenerator } from './ai-content-generator.js';
import { uploadToFacebookPage } from './facebook-uploader.js';
import { createAdsFromJob as createAdsFromJobImpl } from './post-to-ad.js';
import { fetchGroupsFromFacebook, shareToGroup } from '../facebook/fb-group-manager.js';
import { publishScheduledPosts } from '../facebook/fb-scheduler-handler.js';

export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Auth check - Bảo mật: Chỉ admin mới được gọi
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  // ============================================================
  // LEGACY ROUTES (Giữ nguyên để không break code cũ)
  // ============================================================
  if (path === '/api/social-sync/submit' && method === 'POST') {
    return handleSubmit(req, env);
  }

  if (path === '/api/social-sync/publish' && method === 'POST') {
    return handlePublish(req, env);
  }

  if (path.startsWith('/api/social-sync/status/') && method === 'GET') {
    const syncId = path.split('/').pop();
    return handleStatus(syncId, env, req);
  }

  if (path === '/api/social-sync/history' && method === 'GET') {
    return handleHistory(req, env);
  }

  // ============================================================
  // NEW ROUTES - Auto Video Sync Workflow (5 bước)
  // ============================================================
  
  // STEP 1 & 2: Create Job + Download Video
  if (path === '/api/auto-sync/jobs/create' && method === 'POST') {
    return createAutomationJob(req, env);
  }

  // Get job detail
  if (path.match(/^\/api\/auto-sync\/jobs\/(\d+)$/) && method === 'GET') {
    const jobId = parseInt(path.match(/^\/api\/auto-sync\/jobs\/(\d+)$/)[1]);
    return getAutomationJob(req, env, jobId);
  }

  // Test AI Connection (NEW)
  if (path === '/api/auto-sync/test-ai' && method === 'GET') {
    return testAIConnection(req, env);
  }

  // STEP 3: Generate 5 AI Variants
  if (path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/generate-variants$/) && method === 'POST') {
    const jobId = parseInt(path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/generate-variants$/)[1]);
    return generateJobVariants(req, env, jobId);
  }

  // Get variants for a job
  if (path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/variants$/) && method === 'GET') {
    const jobId = parseInt(path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/variants$/)[1]);
    return getJobVariants(req, env, jobId);
  }

  // Edit variant caption
  if (path.match(/^\/api\/auto-sync\/variants\/(\d+)$/) && method === 'PATCH') {
    const variantId = parseInt(path.match(/^\/api\/auto-sync\/variants\/(\d+)$/)[1]);
    return updateVariant(req, env, variantId);
  }

  // STEP 4: Assign Fanpages
  if (path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/assign-fanpages$/) && method === 'POST') {
    const jobId = parseInt(path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/assign-fanpages$/)[1]);
    return assignFanpages(req, env, jobId);
  }

  // Get preview before publish
  if (path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/preview$/) && method === 'GET') {
    const jobId = parseInt(path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/preview$/)[1]);
    return getPublishPreview(req, env, jobId);
  }

  // --- NEW ROUTES FOR SCHEDULER & GROUPS ---

  // Route: Lưu kho (Pending/Scheduled) thay vì đăng ngay
  if (path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/save-pending$/) && method === 'POST') {
    const jobId = parseInt(path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/save-pending$/)[1]);
    return savePendingAssignments(req, env, jobId);
  }

  // Route: Cron Trigger (Gọi thủ công để test)
  if (path === '/api/cron/trigger-schedule' && method === 'POST') {
    const result = await publishScheduledPosts(env);
    return json({ ok: true, result }, {}, req);
  }

  // Route: Lấy danh sách Groups từ Facebook
  if (path === '/api/facebook/groups/fetch' && method === 'GET') {
    return handleFetchGroups(req, env);
  }

  // Route: Share bài đã đăng vào Group
  if (path.match(/^\/api\/auto-sync\/assignments\/(\d+)\/share-group$/) && method === 'POST') {
    const assignId = parseInt(path.match(/^\/api\/auto-sync\/assignments\/(\d+)\/share-group$/)[1]);
    return handleShareToGroup(req, env, assignId);
  }

  // ------------------------------------------

  // STEP 4: Bulk Publish to Fanpages
  if (path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/publish$/) && method === 'POST') {
    const jobId = parseInt(path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/publish$/)[1]);
    return bulkPublishJob(req, env, jobId);
  }

  // STEP 5: Create Ads from Job (Optional)
  if (path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/create-ads$/) && method === 'POST') {
    const jobId = parseInt(path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/create-ads$/)[1]);
    return createAdsFromJob(req, env, jobId);
  }

  // Get all jobs (History/Dashboard)
  if (path === '/api/auto-sync/jobs' && method === 'GET') {
    return listAutomationJobs(req, env);
  }

  return errorResponse('Route not found', 404, req);
}

// ===================================================================
// LEGACY: SUBMIT - Download video & generate AI content (3 versions)
// ===================================================================

async function handleSubmit(req, env) {
  try {
    const body = await req.json();
    const { tiktokUrl, brandVoice = 'friendly' } = body;

    if (!tiktokUrl) {
      return json({ ok: false, error: 'Missing tiktokUrl' }, { status: 400 }, req);
    }

    // 1. Download TikTok video
    const videoData = await downloadTikTokVideo(tiktokUrl, env);

    // 2. Save to database (Lưu lịch sử)
    const now = Date.now();
    const insertResult = await env.DB.prepare(`
      INSERT INTO video_syncs 
      (tiktok_url, tiktok_video_id, r2_path, r2_url, brand_voice, status, file_size, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'analyzing', ?, ?, ?)
    `).bind(
      tiktokUrl,
      videoData.videoId,
      videoData.r2Path,
      videoData.r2Url,
      brandVoice,
      videoData.fileSize,
      now,
      now
    ).run();

    const syncId = insertResult.meta.last_row_id;

    // 3. AI Analysis & Content Generation
    const generator = new GeminiContentGenerator(env.GEMINI_API_KEY);
    const analysis = await generator.analyzeVideo(videoData.r2Url);
    const contents = await generator.generateFacebookContent(analysis, brandVoice);

    // 4. Save AI-generated content (3 versions - legacy)
    const versions = ['versionA', 'versionB', 'versionC'];
    for (let i = 0; i < 3; i++) {
      const version = contents[versions[i]];
      const hashtagsStr = Array.isArray(version.hashtags) ? JSON.stringify(version.hashtags) : version.hashtags;
      
      await env.DB.prepare(`
        INSERT INTO ai_generated_content
        (video_sync_id, version, caption, hashtags, video_analysis, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        syncId,
        i + 1,
        version.caption,
        hashtagsStr,
        JSON.stringify(analysis),
        now
      ).run();
    }

    // 5. Update status to 'ready'
    await env.DB.prepare(`
      UPDATE video_syncs SET status = 'ready', updated_at = ? WHERE id = ?
    `).bind(now, syncId).run();

    return json({
      ok: true,
      syncId,
      videoUrl: videoData.r2Url,
      analysis,
      contents
    }, {}, req);

  } catch (error) {
    console.error('[Social Sync] Submit error:', error);
    return errorResponse(error.message, 500, req);
  }
}

// ===================================================================
// STEP 2: PUBLISH - Post to Facebook
// ===================================================================

async function handlePublish(req, env) {
  try {
    const body = await req.json();
    const { syncId, selectedVersion = 1, pageId } = body;

    if (!syncId || !pageId) {
      return json({ ok: false, error: 'Missing syncId or pageId' }, { status: 400 }, req);
    }

    // Get video sync data
    const syncData = await env.DB.prepare(`
      SELECT * FROM video_syncs WHERE id = ?
    `).bind(syncId).first();

    if (!syncData) {
      return json({ ok: false, error: 'Video sync not found' }, { status: 404 }, req);
    }

    // Get AI content
    const contentData = await env.DB.prepare(`
      SELECT * FROM ai_generated_content WHERE video_sync_id = ? AND version = ?
    `).bind(syncId, selectedVersion).first();

    if (!contentData) {
      return json({ ok: false, error: 'AI content not found' }, { status: 404 }, req);
    }

    // Upload to Facebook
    const fbResult = await uploadToFacebookPage(
      pageId,
      syncData.r2_url,
      contentData.caption,
      env
    );

    // Save result
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO facebook_posts
      (video_sync_id, ai_content_id, page_id, post_id, post_url, status, published_at, created_at)
      VALUES (?, ?, ?, ?, ?, 'published', ?, ?)
    `).bind(
      syncId,
      contentData.id,
      pageId,
      fbResult.postId,
      fbResult.postUrl,
      now,
      now
    ).run();

    // Update sync status
    await env.DB.prepare(`
      UPDATE video_syncs SET status = 'completed', updated_at = ? WHERE id = ?
    `).bind(now, syncId).run();

    return json({
      ok: true,
      postId: fbResult.postId,
      postUrl: fbResult.postUrl
    }, {}, req);

  } catch (error) {
    console.error('[Social Sync] Publish error:', error);
    return errorResponse(error.message, 500, req);
  }
}

// ===================================================================
// GET STATUS
// ===================================================================

async function handleStatus(syncId, env, req) {
  try {
    const data = await env.DB.prepare(`
      SELECT * FROM video_syncs WHERE id = ?
    `).bind(syncId).first();

    if (!data) {
      return json({ ok: false, error: 'Not found' }, { status: 404 }, req);
    }

    return json({ ok: true, data }, {}, req);

  } catch (error) {
    return errorResponse(error.message, 500, req);
  }
}

// ===================================================================
// GET HISTORY
// ===================================================================

async function handleHistory(req, env) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT * FROM video_syncs ORDER BY created_at DESC LIMIT 50
    `).all();

    return json({ ok: true, data: results }, {}, req);

  } catch (error) {
    return errorResponse(error.message, 500, req);
  }
}

// ===================================================================
// NEW WORKFLOW - STEP 1 & 2: Create Automation Job + Download Video
// ===================================================================

async function createAutomationJob(req, env) {
  try {
    const body = await req.json();
    const { productId, tiktokUrl } = body;

    if (!productId || !tiktokUrl) {
      return json({ ok: false, error: 'Missing productId or tiktokUrl' }, { status: 400 }, req);
    }

    const now = Date.now();

    // 1. Get product info
    const product = await env.DB.prepare(`
      SELECT id, title, slug, shortDesc, images, category_slug
      FROM products WHERE id = ?
    `).bind(productId).first();

    if (!product) {
      return json({ ok: false, error: 'Product not found' }, { status: 404 }, req);
    }

    // Get product price from first variant
    const variant = await env.DB.prepare(`
      SELECT price, price_sale FROM variants 
      WHERE product_id = ? AND status = 'active'
      ORDER BY id LIMIT 1
    `).bind(productId).first();

    const productPrice = variant?.price_sale || variant?.price || 0;
    const productUrl = `https://shophuyvan.vn/san-pham/${product.slug}`;
    const productImage = product.images ? JSON.parse(product.images)[0] : null;

    // 2. Download TikTok video
    const videoData = await downloadTikTokVideo(tiktokUrl, env);

    // 3. Create automation job
    const jobResult = await env.DB.prepare(`
      INSERT INTO automation_jobs
      (product_id, product_name, product_slug, product_url, product_price, product_image,
       tiktok_url, tiktok_video_id, video_r2_path, video_r2_url, video_file_size,
       status, current_step, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'video_uploaded', 2, ?, ?)
    `).bind(
      productId,
      product.title,
      product.slug,
      productUrl,
      productPrice,
      productImage,
      tiktokUrl,
      videoData.videoId,
      videoData.r2Path,
      videoData.r2Url,
      videoData.fileSize,
      now,
      now
    ).run();

    const jobId = jobResult.meta.last_row_id;

    return json({
      ok: true,
      jobId,
      status: 'video_uploaded',
      currentStep: 2,
      videoUrl: videoData.r2Url,
      fileSize: videoData.fileSize,
      product: {
        id: product.id,
        name: product.title,
        url: productUrl,
        price: productPrice
      }
    }, {}, req);

  } catch (error) {
    console.error('[Auto Sync] Create job error:', error);
    return errorResponse(error.message, 500, req);
  }
}

// ===================================================================
// NEW WORKFLOW - Get Job Detail
// ===================================================================

async function getAutomationJob(req, env, jobId) {
  try {
    const job = await env.DB.prepare(`
      SELECT * FROM automation_jobs WHERE id = ?
    `).bind(jobId).first();

    if (!job) {
      return json({ ok: false, error: 'Job not found' }, { status: 404 }, req);
    }

    return json({ ok: true, job }, {}, req);

  } catch (error) {
    return errorResponse(error.message, 500, req);
  }
}

// ===================================================================
// NEW WORKFLOW - STEP 3: Generate 5 AI Variants
// ===================================================================

async function generateJobVariants(req, env, jobId) {
  try {
    // Get job info
    const job = await env.DB.prepare(`
      SELECT * FROM automation_jobs WHERE id = ?
    `).bind(jobId).first();

    if (!job) {
      return json({ ok: false, error: 'Job not found' }, { status: 404 }, req);
    }

    if (job.status !== 'video_uploaded') {
      return json({ ok: false, error: 'Job must be in video_uploaded status' }, { status: 400 }, req);
    }

    const now = Date.now();

    // AI generate 5 variants
    console.log("[Generate Variants] Initializing Gemini for job:", jobId);
    const generator = new GeminiContentGenerator(env.GEMINI_API_KEY);
    
    console.log("[Generate Variants] Analyzing video:", job.video_r2_url);
    const analysis = await generator.analyzeVideo(job.video_r2_url);
    
    const productInfo = {
      name: job.product_name,
      description: job.product_slug,
      price: job.product_price,
      url: job.product_url
    };

    console.log("[Generate Variants] Calling Gemini API for content generation...");
    const contents = await generator.generateFacebookContent(analysis, 'friendly', productInfo);
    console.log("[Generate Variants] AI generation completed successfully");

    // Save 5 variants to content_variants table
    const versions = ['version1', 'version2', 'version3', 'version4', 'version5'];
    const toneMap = {
      version1: 'casual',
      version2: 'sale-heavy',
      version3: 'storytelling',
      version4: 'professional',
      version5: 'tips'
    };

    const variants = [];
    for (let i = 0; i < 5; i++) {
      const version = contents[versions[i]];
      const hashtagsStr = Array.isArray(version.hashtags) ? JSON.stringify(version.hashtags) : version.hashtags;
      
      const result = await env.DB.prepare(`
        INSERT INTO content_variants
        (job_id, version, tone, caption, hashtags, cta, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        jobId,
        i + 1,
        version.tone || toneMap[versions[i]],
        version.caption,
        hashtagsStr,
        version.cta || '',
        now
      ).run();

      variants.push({
        id: result.meta.last_row_id,
        version: i + 1,
        tone: version.tone || toneMap[versions[i]],
        caption: version.caption,
        hashtags: version.hashtags,
        cta: version.cta
      });
    }

    // Update job status
    await env.DB.prepare(`
      UPDATE automation_jobs 
      SET status = 'ai_generated', current_step = 3, total_variants = 5, updated_at = ?
      WHERE id = ?
    `).bind(now, jobId).run();

    return json({
      ok: true,
      jobId,
      status: 'ai_generated',
      currentStep: 3,
      variants
    }, {}, req);

  } catch (error) {
    console.error('[Auto Sync] Generate variants error:', error);
    console.error('[Auto Sync] Error details:', {
      jobId,
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // Update job with error
    try {
      await env.DB.prepare(`
        UPDATE automation_jobs 
        SET status = 'failed', error_message = ?, error_step = 3, updated_at = ?
        WHERE id = ?
      `).bind(error.message, Date.now(), jobId).run();
    } catch (dbError) {
      console.error('[Auto Sync] Failed to update job status:', dbError);
    }
    
    return errorResponse(error.message, 500, req);
  }
}

// ===================================================================
// NEW WORKFLOW - Get Variants for Job
// ===================================================================

async function getJobVariants(req, env, jobId) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT * FROM content_variants WHERE job_id = ? ORDER BY version
    `).bind(jobId).all();

    return json({
      ok: true,
      variants: results.map(v => ({
        ...v,
        hashtags: JSON.parse(v.hashtags || '[]')
      }))
    }, {}, req);

  } catch (error) {
    return errorResponse(error.message, 500, req);
  }
}

// ===================================================================
// NEW WORKFLOW - Update Variant (Edit caption)
// ===================================================================

async function updateVariant(req, env, variantId) {
  try {
    const body = await req.json();
    const { caption, hashtags } = body;

    const now = Date.now();
    const hashtagsStr = Array.isArray(hashtags) ? JSON.stringify(hashtags) : hashtags;

    // Backup original if first edit
    const variant = await env.DB.prepare(`
      SELECT * FROM content_variants WHERE id = ?
    `).bind(variantId).first();

    if (variant && !variant.is_edited) {
      await env.DB.prepare(`
        UPDATE content_variants 
        SET original_caption = ?, is_edited = 1, caption = ?, hashtags = ?
        WHERE id = ?
      `).bind(variant.caption, caption, hashtagsStr, variantId).run();
    } else {
      await env.DB.prepare(`
        UPDATE content_variants 
        SET caption = ?, hashtags = ?
        WHERE id = ?
      `).bind(caption, hashtagsStr, variantId).run();
    }

    return json({ ok: true, message: 'Variant updated' }, {}, req);

  } catch (error) {
    return errorResponse(error.message, 500, req);
  }
}

// ===================================================================
// NEW WORKFLOW - STEP 4: Assign Fanpages
// ===================================================================

async function assignFanpages(req, env, jobId) {
  try {
    const body = await req.json();
    const { assignments } = body; // [{fanpageId, variantId}]

    if (!assignments || assignments.length === 0) {
      return json({ ok: false, error: 'Missing assignments' }, { status: 400 }, req);
    }

    const now = Date.now();

    // Delete old assignments
    await env.DB.prepare(`
      DELETE FROM fanpage_assignments WHERE job_id = ?
    `).bind(jobId).run();

    // Insert new assignments
    for (const assign of assignments) {
      const fanpage = await env.DB.prepare(`
        SELECT page_id, page_name FROM fanpages WHERE page_id = ?
      `).bind(assign.fanpageId).first();

      if (fanpage) {
        await env.DB.prepare(`
          INSERT INTO fanpage_assignments
          (job_id, fanpage_id, fanpage_name, variant_id, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'pending', ?, ?)
        `).bind(
          jobId,
          assign.fanpageId,
          fanpage.page_name,
          assign.variantId,
          now,
          now
        ).run();
      }
    }

    // Update job
    await env.DB.prepare(`
      UPDATE automation_jobs 
      SET status = 'assigned', current_step = 4, total_fanpages_assigned = ?, updated_at = ?
      WHERE id = ?
    `).bind(assignments.length, now, jobId).run();

    return json({
      ok: true,
      jobId,
      status: 'assigned',
      currentStep: 4,
      totalAssigned: assignments.length
    }, {}, req);

  } catch (error) {
    return errorResponse(error.message, 500, req);
  }
}

// ===================================================================
// NEW WORKFLOW - Get Preview Before Publish
// ===================================================================

async function getPublishPreview(req, env, jobId) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT 
        fa.fanpage_id, fa.fanpage_name, fa.variant_id,
        cv.caption, cv.hashtags, cv.tone
      FROM fanpage_assignments fa
      JOIN content_variants cv ON fa.variant_id = cv.id
      WHERE fa.job_id = ? AND fa.status = 'pending'
    `).bind(jobId).all();

    const preview = results.map(r => ({
      fanpageId: r.fanpage_id,
      fanpageName: r.fanpage_name,
      tone: r.tone,
      caption: r.caption,
      hashtags: JSON.parse(r.hashtags || '[]')
    }));

    return json({ ok: true, preview }, {}, req);

  } catch (error) {
    return errorResponse(error.message, 500, req);
  }
}

// ===================================================================
// NEW WORKFLOW - STEP 4: Bulk Publish to Fanpages
// ===================================================================

async function bulkPublishJob(req, env, jobId) {
  try {
    // Get job
    const job = await env.DB.prepare(`
      SELECT * FROM automation_jobs WHERE id = ?
    `).bind(jobId).first();

    if (!job) {
      return json({ ok: false, error: 'Job not found' }, { status: 404 }, req);
    }

    // Update job status to publishing
    const now = Date.now();
    await env.DB.prepare(`
      UPDATE automation_jobs SET status = 'publishing', updated_at = ? WHERE id = ?
    `).bind(now, jobId).run();

    // Get all assignments
    const { results: assignments } = await env.DB.prepare(`
      SELECT 
        fa.id, fa.fanpage_id, fa.fanpage_name, fa.variant_id,
        cv.caption, cv.hashtags
      FROM fanpage_assignments fa
      JOIN content_variants cv ON fa.variant_id = cv.id
      WHERE fa.job_id = ? AND fa.status = 'pending'
    `).bind(jobId).all();

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    // Publish to each fanpage
    for (const assign of assignments) {
      try {
        // Update status to publishing
        await env.DB.prepare(`
          UPDATE fanpage_assignments SET status = 'publishing', updated_at = ?
          WHERE id = ?
        `).bind(now, assign.id).run();

        // Upload to Facebook
        const fbResult = await uploadToFacebookPage(
          assign.fanpage_id,
          job.video_r2_url,
          assign.caption,
          env
        );

        // Update success
        await env.DB.prepare(`
          UPDATE fanpage_assignments 
          SET status = 'published', post_id = ?, post_url = ?, published_at = ?, updated_at = ?
          WHERE id = ?
        `).bind(
          fbResult.postId,
          fbResult.postUrl,
          now,
          now,
          assign.id
        ).run();

        results.push({
          fanpageId: assign.fanpage_id,
          fanpageName: assign.fanpage_name,
          success: true,
          postId: fbResult.postId,
          postUrl: fbResult.postUrl
        });

        successCount++;

      } catch (error) {
        // Update failed
        await env.DB.prepare(`
          UPDATE fanpage_assignments 
          SET status = 'failed', error_message = ?, updated_at = ?
          WHERE id = ?
        `).bind(error.message, now, assign.id).run();

        results.push({
          fanpageId: assign.fanpage_id,
          fanpageName: assign.fanpage_name,
          success: false,
          error: error.message
        });

        failedCount++;
      }
    }

    // Update job final status
    await env.DB.prepare(`
      UPDATE automation_jobs 
      SET status = 'published', current_step = 5, 
          total_posts_published = ?, total_posts_failed = ?, updated_at = ?
      WHERE id = ?
    `).bind(successCount, failedCount, now, jobId).run();

    return json({
      ok: true,
      jobId,
      status: 'published',
      results,
      successCount,
      failedCount
    }, {}, req);

  } catch (error) {
    console.error('[Auto Sync] Bulk publish error:', error);
    return errorResponse(error.message, 500, req);
  }
}

// ===================================================================
// NEW WORKFLOW - STEP 5: Create Ads from Job (Optional)
// ===================================================================

async function createAdsFromJob(req, env, jobId) {
  // Delegate to post-to-ad.js module
  return createAdsFromJobImpl(req, env, jobId);
}

// ===================================================================
// NEW WORKFLOW - List All Jobs
// ===================================================================

async function listAutomationJobs(req, env) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const status = url.searchParams.get('status');

    let query = 'SELECT * FROM automation_jobs';
    let params = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const { results } = await env.DB.prepare(query).bind(...params).all();

    return json({ ok: true, jobs: results, total: results.length }, {}, req);

  } catch (error) {
    return errorResponse(error.message, 500, req);
  }
}

// ===================================================================
// HELPER: Test AI Connection
// ===================================================================

async function testAIConnection(req, env) {
  try {
    console.log("[Test AI] Starting connection test...");
    
    // Check 1: API Key exists
    if (!env.GEMINI_API_KEY) {
      console.error("[Test AI] Missing GEMINI_API_KEY");
      return json({ 
        ok: false, 
        error: "Chưa cấu hình GEMINI_API_KEY trong Worker",
        step: "check_api_key"
      }, { status: 500 }, req);
    }

    console.log("[Test AI] API Key found, length:", env.GEMINI_API_KEY.length);

    // Check 2: Initialize Generator
    let generator;
    try {
      generator = new GeminiContentGenerator(env.GEMINI_API_KEY);
      console.log("[Test AI] Generator initialized successfully");
    } catch (error) {
      console.error("[Test AI] Failed to initialize generator:", error);
      return json({ 
        ok: false, 
        error: `Khởi tạo Generator thất bại: ${error.message}`,
        step: "init_generator"
      }, { status: 500 }, req);
    }

    // Check 3: Test Connection
    let testResult;
    try {
      console.log("[Test AI] Calling testConnection()...");
      testResult = await generator.testConnection();
      console.log("[Test AI] Test successful, response:", testResult);
    } catch (error) {
      console.error("[Test AI] Connection test failed:", error);
      return json({ 
        ok: false, 
        error: `Test kết nối thất bại: ${error.message}`,
        step: "test_connection",
        details: {
          name: error.name,
          message: error.message
        }
      }, { status: 500 }, req);
    }

    // Success
    return json({ 
      ok: true, 
      message: "Gemini AI kết nối thành công!",
      test_response: testResult,
      api_key_length: env.GEMINI_API_KEY.length,
      model: "models/gemini-2.5-flash",
      timestamp: new Date().toISOString()
    }, {}, req);

  } catch (error) {
    console.error("[Test AI] Unexpected error:", error);
    return json({ 
      ok: false, 
      error: error.message,
      step: "unexpected_error",
      stack: error.stack
    }, { status: 500 }, req);
  }
}

     // ===================================================================
     // NEW HANDLERS: SCHEDULER & GROUPS
     // ===================================================================
     
     async function savePendingAssignments(req, env, jobId) {
       try {
         const body = await req.json();
         const { scheduledTime } = body; // timestamp hoặc null

    // Update job status (Sử dụng 'assigned' vì DB không cho phép 'pending')
    await env.DB.prepare(`
      UPDATE automation_jobs SET status = 'assigned', updated_at = ? WHERE id = ?
    `).bind(Date.now(), jobId).run();

    // Update assignments status
    // Nếu có scheduledTime -> set thời gian, status vẫn là 'pending' chờ Cron quét
    await env.DB.prepare(`
      UPDATE fanpage_assignments 
      SET status = 'pending', scheduled_time = ?, updated_at = ?
      WHERE job_id = ? AND status = 'pending'
    `).bind(scheduledTime || null, Date.now(), jobId).run();

    return json({ ok: true, message: scheduledTime ? 'Đã lên lịch đăng bài!' : 'Đã lưu vào kho chờ đăng!' }, {}, req);
  } catch (error) {
    return errorResponse(error.message, 500, req);
  }
}

async function handleFetchGroups(req, env) {
  try {
    // Lấy token từ settings
    const setting = await env.DB.prepare("SELECT value FROM settings WHERE path = 'facebook_ads_token'").first();
    const tokenData = setting ? JSON.parse(setting.value) : null;
    
    if (!tokenData || !tokenData.access_token) {
      return json({ ok: false, error: 'Chưa có Access Token' }, { status: 400 }, req);
    }

    const groups = await fetchGroupsFromFacebook(tokenData.access_token);
    
    // Lưu cache vào DB (optional, hoặc trả về luôn)
    return json({ ok: true, groups }, {}, req);
  } catch (error) {
    return errorResponse(error.message, 500, req);
  }
}

async function handleShareToGroup(req, env, assignId) {
  try {
    const body = await req.json();
    const { groupId, message } = body;

    // Lấy thông tin bài gốc
    const assign = await env.DB.prepare("SELECT post_url FROM fanpage_assignments WHERE id = ?").bind(assignId).first();
    if (!assign || !assign.post_url) return json({ ok: false, error: 'Bài viết chưa được đăng lên Page' }, { status: 400 }, req);

    // Lấy token
    const setting = await env.DB.prepare("SELECT value FROM settings WHERE path = 'facebook_ads_token'").first();
    const token = JSON.parse(setting.value).access_token;

    const result = await shareToGroup(groupId, assign.post_url, message || '', token);

    // Log share
    await env.DB.prepare(`
      INSERT INTO group_shares (assignment_id, group_id, status, share_post_id, created_at, shared_at)
      VALUES (?, ?, 'shared', ?, ?, ?)
    `).bind(assignId, groupId, result.postId, Date.now(), Date.now()).run();

    return json({ ok: true, result }, {}, req);
  } catch (error) {
    return errorResponse(error.message, 500, req);
  }
}

console.log('✅ social-video-sync/index.js loaded');