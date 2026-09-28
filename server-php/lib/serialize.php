<?php
declare(strict_types=1);

require_once __DIR__ . '/storage.php';

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
        'photoUrl' => $p['photo_key'] ? ds_storage_public_url($p['photo_key']) : null,
        'voiceUrl' => $p['voice_key'] ? ds_storage_public_url($p['voice_key']) : null,
    ];
}

function ds_serialize_studio_product(array $p): array
{
    return array_merge(ds_serialize_product($p), [
        'archivedAt' => $p['archived_at'] ? ds_iso($p['archived_at']) : null,
        'createdAt' => ds_iso($p['created_at']),
    ]);
}
