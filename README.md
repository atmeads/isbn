# Bookends Inventory PWA — initial MVP

A mobile-first, bilingual (English / 繁體中文), offline-first inventory app for the Bookends charity bookshop.

## Included in this MVP
- ISBN-10 / ISBN-13 manual lookup with Google Books, then Open Library fallback.
- Camera barcode scanning where the browser supports the native `BarcodeDetector` API (notably supported Android browsers). Manual ISBN entry works as fallback.
- Local IndexedDB storage, offline search and editing.
- Edition-level book records with individually tracked physical copies, condition, price, location and stock status.
- CSV export/import (one row per physical copy), JSON backup/restore.
- Basic category dashboard and sales-value total based on copies marked sold.
- English / Traditional Chinese interface.
- Optional Supabase sign-in and shared sync scaffold, plus SQL schema and RLS policies.

## Run locally
A PWA requires HTTPS or localhost. For a quick local test:
1. Install Python 3.
2. In this folder run `python -m http.server 8000`.
3. Open `http://localhost:8000` in Chrome or Edge.
4. On a phone on the same Wi-Fi, use the computer's LAN IP and port 8000. Camera permissions generally require HTTPS, so use a hosted HTTPS deployment for phone camera testing.

## Deploy
Upload the folder contents to a static HTTPS host such as Cloudflare Pages, Netlify or GitHub Pages. No build step is required.

## iPhone / iPad
Open the HTTPS URL in Safari, use Share → Add to Home Screen. iOS browser support for the native BarcodeDetector API is inconsistent; manual ISBN entry is available. A bundled cross-browser scanning library is a sensible next enhancement.

## Multi-volunteer cloud setup (Supabase)
1. Create a Supabase project.
2. Run `supabase-schema.sql` in SQL Editor.
3. Create volunteer accounts in Authentication.
4. Create an organisation row in `organizations`, then add each volunteer's `auth.users.id` to `org_members` with the same organisation UUID. Do this in the SQL editor as an administrator.
5. In each app install, enter the same project URL, anon/publishable key and organisation UUID. Each volunteer signs in with their own account.
6. Tap Sync now when online.

**Important MVP sync limitation:** this first sync implementation pushes local records then pulls remote records. It does not yet implement a robust conflict-resolution protocol, soft deletes, or automatic background sync. Avoid editing the same record concurrently on multiple devices until that is added. Use JSON backups before pilot use. The schema uses RLS membership checks; never put a Supabase service-role key in the app.

## Operational notes
- IndexedDB is device/browser-specific. Without cloud sync, data is not shared between devices.
- CSV is a portable backup, but JSON is the better full-fidelity backup.
- Metadata providers can omit or mismatch editions, especially for Chinese-language books. Volunteers should verify title, author and edition before saving.
- Category suggestions are heuristic and always editable.
- No customer or donor personal data is collected.
- For a real multi-volunteer rollout, have the library/bookshop approve the hosting and data-handling arrangements first.

## Suggested next improvements
- Replace native-only barcode scanning with a bundled ZXing library for broader iOS support.
- Add conflict resolution based on `updatedAt`, tombstones for deleted records and a proper sync queue.
- Add cover thumbnails with offline caching.
- Add a per-copy sale date and optional sales reference.
- Add a volunteer audit trail and role-based admin screen.
- Add Chinese metadata provider integration after testing representative Chinese ISBNs.
