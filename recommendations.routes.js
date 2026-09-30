const router = require('express').Router();
const { db } = require('../data/store');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/recommendations/for-you
// Demo logic: recommend products from categories the user has ordered or wishlisted before.
router.get('/for-you', requireAuth, asyncHandler(async (req, res) => {
  const wishlist = db.wishlists[req.user.id] || [];
  const orderedProductIds = db.orders.filter(o => o.userId === req.user.id).flatMap(o => o.items.map(i => i.productId));
  const seenIds = new Set([...wishlist, ...orderedProductIds]);
  const seenCategories = new Set(
    [...seenIds].map(id => db.products.find(p => p.id === id)).filter(Boolean).map(p => p.categoryId)
  );

  let picks = db.products.filter(p => seenCategories.has(p.categoryId) && !seenIds.has(p.id));
  if (picks.length === 0) picks = db.products.slice().sort((a, b) => b.rating - a.rating); // cold start: top-rated

  res.json({ ok: true, recommendations: picks.slice(0, 10) });
}));

// GET /api/recommendations/similar/:productId
// Demo logic: same category, excluding itself, ranked by rating.
router.get('/similar/:productId', asyncHandler(async (req, res) => {
  const product = db.products.find(p => p.id === req.params.productId);
  if (!product) return res.status(404).json({ ok: false, error: 'Product not found' });

  const similar = db.products
    .filter(p => p.categoryId === product.categoryId && p.id !== product.id)
    .sort((a, b) => b.rating - a.rating);
  res.json({ ok: true, similar: similar.slice(0, 10) });
}));

// GET /api/recommendations/trending
// Demo logic: most-ordered products across all buyers.
router.get('/trending', asyncHandler(async (req, res) => {
  const counts = {};
  db.orders.forEach(o => o.items.forEach(i => { counts[i.productId] = (counts[i.productId] || 0) + i.qty; }));
  const trending = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([productId]) => db.products.find(p => p.id === productId))
    .filter(Boolean);

  const fallback = db.products.slice().sort((a, b) => b.ratingCount - a.ratingCount);
  const result = (trending.length ? trending : fallback).slice(0, 10);
  res.json({ ok: true, trending: result });
}));

module.exports = router;
