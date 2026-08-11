/**
 * @swagger
 * tags:
 *   name: Ratings
 *   description: API endpoints for product ratings
 */

/**
 * @swagger
 * components:
 *   parameters:
 *     XRatingTokenHeader:
 *       in: header
 *       name: X-Rating-Token
 *       required: false
 *       schema:
 *         type: string
 *         minLength: 16
 *         maxLength: 255
 *       description: Browser-local token used to identify the rating owner; this is not authentication
 *   schemas:
 *     RatingMutationResponse:
 *       type: object
 *       required:
 *         - rating
 *         - summary
 *       properties:
 *         rating:
 *           $ref: '#/components/schemas/Rating'
 *         summary:
 *           $ref: '#/components/schemas/RatingSummary'
 *     RatingListResponse:
 *       type: object
 *       required:
 *         - ratings
 *         - summary
 *         - ownedRating
 *       properties:
 *         ratings:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Rating'
 *         summary:
 *           $ref: '#/components/schemas/RatingSummary'
 *         ownedRating:
 *           nullable: true
 *           allOf:
 *             - $ref: '#/components/schemas/Rating'
 */

/**
 * @swagger
 * /api/products/{productId}/ratings:
 *   get:
 *     summary: Get ratings and summary for a product
 *     tags: [Ratings]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *       - $ref: '#/components/parameters/XRatingTokenHeader'
 *     responses:
 *       200:
 *         description: Product ratings and server-calculated summary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RatingListResponse'
 *       400:
 *         description: Invalid product ID or rating token
 *       404:
 *         description: Product not found
 *   post:
 *     summary: Create a product rating
 *     tags: [Ratings]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: header
 *         name: X-Rating-Token
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 16
 *           maxLength: 255
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - score
 *             properties:
 *               score:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *     responses:
 *       201:
 *         description: Rating created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RatingMutationResponse'
 *       400:
 *         description: Invalid product ID, score, or rating token
 *       404:
 *         description: Product not found
 *       409:
 *         description: This browser already rated this product
 *
 * /api/ratings/{ratingId}:
 *   put:
 *     summary: Update a browser-owned product rating
 *     tags: [Ratings]
 *     parameters:
 *       - in: path
 *         name: ratingId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: header
 *         name: X-Rating-Token
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 16
 *           maxLength: 255
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - score
 *             properties:
 *               score:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *     responses:
 *       200:
 *         description: Rating updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RatingMutationResponse'
 *       400:
 *         description: Invalid rating ID, score, or rating token
 *       404:
 *         description: Rating not found
 *       409:
 *         description: The browser does not own this rating
 *   delete:
 *     summary: Delete a browser-owned product rating
 *     tags: [Ratings]
 *     parameters:
 *       - in: path
 *         name: ratingId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: header
 *         name: X-Rating-Token
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 16
 *           maxLength: 255
 *     responses:
 *       204:
 *         description: Rating deleted
 *       400:
 *         description: Invalid rating ID or rating token
 *       404:
 *         description: Rating not found
 *       409:
 *         description: The browser does not own this rating
 */

import express from 'express';
import { getRatingsRepository } from '../repositories/ratingsRepo';
import { Rating, RatingSummary } from '../models/rating';
import { RatingsRepository } from '../repositories/ratingsRepo';
import { NotFoundError, ValidationError } from '../utils/errors';

const router = express.Router();

interface RatingListResponse {
  ratings: Rating[];
  summary: RatingSummary;
  ownedRating: Rating | null;
}

interface RatingMutationResponse {
  rating: Rating;
  summary: RatingListResponse['summary'];
}

function parsePositiveInteger(value: string, fieldName: string): number {
  if (!/^\d+$/.test(value)) {
    throw new ValidationError(`${fieldName} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function getRequiredRatingToken(req: express.Request): string {
  const token = req.header('X-Rating-Token')?.trim() ?? '';
  if (token.length < 16 || token.length > 255) {
    throw new ValidationError('X-Rating-Token must be between 16 and 255 characters');
  }
  return token;
}

function getOptionalRatingToken(req: express.Request): string | undefined {
  const rawToken = req.header('X-Rating-Token');
  if (rawToken === undefined) {
    return undefined;
  }
  return getRequiredRatingToken(req);
}

function getScore(req: express.Request): number {
  const score = req.body?.score;
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new ValidationError('score must be an integer between 1 and 5');
  }
  return score;
}

async function assertProductExists(productId: number, repository: RatingsRepository): Promise<void> {
  if (!(await repository.productExists(productId))) {
    throw new NotFoundError('Product', productId);
  }
}

async function toMutationResponse(
  rating: Rating,
  repository: RatingsRepository,
): Promise<RatingMutationResponse> {
  return {
    rating,
    summary: await repository.findSummaryByProductId(rating.productId),
  };
}

router.get('/products/:productId/ratings', async (req, res, next) => {
  try {
    const productId = parsePositiveInteger(req.params.productId, 'productId');
    const repository = await getRatingsRepository();
    await assertProductExists(productId, repository);
    const token = getOptionalRatingToken(req);
    const [ratings, summary, ownedRating] = await Promise.all([
      repository.findByProductId(productId),
      repository.findSummaryByProductId(productId),
      token ? repository.findOwnedByProductId(productId, token) : Promise.resolve(null),
    ]);

    const response: RatingListResponse = { ratings, summary, ownedRating };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.post('/products/:productId/ratings', async (req, res, next) => {
  try {
    const productId = parsePositiveInteger(req.params.productId, 'productId');
    const repository = await getRatingsRepository();
    await assertProductExists(productId, repository);
    const rating = await repository.create({
      productId,
      score: getScore(req),
      ownershipToken: getRequiredRatingToken(req),
    });
    res.status(201).json(await toMutationResponse(rating, repository));
  } catch (error) {
    next(error);
  }
});

router.put('/ratings/:ratingId', async (req, res, next) => {
  try {
    const ratingId = parsePositiveInteger(req.params.ratingId, 'ratingId');
    const repository = await getRatingsRepository();
    const rating = await repository.update(ratingId, {
      score: getScore(req),
      ownershipToken: getRequiredRatingToken(req),
    });
    res.json(await toMutationResponse(rating, repository));
  } catch (error) {
    next(error);
  }
});

router.delete('/ratings/:ratingId', async (req, res, next) => {
  try {
    const ratingId = parsePositiveInteger(req.params.ratingId, 'ratingId');
    const repository = await getRatingsRepository();
    await repository.delete(ratingId, getRequiredRatingToken(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
