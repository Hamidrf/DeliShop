<?php
declare(strict_types=1);

require_once __DIR__ . '/errors.php';

const DS_CATEGORIES = ['Keychains', 'Earrings', 'Pins'];
const DS_COLORS = ['mint', 'pink', 'orange', 'purple', 'yellow', 'green'];
const DS_ORDER_STATUSES = ['awaiting_review', 'confirmed', 'shipped', 'rejected', 'cancelled'];
const DS_MAX_PRODUCT_PHOTOS = 6;

/** Which status transitions the studio is allowed to make from a given status. Anything else is final. */
const DS_ALLOWED_TRANSITIONS = [
    'awaiting_review' => ['confirmed', 'rejected'],
    'confirmed' => ['shipped', 'cancelled'],
    'shipped' => [],
    'rejected' => [],
    'cancelled' => [],
];

function ds_is_uuid(string $value): bool
{
    return (bool) preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $value);
}

/**
 * Validates a decoded JSON `items` array: [{ productId: uuid, quantity: 1..20 }],
 * 1 to 30 entries. Returns the normalized array or throws ds_validation_failed().
 */
function ds_validate_order_items(mixed $input): array
{
    if (!is_array($input) || count($input) < 1 || count($input) > 30) {
        throw ds_validation_failed('Items are invalid.', ['items' => 'invalid']);
    }
    $out = [];
    foreach ($input as $row) {
        if (
            !is_array($row)
            || !isset($row['productId']) || !is_string($row['productId']) || !ds_is_uuid($row['productId'])
            || !isset($row['quantity']) || !is_int($row['quantity']) || $row['quantity'] < 1 || $row['quantity'] > 20
        ) {
            throw ds_validation_failed('Items are invalid.', ['items' => 'invalid']);
        }
        $out[] = ['productId' => $row['productId'], 'quantity' => $row['quantity']];
    }
    return $out;
}

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Normalizes an Iranian mobile number to `09XXXXXXXXX` (11 digits). Accepts
 * +98, 0098 and bare 9... prefixes, and Persian/Arabic digits. Returns null
 * if the result isn't a valid-looking mobile number.
 */
function ds_normalize_phone(string $input): ?string
{
    $latin = str_replace(PERSIAN_DIGITS, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], $input);
    $latin = str_replace(ARABIC_DIGITS, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], $latin);
    $digits = preg_replace('/\D/', '', $latin);

    if (str_starts_with($digits, '0098')) {
        $digits = substr($digits, 4);
    } elseif (str_starts_with($digits, '98')) {
        $digits = substr($digits, 2);
    }
    if (str_starts_with($digits, '9') && strlen($digits) === 10) {
        $digits = '0' . $digits;
    }
    if (strlen($digits) !== 11 || !str_starts_with($digits, '09')) return null;
    return $digits;
}
