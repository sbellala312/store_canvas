import { useMemo } from "react";

export const RULER_SIZE = 24;

const BG = "#f0f4f8";
const BORDER = "#c0cad4";
const TICK_MAJOR = "#4b5563";
const TICK_MINOR = "#9aa5b1";
const LABEL_COLOR = "#6b7785";

interface Props {
  width: number;
  height: number;
  pan: { x: number; y: number };
  zoom: number;
  pixelsPerInch: number;
}

function computeInterval(pxPerFoot: number): { majorIn: number; minorIn: number } {
  if (pxPerFoot >= 60) return { majorIn: 12, minorIn: 6 };
  if (pxPerFoot >= 24) return { majorIn: 24, minorIn: 12 };
  if (pxPerFoot >= 12) return { majorIn: 60, minorIn: 12 };
  if (pxPerFoot >= 5)  return { majorIn: 120, minorIn: 60 };
  if (pxPerFoot >= 2)  return { majorIn: 240, minorIn: 120 };
  return { majorIn: 600, minorIn: 300 };
}

function fmtLabel(inches: number): string {
  const ft = inches / 12;
  if (Number.isInteger(ft)) return `${ft}'`;
  const wholeFt = Math.floor(Math.abs(ft)) * Math.sign(ft);
  const remIn = Math.abs(inches) - Math.abs(wholeFt) * 12;
  return wholeFt !== 0 ? `${wholeFt}'${remIn}"` : `${inches}"`;
}

export function CanvasRuler({ width, height, pan, zoom, pixelsPerInch }: Props) {
  const ppi = pixelsPerInch * zoom;
  const pxPerFoot = 12 * ppi;
  const { majorIn, minorIn } = computeInterval(pxPerFoot);

  const hTicks = useMemo(() => {
    const wStart = -pan.x / ppi;
    const wEnd = (width - pan.x) / ppi;
    const start = Math.floor(wStart / minorIn) * minorIn;
    const end = Math.ceil(wEnd / minorIn) * minorIn;
    const out: { sx: number; label: string | null; isMajor: boolean }[] = [];
    for (let c = start; c <= end; c += minorIn) {
      const sx = c * ppi + pan.x;
      if (sx < RULER_SIZE - 2 || sx > width + 2) continue;
      out.push({ sx, label: c % majorIn === 0 ? fmtLabel(c) : null, isMajor: c % majorIn === 0 });
    }
    return out;
  }, [pan.x, width, ppi, minorIn, majorIn]);

  const vTicks = useMemo(() => {
    const wStart = -pan.y / ppi;
    const wEnd = (height - pan.y) / ppi;
    const start = Math.floor(wStart / minorIn) * minorIn;
    const end = Math.ceil(wEnd / minorIn) * minorIn;
    const out: { sy: number; label: string | null; isMajor: boolean }[] = [];
    for (let c = start; c <= end; c += minorIn) {
      const sy = c * ppi + pan.y;
      if (sy < RULER_SIZE - 2 || sy > height + 2) continue;
      out.push({ sy, label: c % majorIn === 0 ? fmtLabel(c) : null, isMajor: c % majorIn === 0 });
    }
    return out;
  }, [pan.y, height, ppi, minorIn, majorIn]);

  const hW = width - RULER_SIZE;
  const vH = height - RULER_SIZE;

  return (
    <>
      {/* Horizontal ruler */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: RULER_SIZE,
          width: hW,
          height: RULER_SIZE,
          pointerEvents: "none",
          zIndex: 10,
          overflow: "hidden",
          display: "block",
        }}
      >
        <rect x={0} y={0} width={hW} height={RULER_SIZE} fill={BG} />
        <line x1={0} y1={RULER_SIZE - 1} x2={hW} y2={RULER_SIZE - 1} stroke={BORDER} strokeWidth={1} />
        {hTicks.map(({ sx, label, isMajor }, i) => {
          const lx = sx - RULER_SIZE;
          const tLen = isMajor ? RULER_SIZE * 0.55 : RULER_SIZE * 0.28;
          return (
            <g key={i}>
              <line
                x1={lx} y1={RULER_SIZE - 1}
                x2={lx} y2={RULER_SIZE - 1 - tLen}
                stroke={isMajor ? TICK_MAJOR : TICK_MINOR}
                strokeWidth={isMajor ? 1 : 0.5}
              />
              {label && (
                <text x={lx + 2} y={9} fontSize={8} fill={LABEL_COLOR} fontFamily="monospace">
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Vertical ruler */}
      <svg
        style={{
          position: "absolute",
          top: RULER_SIZE,
          left: 0,
          width: RULER_SIZE,
          height: vH,
          pointerEvents: "none",
          zIndex: 10,
          overflow: "hidden",
          display: "block",
        }}
      >
        <rect x={0} y={0} width={RULER_SIZE} height={vH} fill={BG} />
        <line x1={RULER_SIZE - 1} y1={0} x2={RULER_SIZE - 1} y2={vH} stroke={BORDER} strokeWidth={1} />
        {vTicks.map(({ sy, label, isMajor }, i) => {
          const ly = sy - RULER_SIZE;
          const tLen = isMajor ? RULER_SIZE * 0.55 : RULER_SIZE * 0.28;
          const tx = RULER_SIZE - 1 - tLen - 2;
          return (
            <g key={i}>
              <line
                x1={RULER_SIZE - 1} y1={ly}
                x2={RULER_SIZE - 1 - tLen} y2={ly}
                stroke={isMajor ? TICK_MAJOR : TICK_MINOR}
                strokeWidth={isMajor ? 1 : 0.5}
              />
              {label && (
                <text
                  x={tx}
                  y={ly + 2}
                  fontSize={8}
                  fill={LABEL_COLOR}
                  fontFamily="monospace"
                  textAnchor="middle"
                  transform={`rotate(-90, ${tx}, ${ly + 2})`}
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Corner square */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: RULER_SIZE,
          height: RULER_SIZE,
          background: "#dde6ef",
          borderRight: `1px solid ${BORDER}`,
          borderBottom: `1px solid ${BORDER}`,
          pointerEvents: "none",
          zIndex: 11,
        }}
      />
    </>
  );
}
