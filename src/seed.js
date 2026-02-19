import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../data');

// Ensure data directory exists
try { mkdirSync(dataDir, { recursive: true }); } catch {}

const db = new Database(join(dataDir, 'store.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    amazon_asin TEXT NOT NULL,
    amazon_url TEXT,
    amazon_price REAL NOT NULL,
    our_price REAL NOT NULL,
    margin_percent REAL,
    category TEXT,
    image_url TEXT,
    in_stock INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    total_usd REAL NOT NULL,
    shipping_name TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    shipping_city TEXT NOT NULL,
    shipping_country TEXT NOT NULL,
    shipping_postal TEXT NOT NULL,
    stripe_payment_id TEXT,
    agent_id TEXT,
    status TEXT DEFAULT 'pending',
    tracking_number TEXT,
    tracking_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    shipped_at TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
`);

// Seed initial products (curated for good margins + stability)
const products = [
  {
    id: 'bose-qc45',
    name: 'Bose QuietComfort 45 Headphones',
    description: 'Wireless noise-cancelling over-ear headphones with 24-hour battery life',
    amazon_asin: 'B098FKXT8L',
    amazon_price: 329.00,
    our_price: 339.00,
    category: 'audio',
    image_url: 'https://m.media-amazon.com/images/I/51Kp6ZXDG8L._AC_SL1500_.jpg'
  },
  {
    id: 'airpods-pro-2',
    name: 'Apple AirPods Pro (2nd Generation)',
    description: 'Active Noise Cancellation, Adaptive Transparency, USB-C charging',
    amazon_asin: 'B0D1XD1ZV3',
    amazon_price: 249.00,
    our_price: 257.00,
    category: 'audio',
    image_url: 'https://m.media-amazon.com/images/I/61SUj2aKoEL._AC_SL1500_.jpg'
  },
  {
    id: 'sony-wh1000xm5',
    name: 'Sony WH-1000XM5 Wireless Headphones',
    description: 'Industry-leading noise cancellation, 30-hour battery, multipoint connection',
    amazon_asin: 'B09XS7JWHH',
    amazon_price: 398.00,
    our_price: 410.00,
    category: 'audio',
    image_url: 'https://m.media-amazon.com/images/I/61vJtKbAssL._AC_SL1500_.jpg'
  },
  {
    id: 'logitech-mx-master-3s',
    name: 'Logitech MX Master 3S Mouse',
    description: 'Wireless performance mouse with quiet clicks and 8K DPI tracking',
    amazon_asin: 'B09HM94VDS',
    amazon_price: 99.99,
    our_price: 103.00,
    category: 'peripherals',
    image_url: 'https://m.media-amazon.com/images/I/61ni3t1ryQL._AC_SL1500_.jpg'
  },
  {
    id: 'keychron-q1-pro',
    name: 'Keychron Q1 Pro Mechanical Keyboard',
    description: 'Wireless QMK/VIA custom keyboard with aluminum frame',
    amazon_asin: 'B0BW1ZBDX9',
    amazon_price: 199.00,
    our_price: 205.00,
    category: 'peripherals',
    image_url: 'https://m.media-amazon.com/images/I/71jG6JZ0TrL._AC_SL1500_.jpg'
  },
  {
    id: 'kindle-paperwhite',
    name: 'Kindle Paperwhite (16 GB)',
    description: '6.8" display, adjustable warm light, 10 weeks battery',
    amazon_asin: 'B09TMN58KL',
    amazon_price: 149.99,
    our_price: 155.00,
    category: 'electronics',
    image_url: 'https://m.media-amazon.com/images/I/61z6VKBi1rL._AC_SL1000_.jpg'
  },
  {
    id: 'anker-powerbank',
    name: 'Anker 737 Power Bank (24,000mAh)',
    description: '140W output, laptop charging capable, smart digital display',
    amazon_asin: 'B09VPHVT2Z',
    amazon_price: 109.99,
    our_price: 113.00,
    category: 'electronics',
    image_url: 'https://m.media-amazon.com/images/I/61kT7VPlTwL._AC_SL1500_.jpg'
  },
  {
    id: 'samsung-t7-1tb',
    name: 'Samsung T7 Portable SSD (1TB)',
    description: 'USB 3.2, up to 1050MB/s transfer speed, compact design',
    amazon_asin: 'B0874XN4D8',
    amazon_price: 109.99,
    our_price: 113.00,
    category: 'storage',
    image_url: 'https://m.media-amazon.com/images/I/91JY+4s4AGL._AC_SL1500_.jpg'
  },
  {
    id: 'elgato-stream-deck',
    name: 'Elgato Stream Deck MK.2',
    description: '15 LCD keys, customizable controls for streaming and productivity',
    amazon_asin: 'B09738CV2G',
    amazon_price: 149.99,
    our_price: 155.00,
    category: 'peripherals',
    image_url: 'https://m.media-amazon.com/images/I/71dzPMi3yQL._AC_SL1500_.jpg'
  },
  {
    id: 'rode-podcaster',
    name: 'Rode PodMic USB Microphone',
    description: 'Broadcast-quality dynamic microphone with USB-C',
    amazon_asin: 'B0BKY6FKLY',
    amazon_price: 199.00,
    our_price: 205.00,
    category: 'audio',
    image_url: 'https://m.media-amazon.com/images/I/71kFqLTOKaL._AC_SL1500_.jpg'
  }
];

// Insert products
const insertProduct = db.prepare(`
  INSERT OR REPLACE INTO products 
  (id, name, description, amazon_asin, amazon_price, our_price, margin_percent, category, image_url, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);

for (const p of products) {
  const margin = ((p.our_price - p.amazon_price) / p.amazon_price * 100).toFixed(2);
  insertProduct.run(p.id, p.name, p.description, p.amazon_asin, p.amazon_price, p.our_price, margin, p.category, p.image_url);
  console.log(`✅ ${p.name} — $${p.amazon_price} → $${p.our_price} (${margin}%)`);
}

console.log(`\n🛒 Seeded ${products.length} products`);
db.close();
