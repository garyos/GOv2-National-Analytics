# NewGov: Local Gov, static edition

A snapshot of the Local Gov section of NewGov built 16 October 2026. Open `index.html` through any web server (for example `python3 -m http.server`) or publish this folder with GitHub Pages.

- `data/`: JSON files made by `scripts/export_static.py` from the database (1347 files, 30.8 MB before compression)
- `assets/`: styles, scripts, and `static-shim.js`, which serves the page's data requests from `data/`
- No SQL console, no postcode lookup (search is by place name), no other tabs.
