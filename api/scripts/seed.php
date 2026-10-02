<?php
declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('CLI only.');
}

// CLI only: php scripts/seed.php
// Loads the 16 original products (see lib/seed_data.php) if the products
// table is currently empty.

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/errors.php';
require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/uploads.php';
require_once __DIR__ . '/../lib/seed_data.php';

$seeded = ds_run_seed();
if (!$seeded) {
    echo "Products table is not empty — skipping seed. Delete the rows first if you want to reseed.\n";
    exit(0);
}

foreach ($seeded as $name) {
    echo "Seeded \"{$name}\".\n";
}
echo 'Done — ' . count($seeded) . " products seeded.\n";
