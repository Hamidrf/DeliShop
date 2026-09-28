<?php
declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('CLI only.');
}

// CLI only: php scripts/seed.php
// Loads the 16 original products, ported 1:1 from server/src/scripts/seed.ts
// (itself ported from app/src/lib/products.ts's BUILTIN array).

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/errors.php';
require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/uploads.php';
require_once __DIR__ . '/../lib/uploads_extra.php';

$ART_DIR = __DIR__ . '/../../app/public/art';
$REAL_DIR = __DIR__ . '/../../app/public/assets/real';

$SEEDS = [
    ['name' => 'Super Fox', 'price' => 200, 'category' => 'Keychains', 'color' => 'orange', 'source' => 'fox.jpeg', 'realPhoto' => 'super-fox.png',
        'crop' => ['x' => 150, 'y' => 370, 'w' => 900, 'h' => 1000, 'clip' => 'none'],
        'story' => 'This is Super Fox. He wears a black mask so nobody knows he is secretly very soft. He saves lost socks at night.'],
    ['name' => 'Balloon', 'price' => 75, 'category' => 'Keychains', 'color' => 'yellow', 'source' => 'sheet.jpg',
        'crop' => ['x' => 66.17, 'y' => 0, 'w' => 330.85, 'h' => 610.2, 'clip' => 'none'],
        'story' => 'My balloon wanted to fly away, so I put it on a keychain. Now it stays with you and still feels like floating.'],
    ['name' => 'Mystery Ball', 'price' => 500, 'category' => 'Keychains', 'color' => 'purple', 'source' => 'sheet.jpg',
        'crop' => ['x' => 1059.18, 'y' => 689, 'w' => 457.73, 'h' => 390.34, 'clip' => 'polygon(53.683% 33.643%,74.068% 33.643%,74.068% 33.643%,74.068% 33.643%,74.068% 52.702%,51.718% 52.702%,51.718% 37.586%,53.683% 37.586%)'],
        'story' => 'Nobody knows what is inside the Mystery Ball. Not even me. Shake it and make a wish.'],
    ['name' => 'Heart Cards', 'price' => 100, 'category' => 'Keychains', 'color' => 'pink', 'source' => 'cards.jpeg',
        'crop' => ['x' => 140, 'y' => 350, 'w' => 700, 'h' => 700, 'clip' => 'none'],
        'story' => 'I drew hearts for everyone I love. There were too many, so I made cards you can keep.'],
    ['name' => 'Flower', 'price' => 150, 'category' => 'Earrings', 'color' => 'green', 'source' => 'sheet.jpg',
        'crop' => ['x' => 583.87, 'y' => 0, 'w' => 324.35, 'h' => 576.3, 'clip' => 'none'],
        'story' => 'This flower never needs water. It only needs you to smile at it once a day.'],
    ['name' => 'Cat', 'price' => 150, 'category' => 'Pins', 'color' => 'mint', 'source' => 'sheet.jpg',
        'crop' => ['x' => 1608.65, 'y' => 689, 'w' => 348.45, 'h' => 524.94, 'clip' => 'none'],
        'story' => "This cat sleeps all day and dreams about fish in the sky. Please don't wake her up."],
    ['name' => 'Book', 'price' => 250, 'category' => 'Pins', 'color' => 'mint', 'source' => 'book.jpeg',
        'crop' => ['x' => 275, 'y' => 410, 'w' => 700, 'h' => 700, 'clip' => 'none'],
        'story' => 'I wrote this book about a girl who could talk to clouds. The clouds told her all their secrets.'],
    ['name' => 'Lip', 'price' => 100, 'category' => 'Earrings', 'color' => 'pink', 'source' => 'sheet.jpg',
        'crop' => ['x' => 1029, 'y' => 1508, 'w' => 432.58, 'h' => 540, 'clip' => 'polygon(50.244% 73.633%,68.419% 73.633%,68.419% 79.236%,71.366% 79.236%,71.366% 100.000%,50.244% 100.000%,50.244% 73.633%,50.244% 73.633%)'],
        'story' => 'This lip is always happy. When you are sad, it smiles for you.'],
    ['name' => 'Charms', 'price' => 100, 'category' => 'Earrings', 'color' => 'purple', 'source' => 'sheet.jpg',
        'crop' => ['x' => 1094.39, 'y' => 0, 'w' => 326.95, 'h' => 576.3, 'clip' => 'none'],
        'story' => 'Little charms for little luck. Put one on your bag and good things will follow you.'],
    ['name' => 'Panda', 'price' => 150, 'category' => 'Pins', 'color' => 'yellow', 'source' => 'panda.jpeg',
        'crop' => ['x' => 180, 'y' => 300, 'w' => 860, 'h' => 1020, 'clip' => 'none'],
        'story' => 'Panda eats bamboo for breakfast, lunch and dinner. On Fridays he eats cake.'],
    ['name' => 'Guitar', 'price' => 200, 'category' => 'Pins', 'color' => 'orange', 'source' => 'sheet.jpg',
        'crop' => ['x' => 1608.65, 'y' => 1373, 'w' => 338.35, 'h' => 675, 'clip' => 'none'],
        'story' => 'My guitar plays only happy songs. If you listen very close you can hear it.'],
    ['name' => 'Card', 'price' => 100, 'category' => 'Pins', 'color' => 'green', 'source' => 'sheet.jpg',
        'crop' => ['x' => 1608.65, 'y' => 0, 'w' => 338.35, 'h' => 440.7, 'clip' => 'none'],
        'story' => 'A tiny card for a tiny message. Write something nice and give it to a friend.'],
    ['name' => 'Snail', 'price' => 150, 'category' => 'Keychains', 'color' => 'pink', 'source' => 'sheet.jpg',
        'crop' => ['x' => 519, 'y' => 1373, 'w' => 409.18, 'h' => 675, 'clip' => 'polygon(28.997% 67.041%,45.321% 67.041%,45.321% 67.041%,45.321% 67.041%,45.321% 100.000%,25.342% 100.000%,25.342% 71.326%,28.997% 71.326%)'],
        'story' => 'Snail is slow, but she always gets there. She carries her house so she is never lost.'],
    ['name' => 'Butterfly & Flower', 'price' => 150, 'category' => 'Earrings', 'color' => 'mint', 'source' => 'bf.jpeg',
        'crop' => ['x' => 180, 'y' => 400, 'w' => 600, 'h' => 710, 'clip' => 'none'],
        'story' => 'The butterfly found the flower and they became best friends. Now they go everywhere together.'],
    ['name' => 'Banana', 'price' => 75, 'category' => 'Keychains', 'color' => 'yellow', 'source' => 'sheet.jpg',
        'crop' => ['x' => 66.17, 'y' => 689, 'w' => 330.85, 'h' => 538.4, 'clip' => 'none'],
        'story' => 'This banana is too cute to eat. It likes to hang out and make people laugh.'],
    ['name' => 'Beachwear', 'price' => 250, 'category' => 'Pins', 'color' => 'purple', 'source' => 'sheet.jpg',
        'crop' => ['x' => 0, 'y' => 1373, 'w' => 509, 'h' => 675, 'clip' => 'polygon(3.231% 67.041%,18.889% 67.041%,18.889% 91.101%,24.854% 91.101%,24.854% 100.000%,0.000% 100.000%,0.000% 71.326%,3.231% 71.326%)'],
        'story' => 'Summer clothes for summer days. I drew them when I was dreaming about the sea.'],
];

$pdo = ds_pdo();
$existing = $pdo->query('SELECT id FROM products LIMIT 1')->fetch();
if ($existing) {
    echo "Products table is not empty — skipping seed. Delete the rows first if you want to reseed.\n";
    exit(0);
}

$sourceCache = [];
function uploadSource(string $filename, string $artDir, array &$cache): array
{
    if (isset($cache[$filename])) return $cache[$filename];
    $raw = file_get_contents($artDir . '/' . $filename);
    $webp = ds_reencode_webp($raw, 90);
    $key = 'products/drawing-' . ds_random_suffix() . '.webp';
    ds_storage_put('media', $key, $webp['buffer']);
    $result = ['key' => $key, 'width' => $webp['width'], 'height' => $webp['height']];
    $cache[$filename] = $result;
    return $result;
}

foreach ($SEEDS as $index => $seed) {
    $drawing = uploadSource($seed['source'], $ART_DIR, $sourceCache);

    $photoKey = null;
    if (!empty($seed['realPhoto'])) {
        $raw = file_get_contents($REAL_DIR . '/' . $seed['realPhoto']);
        $photo = ds_process_product_photo($raw);
        $photoKey = 'products/photo-' . ds_random_suffix() . '.webp';
        ds_storage_put('media', $photoKey, $photo['buffer']);
    }

    $id = ds_uuid4();
    $now = ds_now();
    $stmt = $pdo->prepare(
        'INSERT INTO products (id, name, category, color, price, story, drawing_key, drawing_width, drawing_height, drawing_crop, photo_key, position, archived_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)'
    );
    $stmt->execute([
        $id, $seed['name'], $seed['category'], $seed['color'], $seed['price'], $seed['story'],
        $drawing['key'], $drawing['width'], $drawing['height'], json_encode($seed['crop']),
        $photoKey, $index + 1, $now, $now,
    ]);
    echo "Seeded \"{$seed['name']}\".\n";
}

echo 'Done — ' . count($SEEDS) . " products seeded.\n";
