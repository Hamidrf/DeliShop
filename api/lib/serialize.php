<?php
declare(strict_types=1);

require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/product_photos.php';

/** Shape the frontend's `Product` type expects -- see docs/backend-architecture.md §4. */
function ds_serialize_product(array $p): array
{
    return [
        'id' => $p['id'],
        'name' => $p['name'],
        'category' => $p['category'],
        'color' => $p['color'],
        'price' => (int) $p['price'],
        'story' => $p['story'],
        'drawing' => [
            'url' => ds_storage_public_url($p['drawing_key']),
            'width' => (int) $p['drawing_width'],
            'height' => (int) $p['drawing_height'],
            'crop' => $p['drawing_crop'] !== null ? json_decode($p['drawing_crop'], true) : null,
        ],
        'photos' => array_map('ds_storage_public_url', ds_fetch_product_photo_keys($p['id'])),
        'voiceUrl' => $p['voice_key'] ? ds_storage_public_url($p['voice_key']) : null,
    ];
}

/** Adds the raw photo storage keys (not just their public URLs) so the studio edit form can tell the API which existing photos to keep. */
function ds_serialize_studio_product(array $p): array
{
    return array_merge(ds_serialize_product($p), [
        'photoKeys' => ds_fetch_product_photo_keys($p['id']),
        'archivedAt' => $p['archived_at'] ? ds_iso($p['archived_at']) : null,
        'createdAt' => ds_iso($p['created_at']),
    ]);
}
