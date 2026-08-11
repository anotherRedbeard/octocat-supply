/**
 * React Query Hooks for Product Comments
 * Provides reusable hooks for fetching and mutating comment data
 * Uses react-query v3 to match project conventions
 */

import { useMutation, useQuery, useQueryClient } from 'react-query';
import {
  ProductComment,
  CreateCommentInput,
  UpdateCommentInput,
  CreateReplyInput,
  UpdateReplyInput,
} from '../models/productComment';
import { getOrCreateCommentToken } from './commentToken';
import * as commentsApi from './comments';

// Query keys for react-query cache
export const getProductCommentsQueryKey = (productId: number, token: string) => [
  'product-comments',
  productId,
  token,
] as const;

// ==================== QUERIES ====================

/**
 * Hook to fetch all comments for a product
 */
export const useProductCommentsQuery = (productId: number) => {
  const token = getOrCreateCommentToken();
  return useQuery<ProductComment[], Error>(
    getProductCommentsQueryKey(productId, token),
    () => commentsApi.getProductComments(productId),
    {
      enabled: Number.isInteger(productId) && productId > 0,
      staleTime: 30_000, // 30 seconds
    },
  );
};

/**
 * Hook to fetch a single comment by ID
 */
export const useCommentByIdQuery = (commentId: number) => {
  return useQuery<ProductComment, Error>(
    ['comment', commentId],
    () => commentsApi.getCommentById(commentId),
    {
      enabled: Number.isInteger(commentId) && commentId > 0,
      staleTime: 30_000,
    },
  );
};

// ==================== MUTATIONS ====================

/**
 * Hook to create a new comment
 */
export const useCreateCommentMutation = (productId: number) => {
  const queryClient = useQueryClient();
  const token = getOrCreateCommentToken();

  return useMutation<ProductComment, Error, CreateCommentInput>(
    (input: CreateCommentInput) => commentsApi.createComment(productId, input),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(getProductCommentsQueryKey(productId, token));
      },
    },
  );
};

/**
 * Hook to update a comment
 */
export const useUpdateCommentMutation = (commentId: number, productId: number) => {
  const queryClient = useQueryClient();
  const token = getOrCreateCommentToken();

  return useMutation<ProductComment, Error, UpdateCommentInput>(
    (input: UpdateCommentInput) => commentsApi.updateComment(commentId, input),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['comment', commentId]);
        queryClient.invalidateQueries(getProductCommentsQueryKey(productId, token));
      },
    },
  );
};

/**
 * Hook to delete a comment
 */
export const useDeleteCommentMutation = (commentId: number, productId: number) => {
  const queryClient = useQueryClient();
  const token = getOrCreateCommentToken();

  return useMutation<void, Error, void>(
    () => commentsApi.deleteComment(commentId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(getProductCommentsQueryKey(productId, token));
        queryClient.removeQueries(['comment', commentId]);
      },
    },
  );
};

/**
 * Hook to create a reply to a comment
 */
export const useCreateReplyMutation = (commentId: number, productId: number) => {
  const queryClient = useQueryClient();
  const token = getOrCreateCommentToken();

  return useMutation<any, Error, CreateReplyInput>(
    (input: CreateReplyInput) => commentsApi.createReply(commentId, input),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['comment', commentId]);
        queryClient.invalidateQueries(getProductCommentsQueryKey(productId, token));
      },
    },
  );
};

/**
 * Hook to update a reply
 */
export const useUpdateReplyMutation = (
  commentId: number,
  replyId: number,
  productId: number,
) => {
  const queryClient = useQueryClient();
  const token = getOrCreateCommentToken();

  return useMutation<any, Error, UpdateReplyInput>(
    (input: UpdateReplyInput) => commentsApi.updateReply(commentId, replyId, input),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['comment', commentId]);
        queryClient.invalidateQueries(getProductCommentsQueryKey(productId, token));
      },
    },
  );
};

/**
 * Hook to delete a reply
 */
export const useDeleteReplyMutation = (
  commentId: number,
  replyId: number,
  productId: number,
) => {
  const queryClient = useQueryClient();
  const token = getOrCreateCommentToken();

  return useMutation<void, Error, void>(
    () => commentsApi.deleteReply(commentId, replyId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['comment', commentId]);
        queryClient.invalidateQueries(getProductCommentsQueryKey(productId, token));
      },
    },
  );
};

/**
 * Hook to set a reaction on a comment
 */
export const useSetReactionMutation = (commentId: number, productId: number) => {
  const queryClient = useQueryClient();
  const token = getOrCreateCommentToken();

  return useMutation<void, Error, boolean>(
    (isHelpful: boolean) => commentsApi.setReaction(commentId, isHelpful),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['comment', commentId]);
        queryClient.invalidateQueries(getProductCommentsQueryKey(productId, token));
      },
    },
  );
};

/**
 * Hook to remove a reaction from a comment
 */
export const useRemoveReactionMutation = (commentId: number, productId: number) => {
  const queryClient = useQueryClient();
  const token = getOrCreateCommentToken();

  return useMutation<void, Error, void>(
    () => commentsApi.removeReaction(commentId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['comment', commentId]);
        queryClient.invalidateQueries(getProductCommentsQueryKey(productId, token));
      },
    },
  );
};
