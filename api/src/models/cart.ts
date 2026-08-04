/**
 * @swagger
 * components:
 *   schemas:
 *     CartItem:
 *       type: object
 *       required:
 *         - cartItemId
 *         - cartId
 *         - productId
 *         - quantity
 *         - price
 *       properties:
 *         cartItemId:
 *           type: integer
 *           description: The unique identifier for the cart item
 *         cartId:
 *           type: integer
 *           description: The ID of the cart containing the item
 *         productId:
 *           type: integer
 *           description: The ID of the product in the cart
 *         quantity:
 *           type: integer
 *           description: The quantity of the product in the cart
 *         price:
 *           type: number
 *           format: float
 *           description: The price of one unit of the product
 *     Cart:
 *       type: object
 *       required:
 *         - cartId
 *         - userId
 *         - items
 *       properties:
 *         cartId:
 *           type: integer
 *           description: The unique identifier for the cart
 *         userId:
 *           type: integer
 *           description: The ID of the user who owns the cart
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CartItem'
 */
export interface CartItem {
  cartItemId: number;
  cartId: number;
  productId: number;
  quantity: number;
  price: number;
}

export interface Cart {
  cartId: number;
  userId: number;
  items: CartItem[];
}
