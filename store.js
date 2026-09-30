/**
 * In-memory "database" for the demo API.
 * Swap this out for MongoDB/Postgres/MySQL in production —
 * every route file only touches data through the functions below,
 * so the storage layer can be replaced without touching route logic.
 */
const { v4: uuid } = require('uuid');

const db = {
  users: [
    { id: 'u1', name: 'Demo Buyer', email: 'buyer@example.com', password: 'password123', role: 'buyer', addresses: [] },
    { id: 'u2', name: 'Demo Seller', email: 'seller@example.com', password: 'password123', role: 'seller', addresses: [] }
  ],
  sellers: [
    { id: 's1', userId: 'u2', shopName: 'Averoxa Electronics', rating: 4.6, createdAt: new Date().toISOString() }
  ],
  categories: [
    { id: 'c1', name: 'Electronics', parentId: null },
    { id: 'c2', name: 'Mobiles', parentId: 'c1' },
    { id: 'c3', name: 'Laptops', parentId: 'c1' },
    { id: 'c4', name: 'Home & Kitchen', parentId: null }
  ],
  products: [
    {
      id: 'p1', sellerId: 's1', title: 'Averoxa Buds Pro', categoryId: 'c1',
      price: 2499, mrp: 3499, stock: 120, rating: 4.3, ratingCount: 812,
      images: ['https://picsum.photos/seed/p1/400'], description: 'Wireless earbuds with active noise cancellation.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'p2', sellerId: 's1', title: 'Averoxa Phone X12', categoryId: 'c2',
      price: 18999, mrp: 21999, stock: 45, rating: 4.1, ratingCount: 233,
      images: ['https://picsum.photos/seed/p2/400'], description: '6.5" AMOLED display, 5000mAh battery.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'p3', sellerId: 's1', title: 'Averoxa Book Slim 14"', categoryId: 'c3',
      price: 54999, mrp: 59999, stock: 18, rating: 4.5, ratingCount: 97,
      images: ['https://picsum.photos/seed/p3/400'], description: 'Ultra-light laptop, 16GB RAM, 512GB SSD.',
      createdAt: new Date().toISOString()
    }
  ],
  reviews: [
    { id: 'r1', productId: 'p1', userId: 'u1', rating: 5, title: 'Great sound', body: 'Battery life is excellent.', createdAt: new Date().toISOString() }
  ],
  carts: {
    // userId -> [{ productId, qty }]
    u1: []
  },
  wishlists: {
    // userId -> [productId]
    u1: []
  },
  orders: [],
  payments: []
};

function nextId(prefix) { return prefix + '_' + uuid().slice(0, 8); }

module.exports = { db, nextId };
