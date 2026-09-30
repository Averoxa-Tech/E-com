const router = require('express').Router();
const { db, nextId } = require('../data/store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

function sellerOf(req) { return db.sellers.find(s => s.userId === req.user.id); }

// POST /api/sellers/register  { shopName }
router.post('/register', requireAuth, asyncHandler(async (req, res) => {
  if (db.sellers.find(s => s.userId === req.user.id)) return res.status(409).json({ ok: false, error: 'Already a seller' });
  const { shopName } = req.body;
  if (!shopName) return res.status(400).json({ ok: false, error: 'shopName is required' });

  const seller = { id: nextId('s'), userId: req.user.id, shopName, rating: 0, createdAt: new Date().toISOString() };
  db.sellers.push(seller);
  req.user.role = 'seller';
  res.status(201).json({ ok: true, seller });
}));

// GET /api/sellers/me/products
router.get('/me/products', requireAuth, requireRole('seller'), asyncHandler(async (req, res) => {
  const seller = sellerOf(req);
  res.json({ ok: true, products: db.products.filter(p => p.sellerId === seller.id) });
}));

// GET /api/sellers/me/orders — orders containing at least one of this seller's products
router.get('/me/orders', requireAuth, requireRole('seller'), asyncHandler(async (req, res) => {
  const seller = sellerOf(req);
  const myProductIds = new Set(db.products.filter(p => p.sellerId === seller.id).map(p => p.id));
  const orders = db.orders
    .map(o => ({ ...o, items: o.items.filter(i => myProductIds.has(i.productId)) }))
    .filter(o => o.items.length > 0);
  res.json({ ok: true, orders });
}));

// GET /api/sellers/me/analytics
router.get('/me/analytics', requireAuth, requireRole('seller'), asyncHandler(async (req, res) => {
  const seller = sellerOf(req);
  const myProductIds = new Set(db.products.filter(p => p.sellerId === seller.id).map(p => p.id));
  let revenue = 0, unitsSold = 0;
  db.orders.forEach(o => {
    if (o.status === 'cancelled') return;
    o.items.forEach(i => { if (myProductIds.has(i.productId)) { revenue += i.price * i.qty; unitsSold += i.qty; } });
  });
  res.json({
    ok: true,
    analytics: { revenue, unitsSold, activeProducts: myProductIds.size, rating: seller.rating }
  });
}));

// PUT /api/sellers/me/inventory/:productId  { stock }
router.put('/me/inventory/:productId', requireAuth, requireRole('seller'), asyncHandler(async (req, res) => {
  const seller = sellerOf(req);
  const product = db.products.find(p => p.id === req.params.productId && p.sellerId === seller.id);
  if (!product) return res.status(404).json({ ok: false, error: 'Product not found in your catalog' });
  const { stock } = req.body;
  if (stock == null || stock < 0) return res.status(400).json({ ok: false, error: 'stock must be >= 0' });
  product.stock = stock;
  res.json({ ok: true, product });
}));

module.exports = router;
