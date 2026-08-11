-- Migration 005: Add Product Comments, Replies, and Reactions Tables
-- Created: 2026-08-11
-- Description: Implements product comments/feedback feature with single-level replies and helpful reactions

-- Product Comments Table
CREATE TABLE product_comments (
  comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  author_name TEXT,
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  ownership_token TEXT NOT NULL CHECK (length(ownership_token) BETWEEN 16 AND 255),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- Index for efficient product lookups and sorting by creation date
CREATE INDEX idx_product_comments_product_id ON product_comments(product_id, created_at DESC);

-- Comment Replies Table (Single level only - replies to comments, not to replies)
CREATE TABLE comment_replies (
  reply_id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL,
  author_name TEXT,
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  ownership_token TEXT NOT NULL CHECK (length(ownership_token) BETWEEN 16 AND 255),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (comment_id) REFERENCES product_comments(comment_id) ON DELETE CASCADE
);

-- Index for efficient reply lookups and sorting by creation date
CREATE INDEX idx_comment_replies_comment_id ON comment_replies(comment_id, created_at DESC);

-- Comment Reactions Table (One reaction per browser per comment)
CREATE TABLE comment_reactions (
  reaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL,
  ownership_token TEXT NOT NULL CHECK (length(ownership_token) BETWEEN 16 AND 255),
  is_helpful INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (comment_id, ownership_token),
  FOREIGN KEY (comment_id) REFERENCES product_comments(comment_id) ON DELETE CASCADE
);

-- Index for efficient reaction lookups
CREATE INDEX idx_comment_reactions_comment_id ON comment_reactions(comment_id);
