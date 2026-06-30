import { useEffect, useRef, useState } from "react";
import { usePlanStore } from "../state/planStore";
import {
  isFileSystemAccessSupported,
  openPlansFile,
  createPlansFile,
  writePlans,
  clearActiveHandle,
  getActiveHandle,
  setActiveHandle,
} from "../utils/fileStorage";
import type { FloorPlan } from "../types/model";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface PendingOpen {
  handle: FileSystemFileHandle;
  filePlans: FloorPlan[];
}

export function FileStorageBar() {
  const plans = usePlanStore((s) => s.plans);
  const replacePlans = usePlanStore((s) => s.replacePlans);

  const [connectedFile, setConnectedFile] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [showMenu, setShowMenu] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState<PendingOpen | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  // Auto-save ALL plans to the connected file whenever any plan changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const handle = getActiveHandle();
    if (!handle) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setSaveStatus("saving");

    autoSaveTimer.current = setTimeout(async () => {
      try {
        await writePlans(handle, plans);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("error");
        setErrorMsg("Auto-save failed — file may have been moved or deleted.");
      }
    }, 800);
  }, [plans]);

  if (!isFileSystemAccessSupported()) return null;

  async function handleOpen() {
    setShowMenu(false);
    const result = await openPlansFile();
    if (!result) return;
    // Show confirmation dialog instead of replacing immediately
    setPendingOpen({ handle: result.handle, filePlans: result.plans });
  }

  function handleConfirmLoad() {
    if (!pendingOpen) return;
    setActiveHandle(pendingOpen.handle);
    replacePlans(pendingOpen.filePlans);
    setConnectedFile(pendingOpen.handle.name);
    setSaveStatus("idle");
    setErrorMsg(null);
    setPendingOpen(null);
  }

  async function handleConfirmPush() {
    if (!pendingOpen) return;
    try {
      await writePlans(pendingOpen.handle, plans);
      setActiveHandle(pendingOpen.handle);
      setConnectedFile(pendingOpen.handle.name);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
      setErrorMsg(null);
    } catch {
      setSaveStatus("error");
      setErrorMsg("Could not write to file.");
    }
    setPendingOpen(null);
  }

  function handleCancelOpen() {
    setPendingOpen(null);
  }

  async function handleCreate() {
    setShowMenu(false);
    const handle = await createPlansFile(plans);
    if (!handle) return;
    setConnectedFile(handle.name);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
    setErrorMsg(null);
  }

  async function handleSaveNow() {
    const handle = getActiveHandle();
    if (!handle) return;
    setSaveStatus("saving");
    try {
      await writePlans(handle, plans);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setErrorMsg("Save failed — file may have been moved or deleted.");
    }
  }

  function handleDisconnect() {
    clearActiveHandle();
    setConnectedFile(null);
    setSaveStatus("idle");
    setErrorMsg(null);
  }

  const statusColor =
    saveStatus === "error" ? "#dc2626" :
    saveStatus === "saving" ? "#d97706" :
    "#16a34a";

  const statusLabel =
    saveStatus === "saving" ? "Saving…" :
    saveStatus === "saved" ? "Saved ✓" :
    saveStatus === "error" ? "Save failed" :
    "Auto-saving";

  const planCount = plans.length;
  const planWord = planCount === 1 ? "plan" : "plans";

  return (
    <>
      {/* Confirmation modal */}
      {pendingOpen && (
        <ConnectDialog
          fileName={pendingOpen.handle.name}
          filePlanCount={pendingOpen.filePlans.length}
          browserPlanCount={plans.length}
          onLoad={handleConfirmLoad}
          onPush={handleConfirmPush}
          onCancel={handleCancelOpen}
        />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 14px",
          background: connectedFile ? "#f0fdf4" : "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          fontSize: 12,
          color: "#374151",
          minHeight: 30,
        }}
      >
        <span style={{ color: "#6b7785", fontWeight: 500 }}>Disk storage:</span>

        {connectedFile ? (
          <>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: statusColor,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span style={{ color: "#166534", fontWeight: 500 }}>{connectedFile}</span>
            <span style={{ color: "#6b7785" }}>
              — {planCount} {planWord} included
            </span>
            <span style={{ color: statusColor }}>{statusLabel}</span>
            {errorMsg && <span style={{ color: "#dc2626" }}>— {errorMsg}</span>}
            <button
              onClick={handleSaveNow}
              title="Save all plans to file right now"
              style={{
                marginLeft: 4,
                background: "none",
                border: "1px solid #c0cad4",
                borderRadius: 4,
                padding: "1px 8px",
                cursor: "pointer",
                fontSize: 11,
                color: "#1f6feb",
              }}
            >
              Save now
            </button>
            <button
              onClick={handleDisconnect}
              style={{
                background: "none",
                border: "1px solid #c0cad4",
                borderRadius: 4,
                padding: "1px 8px",
                cursor: "pointer",
                fontSize: 11,
                color: "#6b7785",
              }}
            >
              Disconnect
            </button>
          </>
        ) : (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowMenu((v) => !v)}
              style={{
                background: "#1f6feb",
                color: "white",
                border: "none",
                borderRadius: 4,
                padding: "3px 10px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              Connect file ▾
            </button>
            {showMenu && (
              <>
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 99 }}
                  onClick={() => setShowMenu(false)}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    zIndex: 100,
                    background: "white",
                    border: "1px solid #c0cad4",
                    borderRadius: 6,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                    minWidth: 220,
                    padding: 4,
                  }}
                >
                  <MenuButton
                    icon="📂"
                    label="Open existing plans file"
                    description="Choose a .json file — you'll pick what to do next"
                    onClick={handleOpen}
                  />
                  <MenuButton
                    icon="💾"
                    label="Save all plans to new file"
                    description={`Export all ${planCount} ${planWord} to a .json file`}
                    onClick={handleCreate}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {!connectedFile && (
          <span style={{ color: "#9aa5b1", fontSize: 11 }}>
            {planCount} {planWord} in browser storage only
          </span>
        )}
      </div>
    </>
  );
}

function ConnectDialog({
  fileName,
  filePlanCount,
  browserPlanCount,
  onLoad,
  onPush,
  onCancel,
}: {
  fileName: string;
  filePlanCount: number;
  browserPlanCount: number;
  onLoad: () => void;
  onPush: () => void;
  onCancel: () => void;
}) {
  const fileWord = filePlanCount === 1 ? "plan" : "plans";
  const browserWord = browserPlanCount === 1 ? "plan" : "plans";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "white",
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          padding: "28px 32px",
          minWidth: 380,
          maxWidth: 480,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1f26", marginBottom: 4 }}>
          Connect to file
        </div>
        <div style={{ fontSize: 13, color: "#4b5563", marginBottom: 20 }}>
          <span style={{ fontWeight: 500, color: "#1a1f26" }}>{fileName}</span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1px 1fr",
            gap: 0,
            marginBottom: 20,
          }}
        >
          {/* Load from file */}
          <ChoiceCard
            icon="📥"
            title="Load from file"
            description={`Replace your ${browserPlanCount} browser ${browserWord} with the ${filePlanCount} ${fileWord} stored in this file.`}
            warning={`Your current ${browserWord} will be overwritten.`}
            buttonLabel="Load from file"
            buttonColor="#1f6feb"
            onClick={onLoad}
          />

          {/* Divider */}
          <div style={{ background: "#e5e7eb", margin: "0 16px" }} />

          {/* Push to file */}
          <ChoiceCard
            icon="📤"
            title="Push my plans to file"
            description={`Overwrite the file's ${filePlanCount} ${fileWord} with your current ${browserPlanCount} browser ${browserWord}.`}
            warning={`The file's existing content will be replaced.`}
            buttonLabel="Push to file"
            buttonColor="#15803d"
            onClick={onPush}
          />
        </div>

        <div style={{ textAlign: "center" }}>
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              color: "#6b7280",
              cursor: "pointer",
              fontSize: 13,
              padding: "4px 12px",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({
  icon,
  title,
  description,
  warning,
  buttonLabel,
  buttonColor,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  warning: string;
  buttonLabel: string;
  buttonColor: string;
  onClick: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 22, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1f26" }}>{title}</div>
      <div style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.5, flex: 1 }}>{description}</div>
      <div style={{ fontSize: 11, color: "#9a3412", background: "#fff7ed", borderRadius: 4, padding: "4px 8px" }}>
        {warning}
      </div>
      <button
        onClick={onClick}
        style={{
          background: buttonColor,
          color: "white",
          border: "none",
          borderRadius: 6,
          padding: "7px 12px",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 500,
          width: "100%",
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function MenuButton({
  icon,
  label,
  description,
  onClick,
}: {
  icon: string;
  label: string;
  description: string;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        width: "100%",
        textAlign: "left",
        background: hover ? "#f0f4fa" : "none",
        border: "none",
        padding: "8px 10px",
        cursor: "pointer",
        borderRadius: 4,
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1f26" }}>{label}</div>
        <div style={{ fontSize: 11, color: "#6b7785", marginTop: 1 }}>{description}</div>
      </div>
    </button>
  );
}
