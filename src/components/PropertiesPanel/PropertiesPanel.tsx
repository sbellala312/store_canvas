import { usePlanStore, findMatchingKit } from "../../state/planStore";
import { getCatalogItem } from "../../data/catalog";
import { feetInches } from "../../utils/units";

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
  const updatePlacedItem = usePlanStore((s) => s.updatePlacedItem);
  const deletePlacedItems = usePlanStore((s) => s.deletePlacedItems);
  const duplicatePlacedItems = usePlanStore((s) => s.duplicatePlacedItems);
  const updateZone = usePlanStore((s) => s.updateZone);
  const deleteZone = usePlanStore((s) => s.deleteZone);
  const zoneEditMode = usePlanStore((s) => s.zoneEditMode);
  const setZoneEditMode = usePlanStore((s) => s.setZoneEditMode);
  const updateNonUsable = usePlanStore((s) => s.updateNonUsable);
  const deleteNonUsable = usePlanStore((s) => s.deleteNonUsable);
  const nonUsableEditMode = usePlanStore((s) => s.nonUsableEditMode);
  const setNonUsableEditMode = usePlanStore((s) => s.setNonUsableEditMode);
  const updateWall = usePlanStore((s) => s.updateWall);
  const deleteWall = usePlanStore((s) => s.deleteWall);
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
    const currentColor = placed.color ?? cat.defaultColor;
    return (
      <div style={panelStyle(width)}>
        <h3 style={h3Style}>{cat.name}</h3>
        <div style={{ fontSize: 11, color: "#6b7785", marginBottom: 8 }}>
          {cat.category} › {cat.subcategory}
          {cat.isAccessory && <span> · accessory</span>}
        </div>
        <div style={fieldRow}>
          <label style={labelStyle}>Dimensions</label>
          <div style={{ fontSize: 12 }}>
            {feetInches(cat.width, { compact: true })} ×{" "}
            {feetInches(cat.depth, { compact: true })}
            {cat.height ? ` × ${feetInches(cat.height, { compact: true })} h` : ""}
          </div>
        </div>
        <div style={fieldRow}>
          <label style={labelStyle}>Position</label>
          <div style={{ display: "flex", gap: 4 }}>
            <NumField
              label="x"
              value={placed.x}
              onChange={(v) => updatePlacedItem(id, { x: v })}
            />
            <NumField
              label="y"
              value={placed.y}
              onChange={(v) => updatePlacedItem(id, { y: v })}
            />
          </div>
        </div>
        <div style={fieldRow}>
          <label style={labelStyle}>Rotation</label>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="number"
              value={Math.round(placed.rotation)}
              onChange={(e) =>
                updatePlacedItem(id, { rotation: parseFloat(e.target.value) || 0 })
              }
              style={{ ...inputStyle, width: 64 }}
            />
            <span style={{ fontSize: 11 }}>°</span>
            <button
              style={{ ...btnStyle, padding: "3px 6px", marginLeft: 4 }}
              onClick={() =>
                updatePlacedItem(id, { rotation: (placed.rotation + 90) % 360 })
              }
            >
              +90°
            </button>
            <button
              style={{ ...btnStyle, padding: "3px 6px" }}
              onClick={() =>
                updatePlacedItem(id, {
                  rotation: ((placed.rotation - 90) % 360 + 360) % 360,
                })
              }
            >
              −90°
            </button>
          </div>
        </div>
        <div style={fieldRow}>
          <label style={labelStyle}>Color</label>
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="color"
              value={currentColor}
              onChange={(e) => updatePlacedItem(id, { color: e.target.value })}
              style={{ width: 32, height: 22, border: "1px solid #c0cad4", padding: 0 }}
            />
            {SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => updatePlacedItem(id, { color: c })}
                title={c}
                style={{
                  width: 16,
                  height: 16,
                  background: c,
                  border: c === currentColor ? "2px solid #1f6feb" : "1px solid #888",
                  borderRadius: 2,
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
            <button
              style={{ ...btnStyle, padding: "2px 6px", fontSize: 10 }}
              onClick={() => updatePlacedItem(id, { color: undefined })}
            >
              Reset
            </button>
          </div>
        </div>
        <hr style={hr} />
        <div style={fieldRow}>
          <label style={labelStyle}>SKU</label>
          <input
            type="text"
            value={placed.sku ?? ""}
            placeholder="e.g. SOF-2241"
            onChange={(e) => updatePlacedItem(id, { sku: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div style={fieldRow}>
          <label style={labelStyle}>Vendor</label>
          <input
            type="text"
            value={placed.vendor ?? ""}
            placeholder="e.g. Ashley"
            onChange={(e) => updatePlacedItem(id, { vendor: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div style={fieldRow}>
          <label style={labelStyle}>Price point</label>
          <input
            type="text"
            value={placed.pricePoint ?? ""}
            placeholder="$ / $$ / $$$"
            onChange={(e) => updatePlacedItem(id, { pricePoint: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div style={fieldRow}>
          <label style={labelStyle}>Tags</label>
          <input
            type="text"
            value={placed.tags?.join(", ") ?? ""}
            placeholder="featured, sale, new"
            onChange={(e) =>
              updatePlacedItem(id, {
                tags: e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
            style={inputStyle}
          />
        </div>
        <hr style={hr} />
        <button
          style={btnStyle}
          onClick={() => duplicatePlacedItems([id])}
        >
          Duplicate (Ctrl+D)
        </button>
        <button
          style={{ ...btnStyle, background: "#e74c3c", color: "white", marginTop: 6 }}
          onClick={() => deletePlacedItems([id])}
        >
          Delete
        </button>
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
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
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
          </div>
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
        style={{ ...inputStyle, width: 60 }}
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
