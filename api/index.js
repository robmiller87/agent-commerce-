// Vercel serverless handler
import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';

const app = express();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// In-memory products (Vercel serverless can't use SQLite)
const products = [
  { id: 'bose-qc45', name: 'Bose QuietComfort 45 Headphones', description: 'Wireless noise-cancelling over-ear headphones', amazon_asin: 'B098FKXT8L', amazon_price: 329, our_price: 339, margin_percent: 3.04, category: 'audio', in_stock: 1 },
  { id: 'airpods-pro-2', name: 'Apple AirPods Pro (2nd Generation)', description: 'Active Noise Cancellation, USB-C charging', amazon_asin: 'B0D1XD1ZV3', amazon_price: 249, our_price: 257, margin_percent: 3.21, category: 'audio', in_stock: 1 },
  { id: 'sony-wh1000xm5', name: 'Sony WH-1000XM5 Wireless Headphones', description: 'Industry-leading noise cancellation', amazon_asin: 'B09XS7JWHH', amazon_price: 398, our_price: 410, margin_percent: 3.02, category: 'audio', in_stock: 1 },
  { id: 'logitech-mx-master-3s', name: 'Logitech MX Master 3S Mouse', description: 'Wireless performance mouse', amazon_asin: 'B09HM94VDS', amazon_price: 99.99, our_price: 103, margin_percent: 3.01, category: 'peripherals', in_stock: 1 },
  { id: 'keychron-q1-pro', name: 'Keychron Q1 Pro Mechanical Keyboard', description: 'Wireless QMK/VIA custom keyboard', amazon_asin: 'B0BW1ZBDX9', amazon_price: 199, our_price: 205, margin_percent: 3.02, category: 'peripherals', in_stock: 1 },
  { id: 'kindle-paperwhite', name: 'Kindle Paperwhite (16 GB)', description: '6.8" display, adjustable warm light', amazon_asin: 'B09TMN58KL', amazon_price: 149.99, our_price: 155, margin_percent: 3.34, category: 'electronics', in_stock: 1 },
  { id: 'anker-powerbank', name: 'Anker 737 Power Bank (24,000mAh)', description: '140W output, laptop charging', amazon_asin: 'B09VPHVT2Z', amazon_price: 109.99, our_price: 113, margin_percent: 2.74, category: 'electronics', in_stock: 1 },
  { id: 'samsung-t7-1tb', name: 'Samsung T7 Portable SSD (1TB)', description: 'USB 3.2, 1050MB/s transfer', amazon_asin: 'B0874XN4D8', amazon_price: 109.99, our_price: 113, margin_percent: 2.74, category: 'storage', in_stock: 1 },
  { id: 'elgato-stream-deck', name: 'Elgato Stream Deck MK.2', description: '15 LCD keys, customizable', amazon_asin: 'B09738CV2G', amazon_price: 149.99, our_price: 155, margin_percent: 3.34, category: 'peripherals', in_stock: 1 },
  { id: 'rode-podcaster', name: 'Rode PodMic USB Microphone', description: 'Broadcast-quality dynamic mic', amazon_asin: 'B0BKY6FKLY', amazon_price: 199, our_price: 205, margin_percent: 3.02, category: 'audio', in_stock: 1 }
];

// In-memory orders (would use a real DB in production)
const orders = [];

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'agent-commerce', version: '0.1.0' });
});

// Landing page
app.get('/', (req, res) => {
  res.json({ 
    name: 'Agent Commerce API',
    description: 'Agent-ready e-commerce with 2-3% markup',
    endpoints: {
      products: '/api/products',
      product: '/api/products/:id',
      checkout: 'POST /api/orders',
      order_status: '/api/orders/:id'
    },
    product_count: products.length
  });
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

// Create order
app.post('/api/orders', async (req, res) => {
  const { product_id, quantity = 1, shipping, payment_method_id, agent_id } = req.body;
  
  if (!product_id || !shipping || !payment_method_id) {
    return res.status(400).json({ error: 'Missing required fields: product_id, shipping, payment_method_id' });
  }
  
  const product = products.find(p => p.id === product_id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  
  const total = product.our_price * quantity;
  const totalCents = Math.round(total * 100);
  
  try {
    // Create Stripe PaymentIntent
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
    
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const order = {
      id: orderId,
      product_id,
      product_name: product.name,
      amazon_asin: product.amazon_asin,
      quantity,
      total,
      shipping,
      stripe_payment_id: paymentIntent.id,
      agent_id: agent_id || null,
      status: 'paid',
      created_at: new Date().toISOString()
    };
    
    orders.push(order);
    
    // Log for fulfillment
    console.log(`🛒 NEW ORDER: ${orderId} | ${product.name} | $${total} | Ship to: ${shipping.name}, ${shipping.city}, ${shipping.country}`);
    console.log(`   Amazon: https://amazon.com/dp/${product.amazon_asin}`);
    
    res.json({
      order_id: orderId,
      status: 'paid',
      total,
      currency: 'USD',
      product: { id: product.id, name: product.name },
      shipping,
      estimated_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      tracking: null
    });
  } catch (err) {
    console.error('Order error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get order status
app.get('/api/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// Export for Vercel
export default app;
