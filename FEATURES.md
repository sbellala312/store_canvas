# Store Canvas — Feature Summary

> A furniture store floor-planning tool (POC) for Ashley Furniture Industries.
> Built as a client-side web app: React 18 + TypeScript, Konva canvas, Zustand state, live Azure Cognitive Search catalog.

---

## ✅ Implemented Features

### Floor Plan Management
- Create, edit, duplicate, rename, and delete multiple floor plans
- Rectangular or polygon floor shapes with editable dimensions
- Multi-plan support with per-plan persistence

### Furniture Catalog (Live Data)
- **Live Azure Cognitive Search integration** pulling real Ashley product data — SKUs, dimensions, prices, images, series
- Search & filter catalog by keyword, auto-grouped by category
- Drag-and-drop placement onto the canvas
- **Kits** — save selections as reusable furniture groupings
- **GLB tab + 3D model viewer** for viewing products in 3D

### Design Tools
- Select, Pan, Wall, Door, Window, Zone, Non-usable region, Measure
- Snap-to-grid, grid overlay, ruler & scale bar
- Undo / Redo (50-step history), zoom / pan / fit

### Layers & Display
- Layer visibility toggles (Store / Zones / Furniture)
- Furniture outline-only mode & "show hidden furniture" ghost overlay
- Configurable label fonts + uppercase toggle

### Reference & Accuracy
- Load CAD / floor-plan **reference image to trace over**
- Architectural scale calculator (e.g. 3/32" = 1') → auto-computes real-world dimensions

### Properties & Editing
- Edit item color, SKU, vendor, price tier, tags, rotation

### Export & Data
- Export to **PDF / vector**
- Export plan data as **JSON / CSV**
- **Compare two plans** side-by-side

### Persistence
- Auto-save to browser (LocalStorage)
- Save / load to disk via File System Access API + IndexedDB

---

## 🔮 Future Scope

- **AI-assisted layout** — auto-suggest furniture arrangements / space optimization
- **Cloud sync & multi-user collaboration** (shared plans, real-time editing)
- **Backend + database** to replace browser-only storage
- **Full 3D walkthrough** of the entire store (not just per-item viewer)
- **Analytics** — cost roll-ups, square-footage utilization, aisle / traffic-flow metrics
- **Approval / sharing workflow** — share plans via link, comments, versioning
- **Direct ordering integration** — push a plan's SKUs to procurement / ERP
- **Templates library** — pre-built store zone templates for faster starts

---

## Tech Stack (at a glance)

| Tier | Technology |
|------|------------|
| UI Framework | React 18 + TypeScript |
| Canvas / Graphics | Konva.js + React-Konva |
| 3D Viewer | `<model-viewer>` (GLB) |
| State Management | Zustand |
| Catalog Data | Azure Cognitive Search |
| Build Tool | Vite 5 |
| Export | jsPDF / vector export |
| Persistence | LocalStorage + File System Access API + IndexedDB |
