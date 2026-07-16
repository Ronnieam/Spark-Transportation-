Spark Transportation v1.4.3 — Location Import Center

Added:
- CSV location import that works offline
- Excel .xlsx and .xls import when the spreadsheet reader is available
- Column mapping for Type, Number, Name, Address, City, State, Phone, Extension,
  Contact, Receiving Hours, Gate Code, Appointment, and Notes
- Import preview
- Duplicate handling: Skip, Merge, or Replace
- Downloadable CSV template
- Imported locations are stored in sparkTransportationData and included in backups

Saved Locations redesign:
- Each location is collapsed by default
- Collapsed row shows only Type and Number
- Tap to expand full details
- Call, Directions, Edit, and Delete remain available in expanded view

Excel support uses the official SheetJS standalone browser script.
CSV import remains available if the Excel reader cannot load.
