PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  
  title TEXT NOT NULL,              
  slug TEXT UNIQUE NOT NULL,
  shortDesc TEXT,                   
  desc TEXT,                        
  
  
  category_slug TEXT,               
  
  
  sold INTEGER DEFAULT 0,           
  rating REAL DEFAULT 5.0,          
  rating_count INTEGER DEFAULT 0,  
  
  
  seo_title TEXT,
  seo_desc TEXT,
  keywords TEXT,                    
  
  
  faq TEXT,                         
  reviews TEXT,                     
  
  
  images TEXT,                      
  video TEXT,
  
    
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'draft')),
  on_website INTEGER DEFAULT 1,    
  on_mini INTEGER DEFAULT 1,

  
  stock INTEGER DEFAULT 0,
  
  
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  
  
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,              
  
  
  price REAL NOT NULL DEFAULT 0,          
  price_sale REAL,                        
  price_wholesale REAL,                   
  cost_price REAL,                        
  
  
  price_silver REAL,
  price_gold REAL,
  price_diamond REAL,
  
  
  stock INTEGER DEFAULT 0,
  
  
  weight REAL DEFAULT 0,           
  
  
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'out_of_stock')),
  
  
  image TEXT,
  
  
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE TABLE channel_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  channel TEXT NOT NULL CHECK(channel IN ('shopee', 'lazada', 'tiktok')),
  
  
  channel_item_id TEXT NOT NULL,
  channel_model_id TEXT,
  channel_sku TEXT,
  
  
  product_id INTEGER NOT NULL,
  variant_id INTEGER,
  
  
  channel_price REAL,
  channel_price_sale REAL,
  
  
  is_active INTEGER DEFAULT 1,
  last_sync_at INTEGER,
  
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  UNIQUE(channel, channel_item_id, channel_model_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE CASCADE
);
CREATE TABLE stock_logs (
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
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  order_number TEXT UNIQUE NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('website', 'mini', 'shopee', 'lazada', 'tiktok')),
  channel_order_id TEXT,
  
  
  customer_id INTEGER,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  
  
  shipping_name TEXT,
  shipping_phone TEXT,
  shipping_address TEXT,
  shipping_district TEXT,
  shipping_city TEXT,
  shipping_province TEXT,
  shipping_zipcode TEXT,
  
  
  subtotal REAL NOT NULL DEFAULT 0,
  shipping_fee REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
    
  seller_transaction_fee REAL DEFAULT 0,

  
  shop_id TEXT,
  shop_name TEXT,

  
  
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'shipped', 'completed', 'cancelled', 'returned')),
  payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'refunded')),
  fulfillment_status TEXT DEFAULT 'unfulfilled' CHECK(fulfillment_status IN ('unfulfilled', 'fulfilled', 'partial')),
  
  payment_method TEXT,
  
  
  customer_note TEXT,
  admin_note TEXT,
  
  
  tracking_number TEXT,
  shipping_carrier TEXT,
  
  
  coin_used REAL DEFAULT 0,
  voucher_code TEXT,
  voucher_seller REAL DEFAULT 0,
  voucher_shopee REAL DEFAULT 0,
  commission_fee REAL DEFAULT 0,
  service_fee REAL DEFAULT 0,
  escrow_amount REAL DEFAULT 0,
  buyer_paid_amount REAL DEFAULT 0,
  
  
  estimated_shipping_fee REAL DEFAULT 0,
  actual_shipping_fee_confirmed REAL DEFAULT 0,
  
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);
CREATE TABLE order_items (
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
CREATE TABLE customers (
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
CREATE TABLE categories (
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
CREATE TABLE video_syncs (
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
CREATE TABLE ai_generated_content (
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
CREATE TABLE facebook_posts (
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
DELETE FROM sqlite_sequence;
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(category_slug);
CREATE INDEX idx_variants_product ON variants(product_id);
CREATE INDEX idx_variants_sku ON variants(sku);
CREATE INDEX idx_variants_status ON variants(status);
CREATE INDEX idx_channel_products_variant ON channel_products(variant_id);
CREATE INDEX idx_channel_products_channel ON channel_products(channel);
CREATE INDEX idx_stock_logs_variant ON stock_logs(variant_id);
CREATE INDEX idx_stock_logs_created ON stock_logs(created_at);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_channel ON orders(channel);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_variant ON order_items(variant_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_tier ON customers(tier);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_video_syncs_status ON video_syncs(status);
CREATE INDEX idx_video_syncs_created_by ON video_syncs(created_by);
CREATE INDEX idx_facebook_posts_video_sync ON facebook_posts(video_sync_id);
CREATE INDEX idx_ai_content_video_sync ON ai_generated_content(video_sync_id);