const router = require('express').Router();
const { db } = require('../data/store');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/categories
router.get('/', asyncHandler(async (req, res) => {
  res.json({ ok: true, categories: db.categories });
}));

// GET /api/categories/:id/products
router.get('/:id/products', asyncHandler(async (req, res) => {
  const category = db.categories.find(c => c.id === req.params.id);
  if (!category) return res.status(404).json({ ok: false, error: 'Category not found' });
  const products = db.products.filter(p => p.categoryId === req.params.id);
  res.json({ ok: true, category, products });
}));

module.exports = router;
