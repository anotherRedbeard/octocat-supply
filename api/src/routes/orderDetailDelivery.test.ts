import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import orderDetailDeliveryRouter from './orderDetailDelivery';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { runMigrations } from '../db/migrate';
import { errorHandler } from '../utils/errors';

let app: express.Express;

const assignment = {
  orderDetailId: 1,
  deliveryId: 1,
  quantity: 2,
  notes: 'Partial shipment',
};

describe('Order detail delivery API', () => {
  beforeEach(async () => {
    await closeDatabase();
    await getDatabase(true);
    await runMigrations(true);
    const db = await getDatabase();
    await db.run('INSERT INTO suppliers (supplier_id, name) VALUES (?, ?)', [1, 'Delivery Supplier']);
    await db.run('INSERT INTO products (product_id, supplier_id, name, price, sku, unit) VALUES (?, ?, ?, ?, ?, ?)', [1, 1, 'Tape', 4, 'TAPE-001', 'roll']);
    await db.run('INSERT INTO headquarters (headquarters_id, name) VALUES (?, ?)', [1, 'Main HQ']);
    await db.run('INSERT INTO branches (branch_id, headquarters_id, name) VALUES (?, ?, ?)', [1, 1, 'Central Branch']);
    await db.run('INSERT INTO orders (order_id, branch_id, order_date, name) VALUES (?, ?, ?, ?)', [1, 1, '2026-01-01', 'Order']);
    await db.run('INSERT INTO order_details (order_detail_id, order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)', [1, 1, 1, 2, 4]);
    await db.run('INSERT INTO deliveries (delivery_id, supplier_id, delivery_date, name) VALUES (?, ?, ?, ?)', [1, 1, '2026-02-01', 'Delivery']);

    app = express();
    app.use(express.json());
    app.use('/assignments', orderDetailDeliveryRouter);
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('creates an assignment and enforces both foreign keys', async () => {
    const response = await request(app).post('/assignments').send(assignment);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject(assignment);

    const invalid = await request(app).post('/assignments').send({ ...assignment, deliveryId: 999 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lists, gets, updates, and deletes assignments', async () => {
    const created = await request(app).post('/assignments').send(assignment);
    const assignmentId = created.body.orderDetailDeliveryId;

    expect((await request(app).get('/assignments')).body).toHaveLength(1);
    expect((await request(app).get(`/assignments/${assignmentId}`)).body.quantity).toBe(2);

    const update = await request(app).put(`/assignments/${assignmentId}`).send({ quantity: 1 });
    expect(update.status).toBe(200);
    expect(update.body.quantity).toBe(1);

    expect((await request(app).delete(`/assignments/${assignmentId}`)).status).toBe(204);
  });

  it('returns 404 for missing assignments', async () => {
    expect((await request(app).get('/assignments/999')).status).toBe(404);
    expect((await request(app).put('/assignments/999').send({ quantity: 1 })).status).toBe(404);
    expect((await request(app).delete('/assignments/999')).status).toBe(404);
  });
});
