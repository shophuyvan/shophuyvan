-- ============================================
-- DOUYIN UPLOAD & OMNICHANNEL MIGRATION
-- Version: 1.0
-- Date: 2025-11-26
-- ============================================

-- ============================================
-- PART 1: UPDATE EXISTING DOUYIN_VIDEOS TABLE
-- ============================================

-- Add source_type column
ALTER TABLE douyin_videos ADD COLUMN source_type TEXT DEFAULT 'link' CHECK(source_type IN ('link', 'upload'));

-- Add R2 storage columns
ALTER TABLE douyin_videos ADD COLUMN r2_original_key TEXT;
ALTER TABLE douyin_videos ADD COLUMN r2_final_key TEXT;
ALTER TABLE douyin_videos ADD COLUMN r2_thumbnail_key TEXT;

-- Add file metadata columns
ALTER TABLE douyin_videos ADD COLUMN file_size INTEGER DEFAULT 0;
ALTER TABLE douyin_videos ADD COLUMN original_filename TEXT;
ALTER TABLE douyin_videos ADD COLUMN metadata_json TEXT;

-- Add deletion flag
ALTER TABLE douyin_videos ADD COLUMN original_deleted INTEGER DEFAULT 0;

-- Add link to content library
ALTER TABLE douyin_videos ADD COLUMN content_master_id TEXT;

-- Create indexes for douyin_videos
CREATE INDEX IF NOT EXISTS idx_douyin_videos_product ON douyin_videos(product_id);
CREATE INDEX IF NOT EXISTS idx_douyin_videos_source_type ON douyin_videos(source_type);
CREATE INDEX IF NOT EXISTS idx_douyin_videos_original_deleted ON douyin_videos(original_deleted);
CREATE INDEX IF NOT EXISTS idx_douyin_content ON douyin_videos(content_master_id);

-- ============================================
-- PART 2: CREATE SOCIAL CONTENT MASTER TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS social_content_master (
    id TEXT PRIMARY KEY,
    
    -- Product Link
    product_id INTEGER,
    product_name TEXT,
    
    -- Source Info
    source_type TEXT CHECK(source_type IN ('douyin', 'tiktok', 'manual')),
    source_id TEXT,
    
    -- Master Video File
    master_video_r2_key TEXT,
    master_video_url TEXT,
    master_thumbnail_url TEXT,
    
    -- Metadata
    duration REAL,
    original_resolution TEXT,
    file_size INTEGER,
    
    -- Content Base
    base_script TEXT,
    base_caption TEXT,
    base_hashtags TEXT,
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'ready', 'publishing', 'published', 'archived')),
    
    -- Stats
    total_views INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    total_shares INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    first_published_at INTEGER,
    
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_social_content_status ON social_content_master(status);
CREATE INDEX IF NOT EXISTS idx_social_content_product ON social_content_master(product_id);
CREATE INDEX IF NOT EXISTS idx_social_content_source ON social_content_master(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_social_content_created ON social_content_master(created_at DESC);

-- ============================================
-- PART 3: CREATE CONTENT VARIANTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS social_content_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_master_id TEXT NOT NULL,
    
    version INTEGER CHECK(version BETWEEN 1 AND 5),
    tone TEXT CHECK(tone IN ('casual', 'professional', 'sale-heavy', 'storytelling', 'tips')),
    
    caption TEXT NOT NULL,
    hashtags TEXT,
    cta_text TEXT,
    
    is_default INTEGER DEFAULT 0,
    
    created_at INTEGER NOT NULL,
    
    FOREIGN KEY (content_master_id) REFERENCES social_content_master(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_social_variants_content ON social_content_variants(content_master_id);
CREATE INDEX IF NOT EXISTS idx_social_variants_version ON social_content_variants(version);

-- ============================================
-- PART 4: CREATE PLATFORM ADAPTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS social_platform_adaptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_master_id TEXT NOT NULL,
    variant_id INTEGER,
    
    platform TEXT NOT NULL CHECK(platform IN (
        'facebook_page', 'facebook_reels', 'tiktok', 
        'youtube', 'youtube_shorts', 'zalo_video', 
        'threads', 'shopee_video'
    )),
    
    -- Video Optimization
    optimized_video_r2_key TEXT,
    optimized_video_url TEXT,
    video_format TEXT,
    resolution TEXT,
    aspect_ratio TEXT,
    duration REAL,
    file_size INTEGER,
    
    -- Caption Optimization
    adapted_caption TEXT,
    adapted_hashtags TEXT,
    
    -- Platform Specs
    thumbnail_r2_key TEXT,
    cover_image_r2_key TEXT,
    
    -- Metadata
    platform_metadata TEXT,
    
    created_at INTEGER NOT NULL,
    
    FOREIGN KEY (content_master_id) REFERENCES social_content_master(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES social_content_variants(id)
);

CREATE INDEX IF NOT EXISTS idx_social_adaptions_content ON social_platform_adaptions(content_master_id);
CREATE INDEX IF NOT EXISTS idx_social_adaptions_platform ON social_platform_adaptions(platform);

-- ============================================
-- PART 5: CREATE PUBLISHING QUEUE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS social_publishing_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    adaption_id INTEGER NOT NULL,
    
    -- Target
    platform TEXT NOT NULL,
    account_id TEXT,
    account_name TEXT,
    
    -- Scheduling
    scheduled_time INTEGER,
    priority INTEGER DEFAULT 5,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'published', 'failed', 'scheduled')),
    
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Result
    platform_post_id TEXT,
    platform_post_url TEXT,
    published_at INTEGER,
    
    error_message TEXT,
    error_code TEXT,
    
    -- Metrics
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    last_synced_at INTEGER,
    
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    FOREIGN KEY (adaption_id) REFERENCES social_platform_adaptions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_social_queue_status ON social_publishing_queue(status);
CREATE INDEX IF NOT EXISTS idx_social_queue_platform ON social_publishing_queue(platform);
CREATE INDEX IF NOT EXISTS idx_social_queue_scheduled ON social_publishing_queue(scheduled_time);

-- ============================================
-- PART 6: CREATE PLATFORM ACCOUNTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS social_platform_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    platform TEXT NOT NULL,
    account_type TEXT,
    
    account_id TEXT NOT NULL,
    account_name TEXT,
    account_username TEXT,
    
    -- OAuth/API Credentials
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at INTEGER,
    
    -- Permissions
    permissions TEXT,
    
    -- Status
    is_active INTEGER DEFAULT 1,
    is_default INTEGER DEFAULT 0,
    
    -- Limits
    daily_post_limit INTEGER,
    posts_today INTEGER DEFAULT 0,
    last_post_at INTEGER,
    
    -- Metadata
    follower_count INTEGER,
    avg_engagement REAL,
    
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_verified_at INTEGER,
    
    UNIQUE(platform, account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_platform_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_active ON social_platform_accounts(is_active);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if all tables were created
SELECT 'Migration completed! Tables created:' as message;
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'social_%';

-- Check douyin_videos columns
SELECT 'douyin_videos columns:' as message;
PRAGMA table_info(douyin_videos);
