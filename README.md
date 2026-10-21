# Book ISBN Tracker PWA

A small installable Progressive Web App for Android Chrome. Features:

- Scan ISBN barcodes using the phone camera (browser must support `BarcodeDetector`).
- Type an ISBN manually and fetch metadata from Google Books, with Open Library as fallback.
- Save scanned and manually entered books locally in the browser.
- Assign categories: History, Crime and thrillers, Fictions, Childrens, Others.
- Search/filter, edit, refresh metadata, and delete records.
- Export a CSV backup and import CSV records. Imports update matching ISBNs and add new records.
- Cache the app shell for offline launch after first visit; metadata lookups require internet.

## Run on Android

1. Upload the contents of this folder to a static HTTPS host. GitHub Pages is one option.
2. Open the published `index.html` in Chrome on Android.
3. Use Chrome's menu → **Install app** or **Add to Home screen**.
4. Allow camera access when scanning.

Camera access and service workers generally require HTTPS (or localhost). The app has no server/database; records remain in the browser on that device. Export CSV before clearing browser data, uninstalling, or changing phones.

## CSV format

Export uses these columns: `isbn,title,authors,publisher,year,language,pages,category,notes,addedAt,updatedAt`. Import requires a `title` column; other columns are optional. A matching ISBN updates an existing record. CSV is parsed with quoted commas and newlines supported.

## Notes

- ISBN checksum validation is advisory; metadata may still be unavailable.
- Google Books and Open Library availability varies by edition and ISBN. Check metadata before saving.
- This is a static client-side app. Google Books and Open Library requests are sent directly from your browser to those services.
