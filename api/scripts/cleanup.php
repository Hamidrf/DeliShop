<?php
declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('CLI only.');
}

// Run daily via a cPanel Cron Job: php /home/deliar/public_html/api/scripts/cleanup.php
// Removes expired sessions and receipts for orders that have been done with
// for over a year (a customer's financial document, but not needed forever).

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/storage.php';

$pdo = ds_pdo();

$deletedSessions = $pdo->exec('DELETE FROM sessions WHERE expires_at < NOW()');
if ($deletedSessions) echo "Removed {$deletedSessions} expired session(s).\n";

$cutoff = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->modify('-365 days')->format('Y-m-d H:i:s.v');
$stmt = $pdo->prepare(
    "SELECT id, receipt_key FROM orders WHERE status IN ('shipped', 'rejected') AND status_changed_at < ?"
);
$stmt->execute([$cutoff]);
$stale = $stmt->fetchAll();

foreach ($stale as $order) {
    ds_storage_delete('receipts', $order['receipt_key']);
}
if ($stale) echo 'Removed ' . count($stale) . " old receipt(s).\n";
