Spark Transportation v1.5.1 — Startup Freeze Fix

Fix:
- Corrected a startup JavaScript error introduced in v1.5.0.
- Live Load and Live Unload migration now runs only after the numeric helper is initialized.
- Live Load remains a flat-rate activity at $12.75 by default.
- Live Unload remains a flat-rate activity at $12.75 by default.
- Manual Wait Time remains optional and separate.
- Existing data remains stored under sparkTransportationData.
