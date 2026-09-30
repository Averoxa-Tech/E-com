const router = require('express').Router();
const { db } = require('../data/store');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/search?q=&category=&minPrice=&maxPrice=&minRating=&sort=price_asc|price_desc|rating|newest&page=&limit=
router.get('/', asyncHandler(async (req, res) => {
  const { q, category, minPrice, maxPrice, minRating, sort } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);

  let results = db.products.slice();

  if (q) {
    const needle = q.toLowerCase();
    results = results.filter(p => p.title.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle));
  }
  if (category) results = results.filter(p => p.categoryId === category);
  if (minPrice) results = results.filter(p => p.price >= Number(minPrice));
  if (maxPrice) results = results.filter(p => p.price <= Number(maxPrice));
  if (minRating) results = results.filter(p => p.rating >= Number(minRating));

  switch (sort) {
    case 'price_asc': results.sort((a, b) => a.price - b.price); break;
    case 'price_desc': results.sort((a, b) => b.price - a.price); break;
    case 'rating': results.sort((a, b) => b.rating - a.rating); break;
    case 'newest': results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
    default: break; // relevance (unsorted) when q is given
  }

  const total = results.length;
  const start = (page - 1) * limit;
  results = results.slice(start, start + limit);

  res.json({ ok: true, query: { q, category, minPrice, maxPrice, minRating, sort }, page, limit, total, results });
}));

module.exports = router;
