/**
 * Comment Token Management
 * Handles browser-local comment ownership token storage and retrieval
 * Pattern: Same as ratings token system
 */

const COMMENT_TOKEN_KEY = 'octocat.commentToken';

const generateOpaqueCommentToken = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `comment-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
};

/**
 * Get or create a comment ownership token
 * Generates a new UUID if one doesn't exist in localStorage
 */
export const getOrCreateCommentToken = (): string => {
  if (typeof window === 'undefined') {
    return 'server-comment-token';
  }

  const existing = window.localStorage.getItem(COMMENT_TOKEN_KEY);
  if (existing && existing.trim().length > 0) {
    return existing;
  }

  const token = generateOpaqueCommentToken();
  window.localStorage.setItem(COMMENT_TOKEN_KEY, token);
  return token;
};

/**
 * Clear the stored comment token (rarely needed, for testing/logout)
 */
export const clearCommentToken = (): void => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(COMMENT_TOKEN_KEY);
  }
};
