import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../db/migrate';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { CartsRepository } from './cartsRepo';
import { NotFoundError, ValidationError } from '../utils/errors';

describe('CartsRepository', () => {
  let repository: CartsRepository;

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

    repository = new CartsRepository(db);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('returns null for a user with no cart yet', async () => {
    const cart = await repository.findByUserId(101);
    expect(cart).toBeNull();
  });

  it('creates a cart and adds a product line', async () => {
    const cart = await repository.addItem(101, 1, 2, 999.99);

    expect(cart.userId).toBe(101);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({
      productId: 1,
      quantity: 2,
      price: 4.5,
    });
  });

  it('increments quantity when adding an existing product line', async () => {
    await repository.addItem(101, 1, 2, 1.0);
    const cart = await repository.addItem(101, 1, 3, 1.0);

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(5);
    expect(cart.items[0].price).toBe(4.5);
  });

  it('uses the product table price instead of the client-supplied price', async () => {
    const cart = await repository.addItem(101, 1, 1, 0.01);

    expect(cart.items[0].price).toBe(4.5);
  });

  it('throws NotFoundError when adding a missing product', async () => {
    await expect(repository.addItem(101, 999, 1, 1.0)).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError for non-positive or non-integer quantities', async () => {
    await expect(repository.addItem(101, 1, 0, 1.0)).rejects.toThrow(ValidationError);
    await expect(repository.addItem(101, 1, -2, 1.0)).rejects.toThrow(ValidationError);
    await expect(repository.addItem(101, 1, 1.5, 1.0)).rejects.toThrow(ValidationError);
  });

  it('removes a single product line from a cart', async () => {
    await repository.addItem(101, 1, 1, 1.0);
    await repository.addItem(101, 2, 1, 1.0);

    await repository.removeItem(101, 1);

    const cart = await repository.findByUserId(101);
    expect(cart).not.toBeNull();
    expect(cart?.items).toHaveLength(1);
    expect(cart?.items[0].productId).toBe(2);
  });

  it('clears all cart lines and leaves an empty cart', async () => {
    await repository.addItem(101, 1, 1, 1.0);
    await repository.addItem(101, 2, 2, 1.0);

    await repository.clearCart(101);

    const cart = await repository.findByUserId(101);
    expect(cart).not.toBeNull();
    expect(cart?.items).toEqual([]);
  });

  it('supports subtotal and item-count calculations from cart items', async () => {
    await repository.addItem(101, 1, 3, 1.0);
    const cart = await repository.addItem(101, 2, 2, 1.0);

    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

    expect(itemCount).toBe(5);
    expect(subtotal).toBeCloseTo(18.0, 5);
  });

  it('isolates carts by user id', async () => {
    await repository.addItem(101, 1, 1, 1.0);
    await repository.addItem(202, 1, 4, 1.0);

    const cartA = await repository.findByUserId(101);
    const cartB = await repository.findByUserId(202);

    expect(cartA?.items).toHaveLength(1);
    expect(cartB?.items).toHaveLength(1);
    expect(cartA?.cartId).not.toBe(cartB?.cartId);
    expect(cartA?.items[0].quantity).toBe(1);
    expect(cartB?.items[0].quantity).toBe(4);
  });

  it('enforces product foreign-key behavior for cart lines', async () => {
    const db = await getDatabase(true);
    await repository.addItem(101, 1, 1, 1.0);

    expect(() => {
      db.db.prepare('DELETE FROM products WHERE product_id = ?').run(1);
    }).toThrow();
  });
});
