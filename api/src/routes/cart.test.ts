import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import cartRouter from './cart';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { runMigrations } from '../db/migrate';
import { errorHandler } from '../utils/errors';

let app: express.Express;

describe('Cart API', () => {
  beforeEach(async () => {
    await closeDatabase();
    const db = await getDatabase(true);
    await runMigrations(true);

    await db.run(
      'INSERT INTO suppliers (supplier_id, name, description, contact_person, email, phone, active, verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [1, 'Acme Supplies', 'Packaging supplier', 'Alex Smith', 'alex@acme.test', '555-1000', 1, 1],
    );

    await db.run(
      'INSERT INTO products (product_id, supplier_id, name, description, price, sku, unit, img_name, discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [1, 1, 'Packing Tape', 'Heavy-duty tape', 4.5, 'TAPE-001', 'roll', 'tape.png', 0],
    );

    await db.run(
      'INSERT INTO products (product_id, supplier_id, name, description, price, sku, unit, img_name, discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [2, 1, 'Shipping Labels', 'Thermal labels', 2.25, 'LABEL-001', 'sheet', 'labels.png', 0],
    );

    app = express();
    app.use(express.json());
    app.use('/cart', cartRouter);
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('rejects requests without X-Cart-Key header', async () => {
    const response = await request(app).get('/cart');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns empty cart for an unseen key', async () => {
    const response = await request(app).get('/cart').set('X-Cart-Key', 'cart-alpha');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      cartKey: 'cart-alpha',
      items: [],
      itemCount: 0,
      subtotal: 0,
    });
  });

  it('adds items and increments an existing line', async () => {
    const first = await request(app)
      .post('/cart/items')
      .set('X-Cart-Key', 'cart-alpha')
      .send({ productId: 1, quantity: 2 });

    expect(first.status).toBe(200);
    expect(first.body.itemCount).toBe(2);
    expect(first.body.subtotal).toBeCloseTo(9.0, 5);

    const second = await request(app)
      .post('/cart/items')
      .set('X-Cart-Key', 'cart-alpha')
      .send({ productId: 1, quantity: 3 });

    expect(second.status).toBe(200);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.items[0].quantity).toBe(5);
    expect(second.body.itemCount).toBe(5);
    expect(second.body.subtotal).toBeCloseTo(22.5, 5);
  });

  it('returns 404 when adding an unknown product', async () => {
    const response = await request(app)
      .post('/cart/items')
      .set('X-Cart-Key', 'cart-alpha')
      .send({ productId: 999, quantity: 1 });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for invalid quantity', async () => {
    const response = await request(app)
      .post('/cart/items')
      .set('X-Cart-Key', 'cart-alpha')
      .send({ productId: 1, quantity: 0 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('removes items by product id and is idempotent', async () => {
    await request(app)
      .post('/cart/items')
      .set('X-Cart-Key', 'cart-alpha')
      .send({ productId: 1, quantity: 1 });

    const removed = await request(app)
      .delete('/cart/items/1')
      .set('X-Cart-Key', 'cart-alpha');

    expect(removed.status).toBe(200);
    expect(removed.body.items).toEqual([]);
    expect(removed.body.itemCount).toBe(0);

    const removedAgain = await request(app)
      .delete('/cart/items/1')
      .set('X-Cart-Key', 'cart-alpha');

    expect(removedAgain.status).toBe(200);
    expect(removedAgain.body.items).toEqual([]);
    expect(removedAgain.body.itemCount).toBe(0);
  });

  it('clears an entire cart and returns an empty cart', async () => {
    await request(app)
      .post('/cart/items')
      .set('X-Cart-Key', 'cart-alpha')
      .send({ productId: 1, quantity: 2 });

    await request(app)
      .post('/cart/items')
      .set('X-Cart-Key', 'cart-alpha')
      .send({ productId: 2, quantity: 1 });

    const cleared = await request(app).delete('/cart').set('X-Cart-Key', 'cart-alpha');

    expect(cleared.status).toBe(200);
    expect(cleared.body).toEqual({
      cartKey: 'cart-alpha',
      items: [],
      itemCount: 0,
      subtotal: 0,
    });
  });

  it('isolates carts by cart key', async () => {
    await request(app)
      .post('/cart/items')
      .set('X-Cart-Key', 'cart-alpha')
      .send({ productId: 1, quantity: 2 });

    await request(app)
      .post('/cart/items')
      .set('X-Cart-Key', 'cart-beta')
      .send({ productId: 2, quantity: 3 });

    const alpha = await request(app).get('/cart').set('X-Cart-Key', 'cart-alpha');
    const beta = await request(app).get('/cart').set('X-Cart-Key', 'cart-beta');

    expect(alpha.body.itemCount).toBe(2);
    expect(alpha.body.items[0].productId).toBe(1);
    expect(beta.body.itemCount).toBe(3);
    expect(beta.body.items[0].productId).toBe(2);
  });

  it('ignores body-supplied cartKey and uses header identity', async () => {
    await request(app)
      .post('/cart/items')
      .set('X-Cart-Key', 'header-key')
      .send({ productId: 1, quantity: 1, cartKey: 'body-key' });

    const headerCart = await request(app).get('/cart').set('X-Cart-Key', 'header-key');
    const bodyCart = await request(app).get('/cart').set('X-Cart-Key', 'body-key');

    expect(headerCart.body.itemCount).toBe(1);
    expect(bodyCart.body.itemCount).toBe(0);
  });
});
