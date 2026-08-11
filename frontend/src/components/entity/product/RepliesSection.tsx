/**
 * Replies Section
 * Shows all replies to a comment with show/hide toggle
 */

import { useState } from 'react';
import { CommentReply } from '../../../models/productComment';
import { ReplyCard } from './ReplyCard';
import { CreateReplyForm } from './CreateReplyForm';

interface RepliesSectionProps {
  replies: CommentReply[];
  onCreateReply: (input: { content: string; authorName?: string }) => Promise<void>;
  onUpdateReply: (replyId: number, input: { content: string; authorName?: string }) => Promise<void>;
  onDeleteReply: (replyId: number) => Promise<void>;
}

export const RepliesSection = ({
  replies,
  onCreateReply,
  onUpdateReply,
  onDeleteReply,
}: RepliesSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  if (!replies || replies.length === 0) {
    return (
      <div className="mt-3">
        <button
          onClick={() => setIsReplying(!isReplying)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          + Add a reply
        </button>
        {isReplying && (
          <div className="mt-2">
            <CreateReplyForm
              onSubmit={async (input) => {
                setIsCreating(true);
                try {
                  await onCreateReply(input);
                  setIsReplying(false);
                } finally {
                  setIsCreating(false);
                }
              }}
              onCancel={() => setIsReplying(false)}
              isLoading={isCreating}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
      >
        {isExpanded ? '▼' : '▶'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
      </button>

      {isExpanded && (
        <div className="mt-3 pl-4 space-y-3 border-l-2 border-blue-200 dark:border-blue-700">
          {replies.map((reply) => (
            <ReplyCard
              key={reply.replyId}
              reply={reply}
              canEdit={!!reply.ownershipToken}
              onUpdate={(input) => onUpdateReply(reply.replyId, input)}
              onDelete={() => onDeleteReply(reply.replyId)}
            />
          ))}

          {!isReplying && (
            <button
              onClick={() => setIsReplying(true)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              + Add a reply
            </button>
          )}

          {isReplying && (
            <CreateReplyForm
              onSubmit={async (input) => {
                setIsCreating(true);
                try {
                  await onCreateReply(input);
                  setIsReplying(false);
                } finally {
                  setIsCreating(false);
                }
              }}
              onCancel={() => setIsReplying(false)}
              isLoading={isCreating}
            />
          )}
        </div>
      )}
    </div>
  );
};
