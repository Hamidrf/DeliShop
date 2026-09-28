<?php
declare(strict_types=1);

function ds_route_products_list(): void
{
    $stmt = ds_pdo()->query('SELECT * FROM products WHERE archived_at IS NULL ORDER BY position ASC');
    $rows = $stmt->fetchAll();
    header('Cache-Control: public, max-age=60');
    echo json_encode(['products' => array_map('ds_serialize_product', $rows)]);
}
