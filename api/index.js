// Vercel serverless handler
import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';

const app = express();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// In-memory products
const products = [
  { id: 'bose-qc45', name: 'Bose QuietComfort 45 Headphones', description: 'Wireless noise-cancelling over-ear headphones', amazon_asin: 'B098FKXT8L', amazon_price: 329, our_price: 339, margin_percent: 3.04, category: 'audio', in_stock: 1, image: 'https://m.media-amazon.com/images/I/51Kp6ZXDG8L._AC_SL1500_.jpg' },
  { id: 'airpods-pro-2', name: 'Apple AirPods Pro 2', description: 'Active Noise Cancellation, USB-C charging', amazon_asin: 'B0D1XD1ZV3', amazon_price: 249, our_price: 257, margin_percent: 3.21, category: 'audio', in_stock: 1, image: 'https://m.media-amazon.com/images/I/61SUj2aKoEL._AC_SL1500_.jpg' },
  { id: 'sony-wh1000xm5', name: 'Sony WH-1000XM5', description: 'Industry-leading noise cancellation', amazon_asin: 'B09XS7JWHH', amazon_price: 398, our_price: 410, margin_percent: 3.02, category: 'audio', in_stock: 1, image: 'https://m.media-amazon.com/images/I/61vJtKbAssL._AC_SL1500_.jpg' },
  { id: 'logitech-mx-master-3s', name: 'Logitech MX Master 3S', description: 'Wireless performance mouse', amazon_asin: 'B09HM94VDS', amazon_price: 99.99, our_price: 103, margin_percent: 3.01, category: 'peripherals', in_stock: 1, image: 'https://m.media-amazon.com/images/I/61ni3t1ryQL._AC_SL1500_.jpg' },
  { id: 'keychron-q1-pro', name: 'Keychron Q1 Pro', description: 'Wireless mechanical keyboard', amazon_asin: 'B0BW1ZBDX9', amazon_price: 199, our_price: 205, margin_percent: 3.02, category: 'peripherals', in_stock: 1, image: 'https://m.media-amazon.com/images/I/71jG6JZ0TrL._AC_SL1500_.jpg' },
  { id: 'kindle-paperwhite', name: 'Kindle Paperwhite 16GB', description: '6.8" display, adjustable warm light', amazon_asin: 'B09TMN58KL', amazon_price: 149.99, our_price: 155, margin_percent: 3.34, category: 'electronics', in_stock: 1, image: 'https://m.media-amazon.com/images/I/61z6VKBi1rL._AC_SL1000_.jpg' },
  { id: 'anker-powerbank', name: 'Anker 737 Power Bank', description: '24,000mAh, 140W output', amazon_asin: 'B09VPHVT2Z', amazon_price: 109.99, our_price: 113, margin_percent: 2.74, category: 'electronics', in_stock: 1, image: 'https://m.media-amazon.com/images/I/61kT7VPlTwL._AC_SL1500_.jpg' },
  { id: 'samsung-t7-1tb', name: 'Samsung T7 SSD 1TB', description: 'Portable, 1050MB/s transfer', amazon_asin: 'B0874XN4D8', amazon_price: 109.99, our_price: 113, margin_percent: 2.74, category: 'storage', in_stock: 1, image: 'https://m.media-amazon.com/images/I/91JY+4s4AGL._AC_SL1500_.jpg' },
  { id: 'elgato-stream-deck', name: 'Elgato Stream Deck MK.2', description: '15 LCD keys, customizable', amazon_asin: 'B09738CV2G', amazon_price: 149.99, our_price: 155, margin_percent: 3.34, category: 'peripherals', in_stock: 1, image: 'https://m.media-amazon.com/images/I/71dzPMi3yQL._AC_SL1500_.jpg' },
  { id: 'rode-podmic', name: 'Rode PodMic USB', description: 'Broadcast-quality dynamic mic', amazon_asin: 'B0BKY6FKLY', amazon_price: 199, our_price: 205, margin_percent: 3.02, category: 'audio', in_stock: 1, image: 'https://m.media-amazon.com/images/I/71kFqLTOKaL._AC_SL1500_.jpg' }
];

const orders = [];

// USDC payment config (Base L2)
const USDC_CONFIG = {
  address: '0x8eF8AC4230515E7D8396194ae2afC97b0140D579', // Agent Commerce merchant wallet
  chain: 'base',
  chainId: 8453,
  token: 'USDC',
  tokenContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
};

// Middleware
app.use(cors());
app.use(express.json());

// Landing page HTML
const landingHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Commerce</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    header { text-align: center; padding: 3rem 0; border-bottom: 1px solid #222; margin-bottom: 2rem; }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    h1 span { color: #00ff88; }
    .tagline { color: #888; font-size: 1.1rem; }
    .badge { display: inline-block; background: #00ff8822; color: #00ff88; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.8rem; margin-top: 1rem; }
    .products { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
    .product { background: #111; border-radius: 12px; overflow: hidden; transition: transform 0.2s; }
    .product:hover { transform: translateY(-4px); }
    .product img { width: 100%; height: 200px; object-fit: contain; background: #fff; padding: 1rem; }
    .product-info { padding: 1rem; }
    .product-name { font-weight: 600; margin-bottom: 0.25rem; }
    .product-desc { color: #888; font-size: 0.85rem; margin-bottom: 0.75rem; }
    .product-price { font-size: 1.25rem; color: #00ff88; font-weight: 600; }
    .product-price small { color: #666; font-weight: 400; font-size: 0.8rem; }
    .api-section { margin-top: 3rem; padding: 2rem; background: #111; border-radius: 12px; }
    .api-section h2 { margin-bottom: 1rem; color: #00ff88; }
    pre { background: #0a0a0a; padding: 1rem; border-radius: 8px; overflow-x: auto; font-size: 0.85rem; }
    code { color: #00ff88; }
    .footer { text-align: center; padding: 2rem; color: #444; font-size: 0.85rem; margin-top: 2rem; }
    .footer a { color: #00ff88; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🛒 Agent <span>Commerce</span></h1>
      <p class="tagline">E-commerce for AI agents. API-first. Pay with card or USDC.</p>
      <span class="badge">✨ 2-3% markup • Ships via Amazon</span>
    </header>
    
    <div class="products">
      ${products.map(p => `
        <div class="product">
          <img src="${p.image}" alt="${p.name}" />
          <div class="product-info">
            <div class="product-name">${p.name}</div>
            <div class="product-desc">${p.description}</div>
            <div class="product-price">$${p.our_price} <small>+${p.margin_percent}%</small></div>
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="api-section">
      <h2>🤖 Agent API</h2>
      <p style="color:#888;margin-bottom:1rem;">Your agent can browse and checkout programmatically:</p>
      <pre><code>GET  /api/products          # List all products
GET  /api/products/:id      # Product details
POST /api/orders            # Checkout (Stripe or USDC)
GET  /api/orders/:id        # Order status</code></pre>
    </div>
    
    <div class="footer">
      Built for the agent economy • <a href="https://github.com/robmiller87/agent-commerce-">GitHub</a>
    </div>
  </div>
</body>
</html>`;

// Landing page
app.get('/', (req, res) => {
  // Check if request wants JSON (agent) or HTML (human)
  if (req.headers.accept?.includes('application/json')) {
    return res.json({ 
      name: 'Agent Commerce API',
      description: 'Agent-ready e-commerce with 2-3% markup',
      endpoints: { products: '/api/products', product: '/api/products/:id', checkout: 'POST /api/orders', order_status: '/api/orders/:id' },
      product_count: products.length
    });
  }
  res.setHeader('Content-Type', 'text/html');
  res.send(landingHTML);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'agent-commerce', version: '0.1.0' });
});

// List all products
app.get('/api/products', (req, res) => {
  res.json({ products, count: products.length });
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// Create order (supports both Stripe card and USDC payments)
app.post('/api/orders', async (req, res) => {
  const { product_id, quantity = 1, shipping, payment_method, payment_method_id, agent_id, tx_hash } = req.body;
  
  if (!product_id || !shipping) {
    return res.status(400).json({ error: 'Missing required fields: product_id, shipping' });
  }
  
  const product = products.find(p => p.id === product_id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  
  const total = product.our_price * quantity;
  const orderId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  
  // USDC Payment Flow
  if (payment_method === 'usdc_base') {
    const order = {
      id: orderId,
      product_id,
      product_name: product.name,
      amazon_asin: product.amazon_asin,
      quantity,
      total,
      shipping,
      payment_method: 'usdc_base',
      agent_id: agent_id || null,
      status: tx_hash ? 'pending_confirmation' : 'awaiting_payment',
      tx_hash: tx_hash || null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
    };
    orders.push(order);
    
    console.log(`🛒 USDC ORDER: ${orderId} | ${product.name} | $${total} USDC | Status: ${order.status}`);
    
    return res.json({
      order_id: orderId,
      status: order.status,
      total,
      currency: 'USDC',
      product: { id: product.id, name: product.name },
      shipping,
      payment: {
        method: 'usdc_base',
        chain: 'Base',
        chain_id: 8453,
        token: 'USDC',
        token_contract: USDC_CONFIG.tokenContract,
        recipient: USDC_CONFIG.address,
        amount: total.toFixed(2),
        note: `Payment for order ${orderId}`
      },
      estimated_delivery: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0],
      expires_in_seconds: 3600
    });
  }
  
  // Stripe Card Payment Flow
  if (!payment_method_id) {
    return res.status(400).json({ error: 'Missing payment_method_id for card payment. Use payment_method: "usdc_base" for USDC.' });
  }
  
  const totalCents = Math.round(total * 100);
  
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      payment_method: payment_method_id,
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { product_id, product_name: product.name, amazon_asin: product.amazon_asin, agent_id: agent_id || 'direct' }
    });
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment failed', status: paymentIntent.status });
    }
    
    const order = { id: orderId, product_id, product_name: product.name, amazon_asin: product.amazon_asin, quantity, total, shipping, payment_method: 'card', stripe_payment_id: paymentIntent.id, agent_id, status: 'paid', created_at: new Date().toISOString() };
    orders.push(order);
    
    console.log(`🛒 CARD ORDER: ${orderId} | ${product.name} | $${total} | Ship to: ${shipping.name}, ${shipping.city}, ${shipping.country}`);
    
    res.json({ order_id: orderId, status: 'paid', total, currency: 'USD', product: { id: product.id, name: product.name }, shipping, estimated_delivery: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0], tracking: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Confirm USDC payment (after sending tx)
app.post('/api/orders/:id/confirm', async (req, res) => {
  const { tx_hash } = req.body;
  const order = orders.find(o => o.id === req.params.id);
  
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.payment_method !== 'usdc_base') return res.status(400).json({ error: 'Order is not a USDC payment' });
  if (order.status === 'paid') return res.json({ order_id: order.id, status: 'paid', message: 'Already confirmed' });
  
  if (!tx_hash) return res.status(400).json({ error: 'Missing tx_hash' });
  
  // Update order with tx hash
  order.tx_hash = tx_hash;
  order.status = 'pending_confirmation';
  
  // For MVP: trust the tx_hash, mark as paid
  // In production: verify on-chain that tx is confirmed and amount matches
  order.status = 'paid';
  order.paid_at = new Date().toISOString();
  
  console.log(`✅ USDC CONFIRMED: ${order.id} | tx: ${tx_hash}`);
  
  res.json({
    order_id: order.id,
    status: 'paid',
    tx_hash,
    message: 'Payment confirmed. Order will be fulfilled within 24 hours.',
    amazon_url: `https://amazon.com/dp/${order.amazon_asin}`
  });
});

// Get order status
app.get('/api/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

export default app;
