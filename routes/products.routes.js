const router = require('express').Router();
const { db, nextId } = require('../data/store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/products?page=1&limit=20
router.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const start = (page - 1) * limit;
  const slice = db.products.slice(start, start + limit);
  res.json({ ok: true, page, limit, total: db.products.length, products: slice });
}));

// GET /api/products/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const product = db.products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ ok: false, error: 'Product not found' });
  res.json({ ok: true, product });
}));

// POST /api/products — seller only
router.post('/', requireAuth, requireRole('seller'), asyncHandler(async (req, res) => {
  const { title, categoryId, price, mrp, stock, description, images } = req.body;
  if (!title || !categoryId || price == null || stock == null) {
    return res.status(400).json({ ok: false, error: 'title, categoryId, price, stock are required' });
  }
  const seller = db.sellers.find(s => s.userId === req.user.id);
  if (!seller) return res.status(403).json({ ok: false, error: 'No seller profile for this account' });

  const product = {
    id: nextId('p'), sellerId: seller.id, title, categoryId, price, mrp: mrp || price,
    stock, rating: 0, ratingCount: 0, images: images || [], description: description || '',
    createdAt: new Date().toISOString()
  };
  db.products.push(product);
  res.status(201).json({ ok: true, product });
}));

// PUT /api/products/:id — seller only, must own the product
router.put('/:id', requireAuth, requireRole('seller'), asyncHandler(async (req, res) => {
  const product = db.products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ ok: false, error: 'Product not found' });
  const seller = db.sellers.find(s => s.userId === req.user.id);
  if (!seller || product.sellerId !== seller.id) return res.status(403).json({ ok: false, error: 'Not your product' });

  Object.assign(product, req.body, { id: product.id, sellerId: product.sellerId });
  res.json({ ok: true, product });
}));

// DELETE /api/products/:id — seller only, must own the product
router.delete('/:id', requireAuth, requireRole('seller'), asyncHandler(async (req, res) => {
  const idx = db.products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Product not found' });
  const seller = db.sellers.find(s => s.userId === req.user.id);
  if (!seller || db.products[idx].sellerId !== seller.id) return res.status(403).json({ ok: false, error: 'Not your product' });

  db.products.splice(idx, 1);
  res.json({ ok: true });
}));

// GET /api/products/:id/reviews
router.get('/:id/reviews', asyncHandler(async (req, res) => {
  const reviews = db.reviews.filter(r => r.productId === req.params.id);
  res.json({ ok: true, reviews });
}));

module.exports = router;
