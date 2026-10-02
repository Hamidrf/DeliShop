<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/errors.php';
require_once __DIR__ . '/../config.php';

const SESSION_COOKIE = 'ds_session';
const SESSION_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days
const RENEW_WITHIN_SECONDS = 7 * 24 * 60 * 60; // renew once under 7 days remain

function ds_hash_token(string $token): string
{
    return hash('sha256', $token);
}

function ds_set_session_cookie(string $token): void
{
    $c = ds_config();
    setcookie(SESSION_COOKIE, $token, [
        'expires' => time() + SESSION_TTL_SECONDS,
        'path' => '/',
        'secure' => (bool) $c['is_production'],
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function ds_create_session(string $adminId): void
{
    $token = bin2hex(random_bytes(32));
    $stmt = ds_pdo()->prepare('INSERT INTO sessions (id, admin_id, expires_at, created_at) VALUES (?, ?, ?, ?)');
    $stmt->execute([ds_hash_token($token), $adminId, ds_future(SESSION_TTL_SECONDS), ds_now()]);
    ds_set_session_cookie($token);
}

function ds_destroy_session(): void
{
    $token = $_COOKIE[SESSION_COOKIE] ?? null;
    if ($token) {
        $stmt = ds_pdo()->prepare('DELETE FROM sessions WHERE id = ?');
        $stmt->execute([ds_hash_token($token)]);
    }
    setcookie(SESSION_COOKIE, '', ['expires' => 1, 'path' => '/']);
}

/** Resolves the logged-in admin for the current request, if any. Slides the session's expiry forward when it's getting close. */
function ds_current_admin(): ?array
{
    $token = $_COOKIE[SESSION_COOKIE] ?? null;
    if (!$token) return null;

    $stmt = ds_pdo()->prepare(
        'SELECT s.admin_id AS admin_id, s.expires_at AS expires_at, a.username AS username
         FROM sessions s INNER JOIN admins a ON a.id = s.admin_id
         WHERE s.id = ? LIMIT 1'
    );
    $stmt->execute([ds_hash_token($token)]);
    $row = $stmt->fetch();
    if (!$row) return null;

    $expiresAt = ds_parse_dt($row['expires_at']);
    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    if ($expiresAt < $now) return null;

    if (($expiresAt->getTimestamp() - $now->getTimestamp()) < RENEW_WITHIN_SECONDS) {
        $upd = ds_pdo()->prepare('UPDATE sessions SET expires_at = ? WHERE id = ?');
        $upd->execute([ds_future(SESSION_TTL_SECONDS), ds_hash_token($token)]);
        ds_set_session_cookie($token);
    }

    return ['id' => $row['admin_id'], 'username' => $row['username']];
}

/** Call at the top of any studio route. Throws ds_not_logged_in() and stops execution if not authenticated. */
function ds_require_admin(): array
{
    $admin = ds_current_admin();
    if (!$admin) throw ds_not_logged_in();
    return $admin;
}
