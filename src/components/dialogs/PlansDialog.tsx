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

export function PlansDialog({ onClose, onNew }: Props) {
  const plans = usePlanStore((s) => s.plans);
  const activeId = usePlanStore((s) => s.activePlanId);
  const setActive = usePlanStore((s) => s.setActivePlan);
  const renamePlan = usePlanStore((s) => s.renamePlan);
  const duplicatePlan = usePlanStore((s) => s.duplicatePlan);
  const deletePlan = usePlanStore((s) => s.deletePlan);

  const [renameTarget, setRenameTarget] = useState<FloorPlan | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<FloorPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FloorPlan | null>(null);

  return (
    <>
      <Modal title="Plans" onClose={onClose} width={560}>
        <button
          onClick={() => {
            onClose();
            onNew();
          }}
          style={btnPrimary}
        >
          + New plan
        </button>
        <div style={{ marginTop: 12 }}>
          {plans.length === 0 && (
            <div style={{ color: "#6b7785", fontSize: 13, padding: 12 }}>
              No saved plans yet. Click "+ New plan" to create one.
            </div>
          )}
          {plans
            .slice()
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((p) => {
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
                    background: isActive ? "#eef4ff" : "white",
                  }}
                >
                  <div style={{ flex: 1 }}>
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
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
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
            })}
        </div>
      </Modal>

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
const btnSm: React.CSSProperties = {
  padding: "4px 10px",
  fontSize: 12,
  background: "white",
  border: "1px solid #c0cad4",
  borderRadius: 4,
  cursor: "pointer",
};
