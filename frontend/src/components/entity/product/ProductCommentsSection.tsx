/**
 * Product Comments Section
 * Main container for product comments feature
 * Displays comment form, list of comments, and handles all operations
 */

import { ProductComment } from '../../../models/productComment';
import { useProductCommentsQuery } from '../../../api/useComments';
import {
  useCreateCommentMutation,
} from '../../../api/useComments';
import {
  updateComment,
  deleteComment,
  createReply,
  updateReply,
  deleteReply,
  setReaction,
  removeReaction,
} from '../../../api/comments';
import { CreateCommentForm } from './CreateCommentForm';
import { CommentCard } from './CommentCard';
import { CommentsSkeleton } from './CommentsSkeleton';

interface ProductCommentsSectionProps {
  productId: number;
}

export const ProductCommentsSection = ({ productId }: ProductCommentsSectionProps) => {
  const { data: comments = [], isLoading, error } = useProductCommentsQuery(productId);

  // Call all mutations at the top level (rules of hooks)
  const createCommentMutation = useCreateCommentMutation(productId);

  const handleCreateComment = async (input: { content: string; authorName?: string }) => {
    await createCommentMutation.mutateAsync(input);
  };

  return (
    <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-700 p-6 mb-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Feedback & Comments
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Share your thoughts and see what others think about this product
        </p>
      </div>

      <CreateCommentForm
        onSubmit={handleCreateComment}
        isLoading={createCommentMutation.isLoading}
      />

      {error && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded mb-6">
          Failed to load comments: {error.message}
        </div>
      )}

      {isLoading ? (
        <CommentsSkeleton />
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-gray-600 dark:text-gray-400">
          <p className="mb-2">No feedback yet</p>
          <p className="text-sm">Be the first to share your thoughts!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment: ProductComment) => (
            <CommentCard
              key={comment.commentId}
              comment={comment}
              canEdit={!!comment.ownershipToken}
              onUpdate={async (input) => {
                await updateComment(comment.commentId, input);
              }}
              onDelete={async () => {
                await deleteComment(comment.commentId);
              }}
              onCreateReply={async (input) => {
                await createReply(comment.commentId, input);
              }}
              onUpdateReply={async (replyId, input) => {
                await updateReply(comment.commentId, replyId, input);
              }}
              onDeleteReply={async (replyId) => {
                await deleteReply(comment.commentId, replyId);
              }}
              onSetReaction={async (isHelpful) => {
                await setReaction(comment.commentId, isHelpful);
              }}
              onRemoveReaction={async () => {
                await removeReaction(comment.commentId);
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
};
