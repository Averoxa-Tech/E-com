const router = require('express').Router();
const { db, nextId } = require('../data/store');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// POST /api/payments/create-intent  { orderId, method }
// In production, this calls Stripe/Razorpay/etc. and returns their client secret.
router.post('/create-intent', requireAuth, asyncHandler(async (req, res) => {
  const { orderId, method } = req.body;
  const order = db.orders.find(o => o.id === orderId && o.userId === req.user.id);
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });

  const payment = {
    id: nextId('pay'), orderId, userId: req.user.id, amount: order.total,
    method: method || 'card', status: 'requires_confirmation', createdAt: new Date().toISOString()
  };
  db.payments.push(payment);
  res.status(201).json({ ok: true, payment, clientSecret: `demo_secret_${payment.id}` });
}));

// POST /api/payments/webhook — called by the payment gateway, not by the client.
// No auth: gateways sign these with a separate secret (verify req.headers['x-signature'] in production).
router.post('/webhook', asyncHandler(async (req, res) => {
  const { paymentId, status } = req.body; // status: 'succeeded' | 'failed'
  const payment = db.payments.find(p => p.id === paymentId);
  if (!payment) return res.status(404).json({ ok: false, error: 'Payment not found' });

  payment.status = status === 'succeeded' ? 'succeeded' : 'failed';
  const order = db.orders.find(o => o.id === payment.orderId);
  if (order) order.paymentStatus = payment.status === 'succeeded' ? 'paid' : 'failed';

  res.json({ ok: true, received: true });
}));

// GET /api/payments/:id
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const payment = db.payments.find(p => p.id === req.params.id && p.userId === req.user.id);
  if (!payment) return res.status(404).json({ ok: false, error: 'Payment not found' });
  res.json({ ok: true, payment });
}));

module.exports = router;
