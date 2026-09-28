<?php
declare(strict_types=1);

require_once __DIR__ . '/errors.php';

/**
 * Identifies a file from its first bytes instead of trusting the extension
 * or the browser-supplied Content-Type. Covers exactly the formats this API
 * accepts; anything else (including SVG, which is never accepted anywhere)
 * comes back null. Port of server/src/lib/uploads.ts's sniff().
 */
function ds_sniff(string $buf): ?array
{
    if (strlen($buf) < 12) return null;

    if (ord($buf[0]) === 0xff && ord($buf[1]) === 0xd8 && ord($buf[2]) === 0xff) return ['mime' => 'image/jpeg', 'ext' => 'jpg'];
    if (substr($buf, 0, 8) === "\x89PNG\x0d\x0a\x1a\x0a") return ['mime' => 'image/png', 'ext' => 'png'];
    if (substr($buf, 0, 4) === 'RIFF' && substr($buf, 8, 4) === 'WEBP') return ['mime' => 'image/webp', 'ext' => 'webp'];

    $box = substr($buf, 4, 4);
    if ($box === 'ftyp') {
        $brand = substr($buf, 8, 4);
        if (preg_match('/^(heic|heix|heim|heis|hevc|hevx|mif1|msf1)$/', $brand)) return ['mime' => 'image/heic', 'ext' => 'heic'];
        if (preg_match('/^(M4A |isom|iso2|mp41|mp42|3gp4|M4V |qt  )$/', $brand)) return ['mime' => 'audio/mp4', 'ext' => 'm4a'];
    }

    if (substr($buf, 0, 4) === "\x1a\x45\xdf\xa3") return ['mime' => 'audio/webm', 'ext' => 'webm'];
    if (substr($buf, 0, 4) === 'OggS') return ['mime' => 'audio/ogg', 'ext' => 'ogg'];

    $b0 = ord($buf[0]);
    $b1 = ord($buf[1]);
    if (substr($buf, 0, 3) === 'ID3' || ($b0 === 0xff && ($b1 & 0xe0) === 0xe0 && (($b1 >> 1) & 0x3) === 1)) {
        return ['mime' => 'audio/mpeg', 'ext' => 'mp3'];
    }

    return null;
}

const DS_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const DS_OPAQUE_PHOTO_TYPES = ['image/png', 'image/webp'];
const DS_AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg'];

function ds_assert_file(string $buf, int $maxBytes, array $allowed, string $message): array
{
    if (strlen($buf) > $maxBytes) throw ds_file_too_large('File is too large (max ' . round($maxBytes / 1024 / 1024) . 'MB).');
    $sig = ds_sniff($buf);
    if (!$sig || !in_array($sig['mime'], $allowed, true)) throw ds_unsupported_file_type($message);
    return $sig;
}

function ds_assert_receipt(string $buf): array
{
    return ds_assert_file($buf, 5 * 1024 * 1024, DS_IMAGE_TYPES, 'The receipt must be a JPEG, PNG, WebP or HEIC image.');
}

function ds_assert_drawing(string $buf): array
{
    return ds_assert_file($buf, 8 * 1024 * 1024, DS_IMAGE_TYPES, 'The drawing must be a JPEG, PNG, WebP or HEIC image.');
}

function ds_assert_product_photo(string $buf): array
{
    return ds_assert_file($buf, 8 * 1024 * 1024, DS_OPAQUE_PHOTO_TYPES, 'The product photo must be a PNG or WebP image.');
}

function ds_assert_voice(string $buf): array
{
    return ds_assert_file($buf, 3 * 1024 * 1024, DS_AUDIO_TYPES, 'Voice recordings must be WebM, MP4/M4A, MP3 or Ogg.');
}

/**
 * Re-encodes an image to WebP: EXIF-rotated upright, longest side capped at
 * $maxSide (never upscaled), optionally flattened onto white, metadata
 * stripped. Uses Imagick when available (handles HEIC input too, if the
 * host's ImageMagick was built with the heic delegate); falls back to GD
 * otherwise (no HEIC support in that path).
 * Returns ['buffer' => string, 'width' => int, 'height' => int].
 */
function ds_process_image(string $bytes, int $maxSide, int $quality, bool $flattenWhite): array
{
    if (extension_loaded('imagick')) {
        return ds_process_image_imagick($bytes, $maxSide, $quality, $flattenWhite);
    }
    return ds_process_image_gd($bytes, $maxSide, $quality, $flattenWhite);
}

/**
 * Portable replacement for Imagick::autoOrientImage(), which doesn't exist
 * on every Imagick build (confirmed missing on the production host --
 * "Call to undefined method Imagick::autoOrientImage()"). Same behavior:
 * rotates/flips per the EXIF orientation tag, then resets it to normal.
 */
function ds_imagick_auto_orient(Imagick $img): void
{
    if (method_exists($img, 'autoOrientImage')) {
        $img->autoOrientImage();
        return;
    }
    $white = new ImagickPixel();
    switch ($img->getImageOrientation()) {
        case Imagick::ORIENTATION_TOPRIGHT:
            $img->flopImage();
            break;
        case Imagick::ORIENTATION_BOTTOMRIGHT:
            $img->rotateImage($white, 180);
            break;
        case Imagick::ORIENTATION_BOTTOMLEFT:
            $img->flipImage();
            break;
        case Imagick::ORIENTATION_LEFTTOP:
            $img->flipImage();
            $img->rotateImage($white, 90);
            break;
        case Imagick::ORIENTATION_RIGHTTOP:
            $img->rotateImage($white, 90);
            break;
        case Imagick::ORIENTATION_RIGHTBOTTOM:
            $img->flopImage();
            $img->rotateImage($white, 90);
            break;
        case Imagick::ORIENTATION_LEFTBOTTOM:
            $img->rotateImage($white, -90);
            break;
        default:
            break; // TOPLEFT (normal) or UNDEFINED: nothing to do
    }
    $img->setImageOrientation(Imagick::ORIENTATION_TOPLEFT);
}

function ds_process_image_imagick(string $bytes, int $maxSide, int $quality, bool $flattenWhite): array
{
    $img = new Imagick();
    $img->readImageBlob($bytes);
    ds_imagick_auto_orient($img);

    $w = $img->getImageWidth();
    $h = $img->getImageHeight();
    $scale = min(1.0, $maxSide / max($w, $h));
    if ($scale < 1.0) {
        $img->resizeImage((int) round($w * $scale), (int) round($h * $scale), Imagick::FILTER_LANCZOS, 1);
    }

    if ($flattenWhite) {
        $canvas = new Imagick();
        $canvas->newImage($img->getImageWidth(), $img->getImageHeight(), new ImagickPixel('white'));
        $canvas->setImageFormat('png');
        $canvas->compositeImage($img, Imagick::COMPOSITE_OVER, 0, 0);
        $img->clear();
        $img = $canvas;
    }

    $img->stripImage();
    $img->setImageFormat('webp');
    $img->setImageCompressionQuality($quality);
    $blob = $img->getImageBlob();
    $width = $img->getImageWidth();
    $height = $img->getImageHeight();
    $img->clear();

    return ['buffer' => $blob, 'width' => $width, 'height' => $height];
}

function ds_gd_read(string $bytes): \GdImage
{
    $img = @imagecreatefromstring($bytes);
    if (!$img) throw ds_unsupported_file_type('Could not read this image.');
    return $img;
}

function ds_process_image_gd(string $bytes, int $maxSide, int $quality, bool $flattenWhite): array
{
    $src = ds_gd_read($bytes);

    // EXIF orientation (JPEG only; GD doesn't apply it automatically).
    if (function_exists('exif_read_data')) {
        $exif = @exif_read_data('data://image/jpeg;base64,' . base64_encode($bytes));
        $orientation = $exif['Orientation'] ?? 1;
        $src = match ($orientation) {
            3 => imagerotate($src, 180, 0),
            6 => imagerotate($src, -90, 0),
            8 => imagerotate($src, 90, 0),
            default => $src,
        };
    }

    $w = imagesx($src);
    $h = imagesy($src);
    $scale = min(1.0, $maxSide / max($w, $h));
    $newW = (int) round($w * $scale);
    $newH = (int) round($h * $scale);

    $out = imagecreatetruecolor($newW, $newH);
    if ($flattenWhite) {
        $white = imagecolorallocate($out, 255, 255, 255);
        imagefilledrectangle($out, 0, 0, $newW, $newH, $white);
        imagealphablending($out, true);
    } else {
        imagealphablending($out, false);
        imagesavealpha($out, true);
        $transparent = imagecolorallocatealpha($out, 0, 0, 0, 127);
        imagefilledrectangle($out, 0, 0, $newW, $newH, $transparent);
        imagealphablending($out, true);
    }
    imagecopyresampled($out, $src, 0, 0, 0, 0, $newW, $newH, $w, $h);
    imagedestroy($src);

    ob_start();
    imagewebp($out, null, $quality);
    $blob = ob_get_clean();
    imagedestroy($out);

    return ['buffer' => $blob, 'width' => $newW, 'height' => $newH];
}

/** Kid's drawing -> WebP flattened onto white, longest side capped at 1200px. */
function ds_process_drawing(string $bytes): array
{
    return ds_process_image($bytes, 1200, 86, true);
}

/** Product photo -> WebP, transparency preserved, longest side capped at 1000px. */
function ds_process_product_photo(string $bytes): array
{
    return ds_process_image($bytes, 1000, 90, false);
}
