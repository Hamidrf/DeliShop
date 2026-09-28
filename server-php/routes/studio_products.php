<?php
declare(strict_types=1);

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

    $photoKey = null;
    if (isset($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK && $_FILES['photo']['size'] > 0) {
        $photoBytes = file_get_contents($_FILES['photo']['tmp_name']);
        ds_assert_product_photo($photoBytes);
        $photo = ds_process_product_photo($photoBytes);
        $photoKey = 'products/photo-' . ds_random_suffix() . '.webp';
        ds_storage_put('media', $photoKey, $photo['buffer']);
    }

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
        'INSERT INTO products (id, name, category, color, price, story, drawing_key, drawing_width, drawing_height, drawing_crop, photo_key, voice_key, voice_mime, position, archived_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL, ?, ?)'
    );
    $stmt->execute([
        $id, $name, $category, $color, $price, $story, $drawingKey,
        $drawing['width'], $drawing['height'], $photoKey, $voiceKey, $voiceMime, $next, $now, $now,
    ]);

    http_response_code(201);
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
