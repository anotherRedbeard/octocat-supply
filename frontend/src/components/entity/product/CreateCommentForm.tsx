/**
 * Create Comment Form
 * Form for adding new comments to products
 */

import { useState } from 'react';
import { CreateCommentInput } from '../../../models/productComment';

interface CreateCommentFormProps {
  onSubmit: (input: CreateCommentInput) => Promise<void>;
  isLoading: boolean;
}

export const CreateCommentForm = ({ onSubmit, isLoading }: CreateCommentFormProps) => {
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
      setError(err instanceof Error ? err.message : 'Failed to post comment');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg border border-blue-200 dark:border-blue-700 mb-6">
      <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Share Your Feedback</h3>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Your name (optional)"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value.slice(0, 100))}
          maxLength={100}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      <div className="mb-3">
        <textarea
          placeholder="Share your thoughts about this product (1-500 characters)..."
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, maxLength))}
          maxLength={maxLength}
          disabled={isLoading}
          rows={4}
          className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none"
        />
      </div>

      <div className="flex justify-between items-center mb-4">
        <span className={`text-sm ${charCount > maxLength * 0.9 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'}`}>
          {charCount} / {maxLength}
        </span>
      </div>

      {error && <div className="text-red-600 dark:text-red-400 text-sm mb-3">{error}</div>}

      <button
        type="submit"
        disabled={!isValid || isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Posting...' : 'Post Comment'}
      </button>
    </form>
  );
};
