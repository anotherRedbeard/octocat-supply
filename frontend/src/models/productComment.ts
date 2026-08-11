/**
 * Product Comments Type Definitions
 * Shared frontend models for product comments, replies, and reactions
 */

// ==================== READ MODELS ====================

export interface ProductComment {
  commentId: number;
  productId: number;
  authorName?: string;
  content: string;
  ownershipToken?: string;
  createdAt: string;
  updatedAt: string;
  replies?: CommentReply[];
  helpfulCount: number;
  userReaction?: UserReaction;
}

export interface CommentReply {
  replyId: number;
  commentId: number;
  authorName?: string;
  content: string;
  ownershipToken?: string;
  createdAt: string;
  updatedAt: string;
  helpfulCount: number;
  userReaction?: UserReaction;
}

export interface UserReaction {
  reactionId: number;
  isHelpful: boolean;
}

export interface CommentReactionSummary {
  helpfulCount: number;
  notHelpfulCount: number;
  total: number;
}

// ==================== CREATE/UPDATE INPUTS ====================

export interface CreateCommentInput {
  authorName?: string;
  content: string;
}

export interface UpdateCommentInput {
  authorName?: string;
  content: string;
}

export interface CreateReplyInput {
  authorName?: string;
  content: string;
}

export interface UpdateReplyInput {
  authorName?: string;
  content: string;
}

export interface CreateReactionInput {
  isHelpful: boolean;
}
