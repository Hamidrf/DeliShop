<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/errors.php';

/**
 * Fixed-window rate limiting backed by MySQL (mirrors server/src/lib/rateLimit.ts,
 * which used an in-memory store -- not viable here since a shared-hosting PHP
 * request is a fresh process each time with nothing persisted in memory).
 * Throws ds_rate_limited() once the limit is hit within the window.
 */
function ds_rate_limit(string $key, int $limit, int $windowSeconds): void
{
    $pdo = ds_pdo();
    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));

    $stmt = $pdo->prepare('SELECT window_start, hit_count FROM rate_limits WHERE bucket_key = ?');
    $stmt->execute([$key]);
    $row = $stmt->fetch();

    if (!$row) {
        $ins = $pdo->prepare('INSERT INTO rate_limits (bucket_key, window_start, hit_count) VALUES (?, ?, 1)
            ON DUPLICATE KEY UPDATE window_start = VALUES(window_start), hit_count = 1');
        $ins->execute([$key, $now->format('Y-m-d H:i:s.v')]);
        return;
    }

    $windowStart = ds_parse_dt($row['window_start']);
    if ($now->getTimestamp() - $windowStart->getTimestamp() >= $windowSeconds) {
        $upd = $pdo->prepare('UPDATE rate_limits SET window_start = ?, hit_count = 1 WHERE bucket_key = ?');
        $upd->execute([$now->format('Y-m-d H:i:s.v'), $key]);
        return;
    }

    if ((int) $row['hit_count'] >= $limit) {
        throw ds_rate_limited();
    }

    $upd = $pdo->prepare('UPDATE rate_limits SET hit_count = hit_count + 1 WHERE bucket_key = ?');
    $upd->execute([$key]);
}

function ds_client_ip(): string
{
    $forwarded = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? null;
    if ($forwarded) return trim(explode(',', $forwarded)[0]);
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

/** 300 requests/minute per IP, applied to the whole API. */
function ds_general_rate_limit(): void
{
    ds_rate_limit('general:' . ds_client_ip(), 300, 60);
}

/** 10 orders/hour per IP. */
function ds_orders_rate_limit(): void
{
    ds_rate_limit('orders:' . ds_client_ip(), 10, 60 * 60);
}

/** Throws if `key` is already at/over `limit` hits within the window, without recording a hit itself. */
function ds_rate_limit_peek(string $key, int $limit, int $windowSeconds): void
{
    $stmt = ds_pdo()->prepare('SELECT window_start, hit_count FROM rate_limits WHERE bucket_key = ?');
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    if (!$row) return;

    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $windowStart = ds_parse_dt($row['window_start']);
    if ($now->getTimestamp() - $windowStart->getTimestamp() >= $windowSeconds) return;

    if ((int) $row['hit_count'] >= $limit) throw ds_rate_limited();
}

/** Records one hit for `key` (a failed login), starting a fresh window if the previous one expired. */
function ds_rate_limit_hit(string $key, int $windowSeconds): void
{
    $pdo = ds_pdo();
    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));

    $stmt = $pdo->prepare('SELECT window_start FROM rate_limits WHERE bucket_key = ?');
    $stmt->execute([$key]);
    $row = $stmt->fetch();

    if (!$row || $now->getTimestamp() - ds_parse_dt($row['window_start'])->getTimestamp() >= $windowSeconds) {
        $ins = $pdo->prepare('INSERT INTO rate_limits (bucket_key, window_start, hit_count) VALUES (?, ?, 1)
            ON DUPLICATE KEY UPDATE window_start = VALUES(window_start), hit_count = 1');
        $ins->execute([$key, $now->format('Y-m-d H:i:s.v')]);
        return;
    }

    $upd = $pdo->prepare('UPDATE rate_limits SET hit_count = hit_count + 1 WHERE bucket_key = ?');
    $upd->execute([$key]);
}

/** 5 failed logins/15min per IP+username, so one guessed username doesn't lock out everyone on that IP. */
function ds_login_rate_limit_peek(string $username): void
{
    ds_rate_limit_peek('login:' . ds_client_ip() . ':' . $username, 5, 15 * 60);
}

function ds_login_rate_limit_record_failure(string $username): void
{
    ds_rate_limit_hit('login:' . ds_client_ip() . ':' . $username, 15 * 60);
}
