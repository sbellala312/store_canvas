import { useEffect, useState } from "react";
import { groupItems } from "../../data/catalog";
import { searchAshleyCatalog } from "../../services/azureSearch";
import { usePlanStore } from "../../state/planStore";
import { setActiveDrag, clearActiveDrag } from "../../state/dragContext";
import type { CatalogItem, Kit } from "../../types/model";
import { ConfirmModal } from "../dialogs/MiniModal";

type Tab = "catalog" | "kits";

export function CatalogPanel() {
  const [tab, setTab] = useState<Tab>("catalog");
  const [deleteTarget, setDeleteTarget] = useState<Kit | null>(null);
  const [query, setQuery] = useState("");
  const [kitQuery, setKitQuery] = useState("");

  const [azureItems, setAzureItems] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const kits = usePlanStore((s) => s.kits);
  const kq = kitQuery.trim().toLowerCase();
  const filteredKits = kq ? kits.filter((k) => k.name.toLowerCase().includes(kq)) : kits;
  const deleteKit = usePlanStore((s) => s.deleteKit);

  // Expand newly seen categories automatically
  useEffect(() => {
    const grouped = groupItems(azureItems);
    setExpanded((prev) => {
      const next = { ...prev };
      for (const cat of Object.keys(grouped)) {
        if (!(cat in next)) next[cat] = true;
      }
      return next;
    });
  }, [azureItems]);

  // Search on query change: immediate for empty (initial load), debounced for typed queries
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const delay = query.trim() ? 400 : 0;
    const id = setTimeout(() => {
      searchAshleyCatalog(query.trim())
        .then((items) => {
          setAzureItems(items);
          setIsLoading(false);
        })
        .catch((err: Error) => {
          setError(err.message);
          setIsLoading(false);
        });
    }, delay);
    return () => clearTimeout(id);
  }, [query]);

  const handleCatalogDragStart = (item: CatalogItem) => (e: React.DragEvent) => {
    setActiveDrag({ kind: "catalog", item });
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", item.id);
  };

  const grouped = groupItems(azureItems);

  return (
    <>
      <div
        style={{
          width: 280,
          height: "100%",
          background: "#fafbfc",
          borderRight: "1px solid #c0cad4",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", borderBottom: "1px solid #c0cad4" }}>
          <button onClick={() => setTab("catalog")} style={tabStyle(tab === "catalog")}>
            Catalog
          </button>
          <button onClick={() => setTab("kits")} style={tabStyle(tab === "kits")}>
            Kits ({kits.length})
          </button>
        </div>

        {tab === "catalog" && (
          <div style={{ padding: "6px 8px", borderBottom: "1px solid #e8ecf2" }}>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search Ashley catalog…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "5px 28px 5px 8px",
                  fontSize: 12,
                  border: "1px solid #c0cad4",
                  borderRadius: 4,
                  background: "white",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {query ? (
                <button
                  onClick={() => setQuery("")}
                  style={{
                    position: "absolute",
                    right: 6,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#9aa5b1",
                    fontSize: 14,
                    padding: 0,
                    lineHeight: 1,
                  }}
                  title="Clear search"
                >
                  ×
                </button>
              ) : (
                <span
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#9aa5b1",
                    fontSize: 12,
                    pointerEvents: "none",
                  }}
                >
                  ⌕
                </span>
              )}
            </div>
          </div>
        )}

        <div style={{ overflow: "auto", flex: 1, padding: 8 }}>
          {tab === "catalog" && (
            <>
              {isLoading && (
                <div style={{ padding: 12, color: "#6b7785", fontSize: 12, textAlign: "center" }}>
                  Loading Ashley catalog…
                </div>
              )}

              {!isLoading && error && (
                <div style={{ padding: 12, fontSize: 11, color: "#c0392b", background: "#fdf0ef", borderRadius: 4, border: "1px solid #f5c6c2" }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Connection error</div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", fontSize: 11 }}>{error}</pre>
                </div>
              )}

              {!isLoading && !error && azureItems.length === 0 && (
                <div style={{ padding: 12, color: "#6b7785", fontSize: 12 }}>
                  No items returned from catalog.
                </div>
              )}

              {!isLoading && !error && query.trim() && azureItems.length > 0 && (
                // Flat search results
                <div>
                  <div style={{ fontSize: 10, color: "#9aa5b1", padding: "0 4px 6px", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {azureItems.length} result{azureItems.length !== 1 ? "s" : ""} for "{query.trim()}"
                  </div>
                  {azureItems.map((item) => (
                    <ItemCard key={item.id} item={item} onDragStart={handleCatalogDragStart(item)} onDragEnd={clearActiveDrag} />
                  ))}
                </div>
              )}

              {!isLoading && !error && !query.trim() && azureItems.length > 0 && (
                // Grouped browse view
                Object.entries(grouped).map(([category, subs]) => (
                  <div key={category} style={{ marginBottom: 8 }}>
                    <div
                      onClick={() => setExpanded((e) => ({ ...e, [category]: !e[category] }))}
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                        padding: "4px 6px",
                        background: "#e8ecf2",
                        borderRadius: 4,
                        userSelect: "none",
                      }}
                    >
                      {expanded[category] ? "▾" : "▸"} {category}
                    </div>
                    {expanded[category] &&
                      Object.entries(subs).map(([sub, items]) => (
                        <div key={sub} style={{ marginTop: 4 }}>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#6b7785",
                              padding: "2px 6px",
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                            }}
                          >
                            {sub}
                          </div>
                          {items.map((item) => (
                            <ItemCard key={item.id} item={item} onDragStart={handleCatalogDragStart(item)} onDragEnd={clearActiveDrag} />
                          ))}
                        </div>
                      ))}
                  </div>
                ))
              )}
            </>
          )}

          {tab === "kits" && kits.length === 0 && (
            <div style={{ padding: 12, color: "#6b7785", fontSize: 12 }}>
              No kits yet. Select items on the canvas and click <b>★ Save Kit</b> in the toolbar.
            </div>
          )}

          {tab === "kits" && kits.length > 0 && (
            <div>
              <div style={{ marginBottom: 8, position: "relative" }}>
                <input
                  type="text"
                  placeholder="Search kits…"
                  value={kitQuery}
                  onChange={(e) => setKitQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "5px 28px 5px 8px",
                    fontSize: 12,
                    border: "1px solid #c0cad4",
                    borderRadius: 4,
                    background: "white",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                {kitQuery ? (
                  <button
                    onClick={() => setKitQuery("")}
                    style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9aa5b1", fontSize: 14, padding: 0, lineHeight: 1 }}
                    title="Clear search"
                  >
                    ×
                  </button>
                ) : (
                  <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#9aa5b1", fontSize: 12, pointerEvents: "none" }}>⌕</span>
                )}
              </div>
              {filteredKits.length === 0 && (
                <div style={{ padding: "8px 4px", color: "#6b7785", fontSize: 12 }}>
                  No kits match "{kitQuery}"
                </div>
              )}
              {filteredKits.map((v) => (
                <div
                  key={v.id}
                  draggable
                  onDragStart={(e) => {
                    setActiveDrag({ kind: "kit", kit: v });
                    e.dataTransfer.effectAllowed = "copy";
                    e.dataTransfer.setData("text/plain", v.id);
                  }}
                  onDragEnd={() => clearActiveDrag()}
                  style={{
                    padding: "8px 10px",
                    margin: "4px 0",
                    border: "1px solid #d4dae2",
                    borderRadius: 4,
                    background: "white",
                    cursor: "grab",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{v.name}</div>
                    <div style={{ fontSize: 10, color: "#6b7785" }}>
                      {v.items.length} pieces · {feetInches(v.bbox.width, { compact: true })} ×{" "}
                      {feetInches(v.bbox.height, { compact: true })}
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteTarget(v)}
                    style={{ background: "transparent", border: "none", color: "#9aa5b1", cursor: "pointer", fontSize: 14 }}
                    title="Delete kit"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Delete Kit"
          message={`Delete "${deleteTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => {
            deleteKit(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}

function ItemThumb({ item }: { item: CatalogItem }) {
  const [imgFailed, setImgFailed] = useState(false);
  if (item.imageUrl && !imgFailed) {
    return (
      <img
        src={item.imageUrl}
        alt={item.name}
        onError={() => setImgFailed(true)}
        style={{
          width: 44,
          height: 44,
          objectFit: "contain",
          borderRadius: 3,
          border: "1px solid #d4dae2",
          background: "#f5f5f5",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: 44,
        height: 44,
        background: item.defaultColor,
        border: "1px solid #888",
        borderRadius: item.shape === "circle" ? "50%" : 3,
        flexShrink: 0,
      }}
    />
  );
}

function ItemCard({
  item,
  onDragStart,
  onDragEnd,
}: {
  item: CatalogItem;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        margin: "2px 0",
        border: "1px solid #d4dae2",
        borderRadius: 4,
        cursor: "grab",
        background: "white",
      }}
      title={`${item.name} — ${item.width}" × ${item.depth}"`}
    >
      <ItemThumb item={item} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.name}
        </div>
        {item.seriesName && (
          <div style={{ fontSize: 10, color: "#4a90d9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.seriesName}
          </div>
        )}
        <div style={{ fontSize: 10, color: "#6b7785" }}>
          {item.width > 0 && item.depth > 0
            ? `${fmtIn(item.width)}W × ${fmtIn(item.depth)}D${item.height ? ` × ${fmtIn(item.height)}H` : ""}`
            : item.category}
        </div>
      </div>
    </div>
  );
}

// Format a dimension in inches, trimming unnecessary decimals: 27 → "27"", 18.1 → "18.1""
function fmtIn(inches: number): string {
  return `${parseFloat(inches.toFixed(1))}"`;
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "8px 0",
    background: active ? "white" : "#eef2f6",
    border: "none",
    borderBottom: active ? "2px solid #1f6feb" : "2px solid transparent",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
  };
}
