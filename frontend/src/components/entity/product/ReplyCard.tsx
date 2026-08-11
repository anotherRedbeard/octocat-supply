/**
 * Reply Card
 * Displays a single reply within a comment
 */

import { useState } from 'react';
import { CommentReply } from '../../../models/productComment';
import { CreateReplyForm } from './CreateReplyForm';

interface ReplyCardProps {
  reply: CommentReply;
  canEdit: boolean;
  onUpdate: (input: { content: string; authorName?: string }) => Promise<void>;
  onDelete: () => Promise<void>;
}

export const ReplyCard = ({ reply, canEdit, onUpdate, onDelete }: ReplyCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleUpdate = async (input: { content: string; authorName?: string }) => {
    try {
      setIsUpdating(true);
      await onUpdate(input);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update reply:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this reply?')) return;
    try {
      setIsDeleting(true);
      await onDelete();
    } catch (error) {
      console.error('Failed to delete reply:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const createdDate = new Date(reply.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: reply.createdAt.substring(0, 4) !== new Date().getFullYear().toString() ? 'numeric' : undefined,
  });

  if (isEditing) {
    return (
      <CreateReplyForm
        onSubmit={handleUpdate}
        onCancel={() => setIsEditing(false)}
        isLoading={isUpdating}
      />
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-300 dark:border-gray-600">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              {reply.authorName || 'Anonymous'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{createdDate}</span>
            {reply.createdAt !== reply.updatedAt && (
              <span className="text-xs text-gray-400 dark:text-gray-500 italic">(edited)</span>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-1">
            <button
              onClick={() => setIsEditing(true)}
              disabled={isUpdating || isDeleting}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50"
              aria-label="Edit reply"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting || isUpdating}
              className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
              aria-label="Delete reply"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-800 dark:text-gray-300 whitespace-pre-wrap">{reply.content}</p>
    </div>
  );
};
