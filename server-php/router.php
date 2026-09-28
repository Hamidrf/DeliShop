<?php
declare(strict_types=1);

// Dev-only router for `php -S localhost:3000 router.php`, so local URLs
// match production's rewritten form (/api/<rest>, plus static media files)
// without needing a real Apache + .htaccess. Not used in production.

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

if (str_starts_with($uri, '/api/')) {
    $_GET['ds_route'] = substr($uri, strlen('/api/'));
    require __DIR__ . '/index.php';
    return true;
}

$file = __DIR__ . $uri;
if ($uri !== '/' && is_file($file)) {
    return false; // let the built-in server serve it directly (e.g. /uploads/media/...)
}

http_response_code(404);
echo 'Not found.';
return true;
