import express from 'express';
import Stripe from 'stripe';
import Database from 'better-sqlite3';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize SQLite
const db = new Database(join(__dirname, '../data/store.db'));

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'agent-commerce', version: '0.1.0' });
});

// List all products
app.get('/api/products', (req, res) => {
  try {
    const products = db.prepare(`
      SELECT id, name, description, amazon_asin, amazon_price, our_price, 
             margin_percent, category, image_url, in_stock, updated_at
      FROM products 
      WHERE in_stock = 1
      ORDER BY category, name
    `).all();
    
    res.json({ products, count: products.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  try {
    const product = db.prepare(`
      SELECT * FROM products WHERE id = ?
    `).get(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create order (agent checkout)
app.post('/api/orders', async (req, res) => {
  const { product_id, quantity = 1, shipping, payment_method_id, agent_id } = req.body;
  
  // Validate required fields
  if (!product_id || !shipping || !payment_method_id) {
    return res.status(400).json({ 
      error: 'Missing required fields: product_id, shipping, payment_method_id' 
    });
  }
  
  try {
    // Get product
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    if (!product.in_stock) {
      return res.status(400).json({ error: 'Product out of stock' });
    }
    
    const total = product.our_price * quantity;
    const totalCents = Math.round(total * 100);
    
    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      payment_method: payment_method_id,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      metadata: {
        product_id,
        product_name: product.name,
        amazon_asin: product.amazon_asin,
        agent_id: agent_id || 'direct',
        quantity: quantity.toString()
      }
    });
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ 
        error: 'Payment failed', 
        status: paymentIntent.status 
      });
    }
    
    // Create order in database
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    db.prepare(`
      INSERT INTO orders (
        id, product_id, quantity, total_usd, shipping_name, shipping_address,
        shipping_city, shipping_country, shipping_postal, stripe_payment_id,
        agent_id, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      orderId,
      product_id,
      quantity,
      total,
      shipping.name,
      shipping.address,
      shipping.city,
      shipping.country,
      shipping.postal,
      paymentIntent.id,
      agent_id || null,
      'paid'
    );
    
    // Log for fulfillment (will be picked up manually)
    console.log(`\n🛒 NEW ORDER: ${orderId}`);
    console.log(`   Product: ${product.name} (ASIN: ${product.amazon_asin})`);
    console.log(`   Quantity: ${quantity}`);
    console.log(`   Total: $${total}`);
    console.log(`   Ship to: ${shipping.name}, ${shipping.address}, ${shipping.city}, ${shipping.country} ${shipping.postal}`);
    console.log(`   Amazon URL: https://amazon.com/dp/${product.amazon_asin}\n`);
    
    res.json({
      order_id: orderId,
      status: 'paid',
      total,
      currency: 'USD',
      product: {
        id: product.id,
        name: product.name
      },
      shipping,
      estimated_delivery: getEstimatedDelivery(shipping.country),
      tracking: null,
      fulfillment_note: 'Order received. Will be fulfilled within 24 hours.'
    });
    
  } catch (err) {
    console.error('Order error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get order status
app.get('/api/orders/:id', (req, res) => {
  try {
    const order = db.prepare(`
      SELECT o.*, p.name as product_name, p.amazon_asin
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.id = ?
    `).get(req.params.id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({
      order_id: order.id,
      status: order.status,
      total: order.total_usd,
      currency: 'USD',
      product: {
        id: order.product_id,
        name: order.product_name
      },
      shipping: {
        name: order.shipping_name,
        address: order.shipping_address,
        city: order.shipping_city,
        country: order.shipping_country,
        postal: order.shipping_postal
      },
      tracking_number: order.tracking_number,
      tracking_url: order.tracking_url,
      created_at: order.created_at,
      shipped_at: order.shipped_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update order (for fulfillment - add tracking)
app.patch('/api/orders/:id', (req, res) => {
  const { status, tracking_number, tracking_url } = req.body;
  
  // Simple auth check (would use proper auth in production)
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const updates = [];
    const values = [];
    
    if (status) {
      updates.push('status = ?');
      values.push(status);
      if (status === 'shipped') {
        updates.push("shipped_at = datetime('now')");
      }
    }
    if (tracking_number) {
      updates.push('tracking_number = ?');
      values.push(tracking_number);
    }
    if (tracking_url) {
      updates.push('tracking_url = ?');
      values.push(tracking_url);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    
    values.push(req.params.id);
    
    db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    res.json({ success: true, order_id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: estimate delivery based on country
function getEstimatedDelivery(country) {
  const days = country === 'US' ? 5 : country === 'FR' ? 7 : 14;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

// Start server
app.listen(PORT, () => {
  console.log(`🛒 Agent Commerce API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Products: http://localhost:${PORT}/api/products`);
});
