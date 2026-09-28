<?php
declare(strict_types=1);

function ds_route_orders_create(): void
{
    ds_orders_rate_limit();

    $name = isset($_POST['name']) ? trim((string) $_POST['name']) : '';
    if ($name === '' || mb_strlen($name) > 60) {
        throw ds_validation_failed('Name must be 1 to 60 characters.', ['name' => 'required']);
    }

    $phone = isset($_POST['phone']) ? ds_normalize_phone((string) $_POST['phone']) : null;
    if (!$phone) throw ds_validation_failed('Phone number must have 11 digits and start with 09.', ['phone' => 'invalid']);

    $itemsRaw = (string) ($_POST['items'] ?? '');
    $itemsInput = json_decode($itemsRaw, true);
    if ($itemsRaw === '' || (json_last_error() !== JSON_ERROR_NONE)) {
        throw ds_validation_failed('Items must be valid JSON.', ['items' => 'invalid']);
    }
    $items = ds_validate_order_items($itemsInput);

    if (!isset($_FILES['receipt']) || $_FILES['receipt']['error'] !== UPLOAD_ERR_OK) {
        throw ds_validation_failed('The receipt is required.', ['receipt' => 'required']);
    }
    $receiptBytes = file_get_contents($_FILES['receipt']['tmp_name']);
    $receiptSig = ds_assert_receipt($receiptBytes);

    $productIds = array_values(array_unique(array_column($items, 'productId')));
    $placeholders = implode(',', array_fill(0, count($productIds), '?'));
    $stmt = ds_pdo()->prepare("SELECT * FROM products WHERE id IN ($placeholders)");
    $stmt->execute($productIds);
    $byId = [];
    foreach ($stmt->fetchAll() as $row) $byId[$row['id']] = $row;

    $unavailable = array_values(array_filter($productIds, fn($id) => !isset($byId[$id]) || $byId[$id]['archived_at'] !== null));
    if ($unavailable) {
        throw new ApiError(409, 'product_unavailable', 'Some items are no longer available.', ['productIds' => $unavailable]);
    }

    $total = 0;
    foreach ($items as $item) {
        $total += $byId[$item['productId']]['price'] * $item['quantity'];
    }

    $orderId = ds_uuid4();
    $receiptKey = "receipts/{$orderId}.{$receiptSig['ext']}";

    try {
        ds_storage_put('receipts', $receiptKey, $receiptBytes);
    } catch (Throwable $e) {
        http_response_code(503);
        echo json_encode(['error' => ['code' => 'upload_failed', 'message' => 'Could not save the receipt. Please try again.']]);
        return;
    }

    $pdo = ds_pdo();
    try {
        $pdo->beginTransaction();
        $now = ds_now();
        $stmt = $pdo->prepare(
            'INSERT INTO orders (id, status, customer_name, customer_phone, total, receipt_key, receipt_mime, status_changed_at, created_at, updated_at)
             VALUES (?, "awaiting_review", ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$orderId, $name, $phone, $total, $receiptKey, $receiptSig['mime'], $now, $now, $now]);
        $number = (int) $pdo->lastInsertId();

        $itemStmt = $pdo->prepare(
            'INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity) VALUES (?, ?, ?, ?, ?, ?)'
        );
        foreach ($items as $item) {
            $product = $byId[$item['productId']];
            $itemStmt->execute([ds_uuid4(), $orderId, $product['id'], $product['name'], $product['price'], $item['quantity']]);
        }
        $pdo->commit();

        http_response_code(201);
        echo json_encode(['number' => $number, 'total' => $total, 'status' => 'awaiting_review']);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        ds_storage_delete('receipts', $receiptKey);
        throw $e;
    }
}
