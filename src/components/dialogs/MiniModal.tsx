import { useEffect, useRef, useState } from "react";

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  zIndex: 1100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  borderRadius: 8,
  width: 360,
  maxWidth: "90vw",
  boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
  padding: "20px 20px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 600,
  color: "#1a1f26",
};

const btnRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 4,
};

const btnCancel: React.CSSProperties = {
  padding: "6px 14px",
  background: "white",
  border: "1px solid #c0cad4",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 13,
};

const btnPrimary: React.CSSProperties = {
  padding: "6px 14px",
  background: "#1f6feb",
  color: "white",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const btnDanger: React.CSSProperties = {
  ...btnPrimary,
  background: "#e74c3c",
};

// -----------------------------------------------------------------------
// PromptModal — replaces window.prompt()
// -----------------------------------------------------------------------
interface PromptProps {
  title: string;
  label?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptModal({
  title,
  label,
  defaultValue = "",
  confirmLabel = "OK",
  onConfirm,
  onCancel,
}: PromptProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Small delay so the input is focusable after mount
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 30);
    return () => clearTimeout(t);
  }, []);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
  };

  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={titleStyle}>{title}</h2>
        {label && <div style={{ fontSize: 13, color: "#4a5568" }}>{label}</div>}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") onCancel();
          }}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "7px 10px",
            border: "1px solid #c0cad4",
            borderRadius: 4,
            fontSize: 13,
            outline: "none",
          }}
        />
        <div style={btnRow}>
          <button style={btnCancel} onClick={onCancel}>Cancel</button>
          <button
            style={{ ...btnPrimary, opacity: value.trim() ? 1 : 0.5 }}
            disabled={!value.trim()}
            onClick={commit}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
// ConfirmModal — replaces window.confirm()
// -----------------------------------------------------------------------
interface ConfirmProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Delete",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={titleStyle}>{title}</h2>
        <div style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.5 }}>{message}</div>
        <div style={btnRow}>
          <button style={btnCancel} onClick={onCancel}>Cancel</button>
          <button style={danger ? btnDanger : btnPrimary} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
