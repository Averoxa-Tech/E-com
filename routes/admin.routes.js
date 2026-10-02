const router = require('express').Router();
const { db, nextId } = require('../data/store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { saveImage, deleteImage } = require('../data/admin-setup');

// Everything below needs a logged-in admin.
router.use(requireAuth, requireRole('admin'));

const bad = (res, msg) => res.status(400).json({ ok: false, error: msg });
const text = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const num = v => (v === '' || v == null ? NaN : Number(v));
const round2 = n => Math.round(n * 100) / 100;
const sellerId = () => (db.sellers[0] && db.sellers[0].id) || 's1';

// Photos must be http(s) URLs (the admin page uploads them first and sends back the URLs).
function cleanImages(list) {
  if (!Array.isArray(list)) return null;
  return list.map(u => String(u).trim()).filter(u => /^https?:\/\/\S{3,500}$/.test(u)).slice(0, 6);
}

// Works out mrp + price from mrp, price and/or discountPercent. Returns { mrp, price } or { error }.
function pricing(body, current) {
  const mrp = body.mrp !== undefined ? num(body.mrp) : current && current.mrp;
  if (!Number.isFinite(mrp) || mrp <= 0) return { error: 'MRP must be a number above 0' };
  let price;
  if (body.price !== undefined) price = num(body.price);
  else if (body.discountPercent !== undefined) {
    const d = num(body.discountPercent);
    if (!Number.isFinite(d) || d < 0 || d >= 100) return { error: 'Discount must be between 0 and 99' };
    price = mrp * (1 - d / 100);
  } else price = current ? current.price : mrp;
  if (!Number.isFinite(price) || price <= 0) return { error: 'Selling price must be a number above 0' };
  if (price > mrp) return { error: 'Selling price cannot be higher than MRP' };
  return { mrp: round2(mrp), price: round2(price) };
}

function dropImageFiles(urls) {
  (urls || []).forEach(u => {
    const m = /\/api\/images\/([a-f0-9]{24})$/.exec(u);
    if (m) deleteImage(m[1]).catch(() => {});
  });
}

// GET /api/admin/products: every product
router.get('/products', (req, res) => res.json({ ok: true, products: db.products }));

// POST /api/admin/products
router.post('/products', asyncHandler(async (req, res) => {
  const b = req.body || {};
  const title = text(b.title, 120);
  if (!title) return bad(res, 'Title is required');
  if (!db.categories.find(c => c.id === b.categoryId)) return bad(res, 'Choose a valid category');
  const images = cleanImages(b.images);
  if (!images || images.length === 0) return bad(res, 'Add at least one photo');
  const stock = num(b.stock);
  if (!Number.isInteger(stock) || stock < 0) return bad(res, 'Stock must be a whole number, 0 or more');
  const p = pricing(b, null);
  if (p.error) return bad(res, p.error);

  const product = {
    id: nextId('p'), sellerId: sellerId(), title, categoryId: b.categoryId,
    price: p.price, mrp: p.mrp, stock, rating: 0, ratingCount: 0,
    images, description: text(b.description, 2000), createdAt: new Date().toISOString()
  };
  db.products.push(product);
  res.status(201).json({ ok: true, product });
}));

// PUT /api/admin/products/:id (send only the fields that changed)
router.put('/products/:id', asyncHandler(async (req, res) => {
  const product = db.products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ ok: false, error: 'Product not found' });
  const b = req.body || {};

  if (b.title !== undefined) { const t = text(b.title, 120); if (!t) return bad(res, 'Title cannot be empty'); product.title = t; }
  if (b.description !== undefined) product.description = text(b.description, 2000);
  if (b.categoryId !== undefined) {
    if (!db.categories.find(c => c.id === b.categoryId)) return bad(res, 'Choose a valid category');
    product.categoryId = b.categoryId;
  }
  if (b.stock !== undefined) {
    const s = num(b.stock);
    if (!Number.isInteger(s) || s < 0) return bad(res, 'Stock must be a whole number, 0 or more');
    product.stock = s;
  }
  if (b.mrp !== undefined || b.price !== undefined || b.discountPercent !== undefined) {
    const p = pricing(b, product);
    if (p.error) return bad(res, p.error);
    product.mrp = p.mrp; product.price = p.price;
  }
  if (b.images !== undefined) {
    const images = cleanImages(b.images);
    if (!images || images.length === 0) return bad(res, 'Keep at least one photo');
    dropImageFiles(product.images.filter(u => !images.includes(u)));
    product.images = images;
  }
  res.json({ ok: true, product });
}));

// DELETE /api/admin/products/:id
router.delete('/products/:id', asyncHandler(async (req, res) => {
  const i = db.products.findIndex(p => p.id === req.params.id);
  if (i === -1) return res.status(404).json({ ok: false, error: 'Product not found' });
  const [gone] = db.products.splice(i, 1);
  // Take the item out of every cart and wishlist. Old orders keep their own copy.
  Object.keys(db.carts).forEach(k => { db.carts[k] = db.carts[k].filter(x => x.productId !== gone.id); });
  Object.keys(db.wishlists).forEach(k => { db.wishlists[k] = db.wishlists[k].filter(id => id !== gone.id); });
  dropImageFiles(gone.images);
  res.json({ ok: true });
}));

// POST /api/admin/categories  { name, parentId? }
router.post('/categories', asyncHandler(async (req, res) => {
  const name = text(req.body && req.body.name, 40);
  if (!name) return bad(res, 'Category name is required');
  if (db.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) return res.status(409).json({ ok: false, error: 'That category already exists' });
  const parentId = req.body.parentId || null;
  if (parentId && !db.categories.find(c => c.id === parentId)) return bad(res, 'Parent category not found');
  const category = { id: nextId('c'), name, parentId };
  db.categories.push(category);
  res.status(201).json({ ok: true, category });
}));

// DELETE /api/admin/categories/:id (only when empty)
router.delete('/categories/:id', asyncHandler(async (req, res) => {
  const i = db.categories.findIndex(c => c.id === req.params.id);
  if (i === -1) return res.status(404).json({ ok: false, error: 'Category not found' });
  if (db.products.some(p => p.categoryId === req.params.id) || db.categories.some(c => c.parentId === req.params.id)) {
    return res.status(409).json({ ok: false, error: 'Move or delete the items in this category first' });
  }
  db.categories.splice(i, 1);
  res.json({ ok: true });
}));

// POST /api/admin/images  { dataUrl: "data:image/jpeg;base64,..." } -> { url }
router.post('/images', asyncHandler(async (req, res) => {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec((req.body && req.body.dataUrl) || '');
  if (!m) return bad(res, 'Send a JPEG, PNG or WebP photo');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 700 * 1024) return bad(res, 'Photo is too large (max 700 KB after compression)');
  const magic = buf.subarray(0, 4).toString('hex');
  const ok = (m[1] === 'image/jpeg' && magic.startsWith('ffd8')) || (m[1] === 'image/png' && magic === '89504e47') || (m[1] === 'image/webp' && buf.subarray(0, 4).toString() === 'RIFF');
  if (!ok) return bad(res, 'That file is not a valid photo');
  const id = await saveImage(m[1], buf);
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  res.status(201).json({ ok: true, url: `${proto}://${req.headers.host}/api/images/${id}` });
}));

module.exports = router;
