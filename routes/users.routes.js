const router = require('express').Router();
const { db, nextId } = require('../data/store');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/users/me
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const { id, name, email, role, addresses } = req.user;
  res.json({ ok: true, user: { id, name, email, role, addresses } });
}));

// PUT /api/users/me
router.put('/me', requireAuth, asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  if (name) req.user.name = name;
  if (email) req.user.email = email;
  res.json({ ok: true, user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role } });
}));

// GET /api/users/me/addresses
router.get('/me/addresses', requireAuth, asyncHandler(async (req, res) => {
  res.json({ ok: true, addresses: req.user.addresses });
}));

// POST /api/users/me/addresses
router.post('/me/addresses', requireAuth, asyncHandler(async (req, res) => {
  const { line1, line2, city, state, pincode, phone, isDefault } = req.body;
  if (!line1 || !city || !state || !pincode || !phone) {
    return res.status(400).json({ ok: false, error: 'line1, city, state, pincode, phone are required' });
  }
  const address = { id: nextId('addr'), line1, line2: line2 || '', city, state, pincode, phone, isDefault: !!isDefault };
  if (address.isDefault) req.user.addresses.forEach(a => (a.isDefault = false));
  req.user.addresses.push(address);
  res.status(201).json({ ok: true, address });
}));

// DELETE /api/users/me/addresses/:addressId
router.delete('/me/addresses/:addressId', requireAuth, asyncHandler(async (req, res) => {
  const before = req.user.addresses.length;
  req.user.addresses = req.user.addresses.filter(a => a.id !== req.params.addressId);
  if (req.user.addresses.length === before) return res.status(404).json({ ok: false, error: 'Address not found' });
  res.json({ ok: true });
}));

module.exports = router;
