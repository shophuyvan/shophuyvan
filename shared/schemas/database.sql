-- ============================================
-- SHOPHUYVAN DATABASE SCHEMA (Updated)
-- Phù hợp với product_edit.html hiện tại
-- ============================================

-- ============================================
-- PRODUCTS & VARIANTS
-- ============================================

-- Bảng sản phẩm chính
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- ✅ Basic info (phù hợp với form hiện tại)
  title TEXT NOT NULL,              -- Tên hiển thị
  slug TEXT UNIQUE NOT NULL,
  shortDesc TEXT,                   -- Mô tả ngắn
  desc TEXT,                        -- Mô tả chi tiết (HTML/Markdown)
  
  -- ✅ Category
  category_slug TEXT,               -- Slug danh mục
  
  -- ✅ METRICS (sold, rating, reviews)
  sold INTEGER DEFAULT 0,           -- Số lượng đã bán
  rating REAL DEFAULT 5.0,          -- Đánh giá trung bình (1.0 - 5.0)
  rating_count INTEGER DEFAULT 0,  -- Số lượt đánh giá
  
  -- ✅ SEO
  seo_title TEXT,
  seo_desc TEXT,
  keywords TEXT,                    -- JSON array: ["keyword1", "keyword2"]
  
  -- ✅ Extra content
  faq TEXT,                         -- JSON: [{Q: "...", A: "..."}]
  reviews TEXT,                     -- JSON: [{name: "A", rating: 5}]
  
  -- ✅ Media
  images TEXT,                      -- JSON array: ["url1", "url2"]
  video TEXT,
  douyin_url TEXT,                  -- Link video gốc Douyin (New)
  
    -- Display settings
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'draft')),
  on_website INTEGER DEFAULT 1,    -- 1 = hiển thị, 0 = ẩn
  on_mini INTEGER DEFAULT 1,

  -- Tổng tồn kho (tự động tổng từ variants)
  stock INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);


CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(category_slug);

-- Bảng variants (GIÁ, SKU, STOCK ở đây)
CREATE TABLE IF NOT EXISTS variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  
  -- Core info
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,              -- Tên variant: "Size M", "Màu Đỏ"
  
  -- ✅ PRICING (Phù hợp với form hiện tại)
  price REAL NOT NULL DEFAULT 0,          -- Giá bán thường
  price_sale REAL,                        -- Giá sale (giảm giá)
  price_wholesale REAL,                   -- Giá sỉ
  cost_price REAL,                        -- Giá nhập (nội bộ)
  
  -- ✅ TIER PRICING (Silver, Gold, Diamond)
  price_silver REAL,
  price_gold REAL,
  price_diamond REAL,
  
  -- ✅ STOCK (Tồn kho master)
  stock INTEGER DEFAULT 0,
  
  -- Physical
  weight REAL DEFAULT 0,           -- gram
  
  -- Status
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'out_of_stock')),
  
  -- Media
  image TEXT,
  
  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_variants_product ON variants(product_id);
CREATE INDEX idx_variants_sku ON variants(sku);
CREATE INDEX idx_variants_status ON variants(status);

-- ============================================
-- CHANNEL MAPPINGS
-- ============================================

CREATE TABLE IF NOT EXISTS channel_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  channel TEXT NOT NULL CHECK(channel IN ('shopee', 'lazada', 'tiktok')),
  
  -- External IDs
  channel_item_id TEXT NOT NULL,
  channel_model_id TEXT,
  channel_sku TEXT,
  
  -- Internal mapping
  product_id INTEGER NOT NULL,
  variant_id INTEGER,
  
  -- ✅ Giá riêng trên sàn (Shopee/Lazada giá khác Website)
  channel_price REAL,
  channel_price_sale REAL,
  
  -- Sync status
  is_active INTEGER DEFAULT 1,
  last_sync_at INTEGER,
  
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  UNIQUE(channel, channel_item_id, channel_model_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE CASCADE
);

CREATE INDEX idx_channel_products_variant ON channel_products(variant_id);
CREATE INDEX idx_channel_products_channel ON channel_products(channel);

-- ============================================
-- STOCK LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS stock_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id INTEGER NOT NULL,
  
  old_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  change INTEGER NOT NULL,
  
  reason TEXT NOT NULL CHECK(reason IN ('order', 'import', 'sync', 'adjustment', 'return')),
  channel TEXT,
  
  order_id INTEGER,
  notes TEXT,
  
  created_at INTEGER NOT NULL,
  
  FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX idx_stock_logs_variant ON stock_logs(variant_id);
CREATE INDEX idx_stock_logs_created ON stock_logs(created_at);

-- ============================================
-- ORDERS
-- ============================================

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  order_number TEXT UNIQUE NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('website', 'mini', 'shopee', 'lazada', 'tiktok')),
  channel_order_id TEXT,
  
  -- Customer
  customer_id INTEGER,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  
  -- Shipping
  shipping_name TEXT,
  shipping_phone TEXT,
  shipping_address TEXT,
  shipping_district TEXT,
  shipping_city TEXT,
  shipping_province TEXT,
  shipping_zipcode TEXT,
  
  -- Financial
  subtotal REAL NOT NULL DEFAULT 0,
  shipping_fee REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
    -- Phí giao dịch sàn (Shopee)
  seller_transaction_fee REAL DEFAULT 0,

  -- Thông tin shop trên sàn
  shop_id TEXT,
  shop_name TEXT,

  
  -- Status
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'shipped', 'completed', 'cancelled', 'returned')),
  payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'refunded')),
  fulfillment_status TEXT DEFAULT 'unfulfilled' CHECK(fulfillment_status IN ('unfulfilled', 'fulfilled', 'partial')),
  
  payment_method TEXT,
  
  -- Notes
  customer_note TEXT,
  admin_note TEXT,
  
  -- ✅ Shopee Shipping Info (THÊM MỚI)
  tracking_number TEXT,
  shipping_carrier TEXT,
  
  -- ✅ Shopee Financial Info (THÊM MỚI)
  coin_used REAL DEFAULT 0,
  voucher_code TEXT,
  voucher_seller REAL DEFAULT 0,
  voucher_shopee REAL DEFAULT 0,
  commission_fee REAL DEFAULT 0,
  service_fee REAL DEFAULT 0,
  escrow_amount REAL DEFAULT 0,
  buyer_paid_amount REAL DEFAULT 0,
  
  -- ✅ Shopee Logistics Detail (THÊM MỚI)
  estimated_shipping_fee REAL DEFAULT 0,
  actual_shipping_fee_confirmed REAL DEFAULT 0,
  
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_channel ON orders(channel);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);

-- ============================================
-- ORDER ITEMS
-- ============================================

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  
  product_id INTEGER,
  variant_id INTEGER,
  
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  variant_name TEXT,
  
  price REAL NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  subtotal REAL NOT NULL,
  image TEXT,
  
  channel_item_id TEXT,
  channel_model_id TEXT,
  
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE SET NULL
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_variant ON order_items(variant_id);

-- ============================================
-- CUSTOMERS
-- ============================================

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  
  tier TEXT DEFAULT 'regular' CHECK(tier IN ('regular', 'silver', 'gold', 'diamond')),
  
  total_orders INTEGER DEFAULT 0,
  total_spent REAL DEFAULT 0,
  
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_tier ON customers(tier);

-- ============================================
-- CATEGORIES
-- ============================================

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  parent_id INTEGER,
  
  image TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);

-- ============================================
-- SOCIAL VIDEO SYNC (TikTok → Facebook Auto)
-- ============================================

CREATE TABLE IF NOT EXISTS video_syncs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tiktok_url TEXT NOT NULL,
  tiktok_video_id TEXT,
  r2_path TEXT,
  r2_url TEXT,
  video_duration INTEGER,
  file_size INTEGER,
  brand_voice TEXT DEFAULT 'friendly',
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_by INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_generated_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_sync_id INTEGER NOT NULL,
  version INTEGER DEFAULT 1,
  caption TEXT,
  hashtags TEXT,
  video_analysis TEXT,
  is_selected INTEGER DEFAULT 0,
  is_edited INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (video_sync_id) REFERENCES video_syncs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS facebook_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_sync_id INTEGER NOT NULL,
  ai_content_id INTEGER,
  page_id TEXT NOT NULL,
  post_id TEXT,
  post_url TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (video_sync_id) REFERENCES video_syncs(id) ON DELETE CASCADE,
  FOREIGN KEY (ai_content_id) REFERENCES ai_generated_content(id)
);

CREATE INDEX IF NOT EXISTS idx_video_syncs_status ON video_syncs(status);
CREATE INDEX IF NOT EXISTS idx_video_syncs_created_by ON video_syncs(created_by);
CREATE INDEX IF NOT EXISTS idx_facebook_posts_video_sync ON facebook_posts(video_sync_id);
CREATE INDEX IF NOT EXISTS idx_ai_content_video_sync ON ai_generated_content(video_sync_id);

-- ============================================
-- AUTO VIDEO SYNC WORKFLOW (Product-based Marketing Automation)
-- Wizard 5 bước: Product → Video → AI Content → Fanpages → Facebook Ads
-- ============================================

-- =============================================
-- BẢNG 1: FANPAGES - Quản lý danh sách Fanpage
-- =============================================
CREATE TABLE IF NOT EXISTS fanpages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Facebook Page Info
  page_id TEXT UNIQUE NOT NULL,
  page_name TEXT NOT NULL,
  access_token TEXT,
  
  -- Auto Settings
  auto_reply_enabled INTEGER DEFAULT 0,
  auto_hide_phone INTEGER DEFAULT 0,
  reply_template TEXT DEFAULT 'Shop đã inbox bạn rồi ạ, bạn check tin nhắn chờ nhé! ❤️',
  website_link TEXT DEFAULT 'https://shophuyvan.vn',
  
  -- Status & Metadata
  is_active INTEGER DEFAULT 1,
  is_default INTEGER DEFAULT 0,
  token_expires_at INTEGER,
  
  -- Statistics
  total_posts INTEGER DEFAULT 0,
  total_ads INTEGER DEFAULT 0,
  last_post_at INTEGER,
  
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_fanpages_page_id ON fanpages(page_id);
CREATE INDEX idx_fanpages_is_active ON fanpages(is_active);

-- =============================================
-- BẢNG 2: AUTOMATION_JOBS - Workflow chính (5 steps)
-- =============================================
CREATE TABLE IF NOT EXISTS automation_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- STEP 1: Product Selection
  product_id TEXT NOT NULL,
  product_name TEXT,
  product_slug TEXT,
  product_url TEXT,
  product_price REAL,
  product_image TEXT,
  
  -- STEP 2: TikTok Video
  tiktok_url TEXT,
  tiktok_video_id TEXT,
  video_r2_path TEXT,
  video_r2_url TEXT,
  video_file_size INTEGER,
  video_duration INTEGER,
  
  -- Workflow Status
  status TEXT DEFAULT 'draft' CHECK(status IN (
    'draft',           -- Bước 1: Đã chọn product
    'video_uploaded',  -- Bước 2: Đã tải video
    'ai_generated',    -- Bước 3: AI đã tạo variants
    'assigned',        -- Bước 4: Đã assign fanpages
    'publishing',      -- Đang đăng bài
    'published',       -- Bước 4: Đã đăng thành công
    'completed',       -- Bước 5: Hoàn tất (có/không ads)
    'failed'           -- Lỗi
  )),
  
  current_step INTEGER DEFAULT 1, -- 1-5
  
  -- Results Summary
  total_variants INTEGER DEFAULT 0,
  total_fanpages_assigned INTEGER DEFAULT 0,
  total_posts_published INTEGER DEFAULT 0,
  total_posts_failed INTEGER DEFAULT 0,
  
  -- STEP 5: Campaign Info (optional)
  campaign_id TEXT,
  campaign_name TEXT,
  
  -- Error Tracking
  error_message TEXT,
  error_step INTEGER,
  
  -- Metadata
  created_by INTEGER, -- Admin user ID
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX idx_automation_jobs_status ON automation_jobs(status);
CREATE INDEX idx_automation_jobs_product ON automation_jobs(product_id);
CREATE INDEX idx_automation_jobs_created ON automation_jobs(created_at);

-- =============================================
-- BẢNG 3: CONTENT_VARIANTS - AI tạo 5 phiên bản nội dung
-- =============================================
CREATE TABLE IF NOT EXISTS content_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  job_id INTEGER NOT NULL,
  
  -- Variant Info
  version INTEGER NOT NULL CHECK(version BETWEEN 1 AND 5), -- 1-5
  tone TEXT NOT NULL CHECK(tone IN (
    'casual',       -- Gần gũi, thân thiện, emoji nhiều
    'sale-heavy',   -- Sale mạnh, urgency, CAPS
    'storytelling', -- Kể chuyện, review khách hàng
    'professional', -- Chuyên gia, formal
    'tips'          -- Mẹo vặt, hướng dẫn
  )),
  
  -- Content
  caption TEXT NOT NULL,
  hashtags TEXT, -- JSON array: ["#tag1", "#tag2"]
  cta TEXT,      -- Call-to-action
  
  -- Editing
  is_edited INTEGER DEFAULT 0,
  original_caption TEXT, -- Backup bản gốc nếu user edit
  
  created_at INTEGER NOT NULL,
  
  FOREIGN KEY (job_id) REFERENCES automation_jobs(id) ON DELETE CASCADE
);

CREATE INDEX idx_content_variants_job ON content_variants(job_id);
CREATE INDEX idx_content_variants_version ON content_variants(version);

-- =============================================
-- BẢNG 4: FANPAGE_ASSIGNMENTS - Mapping fanpage ↔ variant
-- =============================================
CREATE TABLE IF NOT EXISTS fanpage_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  job_id INTEGER NOT NULL,
  fanpage_id TEXT NOT NULL, -- page_id từ bảng fanpages
  fanpage_name TEXT,
  variant_id INTEGER NOT NULL,
  
  -- Publishing Status
  status TEXT DEFAULT 'pending' CHECK(status IN (
    'pending',      -- Chờ đăng
    'publishing',   -- Đang đăng
    'published',    -- Đã đăng thành công
    'failed'        -- Đăng thất bại
  )),
  
  -- Facebook Post Result
  post_id TEXT,
  post_url TEXT,
  
  -- Error Tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER,
  scheduled_time INTEGER DEFAULT NULL, -- ✅ [MỚI] Thêm dòng này
  
  FOREIGN KEY (job_id) REFERENCES automation_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES content_variants(id) ON DELETE CASCADE
);

CREATE INDEX idx_fanpage_assignments_job ON fanpage_assignments(job_id);
CREATE INDEX idx_fanpage_assignments_fanpage ON fanpage_assignments(fanpage_id);
CREATE INDEX idx_fanpage_assignments_status ON fanpage_assignments(status);
-- ✅ [MỚI] Index cho tìm kiếm bài hẹn giờ
CREATE INDEX idx_fanpage_assignments_scheduled ON fanpage_assignments(scheduled_time) WHERE status = 'pending' AND scheduled_time IS NOT NULL;

-- =============================================
-- BẢNG 5: JOB_CAMPAIGNS - Facebook Ads từ Job (Optional - Step 5)
-- =============================================
CREATE TABLE IF NOT EXISTS job_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  job_id INTEGER NOT NULL,
  
  -- Campaign Info
  fb_campaign_id TEXT,
  fb_adset_id TEXT,
  campaign_name TEXT NOT NULL,
  
  -- Budget & Targeting
  daily_budget INTEGER NOT NULL, -- VND
  target_url TEXT,
  
  targeting_config TEXT, -- JSON: {countries, age_min, age_max, interests}
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK(status IN (
    'draft',
    'creating',
    'active',
    'paused',
    'failed'
  )),
  
  -- Ads Created
  total_ads INTEGER DEFAULT 0,
  ads_data TEXT, -- JSON array: [{postId, adId, status}]
  
  error_message TEXT,
  
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  FOREIGN KEY (job_id) REFERENCES automation_jobs(id) ON DELETE CASCADE
);

CREATE INDEX idx_job_campaigns_job ON job_campaigns(job_id);
CREATE INDEX idx_job_campaigns_status ON job_campaigns(status);

-- =============================================
-- BẢNG 6: PRODUCT_VIRAL_VIDEOS - Lịch sử video đã dùng (Tránh trùng)
-- =============================================
CREATE TABLE IF NOT EXISTS product_viral_videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  product_id TEXT NOT NULL,
  job_id INTEGER,
  
  tiktok_url TEXT NOT NULL,
  tiktok_video_id TEXT,
  
  -- Viral Metrics
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  viral_score INTEGER DEFAULT 0, -- Calculated score
  
  -- Usage Tracking
  is_used INTEGER DEFAULT 0,
  used_at INTEGER,
  
  created_at INTEGER NOT NULL,
  
  FOREIGN KEY (job_id) REFERENCES automation_jobs(id) ON DELETE SET NULL
);

CREATE INDEX idx_product_viral_videos_product ON product_viral_videos(product_id);
CREATE INDEX idx_product_viral_videos_used ON product_viral_videos(is_used);
CREATE INDEX idx_product_viral_videos_score ON product_viral_videos(viral_score DESC);

-- =============================================
-- BẢNG 7: FACEBOOK GROUPS - Quản lý nhóm & Share tự động
-- =============================================
CREATE TABLE IF NOT EXISTS facebook_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  group_id TEXT UNIQUE NOT NULL,
  group_name TEXT NOT NULL,
  privacy TEXT, -- 'PUBLIC', 'CLOSED', 'SECRET'
  
  -- User access
  admin_user_id INTEGER,
  can_post INTEGER DEFAULT 1,
  
  -- Auto settings
  is_active INTEGER DEFAULT 1,
  auto_share_enabled INTEGER DEFAULT 0,
  
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_facebook_groups_active ON facebook_groups(is_active);

-- =============================================
-- BẢNG 8: GROUP_SHARES - Lịch sử share vào nhóm
-- =============================================
CREATE TABLE IF NOT EXISTS group_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  assignment_id INTEGER NOT NULL, -- Link tới bài đăng gốc
  group_id TEXT NOT NULL,
  group_name TEXT,
  
  -- Share status
  status TEXT DEFAULT 'pending' CHECK(status IN (
    'pending',
    'shared',
    'failed'
  )),
  
  -- Facebook post result
  share_post_id TEXT,
  share_url TEXT,
  
  error_message TEXT,
  
  created_at INTEGER NOT NULL,
  shared_at INTEGER,
  
  FOREIGN KEY (assignment_id) REFERENCES fanpage_assignments(id) ON DELETE CASCADE
);

CREATE INDEX idx_group_shares_assignment ON group_shares(assignment_id);
CREATE INDEX idx_group_shares_status ON group_shares(status);

CREATE INDEX idx_group_shares_status ON group_shares(status);

-- ============================================
-- DOUYIN VIDEO LOCALIZATION (AI GLOBAL)
-- Module: Tải video Douyin -> Dịch Script -> TTS -> Merge Video
-- ============================================

CREATE TABLE IF NOT EXISTS douyin_videos (
  id TEXT PRIMARY KEY, -- Sử dụng UUID string (VD: '550e8400-e29b...')
  
  product_id INTEGER,
  
  -- 1. Input Data
  douyin_url TEXT NOT NULL,         -- Link gốc
  original_video_url TEXT,          -- Link R2 (Raw video no watermark)
  original_cover_url TEXT,          -- Ảnh bìa gốc
  duration INTEGER DEFAULT 0,       -- Thời lượng (giây)
  
  -- 2. AI Analysis Data (JSON)
  original_script_cn TEXT,          -- Script gốc tiếng Trung
  ai_analysis_json TEXT,            -- Kết quả phân tích từ Gemini (Sản phẩm, Key points)
  vietnamese_scripts_json TEXT,     -- Danh sách 3-5 kịch bản gợi ý (JSON Array)
  
  -- 3. User Configuration (Sau khi sửa)
  selected_script_version INTEGER DEFAULT 1,
  final_script_text TEXT,           -- Kịch bản chốt để đọc
  
  voice_model TEXT DEFAULT 'vi-VN-Standard-A', -- Mã giọng đọc
  voice_speed REAL DEFAULT 1.0,     -- Tốc độ đọc (0.8 - 1.2)
  voice_pitch REAL DEFAULT 0.0,     -- Cao độ
  
  background_music_mode TEXT DEFAULT 'keep_original' CHECK(background_music_mode IN ('keep_original', 'remove', 'replace')),
  background_music_url TEXT,        -- Nếu mode = replace
  
  -- 4. Processing Status
  status TEXT DEFAULT 'pending' CHECK(status IN (
    'pending',           -- Mới tạo
    'downloading',       -- Đang tải từ Douyin
    'analyzing',         -- Đang gửi qua Gemini
    'waiting_approval',  -- Chờ user duyệt script (Trạng thái dừng)
    'rendering',         -- Đang ghép video (Cloud Run/FFmpeg)
    'completed',         -- Hoàn thành
    'failed'             -- Lỗi
  )),
  
  progress INTEGER DEFAULT 0,       -- 0-100%
  current_step TEXT,                -- 'gemini', 'tts', 'ffmpeg', 'upload'
  
  -- 5. Output
  vietnamese_audio_url TEXT,        -- File âm thanh TTS
  final_video_url TEXT,             -- File video thành phẩm trên R2
  
  -- 6. Error & Logs
  error_message TEXT,
  
  -- 7. Metadata
  created_at INTEGER NOT NULL,      -- Timestamp
  updated_at INTEGER NOT NULL,
  
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE INDEX idx_douyin_videos_status ON douyin_videos(status);
CREATE INDEX idx_douyin_videos_product ON douyin_videos(product_id);
CREATE INDEX idx_douyin_videos_created ON douyin_videos(created_at);

-- Bảng Queue để Worker xử lý tuần tự (Tránh overload)
CREATE TABLE IF NOT EXISTS douyin_queue_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  
  action TEXT NOT NULL CHECK(action IN ('download', 'analyze', 'render', 'publish')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
  
  attempts INTEGER DEFAULT 0,       -- Số lần thử lại
  last_attempt_at INTEGER,
  
  payload TEXT,                     -- JSON params bổ sung nếu cần
  created_at INTEGER NOT NULL,
  
  FOREIGN KEY (video_id) REFERENCES douyin_videos(id) ON DELETE CASCADE
);

CREATE INDEX idx_douyin_queue_status ON douyin_queue_jobs(status);

-- ============================================
-- SYSTEM SETTINGS (Migration from KV to D1)
-- Lưu cấu hình hệ thống, Token, API Key
-- ============================================

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_name TEXT UNIQUE NOT NULL,  -- VD: 'facebook_ads_token'
  value_json TEXT,                -- Lưu JSON string
  description TEXT,               -- Ghi chú
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key_name);