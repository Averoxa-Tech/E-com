const router = require('express').Router();
const { db } = require('../data/store');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

function getCart(userId) {
  if (!db.carts[userId]) db.carts[userId] = [];
  return db.carts[userId];
}

function hydrate(cart) {
  return cart.map(item => {
    const product = db.products.find(p => p.id === item.productId);
    return { productId: item.productId, qty: item.qty, product: product || null, lineTotal: product ? product.price * item.qty : 0 };
  });
}

// GET /api/cart
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const items = hydrate(getCart(req.user.id));
  const total = items.reduce((s, i) => s + i.lineTotal, 0);
  res.json({ ok: true, items, total });
}));

// POST /api/cart/items  { productId, qty }
router.post('/items', requireAuth, asyncHandler(async (req, res) => {
  const { productId, qty } = req.body;
  const product = db.products.find(p => p.id === productId);
  if (!product) return res.status(404).json({ ok: false, error: 'Product not found' });
  const quantity = Math.max(1, parseInt(qty) || 1);
  if (quantity > product.stock) return res.status(409).json({ ok: false, error: 'Not enough stock' });

  const cart = getCart(req.user.id);
  const existing = cart.find(i => i.productId === productId);
  if (existing) existing.qty += quantity; else cart.push({ productId, qty: quantity });

  res.status(201).json({ ok: true, items: hydrate(cart) });
}));

// PUT /api/cart/items/:productId  { qty }
router.put('/items/:productId', requireAuth, asyncHandler(async (req, res) => {
  const cart = getCart(req.user.id);
  const item = cart.find(i => i.productId === req.params.productId);
  if (!item) return res.status(404).json({ ok: false, error: 'Item not in cart' });
  const quantity = parseInt(req.body.qty);
  if (!quantity || quantity < 1) return res.status(400).json({ ok: false, error: 'qty must be a positive integer' });
  item.qty = quantity;
  res.json({ ok: true, items: hydrate(cart) });
}));

// DELETE /api/cart/items/:productId
router.delete('/items/:productId', requireAuth, asyncHandler(async (req, res) => {
  const cart = getCart(req.user.id);
  const next = cart.filter(i => i.productId !== req.params.productId);
  db.carts[req.user.id] = next;
  res.json({ ok: true, items: hydrate(next) });
}));

// DELETE /api/cart — empty the whole cart
router.delete('/', requireAuth, asyncHandler(async (req, res) => {
  db.carts[req.user.id] = [];
  res.json({ ok: true, items: [] });
}));

module.exports = router;
