/**
 * Create Reply Form
 * Compact form for adding replies to comments
 */

import { useState } from 'react';
import { CreateReplyInput } from '../../../models/productComment';

interface CreateReplyFormProps {
  onSubmit: (input: CreateReplyInput) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export const CreateReplyForm = ({ onSubmit, onCancel, isLoading }: CreateReplyFormProps) => {
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const maxLength = 500;
  const charCount = content.length;
  const isValid = content.trim().length > 0 && content.length <= maxLength;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    try {
      setError(null);
      await onSubmit({
        content: content.trim(),
        authorName: authorName.trim() || undefined,
      });
      setContent('');
      setAuthorName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post reply');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-300 dark:border-gray-600">
      <div className="mb-3">
        <input
          type="text"
          placeholder="Your name (optional)"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value.slice(0, 100))}
          maxLength={100}
          disabled={isLoading}
          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      <div className="mb-2">
        <textarea
          placeholder="Write a reply..."
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, maxLength))}
          maxLength={maxLength}
          disabled={isLoading}
          rows={3}
          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 resize-none"
        />
      </div>

      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {charCount} / {maxLength}
        </span>
      </div>

      {error && <div className="text-red-600 dark:text-red-400 text-xs mb-2">{error}</div>}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="text-sm px-3 py-1 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!isValid || isLoading}
          className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Posting...' : 'Reply'}
        </button>
      </div>
    </form>
  );
};
