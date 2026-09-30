const router = require('express').Router();
const { db, nextId } = require('../data/store');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const TRACKING_STAGES = ['placed', 'confirmed', 'shipped', 'out_for_delivery', 'delivered'];

// POST /api/orders — checkout the current cart  { addressId, paymentMethod }
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const cart = db.carts[req.user.id] || [];
  if (cart.length === 0) return res.status(400).json({ ok: false, error: 'Cart is empty' });
  const { addressId, paymentMethod } = req.body;
  const address = req.user.addresses.find(a => a.id === addressId);
  if (!address) return res.status(400).json({ ok: false, error: 'Valid addressId is required' });

  const items = [];
  for (const line of cart) {
    const product = db.products.find(p => p.id === line.productId);
    if (!product) continue;
    if (product.stock < line.qty) return res.status(409).json({ ok: false, error: `Not enough stock for ${product.title}` });
    items.push({ productId: product.id, title: product.title, price: product.price, qty: line.qty });
  }
  items.forEach(i => { db.products.find(p => p.id === i.productId).stock -= i.qty; });

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const order = {
    id: nextId('ord'), userId: req.user.id, items, total, address,
    paymentMethod: paymentMethod || 'cod', paymentStatus: paymentMethod === 'cod' ? 'pending' : 'awaiting_payment',
    status: 'placed', trackingStage: 0, createdAt: new Date().toISOString()
  };
  db.orders.push(order);
  db.carts[req.user.id] = [];

  res.status(201).json({ ok: true, order });
}));

// GET /api/orders — the logged-in buyer's own orders
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const orders = db.orders.filter(o => o.userId === req.user.id);
  res.json({ ok: true, orders });
}));

// GET /api/orders/:id
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const order = db.orders.find(o => o.id === req.params.id && o.userId === req.user.id);
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
  res.json({ ok: true, order });
}));

// POST /api/orders/:id/cancel
router.post('/:id/cancel', requireAuth, asyncHandler(async (req, res) => {
  const order = db.orders.find(o => o.id === req.params.id && o.userId === req.user.id);
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
  if (['shipped', 'out_for_delivery', 'delivered'].includes(order.status)) {
    return res.status(409).json({ ok: false, error: `Cannot cancel an order that is already ${order.status}` });
  }
  order.items.forEach(i => { const p = db.products.find(pp => pp.id === i.productId); if (p) p.stock += i.qty; });
  order.status = 'cancelled';
  res.json({ ok: true, order });
}));

// GET /api/orders/:id/track
router.get('/:id/track', requireAuth, asyncHandler(async (req, res) => {
  const order = db.orders.find(o => o.id === req.params.id && o.userId === req.user.id);
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
  res.json({ ok: true, status: order.status, stages: TRACKING_STAGES, currentStage: order.trackingStage });
}));

module.exports = router;
