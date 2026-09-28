<?php
// Copy this file to /home/deliar/delishop-config.php on the server (ONE
// LEVEL ABOVE public_html, never inside it) and fill in real values. It is
// never committed to git and never overwritten by a deploy.
declare(strict_types=1);

return [
    'db_host' => '127.0.0.1',
    'db_name' => 'deliar_delishop',
    'db_user' => 'deliar_delishop',
    'db_pass' => 'CHANGE_ME',

    // The live site origin, used to check the Origin header on state-changing
    // requests (CSRF protection) and to build absolute URLs.
    'app_origin' => 'https://deliarte.ir',
    'is_production' => true,

    // Where product/drawing/photo/voice files are written. Must be inside
    // public_html so Apache serves them directly.
    'media_dir' => '/home/deliar/public_html/uploads/media',
    'media_public_base' => '/uploads/media',

    // Payment receipts are private -- outside public_html, only ever read
    // through the authenticated /api/studio/orders/{id}/receipt route.
    'receipts_dir' => '/home/deliar/uploads-private/receipts',

    // Optional: SMS notification to the shop owner on new orders. Leave
    // blank to skip.
    'owner_phone' => '',
    'sms_api_key' => '',
];
