/**
 * Product Comment Models and DTOs
 * Defines types for comments, replies, reactions, and related data structures
 */

/**
 * A product comment entity
 */
export interface ProductComment {
  commentId: number;
  productId: number;
  authorName?: string;
  content: string;
  ownershipToken?: string; // Not exposed to frontend
  createdAt: string;
  updatedAt: string;
  replies?: CommentReply[];
  helpfulCount: number;
  userReaction?: UserReaction;
}

/**
 * A reply to a product comment (single level only)
 */
export interface CommentReply {
  replyId: number;
  commentId: number;
  authorName?: string;
  content: string;
  ownershipToken?: string; // Not exposed to frontend
  createdAt: string;
  updatedAt: string;
  helpfulCount: number;
  userReaction?: UserReaction;
}

/**
 * User's reaction to a comment (helpful or not helpful)
 */
export interface UserReaction {
  reactionId: number;
  isHelpful: boolean; // true = helpful (👍), false = not helpful (👎)
}

/**
 * Summary of reactions on a comment
 */
export interface CommentReactionSummary {
  helpfulCount: number;
  notHelpfulCount: number;
  total: number;
}

/**
 * Input DTO for creating a new comment
 */
export interface CreateCommentInput {
  authorName?: string; // Optional, max 100 chars
  content: string; // Required, 1-500 chars
}

/**
 * Input DTO for updating a comment
 */
export interface UpdateCommentInput {
  content: string; // Required, 1-500 chars
  authorName?: string; // Optional, can update name too
}

/**
 * Input DTO for creating a reply to a comment
 */
export interface CreateReplyInput {
  authorName?: string; // Optional, max 100 chars
  content: string; // Required, 1-500 chars
}

/**
 * Input DTO for updating a reply
 */
export interface UpdateReplyInput {
  content: string; // Required, 1-500 chars
  authorName?: string; // Optional, can update name too
}

/**
 * Input DTO for creating/updating a reaction
 */
export interface CreateReactionInput {
  isHelpful: boolean; // true for helpful, false for not helpful
}
