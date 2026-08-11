/**
 * @swagger
 * components:
 *   schemas:
 *     Rating:
 *       type: object
 *       required:
 *         - ratingId
 *         - productId
 *         - score
 *         - createdAt
 *         - updatedAt
 *       properties:
 *         ratingId:
 *           type: integer
 *           description: The unique identifier for the rating
 *         productId:
 *           type: integer
 *           description: The product being rated
 *         score:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           description: The product score from one to five stars
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     RatingSummary:
 *       type: object
 *       required:
 *         - averageScore
 *         - ratingCount
 *         - distribution
 *       properties:
 *         averageScore:
 *           type: number
 *           format: float
 *           description: The server-calculated average score
 *         ratingCount:
 *           type: integer
 *           description: The number of ratings
 *         distribution:
 *           type: object
 *           additionalProperties:
 *             type: integer
 *           description: Number of ratings for each score from one to five
 */
export interface Rating {
  ratingId: number;
  productId: number;
  score: number;
  createdAt: string;
  updatedAt: string;
}

export interface RatingSummary {
  averageScore: number;
  ratingCount: number;
  distribution: Record<string, number>;
}

export interface CreateRatingInput {
  productId: number;
  score: number;
  ownershipToken: string;
}

export interface UpdateRatingInput {
  score: number;
  ownershipToken: string;
}
