<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';

function ds_pdo(): PDO
{
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $c = ds_config();
    $dsn = "mysql:host={$c['db_host']};dbname={$c['db_name']};charset=utf8mb4";
    $pdo = new PDO($dsn, $c['db_user'], $c['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function ds_uuid4(): string
{
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

/** UTC "Y-m-d H:i:s.v" for a DATETIME(3) column. */
function ds_now(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s.v');
}

function ds_future(int $seconds): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))
        ->modify("+{$seconds} seconds")
        ->format('Y-m-d H:i:s.v');
}

/** Parses a DATETIME(3) column value (assumed UTC) into a DateTimeImmutable. */
function ds_parse_dt(string $value): DateTimeImmutable
{
    return new DateTimeImmutable($value, new DateTimeZone('UTC'));
}

function ds_iso(string $value): string
{
    return ds_parse_dt($value)->format('Y-m-d\TH:i:s.v\Z');
}
