import { useEffect, useRef, useState } from "react";
import { usePlanStore } from "../state/planStore";
import {
  isFileSystemAccessSupported,
  openPlansFile,
  createPlansFile,
  writePlans,
  getConnectedFileName,
  clearActiveHandle,
  getActiveHandle,
} from "../utils/fileStorage";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function FileStorageBar() {
  const plans = usePlanStore((s) => s.plans);
  const replacePlans = usePlanStore((s) => s.replacePlans);

  const [connectedFile, setConnectedFile] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [showMenu, setShowMenu] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  if (!isFileSystemAccessSupported()) return null;

  // Auto-save whenever plans change (debounced 800ms)
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

  async function handleOpen() {
    setShowMenu(false);
    const result = await openPlansFile();
    if (!result) return;
    replacePlans(result.plans);
    setConnectedFile(result.handle.name);
    setSaveStatus("idle");
    setErrorMsg(null);
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

  function handleDisconnect() {
    clearActiveHandle();
    setConnectedFile(null);
    setSaveStatus("idle");
    setErrorMsg(null);
  }

  const statusColor = saveStatus === "error" ? "#dc2626" : saveStatus === "saving" ? "#d97706" : "#16a34a";
  const statusLabel =
    saveStatus === "saving" ? "Saving…" :
    saveStatus === "saved" ? "Saved ✓" :
    saveStatus === "error" ? "Save failed" :
    "Auto-saving";

  return (
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
          <span style={{ color: statusColor }}>{statusLabel}</span>
          {errorMsg && <span style={{ color: "#dc2626" }}>— {errorMsg}</span>}
          <button
            onClick={handleDisconnect}
            style={{
              marginLeft: 4,
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
                  minWidth: 210,
                  padding: 4,
                }}
              >
                <MenuButton
                  icon="📂"
                  label="Open existing plans file"
                  description="Load plans from a .json file on disk"
                  onClick={handleOpen}
                />
                <MenuButton
                  icon="💾"
                  label="Save plans to new file"
                  description="Export current plans to a .json file"
                  onClick={handleCreate}
                />
              </div>
            </>
          )}
        </div>
      )}

      {!connectedFile && (
        <span style={{ color: "#9aa5b1", fontSize: 11 }}>
          Plans are currently in browser storage only
        </span>
      )}
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
