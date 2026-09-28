<?php
declare(strict_types=1);

/**
 * Config comes from environment variables when present (local dev via
 * `php -S` with real env vars), otherwise from a private PHP file that
 * lives OUTSIDE the web root on production (so secrets are never in git or
 * web-accessible). See config.example.php for the file's shape.
 */
function ds_config(): array
{
    static $config = null;
    if ($config !== null) return $config;

    $externalPath = getenv('DELISHOP_CONFIG_FILE') ?: (__DIR__ . '/../../delishop-config.php');

    if (is_file($externalPath)) {
        $config = require $externalPath;
        return $config;
    }

    $config = [
        'db_host' => getenv('DB_HOST') ?: '127.0.0.1',
        'db_name' => getenv('DB_NAME') ?: 'delishop',
        'db_user' => getenv('DB_USER') ?: 'root',
        'db_pass' => getenv('DB_PASS') ?: '',
        'app_origin' => getenv('APP_ORIGIN') ?: 'http://localhost:8000',
        'is_production' => (getenv('APP_ENV') ?: 'development') === 'production',
        'media_dir' => getenv('MEDIA_DIR') ?: (__DIR__ . '/uploads/media'),
        'media_public_base' => getenv('MEDIA_PUBLIC_BASE_URL') ?: '/uploads/media',
        'receipts_dir' => getenv('RECEIPTS_DIR') ?: (__DIR__ . '/../uploads-private/receipts'),
        'owner_phone' => getenv('OWNER_PHONE') ?: '',
        'sms_api_key' => getenv('SMS_API_KEY') ?: '',
        'setup_token' => getenv('SETUP_TOKEN') ?: '',
    ];
    return $config;
}

/** TEMPORARY: reveals no secrets, just whether the external config file was found/used. */
function ds_config_debug_info(): array
{
    $externalPath = getenv('DELISHOP_CONFIG_FILE') ?: (__DIR__ . '/../../delishop-config.php');
    $c = ds_config();
    return [
        'php_version' => PHP_VERSION,
        'open_basedir' => ini_get('open_basedir') ?: null,
        'config_dir' => __DIR__,
        'external_config_path' => $externalPath,
        'external_config_is_file' => is_file($externalPath),
        'setup_token_len' => strlen((string) ($c['setup_token'] ?? '')),
        'db_pass_len' => strlen((string) ($c['db_pass'] ?? '')),
    ];
}
