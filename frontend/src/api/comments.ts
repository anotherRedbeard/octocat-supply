/**
 * Product Comments API Client
 * Provides functions to interact with product comments endpoints
 * Uses axios to match project conventions
 */

import axios from 'axios';
import {
  ProductComment,
  CommentReply,
  CreateCommentInput,
  UpdateCommentInput,
  CreateReplyInput,
  UpdateReplyInput,
} from '../models/productComment';
import { getOrCreateCommentToken } from './commentToken';
import { api } from './config';

const getCommentHeaders = () => ({
  'X-Comment-Token': getOrCreateCommentToken(),
});

// ==================== COMMENT QUERIES ====================

/**
 * Fetch all comments for a product
 */
export const getProductComments = async (productId: number): Promise<ProductComment[]> => {
  const { data } = await axios.get<ProductComment[]>(
    `${api.baseURL}${api.endpoints.products}/${productId}/comments`,
    { headers: getCommentHeaders() },
  );
  return data;
};

/**
 * Fetch a single comment by ID
 */
export const getCommentById = async (commentId: number): Promise<ProductComment> => {
  const { data } = await axios.get<ProductComment>(
    `${api.baseURL}/comments/${commentId}`,
    { headers: getCommentHeaders() },
  );
  return data;
};

// ==================== COMMENT MUTATIONS ====================

/**
 * Create a new comment on a product
 */
export const createComment = async (
  productId: number,
  input: CreateCommentInput,
): Promise<ProductComment> => {
  const { data } = await axios.post<ProductComment>(
    `${api.baseURL}${api.endpoints.products}/${productId}/comments`,
    input,
    { headers: getCommentHeaders() },
  );
  return data;
};

/**
 * Update a comment
 */
export const updateComment = async (
  commentId: number,
  input: UpdateCommentInput,
): Promise<ProductComment> => {
  const { data } = await axios.put<ProductComment>(
    `${api.baseURL}/comments/${commentId}`,
    input,
    { headers: getCommentHeaders() },
  );
  return data;
};

/**
 * Delete a comment
 */
export const deleteComment = async (commentId: number): Promise<void> => {
  await axios.delete(`${api.baseURL}/comments/${commentId}`, {
    headers: getCommentHeaders(),
  });
};

// ==================== REPLY MUTATIONS ====================

/**
 * Create a reply to a comment
 */
export const createReply = async (
  commentId: number,
  input: CreateReplyInput,
): Promise<CommentReply> => {
  const { data } = await axios.post<CommentReply>(
    `${api.baseURL}/comments/${commentId}/replies`,
    input,
    { headers: getCommentHeaders() },
  );
  return data;
};

/**
 * Update a reply
 */
export const updateReply = async (
  commentId: number,
  replyId: number,
  input: UpdateReplyInput,
): Promise<CommentReply> => {
  const { data } = await axios.put<CommentReply>(
    `${api.baseURL}/comments/${commentId}/replies/${replyId}`,
    input,
    { headers: getCommentHeaders() },
  );
  return data;
};

/**
 * Delete a reply
 */
export const deleteReply = async (commentId: number, replyId: number): Promise<void> => {
  await axios.delete(`${api.baseURL}/comments/${commentId}/replies/${replyId}`, {
    headers: getCommentHeaders(),
  });
};

// ==================== REACTION MUTATIONS ====================

/**
 * Set or update a reaction on a comment
 */
export const setReaction = async (commentId: number, isHelpful: boolean): Promise<void> => {
  await axios.post(
    `${api.baseURL}/comments/${commentId}/reactions`,
    { isHelpful },
    { headers: getCommentHeaders() },
  );
};

/**
 * Remove a reaction from a comment
 */
export const removeReaction = async (commentId: number): Promise<void> => {
  await axios.delete(`${api.baseURL}/comments/${commentId}/reactions`, {
    headers: getCommentHeaders(),
  });
};
