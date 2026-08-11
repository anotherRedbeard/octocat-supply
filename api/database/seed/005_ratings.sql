-- Deterministic demo ratings for the product catalog
INSERT INTO ratings (rating_id, product_id, score, ownership_token) VALUES
(1, 1, 5, 'demo-rating-token-product-1'),
(2, 1, 4, 'demo-rating-token-product-1b'),
(3, 2, 4, 'demo-rating-token-product-2'),
(4, 3, 5, 'demo-rating-token-product-3'),
(5, 4, 3, 'demo-rating-token-product-4'),
(6, 5, 4, 'demo-rating-token-product-5');
