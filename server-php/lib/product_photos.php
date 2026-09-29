<?php
declare(strict_types=1);

/**
 * Shared by routes/studio_products.php (create/edit/list), lib/serialize.php
 * (API output) and lib/seed_data.php (CLI seeding, which doesn't load the
 * routes/ files) -- kept in its own lib file rather than routes/studio_products.php
 * so scripts/seed.php can use it without pulling in route handlers.
 */

/** A product's photo keys, in display order. */
function ds_fetch_product_photo_keys(string $productId): array
{
    $stmt = ds_pdo()->prepare('SELECT photo_key FROM product_photos WHERE product_id = ? ORDER BY position ASC');
    $stmt->execute([$productId]);
    return array_column($stmt->fetchAll(), 'photo_key');
}

/** Replaces nothing by itself -- callers that are re-saving a product's photos delete the old rows first. */
function ds_save_product_photos(string $productId, array $photoKeys, string $now): void
{
    $stmt = ds_pdo()->prepare(
        'INSERT INTO product_photos (id, product_id, photo_key, position, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    foreach (array_values($photoKeys) as $position => $key) {
        $stmt->execute([ds_uuid4(), $productId, $key, $position, $now]);
    }
}
