<?php
declare(strict_types=1);

/** A verify run against a hash nobody has, so a wrong username takes the same time as a wrong password. */
function ds_dummy_hash(): string
{
    static $hash = null;
    if ($hash === null) $hash = password_hash('not-a-real-password', PASSWORD_DEFAULT);
    return $hash;
}

function ds_route_auth_login(): void
{
    $body = ds_json_body();
    $username = is_array($body) && isset($body['username']) && is_string($body['username']) ? $body['username'] : '';
    $password = is_array($body) && isset($body['password']) && is_string($body['password']) ? $body['password'] : '';
    if ($username === '' || $password === '') {
        throw ds_validation_failed('Username and password are required.');
    }
    $normalized = mb_strtolower(trim($username));

    ds_login_rate_limit_peek($normalized);

    $stmt = ds_pdo()->prepare('SELECT * FROM admins WHERE username = ? LIMIT 1');
    $stmt->execute([$normalized]);
    $admin = $stmt->fetch();

    if ($admin) {
        $ok = password_verify($password, $admin['password_hash']);
    } else {
        password_verify($password, ds_dummy_hash());
        $ok = false;
    }

    if (!$admin || !$ok) {
        ds_login_rate_limit_record_failure($normalized);
        http_response_code(401);
        echo json_encode(['error' => ['code' => 'invalid_credentials', 'message' => 'That username or password is wrong.']]);
        return;
    }

    ds_create_session($admin['id']);
    echo json_encode(['username' => $admin['username']]);
}

function ds_route_auth_logout(): void
{
    ds_destroy_session();
    http_response_code(204);
}

function ds_route_auth_me(): void
{
    $admin = ds_current_admin();
    if (!$admin) throw ds_not_logged_in();
    echo json_encode(['username' => $admin['username']]);
}

/**
 * HTTP equivalent of scripts/create_admin.php, for hosts with no
 * Terminal/SSH access. Only reachable when config('setup_token') is set to
 * a non-empty secret (see config.example.php) -- disabled (404) otherwise.
 * Creates the admin, or resets an existing one's password (logging it out
 * of all sessions) if the username already exists.
 */
function ds_route_setup_create_admin(): void
{
    $c = ds_config();
    $configuredToken = $c['setup_token'] ?? '';
    if ($configuredToken === '') throw ds_not_found();

    $body = ds_json_body();
    $token = is_array($body) && isset($body['token']) && is_string($body['token']) ? $body['token'] : '';
    if (!hash_equals($configuredToken, $token)) throw ds_not_found();

    $username = is_array($body) && isset($body['username']) && is_string($body['username']) ? trim($body['username']) : '';
    $password = is_array($body) && isset($body['password']) && is_string($body['password']) ? $body['password'] : '';
    if ($username === '' || strlen($password) < 8) {
        throw ds_validation_failed('username and password (8+ characters) are required.');
    }

    $normalized = mb_strtolower($username);
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $pdo = ds_pdo();

    $stmt = $pdo->prepare('SELECT id FROM admins WHERE username = ?');
    $stmt->execute([$normalized]);
    $existing = $stmt->fetch();

    if ($existing) {
        $pdo->prepare('UPDATE admins SET password_hash = ? WHERE id = ?')->execute([$hash, $existing['id']]);
        $pdo->prepare('DELETE FROM sessions WHERE admin_id = ?')->execute([$existing['id']]);
        echo json_encode(['ok' => true, 'action' => 'password_reset', 'username' => $normalized]);
    } else {
        $id = ds_uuid4();
        $pdo->prepare('INSERT INTO admins (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)')
            ->execute([$id, $normalized, $hash, ds_now()]);
        echo json_encode(['ok' => true, 'action' => 'created', 'username' => $normalized]);
    }
}

/**
 * TEMPORARY: checks whether this PHP process can reach GitHub over HTTPS,
 * to find out whether a self-pull deploy script (run via cPanel Cron Job)
 * is viable, since cPanel's own Git Version Control can't reach GitHub from
 * this host. Same setup_token gate. Remove once this question is settled.
 */
function ds_route_setup_connectivity_check(): void
{
    $c = ds_config();
    $configuredToken = $c['setup_token'] ?? '';
    if ($configuredToken === '') throw ds_not_found();

    $body = ds_json_body();
    $token = is_array($body) && isset($body['token']) && is_string($body['token']) ? $body['token'] : '';
    if (!hash_equals($configuredToken, $token)) throw ds_not_found();

    $targets = [
        'api.github.com' => 'https://api.github.com',
        'codeload.github.com' => 'https://codeload.github.com/Hamidrf/DeliShop/zip/refs/heads/deploy',
    ];
    $results = ['curl_available' => function_exists('curl_init')];

    foreach ($targets as $name => $url) {
        $entry = ['url' => $url];
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_NOBODY => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CONNECTTIMEOUT => 8,
                CURLOPT_TIMEOUT => 10,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_SSL_VERIFYPEER => true,
            ]);
            curl_exec($ch);
            $entry['http_code'] = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $entry['error'] = curl_error($ch) ?: null;
            $entry['total_time_s'] = curl_getinfo($ch, CURLINFO_TOTAL_TIME);
            curl_close($ch);
        } else {
            $ctx = stream_context_create(['http' => ['method' => 'HEAD', 'timeout' => 10]]);
            $ok = @file_get_contents($url, false, $ctx);
            $entry['ok'] = $ok !== false;
            $entry['headers'] = $http_response_header ?? null;
        }
        $results[$name] = $entry;
    }

    echo json_encode($results);
}

/**
 * HTTP equivalent of scripts/seed.php, for hosts with no Terminal/SSH
 * access. Same setup_token gate as ds_route_setup_create_admin(). Loads the
 * 16 original products only if the products table is currently empty.
 */
function ds_route_setup_seed(): void
{
    $c = ds_config();
    $configuredToken = $c['setup_token'] ?? '';
    if ($configuredToken === '') throw ds_not_found();

    $body = ds_json_body();
    $token = is_array($body) && isset($body['token']) && is_string($body['token']) ? $body['token'] : '';
    if (!hash_equals($configuredToken, $token)) throw ds_not_found();

    $seeded = ds_run_seed();
    echo json_encode(['ok' => true, 'seeded' => $seeded, 'count' => count($seeded)]);
}
