<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';

/**
 * Disk-only storage (no S3 -- this rewrite targets a single shared-hosting
 * box, per the "no extra cost" decision). `media` lives inside public_html
 * so Apache serves it directly; `receipts` lives outside public_html and is
 * only ever read through the authenticated receipt route.
 */
function ds_storage_root(string $bucket): string
{
    $c = ds_config();
    return $bucket === 'receipts' ? $c['receipts_dir'] : $c['media_dir'];
}

function ds_storage_put(string $bucket, string $key, string $data): void
{
    $path = ds_storage_root($bucket) . '/' . $key;
    $dir = dirname($path);
    if (!is_dir($dir)) mkdir($dir, 0775, true);
    file_put_contents($path, $data);
}

function ds_storage_delete(string $bucket, string $key): void
{
    $path = ds_storage_root($bucket) . '/' . $key;
    if (is_file($path)) unlink($path);
}

/** Returns ['body' => string, 'contentType' => string] or null. */
function ds_storage_get(string $bucket, string $key): ?array
{
    $path = ds_storage_root($bucket) . '/' . $key;
    if (!is_file($path)) return null;
    return ['body' => file_get_contents($path), 'contentType' => ds_mime_from_key($key)];
}

function ds_mime_from_key(string $key): string
{
    $ext = strtolower(pathinfo($key, PATHINFO_EXTENSION));
    $table = [
        'webp' => 'image/webp', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png',
        'heic' => 'image/heic', 'webm' => 'audio/webm', 'm4a' => 'audio/mp4', 'mp3' => 'audio/mpeg', 'ogg' => 'audio/ogg',
    ];
    return $table[$ext] ?? 'application/octet-stream';
}

/** Public URL for a `media` key. Never call this for `receipts`. */
function ds_storage_public_url(string $key): string
{
    $c = ds_config();
    return rtrim($c['media_public_base'], '/') . '/' . $key;
}

/** A short random suffix so replacing a file at "the same" logical key busts caches. */
function ds_random_suffix(): string
{
    return bin2hex(random_bytes(4));
}
