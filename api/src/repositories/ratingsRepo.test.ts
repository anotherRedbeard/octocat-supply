import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../db/migrate';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { RatingsRepository } from './ratingsRepo';

describe('RatingsRepository', () => {
  let repository: RatingsRepository;

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

    repository = new RatingsRepository(db);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('returns an empty list and zero summary for a product with no ratings', async () => {
    await expect(repository.findByProductId(1)).resolves.toEqual([]);
    await expect(repository.findSummaryByProductId(1)).resolves.toEqual({
      averageScore: 0,
      ratingCount: 0,
      distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    });
  });

  it('creates and lists a rating without exposing its ownership token', async () => {
    const rating = await repository.create({
      productId: 1,
      score: 5,
      ownershipToken: 'browser-token-product-one',
    });

    expect(rating).toMatchObject({ ratingId: 1, productId: 1, score: 5 });
    expect(rating).not.toHaveProperty('ownershipToken');
    expect(rating.createdAt).toEqual(expect.any(String));
    expect(rating.updatedAt).toEqual(expect.any(String));
    await expect(repository.findByProductId(1)).resolves.toHaveLength(1);
  });

  it('calculates the average, count, and score distribution on the server', async () => {
    await repository.create({ productId: 1, score: 5, ownershipToken: 'browser-token-product-one' });
    await repository.create({ productId: 1, score: 3, ownershipToken: 'browser-token-product-two' });
    await repository.create({ productId: 1, score: 4, ownershipToken: 'browser-token-product-three' });

    await expect(repository.findSummaryByProductId(1)).resolves.toEqual({
      averageScore: 4,
      ratingCount: 3,
      distribution: { '1': 0, '2': 0, '3': 1, '4': 1, '5': 1 },
    });
  });

  it('rejects scores outside the one-to-five range', async () => {
    await expect(repository.create({ productId: 1, score: 0, ownershipToken: 'browser-token-product-one' })).rejects.toThrow(ValidationError);
    await expect(repository.create({ productId: 1, score: 6, ownershipToken: 'browser-token-product-one' })).rejects.toThrow(ValidationError);
    await expect(repository.create({ productId: 1, score: 2.5, ownershipToken: 'browser-token-product-one' })).rejects.toThrow(ValidationError);
  });

  it('rejects invalid ownership tokens', async () => {
    await expect(repository.create({ productId: 1, score: 5, ownershipToken: 'short' })).rejects.toThrow(ValidationError);
  });

  it('rejects ratings for a missing product', async () => {
    await expect(repository.create({ productId: 999, score: 5, ownershipToken: 'browser-token-missing-product' })).rejects.toThrow(NotFoundError);
  });

  it('allows one active rating per browser and product', async () => {
    const input = { productId: 1, score: 5, ownershipToken: 'browser-token-product-one' };
    await repository.create(input);

    await expect(repository.create({ ...input, score: 4 })).rejects.toThrow(ConflictError);
  });

  it('finds a browser-owned rating without exposing its token', async () => {
    const created = await repository.create({
      productId: 1,
      score: 4,
      ownershipToken: 'browser-token-product-one',
    });

    await expect(repository.findOwnedByProductId(1, 'browser-token-product-one')).resolves.toEqual(created);
    await expect(repository.findOwnedByProductId(1, 'browser-token-product-two')).resolves.toBeNull();
  });

  it('updates only a rating owned by the provided browser token', async () => {
    const created = await repository.create({
      productId: 1,
      score: 3,
      ownershipToken: 'browser-token-product-one',
    });

    await expect(repository.update(created.ratingId, {
      score: 5,
      ownershipToken: 'browser-token-product-two',
    })).rejects.toThrow(ConflictError);

    const updated = await repository.update(created.ratingId, {
      score: 5,
      ownershipToken: 'browser-token-product-one',
    });
    expect(updated.score).toBe(5);
  });

  it('deletes only a rating owned by the provided browser token', async () => {
    const created = await repository.create({
      productId: 1,
      score: 3,
      ownershipToken: 'browser-token-product-one',
    });

    await expect(repository.delete(created.ratingId, 'browser-token-product-two')).rejects.toThrow(ConflictError);
    await repository.delete(created.ratingId, 'browser-token-product-one');

    await expect(repository.findByProductId(1)).resolves.toEqual([]);
  });

  it('cascades rating cleanup when a product is deleted', async () => {
    const db = await getDatabase(true);
    await repository.create({ productId: 1, score: 5, ownershipToken: 'browser-token-product-one' });

    await db.run('DELETE FROM products WHERE product_id = ?', [1]);

    await expect(repository.findByProductId(1)).resolves.toEqual([]);
  });
});
