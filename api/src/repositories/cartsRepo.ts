/**
 * Repository for cart data access
 */

import { getDatabase, DatabaseConnection } from '../db/sqlite';
import { Cart, CartItem } from '../models/cart';
import { handleDatabaseError, NotFoundError, ValidationError } from '../utils/errors';
import { objectToCamelCase, DatabaseRow } from '../utils/sql';

export class CartsRepository {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  private validateQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationError('Quantity must be a positive integer');
    }
  }

  private toSafeNumber(value: number | bigint): number {
    if (typeof value === 'bigint') {
      if (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) {
        throw new Error(`Row ID ${value} exceeds JavaScript safe integer range`);
      }
      return Number(value);
    }
    return value;
  }

  /**
   * Get a cart by user ID
   */
  async findByUserId(userId: number): Promise<Cart | null> {
    try {
      const cartRow = await this.db.get<DatabaseRow>(
        'SELECT * FROM carts WHERE user_id = ?',
        [userId],
      );

      if (!cartRow) {
        return null;
      }

      const cart = objectToCamelCase<Omit<Cart, 'items'>>(cartRow);
      const itemRows = await this.db.all<DatabaseRow>(
        'SELECT * FROM cart_items WHERE cart_id = ? ORDER BY cart_item_id',
        [cart.cartId],
      );

      return {
        ...cart,
        items: itemRows.map((row) => objectToCamelCase<CartItem>(row)),
      };
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  /**
   * Add an item to a user's cart
   */
  async addItem(userId: number, productId: number, quantity: number, _requestedPrice: number): Promise<Cart> {
    try {
      this.validateQuantity(quantity);

      this.db.db.transaction(() => {
        const product = this.db.db
          .prepare('SELECT price FROM products WHERE product_id = ?')
          .get(productId) as { price: number } | undefined;

        if (!product) {
          throw new NotFoundError('Product', productId);
        }

        const existingCart = this.db.db
          .prepare('SELECT cart_id FROM carts WHERE user_id = ?')
          .get(userId) as { cart_id: number } | undefined;

        let cartId = existingCart?.cart_id;
        if (!cartId) {
          const cartInsert = this.db.db.prepare('INSERT INTO carts (user_id) VALUES (?)').run(userId);
          cartId = this.toSafeNumber(cartInsert.lastInsertRowid);
        }

        const existingLine = this.db.db
          .prepare('SELECT cart_item_id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?')
          .get(cartId, productId) as { cart_item_id: number; quantity: number } | undefined;

        if (existingLine) {
          this.db.db
            .prepare('UPDATE cart_items SET quantity = ?, price = ? WHERE cart_item_id = ?')
            .run(existingLine.quantity + quantity, product.price, existingLine.cart_item_id);
        } else {
          this.db.db
            .prepare('INSERT INTO cart_items (cart_id, product_id, quantity, price) VALUES (?, ?, ?, ?)')
            .run(cartId, productId, quantity, product.price);
        }
      })();

      const updatedCart = await this.findByUserId(userId);
      if (!updatedCart) {
        throw new Error('Failed to retrieve updated cart');
      }

      return updatedCart;
    } catch (error) {
      handleDatabaseError(error, 'Cart', userId);
    }
  }

  /**
   * Remove an item from a user's cart
   */
  async removeItem(userId: number, productId: number): Promise<void> {
    try {
      const cart = await this.findByUserId(userId);
      if (!cart) {
        throw new NotFoundError('Cart', userId);
      }

      const result = await this.db.run(
        'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?',
        [cart.cartId, productId],
      );

      if (result.changes === 0) {
        throw new NotFoundError('Cart item', productId);
      }
    } catch (error) {
      handleDatabaseError(error, 'Cart', userId);
    }
  }

  /**
   * Remove an item by cart item ID
   */
  async removeItemById(itemId: number): Promise<void> {
    try {
      const result = await this.db.run('DELETE FROM cart_items WHERE cart_item_id = ?', [itemId]);

      if (result.changes === 0) {
        throw new NotFoundError('Cart item', itemId);
      }
    } catch (error) {
      handleDatabaseError(error, 'Cart item', itemId);
    }
  }

  /**
   * Clear all items from a user's cart
   */
  async clearCart(userId: number): Promise<void> {
    try {
      this.db.db.transaction(() => {
        const cart = this.db.db
          .prepare('SELECT cart_id FROM carts WHERE user_id = ?')
          .get(userId) as { cart_id: number } | undefined;

        if (!cart) {
          throw new NotFoundError('Cart', userId);
        }

        this.db.db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.cart_id);
      })();
    } catch (error) {
      handleDatabaseError(error, 'Cart', userId);
    }
  }
}

// Factory function to create repository instance
export async function createCartsRepository(isTest: boolean = false): Promise<CartsRepository> {
  const db = await getDatabase(isTest);
  return new CartsRepository(db);
}

// Singleton instance for default usage
let cartsRepo: CartsRepository | null = null;

export async function getCartsRepository(isTest: boolean = false): Promise<CartsRepository> {
  const isTestEnv = isTest || process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  if (isTestEnv) {
    return createCartsRepository(true);
  }
  if (!cartsRepo) {
    cartsRepo = await createCartsRepository(false);
  }
  return cartsRepo;
}
