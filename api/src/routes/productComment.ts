/**
 * Product Comments Routes
 * REST API endpoints for managing comments, replies, and reactions on products
 */

import express, { Request, Response, NextFunction, Router } from 'express';
import { ProductCommentsRepository } from '../repositories/productCommentsRepo';
import { getDatabase } from '../db/sqlite';
import {
  CreateCommentInput,
  UpdateCommentInput,
  CreateReplyInput,
  UpdateReplyInput,
  CreateReactionInput,
} from '../models/productComment';

const router = Router();

// Helper to get repository instance
async function getCommentRepository(): Promise<ProductCommentsRepository> {
  const db = await getDatabase();
  return new ProductCommentsRepository(db);
}

// Helper to extract X-Comment-Token header
function getCommentToken(req: Request): string | undefined {
  return req.headers['x-comment-token'] as string | undefined;
}

// ==================== COMMENT ENDPOINTS ====================

/**
 * @swagger
 * /api/products/{productId}/comments:
 *   get:
 *     summary: Fetch all comments for a product
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: header
 *         name: X-Comment-Token
 *         description: Optional token to fetch user's own reactions
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of comments for product
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProductComment'
 *       400:
 *         description: Invalid product ID
 *       404:
 *         description: Product not found
 */
router.get('/products/:productId/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const userToken = getCommentToken(req);

    const repo = await getCommentRepository();
    const comments = await repo.findByProductId(parseInt(productId, 10), userToken);

    res.json(comments);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/products/{productId}/comments:
 *   post:
 *     summary: Create a new comment on a product
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: header
 *         name: X-Comment-Token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               authorName:
 *                 type: string
 *                 maxLength: 100
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *             required:
 *               - content
 *     responses:
 *       201:
 *         description: Comment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductComment'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Product not found
 *       409:
 *         description: Conflict (token not provided)
 */
router.post('/products/:productId/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const token = getCommentToken(req);

    if (!token) {
      return res.status(400).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'X-Comment-Token header is required',
        },
      });
    }

    const input: CreateCommentInput = req.body;
    const repo = await getCommentRepository();
    const comment = await repo.create(parseInt(productId, 10), input, token);

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/comments/{commentId}:
 *   get:
 *     summary: Fetch a single comment by ID
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: header
 *         name: X-Comment-Token
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductComment'
 *       404:
 *         description: Comment not found
 */
router.get('/comments/:commentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;
    const userToken = getCommentToken(req);

    const repo = await getCommentRepository();
    const comment = await repo.findCommentById(parseInt(commentId, 10), userToken);

    if (!comment) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Comment ${commentId} not found`,
        },
      });
    }

    res.json(comment);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/comments/{commentId}:
 *   put:
 *     summary: Update a comment (author only)
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: header
 *         name: X-Comment-Token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *               authorName:
 *                 type: string
 *                 maxLength: 100
 *             required:
 *               - content
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductComment'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Comment not found or ownership mismatch
 */
router.put('/comments/:commentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;
    const token = getCommentToken(req);

    if (!token) {
      return res.status(400).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'X-Comment-Token header is required',
        },
      });
    }

    const input: UpdateCommentInput = req.body;
    const repo = await getCommentRepository();
    const comment = await repo.update(parseInt(commentId, 10), input, token);

    res.json(comment);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/comments/{commentId}:
 *   delete:
 *     summary: Delete a comment (author only)
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: header
 *         name: X-Comment-Token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Comment deleted successfully
 *       404:
 *         description: Comment not found or ownership mismatch
 */
router.delete('/comments/:commentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;
    const token = getCommentToken(req);

    if (!token) {
      return res.status(400).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'X-Comment-Token header is required',
        },
      });
    }

    const repo = await getCommentRepository();
    await repo.delete(parseInt(commentId, 10), token);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ==================== REPLY ENDPOINTS ====================

/**
 * @swagger
 * /api/comments/{commentId}/replies:
 *   post:
 *     summary: Create a reply to a comment
 *     tags: [Replies]
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: header
 *         name: X-Comment-Token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               authorName:
 *                 type: string
 *                 maxLength: 100
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *             required:
 *               - content
 *     responses:
 *       201:
 *         description: Reply created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommentReply'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Comment not found
 */
router.post('/comments/:commentId/replies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;
    const token = getCommentToken(req);

    if (!token) {
      return res.status(400).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'X-Comment-Token header is required',
        },
      });
    }

    const input: CreateReplyInput = req.body;
    const repo = await getCommentRepository();
    const reply = await repo.createReply(parseInt(commentId, 10), input, token);

    res.status(201).json(reply);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/comments/{commentId}/replies/{replyId}:
 *   put:
 *     summary: Update a reply (author only)
 *     tags: [Replies]
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: replyId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: header
 *         name: X-Comment-Token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *               authorName:
 *                 type: string
 *                 maxLength: 100
 *             required:
 *               - content
 *     responses:
 *       200:
 *         description: Reply updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommentReply'
 *       404:
 *         description: Reply not found or ownership mismatch
 */
router.put('/comments/:commentId/replies/:replyId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { replyId } = req.params;
    const token = getCommentToken(req);

    if (!token) {
      return res.status(400).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'X-Comment-Token header is required',
        },
      });
    }

    const input: UpdateReplyInput = req.body;
    const repo = await getCommentRepository();
    const reply = await repo.updateReply(parseInt(replyId, 10), input, token);

    res.json(reply);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/comments/{commentId}/replies/{replyId}:
 *   delete:
 *     summary: Delete a reply (author only)
 *     tags: [Replies]
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: replyId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: header
 *         name: X-Comment-Token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Reply deleted successfully
 *       404:
 *         description: Reply not found or ownership mismatch
 */
router.delete('/comments/:commentId/replies/:replyId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { replyId } = req.params;
    const token = getCommentToken(req);

    if (!token) {
      return res.status(400).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'X-Comment-Token header is required',
        },
      });
    }

    const repo = await getCommentRepository();
    await repo.deleteReply(parseInt(replyId, 10), token);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ==================== REACTION ENDPOINTS ====================

/**
 * @swagger
 * /api/comments/{commentId}/reactions:
 *   post:
 *     summary: Set or update a reaction on a comment
 *     tags: [Reactions]
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: header
 *         name: X-Comment-Token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isHelpful:
 *                 type: boolean
 *                 description: true for helpful, false for not helpful
 *             required:
 *               - isHelpful
 *     responses:
 *       200:
 *         description: Reaction set successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Comment not found
 */
router.post('/comments/:commentId/reactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;
    const token = getCommentToken(req);

    if (!token) {
      return res.status(400).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'X-Comment-Token header is required',
        },
      });
    }

    const input: CreateReactionInput = req.body;
    const repo = await getCommentRepository();
    await repo.setReaction(parseInt(commentId, 10), input, token);

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/comments/{commentId}/reactions:
 *   delete:
 *     summary: Remove a reaction from a comment
 *     tags: [Reactions]
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: header
 *         name: X-Comment-Token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Reaction removed successfully
 */
router.delete('/comments/:commentId/reactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;
    const token = getCommentToken(req);

    if (!token) {
      return res.status(400).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'X-Comment-Token header is required',
        },
      });
    }

    const repo = await getCommentRepository();
    await repo.removeReaction(parseInt(commentId, 10), token);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/comments/{commentId}/reactions:
 *   get:
 *     summary: Fetch reaction summary for a comment
 *     tags: [Reactions]
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reaction summary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommentReactionSummary'
 *       404:
 *         description: Comment not found
 */
router.get('/comments/:commentId/reactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;

    const repo = await getCommentRepository();
    const summary = await repo.getReactionSummary(parseInt(commentId, 10));

    res.json(summary);
  } catch (error) {
    next(error);
  }
});

export default router;
