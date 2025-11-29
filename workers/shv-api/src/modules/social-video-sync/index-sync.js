/**
 * Social Video Sync - Main Router
 * TikTok → Facebook Auto Sync with AI
 * 
 * Hỗ trợ 2 workflow:
 * 1. Legacy: Manual TikTok URL → 1 Fanpage (giữ nguyên)
 * 2. NEW: Product-based → 5 AI variants → Bulk Fanpages → Ads
 */

import { json, errorResponse } from '../../lib/response.js';
import { getSetting } from '../settings.js'; // ✅ Dùng module chuẩn D1
import { adminOK } from '../../lib/auth.js';
import { downloadTikTokVideo } from './tiktok-downloader.js';
import { GeminiContentGenerator } from './ai-content-generator.js';
import { uploadToFacebookPage } from './facebook-uploader.js';
import { createAdsFromJob as createAdsFromJobImpl } from './post-to-ad.js';
import { 
  fetchGroupsFromFacebook, 
  shareToGroup, 
  saveScheduledGroupPost,    // ✅ Import hàm lưu lịch
  getScheduledGroupPosts     // ✅ Import hàm lấy danh sách
} from '../facebook/fb-group-manager.js';
import { 
  publishScheduledPosts, 
  scheduleBatchPosts, 
  getScheduledPosts, 
  retryFailedPost 
} from '../facebook/fb-scheduler-handler.js';

// NEW: Douyin Upload handlers
import { 
  uploadDouyinVideos, 
  getUploadedVideos 
} from './douyin/douyin-upload-handler.js';
import { 
  batchAnalyzeVideos, 
  getBatchStatus 
} from './douyin/douyin-batch-analyzer.js';
import { renderVideo } from './douyin/douyin-render-service.js';
import { testTTSConnection, AVAILABLE_VOICES } from './douyin/douyin-tts-service.js';

export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Auth check - Bảo mật: Chỉ admin mới được gọi
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  // ============================================================
  // LEGACY ROUTES
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

  if (path === '/api/products' && method === 'GET') {
    return searchProducts(req, env);
  }

  // ============================================================
  // NEW ROUTES - Auto Video Sync
  // ============================================================
  if (path === '/api/auto-sync/jobs/create' && method === 'POST') {
    return createAutomationJob(req, env);
  }

  if (path === '/api/auto-sync/jobs/create-upload' && method === 'POST') {
    return createJobFromUpload(req, env);
  }

  if (path.match(/^\/api\/auto-sync\/jobs\/(\d+)$/) && method === 'GET') {
    const jobId = parseInt(path.match(/^\/api\/auto-sync\/jobs\/(\d+)$/)[1]);
    return getAutomationJob(req, env, jobId);
  }

  if (path === '/api/auto-sync/test-ai' && method === 'GET') {
    return testAIConnection(req, env);
  }

  if (path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/generate-variants$/) && method === 'POST') {
    const jobId = parseInt(path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/generate-variants$/)[1]);
    return generateJobVariants(req, env, jobId);
  }

  if (path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/variants$/) && method === 'GET') {
    const jobId = parseInt(path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/variants$/)[1]);
    return getJobVariants(req, env, jobId);
  }

  if (path.match(/^\/api\/auto-sync\/variants\/(\d+)$/) && method === 'PATCH') {
    const variantId = parseInt(path.match(/^\/api\/auto-sync\/variants\/(\d+)$/)[1]);
    return updateVariant(req, env, variantId);
  }

  if (path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/assign-fanpages$/) && method === 'POST') {
    const jobId = parseInt(path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/assign-fanpages$/)[1]);
    return assignFanpages(req, env, jobId);
  }

  if (path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/preview$/) && method === 'GET') {
    const jobId = parseInt(path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/preview$/)[1]);
    return getPublishPreview(req, env, jobId);
  }

  if (path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/save-pending$/) && method === 'POST') {
    const jobId = parseInt(path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/save-pending$/)[1]);
    return savePendingAssignments(req, env, jobId);
  }

  if (path === '/api/cron/trigger-schedule' && method === 'POST') {
    const result = await publishScheduledPosts(env);
    return json({ ok: true, result }, {}, req);
  }

  if (path === '/api/facebook/posts/schedule-batch' && method === 'POST') {
    return scheduleBatchPosts(req, env);
  }

  if (path === '/api/facebook/posts/scheduled' && method === 'GET') {
    return getScheduledPosts(req, env);
  }

  if (path === '/api/facebook/posts/retry' && method === 'POST') {
    return retryFailedPost(req, env);
  }

  if (path === '/api/facebook/groups/share-history' && method === 'GET') {
      const assignmentId = url.searchParams.get('assignmentId');
      if (!assignmentId) return errorResponse('Missing assignmentId', 400, req);
      try {
        const { results } = await env.DB.prepare(`
            SELECT * FROM group_share_history WHERE assignment_id = ? ORDER BY created_at DESC
        `).bind(assignmentId).all();
        return json({ ok: true, history: results }, {}, req);
      } catch (e) {
        return errorResponse(e.message, 500, req);
      }
  }

  if (path === '/api/facebook/groups/fetch' && method === 'GET') {
    return handleFetchGroups(req, env);
  }

  if (path.match(/^\/api\/auto-sync\/assignments\/(\d+)\/share-group$/) && method === 'POST') {
    const assignId = parseInt(path.match(/^\/api\/auto-sync\/assignments\/(\d+)\/share-group$/)[1]);
    return handleShareToGroup(req, env, assignId);
  }

  if (path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/publish$/) && method === 'POST') {
    const jobId = parseInt(path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/publish$/)[1]);
    return bulkPublishJob(req, env, jobId);
  }

  if (path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/create-ads$/) && method === 'POST') {
    const jobId = parseInt(path.match(/^\/api\/auto-sync\/jobs\/(\d+)\/create-ads$/)[1]);
    return createAdsFromJob(req, env, jobId);
  }

  if (path === '/api/auto-sync/jobs' && method === 'GET') {
    return listAutomationJobs(req, env);
  }

  if ((path === '/api/social/douyin/products' || path === '/api/products') && method === 'GET') {
    return searchProducts(req, env);
  }

  // DOUYIN ROUTES
  if (path === '/api/social/douyin/upload' && method === 'POST') return await uploadDouyinVideos(req, env);
  if (path === '/api/social/douyin/uploads' && method === 'GET') return await getUploadedVideos(req, env);
  if (path === '/api/social/douyin/batch-analyze' && method === 'POST') return await batchAnalyzeVideos(req, env);
  if (path === '/api/social/douyin/batch-status' && method === 'GET') return await getBatchStatus(req, env);
  if (path === '/api/social/douyin/render' && method === 'POST') return await renderVideo(req, env);
  if (path === '/api/social/douyin/tts-test' && method === 'GET') {
    const result = await testTTSConnection(env);
    return json(result, {}, req);
  }
  if (path === '/api/social/douyin/voices' && method === 'GET') {
    return json({ ok: true, voices: Object.values(AVAILABLE_VOICES) }, {}, req);
  }

  if (path === '/api/social/health' && method === 'GET') {
    return json({ ok: true, service: 'social-video-sync', version: '2.0', timestamp: new Date().toISOString() }, {}, req);
  }

  // --- NEW: GROUP SCHEDULING ROUTES ---
  if (path === '/api/facebook/groups/schedule' && method === 'POST') {
    try {
      const body = await req.json();
      if (!body.fanpage_id || !body.group_ids || body.group_ids.length === 0) {
         return errorResponse('Thiếu thông tin Fanpage hoặc Group', 400, req);
      }
      const id = await saveScheduledGroupPost(env, body);
      return json({ ok: true, id, message: 'Đã lên lịch share vào nhóm thành công' }, {}, req);
    } catch (e) {
      return errorResponse('Lỗi lưu lịch nhóm: ' + e.message, 500, req);
    }
  }

  if (path === '/api/facebook/groups/scheduled' && method === 'GET') {
    try {
      const url = new URL(req.url);
      const status = url.searchParams.get('status');
      const posts = await getScheduledGroupPosts(env, { status });
      return json({ ok: true, posts }, {}, req);
    } catch (e) {
      return errorResponse('Lỗi lấy danh sách nhóm: ' + e.message, 500, req);
    }
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
    // 1. Lấy thông tin Job
    const job = await env.DB.prepare(`
      SELECT * FROM automation_jobs WHERE id = ?
    `).bind(jobId).first();

    if (!job) {
      return json({ ok: false, error: 'Job not found' }, { status: 404 }, req);
    }

    // 2. Lấy danh sách Fanpage đã gán cho Job này
    // Để hiển thị trong Modal "Bài viết này sẽ được đăng lên..."
    const { results: assignments } = await env.DB.prepare(`
      SELECT fanpage_name, status FROM fanpage_assignments WHERE job_id = ?
    `).bind(jobId).all();

    job.fanpages = assignments.map(a => a.fanpage_name); 

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

    // Save 5 variants to content_variants table (Logic An Toàn)
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
      const key = versions[i];
      // Fallback: Nếu AI không trả về key này, lấy key đầu tiên hoặc tạo nội dung rỗng để không bị lỗi loop
      let versionData = contents[key];
      
      if (!versionData) {
         // Thử fallback sang các key khác nếu AI trả về format lạ (vd: versionA, versionB)
         const fallbackKey = Object.keys(contents)[i];
         if(fallbackKey) versionData = contents[fallbackKey];
      }

      // Nếu vẫn không có, tạo dummy data để đảm bảo DB luôn có 5 dòng
      if (!versionData) {
          versionData = {
              caption: `(AI chưa tạo được nội dung cho version này. Bạn hãy tự viết nhé!) \n\n${job.product_name}`,
              hashtags: [],
              tone: toneMap[key],
              cta: 'Mua ngay'
          };
      }

      const hashtagsStr = Array.isArray(versionData.hashtags) ? JSON.stringify(versionData.hashtags) : (versionData.hashtags || '[]');
      const tone = versionData.tone || toneMap[key] || 'custom';
      
      const result = await env.DB.prepare(`
        INSERT INTO content_variants
        (job_id, version, tone, caption, hashtags, cta, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        jobId,
        i + 1,
        tone,
        versionData.caption || '',
        hashtagsStr,
        versionData.cta || '',
        now
      ).run();

      variants.push({
        id: result.meta.last_row_id,
        version: i + 1,
        tone: tone,
        caption: versionData.caption || '',
        hashtags: Array.isArray(versionData.hashtags) ? versionData.hashtags : [],
        cta: versionData.cta
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
// NEW WORKFLOW - Create Job from File Upload
// ===================================================================

async function createJobFromUpload(req, env) {
  try {
    const formData = await req.formData();
    const productId = formData.get('productId');
    const file = formData.get('videoFile');

    if (!productId || !file) {
      return json({ ok: false, error: 'Thiếu sản phẩm hoặc file video' }, { status: 400 }, req);
    }

    const now = Date.now();

    // 1. Lấy thông tin sản phẩm
    const product = await env.DB.prepare(`
      SELECT id, title, slug, shortDesc, images, category_slug
      FROM products WHERE id = ?
    `).bind(productId).first();

    if (!product) return json({ ok: false, error: 'Product not found' }, { status: 404 }, req);

    const variant = await env.DB.prepare(`
      SELECT price, price_sale FROM variants 
      WHERE product_id = ? AND status = 'active'
      ORDER BY id LIMIT 1
    `).bind(productId).first();
    const productPrice = variant?.price_sale || variant?.price || 0;
    const productUrl = `https://shophuyvan.vn/san-pham/${product.slug}`;
    const productImage = product.images ? JSON.parse(product.images)[0] : null;

   // 2. Upload Video lên R2
    // ✅ FIX: Gọi đúng tên biến binding "SOCIAL_VIDEOS" như trong wrangler.toml
    const bucket = env.SOCIAL_VIDEOS;
    
    if (!bucket) {
        throw new Error('LỖI CẤU HÌNH: Không tìm thấy biến env.SOCIAL_VIDEOS. Hãy kiểm tra wrangler.toml!');
    }

    const fileName = `upload_${now}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
    const r2Path = `videos/${fileName}`;
    
    // Upload stream lên R2
    await bucket.put(r2Path, file.stream(), {
      httpMetadata: { contentType: file.type }
    });

    // ✅ FIX: Sử dụng domain thật từ Cloudflare R2 (theo ảnh bạn gửi)
    const publicDomain = env.PUBLIC_R2_URL || 'https://social-videos.shophuyvan.vn';
    const r2Url = `${publicDomain}/${r2Path}`;

    // 3. Tạo Job
    const jobResult = await env.DB.prepare(`
      INSERT INTO automation_jobs
      (product_id, product_name, product_slug, product_url, product_price, product_image,
       tiktok_url, video_r2_path, video_r2_url, video_file_size,
       status, current_step, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'video_uploaded', 2, ?, ?)
    `).bind(
      productId,
      product.title,
      product.slug,
      productUrl,
      productPrice,
      productImage,
      'local_upload', // Đánh dấu là upload local
      r2Path,
      r2Url,
      file.size,
      now,
      now
    ).run();

    return json({
      ok: true,
      jobId: jobResult.meta.last_row_id,
      status: 'video_uploaded',
      currentStep: 2,
      videoUrl: r2Url,
      fileSize: file.size,
      product: { id: product.id, name: product.title }
    }, {}, req);

  } catch (error) {
    console.error('[Auto Sync] Upload error:', error);
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
     
     // Cập nhật cả trạng thái Job và Nội dung 5 Variants
    async function savePendingAssignments(req, env, jobId) {
      try {
        const body = await req.json();
        const { scheduledTime, variants } = body;
        const now = Date.now();
    
        // ✅ LOG ĐỂ DEBUG
        console.log(`[savePending] JobID: ${jobId}, Received ${variants?.length || 0} variants`);
    
        // 1. Cập nhật nội dung các Variants (nếu có gửi lên)
        if (variants && Array.isArray(variants) && variants.length > 0) {
          for (const v of variants) {
            // Chuẩn hóa hashtags thành chuỗi JSON
            const tagsStr = Array.isArray(v.hashtags) ? JSON.stringify(v.hashtags) : v.hashtags;
            
            // Update từng variant theo ID và Job ID
            await env.DB.prepare(`
              UPDATE content_variants 
              SET caption = ?, hashtags = ?, is_edited = 1
              WHERE id = ? AND job_id = ?
            `).bind(v.caption, tagsStr, v.id, jobId).run();
            
            console.log(`[savePending] Updated variant ID ${v.id}`);
          }
    }

    // 2. Update job status
    await env.DB.prepare(`
      UPDATE automation_jobs 
      SET status = 'assigned', updated_at = ? 
      WHERE id = ?
    `).bind(now, jobId).run();

    return json({ 
      ok: true, 
      message: `Đã lưu thành công ${variants?.length || 0} phiên bản nội dung vào kho!` 
    }, {}, req);

  } catch (error) {
    console.error('[savePendingAssignments] Error:', error);
    return errorResponse(error.message, 500, req);
  }
}

    await env.DB.prepare(`
      UPDATE automation_jobs SET status = 'assigned', updated_at = ? WHERE id = ?
    `).bind(now, jobId).run();

    // 3. Update assignments status (nếu có các lệnh đăng chờ sẵn)
    await env.DB.prepare(`
      UPDATE fanpage_assignments 
      SET status = 'pending', scheduled_time = ?, updated_at = ?
      WHERE job_id = ? AND status = 'pending'
    `).bind(scheduledTime || null, now, jobId).run();

    return json({ 
      ok: true, 
      message: 'Đã lưu thành công 5 phiên bản nội dung vào kho!' 
    }, {}, req);

  } catch (error) {
    console.error('[savePendingAssignments] Error:', error);
    return errorResponse(error.message, 500, req);
  }
}

async function handleFetchGroups(req, env) {
  try {
    // ✅ Dùng getSetting chuẩn (Lấy từ D1)
    const tokenData = await getSetting(env, 'facebook_ads_token');

    if (!tokenData || !tokenData.access_token) {
      return json({ ok: false, error: 'Chưa có Access Token. Vui lòng vào Cài đặt -> Đăng nhập Facebook.' }, { status: 400 }, req);
    }

    // Gọi Facebook API
    const groupsData = await fetchGroupsFromFacebook(tokenData.access_token);

    // Chuẩn hóa dữ liệu
    const items = Array.isArray(groupsData) ? groupsData : (groupsData.data || []);

    return json({ ok: true, groups: items }, {}, req);
  } catch (error) {
    console.error('Fetch Groups Error:', error);
    return errorResponse('Lỗi kết nối Facebook: ' + error.message, 500, req);
  }
}

async function handleShareToGroup(req, env, assignId) {
  try {
    const body = await req.json();
    const { groupId, message } = body;

    // Lấy thông tin bài gốc
    const assign = await env.DB.prepare("SELECT post_url FROM fanpage_assignments WHERE id = ?").bind(assignId).first();
    if (!assign || !assign.post_url) return json({ ok: false, error: 'Bài viết chưa được đăng (Chưa có link)' }, { status: 400 }, req);

    // ✅ Dùng getSetting chuẩn
    const tokenData = await getSetting(env, 'facebook_ads_token');

    if (!tokenData || !tokenData.access_token) {
        return json({ ok: false, error: 'Thiếu Access Token' }, { status: 400 }, req);
    }

    // Gọi API Share
    const result = await shareToGroup(groupId, assign.post_url, message || '', tokenData.access_token);

    // Log kết quả
   await env.DB.prepare(`
      INSERT INTO group_shares (assignment_id, group_id, status, share_post_id, created_at, shared_at)
      VALUES (?, ?, 'shared', ?, ?, ?)
    `).bind(assignId, groupId, result.postId, Date.now(), Date.now()).run();

    return json({ ok: true, result }, {}, req);
  } catch (error) {
    return errorResponse(error.message, 500, req);
  }
}

// ===================================================================
// HELPER: Search Products (Adapted from ads_real.js logic)
// ===================================================================

async function searchProducts(req, env) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get('search') || '';
    const limit = parseInt(url.searchParams.get('limit') || '20');

    // Query lấy sản phẩm + giá từ bảng variants (Logic chuẩn từ hệ thống)
    let query = `
      SELECT p.id, p.title, p.images, p.sku, v.price, v.price_sale
      FROM products p
      LEFT JOIN variants v ON p.id = v.product_id
      WHERE 1=1
    `;
    let params = [];

    if (search) {
      query += ` AND (p.title LIKE ? OR p.sku LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    // Group để tránh lặp variants
    query += ` GROUP BY p.id ORDER BY p.created_at DESC LIMIT ?`;
    params.push(limit);

    const { results } = await env.DB.prepare(query).bind(...params).all();

    // Format dữ liệu JSON an toàn để Frontend không bị lỗi Unexpected token
    const products = results.map(p => {
      // Logic xử lý ảnh giống ads_real.js
      let image = null;
      try {
        if (p.images) {
           const parsed = typeof p.images === 'string' ? JSON.parse(p.images) : p.images;
           if (Array.isArray(parsed) && parsed.length > 0) image = parsed[0];
        }
      } catch (e) {
        image = null; // Fallback an toàn
      }

      return {
        id: p.id,
        title: p.title,
        sku: p.sku,
        // Ưu tiên giá sale nếu có
        price: p.price_sale || p.price || 0,
        image: image || '/placeholder.jpg'
      };
    });

    return json({
      ok: true,
      data: products // Trả về data chuẩn JSON
    }, {}, req);

  } catch (error) {
    console.error('[Search Products] Error:', error);
    return errorResponse(error.message, 500, req);
  }
}

console.log('✅ social-video-sync/index.js loaded');