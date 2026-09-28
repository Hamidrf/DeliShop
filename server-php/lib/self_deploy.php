<?php
declare(strict_types=1);

/**
 * Recursively copies $src's contents into $dst, overwriting existing files.
 * Returns ['copied' => int, 'failed' => list<string>] -- copy()'s return
 * value was previously ignored entirely (the count was incremented
 * regardless of success), so a silent copy() failure -- e.g. a file the
 * web server user can't overwrite for whatever host-specific reason --
 * was reported as a successful deploy with no way to tell. Confirmed
 * this can happen in practice: files_copied stayed a plausible-looking
 * number across several deploys while specific PHP files never actually
 * changed on disk -- most tellingly, THIS file: every request that runs
 * self-deploy has already require_once'd this exact script (along with
 * every other file index.php pulls in), so a direct in-place copy() is
 * overwriting a file this very request is currently executing from.
 * copy()+rename() instead: write to a temp path (a brand-new inode, no
 * conflict with the running process's already-open file descriptor for
 * the old one), then atomically rename() it over the target. POSIX
 * rename() just repoints the directory entry; a process with the old
 * file already open keeps reading its old inode safely until it exits,
 * and the next request sees the new file immediately.
 */
function ds_recursive_copy(string $src, string $dst): array
{
    $copied = 0;
    $failed = [];
    if (!is_dir($dst)) mkdir($dst, 0775, true);
    foreach (scandir($src) as $item) {
        if ($item === '.' || $item === '..') continue;
        $srcPath = $src . '/' . $item;
        $dstPath = $dst . '/' . $item;
        if (is_dir($srcPath)) {
            $sub = ds_recursive_copy($srcPath, $dstPath);
            $copied += $sub['copied'];
            $failed = array_merge($failed, $sub['failed']);
            continue;
        }
        $tmpPath = $dstPath . '.new-' . bin2hex(random_bytes(4));
        if (copy($srcPath, $tmpPath) && rename($tmpPath, $dstPath)) {
            $copied++;
        } else {
            @unlink($tmpPath);
            $failed[] = $dstPath;
        }
    }
    return ['copied' => $copied, 'failed' => $failed];
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
 *
 * $sha, when given a full 40-hex-char commit SHA, fetches that exact commit
 * instead of the `refs/heads/deploy` branch ref. This matters: the deploy
 * branch is force-pushed as a brand-new commit on every deploy, but
 * codeload.github.com caches branch-ref zip downloads for a few minutes --
 * and self-deploy is called within seconds of the push, so a ref-based
 * fetch can silently return the PREVIOUS deploy's content. Confirmed on
 * this host: repeated uploads processed identically across several deploys
 * that changed the exact code path handling them, even after a PHP
 * restart ruled out any PHP-side caching. A commit SHA is content-addressed
 * and safe to fetch even from a cache, since it can only ever mean one
 * exact tree.
 */
function ds_self_deploy(?string $sha = null): array
{
    if (!class_exists('ZipArchive')) {
        throw new ApiError(500, 'zip_unavailable', 'The PHP zip extension is not available.');
    }

    $ref = ($sha !== null && preg_match('/^[0-9a-f]{40}$/', $sha)) ? $sha : 'refs/heads/deploy';
    $zipUrl = "https://codeload.github.com/Hamidrf/DeliShop/zip/{$ref}";
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

    $copyResult = ds_recursive_copy($sourceRoot, $destRoot);
    ds_recursive_delete($extractDir);

    // Some hosts run opcache with validate_timestamps off (or a slow
    // revalidate interval), so an updated PHP file on disk doesn't take
    // effect until the cached bytecode for it is explicitly dropped.
    // Included in the response so a deploy's logs show whether this ran.
    $opcacheReset = function_exists('opcache_reset') ? opcache_reset() : null;

    return [
        'files_copied' => $copyResult['copied'],
        'files_failed' => $copyResult['failed'],
        'dest' => $destRoot,
        'opcache_reset' => $opcacheReset,
        'fetched_ref' => $ref,
    ];
}
