import { useState } from "react";
import { Modal } from "./Modal";
import { PromptModal, ConfirmModal } from "./MiniModal";
import { usePlanStore } from "../../state/planStore";
import { feetInches } from "../../utils/units";
import type { FloorPlan } from "../../types/model";

interface Props {
  onClose: () => void;
  onNew: () => void;
}

type SortKey = "recent" | "name" | "items";

// Derive a group name from the plan name: the part before the first " - " or "_".
// Used only when a plan has no explicit folder assigned.
function groupOf(name: string): string {
  const dashIdx = name.indexOf(" - ");
  if (dashIdx > 0) return name.slice(0, dashIdx).trim();
  const underIdx = name.indexOf("_");
  if (underIdx > 0) return name.slice(0, underIdx).trim();
  return "Other";
}

// A plan's effective folder: explicit folder if set, else auto-derived from name.
function effectiveFolder(p: FloorPlan): string {
  return p.folder && p.folder.trim() ? p.folder : groupOf(p.name);
}

const MOVE_NEW = "__new__";

export function PlansDialog({ onClose, onNew }: Props) {
  const plans = usePlanStore((s) => s.plans);
  const activeId = usePlanStore((s) => s.activePlanId);
  const setActive = usePlanStore((s) => s.setActivePlan);
  const renamePlan = usePlanStore((s) => s.renamePlan);
  const duplicatePlan = usePlanStore((s) => s.duplicatePlan);
  const deletePlan = usePlanStore((s) => s.deletePlan);
  const folders = usePlanStore((s) => s.folders);
  const createFolder = usePlanStore((s) => s.createFolder);
  const deleteFolder = usePlanStore((s) => s.deleteFolder);
  const movePlanToFolder = usePlanStore((s) => s.movePlanToFolder);

  const [renameTarget, setRenameTarget] = useState<FloorPlan | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<FloorPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FloorPlan | null>(null);
  const [newFolderPrompt, setNewFolderPrompt] = useState(false);
  const [moveToNewTarget, setMoveToNewTarget] = useState<FloorPlan | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Filter by search (name, case-insensitive).
  const q = search.trim().toLowerCase();
  const filtered = plans.filter((p) => !q || p.name.toLowerCase().includes(q));
  const sortFn = (a: FloorPlan, b: FloorPlan) => {
    if (sortKey === "name") return a.name.localeCompare(b.name);
    if (sortKey === "items") return b.placedItems.length - a.placedItems.length;
    return b.updatedAt - a.updatedAt; // recent
  };

  // Build groups. Seed with persisted (manual) folders so empty ones still show,
  // then bucket each plan under its effective folder.
  const groupMap = new Map<string, FloorPlan[]>();
  for (const f of folders) groupMap.set(f, []);
  for (const p of filtered) {
    const g = effectiveFolder(p);
    if (!groupMap.has(g)) groupMap.set(g, []);
    groupMap.get(g)!.push(p);
  }

  const isManual = (name: string) => folders.includes(name);

  let groups = [...groupMap.entries()].map(([name, items]) => ({
    name,
    items: items.slice().sort(sortFn),
  }));
  // While searching, hide empty groups to reduce noise.
  if (q) groups = groups.filter((g) => g.items.length > 0);
  groups.sort((a, b) => {
    if (a.name === "Other") return 1;
    if (b.name === "Other") return -1;
    const ar = a.items.length ? Math.max(...a.items.map((p) => p.updatedAt)) : -1;
    const br = b.items.length ? Math.max(...b.items.map((p) => p.updatedAt)) : -1;
    return br - ar;
  });

  // Folder options offered in each plan's "Move to" dropdown.
  const folderOptions = [...new Set([...folders, ...plans.map(effectiveFolder)])]
    .filter((f) => f !== "Other")
    .sort((a, b) => a.localeCompare(b));

  function handleMoveChange(p: FloorPlan, value: string) {
    if (value === MOVE_NEW) {
      setMoveToNewTarget(p);
    } else {
      movePlanToFolder(p.id, value || null);
    }
  }

  const renderPlanRow = (p: FloorPlan) => {
    const w = p.floor.kind === "rect" ? p.floor.width : p.floor.bbox.width;
    const h = p.floor.kind === "rect" ? p.floor.height : p.floor.bbox.height;
    const isActive = p.id === activeId;
    return (
      <div
        key={p.id}
        style={{
          padding: 12,
          border: isActive ? "2px solid #1f6feb" : "1px solid #d4dae2",
          borderRadius: 6,
          marginBottom: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          background: isActive ? "#eef4ff" : "white",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {p.name}
            {isActive && (
              <span
                style={{
                  fontSize: 10,
                  background: "#1f6feb",
                  color: "white",
                  padding: "2px 6px",
                  borderRadius: 3,
                  marginLeft: 8,
                  verticalAlign: "middle",
                }}
              >
                ACTIVE
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#6b7785", marginTop: 2 }}>
            {p.floor.kind === "rect" ? "Rect" : "L-shape"} ·{" "}
            {feetInches(w, { compact: true })} ×{" "}
            {feetInches(h, { compact: true })} · {p.placedItems.length} items ·{" "}
            updated {new Date(p.updatedAt).toLocaleString()}
          </div>
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#9aa5b1" }}>Folder:</span>
            <select
              value={p.folder ?? ""}
              onChange={(e) => handleMoveChange(p, e.target.value)}
              title="Move this plan to a folder"
              style={{
                fontSize: 11,
                padding: "2px 6px",
                border: "1px solid #d4dae2",
                borderRadius: 4,
                background: "white",
                cursor: "pointer",
                maxWidth: 180,
              }}
            >
              <option value="">Auto (by name) — {groupOf(p.name)}</option>
              {folderOptions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
              <option value={MOVE_NEW}>+ New folder…</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {!isActive && (
            <button
              onClick={() => {
                setActive(p.id);
                onClose();
              }}
              style={btnSm}
            >
              Open
            </button>
          )}
          <button onClick={() => setRenameTarget(p)} style={btnSm}>
            Rename
          </button>
          <button onClick={() => setDuplicateTarget(p)} style={btnSm}>
            Duplicate
          </button>
          <button
            onClick={() => setDeleteTarget(p)}
            style={{ ...btnSm, color: "#e74c3c" }}
          >
            Delete
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Modal title="Plans" onClose={onClose} width={580} closeOnBackdrop={false}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => {
              onClose();
              onNew();
            }}
            style={btnPrimary}
          >
            + New plan
          </button>
          <button onClick={() => setNewFolderPrompt(true)} style={btnSecondary}>
            + New folder
          </button>
          <input
            type="text"
            placeholder="Search plans…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              minWidth: 120,
              padding: "7px 10px",
              fontSize: 13,
              border: "1px solid #c0cad4",
              borderRadius: 4,
            }}
          />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            title="Sort plans within each folder"
            style={{
              padding: "7px 8px",
              fontSize: 13,
              border: "1px solid #c0cad4",
              borderRadius: 4,
              background: "white",
              cursor: "pointer",
            }}
          >
            <option value="recent">Recent</option>
            <option value="name">Name A–Z</option>
            <option value="items">Item count</option>
          </select>
        </div>

        <div style={{ marginTop: 12 }}>
          {plans.length === 0 && folders.length === 0 && (
            <div style={{ color: "#6b7785", fontSize: 13, padding: 12 }}>
              No saved plans yet. Click "+ New plan" to create one.
            </div>
          )}
          {plans.length > 0 && filtered.length === 0 && (
            <div style={{ color: "#6b7785", fontSize: 13, padding: 12 }}>
              No plans match "{search}".
            </div>
          )}
          {groups.map((group) => {
            const isCollapsed = collapsed[group.name] ?? false;
            const manual = isManual(group.name);
            return (
              <div key={group.name} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#f5f7fa",
                    border: "1px solid #e1e6ed",
                    borderRadius: 4,
                    padding: "6px 10px",
                    marginBottom: 6,
                  }}
                >
                  <button
                    onClick={() =>
                      setCollapsed((c) => ({ ...c, [group.name]: !isCollapsed }))
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flex: 1,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#2d3742",
                      textAlign: "left",
                      padding: 0,
                    }}
                  >
                    <span style={{ fontSize: 10, width: 10 }}>
                      {isCollapsed ? "▶" : "▼"}
                    </span>
                    {group.name}
                    {manual && (
                      <span
                        style={{
                          fontSize: 9,
                          background: "#dbe6ff",
                          color: "#1f4fa3",
                          padding: "1px 5px",
                          borderRadius: 3,
                        }}
                      >
                        FOLDER
                      </span>
                    )}
                    <span style={{ color: "#9aa5b1", fontWeight: 400 }}>
                      ({group.items.length})
                    </span>
                  </button>
                  {manual && (
                    <button
                      onClick={() => setDeleteFolderTarget(group.name)}
                      title="Delete this folder (plans move back to auto grouping)"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#9aa5b1",
                        fontSize: 13,
                        padding: "0 2px",
                      }}
                    >
                      🗑
                    </button>
                  )}
                </div>
                {!isCollapsed && group.items.length === 0 && (
                  <div style={{ fontSize: 11, color: "#9aa5b1", padding: "2px 12px 8px" }}>
                    Empty — move a plan here using its Folder dropdown.
                  </div>
                )}
                {!isCollapsed && group.items.map(renderPlanRow)}
              </div>
            );
          })}
        </div>
      </Modal>

      {newFolderPrompt && (
        <PromptModal
          title="New Folder"
          label="Folder name"
          defaultValue=""
          confirmLabel="Create"
          onConfirm={(name) => {
            createFolder(name);
            setNewFolderPrompt(false);
          }}
          onCancel={() => setNewFolderPrompt(false)}
        />
      )}

      {moveToNewTarget && (
        <PromptModal
          title="Move to New Folder"
          label={`Folder name for "${moveToNewTarget.name}"`}
          defaultValue=""
          confirmLabel="Move"
          onConfirm={(name) => {
            const trimmed = name.trim();
            if (trimmed) movePlanToFolder(moveToNewTarget.id, trimmed);
            setMoveToNewTarget(null);
          }}
          onCancel={() => setMoveToNewTarget(null)}
        />
      )}

      {deleteFolderTarget && (
        <ConfirmModal
          title="Delete Folder"
          message={`Delete folder "${deleteFolderTarget}"? Plans inside it are kept and move back to automatic grouping.`}
          confirmLabel="Delete folder"
          onConfirm={() => {
            deleteFolder(deleteFolderTarget);
            setDeleteFolderTarget(null);
          }}
          onCancel={() => setDeleteFolderTarget(null)}
        />
      )}

      {renameTarget && (
        <PromptModal
          title="Rename Plan"
          label="New name"
          defaultValue={renameTarget.name}
          confirmLabel="Rename"
          onConfirm={(name) => {
            renamePlan(renameTarget.id, name);
            setRenameTarget(null);
          }}
          onCancel={() => setRenameTarget(null)}
        />
      )}

      {duplicateTarget && (
        <PromptModal
          title="Duplicate Plan"
          label="Name for the copy"
          defaultValue={`${duplicateTarget.name} (copy)`}
          confirmLabel="Duplicate"
          onConfirm={(name) => {
            duplicatePlan(duplicateTarget.id, name);
            setDuplicateTarget(null);
            onClose();
          }}
          onCancel={() => setDuplicateTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Plan"
          message={`Delete "${deleteTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => {
            deletePlan(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: "8px 16px",
  background: "#1f6feb",
  color: "white",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};
const btnSecondary: React.CSSProperties = {
  padding: "8px 14px",
  background: "white",
  color: "#1f6feb",
  border: "1px solid #1f6feb",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};
const btnSm: React.CSSProperties = {
  padding: "4px 10px",
  fontSize: 12,
  background: "white",
  border: "1px solid #c0cad4",
  borderRadius: 4,
  cursor: "pointer",
};
