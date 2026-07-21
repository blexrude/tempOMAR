# Cabinet Cut List

A phone-friendly app for planning shop-built cabinets. Enter your cabinet
dimensions and sheet-good details, and it produces an **optimized cut list**
plus a **nesting diagram** showing the most efficient way to lay the parts out
on your plywood — minimizing sheets and waste. An **optional ADA mode** adds
accessible-design targets and per-cabinet checks.

It's a **Progressive Web App**: no install from a store, works offline, and can
be added to your phone's home screen so it opens like a native app.

## Also included: Door Jamb & Casing calculator

Open [`door.html`](door.html) (linked from the header of the main app) for a
companion tool. Enter a **door slab's** width, height and thickness, set the
**reveal/gap** for the sides and top with a **separate bottom clearance**, and it
produces:

- a **cut list** for the side jambs, head jamb, 3-sided casing (mitered or
  butted), and optional doorstop — sized to your reveal and head-joint method
  (head butted on top of the legs, or dadoed in);
- a **hinge-placement table** (top-of-leaf from the door top, bottom-of-leaf
  from the door bottom, and center height off the floor) with any middle hinges
  spaced evenly; and
- **front and hinge-side elevation drawings** with the key dimensions called
  out.

All entries accept plain decimals or fractions (`30`, `1 3/8`, `3/16`), and
results are shown to the nearest 1/16″, 1/32″, or 1/8″. Export CSV or print/PDF.

## Use it on your phone

1. Host these files on any static web server (see below), or open them locally.
2. Open the URL in your phone browser (Safari on iOS, Chrome on Android).
3. Tap the browser's **Share → Add to Home Screen** (iOS) or
   **⋮ → Install app / Add to Home screen** (Android).
4. Launch it from the home-screen icon. After the first load it runs fully
   offline.

### Hosting options

- **GitHub Pages** — push this repo and enable Pages (root of the branch). The
  app is entirely static; no build step.
- **Any static host** — Netlify, Cloudflare Pages, Vercel, an S3 bucket, etc.
- **Locally** — from the project folder run a static server and browse to it:
  ```sh
  python3 -m http.server 8000
  # then open http://<your-computer-ip>:8000 on your phone (same Wi-Fi)
  ```
  A service worker requires `http(s)`/`localhost`, so use a server rather than
  opening `index.html` as a `file://` URL if you want offline + install.

## What it does

- **Cabinet entry** — add any number of cabinets. For each: type
  (base / wall / tall), width × height × depth, panel thickness, quantity,
  number of shelves, door count, and back style (full overlay / inset / none).
- **Material & sheet** — sheet width/height/thickness, saw **kerf**, edge
  **trim**, inch or millimetre units, and a "grain matters" toggle that keeps
  panels from being rotated during nesting.
- **Cut list** — every part with finished width, height, quantity, material
  thickness, and grain constraint, grouped by material thickness.
- **Nesting diagram** — a scaled layout of each sheet showing where every part
  lands, color-coded by part type, with a **sheet count and waste percentage**.
  The packer accounts for kerf and edge trim.
- **ADA mode (optional)** — enable it to get accessible-design targets and live
  checks per cabinet: finished counter height (≤ 34″), knee-clearance width /
  height / depth for an open knee space (forward approach), and wall-cabinet
  reach height. Turn it off and the app behaves like a standard cut-list tool.
- **Export & print** — CSV cut list, print/PDF (clean layout of the list and
  diagrams), and JSON project export/import. Your work auto-saves in the
  browser between visits.

## How the cut list is modeled

Frameless ("Euro") plywood carcass:

| Part | Size |
| --- | --- |
| Sides (2) | depth × height, grain vertical |
| Bottom | (width − 2·thickness) × depth |
| Top | full panel, or two stretchers (base cabinets) |
| Back | full overlay (W × H) or inset in a rabbet |
| Shelves | (width − 2·thickness − clearance) × (depth − setback) |
| Doors | overlay panels sized to the opening with a reveal gap |

Constants (shelf setback, door reveal, dado depth) live at the top of
`js/cabinet.js` if you want to tune them to your shop's standards.

## Project layout

```
index.html              App shell / UI
css/styles.css          Mobile-first styling (+ print styles)
js/packer.js            Guillotine bin-packing / sheet nesting
js/cabinet.js           Cabinet → parts list generation
js/ada.js               Optional ADA / ICC A117.1 checks
js/app.js               UI, state, unit handling, SVG rendering, export
manifest.webmanifest    PWA manifest (installable)
sw.js                   Service worker (offline cache)
icons/                  App icons
```

## Accuracy note

This is a planning aid, not a substitute for your own layout. The carcass model
is a common default; verify every dimension against your joinery method (dados,
rabbets, edge banding, hinge overlays) before cutting. ADA checks are based on
the 2010 ADA Standards and ICC A117.1 and are a build aid, not a code
certification — confirm requirements with the authority having jurisdiction.
Measure twice, cut once.
