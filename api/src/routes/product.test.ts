import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import productRouter from './product';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { runMigrations } from '../db/migrate';
import { errorHandler } from '../utils/errors';

let app: express.Express;

const product = {
  supplierId: 1,
  name: 'Packing Tape',
  description: 'Heavy-duty tape',
  price: 4.5,
  sku: 'TAPE-001',
  unit: 'roll',
  imgName: 'tape.png',
  discount: 0.1,
};

describe('Product API', () => {
  beforeEach(async () => {
    await closeDatabase();
    await getDatabase(true);
    await runMigrations(true);
    const db = await getDatabase();
    await db.run(
      'INSERT INTO suppliers (supplier_id, name, description, contact_person, email, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [1, 'Acme Supplies', 'Packaging supplier', 'Alex Smith', 'alex@acme.test', '555-1000'],
    );

    app = express();
    app.use(express.json());
    app.use('/products', productRouter);
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('creates a product and maps database fields to camelCase', async () => {
    const response = await request(app).post('/products').send(product);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject(product);
    expect(response.body.productId).toBeTypeOf('number');
  });

  it('returns a validation error when the supplier foreign key is invalid', async () => {
    const response = await request(app).post('/products').send({ ...product, supplierId: 999 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lists, gets, updates, and deletes products', async () => {
    const created = await request(app).post('/products').send(product);
    const productId = created.body.productId;

    const list = await request(app).get('/products');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const get = await request(app).get(`/products/${productId}`);
    expect(get.status).toBe(200);
    expect(get.body.productId).toBe(productId);

    const update = await request(app)
      .put(`/products/${productId}`)
      .send({ name: 'Premium Packing Tape', price: 5.25 });
    expect(update.status).toBe(200);
    expect(update.body).toMatchObject({ name: 'Premium Packing Tape', price: 5.25 });

    const deleted = await request(app).delete(`/products/${productId}`);
    expect(deleted.status).toBe(204);
    expect((await request(app).get(`/products/${productId}`)).status).toBe(404);
  });

  it('returns 404 for missing products on get, update, and delete', async () => {
    expect((await request(app).get('/products/999')).status).toBe(404);
    expect((await request(app).put('/products/999').send({ name: 'Missing' })).status).toBe(404);
    expect((await request(app).delete('/products/999')).status).toBe(404);
  });
});
