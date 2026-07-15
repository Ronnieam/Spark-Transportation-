Spark Transportation v1.1.1 — Flat iPhone/GitHub Package

Why v1.1.0 did not load correctly:
The prior package used css/, js/, and assets/ folders. Uploading from an iPhone can flatten or omit folders, causing broken file references.

This corrected package has every required file at the repository's main level:
- index.html
- manifest.json
- sw.js
- logo.png
- icon-192.png
- icon-512.png

Update steps:
1. Unzip this package.
2. Delete or replace the old app files in the GitHub repository.
3. Upload all six files to the repository's main/root level.
4. Do not place them inside another folder.
5. Commit the changes.
6. Wait for GitHub Pages to deploy.
7. Open the GitHub Pages website in Safari and refresh.
8. Reopen the Home Screen app.

The permanent storage key remains unchanged, so existing data can be retained and migrated.
