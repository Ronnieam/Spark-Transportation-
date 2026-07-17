Spark Transportation v3.0.1 — Stable Refactor

Architecture:
- index.html: layout only
- style.css: app styling
- app.js: startup and application logic
- database.js: built-in Walmart DC directory
- sw.js: fresh network-first PWA cache

Startup stability fixes:
- Saved locations are initialized before the built-in database loads.
- The 416-location DC database loads only after app state normalization.
- Location database failures are isolated and cannot stop the rest of the app.
- The blocking startup error alert was removed.
- Existing saved data remains under sparkTransportationData.
- Live Load and Live Unload remain $12.75.
- PTO rebuild remains included.
