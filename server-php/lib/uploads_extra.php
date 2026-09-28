<?php
declare(strict_types=1);

/** Re-encodes to WebP with no resize/flatten -- used only by scripts/seed.php,
 * whose source art files are pre-cropped and must keep their exact pixel
 * dimensions (the seed data's `crop` coordinates were computed against them). */
function ds_reencode_webp(string $bytes, int $quality = 90): array
{
    if (extension_loaded('imagick')) {
        $img = new Imagick();
        $img->readImageBlob($bytes);
        $img->stripImage();
        $img->setImageFormat('webp');
        $img->setImageCompressionQuality($quality);
        $blob = $img->getImageBlob();
        $w = $img->getImageWidth();
        $h = $img->getImageHeight();
        $img->clear();
        return ['buffer' => $blob, 'width' => $w, 'height' => $h];
    }

    $src = ds_gd_read($bytes);
    $w = imagesx($src);
    $h = imagesy($src);
    ob_start();
    imagewebp($src, null, $quality);
    $blob = ob_get_clean();
    imagedestroy($src);
    return ['buffer' => $blob, 'width' => $w, 'height' => $h];
}
