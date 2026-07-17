Spark Transportation v1.5.0 — Flat Live Load and Live Unload

Changes:
- Live Load is now a flat-rate activity.
- Live Unload is now a flat-rate activity.
- Default rate for each is $12.75.
- Pay equals quantity multiplied by the configured flat rate.
- Start and stop times are no longer required for these activities.
- Manual Wait Time can still be added separately with the Add Wait Time control.
- Wait Time uses the full decimal amount entered.
- Existing saved Live Load and Live Unload records are converted to one flat-rate occurrence when loaded.
- Live Load and Live Unload rates remain editable in Driver Setup.
- Breakdown keeps its existing timed calculation.
- Permanent storage key remains sparkTransportationData.
