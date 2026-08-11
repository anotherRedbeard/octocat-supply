import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { runMigrations } from '../db/migrate';
import { errorHandler } from '../utils/errors';
import productCommentRouter from './productComment';
import productRouter from './product';

let app: express.Express;

const ownerToken = 'browser-token-comment-owner';
const otherToken = 'browser-token-other-user';

async function insertTestData(): Promise<void> {
  const db = await getDatabase(true);
  await db.run(
    'INSERT INTO suppliers (supplier_id, name, description, contact_person, email, phone, active, verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [1, 'Test Supplier', 'A test supplier', 'Test User', 'test@test.com', '555-0000', 1, 1],
  );
  await db.run(
    'INSERT INTO products (product_id, supplier_id, name, description, price, sku, unit, img_name, discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [1, 1, 'Test Product', 'A test product', 9.99, 'TEST-001', 'unit', 'test.png', 0],
  );
}

describe('Product Comments API', () => {
  beforeEach(async () => {
    await closeDatabase();
    await getDatabase(true);
    await runMigrations(true);
    await insertTestData();

    app = express();
    app.use(express.json());
    app.use('/api', productCommentRouter);
    app.use('/api', productRouter);
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  describe('GET /api/products/:productId/comments', () => {
    it('returns empty list for product with no comments', async () => {
      const response = await request(app)
        .get('/api/products/1/comments')
        .set('X-Comment-Token', ownerToken);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('lists all comments without ownership tokens exposed', async () => {
      // Create two comments
      await request(app)
        .post('/api/products/1/comments')
        .set('X-Comment-Token', ownerToken)
        .send({ content: 'First comment', authorName: 'Alice' });

      await request(app)
        .post('/api/products/1/comments')
        .set('X-Comment-Token', otherToken)
        .send({ content: 'Second comment', authorName: 'Bob' });

      const response = await request(app)
        .get('/api/products/1/comments')
        .set('X-Comment-Token', ownerToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).not.toHaveProperty('ownershipToken');
      expect(response.body[0]).toHaveProperty('commentId');
      expect(response.body[0]).toHaveProperty('replies');
    });
  });

  describe('POST /api/products/:productId/comments', () => {
    it('creates a new comment with X-Comment-Token header', async () => {
      const response = await request(app)
        .post('/api/products/1/comments')
        .set('X-Comment-Token', ownerToken)
        .send({ content: 'Great product!' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        commentId: expect.any(Number),
        productId: 1,
        content: 'Great product!',
      });
      expect(response.body).not.toHaveProperty('ownershipToken');
    });

    it('requires X-Comment-Token header', async () => {
      const response = await request(app)
        .post('/api/products/1/comments')
        .send({ content: 'No token' });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects empty content', async () => {
      const response = await request(app)
        .post('/api/products/1/comments')
        .set('X-Comment-Token', ownerToken)
        .send({ content: '' });

      expect(response.status).toBe(400);
    });

    it('rejects content longer than 500 characters', async () => {
      const longContent = 'a'.repeat(501);
      const response = await request(app)
        .post('/api/products/1/comments')
        .set('X-Comment-Token', ownerToken)
        .send({ content: longContent });

      expect(response.status).toBe(400);
    });

    it('accepts optional author name', async () => {
      const response = await request(app)
        .post('/api/products/1/comments')
        .set('X-Comment-Token', ownerToken)
        .send({ content: 'Good product', authorName: 'John' });

      expect(response.status).toBe(201);
      expect(response.body.authorName).toBe('John');
    });

    it('rejects non-existent product', async () => {
      const response = await request(app)
        .post('/api/products/999/comments')
        .set('X-Comment-Token', ownerToken)
        .send({ content: 'Comment' });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/comments/:commentId', () => {
    it('retrieves a single comment with replies', async () => {
      // Create comment
      const createRes = await request(app)
        .post('/api/products/1/comments')
        .set('X-Comment-Token', ownerToken)
        .send({ content: 'Main comment', authorName: 'Alice' });

      const commentId = createRes.body.commentId;

      const response = await request(app)
        .get(`/api/comments/${commentId}`)
        .set('X-Comment-Token', ownerToken);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        commentId,
        productId: 1,
        content: 'Main comment',
        authorName: 'Alice',
      });
      expect(response.body).toHaveProperty('replies');
      expect(Array.isArray(response.body.replies)).toBe(true);
    });

    it('returns 404 for non-existent comment', async () => {
      const response = await request(app)
        .get('/api/comments/999')
        .set('X-Comment-Token', ownerToken);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/comments/:commentId', () => {
    it('updates a comment when owner provides token', async () => {
      const createRes = await request(app)
        .post('/api/products/1/comments')
        .set('X-Comment-Token', ownerToken)
        .send({ content: 'Original', authorName: 'Alice' });

      const commentId = createRes.body.commentId;

      const updateRes = await request(app)
        .put(`/api/comments/${commentId}`)
        .set('X-Comment-Token', ownerToken)
        .send({ content: 'Updated content', authorName: 'Alicia' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.content).toBe('Updated content');
      expect(updateRes.body.authorName).toBe('Alicia');
    });

    it('prevents unauthorized updates', async () => {
      const createRes = await request(app)
        .post('/api/products/1/comments')
        .set('X-Comment-Token', ownerToken)
        .send({ content: 'Original' });

      const commentId = createRes.body.commentId;

      const updateRes = await request(app)
        .put(`/api/comments/${commentId}`)
        .set('X-Comment-Token', otherToken)
        .send({ content: 'Hacked!' });

      expect(updateRes.status).toBe(404);
    });
  });

  describe('DELETE /api/comments/:commentId', () => {
    it('deletes a comment when owner provides token', async () => {
      const createRes = await request(app)
        .post('/api/products/1/comments')
        .set('X-Comment-Token', ownerToken)
        .send({ content: 'Temporary comment' });

      const commentId = createRes.body.commentId;

      const deleteRes = await request(app)
        .delete(`/api/comments/${commentId}`)
        .set('X-Comment-Token', ownerToken);

      expect(deleteRes.status).toBe(204);

      const getRes = await request(app)
        .get(`/api/comments/${commentId}`)
        .set('X-Comment-Token', ownerToken);

      expect(getRes.status).toBe(404);
    });

    it('prevents unauthorized deletes', async () => {
      const createRes = await request(app)
        .post('/api/products/1/comments')
        .set('X-Comment-Token', ownerToken)
        .send({ content: 'Comment' });

      const commentId = createRes.body.commentId;

      const deleteRes = await request(app)
        .delete(`/api/comments/${commentId}`)
        .set('X-Comment-Token', otherToken);

      expect(deleteRes.status).toBe(404);
    });
  });

  describe('POST /api/comments/:commentId/replies', () => {
    it('creates a reply to a comment', async () => {
      const createRes = await request(app)
        .post('/api/products/1/comments')
        .set('X-Comment-Token', ownerToken)
        .send({ content: 'Main comment' });

      const commentId = createRes.body.commentId;

      const replyRes = await request(app)
        .post(`/api/comments/${commentId}/replies`)
        .set('X-Comment-Token', otherToken)
        .send({ content: 'Great point!', authorName: 'Bob' });

      expect(replyRes.status).toBe(201);
      expect(replyRes.body).toMatchObject({
        replyId: expect.any(Number),
        commentId,
        content: 'Great point!',
        authorName: 'Bob',
      });
    });

    it('returns 404 for reply to non-existent comment', async () => {
      const response = await request(app)
        .post('/api/comments/999/replies')
        .set('X-Comment-Token', ownerToken)
        .send({ content: 'Reply' });

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/comments/:commentId/replies/:replyId', () => {
    it('updates a reply when owner provides token', async () => {
      const commentRes = await request(app)
        .post('/api/products/1/comments')
        .set('X-Comment-Token', ownerToken)
        .send({ content: 'Comment' });

      const replyRes = await request(app)
        .post(`/api/comments/${commentRes.body.commentId}/replies`)
        .set('X-Comment-Token', otherToken)
        .send({ content: 'Original reply' });

      const updateRes = await request(app)
        .put(`/api/comments/${commentRes.body.commentId}/replies/${replyRes.body.replyId}`)
        .set('X-Comment-Token', otherToken)
        .send({ content: 'Updated reply' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.content).toBe('Updated reply');
    });
  });

  describe('DELETE /api/comments/:commentId/replies/:replyId', () => {
    it('deletes a reply when owner provides token', async () => {
      const commentRes = await request(app)
        .post('/api/products/1/comments')
        .set('X-Comment-Token', ownerToken)
        .send({ content: 'Comment' });

      const replyRes = await request(app)
        .post(`/api/comments/${commentRes.body.commentId}/replies`)
        .set('X-Comment-Token', otherToken)
        .send({ content: 'Reply' });

      const deleteRes = await request(app)
        .delete(`/api/comments/${commentRes.body.commentId}/replies/${replyRes.body.replyId}`)
        .set('X-Comment-Token', otherToken);

      expect(deleteRes.status).toBe(204);
    });
  });

  describe('POST /api/comments/:commentId/reactions', () => {
    it('sets a helpful reaction', async () => {
      const commentRes = await request(app)
        .post('/api/products/1/comments')
        .set('X-Comment-Token', ownerToken)
        .send({ content: 'Comment' });

      const reactionRes = await request(app)
        .post(`/api/comments/${commentRes.body.commentId}/reactions`)
        .set('X-Comment-Token', otherToken)
        .send({ isHelpful: true });

      expect(reactionRes.status).toBe(200);

      // Verify reaction was saved
      const getRes = await request(app)
        .get(`/api/comments/${commentRes.body.commentId}`)
        .set('X-Comment-Token', otherToken);

      expect(getRes.body.userReaction?.isHelpful).toBe(true);
    });
  });

  describe('DELETE /api/comments/:commentId/reactions', () => {
    it('removes a reaction', async () => {
      const commentRes = await request(app)
        .post('/api/products/1/comments')
        .set('X-Comment-Token', ownerToken)
        .send({ content: 'Comment' });

      const commentId = commentRes.body.commentId;

      // Create reaction
      await request(app)
        .post(`/api/comments/${commentId}/reactions`)
        .set('X-Comment-Token', otherToken)
        .send({ isHelpful: true });

      // Remove reaction
      const deleteRes = await request(app)
        .delete(`/api/comments/${commentId}/reactions`)
        .set('X-Comment-Token', otherToken);

      expect(deleteRes.status).toBe(204);

      // Verify reaction was removed
      const getRes = await request(app)
        .get(`/api/comments/${commentId}`)
        .set('X-Comment-Token', otherToken);

      expect(getRes.body.userReaction).toBeUndefined();
    });
  });
});
