import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../db/migrate';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import { ProductCommentsRepository } from './productCommentsRepo';

describe('ProductCommentsRepository', () => {
  let repository: ProductCommentsRepository;

  beforeEach(async () => {
    await closeDatabase();
    const db = await getDatabase(true);
    await runMigrations(true);

    // Insert test data
    await db.run(
      'INSERT INTO suppliers (supplier_id, name, description, contact_person, email, phone, active, verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [1, 'Test Supplier', 'A test supplier', 'Test User', 'test@test.com', '555-0000', 1, 1],
    );
    await db.run(
      'INSERT INTO products (product_id, supplier_id, name, description, price, sku, unit, img_name, discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [1, 1, 'Test Product', 'A test product', 9.99, 'TEST-001', 'unit', 'test.png', 0],
    );

    repository = new ProductCommentsRepository(db);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  describe('Comments', () => {
    it('returns an empty list for a product with no comments', async () => {
      const comments = await repository.findByProductId(1);
      expect(comments).toEqual([]);
    });

    it('creates a comment without exposing ownership token', async () => {
      const comment = await repository.create(
        1,
        { content: 'Great product!', authorName: 'John' },
        'token-123456789-abcdef'
      );

      expect(comment).toMatchObject({
        commentId: expect.any(Number),
        productId: 1,
        content: 'Great product!',
        authorName: 'John',
        replies: [],
        helpfulCount: 0,
      });
      expect(comment).not.toHaveProperty('ownershipToken');
      expect(comment.createdAt).toEqual(expect.any(String));
    });

    it('rejects content that is too short', async () => {
      await expect(
        repository.create(1, { content: '' }, 'token-123456789-abcdef')
      ).rejects.toThrow(ValidationError);
    });

    it('rejects content longer than 500 characters', async () => {
      const longContent = 'a'.repeat(501);
      await expect(
        repository.create(1, { content: longContent }, 'token-123456789-abcdef')
      ).rejects.toThrow(ValidationError);
    });

    it('rejects author names longer than 100 characters', async () => {
      const longName = 'a'.repeat(101);
      await expect(
        repository.create(1, { content: 'Good product', authorName: longName }, 'token-123456789-abcdef')
      ).rejects.toThrow(ValidationError);
    });

    it('rejects invalid ownership tokens', async () => {
      await expect(
        repository.create(1, { content: 'Good product' }, 'short')
      ).rejects.toThrow(ValidationError);
    });

    it('rejects comments for non-existent products', async () => {
      await expect(
        repository.create(999, { content: 'Good product' }, 'token-123456789-abcdef')
      ).rejects.toThrow(NotFoundError);
    });

    it('allows optional author name (anonymous)', async () => {
      const comment = await repository.create(
        1,
        { content: 'Good product' },
        'token-123456789-abcdef'
      );

      expect(comment.authorName).toBeUndefined();
    });

    it('lists comments with proper content and metadata', async () => {
      await repository.create(
        1,
        { content: 'First comment', authorName: 'Alice' },
        'token-alice-12345678'
      );
      await repository.create(
        1,
        { content: 'Second comment', authorName: 'Bob' },
        'token-bob-12345678'
      );

      const comments = await repository.findByProductId(1);
      expect(comments).toHaveLength(2);
      expect(comments[0].authorName).toBe('Bob'); // Most recent first
      expect(comments[1].authorName).toBe('Alice');
    });

    it('finds a single comment by ID', async () => {
      const created = await repository.create(
        1,
        { content: 'Test comment', authorName: 'John' },
        'token-john-12345678'
      );

      const found = await repository.findCommentById(created.commentId);
      expect(found).toMatchObject({
        commentId: created.commentId,
        productId: 1,
        content: 'Test comment',
        authorName: 'John',
      });
    });

    it('returns null when comment not found', async () => {
      const found = await repository.findCommentById(999);
      expect(found).toBeNull();
    });

    it('allows user to find their own comments', async () => {
      const token = 'token-owner-12345678';
      await repository.create(
        1,
        { content: 'My comment', authorName: 'Me' },
        token
      );

      const owned = await repository.findOwnedByProductId(1, token);
      expect(owned).toHaveLength(1);
      expect(owned[0].content).toBe('My comment');
    });

    it('prevents finding comments of other users', async () => {
      await repository.create(
        1,
        { content: 'My comment' },
        'token-alice-12345678'
      );

      const owned = await repository.findOwnedByProductId(1, 'token-bob-12345678');
      expect(owned).toHaveLength(0);
    });

    it('updates a comment (content and author name)', async () => {
      const token = 'token-owner-12345678';
      const created = await repository.create(
        1,
        { content: 'Original', authorName: 'Alice' },
        token
      );

      const updated = await repository.update(
        created.commentId,
        { content: 'Updated content', authorName: 'Alicia' },
        token
      );

      expect(updated.content).toBe('Updated content');
      expect(updated.authorName).toBe('Alicia');
    });

    it('prevents unauthorized update', async () => {
      const token1 = 'token-alice-12345678';
      const created = await repository.create(
        1,
        { content: 'Alice comment' },
        token1
      );

      await expect(
        repository.update(created.commentId, { content: 'Hacked' }, 'token-bob-12345678')
      ).rejects.toThrow(NotFoundError);
    });

    it('deletes a comment and cascades to replies', async () => {
      const token = 'token-owner-12345678';
      const comment = await repository.create(
        1,
        { content: 'Will be deleted' },
        token
      );

      await repository.delete(comment.commentId, token);

      const found = await repository.findCommentById(comment.commentId);
      expect(found).toBeNull();
    });

    it('prevents unauthorized delete', async () => {
      const comment = await repository.create(
        1,
        { content: 'Alice comment' },
        'token-alice-12345678'
      );

      await expect(
        repository.delete(comment.commentId, 'token-bob-12345678')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Replies', () => {
    it('creates a reply to a comment', async () => {
      const comment = await repository.create(
        1,
        { content: 'Main comment' },
        'token-alice-12345678'
      );

      const reply = await repository.createReply(
        comment.commentId,
        { content: 'Great point!', authorName: 'Bob' },
        'token-bob-12345678'
      );

      expect(reply).toMatchObject({
        replyId: expect.any(Number),
        commentId: comment.commentId,
        content: 'Great point!',
        authorName: 'Bob',
      });
      expect(reply).not.toHaveProperty('ownershipToken');
    });

    it('loads replies with their parent comment', async () => {
      const comment = await repository.create(
        1,
        { content: 'Main comment' },
        'token-alice-12345678'
      );

      await repository.createReply(
        comment.commentId,
        { content: 'First reply' },
        'token-bob-12345678'
      );
      await repository.createReply(
        comment.commentId,
        { content: 'Second reply' },
        'token-charlie-1234567'
      );

      const found = await repository.findCommentById(comment.commentId);
      expect(found?.replies).toHaveLength(2);
      expect(found?.replies?.[0].content).toBe('Second reply'); // Most recent first
    });

    it('updates a reply', async () => {
      const comment = await repository.create(
        1,
        { content: 'Main' },
        'token-alice-12345678'
      );
      const token = 'token-bob-12345678';
      const reply = await repository.createReply(
        comment.commentId,
        { content: 'Original' },
        token
      );

      const updated = await repository.updateReply(
        reply.replyId,
        { content: 'Updated' },
        token
      );

      expect(updated.content).toBe('Updated');
    });

    it('deletes a reply', async () => {
      const comment = await repository.create(
        1,
        { content: 'Main' },
        'token-alice-12345678'
      );
      const token = 'token-bob-12345678';
      const reply = await repository.createReply(
        comment.commentId,
        { content: 'Reply' },
        token
      );

      await repository.deleteReply(reply.replyId, token);

      const updated = await repository.findCommentById(comment.commentId);
      expect(updated?.replies).toHaveLength(0);
    });
  });

  describe('Reactions', () => {
    it('sets a helpful reaction on a comment', async () => {
      const comment = await repository.create(
        1,
        { content: 'Helpful comment' },
        'token-alice-12345678'
      );

      await repository.setReaction(comment.commentId, { isHelpful: true }, 'token-bob-12345678');

      const updated = await repository.findCommentById(comment.commentId, 'token-bob-12345678');
      expect(updated?.helpfulCount).toBe(1);
      expect(updated?.userReaction?.isHelpful).toBe(true);
    });

    it('toggles reactions with UPSERT behavior', async () => {
      const comment = await repository.create(
        1,
        { content: 'Comment' },
        'token-alice-12345678'
      );
      const token = 'token-bob-12345678';

      // First reaction: helpful
      await repository.setReaction(comment.commentId, { isHelpful: true }, token);
      let updated = await repository.findCommentById(comment.commentId, token);
      expect(updated?.helpfulCount).toBe(1);

      // Update reaction: not helpful
      await repository.setReaction(comment.commentId, { isHelpful: false }, token);
      updated = await repository.findCommentById(comment.commentId, token);
      expect(updated?.userReaction?.isHelpful).toBe(false);
    });

    it('removes a reaction', async () => {
      const comment = await repository.create(
        1,
        { content: 'Comment' },
        'token-alice-12345678'
      );
      const token = 'token-bob-12345678';

      await repository.setReaction(comment.commentId, { isHelpful: true }, token);
      let updated = await repository.findCommentById(comment.commentId, token);
      expect(updated?.userReaction).toBeDefined();

      await repository.removeReaction(comment.commentId, token);
      updated = await repository.findCommentById(comment.commentId, token);
      expect(updated?.userReaction).toBeUndefined();
    });

    it('counts helpful reactions across all users', async () => {
      const comment = await repository.create(
        1,
        { content: 'Popular comment' },
        'token-alice-12345678'
      );

      await repository.setReaction(comment.commentId, { isHelpful: true }, 'token-bob-12345678');
      await repository.setReaction(comment.commentId, { isHelpful: true }, 'token-charlie-1234567');
      await repository.setReaction(comment.commentId, { isHelpful: false }, 'token-david-123456789');

      const updated = await repository.findCommentById(comment.commentId);
      expect(updated?.helpfulCount).toBe(2);
    });
  });
});
