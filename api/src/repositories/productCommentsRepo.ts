/**
 * ProductCommentsRepository
 * Handles all database operations for product comments, replies, and reactions
 * Follows the same pattern as ratingsRepo.ts
 */

import {
  DatabaseConnection,
  getDatabase,
} from '../db/sqlite';
import {
  ProductComment,
  CommentReply,
  UserReaction,
  CommentReactionSummary,
  CreateCommentInput,
  UpdateCommentInput,
  CreateReplyInput,
  UpdateReplyInput,
  CreateReactionInput,
} from '../models/productComment';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  handleDatabaseError,
} from '../utils/errors';
import { objectToCamelCase, DatabaseRow, mapDatabaseRows } from '../utils/sql';

export class ProductCommentsRepository {
  constructor(private db: DatabaseConnection) {}

  // ==================== COMMENT QUERIES ====================

  /**
   * Fetch all comments for a product, sorted newest first
   * Includes nested replies and reaction counts
   */
  async findByProductId(productId: number, userToken?: string): Promise<ProductComment[]> {
    try {
      // Validate product exists
      await this.validateProductExists(productId);

      const query = `
        SELECT 
          c.comment_id as commentId,
          c.product_id as productId,
          c.author_name as authorName,
          c.content,
          c.ownership_token as ownershipToken,
          c.created_at as createdAt,
          c.updated_at as updatedAt,
          COALESCE(
            SUM(CASE WHEN cr.is_helpful = 1 THEN 1 ELSE 0 END),
            0
          ) as helpfulCount
        FROM product_comments c
        LEFT JOIN comment_reactions cr ON c.comment_id = cr.comment_id
        WHERE c.product_id = ?
        GROUP BY c.comment_id
        ORDER BY c.created_at DESC
      `;

      const rows = await this.db.all<DatabaseRow>(query, [productId]);
      
      const comments: ProductComment[] = [];
      for (const row of rows) {
        const comment = objectToCamelCase<ProductComment>(row);
        
        // Fetch replies for this comment
        comment.replies = await this.findRepliesByCommentId(comment.commentId, userToken);
        
        // Fetch user's reaction if token provided
        if (userToken) {
          comment.userReaction = await this.findUserReactionByCommentId(comment.commentId, userToken);
        }
        
        // Don't expose ownership_token to frontend
        comment.ownershipToken = undefined;
        
        comments.push(comment);
      }
      
      return comments;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      handleDatabaseError(error, 'Comment', productId);
      throw error;
    }
  }

  /**
   * Fetch a single comment by ID with replies and reactions
   */
  async findCommentById(commentId: number, userToken?: string): Promise<ProductComment | null> {
    try {
      const query = `
        SELECT 
          c.comment_id as commentId,
          c.product_id as productId,
          c.author_name as authorName,
          c.content,
          c.ownership_token as ownershipToken,
          c.created_at as createdAt,
          c.updated_at as updatedAt,
          COALESCE(
            SUM(CASE WHEN cr.is_helpful = 1 THEN 1 ELSE 0 END),
            0
          ) as helpfulCount
        FROM product_comments c
        LEFT JOIN comment_reactions cr ON c.comment_id = cr.comment_id
        WHERE c.comment_id = ?
        GROUP BY c.comment_id
      `;

      const row = await this.db.get<DatabaseRow>(query, [commentId]);
      if (!row) return null;

      const comment = objectToCamelCase<ProductComment>(row);
      
      // Fetch replies
      comment.replies = await this.findRepliesByCommentId(comment.commentId, userToken);
      
      // Fetch user's reaction if token provided
      if (userToken) {
        comment.userReaction = await this.findUserReactionByCommentId(comment.commentId, userToken);
      }
      
      comment.ownershipToken = undefined;
      
      return comment;
    } catch (error) {
      handleDatabaseError(error, 'Comment', commentId);
      throw error;
    }
  }

  /**
   * Fetch comments owned by a specific token (for edit/delete UI)
   */
  async findOwnedByProductId(productId: number, token: string): Promise<ProductComment[]> {
    try {
      this.validateOwnershipToken(token);
      await this.validateProductExists(productId);

      const query = `
        SELECT 
          c.comment_id as commentId,
          c.product_id as productId,
          c.author_name as authorName,
          c.content,
          c.ownership_token as ownershipToken,
          c.created_at as createdAt,
          c.updated_at as updatedAt,
          COALESCE(
            SUM(CASE WHEN cr.is_helpful = 1 THEN 1 ELSE 0 END),
            0
          ) as helpfulCount
        FROM product_comments c
        LEFT JOIN comment_reactions cr ON c.comment_id = cr.comment_id
        WHERE c.product_id = ? AND c.ownership_token = ?
        GROUP BY c.comment_id
        ORDER BY c.created_at DESC
      `;

      const rows = await this.db.all<DatabaseRow>(query, [productId, token]);
      
      return rows.map(row => {
        const comment = objectToCamelCase<ProductComment>(row);
        comment.ownershipToken = undefined;
        return comment;
      });
    } catch (error) {
      if (error instanceof (ValidationError || NotFoundError)) throw error;
      handleDatabaseError(error, 'Comment', productId);
      throw error;
    }
  }

  // ==================== COMMENT MUTATIONS ====================

  /**
   * Create a new comment
   */
  async create(productId: number, input: CreateCommentInput, token: string): Promise<ProductComment> {
    try {
      // Validate inputs
      this.validateContent(input.content);
      this.validateAuthorName(input.authorName);
      this.validateOwnershipToken(token);
      
      // Validate product exists
      await this.validateProductExists(productId);

      const result = await this.db.run(
        `INSERT INTO product_comments (product_id, author_name, content, ownership_token, created_at, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [productId, input.authorName || null, input.content.trim(), token]
      );
      
      return {
        commentId: result.lastID as number,
        productId,
        authorName: input.authorName,
        content: input.content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        replies: [],
        helpfulCount: 0,
      };
    } catch (error) {
      if (error instanceof (ValidationError || NotFoundError || ConflictError)) throw error;
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new ConflictError('You have already commented on this product');
      }
      handleDatabaseError(error, 'Comment', productId);
      throw error;
    }
  }

  /**
   * Update a comment (content and/or author name)
   */
  async update(commentId: number, input: UpdateCommentInput, token: string): Promise<ProductComment> {
    try {
      // Validate inputs
      this.validateContent(input.content);
      this.validateAuthorName(input.authorName);
      this.validateOwnershipToken(token);

      // Verify ownership
      await this.verifyCommentOwnership(commentId, token);

      await this.db.run(
        `UPDATE product_comments 
         SET content = ?, author_name = ?, updated_at = CURRENT_TIMESTAMP
         WHERE comment_id = ?`,
        [input.content.trim(), input.authorName || null, commentId]
      );

      const updated = await this.findCommentById(commentId, token);
      if (!updated) throw new NotFoundError('Comment', commentId);

      return updated;
    } catch (error) {
      if (error instanceof (ValidationError || NotFoundError || ConflictError)) throw error;
      handleDatabaseError(error, 'Comment', commentId);
      throw error;
    }
  }

  /**
   * Delete a comment and cascade to replies
   */
  async delete(commentId: number, token: string): Promise<void> {
    try {
      this.validateOwnershipToken(token);

      // Verify ownership
      await this.verifyCommentOwnership(commentId, token);

      // Delete cascades to replies and reactions via FOREIGN KEY ON DELETE CASCADE
      await this.db.run('DELETE FROM product_comments WHERE comment_id = ?', [commentId]);
    } catch (error) {
      if (error instanceof (ValidationError || NotFoundError)) throw error;
      handleDatabaseError(error, 'Comment', commentId);
      throw error;
    }
  }

  // ==================== REPLY QUERIES ====================

  /**
   * Fetch all replies for a comment, sorted newest first
   */
  async findRepliesByCommentId(commentId: number, userToken?: string): Promise<CommentReply[]> {
    try {
      const query = `
        SELECT 
          r.reply_id as replyId,
          r.comment_id as commentId,
          r.author_name as authorName,
          r.content,
          r.ownership_token as ownershipToken,
          r.created_at as createdAt,
          r.updated_at as updatedAt,
          0 as helpfulCount
        FROM comment_replies r
        WHERE r.comment_id = ?
        ORDER BY r.created_at DESC
      `;

      const rows = await this.db.all<DatabaseRow>(query, [commentId]);
      
      return rows.map(row => {
        const reply = objectToCamelCase<CommentReply>(row);
        reply.ownershipToken = undefined;
        return reply;
      });
    } catch (error) {
      handleDatabaseError(error, 'Reply', commentId);
      throw error;
    }
  }

  /**
   * Fetch replies owned by a specific token
   */
  async findOwnedRepliesByCommentId(commentId: number, token: string): Promise<CommentReply[]> {
    try {
      this.validateOwnershipToken(token);

      const query = `
        SELECT 
          r.reply_id as replyId,
          r.comment_id as commentId,
          r.author_name as authorName,
          r.content,
          r.ownership_token as ownershipToken,
          r.created_at as createdAt,
          r.updated_at as updatedAt,
          0 as helpfulCount
        FROM comment_replies r
        WHERE r.comment_id = ? AND r.ownership_token = ?
        ORDER BY r.created_at DESC
      `;

      const rows = await this.db.all<DatabaseRow>(query, [commentId, token]);
      
      return rows.map(row => {
        const reply = objectToCamelCase<CommentReply>(row);
        reply.ownershipToken = undefined;
        return reply;
      });
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      handleDatabaseError(error, 'Reply', commentId);
      throw error;
    }
  }

  // ==================== REPLY MUTATIONS ====================

  /**
   * Create a reply to a comment
   */
  async createReply(commentId: number, input: CreateReplyInput, token: string): Promise<CommentReply> {
    try {
      this.validateContent(input.content);
      this.validateAuthorName(input.authorName);
      this.validateOwnershipToken(token);

      // Validate comment exists
      const comment = await this.findCommentById(commentId);
      if (!comment) throw new NotFoundError('Comment', commentId);

      const result = await this.db.run(
        `INSERT INTO comment_replies (comment_id, author_name, content, ownership_token, created_at, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [commentId, input.authorName || null, input.content.trim(), token]
      );
      
      return {
        replyId: result.lastID as number,
        commentId,
        authorName: input.authorName,
        content: input.content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        helpfulCount: 0,
      };
    } catch (error) {
      if (error instanceof (ValidationError || NotFoundError || ConflictError)) throw error;
      handleDatabaseError(error, 'Reply', commentId);
      throw error;
    }
  }

  /**
   * Update a reply
   */
  async updateReply(replyId: number, input: UpdateReplyInput, token: string): Promise<CommentReply> {
    try {
      this.validateContent(input.content);
      this.validateAuthorName(input.authorName);
      this.validateOwnershipToken(token);

      // Verify ownership
      await this.verifyReplyOwnership(replyId, token);

      await this.db.run(
        `UPDATE comment_replies 
         SET content = ?, author_name = ?, updated_at = CURRENT_TIMESTAMP
         WHERE reply_id = ?`,
        [input.content.trim(), input.authorName || null, replyId]
      );

      // Fetch and return updated reply
      const query = `
        SELECT 
          r.reply_id as replyId,
          r.comment_id as commentId,
          r.author_name as authorName,
          r.content,
          r.ownership_token as ownershipToken,
          r.created_at as createdAt,
          r.updated_at as updatedAt,
          0 as helpfulCount
        FROM comment_replies r
        WHERE r.reply_id = ?
      `;

      const row = await this.db.get<DatabaseRow>(query, [replyId]);
      if (!row) throw new NotFoundError('Reply', replyId);

      const reply = objectToCamelCase<CommentReply>(row);
      reply.ownershipToken = undefined;
      return reply;
    } catch (error) {
      if (error instanceof (ValidationError || NotFoundError)) throw error;
      handleDatabaseError(error, 'Reply', replyId);
      throw error;
    }
  }

  /**
   * Delete a reply
   */
  async deleteReply(replyId: number, token: string): Promise<void> {
    try {
      this.validateOwnershipToken(token);

      // Verify ownership
      await this.verifyReplyOwnership(replyId, token);

      await this.db.run('DELETE FROM comment_replies WHERE reply_id = ?', [replyId]);
    } catch (error) {
      if (error instanceof (ValidationError || NotFoundError)) throw error;
      handleDatabaseError(error, 'Reply', replyId);
      throw error;
    }
  }

  // ==================== REACTION MUTATIONS ====================

  /**
   * Set or update a reaction (helpful/not helpful) on a comment
   * Uses UPSERT via INSERT ... ON CONFLICT
   */
  async setReaction(commentId: number, input: CreateReactionInput, token: string): Promise<void> {
    try {
      this.validateOwnershipToken(token);

      // Verify comment exists
      const comment = await this.findCommentById(commentId);
      if (!comment) throw new NotFoundError('Comment', commentId);

      const isHelpfulValue = input.isHelpful ? 1 : 0;
      await this.db.run(
        `INSERT INTO comment_reactions (comment_id, ownership_token, is_helpful, created_at, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (comment_id, ownership_token)
         DO UPDATE SET is_helpful = ?, updated_at = CURRENT_TIMESTAMP`,
        [commentId, token, isHelpfulValue, isHelpfulValue]
      );
    } catch (error) {
      if (error instanceof (ValidationError || NotFoundError)) throw error;
      handleDatabaseError(error, 'Reaction', commentId);
      throw error;
    }
  }

  /**
   * Remove a reaction from a comment
   */
  async removeReaction(commentId: number, token: string): Promise<void> {
    try {
      this.validateOwnershipToken(token);

      await this.db.run(
        'DELETE FROM comment_reactions WHERE comment_id = ? AND ownership_token = ?',
        [commentId, token]
      );
    } catch (error) {
      handleDatabaseError(error, 'Reaction', commentId);
      throw error;
    }
  }

  /**
   * Get reaction summary for a comment
   */
  async getReactionSummary(commentId: number): Promise<CommentReactionSummary> {
    try {
      const query = `
        SELECT
          COALESCE(SUM(CASE WHEN is_helpful = 1 THEN 1 ELSE 0 END), 0) as helpfulCount,
          COALESCE(SUM(CASE WHEN is_helpful = 0 THEN 1 ELSE 0 END), 0) as notHelpfulCount,
          COUNT(*) as total
        FROM comment_reactions
        WHERE comment_id = ?
      `;

      const row = await this.db.get<any>(query, [commentId]);
      
      return {
        helpfulCount: row?.helpfulCount || 0,
        notHelpfulCount: row?.notHelpfulCount || 0,
        total: row?.total || 0,
      };
    } catch (error) {
      handleDatabaseError(error, 'Reaction', commentId);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Fetch user's reaction to a specific comment (if exists)
   */
  private async findUserReactionByCommentId(commentId: number, token: string): Promise<UserReaction | undefined> {
    try {
      const query = `
        SELECT 
          reaction_id as reactionId,
          is_helpful as isHelpful
        FROM comment_reactions
        WHERE comment_id = ? AND ownership_token = ?
      `;

      const row = await this.db.get<any>(query, [commentId, token]);
      if (!row) return undefined;

      return {
        reactionId: row.reactionId,
        isHelpful: row.isHelpful === 1,
      };
    } catch (error) {
      handleDatabaseError(error, 'Reaction', commentId);
      throw error;
    }
  }

  /**
   * Validate content: 1-500 characters
   */
  private validateContent(content?: string): void {
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Comment content cannot be empty');
    }
    if (content.length > 500) {
      throw new ValidationError('Comment content must be 500 characters or less');
    }
  }

  /**
   * Validate author name: 0-100 characters
   */
  private validateAuthorName(name?: string): void {
    if (name && name.length > 100) {
      throw new ValidationError('Author name must be 100 characters or less');
    }
  }

  /**
   * Validate ownership token: 16-255 characters
   */
  private validateOwnershipToken(token: string): void {
    if (!token || token.length < 16 || token.length > 255) {
      throw new ValidationError('Invalid ownership token format');
    }
  }

  /**
   * Verify that a product exists
   */
  private async validateProductExists(productId: number): Promise<void> {
    const product = await this.db.get<{ product_id: number }>(
      'SELECT product_id FROM products WHERE product_id = ?',
      [productId]
    );
    if (!product) {
      throw new NotFoundError('Product', productId);
    }
  }

  /**
   * Verify that a comment exists and token matches owner
   */
  private async verifyCommentOwnership(commentId: number, token: string): Promise<void> {
    const comment = await this.db.get<any>(
      'SELECT ownership_token FROM product_comments WHERE comment_id = ?',
      [commentId]
    );

    if (!comment) {
      throw new NotFoundError('Comment', commentId);
    }

    if (comment.ownership_token !== token) {
      throw new NotFoundError('Comment', commentId);
    }
  }

  /**
   * Verify that a reply exists and token matches owner
   */
  private async verifyReplyOwnership(replyId: number, token: string): Promise<void> {
    const reply = await this.db.get<any>(
      'SELECT ownership_token FROM comment_replies WHERE reply_id = ?',
      [replyId]
    );

    if (!reply) {
      throw new NotFoundError('Reply', replyId);
    }

    if (reply.ownership_token !== token) {
      throw new NotFoundError('Reply', replyId);
    }
  }
}
