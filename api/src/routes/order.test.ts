import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import orderRouter from './order';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { runMigrations } from '../db/migrate';
import { errorHandler } from '../utils/errors';

let app: express.Express;

const order = {
  branchId: 1,
  orderDate: '2026-01-15T10:00:00.000Z',
  name: 'January replenishment',
  description: 'Monthly stock order',
  status: 'pending',
};

describe('Order API', () => {
  beforeEach(async () => {
    await closeDatabase();
    await getDatabase(true);
    await runMigrations(true);
    const db = await getDatabase();
    await db.run('INSERT INTO headquarters (headquarters_id, name) VALUES (?, ?)', [1, 'Main HQ']);
    await db.run(
      'INSERT INTO branches (branch_id, headquarters_id, name) VALUES (?, ?, ?)',
      [1, 1, 'Central Branch'],
    );

    app = express();
    app.use(express.json());
    app.use('/orders', orderRouter);
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('creates an order and rejects an invalid branch foreign key', async () => {
    const response = await request(app).post('/orders').send(order);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject(order);

    const invalid = await request(app).post('/orders').send({ ...order, branchId: 999 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lists, gets, updates, and deletes orders', async () => {
    const created = await request(app).post('/orders').send(order);
    const orderId = created.body.orderId;

    const list = await request(app).get('/orders');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const get = await request(app).get(`/orders/${orderId}`);
    expect(get.status).toBe(200);
    expect(get.body.orderId).toBe(orderId);

    const update = await request(app)
      .put(`/orders/${orderId}`)
      .send({ status: 'processing', description: 'Updated order' });
    expect(update.status).toBe(200);
    expect(update.body).toMatchObject({ status: 'processing', description: 'Updated order' });

    expect((await request(app).delete(`/orders/${orderId}`)).status).toBe(204);
  });

  it('returns 404 for missing orders on get, update, and delete', async () => {
    expect((await request(app).get('/orders/999')).status).toBe(404);
    expect((await request(app).put('/orders/999').send({ status: 'cancelled' })).status).toBe(404);
    expect((await request(app).delete('/orders/999')).status).toBe(404);
  });
});
