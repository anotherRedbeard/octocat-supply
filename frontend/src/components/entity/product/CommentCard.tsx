/**
 * Comment Card
 * Displays a single product comment with edit/delete and reactions
 */

import { useState } from 'react';
import { ProductComment } from '../../../models/productComment';
import { RepliesSection } from './RepliesSection';

interface CommentCardProps {
  comment: ProductComment;
  canEdit: boolean;
  onUpdate: (input: { content: string; authorName?: string }) => Promise<void>;
  onDelete: () => Promise<void>;
  onCreateReply: (input: { content: string; authorName?: string }) => Promise<void>;
  onUpdateReply: (replyId: number, input: { content: string; authorName?: string }) => Promise<void>;
  onDeleteReply: (replyId: number) => Promise<void>;
  onSetReaction: (isHelpful: boolean) => Promise<void>;
  onRemoveReaction: () => Promise<void>;
}

export const CommentCard = ({
  comment,
  canEdit,
  onUpdate,
  onDelete,
  onCreateReply,
  onUpdateReply,
  onDeleteReply,
  onSetReaction,
  onRemoveReaction,
}: CommentCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [editAuthorName, setEditAuthorName] = useState(comment.authorName || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingReaction, setIsSettingReaction] = useState(false);

  const handleUpdate = async () => {
    if (!editContent.trim()) return;
    try {
      setIsUpdating(true);
      await onUpdate({
        content: editContent.trim(),
        authorName: editAuthorName.trim() || undefined,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update comment:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this comment and all its replies?')) return;
    try {
      setIsDeleting(true);
      await onDelete();
    } catch (error) {
      console.error('Failed to delete comment:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReaction = async (isHelpful: boolean) => {
    try {
      setIsSettingReaction(true);
      if (comment.userReaction?.isHelpful === isHelpful) {
        // Toggle off if same reaction
        await onRemoveReaction();
      } else {
        // Set new reaction
        await onSetReaction(isHelpful);
      }
    } catch (error) {
      console.error('Failed to set reaction:', error);
    } finally {
      setIsSettingReaction(false);
    }
  };

  const createdDate = new Date(comment.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: comment.createdAt.substring(0, 4) !== new Date().getFullYear().toString() ? 'numeric' : undefined,
  });

  if (isEditing) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
        <input
          type="text"
          value={editAuthorName}
          onChange={(e) => setEditAuthorName(e.target.value.slice(0, 100))}
          placeholder="Your name (optional)"
          maxLength={100}
          className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-3"
        />
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value.slice(0, 500))}
          maxLength={500}
          rows={4}
          className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-3 resize-none"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setIsEditing(false)}
            disabled={isUpdating}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-800 rounded transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            disabled={!editContent.trim() || isUpdating}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {comment.authorName || 'Anonymous'}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{createdDate}</span>
            {comment.createdAt !== comment.updatedAt && (
              <span className="text-sm text-gray-400 dark:text-gray-500 italic">(edited)</span>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(true)}
              disabled={isUpdating || isDeleting}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50"
              aria-label="Edit comment"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting || isUpdating}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
              aria-label="Delete comment"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <p className="text-gray-800 dark:text-gray-300 whitespace-pre-wrap mb-3">{comment.content}</p>

      {/* Reactions */}
      <div className="flex gap-3 mb-3">
        <button
          onClick={() => handleReaction(true)}
          disabled={isSettingReaction}
          className={`flex items-center gap-1 text-sm px-3 py-1 rounded transition ${
            comment.userReaction?.isHelpful === true
              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900'
          } disabled:opacity-50`}
          aria-label="Mark as helpful"
        >
          👍 Helpful {comment.helpfulCount > 0 && `(${comment.helpfulCount})`}
        </button>
      </div>

      {/* Replies */}
      <RepliesSection
        replies={comment.replies || []}
        onCreateReply={onCreateReply}
        onUpdateReply={onUpdateReply}
        onDeleteReply={onDeleteReply}
      />
    </div>
  );
};
