import { useState } from "react";
import { usePlanStore, findMatchingKit } from "../../state/planStore";
import { getCatalogItem } from "../../data/catalog";
import { feetInches } from "../../utils/units";
import type { CatalogItem, PlacedItem } from "../../types/model";

const SWATCHES = [
  "#E53935", "#FF7043", "#FFB300", "#FDD835", "#C0CA33",
  "#43A047", "#00897B", "#00ACC1", "#1E88E5", "#3949AB",
  "#8E24AA", "#D81B60", "#F06292", "#6D4C41", "#546E7A",
];

const ZONE_SWATCHES = [
  "#F44336", "#FF9800", "#F9A825", "#CDDC39", "#8BC34A",
  "#4CAF50", "#009688", "#00BCD4", "#2196F3", "#3F51B5",
  "#9C27B0", "#E91E63", "#FF5722", "#795548", "#607D8B",
];

export function PropertiesPanel() {
  const plan = usePlanStore((s) => s.getActivePlan());
  const selectionIds = usePlanStore((s) => s.selectionIds);
  const deletePlacedItems = usePlanStore((s) => s.deletePlacedItems);
  const duplicatePlacedItems = usePlanStore((s) => s.duplicatePlacedItems);
  const updateZone = usePlanStore((s) => s.updateZone);
  const deleteZone = usePlanStore((s) => s.deleteZone);
  const setStoreZone = usePlanStore((s) => s.setStoreZone);
  const zoneEditMode = usePlanStore((s) => s.zoneEditMode);
  const setZoneEditMode = usePlanStore((s) => s.setZoneEditMode);
  const updateNonUsable = usePlanStore((s) => s.updateNonUsable);
  const deleteNonUsable = usePlanStore((s) => s.deleteNonUsable);
  const nonUsableEditMode = usePlanStore((s) => s.nonUsableEditMode);
  const setNonUsableEditMode = usePlanStore((s) => s.setNonUsableEditMode);
  const updateWall = usePlanStore((s) => s.updateWall);
  const deleteWall = usePlanStore((s) => s.deleteWall);
  const updateDoor = usePlanStore((s) => s.updateDoor);
  const deleteDoor = usePlanStore((s) => s.deleteDoor);
  const updateWindow = usePlanStore((s) => s.updateWindow);
  const deleteWindow = usePlanStore((s) => s.deleteWindow);
  const kits = usePlanStore((s) => s.kits);

  const width = 280;

  if (!plan) {
    return <div style={panelStyle(width)} />;
  }

  if (selectionIds.length === 0) {
    return (
      <div style={panelStyle(width)}>
        <h3 style={h3Style}>Properties</h3>
        <div style={{ color: "#6b7785", fontSize: 12, padding: 4 }}>
          Select an item, zone, wall, or region to edit its properties.
        </div>
        <hr style={hr} />
        <div style={{ fontSize: 12, color: "#6b7785" }}>
          <b>Shortcuts</b>
          <div>V — Select tool</div>
          <div>H — Pan tool (drag anywhere to pan)</div>
          <div>M — Measure tool</div>
          <div>G — Toggle grid</div>
          <div>S — Toggle snap</div>
          <div>R / Shift+R — Rotate ±90°</div>
          <div>Ctrl+D — Duplicate</div>
          <div>[ / ] — Send backward / Bring forward</div>
          <div>Shift+[ / ] — Send to back / Bring to front</div>
          <div>Ctrl+Z / Ctrl+Shift+Z — Undo / Redo</div>
          <div>Delete — Remove selection</div>
          <div>Arrows — Nudge (Shift = larger)</div>
          <div>Space + drag — Pan canvas (any tool)</div>
          <div>Middle-mouse drag — Pan canvas (any tool)</div>
          <div>Esc — Cancel tool / clear selection</div>
        </div>
      </div>
    );
  }

  // Multi-select summary
  if (selectionIds.length > 1) {
    const matchingKit = findMatchingKit(selectionIds, plan.placedItems, kits);
    return (
      <div style={panelStyle(width)}>
        <h3 style={h3Style}>Selection</h3>
        {matchingKit ? (
          <div
            style={{
              background: "#eef4ff",
              border: "1px solid #b8d0f8",
              borderRadius: 6,
              padding: "10px 12px",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "#1f6feb",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                marginBottom: 3,
              }}
            >
              Kit
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1f26" }}>
              {matchingKit.name}
            </div>
            <div style={{ fontSize: 11, color: "#6b7785", marginTop: 2 }}>
              {matchingKit.items.length} items · saved kit
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            {selectionIds.length} items selected
          </div>
        )}
        <button
          style={btnStyle}
          onClick={() => duplicatePlacedItems(selectionIds)}
        >
          Duplicate (Ctrl+D)
        </button>
        <button
          style={{ ...btnStyle, background: "#e74c3c", color: "white", marginTop: 6 }}
          onClick={() => deletePlacedItems(selectionIds)}
        >
          Delete
        </button>
      </div>
    );
  }

  const id = selectionIds[0];

  // Placed item?
  const placed = plan.placedItems.find((i) => i.id === id);
  if (placed) {
    const cat = getCatalogItem(placed.catalogId);
    if (!cat) return <div style={panelStyle(width)} />;
    return (
      <div style={panelStyle(width)}>
        <PlacedItemPanel key={id} placed={placed} cat={cat} />
      </div>
    );
  }

  const zone = plan.zones.find((z) => z.id === id);
  if (zone) {
    return (
      <div style={panelStyle(width)}>
        <h3 style={h3Style}>
          Zone <span style={{ fontWeight: 400, fontSize: 11, color: "#6b7785" }}>
            ({zone.kind === "polygon" ? "free-form" : "rectangle"})
          </span>
        </h3>
        <div style={fieldRow}>
          <label style={labelStyle}>Name</label>
          <input
            type="text"
            value={zone.name}
            onChange={(e) => updateZone(zone.id, { name: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div style={fieldRow}>
          <label style={labelStyle}>Color</label>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            {ZONE_SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => updateZone(zone.id, { color: c })}
                title={c}
                style={{
                  width: 22,
                  height: 22,
                  background: c,
                  border: c === zone.color ? "2px solid #1f6feb" : "1px solid #888",
                  borderRadius: 3,
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
            <button
              onClick={() => updateZone(zone.id, { color: "none" })}
              title="No fill (border only)"
              style={{ width: 26, height: 22, background: "white", border: zone.color === "none" ? "2px solid #1f6feb" : "1px solid #888", borderRadius: 3, cursor: "pointer", padding: 0, fontSize: 13, color: "#e53935" }}
            >⊘</button>
          </div>
        </div>
        <div style={fieldRow}>
          <label style={labelStyle}>Store boundary</label>
          <button
            onClick={() => setStoreZone(zone.isStore ? null : zone.id)}
            style={{
              ...btnStyle,
              background: zone.isStore ? "#15803d" : "white",
              color: zone.isStore ? "white" : "#2d3742",
              borderColor: zone.isStore ? "#15803d" : "#c0cad4",
              fontWeight: zone.isStore ? 600 : 400,
            }}
          >
            {zone.isStore ? "★ Store boundary (active)" : "Set as store boundary"}
          </button>
          {zone.isStore && (
            <div style={{ fontSize: 11, color: "#15803d", marginTop: 4 }}>
              Sqft panel now reflects this zone's area only.
            </div>
          )}
          {!zone.isStore && (
            <div style={{ fontSize: 11, color: "#9aa5b1", marginTop: 4 }}>
              Mark this zone to scope the sqft HUD to store area only.
            </div>
          )}
        </div>
        <div style={fieldRow}>
          <label style={labelStyle}>Edit mode</label>
          <div style={{ display: "flex", gap: 4 }}>
            <ModeButton
              active={zoneEditMode === "view"}
              onClick={() => setZoneEditMode("view")}
              label="View"
            />
            <ModeButton
              active={zoneEditMode === "move"}
              onClick={() => setZoneEditMode("move")}
              label="Move"
            />
            <ModeButton
              active={zoneEditMode === "resize"}
              onClick={() => setZoneEditMode("resize")}
              label="Resize"
            />
          </div>
          <div style={{ fontSize: 11, color: "#6b7785", marginTop: 4 }}>
            {zoneEditMode === "view" && "Read-only. Switch to Move or Resize to change the zone on the canvas."}
            {zoneEditMode === "move" && "Drag the zone with your cursor to reposition it."}
            {zoneEditMode === "resize" && "Drag the edge or corner handles to resize."}
          </div>
        </div>
        {zone.kind === "rect" ? (
          <>
            <div style={fieldRow}>
              <label style={labelStyle}>Position</label>
              <div style={{ display: "flex", gap: 4 }}>
                <NumField label="x" value={zone.x} onChange={(v) => updateZone(zone.id, { x: v })} />
                <NumField label="y" value={zone.y} onChange={(v) => updateZone(zone.id, { y: v })} />
              </div>
            </div>
            <div style={fieldRow}>
              <label style={labelStyle}>Size (inches)</label>
              <div style={{ display: "flex", gap: 4 }}>
                <NumField
                  label="w"
                  value={zone.width}
                  onChange={(v) => updateZone(zone.id, { width: Math.max(1, v) })}
                />
                <NumField
                  label="h"
                  value={zone.height}
                  onChange={(v) => updateZone(zone.id, { height: Math.max(1, v) })}
                />
              </div>
              <div style={{ fontSize: 11, color: "#6b7785", marginTop: 4 }}>
                {feetInches(zone.width, { compact: true })} × {feetInches(zone.height, { compact: true })}
              </div>
            </div>
          </>
        ) : (
          <div style={fieldRow}>
            <label style={labelStyle}>Shape</label>
            <div style={{ fontSize: 12 }}>{zone.points.length} vertices</div>
            <div style={{ fontSize: 11, color: "#6b7785", marginTop: 4 }}>
              To reshape, delete this zone and redraw it.
            </div>
          </div>
        )}
        <hr style={hr} />
        <button
          style={{ ...btnStyle, background: "#e74c3c", color: "white" }}
          onClick={() => deleteZone(zone.id)}
        >
          Delete zone
        </button>
      </div>
    );
  }

  const nu = plan.nonUsable.find((n) => n.id === id);
  if (nu) {
    return (
      <div style={panelStyle(width)}>
        <h3 style={h3Style}>
          Non-usable{" "}
          <span style={{ fontWeight: 400, fontSize: 11, color: "#6b7785" }}>
            ({nu.kind === "polygon" ? "free-form" : "rectangle"})
          </span>
        </h3>
        <div style={fieldRow}>
          <label style={labelStyle}>Label (optional)</label>
          <input
            type="text"
            value={nu.label ?? ""}
            placeholder="e.g. Column, HVAC"
            onChange={(e) => updateNonUsable(nu.id, { label: e.target.value || undefined })}
            style={inputStyle}
          />
        </div>
        <div style={fieldRow}>
          <label style={labelStyle}>Color</label>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
            {ZONE_SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => updateNonUsable(nu.id, { color: c })}
                title={c}
                style={{ width: 18, height: 18, background: c, border: c === nu.color ? "2px solid #1f6feb" : "1px solid #888", borderRadius: 2, cursor: "pointer", padding: 0 }}
              />
            ))}
            <button
              onClick={() => updateNonUsable(nu.id, { color: "none" })}
              title="No fill (border only)"
              style={{ width: 22, height: 18, background: "white", border: nu.color === "none" ? "2px solid #1f6feb" : "1px solid #888", borderRadius: 2, cursor: "pointer", padding: 0, fontSize: 12, color: "#e53935" }}
            >⊘</button>
            {nu.color != null && (
              <button style={{ ...btnStyle, padding: "1px 6px", fontSize: 10 }} onClick={() => updateNonUsable(nu.id, { color: undefined })}>Reset</button>
            )}
          </div>
        </div>
        <div style={fieldRow}>
          <label style={labelStyle}>Edit mode</label>
          <div style={{ display: "flex", gap: 4 }}>
            <ModeButton active={nonUsableEditMode === "view"} onClick={() => setNonUsableEditMode("view")} label="View" />
            <ModeButton active={nonUsableEditMode === "move"} onClick={() => setNonUsableEditMode("move")} label="Move" />
            <ModeButton active={nonUsableEditMode === "resize"} onClick={() => setNonUsableEditMode("resize")} label="Resize" />
          </div>
          <div style={{ fontSize: 11, color: "#6b7785", marginTop: 4 }}>
            {nonUsableEditMode === "view" && "Read-only. Switch to Move or Resize to change on the canvas."}
            {nonUsableEditMode === "move" && "Drag the region to reposition it."}
            {nonUsableEditMode === "resize" && "Drag the edge or corner handles to resize."}
          </div>
        </div>
        {nu.kind === "rect" ? (
          <>
            <div style={fieldRow}>
              <label style={labelStyle}>Position</label>
              <div style={{ display: "flex", gap: 4 }}>
                <NumField label="x" value={nu.x} onChange={(v) => updateNonUsable(nu.id, { x: v })} />
                <NumField label="y" value={nu.y} onChange={(v) => updateNonUsable(nu.id, { y: v })} />
              </div>
            </div>
            <div style={fieldRow}>
              <label style={labelStyle}>Size (inches)</label>
              <div style={{ display: "flex", gap: 4 }}>
                <NumField label="w" value={nu.width} onChange={(v) => updateNonUsable(nu.id, { width: Math.max(1, v) })} />
                <NumField label="h" value={nu.height} onChange={(v) => updateNonUsable(nu.id, { height: Math.max(1, v) })} />
              </div>
              <div style={{ fontSize: 11, color: "#6b7785", marginTop: 4 }}>
                {feetInches(nu.width, { compact: true })} × {feetInches(nu.height, { compact: true })}
              </div>
            </div>
          </>
        ) : (
          <div style={fieldRow}>
            <label style={labelStyle}>Shape</label>
            <div style={{ fontSize: 12 }}>{nu.points.length} vertices</div>
            <div style={{ fontSize: 11, color: "#6b7785", marginTop: 4 }}>
              To reshape, delete this region and redraw it.
            </div>
          </div>
        )}
        <hr style={hr} />
        <button
          style={{ ...btnStyle, background: "#e74c3c", color: "white" }}
          onClick={() => deleteNonUsable(nu.id)}
        >
          Delete region
        </button>
      </div>
    );
  }

  // Door?
  const door = (plan.doors ?? []).find((d) => d.id === id);
  if (door) {
    const wall = door.wallId ? plan.walls.find((w) => w.id === door.wallId) : undefined;
    let wallLen = 0;
    let posAlongWall = 0;
    if (wall) {
      const dx = wall.x2 - wall.x1;
      const dy = wall.y2 - wall.y1;
      wallLen = Math.sqrt(dx * dx + dy * dy);
      const t = wallLen > 0
        ? Math.max(0, Math.min(1, ((door.x - wall.x1) * dx + (door.y - wall.y1) * dy) / (wallLen * wallLen)))
        : 0;
      posAlongWall = t * wallLen;
    }
    const moveDoorAlongWall = (posInches: number) => {
      if (!wall || wallLen === 0) return;
      const dx = wall.x2 - wall.x1;
      const dy = wall.y2 - wall.y1;
      const halfW = door.width / 2;
      const clamped = Math.max(halfW, Math.min(wallLen - halfW, posInches));
      const t = clamped / wallLen;
      updateDoor(door.id, { x: wall.x1 + t * dx, y: wall.y1 + t * dy });
    };
    const DOOR_PRESETS_SINGLE = [24, 28, 30, 32, 36];
    const DOOR_PRESETS_DOUBLE = [48, 60, 72, 84, 96];
    const presets = door.kind === "double" ? DOOR_PRESETS_DOUBLE : DOOR_PRESETS_SINGLE;
    return (
      <div style={panelStyle(width)}>
        <h3 style={h3Style}>Door</h3>

        {/* Door kind */}
        <div style={fieldRow}>
          <label style={labelStyle}>Type</label>
          <div style={{ display: "flex", gap: 4 }}>
            <ModeButton active={door.kind !== "double"} onClick={() => updateDoor(door.id, { kind: "single" })} label="Single" />
            <ModeButton active={door.kind === "double"} onClick={() => updateDoor(door.id, { kind: "double" })} label="Double" />
          </div>
        </div>

        {/* Width */}
        <div style={fieldRow}>
          <label style={labelStyle}>Width</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="number"
              min={12} step={1}
              value={Math.round(door.width)}
              onChange={(e) => updateDoor(door.id, { width: Math.max(12, parseFloat(e.target.value) || door.width) })}
              style={{ ...inputStyle, width: 64 }}
            />
            <span style={{ fontSize: 11, color: "#6b7785" }}>in ({feetInches(door.width, { compact: true })})</span>
          </div>
          {/* Preset widths */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 }}>
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => updateDoor(door.id, { width: p })}
                style={{
                  padding: "3px 7px", fontSize: 10, cursor: "pointer",
                  background: Math.round(door.width) === p ? "#1f6feb" : "white",
                  color: Math.round(door.width) === p ? "white" : "#2d3742",
                  border: "1px solid #c0cad4", borderRadius: 3,
                }}
              >
                {p}"
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#6b7785", marginTop: 3 }}>
            Or drag the green handles on canvas to resize.
          </div>
        </div>

        {/* Swing direction */}
        <div style={fieldRow}>
          <label style={labelStyle}>Swing direction</label>
          <div style={{ display: "flex", gap: 4 }}>
            <ModeButton active={door.swing === "right"} onClick={() => updateDoor(door.id, { swing: "right" })} label="Right" />
            <ModeButton active={door.swing === "left"} onClick={() => updateDoor(door.id, { swing: "left" })} label="Left" />
          </div>
        </div>

        {/* Position along wall */}
        {wall && wallLen > 0 && (
          <div style={fieldRow}>
            <label style={labelStyle}>Position along wall</label>
            <input
              type="range"
              min={door.width / 2}
              max={wallLen - door.width / 2}
              step={1}
              value={posAlongWall}
              onChange={(e) => moveDoorAlongWall(parseFloat(e.target.value))}
              style={{ width: "100%" }}
            />
            <div style={{ fontSize: 11, color: "#6b7785", marginTop: 2 }}>
              {feetInches(posAlongWall, { compact: true })} from wall start &nbsp;·&nbsp; wall {feetInches(wallLen, { compact: true })} long
            </div>
          </div>
        )}
        <hr style={hr} />
        <button
          style={{ ...btnStyle, background: "#e74c3c", color: "white" }}
          onClick={() => deleteDoor(door.id)}
        >
          Delete door
        </button>
      </div>
    );
  }

  // Window?
  const win = (plan.windows ?? []).find((w) => w.id === id);
  if (win) {
    const wall = win.wallId ? plan.walls.find((w) => w.id === win.wallId) : undefined;
    let wallLen = 0;
    let posAlongWall = 0;
    if (wall) {
      const dx = wall.x2 - wall.x1;
      const dy = wall.y2 - wall.y1;
      wallLen = Math.sqrt(dx * dx + dy * dy);
      const t = wallLen > 0
        ? Math.max(0, Math.min(1, ((win.x - wall.x1) * dx + (win.y - wall.y1) * dy) / (wallLen * wallLen)))
        : 0;
      posAlongWall = t * wallLen;
    }
    const moveWinAlongWall = (posInches: number) => {
      if (!wall || wallLen === 0) return;
      const dx = wall.x2 - wall.x1;
      const dy = wall.y2 - wall.y1;
      const halfW = win.width / 2;
      const clamped = Math.max(halfW, Math.min(wallLen - halfW, posInches));
      const t = clamped / wallLen;
      updateWindow(win.id, { x: wall.x1 + t * dx, y: wall.y1 + t * dy });
    };
    const WIN_PRESETS = [24, 30, 36, 48, 60, 72];
    return (
      <div style={panelStyle(width)}>
        <h3 style={h3Style}>Window</h3>

        {/* Width */}
        <div style={fieldRow}>
          <label style={labelStyle}>Width</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="number"
              min={6} step={1}
              value={Math.round(win.width)}
              onChange={(e) => updateWindow(win.id, { width: Math.max(6, parseFloat(e.target.value) || win.width) })}
              style={{ ...inputStyle, width: 64 }}
            />
            <span style={{ fontSize: 11, color: "#6b7785" }}>in ({feetInches(win.width, { compact: true })})</span>
          </div>
          {/* Preset widths */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 }}>
            {WIN_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => updateWindow(win.id, { width: p })}
                style={{
                  padding: "3px 7px", fontSize: 10, cursor: "pointer",
                  background: Math.round(win.width) === p ? "#1f6feb" : "white",
                  color: Math.round(win.width) === p ? "white" : "#2d3742",
                  border: "1px solid #c0cad4", borderRadius: 3,
                }}
              >
                {p}"
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#6b7785", marginTop: 3 }}>
            Or drag the green handles on canvas to resize.
          </div>
        </div>

        {/* Position along wall */}
        {wall && wallLen > 0 && (
          <div style={fieldRow}>
            <label style={labelStyle}>Position along wall</label>
            <input
              type="range"
              min={win.width / 2}
              max={wallLen - win.width / 2}
              step={1}
              value={posAlongWall}
              onChange={(e) => moveWinAlongWall(parseFloat(e.target.value))}
              style={{ width: "100%" }}
            />
            <div style={{ fontSize: 11, color: "#6b7785", marginTop: 2 }}>
              {feetInches(posAlongWall, { compact: true })} from wall start &nbsp;·&nbsp; wall {feetInches(wallLen, { compact: true })} long
            </div>
          </div>
        )}
        <hr style={hr} />
        <button
          style={{ ...btnStyle, background: "#e74c3c", color: "white" }}
          onClick={() => deleteWindow(win.id)}
        >
          Delete window
        </button>
      </div>
    );
  }

  const wall = plan.walls.find((w) => w.id === id);
  if (wall) {
    const len = Math.sqrt(
      Math.pow(wall.x2 - wall.x1, 2) + Math.pow(wall.y2 - wall.y1, 2),
    );
    return (
      <div style={panelStyle(width)}>
        <h3 style={h3Style}>Wall</h3>
        <div style={fieldRow}>
          <label style={labelStyle}>Length</label>
          <div style={{ fontSize: 12 }}>{feetInches(len, { compact: true })}</div>
        </div>
        <div style={fieldRow}>
          <label style={labelStyle}>Start point</label>
          <div style={{ display: "flex", gap: 4 }}>
            <NumField label="x" value={wall.x1} onChange={(v) => updateWall(wall.id, { x1: v })} />
            <NumField label="y" value={wall.y1} onChange={(v) => updateWall(wall.id, { y1: v })} />
          </div>
        </div>
        <div style={fieldRow}>
          <label style={labelStyle}>End point</label>
          <div style={{ display: "flex", gap: 4 }}>
            <NumField label="x" value={wall.x2} onChange={(v) => updateWall(wall.id, { x2: v })} />
            <NumField label="y" value={wall.y2} onChange={(v) => updateWall(wall.id, { y2: v })} />
          </div>
        </div>
        <div style={fieldRow}>
          <label style={labelStyle}>Thickness (inches)</label>
          <NumField
            label=""
            value={wall.thickness}
            onChange={(v) => updateWall(wall.id, { thickness: Math.max(1, v) })}
          />
        </div>
        <hr style={hr} />
        <button
          style={{ ...btnStyle, background: "#e74c3c", color: "white" }}
          onClick={() => deleteWall(wall.id)}
        >
          Delete wall
        </button>
      </div>
    );
  }

  return <div style={panelStyle(width)} />;
}

function PlacedItemPanel({ placed, cat }: { placed: PlacedItem; cat: CatalogItem }) {
  const id = placed.id;
  const [imgIdx, setImgIdx] = useState(0);

  const updatePlacedItem = usePlanStore((s) => s.updatePlacedItem);
  const deletePlacedItems = usePlanStore((s) => s.deletePlacedItems);
  const duplicatePlacedItems = usePlanStore((s) => s.duplicatePlacedItems);
  const bringToFront = usePlanStore((s) => s.bringToFront);
  const bringForward = usePlanStore((s) => s.bringForward);
  const sendBackward = usePlanStore((s) => s.sendBackward);
  const sendToBack = usePlanStore((s) => s.sendToBack);

  const images = cat.allImages ?? (cat.imageUrl ? [cat.imageUrl] : []);
  const safeIdx = Math.min(imgIdx, Math.max(0, images.length - 1));
  const isNoFill = placed.color === "none";
  const currentColor = isNoFill ? cat.defaultColor : (placed.color ?? cat.defaultColor);
  const cur = placed.labelPosition ?? "center";

  const LP = (value: PlacedItem["labelPosition"] & string, label: string) => (
    <LabelPosBtn
      current={cur}
      value={value}
      label={label}
      onClick={() => updatePlacedItem(id, { labelPosition: value })}
    />
  );

  return (
    <>
      <h3 style={h3Style}>{cat.name}</h3>
      <div style={{ fontSize: 11, color: "#6b7785", marginBottom: 8 }}>
        {cat.category} › {cat.subcategory}
      </div>

      {/* Image gallery */}
      {images.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ position: "relative", height: 160, background: "#f5f5f5", borderRadius: 4, border: "1px solid #e1e6ed", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <img
              key={images[safeIdx]}
              src={images[safeIdx]}
              alt={cat.name}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            {images.length > 1 && safeIdx > 0 && (
              <button
                onClick={() => setImgIdx(safeIdx - 1)}
                style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.9)", border: "1px solid #c0cad4", borderRadius: 3, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "4px 8px", color: "#2d3742" }}
              >‹</button>
            )}
            {images.length > 1 && safeIdx < images.length - 1 && (
              <button
                onClick={() => setImgIdx(safeIdx + 1)}
                style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.9)", border: "1px solid #c0cad4", borderRadius: 3, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "4px 8px", color: "#2d3742" }}
              >›</button>
            )}
          </div>
          {images.length > 1 && (
            <div style={{ fontSize: 10, color: "#9aa5b1", textAlign: "center", marginTop: 4 }}>
              {safeIdx + 1} / {images.length}
            </div>
          )}
        </div>
      )}

      {cat.seriesName && (
        <div style={fieldRow}>
          <label style={labelStyle}>Series</label>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#4a90d9" }}>{cat.seriesName}</div>
        </div>
      )}

      <div style={fieldRow}>
        <label style={labelStyle}>Dimensions</label>
        <div style={{ fontSize: 12 }}>
          {cat.friendlyDimensions || `${fmtIn(cat.width)}W × ${fmtIn(cat.depth)}D${cat.height ? ` × ${fmtIn(cat.height)}H` : ""}`}
        </div>
      </div>

      <hr style={hr} />

      <div style={fieldRow}>
        <label style={labelStyle}>Position</label>
        <div style={{ display: "flex", gap: 4 }}>
          <NumField label="x" value={placed.x} onChange={(v) => updatePlacedItem(id, { x: v })} />
          <NumField label="y" value={placed.y} onChange={(v) => updatePlacedItem(id, { y: v })} />
        </div>
      </div>

      <div style={fieldRow}>
        <label style={labelStyle}>Rotation</label>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            type="number"
            value={Math.round(placed.rotation)}
            onChange={(e) => updatePlacedItem(id, { rotation: parseFloat(e.target.value) || 0 })}
            style={{ ...inputStyle, width: 64 }}
          />
          <span style={{ fontSize: 11 }}>°</span>
          <button style={{ ...btnStyle, padding: "3px 6px", marginLeft: 4 }} onClick={() => updatePlacedItem(id, { rotation: (placed.rotation + 90) % 360 })}>+90°</button>
          <button style={{ ...btnStyle, padding: "3px 6px" }} onClick={() => updatePlacedItem(id, { rotation: ((placed.rotation - 90) % 360 + 360) % 360 })}>−90°</button>
        </div>
      </div>

      <div style={fieldRow}>
        <label style={labelStyle}>Color</label>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          <input type="color" value={currentColor} onChange={(e) => updatePlacedItem(id, { color: e.target.value })} style={{ width: 32, height: 22, border: "1px solid #c0cad4", padding: 0 }} />
          {SWATCHES.map((c) => (
            <button key={c} onClick={() => updatePlacedItem(id, { color: c })} title={c}
              style={{ width: 16, height: 16, background: c, border: c === (placed.color ?? "") ? "2px solid #1f6feb" : "1px solid #888", borderRadius: 2, cursor: "pointer", padding: 0 }}
            />
          ))}
          <button
            onClick={() => updatePlacedItem(id, { color: "none" })}
            title="No fill (border only)"
            style={{ width: 20, height: 16, background: "white", border: isNoFill ? "2px solid #1f6feb" : "1px solid #888", borderRadius: 2, cursor: "pointer", padding: 0, fontSize: 11, color: "#e53935" }}
          >⊘</button>
          <button style={{ ...btnStyle, padding: "2px 6px", fontSize: 10 }} onClick={() => updatePlacedItem(id, { color: undefined })}>Reset</button>
        </div>
      </div>

      <div style={fieldRow}>
        <label style={labelStyle}>Layer order</label>
        <div style={{ display: "flex", gap: 3 }}>
          {([
            { label: "⤓ Back", action: () => sendToBack(id), title: "Send to back (Shift+[)" },
            { label: "↓ Bwd",  action: () => sendBackward(id), title: "Send backward ([)" },
            { label: "↑ Fwd",  action: () => bringForward(id), title: "Bring forward (])" },
            { label: "⤒ Front",action: () => bringToFront(id), title: "Bring to front (Shift+])" },
          ] as const).map(({ label, action, title }) => (
            <button key={label} onClick={action} title={title} style={{ ...btnStyle, flex: 1, padding: "4px 2px", fontSize: 10 }}>{label}</button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "#9aa5b1", marginTop: 3 }}>[ / ] to step · Shift+[ / ] to jump</div>
      </div>

      <div style={fieldRow}>
        <label style={labelStyle}>Label</label>
        {/* 3×3 position grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3, width: 120 }}>
          {LP("top-left",     "↖")}
          {LP("top",         "↑")}
          {LP("top-right",   "↗")}
          {LP("left",        "←")}
          {LP("center",      "●")}
          {LP("right",       "→")}
          {LP("bottom-left", "↙")}
          {LP("bottom",      "↓")}
          {LP("bottom-right","↘")}
        </div>
        {/* Font size */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
          <span style={{ fontSize: 11, color: "#6b7785", flexShrink: 0 }}>Font size</span>
          <input
            type="number" min={1} max={32} step={1}
            value={placed.labelFontSize ?? ""}
            placeholder="auto"
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              updatePlacedItem(id, { labelFontSize: isNaN(v) ? undefined : Math.max(1, Math.min(32, v)) });
            }}
            style={{ ...inputStyle, width: 64 }}
          />
          {placed.labelFontSize != null && (
            <button style={{ ...btnStyle, padding: "2px 8px", fontSize: 10, width: "auto" }} onClick={() => updatePlacedItem(id, { labelFontSize: undefined })}>Auto</button>
          )}
        </div>
      </div>

      <hr style={hr} />
      <button style={btnStyle} onClick={() => duplicatePlacedItems([id])}>Duplicate (Ctrl+D)</button>
      <button style={{ ...btnStyle, background: "#e74c3c", color: "white", marginTop: 6 }} onClick={() => deletePlacedItems([id])}>Delete</button>
    </>
  );
}

function LabelPosBtn({
  current,
  value,
  label,
  onClick,
}: {
  current: string;
  value: string;
  label: string;
  onClick: () => void;
}) {
  const active = current === value;
  return (
    <button
      onClick={onClick}
      title={value.charAt(0).toUpperCase() + value.slice(1)}
      style={{
        padding: "5px 0",
        fontSize: 13,
        lineHeight: 1,
        background: active ? "#1f6feb" : "white",
        color: active ? "white" : "#2d3742",
        border: "1px solid #c0cad4",
        borderRadius: 3,
        cursor: "pointer",
        textAlign: "center",
      }}
    >
      {label}
    </button>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "5px 0",
        fontSize: 11,
        fontWeight: active ? 600 : 400,
        background: active ? "#1f6feb" : "white",
        color: active ? "white" : "#2d3742",
        border: "1px solid #c0cad4",
        borderRadius: 3,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <span style={{ fontSize: 10, color: "#6b7785", width: 10 }}>{label}</span>
      <input
        type="number"
        value={Math.round(value * 10) / 10}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{ ...inputStyle, width: 90 }}
        step={0.5}
      />
    </div>
  );
}

function panelStyle(width: number): React.CSSProperties {
  return {
    width,
    height: "100%",
    background: "#fafbfc",
    borderLeft: "1px solid #c0cad4",
    padding: 12,
    overflow: "auto",
    boxSizing: "border-box",
  };
}

const h3Style: React.CSSProperties = {
  margin: "0 0 8px 0",
  fontSize: 13,
  fontWeight: 600,
  color: "#1a1f26",
};
const fieldRow: React.CSSProperties = { marginBottom: 8 };
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "#6b7785",
  marginBottom: 3,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 12,
  padding: "4px 6px",
  border: "1px solid #c0cad4",
  borderRadius: 3,
  boxSizing: "border-box",
};
const btnStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 12,
  padding: "6px 10px",
  border: "1px solid #c0cad4",
  borderRadius: 4,
  background: "white",
  cursor: "pointer",
};
const hr: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid #e1e6ed",
  margin: "10px 0",
};

function fmtIn(inches: number): string {
  return `${parseFloat(inches.toFixed(1))}"`;
}
