-- Migration 003: Add carts and cart items tables

CREATE TABLE carts (
    cart_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE
);

CREATE TABLE cart_items (
    cart_item_id INTEGER PRIMARY KEY,
    cart_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price REAL NOT NULL CHECK (price >= 0),
    UNIQUE (cart_id, product_id),
    FOREIGN KEY (cart_id) REFERENCES carts(cart_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

CREATE INDEX idx_carts_user_id ON carts(user_id);
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);
