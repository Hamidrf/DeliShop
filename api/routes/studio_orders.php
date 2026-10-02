<?php
declare(strict_types=1);

const DS_PAGE_SIZE = 50;

function ds_decode_cursor(?string $raw): ?array
{
    if (!$raw) return null;
    $decoded = base64_decode(strtr($raw, '-_', '+/'), true);
    if ($decoded === false) return null;
    $parts = explode('|', $decoded, 2);
    if (count($parts) !== 2) return null;
    return ['createdAt' => $parts[0], 'id' => $parts[1]];
}

function ds_encode_cursor(string $createdAtIso, string $id): string
{
    return rtrim(strtr(base64_encode("{$createdAtIso}|{$id}"), '+/', '-_'), '=');
}

function ds_route_studio_orders_list(): void
{
    ds_require_admin();
    $statusParam = $_GET['status'] ?? null;
    if ($statusParam !== null && !in_array($statusParam, DS_ORDER_STATUSES, true)) {
        throw ds_validation_failed('Unknown order status.', ['status' => 'invalid']);
    }
    $cursor = ds_decode_cursor($_GET['cursor'] ?? null);

    $where = [];
    $params = [];
    if ($statusParam !== null) {
        $where[] = 'status = ?';
        $params[] = $statusParam;
    }
    if ($cursor) {
        $where[] = '(created_at, id) < (?, ?)';
        $params[] = ds_parse_dt($cursor['createdAt'])->format('Y-m-d H:i:s.v');
        $params[] = $cursor['id'];
    }
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $sql = "SELECT id, number, status, customer_name, customer_phone, total, created_at,
                   (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = orders.id) AS item_count
            FROM orders $whereSql
            ORDER BY created_at DESC, id DESC
            LIMIT " . DS_PAGE_SIZE;
    $stmt = ds_pdo()->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $out = array_map(fn($o) => [
        'id' => $o['id'],
        'number' => (int) $o['number'],
        'status' => $o['status'],
        'customerName' => $o['customer_name'],
        'customerPhone' => $o['customer_phone'],
        'total' => (int) $o['total'],
        'itemCount' => (int) $o['item_count'],
        'createdAt' => ds_iso($o['created_at']),
    ], $rows);

    $last = end($rows) ?: null;
    $nextCursor = (count($rows) === DS_PAGE_SIZE && $last) ? ds_encode_cursor(ds_iso($last['created_at']), $last['id']) : null;

    echo json_encode(['orders' => $out, 'nextCursor' => $nextCursor]);
}

function ds_load_order(string $id): ?array
{
    $stmt = ds_pdo()->prepare('SELECT * FROM orders WHERE id = ?');
    $stmt->execute([$id]);
    $order = $stmt->fetch();
    if (!$order) return null;
    $itemsStmt = ds_pdo()->prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC');
    $itemsStmt->execute([$id]);
    return ['order' => $order, 'items' => $itemsStmt->fetchAll()];
}

function ds_route_studio_orders_get(string $id): void
{
    ds_require_admin();
    $found = ds_load_order($id);
    if (!$found) throw ds_not_found('Order not found.');
    $order = $found['order'];
    $items = $found['items'];

    echo json_encode(['order' => [
        'id' => $order['id'],
        'number' => (int) $order['number'],
        'status' => $order['status'],
        'customerName' => $order['customer_name'],
        'customerPhone' => $order['customer_phone'],
        'total' => (int) $order['total'],
        'adminNote' => $order['admin_note'],
        'createdAt' => ds_iso($order['created_at']),
        'items' => array_map(fn($i) => [
            'productId' => $i['product_id'],
            'productName' => $i['product_name'],
            'unitPrice' => (int) $i['unit_price'],
            'quantity' => (int) $i['quantity'],
        ], $items),
        'receiptUrl' => "/api/studio/orders/{$order['id']}/receipt",
    ]]);
}

function ds_route_studio_orders_receipt(string $id): void
{
    ds_require_admin();
    $stmt = ds_pdo()->prepare('SELECT * FROM orders WHERE id = ?');
    $stmt->execute([$id]);
    $order = $stmt->fetch();
    if (!$order) throw ds_not_found('Order not found.');
    $file = ds_storage_get('receipts', $order['receipt_key']);
    if (!$file) throw ds_not_found('Receipt file not found.');

    header('Content-Type: ' . $order['receipt_mime']);
    header("Content-Disposition: inline; filename=\"receipt-{$order['number']}\"");
    header('Cache-Control: private, no-store');
    echo $file['body'];
}

function ds_route_studio_orders_patch(string $id): void
{
    ds_require_admin();
    $body = ds_json_body();
    if (!is_array($body)) throw ds_validation_failed('Invalid order update.');

    $status = $body['status'] ?? null;
    if ($status !== null && (!is_string($status) || !in_array($status, DS_ORDER_STATUSES, true))) {
        throw ds_validation_failed('Invalid order update.');
    }
    $hasAdminNote = array_key_exists('adminNote', $body);
    $adminNote = $hasAdminNote ? $body['adminNote'] : null;
    if ($hasAdminNote && $adminNote !== null && (!is_string($adminNote) || mb_strlen($adminNote) > 2000)) {
        throw ds_validation_failed('Invalid order update.');
    }

    $stmt = ds_pdo()->prepare('SELECT * FROM orders WHERE id = ?');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) throw ds_not_found('Order not found.');

    if ($status !== null && $status !== $existing['status']) {
        $allowed = DS_ALLOWED_TRANSITIONS[$existing['status']] ?? [];
        if (!in_array($status, $allowed, true)) {
            throw new ApiError(422, 'invalid_transition', "Can't move an order from {$existing['status']} to {$status}.", [
                'from' => $existing['status'], 'to' => $status,
            ]);
        }
    }

    $sets = ['updated_at = ?'];
    $params = [ds_now()];
    if ($status !== null) {
        $sets[] = 'status = ?';
        $params[] = $status;
        $sets[] = 'status_changed_at = ?';
        $params[] = ds_now();
    }
    if ($hasAdminNote) {
        $sets[] = 'admin_note = ?';
        $params[] = $adminNote;
    }
    $params[] = $id;
    ds_pdo()->prepare('UPDATE orders SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);

    $stmt2 = ds_pdo()->prepare('SELECT * FROM orders WHERE id = ?');
    $stmt2->execute([$id]);
    $updated = $stmt2->fetch();

    echo json_encode(['order' => [
        'id' => $updated['id'],
        'number' => (int) $updated['number'],
        'status' => $updated['status'],
        'customerName' => $updated['customer_name'],
        'customerPhone' => $updated['customer_phone'],
        'total' => (int) $updated['total'],
        'adminNote' => $updated['admin_note'],
        'createdAt' => ds_iso($updated['created_at']),
    ]]);
}
