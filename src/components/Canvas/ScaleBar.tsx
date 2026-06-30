interface Props {
  pixelsPerInch: number;
  zoom: number;
  scaleRatio: number;
}

const NICE_FT = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
const TARGET_PX = 90;

function niceScaleFt(pxPerFoot: number): number {
  for (const ft of NICE_FT) {
    if (ft * pxPerFoot >= TARGET_PX) return ft;
  }
  return NICE_FT[NICE_FT.length - 1];
}

export function ScaleBar({ pixelsPerInch, zoom, scaleRatio }: Props) {
  const pxPerFoot = 12 * pixelsPerInch * zoom;
  const ft = niceScaleFt(pxPerFoot);
  const barPx = Math.round(ft * pxPerFoot);
  const distLabel = ft === 1 ? "1 ft" : `${ft} ft`;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(255,255,255,0.92)",
        border: "1px solid #c0cad4",
        borderRadius: 6,
        padding: "5px 12px",
        fontSize: 11,
        color: "#2d3742",
        zIndex: 10,
        userSelect: "none",
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
      }}
    >
      <div style={{ position: "relative", width: barPx, height: 8 }}>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: 2,
            background: "#2d3742",
            transform: "translateY(-50%)",
          }}
        />
        <div style={{ position: "absolute", left: 0, top: 1, width: 2, height: 6, background: "#2d3742" }} />
        <div style={{ position: "absolute", right: 0, top: 1, width: 2, height: 6, background: "#2d3742" }} />
      </div>
      <span style={{ fontSize: 10, color: "#4b5563", fontWeight: 500, fontFamily: "monospace" }}>
        {distLabel}
      </span>
      <span style={{ fontSize: 9, color: "#9aa5b1", fontFamily: "monospace" }}>
        1:{scaleRatio}
      </span>
    </div>
  );
}
