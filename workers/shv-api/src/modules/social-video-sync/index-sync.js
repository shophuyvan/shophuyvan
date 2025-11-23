/**
 * Social Video Sync - Main Router
 * TikTok → Facebook Auto Sync with AI
 */

import { json, errorResponse } from '../../lib/response.js';
import { adminOK } from '../../lib/auth.js';
import { downloadTikTokVideo } from './tiktok-downloader.js';
import { GeminiContentGenerator } from './ai-content-generator.js';
import { uploadToFacebookPage } from './facebook-uploader.js';

export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Auth check
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  // Routes
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

  return errorResponse('Route not found', 404, req);
}

// ===================================================================
// STEP 1: SUBMIT - Download video & generate AI content
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

    // 2. Save to database
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

    // 4. Save AI-generated content (3 versions)
    const versions = ['versionA', 'versionB', 'versionC'];
    for (let i = 0; i < 3; i++) {
      const version = contents[versions[i]];
      await env.DB.prepare(`
        INSERT INTO ai_generated_content
        (video_sync_id, version, caption, hashtags, video_analysis, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        syncId,
        i + 1,
        version.caption,
        JSON.stringify(version.hashtags),
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

console.log('✅ social-video-sync/index.js loaded');