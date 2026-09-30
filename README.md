# Averoxa E-commerce API

Amazon-style REST API built with Node.js + Express. Data is stored **in-memory**
(see `data/store.js`) so you can run it instantly with no database setup —
swap in MongoDB/Postgres later without touching the route files.

## Run it

```bash
npm install
npm start
```

Server starts at `http://localhost:4000`.
Open `api-docs.html` in your browser (or host it) for full endpoint documentation.

## Demo accounts (seeded)

| Email               | Password    | Role   |
|---------------------|-------------|--------|
| buyer@example.com   | password123 | buyer  |
| seller@example.com  | password123 | seller |

## Quick test

```bash
# Log in
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"buyer@example.com","password":"password123"}'

# Copy the "token" from the response, then:
curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer PASTE_TOKEN_HERE"
```

## Modules

- **Auth** — register, login, refresh, logout, me
- **Users** — profile, address book
- **Categories** — category tree, products per category
- **Products** — catalog browsing + seller-only create/update/delete
- **Search** — keyword + filters (price, rating, category) + sort
- **Cart** — add/update/remove items, view totals
- **Wishlist** — save/remove products for later
- **Orders** — checkout, history, cancel, tracking
- **Reviews** — create/edit/delete, auto-recalculates product rating
- **Payments** — create-intent + webhook (wire to Stripe/Razorpay for real payments)
- **Seller Panel** — onboarding, own catalog, own orders, analytics, inventory
- **Recommendations** — for-you, similar items, trending

## Notes for production

- Replace `data/store.js` with a real database layer.
- Move `JWT_SECRET` in `middleware/auth.js` into an environment variable.
- Verify the payment gateway's webhook signature in `routes/payments.routes.js`
  before trusting `req.body` (currently unauthenticated for demo simplicity).
- Add request validation (e.g. `zod` or `joi`) and rate limiting before going live.
