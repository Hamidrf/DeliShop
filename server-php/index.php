<?php
declare(strict_types=1);

// Front controller for /api/*. .htaccess rewrites /api/<rest> here as
// index.php?ds_route=<rest> (query string, not PATH_INFO -- PATH_INFO
// handling is inconsistent across shared-hosting PHP configs).

error_reporting(E_ALL);
ini_set('display_errors', '0');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/errors.php';
require_once __DIR__ . '/lib/validators.php';
require_once __DIR__ . '/lib/session.php';
require_once __DIR__ . '/lib/rate_limit.php';
require_once __DIR__ . '/lib/storage.php';
require_once __DIR__ . '/lib/uploads.php';
require_once __DIR__ . '/lib/seed_data.php';
require_once __DIR__ . '/lib/self_deploy.php';
require_once __DIR__ . '/lib/serialize.php';
require_once __DIR__ . '/routes/products.php';
require_once __DIR__ . '/routes/orders.php';
require_once __DIR__ . '/routes/auth.php';
require_once __DIR__ . '/routes/studio_products.php';
require_once __DIR__ . '/routes/studio_orders.php';

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');

function ds_json_body(): ?array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return null;
    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

function ds_check_origin(): void
{
    $method = $_SERVER['REQUEST_METHOD'];
    if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) return;
    $origin = $_SERVER['HTTP_ORIGIN'] ?? null;
    if ($origin === null) return; // no Origin header: same-origin cookie (SameSite=Lax) is the primary defense
    $c = ds_config();
    if (rtrim($origin, '/') !== rtrim($c['app_origin'], '/')) {
        throw new ApiError(403, 'forbidden', 'Origin not allowed.');
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$path = '/' . trim((string) ($_GET['ds_route'] ?? ''), '/');

/** @var list<array{0: string, 1: string, 2: callable}> */
$routes = [
    ['GET', '#^/health$#', function () {
        try {
            ds_pdo()->query('SELECT 1');
            echo json_encode(['ok' => true, 'db' => 'up']);
        } catch (Throwable $e) {
            http_response_code(503);
            echo json_encode(['ok' => false, 'db' => 'down']);
        }
    }],
    ['GET', '#^/products$#', 'ds_route_products_list'],
    ['POST', '#^/orders$#', 'ds_route_orders_create'],
    ['POST', '#^/auth/login$#', 'ds_route_auth_login'],
    ['POST', '#^/auth/logout$#', 'ds_route_auth_logout'],
    ['GET', '#^/auth/me$#', 'ds_route_auth_me'],
    ['POST', '#^/setup/create-admin$#', 'ds_route_setup_create_admin'],
    ['POST', '#^/setup/seed$#', 'ds_route_setup_seed'],
    ['POST', '#^/setup/self-deploy$#', 'ds_route_setup_self_deploy'],
    ['GET', '#^/studio/products$#', 'ds_route_studio_products_list'],
    ['POST', '#^/studio/products$#', 'ds_route_studio_products_create'],
    ['DELETE', '#^/studio/products/([^/]+)$#', 'ds_route_studio_products_delete'],
    ['POST', '#^/studio/products/([^/]+)/restore$#', 'ds_route_studio_products_restore'],
    ['GET', '#^/studio/orders$#', 'ds_route_studio_orders_list'],
    ['GET', '#^/studio/orders/([^/]+)/receipt$#', 'ds_route_studio_orders_receipt'],
    ['GET', '#^/studio/orders/([^/]+)$#', 'ds_route_studio_orders_get'],
    ['PATCH', '#^/studio/orders/([^/]+)$#', 'ds_route_studio_orders_patch'],
];

try {
    ds_check_origin();
    ds_general_rate_limit();

    foreach ($routes as [$routeMethod, $pattern, $handler]) {
        if ($routeMethod !== $method) continue;
        if (preg_match($pattern, $path, $m)) {
            $args = array_slice($m, 1);
            $handler(...$args);
            exit;
        }
    }

    throw ds_not_found('No such API route.');
} catch (ApiError $e) {
    ds_send_error($e);
} catch (Throwable $e) {
    error_log('delishop unhandled error: ' . $e->getMessage() . "\n" . $e->getTraceAsString());
    $err = new ApiError(500, 'internal_error', 'Something went wrong.');
    // TEMPORARY: set 'debug' => true in the private config file to see the
    // real exception in the response instead of hunting for a log file.
    // Turn it back off once the bug's found -- never leave this on.
    if (ds_config()['debug'] ?? false) {
        $err->extra = [
            'debug' => [
                'exception' => get_class($e),
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => explode("\n", $e->getTraceAsString()),
            ],
        ];
    }
    ds_send_error($err);
}
