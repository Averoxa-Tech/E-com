/**
 * Admin helpers:
 *  - ensureAdmin(): creates/updates the admin login from the ADMIN_EMAIL and ADMIN_PASSWORD env vars.
 *  - image storage: product photos go in their own PostgreSQL table (ax_images), or in memory without a database.
 */
const crypto = require('crypto');
const { db, nextId, hashPassword, verifyPassword, persist } = require('./store');

const pool = process.env.DATABASE_URL ? require('./db') : null;
const memory = new Map();

async function initImages() {
  if (!pool) return;
  await pool.query('CREATE TABLE IF NOT EXISTS ax_images (id TEXT PRIMARY KEY, mime TEXT NOT NULL, data BYTEA NOT NULL, created_at TIMESTAMPTZ DEFAULT now())');
}

async function saveImage(mime, buffer) {
  const id = crypto.randomBytes(12).toString('hex');
  if (pool) await pool.query('INSERT INTO ax_images (id, mime, data) VALUES ($1, $2, $3)', [id, mime, buffer]);
  else memory.set(id, { mime, data: buffer });
  return id;
}

async function getImage(id) {
  if (pool) {
    const r = await pool.query('SELECT mime, data FROM ax_images WHERE id = $1', [id]);
    return r.rows[0] || null;
  }
  return memory.get(id) || null;
}

async function deleteImage(id) {
  if (pool) await pool.query('DELETE FROM ax_images WHERE id = $1', [id]);
  else memory.delete(id);
}

function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) { console.warn('ADMIN_EMAIL / ADMIN_PASSWORD are not set: the admin panel is disabled.'); return; }
  if (password.length < 8) { console.warn('ADMIN_PASSWORD must be at least 8 characters: the admin panel is disabled.'); return; }

  let user = db.users.find(u => String(u.email).toLowerCase() === email);
  if (!user) {
    user = { id: nextId('u'), name: 'Admin', email, password: hashPassword(password), role: 'admin', addresses: [] };
    db.users.push(user);
    db.carts[user.id] = [];
    db.wishlists[user.id] = [];
  } else {
    user.role = 'admin';
    if (!verifyPassword(user.password, password)) user.password = hashPassword(password);
  }
  persist();
  console.log('Admin account is ready.');
}

module.exports = { ensureAdmin, initImages, saveImage, getImage, deleteImage };