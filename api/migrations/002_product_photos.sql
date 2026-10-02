-- Adds multi-photo support to products: a product can now have 0-6 real
-- photos (shown as a slider in the shop) instead of exactly one.
--
-- `product_photos` replaces the old single `photo_key` column on `products`
-- with a proper child table, giving each photo an explicit order
-- (`position`) instead of an artificial one-photo cap. Same "no partial
-- unique index, enforce ordering in app code" style as the rest of this
-- schema -- see 001_init.sql's header comment.
--
-- Apply this by hand (e.g. via phpMyAdmin) the same way as 001_init.sql --
-- see server-php/README.md. IMPORTANT: run this BEFORE deploying the code
-- that expects `product_photos` to exist and no longer reads `photo_key`,
-- since a push to `main` goes live within seconds (see CLAUDE.md).

CREATE TABLE product_photos (
  id CHAR(36) NOT NULL PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  photo_key VARCHAR(255) NOT NULL,
  position INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  KEY product_photos_product_id_idx (product_id),
  CONSTRAINT product_photos_product_id_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Carry over each product's existing single photo, if it has one, as photo 0.
INSERT INTO product_photos (id, product_id, photo_key, position, created_at)
SELECT UUID(), id, photo_key, 0, created_at FROM products WHERE photo_key IS NOT NULL;

ALTER TABLE products DROP COLUMN photo_key;
