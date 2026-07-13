import { useState } from "react";
import { Modal } from "./Modal";
import type { CadReviewRow } from "../../services/cadAutoPlace";
import { placeMatched } from "../../services/cadAutoPlace";
import { CadDetectionMap } from "./CadDetectionMap";
import type { CadUsage } from "../../services/cadVision";

interface Props {
  rows: CadReviewRow[];
  scopeLabel: string;
  /** The exact image analyzed by Gemini — enables the visual detection map. */
  analyzedImage?: string;
  /** Token usage + estimated cost for the vision call. */
  usage?: CadUsage | null;
  onClose: () => void;
}

export function CadImportDialog({ rows, scopeLabel, analyzedImage, usage, onClose }: Props) {
  const [showMap, setShowMap] = useState(false);

  const matched   = rows.filter((r) => r.status === "matched");
  const duplicates = rows.filter((r) => r.status === "duplicate");
  const unmatched  = rows.filter((r) => r.status === "unmatched");

  // Collapse the unmatched list to unique SKUs with an occurrence count, so a
  // repeated label shows once ("B310-10 ×4") instead of flooding the list.
  const unmatchedUnique = Array.from(
    unmatched.reduce((map, row) => {
      const cur = map.get(row.sku);
      if (cur) cur.count++;
      else map.set(row.sku, { row, count: 1 });
      return map;
    }, new Map<string, { row: CadReviewRow; count: number }>()).values()
  );

  // checked[i] maps index within the combined (matched + duplicates) list
  const allPlaceable = [...matched, ...duplicates];
  const [checked, setChecked] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(allPlaceable.map((r, i) => [i, r.status === "matched"]))
  );

  const selectedCount = Object.values(checked).filter(Boolean).length;

  const handlePlace = () => {
    const toPlace = allPlaceable.filter((_, i) => checked[i]);
    placeMatched(toPlace);
    onClose();
  };

  const toggleAll = (val: boolean) =>
    setChecked(Object.fromEntries(allPlaceable.map((_, i) => [i, val])));

  return (
    <Modal
      title={`Auto-place — ${scopeLabel}`}
      onClose={onClose}
      width={700}
      closeOnBackdrop={false}
    >
      {/* Cost + token usage for this scan */}
      {usage && (
        <div style={{
          display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 14px",
          background: "#f6f8fb", border: "1px solid #e1e6ed", borderRadius: 8,
          padding: "8px 14px", marginBottom: 14, fontSize: 12, color: "#4a5568",
        }}>
          <span style={{ fontWeight: 700, color: "#1a5c2a" }}>
            Est. cost: ${usage.estCostUsd.toFixed(4)}
          </span>
          <span style={{ color: "#c0cad4" }}>|</span>
          <span>Model: <b>{usage.model}</b></span>
          <span style={{ color: "#c0cad4" }}>|</span>
          <span>
            {usage.inputTokens.toLocaleString()} in / {usage.outputTokens.toLocaleString()} out tok
            <span style={{ color: "#8a96a3" }}> (incl. {usage.thinkingTokens.toLocaleString()} thinking)</span>
          </span>
        </div>
      )}

      {/* Detection map toggle — visual explanation of what the model detected */}
      {analyzedImage && (
        <div style={{ marginBottom: 14 }}>
          <button
            onClick={() => setShowMap((s) => !s)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: showMap ? "#eef4ff" : "white",
              border: "1px solid #c7d2e0", borderRadius: 6,
              padding: "6px 12px", fontSize: 12, fontWeight: 600,
              color: "#2c5282", cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 14 }}>🗺️</span>
            {showMap ? "Hide detection map" : "Show how the AI detected these items"}
          </button>
          {showMap && (
            <div style={{ marginTop: 10 }}>
              <CadDetectionMap image={analyzedImage} rows={rows} />
            </div>
          )}
        </div>
      )}

      {/* Matched */}
      <Section
        title={`New items to place (${matched.length})`}
        titleColor="#1a5c2a"
        bgColor="#f0faf3"
        emptyMsg="No new items detected."
        rows={matched}
        offset={0}
        checked={checked}
        setChecked={setChecked}
        onToggleAll={matched.length > 0 ? toggleAll : undefined}
        allCount={allPlaceable.length}
      />

      {/* Duplicates — already on canvas */}
      {duplicates.length > 0 && (
        <Section
          title={`Already on canvas (${duplicates.length})`}
          titleColor="#7a5c00"
          bgColor="#fffbf0"
          emptyMsg=""
          rows={duplicates}
          offset={matched.length}
          checked={checked}
          setChecked={setChecked}
          hint="These items are already placed nearby. Unchecked by default — check to place again."
        />
      )}

      {/* Unmatched — collapsed to unique SKUs */}
      {unmatchedUnique.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#c0392b", marginBottom: 6 }}>
            Not found in catalog ({unmatchedUnique.length} unique) — not placed
          </div>
          <div style={{
            background: "#fff8f7", border: "1px solid #f5c6c2", borderRadius: 6,
            padding: "8px 12px", display: "flex", flexWrap: "wrap", gap: "4px 12px",
            maxHeight: 140, overflowY: "auto",
          }}>
            {unmatchedUnique.map(({ row, count }, i) => (
              <span key={i} style={{ fontSize: 12, color: "#922b21" }}>
                <b>{row.sku}</b>
                {count > 1 && <span style={{ color: "#c0392b", fontWeight: 700 }}> ×{count}</span>}{" "}
                <span style={{ color: "#a93226" }}>({row.detection.rawLabel})</span>
              </span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#6b7785", marginTop: 4 }}>
            Search for these manually and drag to canvas.
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{
        display: "flex", justifyContent: "flex-end", gap: 8,
        paddingTop: 10, borderTop: "1px solid #e1e6ed",
      }}>
        <button style={cancelBtn} onClick={onClose}>Cancel</button>
        <button
          style={{ ...placeBtn, opacity: selectedCount === 0 ? 0.5 : 1 }}
          disabled={selectedCount === 0}
          onClick={handlePlace}
        >
          Place {selectedCount} item{selectedCount !== 1 ? "s" : ""}
        </button>
      </div>
    </Modal>
  );
}

// ── Shared section component ──────────────────────────────────────────────────

interface SectionProps {
  title: string;
  titleColor: string;
  bgColor: string;
  emptyMsg: string;
  rows: CadReviewRow[];
  offset: number;
  checked: Record<number, boolean>;
  setChecked: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  hint?: string;
  onToggleAll?: (val: boolean) => void;
  allCount?: number;
}

function Section({
  title, titleColor, bgColor, emptyMsg, rows, offset,
  checked, setChecked, hint, onToggleAll,
}: SectionProps) {
  if (rows.length === 0 && !emptyMsg) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6,
      }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: titleColor }}>{title}</span>
        {onToggleAll && rows.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            <button style={linkBtn} onClick={() => onToggleAll(true)}>Select all</button>
            <button style={linkBtn} onClick={() => onToggleAll(false)}>Deselect all</button>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div style={{ color: "#6b7785", fontSize: 12, padding: "6px 0" }}>{emptyMsg}</div>
      ) : (
        <>
          {hint && (
            <div style={{ fontSize: 11, color: "#6b7785", marginBottom: 6 }}>{hint}</div>
          )}
          <div style={{ border: "1px solid #e1e6ed", borderRadius: 6, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: bgColor, borderBottom: "1px solid #e1e6ed" }}>
                  <th style={th}></th>
                  <th style={th}>Image</th>
                  <th style={th}>SKU</th>
                  <th style={th}>Name</th>
                  <th style={th}>Size (W × D)</th>
                  <th style={th}>Rotation</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const idx = offset + i;
                  const cat = row.catalogItem!;
                  const wFt = (cat.width / 12).toFixed(1);
                  const dFt = (cat.depth / 12).toFixed(1);
                  return (
                    <tr
                      key={i}
                      style={{
                        borderBottom: "1px solid #f0f3f6",
                        background: checked[idx] ? "#f7fbff" : "white",
                        opacity: checked[idx] ? 1 : 0.6,
                      }}
                    >
                      <td style={{ ...td, textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={!!checked[idx]}
                          onChange={(e) =>
                            setChecked((c) => ({ ...c, [idx]: e.target.checked }))
                          }
                        />
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>
                        {cat.imageUrl ? (
                          <img
                            src={cat.imageUrl}
                            alt={cat.name}
                            style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 4 }}
                          />
                        ) : (
                          <div style={{
                            width: 44, height: 44, background: cat.defaultColor || "#c8d0da",
                            borderRadius: 4, display: "inline-block",
                          }} />
                        )}
                      </td>
                      <td style={td}>
                        <div style={{ fontWeight: 600, color: "#1a1f26" }}>{row.sku}</div>
                        <div style={{ color: "#8a96a3", fontSize: 11 }}>{row.detection.rawLabel}</div>
                      </td>
                      <td style={td}>
                        <div>{cat.name}</div>
                        {cat.seriesName && (
                          <div style={{ color: "#6b7785", fontSize: 11 }}>{cat.seriesName}</div>
                        )}
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        {wFt}′ × {dFt}′
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>
                        {Math.round(row.rotation)}°
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const th: React.CSSProperties = {
  padding: "6px 10px", textAlign: "left", fontWeight: 600, color: "#4a5568",
  fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
};
const td: React.CSSProperties = { padding: "6px 10px", verticalAlign: "middle", color: "#2d3742" };
const linkBtn: React.CSSProperties = {
  background: "none", border: "none", color: "#3b82f6", cursor: "pointer",
  fontSize: 12, padding: 0, textDecoration: "underline",
};
const cancelBtn: React.CSSProperties = {
  padding: "7px 16px", borderRadius: 5, border: "1px solid #c0cad4",
  background: "white", color: "#2d3742", fontSize: 13, cursor: "pointer",
};
const placeBtn: React.CSSProperties = {
  padding: "7px 18px", borderRadius: 5, border: "none",
  background: "#2563eb", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
