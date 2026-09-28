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
