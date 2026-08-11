import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import orderDetailRouter from './orderDetail';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { runMigrations } from '../db/migrate';
import { errorHandler } from '../utils/errors';

let app: express.Express;

const orderDetail = {
  orderId: 1,
  productId: 1,
  quantity: 3,
  unitPrice: 4.5,
  notes: 'Pack separately',
};

describe('Order detail API', () => {
  beforeEach(async () => {
    await closeDatabase();
    await getDatabase(true);
    await runMigrations(true);
    const db = await getDatabase();
    await db.run('INSERT INTO suppliers (supplier_id, name) VALUES (?, ?)', [1, 'Product Supplier']);
    await db.run(
      'INSERT INTO products (product_id, supplier_id, name, price, sku, unit) VALUES (?, ?, ?, ?, ?, ?)',
      [1, 1, 'Packing Tape', 4.5, 'TAPE-001', 'roll'],
    );
    await db.run('INSERT INTO headquarters (headquarters_id, name) VALUES (?, ?)', [1, 'Main HQ']);
    await db.run(
      'INSERT INTO branches (branch_id, headquarters_id, name) VALUES (?, ?, ?)',
      [1, 1, 'Central Branch'],
    );
    await db.run(
      'INSERT INTO orders (order_id, branch_id, order_date, name, description) VALUES (?, ?, ?, ?, ?)',
      [1, 1, '2026-01-15T10:00:00.000Z', 'January order', 'Stock replenishment'],
    );

    app = express();
    app.use(express.json());
    app.use('/order-details', orderDetailRouter);
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('creates an order detail and rejects invalid order references', async () => {
    const response = await request(app).post('/order-details').send(orderDetail);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject(orderDetail);

    const invalid = await request(app).post('/order-details').send({ ...orderDetail, productId: 999 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lists, gets, updates, and deletes order details', async () => {
    const created = await request(app).post('/order-details').send(orderDetail);
    const orderDetailId = created.body.orderDetailId;

    expect((await request(app).get('/order-details')).body).toHaveLength(1);
    expect((await request(app).get(`/order-details/${orderDetailId}`)).body.quantity).toBe(3);

    const update = await request(app)
      .put(`/order-details/${orderDetailId}`)
      .send({ quantity: 5, notes: 'Updated quantity' });
    expect(update.status).toBe(200);
    expect(update.body).toMatchObject({ quantity: 5, notes: 'Updated quantity' });

    expect((await request(app).delete(`/order-details/${orderDetailId}`)).status).toBe(204);
  });

  it('returns 404 for missing order details', async () => {
    expect((await request(app).get('/order-details/999')).status).toBe(404);
    expect((await request(app).put('/order-details/999').send({ quantity: 1 })).status).toBe(404);
    expect((await request(app).delete('/order-details/999')).status).toBe(404);
  });
});
