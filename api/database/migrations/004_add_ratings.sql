-- Add product ratings
-- Migration 004: Create ratings table

CREATE TABLE ratings (
    rating_id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL,
    score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
    ownership_token TEXT NOT NULL CHECK (length(ownership_token) BETWEEN 16 AND 255),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    UNIQUE (product_id, ownership_token)
);

CREATE INDEX idx_ratings_product_id ON ratings(product_id);
CREATE INDEX idx_ratings_ownership_token ON ratings(ownership_token);
CREATE INDEX idx_ratings_product_ownership ON ratings(product_id, ownership_token);
