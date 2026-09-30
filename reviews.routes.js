const router = require('express').Router();
const { db, nextId } = require('../data/store');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

function recalcRating(productId) {
  const product = db.products.find(p => p.id === productId);
  const list = db.reviews.filter(r => r.productId === productId);
  if (!product) return;
  product.ratingCount = list.length;
  product.rating = list.length ? Math.round((list.reduce((s, r) => s + r.rating, 0) / list.length) * 10) / 10 : 0;
}

// POST /api/products/:productId/reviews  { rating, title, body }
router.post('/products/:productId/reviews', requireAuth, asyncHandler(async (req, res) => {
  const product = db.products.find(p => p.id === req.params.productId);
  if (!product) return res.status(404).json({ ok: false, error: 'Product not found' });
  const { rating, title, body } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ ok: false, error: 'rating must be 1-5' });

  const review = { id: nextId('rev'), productId: product.id, userId: req.user.id, rating, title: title || '', body: body || '', createdAt: new Date().toISOString() };
  db.reviews.push(review);
  recalcRating(product.id);
  res.status(201).json({ ok: true, review });
}));

// PUT /api/reviews/:id — only the author can edit
router.put('/reviews/:id', requireAuth, asyncHandler(async (req, res) => {
  const review = db.reviews.find(r => r.id === req.params.id);
  if (!review) return res.status(404).json({ ok: false, error: 'Review not found' });
  if (review.userId !== req.user.id) return res.status(403).json({ ok: false, error: 'Not your review' });

  const { rating, title, body } = req.body;
  if (rating) review.rating = rating;
  if (title !== undefined) review.title = title;
  if (body !== undefined) review.body = body;
  recalcRating(review.productId);
  res.json({ ok: true, review });
}));

// DELETE /api/reviews/:id — only the author can delete
router.delete('/reviews/:id', requireAuth, asyncHandler(async (req, res) => {
  const idx = db.reviews.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Review not found' });
  if (db.reviews[idx].userId !== req.user.id) return res.status(403).json({ ok: false, error: 'Not your review' });

  const productId = db.reviews[idx].productId;
  db.reviews.splice(idx, 1);
  recalcRating(productId);
  res.json({ ok: true });
}));

module.exports = router;
