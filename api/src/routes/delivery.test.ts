import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import deliveryRouter from './delivery';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { runMigrations } from '../db/migrate';
import { errorHandler } from '../utils/errors';

let app: express.Express;

const delivery = {
  supplierId: 1,
  deliveryDate: '2026-02-01T12:00:00.000Z',
  name: 'February delivery',
  description: 'Packaging materials',
  status: 'pending',
};

describe('Delivery API', () => {
  beforeEach(async () => {
    await closeDatabase();
    await getDatabase(true);
    await runMigrations(true);
    const db = await getDatabase();
    await db.run('INSERT INTO suppliers (supplier_id, name) VALUES (?, ?)', [1, 'Delivery Supplier']);

    app = express();
    app.use(express.json());
    app.use('/deliveries', deliveryRouter);
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('creates a delivery and maps its persisted values', async () => {
    const response = await request(app).post('/deliveries').send(delivery);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject(delivery);
    expect(response.body.deliveryId).toBeTypeOf('number');
  });

  it('lists, gets, updates, and deletes deliveries', async () => {
    const created = await request(app).post('/deliveries').send(delivery);
    const deliveryId = created.body.deliveryId;

    expect((await request(app).get('/deliveries')).body).toHaveLength(1);
    expect((await request(app).get(`/deliveries/${deliveryId}`)).body.deliveryId).toBe(deliveryId);

    const status = await request(app)
      .put(`/deliveries/${deliveryId}/status`)
      .send({ status: 'delivered' });
    expect(status.status).toBe(200);
    expect(status.body.status).toBe('delivered');

    const update = await request(app)
      .put(`/deliveries/${deliveryId}`)
      .send({ description: 'Received in full' });
    expect(update.status).toBe(200);
    expect(update.body.description).toBe('Received in full');

    expect((await request(app).delete(`/deliveries/${deliveryId}`)).status).toBe(204);
  });

  it('returns a validation error for an invalid supplier and 404 for missing deliveries', async () => {
    const invalid = await request(app).post('/deliveries').send({ ...delivery, supplierId: 999 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    expect((await request(app).get('/deliveries/999')).status).toBe(404);
    expect((await request(app).put('/deliveries/999').send({ status: 'failed' })).status).toBe(404);
    expect((await request(app).put('/deliveries/999/status').send({ status: 'failed' })).status).toBe(404);
    expect((await request(app).delete('/deliveries/999')).status).toBe(404);
  });
});
