Spark Transportation v3.0.5 — Direct Directory

- The 416 built-in DCs are read directly from the embedded database.
- Built-in locations are no longer copied into localStorage.
- This avoids the startup initialization failure and storage-size issues.
- Personal saved locations remain in localStorage.
- Favorites and recent locations still work with built-in DCs.
- Built-in locations cannot be edited or deleted.
- All logic, styling, and DC data remain inside index.html.
