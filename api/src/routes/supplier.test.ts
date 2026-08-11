import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import supplierRouter from './supplier';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { runMigrations } from '../db/migrate';
import { errorHandler } from '../utils/errors';

let app: express.Express;

const supplier = {
  name: 'Northwind Components',
  description: 'Component supplier',
  contactPerson: 'Taylor Reed',
  email: 'taylor@northwind.test',
  phone: '555-2000',
  active: true,
  verified: false,
};

describe('Supplier API', () => {
  beforeEach(async () => {
    await closeDatabase();
    await getDatabase(true);
    await runMigrations(true);
    app = express();
    app.use(express.json());
    app.use('/suppliers', supplierRouter);
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('creates a supplier and returns its generated ID', async () => {
    const response = await request(app).post('/suppliers').send(supplier);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject(supplier);
    expect(response.body.supplierId).toBeTypeOf('number');
  });

  it('lists, gets, updates, and deletes suppliers', async () => {
    const created = await request(app).post('/suppliers').send(supplier);
    const supplierId = created.body.supplierId;

    expect((await request(app).get('/suppliers')).body).toHaveLength(1);
    expect((await request(app).get(`/suppliers/${supplierId}`)).body.name).toBe(supplier.name);

    const update = await request(app)
      .put(`/suppliers/${supplierId}`)
      .send({ name: 'Updated Components', active: false, verified: true });
    expect(update.status).toBe(200);
    expect(update.body).toMatchObject({ name: 'Updated Components', active: false, verified: true });

    const status = await request(app).get(`/suppliers/${supplierId}/status`);
    expect(status.status).toBe(200);
    expect(status.body).toEqual({ status: 'PENDING' });

    expect((await request(app).delete(`/suppliers/${supplierId}`)).status).toBe(204);
  });

  it('reports approved status for an active supplier', async () => {
    const created = await request(app).post('/suppliers').send({ ...supplier, active: true });

    const response = await request(app).get(`/suppliers/${created.body.supplierId}/status`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'APPROVED' });
  });

  it('returns 404 for missing suppliers and status lookups', async () => {
    expect((await request(app).get('/suppliers/999')).status).toBe(404);
    expect((await request(app).get('/suppliers/999/status')).status).toBe(404);
    expect((await request(app).put('/suppliers/999').send({ name: 'Missing' })).status).toBe(404);
    expect((await request(app).delete('/suppliers/999')).status).toBe(404);
  });
});
