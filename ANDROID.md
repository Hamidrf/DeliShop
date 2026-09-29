# Publishing DeliShop as an Android app (Google Play)

**Approach: Trusted Web Activity (TWA)** — the standard way to ship a PWA on
Google Play. The Android app is a thin Chrome-powered shell that opens
`https://deliarte.ir` full-screen (no browser bar). Because it *is* the live
site, the same-origin architecture is untouched: cookie auth, `/api/*` and
`/uploads/*` work as-is, no CORS/cookie changes, and every push to `main`
updates the app content with no new Play release.

Why not Capacitor/WebView: the app would load from `https://localhost`, making
every API call cross-site (breaks the `SameSite=Lax` session cookie and the
relative `/api` URLs) and would need a backend contract change.

## What's in the repo

- `app/public/manifest.webmanifest` — id, scope, maskable icon (Play/Android quality bar).
- `app/public/sw.js` + `offline.html` — offline fallback page only (no asset/API caching, so deploys are never masked by stale caches). Registered in `app/src/main.tsx` (production only).
- `app/public/.well-known/assetlinks.json` — Digital Asset Links; **must be filled in** (below), otherwise the app shows a browser URL bar.
- `android/twa-manifest.json` — Bubblewrap project config (package `ir.deliarte.delishop`).

## One-time steps (need your Play/Android accounts — not doable from CI)

1. Create a Google Play Developer account (one-time fee) and a new app with package name `ir.deliarte.delishop`.
2. Install: JDK 17+, Node, then `npm i -g @bubblewrap/cli`. (`bubblewrap doctor` downloads the Android SDK.)
3. Build:
   ```
   cd android
   bubblewrap init --manifest=https://deliarte.ir/manifest.webmanifest   # or reuse twa-manifest.json: bubblewrap update
   bubblewrap build        # produces app-release-bundle.aab (+ signed apk for testing)
   ```
   Keep `android.keystore` and its passwords **out of git** (already ignored) and backed up — losing it blocks updates unless you use Play App Signing (recommended).
4. Upload `app-release-bundle.aab` to Play Console → enable **Play App Signing**.
5. Play Console → *Setup → App signing* → copy the **SHA-256 certificate fingerprint** (App signing key; also add the upload key's if you sideload-test) into `app/public/.well-known/assetlinks.json`, and push to `main`. Verify:
   `https://deliarte.ir/.well-known/assetlinks.json` returns the JSON with HTTP 200.
6. Complete the store listing: icon 512×512, feature graphic 1024×500, ≥2 phone screenshots, short/full description, **privacy policy URL** (required — you collect orders/contact info), Data safety form, content rating, target audience.
7. New personal Play accounts must run a **closed test with ≥12 testers for 14 days** before production access.

## Releasing updates

Site changes ship via the normal deploy. Only shell changes (icon, name, colours) need a new build:
bump `appVersion`/`appVersionCode` in `android/twa-manifest.json`, run `bubblewrap update && bubblewrap build`, upload the new bundle.

## Notes

- `targetSdk` follows the Bubblewrap release; keep the CLI updated to meet Play's yearly target-API requirement.
- Studio (admin) pages are inside the app too; if you don't want them reachable there, that needs an app-side route decision — say so.
