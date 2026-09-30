const router = require('express').Router();
const { db } = require('../data/store');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

function getWishlist(userId) {
  if (!db.wishlists[userId]) db.wishlists[userId] = [];
  return db.wishlists[userId];
}

// GET /api/wishlist
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const ids = getWishlist(req.user.id);
  const products = ids.map(id => db.products.find(p => p.id === id)).filter(Boolean);
  res.json({ ok: true, products });
}));

// POST /api/wishlist/items  { productId }
router.post('/items', requireAuth, asyncHandler(async (req, res) => {
  const { productId } = req.body;
  if (!db.products.find(p => p.id === productId)) return res.status(404).json({ ok: false, error: 'Product not found' });
  const list = getWishlist(req.user.id);
  if (!list.includes(productId)) list.push(productId);
  res.status(201).json({ ok: true, wishlist: list });
}));

// DELETE /api/wishlist/items/:productId
router.delete('/items/:productId', requireAuth, asyncHandler(async (req, res) => {
  db.wishlists[req.user.id] = getWishlist(req.user.id).filter(id => id !== req.params.productId);
  res.json({ ok: true, wishlist: db.wishlists[req.user.id] });
}));

module.exports = router;
