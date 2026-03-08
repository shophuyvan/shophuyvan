// workers/shv-api/src/index.js
// src/index.js - Main Router (với Admin Module)
// ===================================================================

import { json, corsHeaders } from './lib/response.js';
import { requirePermission } from './lib/auth.js'; // ✅ THÊM IMPORT
import * as categories from './modules/categories.js';
import * as Orders from './modules/orders/order-index.js';
import { updateOrderCustomer } from './modules/orders/order-public.js'; // ✅ IMPORT UPDATE
import * as Products from './modules/products.js';
import * as WebhookHandler from './modules/webhook-handler.js'; // THÊM DÒNG NÀY
import * as shipping from './modules/shipping/index.js';
import * as settings from './modules/settings.js';
import * as banners from './modules/banners.js';
import * as vouchers from './modules/vouchers.js';
import * as auth from './modules/auth.js';
import * as admin from './modules/admin.js'; // NEW
import * as costs from './modules/costs.js'; 
import * as profit from './modules/profit.js'; // Sẽ tạo module này để xử lý lưu DB
import * as flashSales from './modules/flash-sales.js'; // THÊM MODULE FLASH SALE
import * as TopNew from './modules/products-top-new.js'; // ✅ API Bestsellers/Newest (FE + Mini)
import * as FlashPricing from './modules/flash-pricing.js'; // ✅ API tính giá Flash Sale (FE + Mini)
// ✅ FACEBOOK MODULES (Đã gom nhóm vào thư mục facebook/)
import * as FBAuth from './modules/facebook/fb-auth.js';
import * as FBAds from './modules/facebook/fb-ads.js';
import * as FBAdsAuto from './modules/facebook/fb-ads-automation.js';
import * as FBAdsCreative from './modules/facebook/fb-ads-creative.js';
import { 
  publishScheduledGroupPosts,
  publishScheduledPosts,
  getScheduledGroupPosts,
  createScheduledGroupPost,
  deleteScheduledGroupPost,
  retryScheduledGroupPost,
  scheduleBatchPosts,
  getScheduledPosts,
  retryFailedPost
} from './modules/facebook/fb-scheduler-handler.js'; // ✅ IMPORT HẸN GIỜ CHO GROUPS
import * as FBGroupManager from './modules/facebook/fb-group-manager.js'; // ✅ IMPORT GROUP MANAGER
// ✅ FANPAGE MODULES (Mới)
import * as FBPageManager from './modules/facebook/fb-page-manager.js';
import * as FBPageAuto from './modules/facebook/fb-automation.js';
import * as ZaloAds from './modules/zalo-ads.js'; 
import * as GoogleAds from './modules/google-ads.js'; // ✅ Import Google Ads
import * as SocialSync from './modules/social-video-sync/index-sync.js';
import * as DouyinHandler from './modules/social-video-sync/douyin-handler.js';
import * as channels from './modules/channels-handler.js'; // Kênh TMDT (TikTok/Lazada/Shopee)
import * as shopee from './modules/shopee.js'; // ✅ Shopee API Module
import { handleCartSync } from './modules/cart-sync-handler.js';
import { printWaybill, cancelWaybill, printWaybillsBulk, cancelWaybillsBulk } from './modules/shipping/waybill.js';
import { 
  getUnmappedSkus, 
  getMappedSkus, 
  getAutoMatchedSkus,
  searchInternalSkus,
  mapSkuManually,
  unmapSku,
  getMappingStats
} from './modules/sku-mapping.js';

/**
 * Tạo customer token đơn giản (base64 encoded)
 * Format: customerId:timestamp:random
 */
function createCustomerToken(customerId) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const payload = `${customerId}:${timestamp}:${random}`;
  return btoa(payload);
}

/**
 * Verify customer token
 */
async function verifyCustomerToken(token, env) {
  try {
    const decoded = atob(token);
    const [customerId] = decoded.split(':');
    
    // Check if customer exists
    const kvKey = `mini:user:zalo:${customerId.replace('mini_', '')}`;
    const userData = await env.SHV.get(kvKey);
    
    if (!userData) return null;
    
    const user = JSON.parse(userData);
    return user.status === 'active' ? user : null;
  } catch (e) {
    return null;
  }
}

console.log('[Index] ✅ Module Products đã import:', typeof Products, Products ? Object.keys(Products) : 'undefined'); // LOG KIỂM TRA IMPORT

/**
 * Logger middleware
 */
function logEntry(req) {
  try {
    const url = new URL(req.url);
    console.log(JSON.stringify({
      t: Date.now(),
      method: req.method,
      path: url.pathname
    }));
  } catch (e) {
    console.error('Log error:', e);
  }
}

/**
 * Main Worker handler
 */
export default {
  async fetch(req, env, ctx) {
    console.log('--- Worker Request v1.1 ---'); // THÊM LOG NÀY
    logEntry(req);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(req)
      });
    }

    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    try {
      // ============================================
      // ADMIN ROUTES (NEW) - ƯU TIÊN TRƯỚC
      // ============================================
      
      // Admin login routes - PHẢI ĐẶT TRƯỚC auth module
      if (path === '/admin/login' ||
          path === '/login' ||
          path === '/admin_auth/login') {
        return admin.handle(req, env, ctx);
      }
      
      // Admin management routes & Douyin API
      if (path === '/admin/me' ||
          path.startsWith('/admin/setup') ||
          path.startsWith('/admin/auth') ||
          path.startsWith('/admin/users') ||
          path.startsWith('/admin/roles') ||
          path.startsWith('/admin/cache')) {
        return admin.handle(req, env, ctx);
      }

      // ✅ DOUYIN / TIKTOK MODULE
      // Chuyển toàn bộ request /api/social/douyin/* sang cho handler riêng xử lý
      if (path.startsWith('/api/social/douyin') || path.startsWith('/api/douyin')) {
         return DouyinHandler.handle(req, env);
      }
	  
	  	  // ✅ THÊM ĐOẠN NÀY - BẮT ĐẦU
      // ============================================
            // CUSTOMER API ROUTES (PUBLIC)
      // ============================================
      if (path.startsWith('/admin/customers') ||
          path.startsWith('/api/addresses') || // 👈 thêm dòng này để map /api/addresses vào admin
          path === '/api/customers/register' ||
          path === '/api/customers/login' ||
          path === '/api/users/activate') { // 👈 Zalo Mini Activate -> admin.userActivate
        return admin.handle(req, env, ctx);
      }

      // ============================================
      // CHANNELS / TMDT (TikTok, Lazada, Shopee)
      // ============================================
      
      // ✅ Shopee routes - ƯU TIÊN TRƯỚC channels
      if (path.startsWith('/channels/shopee') || 
          path.startsWith('/admin/shopee')) {
        return shopee.handle(req, env, ctx);
      }
      
      // TikTok, Lazada routes
      if (path.startsWith('/admin/channels') ||
          path.startsWith('/channels/tiktok') ||
          path.startsWith('/channels/lazada')) {
        return channels.handle(req, env, ctx);
      }

      // ============================================
      // SKU MAPPING ROUTES
      // ============================================
      if (path === '/admin/sku-mapping/unmapped' && method === 'GET') {
        return getUnmappedSkus(req, env);
      }

      if (path === '/admin/sku-mapping/mapped' && method === 'GET') {
        return getMappedSkus(req, env);
      }

      if (path === '/admin/sku-mapping/auto-matched' && method === 'GET') {
        return getAutoMatchedSkus(req, env);
      }

      if (path === '/admin/sku-mapping/search' && method === 'GET') {
        return searchInternalSkus(req, env);
      }

      if (path === '/admin/sku-mapping/map' && method === 'POST') {
        return mapSkuManually(req, env);
      }

      if (path === '/admin/sku-mapping/unmap' && method === 'POST') {
        return unmapSku(req, env);
      }

      if (path === '/admin/sku-mapping/stats' && method === 'GET') {
        return getMappingStats(req, env);
      }

      // ============================================
      // EXISTING ROUTES
      // ============================================
     // ✅ YOUTUBE OAUTH (MỚI)
      if (path === '/auth/google/start') {
        const { getAuthUrl } = await import('./modules/social-video-sync/youtube-uploader.js');
        return Response.redirect(getAuthUrl(env), 302);
      }

      if (path === '/auth/google/callback') {
        const { handleCallback } = await import('./modules/social-video-sync/youtube-uploader.js');
        return handleCallback(req, env);
      }

      // Auth module (login/password/otp/zalo + customer me) - BỎ /admin/me
      if (path.startsWith('/auth/') || path === '/api/customers/me') {
        return auth.handle(req, env, ctx);
      }

      // Categories module
      if (path.startsWith('/admin/categories') ||
          path.startsWith('/public/categories')) {
        return categories.handle(req, env, ctx);
      }
	  
	  // REMOVED - Dùng Products.handle thay vì TopNew

      // Products module (bao gồm metrics API)
      if (path.startsWith('/products') ||
          path.startsWith('/public/products') ||
          path === '/admin/products' ||
          path === '/admin/products/list' ||
          path.startsWith('/admin/products/') ||
          path.startsWith('/api/products/') ||
          path === '/product') {
        
        // ✅ CHECK PERMISSION cho admin routes
        // [FIX] Bỏ qua check quyền cho sync-search để chạy thủ công từ trình duyệt
        if (path.startsWith('/admin/products') && path !== '/admin/products/sync-search') {
          let requiredPerm = 'products.view';
          
          if (method === 'POST' || path.includes('/upsert') || path.includes('/create')) {
            requiredPerm = 'products.create';
          } else if (method === 'PUT' || path.includes('/update') || path.includes('/edit')) {
            requiredPerm = 'products.edit';
          } else if (method === 'DELETE' || path.includes('/delete')) {
            requiredPerm = 'products.delete';
          }
          
          const permCheck = await requirePermission(req, env, requiredPerm);
          if (!permCheck.ok) {
            return json(permCheck, { status: permCheck.status }, req);
          }
        }
        
        console.log('[Index] ➡️ Đang gọi Products.handle cho path:', path);
        return Products.handle(req, env, ctx);
      }

       // [INV-TRACE] router marker for Orders
      if (path.startsWith('/api/orders') ||
          path.startsWith('/admin/orders') ||
          path.startsWith('/public/orders') ||
          path.startsWith('/public/order-create') ||
          path.startsWith('/orders/')) {  // ✅ THÊM dòng này
        console.log('[INV-TRACE] router → orders', { path, method: req.method });
      }
      
      // ✅ [HOTFIX] Handle Order Update Explicitly (Bypassing Order Index)
      if (path === '/orders/update' && req.method === 'POST') {
        return updateOrderCustomer(req, env);
      }

      // Orders module
      if (path.startsWith('/api/orders') ||
          path.startsWith('/admin/orders') ||
          path.startsWith('/public/orders') ||
          path.startsWith('/public/order-create') ||
          path === '/admin/stats' ||
          path === '/orders/my' ||
          path === '/orders/cancel' ||
          path === '/orders/update' ||
          path === '/orders/price') { // ✅ [CORE SYNC] Mở cổng tính giá cho Checkout
        
        // ✅ CHECK PERMISSION cho admin routes
        if (path.startsWith('/admin/orders') || path === '/admin/stats') {
          let requiredPerm = 'orders.view';
          
          if (method === 'POST' || path.includes('/create')) {
            requiredPerm = 'orders.create';
          } else if (method === 'PUT' || path.includes('/update') || path.includes('/edit')) {
            requiredPerm = 'orders.edit';
          } else if (path.includes('/cancel')) {
            requiredPerm = 'orders.cancel';
          }
          
          const permCheck = await requirePermission(req, env, requiredPerm);
          if (!permCheck.ok) {
            return json(permCheck, { status: permCheck.status }, req);
          }
        }
        
       return Orders.handle(req, env, ctx);
      }

      // [MỚI] Route nhận thông báo thanh toán Zalo (Notify Url)
      if (path === '/api/zalo/payment/notify' && req.method === 'POST') {
        return Orders.notifyZaloPayment(req, env);
      }

     // THÊM: Route HỦY VẬN ĐƠN
     if (path === '/shipping/cancel' && req.method === 'POST') {
       return cancelWaybill(req, env);
     }

     // THÊM: Route IN HÀNG LOẠT
     if (path === '/shipping/print-bulk' && req.method === 'POST') {
       return printWaybillsBulk(req, env);
     }

     // THÊM: Route HỦY HÀNG LOẠT
     if (path === '/shipping/cancel-bulk' && req.method === 'POST') {
       return cancelWaybillsBulk(req, env);
     }

            // Shipping module
      if (path.startsWith('/shipping') ||
          path.startsWith('/public/shipping') ||
          path.startsWith('/admin/shipping') ||
          path.startsWith('/api/addresses') ||
          path.startsWith('/v1/platform/areas') ||
          path.startsWith('/v1/platform/orders/price') ||
          path.startsWith('/v1/platform/orders/optimize') ||
          path.startsWith('/v1/platform/orders/label') ||
          path.startsWith('/v1/platform/orders/token') ||
          path.startsWith('/v1/platform/carriers') ||
          path.startsWith('/v1/platform/warehouses')) {
     
       let r = req;
     
       // SuperAI v1 endpoints: auto inject headers if missing
       if (path.startsWith('/v1/platform/')) {
         const h = new Headers(req.headers);
         if (!h.get('Token')) {
           h.set('Token', env.SUPER_KEY || 'FxXOoDz2qlTN5joDCsBGQFqKmm1UNvOw7YPwkzm5');
         }
         if (!h.get('Accept')) h.set('Accept', 'application/json');
         if (req.method !== 'GET' && !h.get('Content-Type')) {
           h.set('Content-Type', 'application/json');
         }
         r = new Request(req, { headers: h });
       }
     
       // ✅ CHECK PERMISSION cho admin shipping
       if (path.startsWith('/admin/shipping')) {
         const permCheck = await requirePermission(req, env, method === 'GET' ? 'shipping.view' : 'shipping.edit');
         if (!permCheck.ok) {
           return json(permCheck, { status: permCheck.status }, req);
         }
       }
       
       return shipping.handle(r, env, ctx);
     }

      // Cart Sync module
      if (path.startsWith('/api/cart/sync')) {
        return handleCartSync(req, env);
      }

      // Settings module (bao gồm /admin/settings/facebook_ads)
      if (path.startsWith('/public/settings') ||
          path.startsWith('/admin/settings')) {
        return settings.handle(req, env, ctx);
      }

      // Banners module
      if (path === '/banners' ||
          path.startsWith('/admin/banners') ||
          path.startsWith('/admin/banner')) {
        
        // ✅ CHECK PERMISSION
        if (path.startsWith('/admin/banner')) {
          let requiredPerm = 'banners.view';
          if (method === 'POST') requiredPerm = 'banners.create';
          else if (method === 'PUT') requiredPerm = 'banners.edit';
          else if (method === 'DELETE') requiredPerm = 'banners.delete';
          
          const permCheck = await requirePermission(req, env, requiredPerm);
          if (!permCheck.ok) {
            return json(permCheck, { status: permCheck.status }, req);
          }
        }
        
        return banners.handle(req, env, ctx);
      }

// Vouchers module
      if (path === '/vouchers' ||
          path === '/vouchers/apply' ||
          path.startsWith('/admin/vouchers')) {
        
        // ✅ CHECK PERMISSION
        if (path.startsWith('/admin/vouchers')) {
          let requiredPerm = 'vouchers.view';
          if (method === 'POST') requiredPerm = 'vouchers.create';
          else if (method === 'PUT') requiredPerm = 'vouchers.edit';
          else if (method === 'DELETE') requiredPerm = 'vouchers.delete';
          
          const permCheck = await requirePermission(req, env, requiredPerm);
          if (!permCheck.ok) {
            return json(permCheck, { status: permCheck.status }, req);
          }
        }
        
        return vouchers.handle(req, env, ctx);
      }

      // ✅ QUẢN LÝ BÁO CÁO LỢI NHUẬN (D1)
      if (path.startsWith('/admin/profit')) {
        const permCheck = await requirePermission(req, env, 'stats.view');
        if (!permCheck.ok) return json(permCheck, { status: permCheck.status }, req);

        if (path === '/admin/profit/save') return profit.saveReports(req, env);
        if (path === '/admin/profit/report') return profit.getReports(req, env);
      }

      // Routes cho Quản lý Chi Phí
      if (path.startsWith('/admin/costs')) {
        const permCheck = await requirePermission(req, env, method === 'GET' ? 'costs.view' : 'costs.edit');
        if (!permCheck.ok) {
          return json(permCheck, { status: permCheck.status }, req);
        }
        
        return costs.handle(req, env, ctx);
      }

      // Routes cho Flash Sale
      if (path.startsWith('/flash-sales') ||
          path.startsWith('/admin/flash-sales')) {
        
        // ✅ CHECK PERMISSION cho admin
        if (path.startsWith('/admin/flash-sales')) {
          const permCheck = await requirePermission(req, env, 'products.edit');
          if (!permCheck.ok) {
            return json(permCheck, { status: permCheck.status }, req);
          }
        }
        
        return flashSales.handle(req, env, ctx);
      }

      // ✅ FLASH PRICING API (FE + Mini dùng chung)
      if (path.startsWith('/api/flash-pricing')) {
        return FlashPricing.handle(req, env, ctx);
      }

      // ============================================
      // FACEBOOK ADS ROUTES (ƯU TIÊN CAO - ĐẶT SAU FLASH SALES)
      // ============================================
	 // 1. Facebook Webhook (Public - Để Facebook gọi vào)
      // Đã cập nhật để dùng WebhookHandler xử lý Verify & Event tập trung
      if (path === '/webhook/facebook') {
        return WebhookHandler.handleFacebookWebhook(req, env);
      }

      // 2. Fanpage Manager (Admin UI gọi)
      if (path === '/admin/fanpages/fetch-facebook' && method === 'GET') {
        const permCheck = await requirePermission(req, env, 'ads.view');
        if (!permCheck.ok) return json(permCheck, { status: permCheck.status }, req);
        return FBPageManager.fetchPagesFromFacebook(req, env);
      }
      
      // Route cấu hình settings (Đặt trước route gốc để tránh conflict)
      if (path === '/admin/fanpages/settings') {
        const permCheck = await requirePermission(req, env, 'ads.edit');
        if (!permCheck.ok) return json(permCheck, { status: permCheck.status }, req);

        if (method === 'GET') return FBPageManager.getPageSettings(req, env);
        if (method === 'POST') return FBPageManager.savePageSettings(req, env);
      }

      // ✅ API MỚI: Lấy bài chờ đăng (Pending Posts)
      if (path === '/admin/fanpages/pending' && method === 'GET') {
        // if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req); // Optional check
        return FBPageManager.getPendingPosts(req, env);
      }

      // Route Quản lý Fanpage (Gom nhóm tất cả request liên quan Fanpage về Module D1)
      // Xử lý cho cả 2 đường dẫn mà Frontend đang gọi:
      // 1. /admin/fanpages (List/Add)
      // 2. /admin/facebook/fanpages (Delete đang gọi cái này)
      if (path.startsWith('/admin/fanpages') || path.startsWith('/admin/facebook/fanpages')) {
        const permCheck = await requirePermission(req, env, method === 'GET' ? 'ads.view' : 'ads.edit');
        if (!permCheck.ok) return json(permCheck, { status: permCheck.status }, req);

        // Chuyển hướng xử lý sang Module FBPageManager
        if (method === 'GET') return FBPageManager.listFanpages(req, env);
        if (method === 'POST') return FBPageManager.upsertFanpage(req, env);
        if (method === 'DELETE') return FBPageManager.deleteFanpage(req, env);
      }

      // Facebook Page Manager routes (fetch from Facebook, page info, etc.)
      if (path.startsWith('/facebook/page/')) {
        const permCheck = await requirePermission(req, env, 'ads.view');
        if (!permCheck.ok) {
          return json(permCheck, { status: permCheck.status }, req);
        }
        return FBPageManager.handle(req, env, ctx);
      }
      
      // Facebook OAuth
      if (path.startsWith('/admin/facebook/oauth/')) {
        return FBAuth.handle(req, env, ctx);
      }

      // ============================================
      // FACEBOOK GROUPS ROUTES (MỚI THÊM)
      // ============================================
      
      // API: Lấy danh sách groups từ Facebook  
      if (path === '/api/facebook/groups/fetch' && method === 'GET') {
        try {
          // Lấy tất cả fanpages có token
          const { results: pages } = await env.DB.prepare(`
            SELECT page_id, access_token FROM fanpages WHERE access_token IS NOT NULL LIMIT 1
          `).all();
          
          if (!pages || pages.length === 0) {
            return json({ ok: false, error: 'Không tìm thấy fanpage nào có token' }, req);
          }
          
          // Lấy groups từ Facebook API
          const groups = await FBGroupManager.fetchGroupsFromFacebook(pages[0].access_token);
          return json({ ok: true, groups }, req);
        } catch (error) {
          console.error('[Groups Fetch Error]', error);
          return json({ ok: false, error: error.message }, req);
        }
      }
      
      // API: Lưu scheduled group post
      if (path === '/api/facebook/groups/schedule' && method === 'POST') {
        try {
          const body = await req.json();
          const postId = await FBGroupManager.saveScheduledGroupPost(env, body);
          return json({ ok: true, success: true, postId }, req);
        } catch (error) {
          console.error('[Schedule Group Post Error]', error);
          return json({ ok: false, error: error.message }, req);
        }
      }
      
      // API: Lấy danh sách scheduled posts
      if (path === '/api/facebook/groups/scheduled' && method === 'GET') {
        try {
          // Kiểm tra xem bảng có tồn tại không
          const tableCheck = await env.DB.prepare(`
            SELECT name FROM sqlite_master WHERE type='table' AND name='scheduled_group_posts'
          `).first();
          
          if (!tableCheck) {
            // Bảng chưa tồn tại, trả về mảng rỗng thay vì lỗi
            return json({ ok: true, posts: [] }, req);
          }
          
          const url = new URL(req.url);
          const fanpage_id = url.searchParams.get('fanpage_id');
          const status = url.searchParams.get('status');
          
          const posts = await FBGroupManager.getScheduledGroupPosts(env, { fanpage_id, status });
          return json({ ok: true, posts }, req);
        } catch (error) {
          console.error('[Get Scheduled Posts Error]', error);
          return json({ ok: false, error: error.message }, req);
        }
      }
      
      // ADMIN API: Lấy danh sách scheduled posts (với permission check)
      if (path === '/admin/facebook/groups/scheduled' && method === 'GET') {
        const permCheck = await requirePermission(req, env, 'ads.view');
        if (!permCheck.ok) {
          return json(permCheck, { status: permCheck.status }, req);
        }
        
        try {
          // Kiểm tra xem bảng có tồn tại không
          const tableCheck = await env.DB.prepare(`
            SELECT name FROM sqlite_master WHERE type='table' AND name='scheduled_group_posts'
          `).first();
          
          if (!tableCheck) {
            // Bảng chưa tồn tại, trả về mảng rỗng thay vì lỗi
            return json({ ok: true, posts: [] }, {}, req);
          }
          
          const url = new URL(req.url);
          const fanpage_id = url.searchParams.get('fanpage_id');
          const status = url.searchParams.get('status');
          
          const posts = await FBGroupManager.getScheduledGroupPosts(env, { fanpage_id, status });
          return json({ ok: true, posts }, {}, req);
        } catch (error) {
          console.error('[Get Scheduled Posts Error]', error);
          return json({ ok: false, error: error.message }, { status: 500 }, req);
        }
      }
      
      // API: Manual trigger để publish scheduled group posts (cho testing)
      if (path === '/api/facebook/groups/publish-scheduled' && method === 'POST') {
        try {
          const result = await publishScheduledGroupPosts(env);
          return json({ ok: true, ...result }, req);
        } catch (error) {
          console.error('[Publish Scheduled Error]', error);
          return json({ ok: false, error: error.message }, req);
        }
      }

      // Facebook Ads Automation
      if (path.startsWith('/admin/facebook/automation')) {
        return FBAdsAuto.handle(req, env, ctx);
      }

      // Facebook Ads Creative
      if (path.startsWith('/admin/facebook/creatives') || 
          path.startsWith('/admin/facebook/ads/bulk-create')) {
        return FBAdsCreative.handle(req, env, ctx);
      }

     // Facebook Ads Main Routes
      if (path.startsWith('/admin/facebook')) {
        const permCheck = await requirePermission(req, env, method === 'GET' ? 'ads.view' : 'ads.edit');
        if (!permCheck.ok) {
          return json(permCheck, { status: permCheck.status }, req);
        }
        return FBAds.handle(req, env, ctx);
      }

      // ============================================
      // ZALO ADS MODULE
      // ============================================
      if (path.startsWith('/admin/marketing/auth/zalo') || 
          path.startsWith('/admin/marketing/zalo')) {
        
        // ✅ CẬP NHẬT: Cho phép cả 'start' và 'callback' đi qua mà không cần Token
        if (path.includes('/auth/zalo/callback') || path.includes('/auth/zalo/start')) {
           return ZaloAds.handle(req, env, ctx);
        }

        // Các route lấy dữ liệu -> Cần quyền Admin
        const permCheck = await requirePermission(req, env, 'ads.view');
        if (!permCheck.ok) return json(permCheck, { status: permCheck.status }, req);
        
        return ZaloAds.handle(req, env, ctx);
      }
	  
	  // ============================================
      // GOOGLE ADS MODULE (YOUTUBE)
      // ============================================
      if (path.startsWith('/admin/marketing/auth/google') || 
          path.startsWith('/admin/marketing/google')) {
        
        // Login: Cho phép 'start' và 'callback' không cần quyền Admin
        if (path.includes('/auth/google/callback') || path.includes('/auth/google/start')) {
           return GoogleAds.handle(req, env, ctx);
        }

        // Data: Cần quyền Admin
        const permCheck = await requirePermission(req, env, 'ads.view');
        if (!permCheck.ok) return json(permCheck, { status: permCheck.status }, req);
        
        return GoogleAds.handle(req, env, ctx);
      }
	  // ============================================
      // SOCIAL VIDEO SYNC (TIKTOK REUP AUTO)
      // Hỗ trợ cả luồng cũ (/api/social-sync), luồng mới (/api/auto-sync) và Facebook API
      // ============================================
     // API: Lấy danh sách bài Group đã lên lịch
      if (path === '/api/facebook/groups/scheduled' && method === 'GET') {
        const permCheck = await requirePermission(req, env, 'ads.view');
        if (!permCheck.ok) {
          return json(permCheck, { status: permCheck.status }, req);
        }
        return getScheduledGroupPosts(req, env);
      }

      if (path.startsWith('/api/social-sync') || path.startsWith('/api/auto-sync') || path.startsWith('/api/facebook/groups')) {
        // ✅ FIX: Bỏ qua check permission cho route upload stream VÀ route login Threads
        // Auth sẽ được check lại kỹ bên trong module SocialSync.handle
        if (path !== '/api/auto-sync/jobs/stream-upload' && 
            !path.startsWith('/api/auto-sync/auth/threads/') &&
            !path.startsWith('/api/auto-sync/auth/youtube/')) { // ✅ Đã thêm ngoại lệ cho YouTube
            
            const permCheck = await requirePermission(req, env, 'ads.edit');
            if (!permCheck.ok) {
              return json(permCheck, { status: permCheck.status }, req);
            }
        }
        
        return SocialSync.handle(req, env, ctx);
      }

      // ============================================
      // FACEBOOK LOGIN (WEB + MINI)
      // ============================================
      if (path === '/auth/facebook/start') {
        const url = new URL(req.url);

        // redirect: FE / MINI gửi lên, ví dụ /account hoặc /mini/account
        const redirect = url.searchParams.get('redirect') || '/';
        const state = encodeURIComponent(redirect);

        const fbAuthUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
        fbAuthUrl.searchParams.set('client_id', env.FB_APP_ID);
        fbAuthUrl.searchParams.set(
          'redirect_uri',
          'https://api.shophuyvan.vn/auth/facebook/callback'
        );
        fbAuthUrl.searchParams.set('response_type', 'code');
        fbAuthUrl.searchParams.set('scope', 'email,public_profile');
        fbAuthUrl.searchParams.set('state', state);

        // Đẩy user sang màn hình đăng nhập Facebook
        return Response.redirect(fbAuthUrl.toString(), 302);
      }

      if (path === '/auth/facebook/callback') {
        const url = new URL(req.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state') || '/';
        const redirect = decodeURIComponent(state || '/');

        if (!code) {
          return json(
            { ok: false, error: 'missing_code' },
            { status: 400 },
            req
          );
        }

        try {
          const redirectUri = 'https://api.shophuyvan.vn/auth/facebook/callback';

          // 1) Lấy access_token từ Facebook
          const tokenRes = await fetch(
            'https://graph.facebook.com/v19.0/oauth/access_token' +
              `?client_id=${encodeURIComponent(env.FB_APP_ID)}` +
              `&client_secret=${encodeURIComponent(env.FB_APP_SECRET)}` +
              `&redirect_uri=${encodeURIComponent(redirectUri)}` +
              `&code=${encodeURIComponent(code)}`
          );
          const tokenData = await tokenRes.json();

          if (!tokenRes.ok || !tokenData.access_token) {
            console.error('[FB OAuth] token error', tokenData);
            return json(
              { ok: false, error: 'facebook_token_error', detail: tokenData },
              { status: 400 },
              req
            );
          }

          // 2) Lấy thông tin user Facebook
          const meRes = await fetch(
            'https://graph.facebook.com/me' +
              '?fields=id,name,email,picture' +
              `&access_token=${encodeURIComponent(tokenData.access_token)}`
          );
          const fbUser = await meRes.json();

          if (!meRes.ok || !fbUser.id) {
            console.error('[FB OAuth] profile error', fbUser);
            return json(
              { ok: false, error: 'facebook_profile_error', detail: fbUser },
              { status: 400 },
              req
            );
          }

          // 3) Trả JSON cho FE/Mini xử lý tiếp (tự lưu user, token...)
          return json(
            {
              ok: true,
              redirect: redirect || '/',
              facebook_user: fbUser,
            },
            {},
            req
          );
        } catch (e) {
          console.error('[FB OAuth] callback error', e);
          return json(
            {
              ok: false,
              error: 'facebook_callback_error',
              detail: String(e?.message || e),
            },
            { status: 500 },
            req
          );
        }
      }

      // ============================================
      // MINI APP – HEALTH CHECK
      // ============================================
      if (path === '/mini/ping') {
        return json(
          {
            ok: true,
            source: 'mini-api',
            msg: 'SHV API for Mini App is alive',
          },
          {},
          req
        );
      }

      // ============================================
      // ROOT ENDPOINTS
      // ============================================

      // 🔹 FEED SẢN PHẨM CHO FACEBOOK (CSV)
      // URL: https://api.shophuyvan.vn/meta/facebook-feed.csv
      if (path === '/meta/facebook-feed.csv' && req.method === 'GET') {
        // Dùng API chung cho FE + Mini: lấy từ module Products
        if (typeof Products.exportFacebookFeedCsv === 'function') {
          return Products.exportFacebookFeedCsv(req, env);
        }
        return json(
          { ok: false, error: 'Feed generator not available' },
          { status: 500 },
          req
        );
      }

      if (path === '/' || path === '') {
        return json({
          ok: true,
          msg: 'SHV API v4.2 (Admin System Integrated)',
          hint: 'All routes modularized + Cart Sync + Admin Management',
          modules: {
            admin: '✅ Added',
            auth: '✅ Complete',
            categories: '✅ Complete',
            products: '✅ Complete',
            orders: '✅ Complete',
            shipping: '✅ Complete',
            settings: '✅ Complete',
            banners: '✅ Complete',
            vouchers: '✅ Complete',
            cart_sync: '✅ Complete'
          }
        }, {}, req);
      }

      // Health check đơn giản
      if (path === '/me' && req.method === 'GET') {
        return json({
          ok: true,
          msg: 'Worker alive',
          version: 'v4.2'
        }, {}, req);
      }

      // [SHV] Webhook Mini App – tất cả event từ Zalo Mini đổ về đây
      if (path === '/mini/webhook' && (req.method === 'GET' || req.method === 'POST')) {
        return WebhookHandler.handleMiniWebhook(req, env);
      }
	  
	  // [ZALO OFFICIAL] Webhook xóa dữ liệu & verify signature (Cấu hình trên trang Mini App)
      if (path === '/api/webhook/zalo' && req.method === 'POST') {
        return WebhookHandler.handleZaloWebhook(req, env);
      }

      // Webhook SuperAI (vận chuyển)
      if (path === '/webhook/superai' && req.method === 'POST') {
        return WebhookHandler.handleSuperAIWebhook(req, env);
      }
	    
      // Route không khớp gì ở trên → trả 404
      return json({
        ok: false,
        error: 'Route not found'
      }, { status: 404 }, req);

    } catch (e) {
      console.error('Worker error:', e);
      return json({
        ok: false,
        error: String(e?.message || e)
      }, { status: 500 }, req);
    }
  },

async scheduled(event, env, ctx) {
    console.log('[Cron] ⏰ Scheduled trigger fired at:', new Date(event.scheduledTime).toISOString());
    
    // 1️⃣ AUTO SYNC SHOPEE (ĐƠN HÀNG & TỒN KHO) - Quan trọng nhất
    try {
        // Import module shopee
        const shopeeModule = await import('./modules/shopee.js');
        console.log('[Cron] 🚀 Bắt đầu đồng bộ Shopee tự động...');

        // Gọi hàm đồng bộ toàn bộ (được định nghĩa trong shopee.js)
        // Hàm này sẽ tự lặp qua tất cả shop và kéo đơn/tồn kho về
        const result = await shopeeModule.syncAllShops(env);
        
        console.log('[Cron] ✅ Kết quả đồng bộ Shopee:', JSON.stringify(result));
    } catch (e) {
        console.error('[Cron] ❌ Lỗi đồng bộ Shopee:', e);
    }

// 2️⃣ Facebook Ads Automation (Chỉ chạy vào phút 0 của mỗi giờ)
    const minutes = new Date(event.scheduledTime).getMinutes();
    if (minutes === 0) {
        await FBAdsAuto.scheduledHandler(event, env, ctx);
    }

    // 3️⃣ FACEBOOK SCHEDULER (Chạy mỗi 15 phút theo Cron)
    // Quét các bài hẹn giờ đã đến hạn để đăng
    console.log('[Cron] ⏳ Checking scheduled posts...');
    await publishScheduledPosts(env);
  }
};