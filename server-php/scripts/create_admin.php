<?php
declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('CLI only.');
}

// CLI only: php scripts/create_admin.php <username> <password>
// Creates an admin, or resets an existing one's password (and logs it out
// of all sessions) if the username already exists.

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/db.php';

$username = $argv[1] ?? null;
$password = $argv[2] ?? null;
if (!$username || !$password) {
    fwrite(STDERR, "Usage: php create_admin.php <username> <password>\n");
    exit(1);
}

$normalized = mb_strtolower(trim($username));
$hash = password_hash($password, PASSWORD_DEFAULT);
$pdo = ds_pdo();

$stmt = $pdo->prepare('SELECT id FROM admins WHERE username = ?');
$stmt->execute([$normalized]);
$existing = $stmt->fetch();

if ($existing) {
    $pdo->prepare('UPDATE admins SET password_hash = ? WHERE id = ?')->execute([$hash, $existing['id']]);
    $pdo->prepare('DELETE FROM sessions WHERE admin_id = ?')->execute([$existing['id']]);
    echo "Updated password for {$normalized} (logged out of all existing sessions).\n";
} else {
    $id = ds_uuid4();
    $pdo->prepare('INSERT INTO admins (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)')
        ->execute([$id, $normalized, $hash, ds_now()]);
    echo "Created admin {$normalized}.\n";
}
