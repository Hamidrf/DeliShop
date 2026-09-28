<?php
declare(strict_types=1);

/** Recursively copies $src's contents into $dst, overwriting existing files. Returns the number of files copied. */
function ds_recursive_copy(string $src, string $dst): int
{
    $count = 0;
    if (!is_dir($dst)) mkdir($dst, 0775, true);
    foreach (scandir($src) as $item) {
        if ($item === '.' || $item === '..') continue;
        $srcPath = $src . '/' . $item;
        $dstPath = $dst . '/' . $item;
        if (is_dir($srcPath)) {
            $count += ds_recursive_copy($srcPath, $dstPath);
        } else {
            copy($srcPath, $dstPath);
            $count++;
        }
    }
    return $count;
}

function ds_recursive_delete(string $dir): void
{
    if (!is_dir($dir)) return;
    foreach (scandir($dir) as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $dir . '/' . $item;
        is_dir($path) ? ds_recursive_delete($path) : @unlink($path);
    }
    @rmdir($dir);
}

/**
 * Downloads the `deploy` branch as a zip from codeload.github.com (works
 * even though cPanel's own Git Version Control can't reach GitHub from this
 * host -- see docs) and copies its contents over public_html, overwriting
 * matching files. Never deletes anything not present in the new zip, so
 * uploads/media (not part of the deploy artifact) is untouched. Returns a
 * summary array.
 */
function ds_self_deploy(): array
{
    if (!class_exists('ZipArchive')) {
        throw new ApiError(500, 'zip_unavailable', 'The PHP zip extension is not available.');
    }

    $zipUrl = 'https://codeload.github.com/Hamidrf/DeliShop/zip/refs/heads/deploy';
    $tmpZip = sys_get_temp_dir() . '/delishop-deploy-' . bin2hex(random_bytes(6)) . '.zip';

    $fp = fopen($tmpZip, 'wb');
    $ch = curl_init($zipUrl);
    curl_setopt_array($ch, [
        CURLOPT_FILE => $fp,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 60,
    ]);
    $ok = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    fclose($fp);

    if (!$ok || $httpCode !== 200) {
        @unlink($tmpZip);
        throw new ApiError(502, 'download_failed', "Could not download the deploy zip (http {$httpCode}): {$err}");
    }

    $zip = new ZipArchive();
    if ($zip->open($tmpZip) !== true) {
        @unlink($tmpZip);
        throw new ApiError(500, 'zip_open_failed', 'Could not open the downloaded zip.');
    }

    $extractDir = sys_get_temp_dir() . '/delishop-extract-' . bin2hex(random_bytes(6));
    mkdir($extractDir, 0775, true);
    $zip->extractTo($extractDir);
    $rootEntryName = rtrim((string) $zip->getNameIndex(0), '/');
    $zip->close();
    @unlink($tmpZip);

    $sourceRoot = $extractDir . '/' . $rootEntryName;
    if (!is_dir($sourceRoot)) {
        $entries = array_values(array_diff(scandir($extractDir), ['.', '..']));
        if (count($entries) === 1 && is_dir($extractDir . '/' . $entries[0])) {
            $sourceRoot = $extractDir . '/' . $entries[0];
        } else {
            ds_recursive_delete($extractDir);
            throw new ApiError(500, 'unexpected_zip_layout', 'Could not find the extracted site root.');
        }
    }

    // this file is at public_html/api/lib/self_deploy.php -- two levels up is public_html
    $destRoot = dirname(__DIR__, 2);

    $copied = ds_recursive_copy($sourceRoot, $destRoot);
    ds_recursive_delete($extractDir);

    return ['files_copied' => $copied, 'dest' => $destRoot];
}
