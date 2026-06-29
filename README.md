# Store Canvas

A browser-based, true-to-scale 2D floor planning tool for Ashley Furniture store planners. Design showroom layouts, place furniture from a product catalog, define department zones, and compare layouts before and after changes — all in the browser with no backend required.

---

## Branches

| Branch | Description |
|---|---|
| `poc` | Current stable version — all core features + disk storage |
| `version2` | Phase 2 features — isometric 3D view, furniture detail overlays, layer toggles, ADA clearance warnings, right-click context menu |
| `poc-plans-local-disk-storage` | Feature branch (merged into `poc`) |
| `main` | Initial scaffold |

---

## Features

### Floor Planning
- **Rectangular and custom polygon floors** — draw L-shapes, T-shapes, or any freeform outline
- **Department zones** — draw named, color-coded zones (rect or freeform polygon) to divide the floor into departments
- **Non-usable areas** — mark columns, HVAC units, fitting rooms, and other blocked areas
- **Wall segments** — draw free-form wall lines anywhere on the floor

### Furniture Catalog
- 25 pre-loaded items across Living Room, Bedroom, Dining, Office, and Accessories categories
- **Drag and drop** items from the catalog directly onto the canvas at true scale
- **Accessory attachment** — drop lamps, vases, or pillows onto furniture; they move and rotate with the parent
- **Search bar** — filter catalog items by name, category, or subcategory instantly

### Canvas Interaction
- **Select, move, rotate** — click to select, drag to move, use the rotation dial or type an exact angle
- **Multi-select** — shift-click or drag a selection box to select multiple items
- **Duplicate** — Ctrl+D to clone the selection with an offset
- **Color picker** — 15 perceptually distinct color swatches per item or zone
- **Snap to grid** — optional 6" grid snap for precise placement
- **Zoom and pan** — scroll wheel to zoom around cursor, space+drag to pan
- **Measurement tool** — click two points to read the distance in feet and inches
- **Labels toggle** — show/hide item name labels on the canvas
- **Undo / Redo** — full history per plan (Ctrl+Z / Ctrl+Shift+Z)

### Kits (Reusable Groups)
- Select any group of items and save as a named **Kit** (e.g. "Living Room Vignette A")
- Kits appear in the left panel under the **Kits** tab and can be dragged onto the canvas as a single unit
- **Duplicate detection** — selecting items that match an existing kit shows the kit name and disables re-saving
- **Search bar** — filter saved kits by name

### Plan Management
- **Multiple named plans** — create, rename, duplicate, and delete plans independently
- **Auto-save to browser localStorage** — reload the page and your work is restored
- **Disk storage (File System Access API)** — connect a `.json` file on your PC; all plans auto-save to disk on every change and can be reloaded after a browser cache clear *(Chrome / Edge only)*
- **Duplicate plan** — branch a layout variant without affecting the original

### HUD (Heads-Up Display)
- Bottom-left overlay showing floor area, occupied sq ft, free sq ft, and a per-zone area breakdown in real time

### Compare Plans
- Select any two saved plans as **Before (Pre)** and **After (Post)**
- View a **side-by-side result**:
  - **Text change report** — color-coded sections for zone changes, items added, removed, moved, and unchanged; shows zone names and distance moved
  - **Visual canvas diff** — green = added, red dashed = removed at old position, orange = moved to new position, gray ghost = old position of moved items
- **Download Report** — exports a self-contained `.html` file with the canvas image embedded and the full change list, ready to open in any browser or print to PDF

### Export
- **PNG and PDF export** — full canvas at chosen scale with title block
- **JSON / CSV data export** — structured report of all zones, items, positions, and zone assignments

---

## Phase 2 Features (`version2` branch)

### Isometric 3D View
- Toggle **⬡ 3D View** in the toolbar to switch to an isometric projection
- All furniture rendered as 3D blocks with top, front, and side faces shaded by depth
- Zones and non-usable regions rendered as flat floor-level shapes
- Painter's algorithm ensures correct back-to-front draw order
- View-only (return to 2D to edit)

### Furniture Detail Overlays
- Furniture items on the canvas show subcategory-specific detail lines (cushions on sofas, legs on tables, headboard on beds, drawers on storage, etc.)
- Rendered as Konva primitives — no image loading required

### Layer Visibility Toggles
- Toolbar checkboxes to independently show/hide **Zones**, **Walls**, **Blocked areas**, and **Accessories**

### ADA Clearance Warnings
- Enable **⚠ Clearance** in the toolbar to auto-detect furniture pairs with less than **36" aisle gap**
- Amber dashed border around flagged items; gap indicator line with distance label
- Red for gaps under 24", amber for 24"–36"

### Right-Click Context Menu
- Right-click any placed item for **Duplicate**, **Rotate 90° CW**, **Rotate 90° CCW**, and **Delete**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Canvas | Konva / react-konva |
| State | Zustand |
| Persistence | Browser localStorage + File System Access API (optional) |
| Styling | Inline React styles (no CSS framework) |

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Install and run

```bash
git clone https://github.com/sbellala312/store_canvas.git
cd store_canvas

# Switch to the stable poc branch
git checkout poc

npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Share with a coworker (same network)

```bash
npm run dev -- --host
```

Use the **Network** URL printed in the terminal (e.g. `http://10.x.x.x:5173`).

### Build for production

```bash
npm run build
```

Output goes to `dist/`.

---

## Disk Storage (File System Access API)

A thin bar below the toolbar lets you connect plans to a `.json` file on your PC.

| Action | Result |
|---|---|
| **Connect file → Save all plans to new file** | Creates a new `.json` file with all current plans |
| **Connect file → Open existing plans file** | Loads plans from disk, replaces browser localStorage |
| **Auto-save** | Triggers 800ms after any plan create / edit / delete |
| **Save now** | Manually writes all plans to the file immediately |
| **Disconnect** | Reverts to browser localStorage only |

> Plans are stored as a single JSON array — all plans in one file. The connection resets on page refresh; reconnect via **Open existing plans file** each session.
>
> Requires Chrome or Edge. Not supported in Safari.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `V` | Select tool |
| `H` | Pan tool |
| `M` | Measure tool |
| `G` | Toggle grid |
| `S` | Toggle snap |
| `R` | Rotate selection 90° clockwise |
| `Shift+R` | Rotate selection 90° counter-clockwise |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+D` | Duplicate selection |
| `Del` / `Backspace` | Delete selection |
| `Esc` | Clear selection / cancel tool |
| Arrow keys | Nudge selection 1" (Shift = 12") |

---

## Project Structure

```
src/
├── App.tsx                        # Root layout and dialog state
├── components/
│   ├── Canvas/
│   │   ├── CanvasStage.tsx        # Main Konva stage, drag-drop, tool handlers
│   │   ├── Toolbar.tsx            # Tool buttons, zoom, grid, snap, compare
│   │   ├── FloorLayer.tsx         # Floor outline rendering
│   │   ├── ZonesLayer.tsx         # Zone rects and polygons
│   │   ├── ItemsLayer.tsx         # Placed furniture items + transformer
│   │   ├── WallsLayer.tsx         # Wall segment rendering
│   │   ├── NonUsableLayer.tsx     # Non-usable area rendering
│   │   ├── GridLayer.tsx          # Snap grid overlay
│   │   └── LabelsOverlay.tsx      # Item name labels
│   ├── FileStorageBar.tsx         # Disk storage connect/status bar
│   ├── CatalogPanel/
│   │   └── CatalogPanel.tsx       # Left panel: catalog + kits tabs with search
│   ├── PropertiesPanel/
│   │   └── PropertiesPanel.tsx    # Right panel: item/zone properties, color, rotation
│   └── dialogs/
│       ├── ComparePlansDialog.tsx # Two-step plan comparison dialog
│       ├── PlansDialog.tsx        # Plan list: open, rename, duplicate, delete
│       ├── PlanDialog.tsx         # Create / edit plan dimensions and floor shape
│       ├── ExportDialog.tsx       # PNG / PDF export
│       ├── MiniModal.tsx          # PromptModal + ConfirmModal
│       └── Modal.tsx              # Base modal wrapper
├── data/
│   └── catalog.ts                 # 25-item furniture catalog with dimensions
├── state/
│   ├── planStore.ts               # Zustand store: plans, kits, tools, history
│   └── dragContext.ts             # Drag-and-drop shared context
├── types/
│   └── model.ts                   # TypeScript types: FloorPlan, PlacedItem, Zone, Kit, etc.
├── utils/
│   ├── comparePlans.ts            # Diff computation: item matching + zone comparison
│   ├── exportData.ts              # JSON / CSV data export
│   ├── export.ts                  # PNG / PDF canvas export
│   ├── fileStorage.ts             # File System Access API helpers
│   ├── geometry.ts                # pointInRect, pointInPolygon, snap, edge-snap guides
│   ├── persistence.ts             # localStorage read/write helpers
│   └── units.ts                   # feetInches(), parseFeetInches(), sqft helpers
└── hooks/
    └── useShortcuts.ts            # Global keyboard shortcut handler
```

---

## How It Works

### Coordinates
All internal measurements are in **inches**. The canvas uses `pixelsPerInch = 2` as the base scale, multiplied by the current zoom level. Dimensions are displayed as feet and inches (e.g. `8' 6"`).

### Plan Comparison Algorithm
Items between two plans are matched by **product type + nearest neighbor**: for each item type (catalogId), the closest unmatched item in the Post plan is paired with its Pre counterpart. Pairs where the center moved ≥ 6" or rotated ≥ 5° are classified as **moved**; otherwise **unchanged**. Zones are matched by name (case-insensitive).

### Persistence
Plans and Kits are serialized to `localStorage` under `storeCanvas.plans`, `storeCanvas.activePlanId`, and `storeCanvas.kits`. When disk storage is connected, every change also writes to the `.json` file on disk. Each plan maintains an independent undo/redo history stack (capped at 50 states).

---

## Status

This is a **proof-of-concept** for internal evaluation. Out of scope for this version:

- Backend, authentication, or multi-user sharing
- Real Ashley catalog / API integration
- Mobile / tablet layouts
- Real-time collaboration
