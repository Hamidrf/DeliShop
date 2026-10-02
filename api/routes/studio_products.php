<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/product_photos.php';

function ds_fetch_product(string $id): ?array
{
    $stmt = ds_pdo()->prepare('SELECT * FROM products WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function ds_name_taken(string $name, ?string $excludeId = null): bool
{
    $sql = 'SELECT id FROM products WHERE archived_at IS NULL AND LOWER(name) = LOWER(?)';
    $params = [$name];
    if ($excludeId) {
        $sql .= ' AND id != ?';
        $params[] = $excludeId;
    }
    $stmt = ds_pdo()->prepare($sql . ' LIMIT 1');
    $stmt->execute($params);
    return (bool) $stmt->fetch();
}

function ds_route_studio_products_list(): void
{
    ds_require_admin();
    $archived = ($_GET['archived'] ?? '') === 'true';
    $sql = 'SELECT * FROM products WHERE archived_at IS ' . ($archived ? 'NOT NULL' : 'NULL') . ' ORDER BY created_at DESC';
    $rows = ds_pdo()->query($sql)->fetchAll();
    echo json_encode(['products' => array_map('ds_serialize_studio_product', $rows)]);
}

function ds_route_studio_products_create(): void
{
    ds_require_admin();

    $name = isset($_POST['name']) ? trim((string) $_POST['name']) : '';
    $category = (string) ($_POST['category'] ?? '');
    $color = (string) ($_POST['color'] ?? '');
    $priceRaw = (string) ($_POST['price'] ?? '');
    $story = isset($_POST['story']) ? (string) $_POST['story'] : '';

    $fields = [];
    if ($name === '' || mb_strlen($name) > 60) $fields['name'] = 'Required, 1 to 60 characters.';
    if (!in_array($category, DS_CATEGORIES, true)) $fields['category'] = 'Invalid category.';
    if (!in_array($color, DS_COLORS, true)) $fields['color'] = 'Invalid color.';
    if (!ctype_digit($priceRaw) || (int) $priceRaw <= 0) $fields['price'] = 'Must be a positive whole number.';
    if (mb_strlen($story) > 600) $fields['story'] = 'Max 600 characters.';
    if ($fields) throw ds_validation_failed('Please check the product fields.', $fields);
    $price = (int) $priceRaw;

    if (ds_name_taken($name)) throw new ApiError(409, 'name_taken', 'A product with this name already exists.');

    if (!isset($_FILES['drawing']) || $_FILES['drawing']['error'] !== UPLOAD_ERR_OK) {
        throw ds_validation_failed('The drawing is required.', ['drawing' => 'required']);
    }
    $drawingBytes = file_get_contents($_FILES['drawing']['tmp_name']);
    ds_assert_drawing($drawingBytes);
    $drawing = ds_process_drawing($drawingBytes);
    $drawingKey = 'products/drawing-' . ds_random_suffix() . '.webp';
    ds_storage_put('media', $drawingKey, $drawing['buffer']);

    $photoKeys = ds_upload_product_photos($_FILES['photos'] ?? null, 0);

    $voiceKey = null;
    $voiceMime = null;
    if (isset($_FILES['voice']) && $_FILES['voice']['error'] === UPLOAD_ERR_OK && $_FILES['voice']['size'] > 0) {
        $voiceBytes = file_get_contents($_FILES['voice']['tmp_name']);
        $sig = ds_assert_voice($voiceBytes);
        $voiceKey = 'products/voice-' . ds_random_suffix() . '.' . $sig['ext'];
        $voiceMime = $sig['mime'];
        ds_storage_put('media', $voiceKey, $voiceBytes);
    }

    $pdo = ds_pdo();
    $posRow = $pdo->query('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM products')->fetch();
    $next = (int) $posRow['next'];

    $id = ds_uuid4();
    $now = ds_now();
    $stmt = $pdo->prepare(
        'INSERT INTO products (id, name, category, color, price, story, drawing_key, drawing_width, drawing_height, drawing_crop, voice_key, voice_mime, position, archived_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, ?, ?)'
    );
    $stmt->execute([
        $id, $name, $category, $color, $price, $story, $drawingKey,
        $drawing['width'], $drawing['height'], $voiceKey, $voiceMime, $next, $now, $now,
    ]);
    ds_save_product_photos($id, $photoKeys, $now);

    http_response_code(201);
    echo json_encode(['product' => ds_serialize_studio_product(ds_fetch_product($id))]);
}

/**
 * Reads however many files were posted under `$field[]` (PHP's array-upload
 * layout: parallel `name`/`tmp_name`/`error`/`size` arrays under one key),
 * validates and re-encodes each as a product photo, and stores it. `$already`
 * is how many photos this product already has (kept ones on an edit), so the
 * combined total can be capped at DS_MAX_PRODUCT_PHOTOS. Returns the new keys,
 * in upload order.
 */
function ds_upload_product_photos(?array $files, int $already): array
{
    if ($files === null || !isset($files['name'])) return [];
    $names = is_array($files['name']) ? $files['name'] : [$files['name']];
    $count = count($names);
    if ($already + $count > DS_MAX_PRODUCT_PHOTOS) {
        throw ds_validation_failed('Up to ' . DS_MAX_PRODUCT_PHOTOS . ' photos per product.', ['photos' => 'too_many']);
    }

    $keys = [];
    for ($i = 0; $i < $count; $i++) {
        $error = is_array($files['error']) ? $files['error'][$i] : $files['error'];
        if ($error === UPLOAD_ERR_NO_FILE) continue;
        if ($error !== UPLOAD_ERR_OK) throw ds_validation_failed('One of the photos failed to upload.', ['photos' => 'upload_failed']);

        $tmpName = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
        $bytes = file_get_contents($tmpName);
        ds_assert_product_photo($bytes);
        $photo = ds_process_product_photo($bytes);
        $key = 'products/photo-' . ds_random_suffix() . '.webp';
        ds_storage_put('media', $key, $photo['buffer']);
        $keys[] = $key;
    }
    return $keys;
}

function ds_route_studio_products_update(string $id): void
{
    ds_require_admin();
    $existing = ds_fetch_product($id);
    if (!$existing) throw ds_not_found('Product not found.');

    $name = isset($_POST['name']) ? trim((string) $_POST['name']) : '';
    $category = (string) ($_POST['category'] ?? '');
    $color = (string) ($_POST['color'] ?? '');
    $priceRaw = (string) ($_POST['price'] ?? '');
    $story = isset($_POST['story']) ? (string) $_POST['story'] : '';

    $fields = [];
    if ($name === '' || mb_strlen($name) > 60) $fields['name'] = 'Required, 1 to 60 characters.';
    if (!in_array($category, DS_CATEGORIES, true)) $fields['category'] = 'Invalid category.';
    if (!in_array($color, DS_COLORS, true)) $fields['color'] = 'Invalid color.';
    if (!ctype_digit($priceRaw) || (int) $priceRaw <= 0) $fields['price'] = 'Must be a positive whole number.';
    if (mb_strlen($story) > 600) $fields['story'] = 'Max 600 characters.';
    if ($fields) throw ds_validation_failed('Please check the product fields.', $fields);
    $price = (int) $priceRaw;

    if (ds_name_taken($name, $id)) throw new ApiError(409, 'name_taken', 'Another active product already has this name.');

    $drawingKey = $existing['drawing_key'];
    $drawingWidth = (int) $existing['drawing_width'];
    $drawingHeight = (int) $existing['drawing_height'];
    if (isset($_FILES['drawing']) && $_FILES['drawing']['error'] === UPLOAD_ERR_OK) {
        $drawingBytes = file_get_contents($_FILES['drawing']['tmp_name']);
        ds_assert_drawing($drawingBytes);
        $drawing = ds_process_drawing($drawingBytes);
        $drawingKey = 'products/drawing-' . ds_random_suffix() . '.webp';
        ds_storage_put('media', $drawingKey, $drawing['buffer']);
        $drawingWidth = $drawing['width'];
        $drawingHeight = $drawing['height'];
    }

    $voiceKey = $existing['voice_key'];
    $voiceMime = $existing['voice_mime'];
    if (($_POST['removeVoice'] ?? '') === 'true') {
        $voiceKey = null;
        $voiceMime = null;
    }
    if (isset($_FILES['voice']) && $_FILES['voice']['error'] === UPLOAD_ERR_OK && $_FILES['voice']['size'] > 0) {
        $voiceBytes = file_get_contents($_FILES['voice']['tmp_name']);
        $sig = ds_assert_voice($voiceBytes);
        $voiceKey = 'products/voice-' . ds_random_suffix() . '.' . $sig['ext'];
        $voiceMime = $sig['mime'];
        ds_storage_put('media', $voiceKey, $voiceBytes);
    }

    // `keepPhotoKeys` (JSON array of strings) lists the product's existing
    // photo keys the client still wants, in the order they should appear;
    // any current photo not listed is dropped. Newly uploaded `photos[]`
    // files are appended after the kept ones.
    $keepRaw = (string) ($_POST['keepPhotoKeys'] ?? '[]');
    $keepRequested = json_decode($keepRaw, true);
    if (!is_array($keepRequested)) $keepRequested = [];
    $currentKeys = ds_fetch_product_photo_keys($id);
    $keep = array_values(array_intersect($keepRequested, $currentKeys));

    $newKeys = ds_upload_product_photos($_FILES['photos'] ?? null, count($keep));
    $finalKeys = array_merge($keep, $newKeys);

    $now = ds_now();
    ds_pdo()->prepare(
        'UPDATE products SET name = ?, category = ?, color = ?, price = ?, story = ?, drawing_key = ?, drawing_width = ?, drawing_height = ?, voice_key = ?, voice_mime = ?, updated_at = ? WHERE id = ?'
    )->execute([$name, $category, $color, $price, $story, $drawingKey, $drawingWidth, $drawingHeight, $voiceKey, $voiceMime, $now, $id]);

    ds_pdo()->prepare('DELETE FROM product_photos WHERE product_id = ?')->execute([$id]);
    ds_save_product_photos($id, $finalKeys, $now);

    echo json_encode(['product' => ds_serialize_studio_product(ds_fetch_product($id))]);
}

function ds_route_studio_products_delete(string $id): void
{
    ds_require_admin();
    $stmt = ds_pdo()->prepare('UPDATE products SET archived_at = ? WHERE id = ? AND archived_at IS NULL');
    $stmt->execute([ds_now(), $id]);
    if ($stmt->rowCount() === 0) throw ds_not_found('Product not found.');
    http_response_code(204);
}

function ds_route_studio_products_restore(string $id): void
{
    ds_require_admin();
    $existing = ds_fetch_product($id);
    if (!$existing) throw ds_not_found('Product not found.');

    if (ds_name_taken($existing['name'], $existing['id'])) {
        throw new ApiError(409, 'name_taken', 'Another active product already has this name.');
    }

    ds_pdo()->prepare('UPDATE products SET archived_at = NULL WHERE id = ?')->execute([$id]);
    echo json_encode(['product' => ds_serialize_studio_product(ds_fetch_product($id))]);
}
