Spark Transportation v1.4.6 — Full Wait-Time Pay

Correction:
- Wait Time no longer subtracts the first 45 minutes.
- The complete decimal amount entered is used as paid wait time.
- Wait pay equals decimal wait hours multiplied by the configured wait-time rate.
- Example: 1.25 hours entered = 1.25 paid hours.
- Today's Estimated Pay and Total Wait update using the full entered amount.
- Existing saved Wait Time records are recalculated under the corrected rule when loaded.
- Other timed activities retain their existing rules.
- Permanent storage key remains sparkTransportationData.
