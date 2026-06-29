import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CatalogPanel } from "./components/CatalogPanel/CatalogPanel";
import { PropertiesPanel } from "./components/PropertiesPanel/PropertiesPanel";
import { CanvasStage } from "./components/Canvas/CanvasStage";
import { Toolbar } from "./components/Canvas/Toolbar";
import { PlanDialog } from "./components/dialogs/PlanDialog";
import { PlansDialog } from "./components/dialogs/PlansDialog";
import { ExportDialog } from "./components/dialogs/ExportDialog";
import { PromptModal } from "./components/dialogs/MiniModal";
import { ComparePlansDialog } from "./components/dialogs/ComparePlansDialog";
import { FileStorageBar } from "./components/FileStorageBar";
import { usePlanStore } from "./state/planStore";
import { useShortcuts } from "./hooks/useShortcuts";

export default function App() {
  useShortcuts();

  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showKitModal, setShowKitModal] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const plans = usePlanStore((s) => s.plans);
  const activePlanId = usePlanStore((s) => s.activePlanId);
  const activePlan = usePlanStore((s) => s.getActivePlan());
  const saveKit = usePlanStore((s) => s.saveKit);
  const selectionIds = usePlanStore((s) => s.selectionIds);

  useEffect(() => {
    if (plans.length === 0) setShowNew(true);
  }, [plans.length]);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useLayoutEffect(() => {
    const update = () => {
      const el = canvasContainerRef.current;
      if (!el) return;
      setSize({ w: el.clientWidth, h: el.clientHeight });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const handleSaveKit = () => {
    if (selectionIds.length === 0) return;
    setShowKitModal(true);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#1a1f26",
      }}
    >
      <Toolbar
        onNewPlan={() => setShowNew(true)}
        onEditPlan={() => setShowEdit(true)}
        onOpenPlans={() => setShowPlans(true)}
        onExport={() => setShowExport(true)}
        onSaveKit={handleSaveKit}
        onComparePlans={() => setShowCompare(true)}
      />
      <FileStorageBar />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <CatalogPanel />
        <div ref={canvasContainerRef} style={{ flex: 1, position: "relative" }}>
          {activePlanId && <CanvasStage width={size.w} height={size.h} />}
          {!activePlanId && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "#6b7785",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 16 }}>No active plan</div>
              <button
                onClick={() => setShowNew(true)}
                style={{
                  padding: "10px 18px",
                  background: "#1f6feb",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                + Create new plan
              </button>
              {plans.length > 0 && (
                <button
                  onClick={() => setShowPlans(true)}
                  style={{
                    padding: "10px 18px",
                    background: "white",
                    border: "1px solid #c0cad4",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Open existing plan
                </button>
              )}
            </div>
          )}
        </div>
        <PropertiesPanel />
      </div>

      {showNew && <PlanDialog mode="new" onClose={() => setShowNew(false)} />}
      {showEdit && activePlan && (
        <PlanDialog
          mode="edit"
          existing={activePlan}
          onClose={() => setShowEdit(false)}
        />
      )}
      {showPlans && (
        <PlansDialog
          onClose={() => setShowPlans(false)}
          onNew={() => setShowNew(true)}
        />
      )}
      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
      {showCompare && <ComparePlansDialog onClose={() => setShowCompare(false)} />}
      {showKitModal && (
        <PromptModal
          title="Save Kit"
          label={`Name for this ${selectionIds.length} item group`}
          defaultValue="New Kit"
          confirmLabel="Save"
          onConfirm={(name) => {
            saveKit(name, selectionIds);
            setShowKitModal(false);
          }}
          onCancel={() => setShowKitModal(false)}
        />
      )}
    </div>
  );
}
