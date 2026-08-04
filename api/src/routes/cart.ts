/**
 * @swagger
 * tags:
 *   name: Cart
 *   description: API endpoints for managing shopping carts
 */

/**
 * @swagger
 * components:
 *   parameters:
 *     XCartKeyHeader:
 *       in: header
 *       name: X-Cart-Key
 *       required: true
 *       schema:
 *         type: string
 *       description: Opaque cart key used to identify a cart
 *   schemas:
 *     CartView:
 *       type: object
 *       required:
 *         - cartKey
 *         - items
 *         - itemCount
 *         - subtotal
 *       properties:
 *         cartKey:
 *           type: string
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CartItem'
 *         itemCount:
 *           type: integer
 *         subtotal:
 *           type: number
 *           format: float
 */

/**
 * @swagger
 * /api/cart:
 *   get:
 *     summary: Get the cart for the current cart key
 *     tags: [Cart]
 *     parameters:
 *       - $ref: '#/components/parameters/XCartKeyHeader'
 *     responses:
 *       200:
 *         description: Cart contents
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CartView'
 *       400:
 *         description: Invalid cart key
 *   delete:
 *     summary: Clear all items in the current cart
 *     tags: [Cart]
 *     parameters:
 *       - $ref: '#/components/parameters/XCartKeyHeader'
 *     responses:
 *       200:
 *         description: Empty cart response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CartView'
 *       400:
 *         description: Invalid cart key
 *
 * /api/cart/items:
 *   post:
 *     summary: Add an item to the current cart
 *     tags: [Cart]
 *     parameters:
 *       - $ref: '#/components/parameters/XCartKeyHeader'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - quantity
 *             properties:
 *               productId:
 *                 type: integer
 *               quantity:
 *                 type: integer
 *               cartKey:
 *                 type: string
 *                 description: Ignored if provided; header value is authoritative
 *     responses:
 *       200:
 *         description: Updated cart
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CartView'
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Product not found
 *
 * /api/cart/items/{productId}:
 *   delete:
 *     summary: Remove an item from the current cart by product ID
 *     tags: [Cart]
 *     parameters:
 *       - $ref: '#/components/parameters/XCartKeyHeader'
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Updated cart
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CartView'
 *       400:
 *         description: Invalid input
 */

import express from 'express';
import { Cart } from '../models/cart';
import { getCartsRepository } from '../repositories/cartsRepo';
import { NotFoundError, ValidationError } from '../utils/errors';

const router = express.Router();

interface CartView {
  cartKey: string;
  items: Cart['items'];
  itemCount: number;
  subtotal: number;
}

function getCartKey(req: express.Request): string {
  const rawHeader = req.header('X-Cart-Key');
  const cartKey = typeof rawHeader === 'string' ? rawHeader.trim() : '';
  if (!cartKey) {
    throw new ValidationError('X-Cart-Key header is required');
  }
  return cartKey;
}

function cartKeyToUserId(cartKey: string): number {
  let hash = 2166136261;
  for (let i = 0; i < cartKey.length; i += 1) {
    hash ^= cartKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = hash >>> 0;
  return normalized === 0 ? 1 : normalized;
}

function toCartView(cartKey: string, cart: Cart | null): CartView {
  const items = cart?.items ?? [];
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  return {
    cartKey,
    items,
    itemCount,
    subtotal,
  };
}

// Get cart for the current key
router.get('/', async (req, res, next) => {
  try {
    const cartKey = getCartKey(req);
    const userId = cartKeyToUserId(cartKey);
    const repo = await getCartsRepository();
    const cart = await repo.findByUserId(userId);

    res.json(toCartView(cartKey, cart));
  } catch (error) {
    next(error);
  }
});

// Add an item to cart
router.post('/items', async (req, res, next) => {
  try {
    const cartKey = getCartKey(req);
    const userId = cartKeyToUserId(cartKey);
    const { productId, quantity } = req.body as {
      productId?: number;
      quantity?: number;
      cartKey?: string;
    };

    if (typeof productId !== 'number' || !Number.isInteger(productId)) {
      throw new ValidationError('productId must be an integer');
    }
    const productIdValue = productId;

    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationError('quantity must be a positive integer');
    }
    const quantityValue = quantity;

    const repo = await getCartsRepository();
    const cart = await repo.addItem(userId, productIdValue, quantityValue, 0);

    res.json(toCartView(cartKey, cart));
  } catch (error) {
    next(error);
  }
});

// Remove an item from cart by product ID
router.delete('/items/:productId', async (req, res, next) => {
  try {
    const cartKey = getCartKey(req);
    const userId = cartKeyToUserId(cartKey);
    const productId = parseInt(req.params.productId, 10);

    if (Number.isNaN(productId)) {
      throw new ValidationError('productId must be an integer');
    }

    const repo = await getCartsRepository();
    const existingCart = await repo.findByUserId(userId);
    if (!existingCart) {
      res.json(toCartView(cartKey, null));
      return;
    }

    try {
      await repo.removeItem(userId, productId);
    } catch (error) {
      if (!(error instanceof NotFoundError)) {
        throw error;
      }
    }

    const updatedCart = await repo.findByUserId(userId);
    res.json(toCartView(cartKey, updatedCart));
  } catch (error) {
    next(error);
  }
});

// Clear cart for the current key
router.delete('/', async (req, res, next) => {
  try {
    const cartKey = getCartKey(req);
    const userId = cartKeyToUserId(cartKey);
    const repo = await getCartsRepository();
    const existingCart = await repo.findByUserId(userId);

    if (existingCart) {
      await repo.clearCart(userId);
    }

    res.json(toCartView(cartKey, null));
  } catch (error) {
    next(error);
  }
});

export default router;
