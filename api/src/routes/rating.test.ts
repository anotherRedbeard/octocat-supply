import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { runMigrations } from '../db/migrate';
import { errorHandler } from '../utils/errors';
import ratingRouter from './rating';
import productRouter from './product';

let app: express.Express;

const ownerToken = 'browser-token-product-one';

async function insertTestData(): Promise<void> {
  const db = await getDatabase(true);
  await db.run(
    'INSERT INTO suppliers (supplier_id, name, description, contact_person, email, phone, active, verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [1, 'Acme Supplies', 'Packaging supplier', 'Alex Smith', 'alex@acme.test', '555-1000', 1, 1],
  );
  await db.run(
    'INSERT INTO products (product_id, supplier_id, name, description, price, sku, unit, img_name, discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [1, 1, 'Packing Tape', 'Heavy-duty tape', 4.5, 'TAPE-001', 'roll', 'tape.png', 0],
  );
}

describe('Rating API', () => {
  beforeEach(async () => {
    await closeDatabase();
    await getDatabase(true);
    await runMigrations(true);
    await insertTestData();

    app = express();
    app.use(express.json());
    app.use('/api', ratingRouter);
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('returns an empty rating list and summary for a product', async () => {
    const response = await request(app).get('/api/products/1/ratings');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ratings: [],
      summary: {
        averageScore: 0,
        ratingCount: 0,
        distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      },
      ownedRating: null,
    });
  });

  it('creates a rating and returns the updated summary', async () => {
    const response = await request(app)
      .post('/api/products/1/ratings')
      .set('X-Rating-Token', ownerToken)
      .send({ score: 5 });

    expect(response.status).toBe(201);
    expect(response.body.rating).toMatchObject({ productId: 1, score: 5 });
    expect(response.body.rating).not.toHaveProperty('ownershipToken');
    expect(response.body.summary).toMatchObject({ averageScore: 5, ratingCount: 1 });
  });

  it('returns the browser-owned rating only when the matching token is supplied', async () => {
    await request(app)
      .post('/api/products/1/ratings')
      .set('X-Rating-Token', ownerToken)
      .send({ score: 4 });

    const owned = await request(app)
      .get('/api/products/1/ratings')
      .set('X-Rating-Token', ownerToken);
    const other = await request(app)
      .get('/api/products/1/ratings')
      .set('X-Rating-Token', 'browser-token-product-two');

    expect(owned.body.ownedRating.score).toBe(4);
    expect(other.body.ownedRating).toBeNull();
  });

  it('rejects missing or invalid rating tokens and scores', async () => {
    const missingToken = await request(app)
      .post('/api/products/1/ratings')
      .send({ score: 5 });
    const invalidScore = await request(app)
      .post('/api/products/1/ratings')
      .set('X-Rating-Token', ownerToken)
      .send({ score: 6 });

    expect(missingToken.status).toBe(400);
    expect(missingToken.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalidScore.status).toBe(400);
    expect(invalidScore.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid route IDs and missing products', async () => {
    const invalidId = await request(app).get('/api/products/not-an-id/ratings');
    const missingProduct = await request(app).get('/api/products/999/ratings');

    expect(invalidId.status).toBe(400);
    expect(missingProduct.status).toBe(404);
    expect(missingProduct.body.error.code).toBe('NOT_FOUND');
  });

  it('prevents duplicate ratings from the same browser and product', async () => {
    await request(app)
      .post('/api/products/1/ratings')
      .set('X-Rating-Token', ownerToken)
      .send({ score: 5 });

    const duplicate = await request(app)
      .post('/api/products/1/ratings')
      .set('X-Rating-Token', ownerToken)
      .send({ score: 3 });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('CONFLICT');
  });

  it('updates only the rating owned by the supplied token', async () => {
    const created = await request(app)
      .post('/api/products/1/ratings')
      .set('X-Rating-Token', ownerToken)
      .send({ score: 3 });

    const wrongOwner = await request(app)
      .put(`/api/ratings/${created.body.rating.ratingId}`)
      .set('X-Rating-Token', 'browser-token-product-two')
      .send({ score: 5 });
    const updated = await request(app)
      .put(`/api/ratings/${created.body.rating.ratingId}`)
      .set('X-Rating-Token', ownerToken)
      .send({ score: 5 });

    expect(wrongOwner.status).toBe(409);
    expect(updated.status).toBe(200);
    expect(updated.body.rating.score).toBe(5);
    expect(updated.body.summary.averageScore).toBe(5);
  });

  it('deletes only the rating owned by the supplied token', async () => {
    const created = await request(app)
      .post('/api/products/1/ratings')
      .set('X-Rating-Token', ownerToken)
      .send({ score: 4 });

    const wrongOwner = await request(app)
      .delete(`/api/ratings/${created.body.rating.ratingId}`)
      .set('X-Rating-Token', 'browser-token-product-two');
    const deleted = await request(app)
      .delete(`/api/ratings/${created.body.rating.ratingId}`)
      .set('X-Rating-Token', ownerToken);
    const list = await request(app).get('/api/products/1/ratings');

    expect(wrongOwner.status).toBe(409);
    expect(deleted.status).toBe(204);
    expect(list.body.ratings).toEqual([]);
  });

  it('preserves existing product routes when rating routes are mounted', async () => {
    const productRouteApp = express();
    productRouteApp.use(express.json());
    productRouteApp.use('/api/products', productRouter);
    productRouteApp.use('/api', ratingRouter);
    productRouteApp.use(errorHandler);

    const response = await request(productRouteApp).get('/api/products/1');
    expect(response.status).toBe(200);
  });
});
