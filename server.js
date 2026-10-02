const express = require('express');
const cors = require('cors');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { init, persist, save } = require('./data/store');
const { ensureAdmin, initImages, getImage } = require('./data/admin-setup');

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use('/api/admin/images', express.json({ limit: '1mb' })); // photo uploads are bigger than the default 100 KB
app.use(express.json());

// Slow down password guessing: max 20 login attempts per IP per 15 minutes.
const attempts = new Map();
app.use('/api/auth/login', (req, res, next) => {
  if (req.method !== 'POST') return next();
  const now = Date.now();
  let a = attempts.get(req.ip);
  if (!a || a.reset < now) { a = { n: 0, reset: now + 15 * 60 * 1000 }; attempts.set(req.ip, a); }
  if (++a.n > 20) return res.status(429).json({ ok: false, error: 'Too many login attempts. Try again in 15 minutes.' });
  next();
});

// Products and sellers are changed only through the admin panel (/api/admin), not by seller accounts.
const LOCKED = /^\/api\/(products(\/[^/]+)?|sellers(\/.*)?)\/?$/;
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && LOCKED.test(req.path)) {
    return res.status(403).json({ ok: false, error: 'Products are managed from the admin panel' });
  }
  next();
});

// Save data to PostgreSQL after every write request.
app.use((req, res, next) => {
  if (req.method !== 'GET') res.on('finish', persist);
  next();
});

// Simple request log — replace with morgan/winston in production.
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

app.get('/', (req, res) => res.json({ ok: true, service: 'Averoxa E-commerce API', docs: '/api-docs.html' }));
app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// Product photos uploaded from the admin panel.
app.get('/api/images/:id', async (req, res, next) => {
  try {
    if (!/^[a-f0-9]{24}$/.test(req.params.id)) return res.status(404).end();
    const img = await getImage(req.params.id);
    if (!img) return res.status(404).end();
    res.set({ 'Content-Type': img.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'Cross-Origin-Resource-Policy': 'cross-origin' });
    res.send(img.data);
  } catch (e) { next(e); }
});

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/categories', require('./routes/categories.routes'));
app.use('/api/products', require('./routes/products.routes'));
app.use('/api/search', require('./routes/search.routes'));
app.use('/api/cart', require('./routes/cart.routes'));
app.use('/api/wishlist', require('./routes/wishlist.routes'));
app.use('/api/orders', require('./routes/orders.routes'));
app.use('/api/payments', require('./routes/payments.routes'));
app.use('/api/sellers', require('./routes/sellers.routes'));
app.use('/api/recommendations', require('./routes/recommendations.routes'));
app.use('/api', require('./routes/reviews.routes')); // exposes /api/products/:id/reviews and /api/reviews/:id

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
if (!process.env.JWT_SECRET) console.warn('WARNING: JWT_SECRET is not set. Set it in your environment before going live.');

init()
  .catch(e => console.error('Database init failed, running in memory:', e.message))
  .then(() => initImages().catch(e => console.error('Photo storage setup failed:', e.message)))
  .then(() => ensureAdmin())
  .finally(() => app.listen(PORT, () => console.log(`Averoxa E-commerce API running on port ${PORT}`)));

process.on('SIGTERM', async () => { try { await save(); } catch (e) {} process.exit(0); });

module.exports = app;
