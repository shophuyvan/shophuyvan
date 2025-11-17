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
  
  -- Display settings
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'draft')),
  on_website INTEGER DEFAULT 1,    -- 1 = hiển thị, 0 = ẩn
  on_mini INTEGER DEFAULT 1,
  
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
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'shipped', 'completed', 'cancelled', 'returned')),
  payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'refunded')),
  fulfillment_status TEXT DEFAULT 'unfulfilled' CHECK(fulfillment_status IN ('unfulfilled', 'fulfilled', 'partial')),
  
  payment_method TEXT,
  
  -- Notes
  customer_note TEXT,
  admin_note TEXT,
  
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