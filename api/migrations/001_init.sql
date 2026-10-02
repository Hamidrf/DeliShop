-- MySQL/MariaDB schema for DeliShop (translated from server/src/db/schema.ts).
-- Notes on deliberate differences from the Postgres version:
--   - IDs are CHAR(36) UUIDs generated in PHP (no gen_random_uuid() equivalent needed).
--   - `orders.number` uses AUTO_INCREMENT (starting at 1001) instead of a
--     Postgres sequence -- MySQL allows AUTO_INCREMENT on a non-primary
--     column as long as it has its own unique index.
--   - No partial/filtered unique index support: the "unique active product
--     name" rule is enforced in application code (routes/studio_products.php)
--     instead of a DB constraint. There's a small race window between the
--     check and the insert, acceptable for this single-admin, low-traffic app.
--   - Times are stored as DATETIME(3) in UTC (no tz-aware type in MySQL);
--     the application always reads/writes them as UTC.
--   - No CHECK constraints: some shared-hosting MySQL/phpMyAdmin setups choke
--     on the `CONSTRAINT ... CHECK (...)` syntax. price > 0 and quantity
--     1-20 are validated in application code anyway (routes/orders.php,
--     routes/studio_products.php), so nothing relies on these at the DB level.

SET NAMES utf8mb4;

CREATE TABLE admins (
  id CHAR(36) NOT NULL PRIMARY KEY,
  username VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY admins_username_unique (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sessions (
  id CHAR(64) NOT NULL PRIMARY KEY,
  admin_id CHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  KEY sessions_expires_at_idx (expires_at),
  KEY sessions_admin_id_idx (admin_id),
  CONSTRAINT sessions_admin_id_fk FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  category ENUM('Keychains', 'Earrings', 'Pins') NOT NULL,
  color ENUM('mint', 'pink', 'orange', 'purple', 'yellow', 'green') NOT NULL,
  price INT NOT NULL,
  story VARCHAR(600) NOT NULL DEFAULT '',
  drawing_key VARCHAR(255) NOT NULL,
  drawing_width INT NOT NULL,
  drawing_height INT NOT NULL,
  drawing_crop JSON NULL,
  photo_key VARCHAR(255) NULL,
  voice_key VARCHAR(255) NULL,
  voice_mime VARCHAR(60) NULL,
  position INT NOT NULL,
  archived_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY products_position_idx (position),
  KEY products_archived_at_idx (archived_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
  id CHAR(36) NOT NULL PRIMARY KEY,
  number INT NOT NULL AUTO_INCREMENT,
  status ENUM('awaiting_review', 'confirmed', 'shipped', 'rejected', 'cancelled') NOT NULL DEFAULT 'awaiting_review',
  customer_name VARCHAR(60) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  total INT NOT NULL,
  receipt_key VARCHAR(255) NOT NULL,
  receipt_mime VARCHAR(60) NOT NULL,
  admin_note VARCHAR(2000) NULL,
  status_changed_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY orders_number_unique (number),
  KEY orders_status_created_at_idx (status, created_at),
  KEY orders_customer_phone_idx (customer_phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1001;

CREATE TABLE order_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  product_id CHAR(36) NULL,
  product_name VARCHAR(60) NOT NULL,
  unit_price INT NOT NULL,
  quantity INT NOT NULL,
  KEY order_items_order_id_idx (order_id),
  CONSTRAINT order_items_order_id_fk FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT order_items_product_id_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rate_limits (
  bucket_key VARCHAR(190) NOT NULL PRIMARY KEY,
  window_start DATETIME(3) NOT NULL,
  hit_count INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
