import { useState, useEffect } from "react";

interface Props {
  onMinimize?: () => void;
}

const STEPS = [
  "Scanning furniture item labels…",
  "Matching items to the Ashley catalog…",
  "Computing furniture positions…",
  "Finalizing placement on the canvas…",
];

// Line-art furniture icons (stroke-drawn). viewBox tuned per piece.
const ICONS: { w: number; h: number; paths: string[] }[] = [
  // Sofa
  { w: 50, h: 42, paths: [
    "M7 27 V16 a4 4 0 0 1 4-4 h28 a4 4 0 0 1 4 4 v11",
    "M5 27 h40 v5 a2 2 0 0 1-2 2 H7 a2 2 0 0 1-2-2 z",
    "M11 34 v4", "M39 34 v4",
  ]},
  // Floor lamp
  { w: 34, h: 46, paths: [
    "M9 17 h16 l-3 -9 h-10 z",
    "M17 17 V40",
    "M11 40 h12",
  ]},
  // Armchair
  { w: 42, h: 42, paths: [
    "M8 27 V16 a4 4 0 0 1 4-4 h18 a4 4 0 0 1 4 4 v11",
    "M6 27 h30 v5 a2 2 0 0 1-2 2 H8 a2 2 0 0 1-2-2 z",
    "M11 34 v4", "M31 34 v4",
  ]},
  // Potted plant
  { w: 38, h: 46, paths: [
    "M11 31 h16 l-2.5 12 h-11 z",
    "M9 31 h20",
    "M19 31 V15",
    "M19 22 C13 20 11 13 12 8 C17 9 19 15 19 19",
    "M19 24 C25 22 27 15 26 10 C21 11 19 17 19 21",
  ]},
];

export function CadLoadingOverlay({ onMinimize }: Props) {
  const [minimized, setMinimized] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [stepIdx, setStepIdx]     = useState(0);

  useEffect(() => {
    const id = setInterval(() =>
      setProgress((p) => { if (p >= 90) { clearInterval(id); return p; } return Math.min(90, p + Math.random() * 4 + 1); }),
    700);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setStepIdx((i) => (i + 1) % STEPS.length), 3200);
    return () => clearInterval(id);
  }, []);

  const handleContinue = () => { setMinimized(true); onMinimize?.(); };

  return (
    <>
      <style>{`
        @keyframes _cad_draw   { to   { stroke-dashoffset: 0; } }
        @keyframes _cad_pop    { from { opacity:0; transform:translateY(10px) scale(0.92); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes _cad_float  { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-5px); } }
        @keyframes _cad_sweep  { 0% { left:-45%; } 100% { left:100%; } }
        @keyframes _cad_slideup{ from { opacity:0; transform:translate(-50%,-46%) scale(0.94); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
        @keyframes _cad_pill   { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes _cad_spin   { to { transform:rotate(360deg); } }
        @keyframes _cad_glow   { 0%,100% { opacity:0.35; } 50% { opacity:0.85; } }
      `}</style>

      {minimized ? (
        <div style={{
          position:"fixed", top:14, right:14, zIndex:1100,
          background:"white", borderRadius:32,
          padding:"8px 16px 8px 12px",
          boxShadow:"0 6px 22px rgba(60,40,15,0.16)",
          border:"1px solid #ece3d7",
          display:"flex", alignItems:"center", gap:11,
          animation:"_cad_pill 0.25s ease",
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" style={{ animation:"_cad_spin 1.1s linear infinite" }}>
            <circle cx="11" cy="11" r="8.5" fill="none" stroke="#efe6d8" strokeWidth="3"/>
            <circle cx="11" cy="11" r="8.5" fill="none" stroke="#b07d3e" strokeWidth="3"
              strokeLinecap="round" strokeDasharray="20 60"/>
          </svg>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:"#3d2e1e", lineHeight:1.1 }}>Auto-placing furniture</div>
            <div style={{ fontSize:11, color:"#9a8a76", marginTop:2 }}>{STEPS[stepIdx]}</div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ position:"fixed", inset:0, zIndex:1099, background:"rgba(28,18,8,0.28)", backdropFilter:"blur(3px)" }} />

          <div style={{
            position:"fixed", top:"50%", left:"50%",
            transform:"translate(-50%,-50%)",
            zIndex:1100, width:392,
            background:"#FFFFFF",
            borderRadius:22,
            boxShadow:"0 24px 70px rgba(50,30,8,0.28)",
            overflow:"hidden",
            animation:"_cad_slideup 0.3s cubic-bezier(0.34,1.4,0.64,1)",
          }}>
            {/* ── Animated furniture stage ── */}
            <div style={{
              position:"relative",
              background:"linear-gradient(180deg,#FBF6EE 0%,#F6EEE0 100%)",
              padding:"30px 24px 24px",
              overflow:"hidden",
            }}>
              {/* soft radial glow behind furniture */}
              <div style={{
                position:"absolute", top:"38%", left:"50%",
                width:220, height:120, transform:"translate(-50%,-50%)",
                background:"radial-gradient(ellipse,#e9cfa4 0%,rgba(233,207,164,0) 70%)",
                animation:"_cad_glow 3s ease-in-out infinite",
                pointerEvents:"none",
              }} />

              {/* furniture row */}
              <div style={{
                position:"relative",
                display:"flex", alignItems:"flex-end", justifyContent:"center",
                gap:14, height:56,
              }}>
                {ICONS.map((icon, i) => {
                  const delay = 0.15 + i * 0.28;
                  return (
                    <svg
                      key={i}
                      width={icon.w} height={icon.h} viewBox={`0 0 ${icon.w} ${icon.h}`}
                      style={{
                        display:"block",
                        animation:`_cad_pop 0.5s ease ${delay}s both, _cad_float 3.2s ease-in-out ${delay + 0.9}s infinite`,
                      }}
                    >
                      <g fill="none" stroke="#a9743a" strokeWidth="2"
                         strokeLinecap="round" strokeLinejoin="round">
                        {icon.paths.map((d, j) => (
                          <path
                            key={j}
                            d={d}
                            pathLength={1}
                            style={{
                              strokeDasharray: 1,
                              strokeDashoffset: 1,
                              animation:`_cad_draw 0.7s ease ${delay + j * 0.06}s forwards`,
                            }}
                          />
                        ))}
                      </g>
                    </svg>
                  );
                })}
              </div>

              {/* floor line */}
              <div style={{
                position:"relative",
                height:2, marginTop:6,
                background:"linear-gradient(90deg,rgba(169,116,58,0) 0%,#cfa877 25%,#cfa877 75%,rgba(169,116,58,0) 100%)",
                borderRadius:2,
              }} />

              {/* light sweep */}
              <div style={{
                position:"absolute", top:0, bottom:0, width:"45%",
                background:"linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.55) 50%,rgba(255,255,255,0) 100%)",
                animation:"_cad_sweep 2.6s ease-in-out 0.3s infinite",
                pointerEvents:"none",
              }} />
            </div>

            {/* ── Content ── */}
            <div style={{ padding:"20px 26px 22px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <span style={{
                  fontSize:11, fontWeight:700, letterSpacing:"0.1em",
                  color:"#b07d3e", textTransform:"uppercase",
                }}>AI Auto-Placement</span>
              </div>
              <div style={{ fontWeight:700, fontSize:17, color:"#2b1e10", marginBottom:5 }}>
                Designing your layout
              </div>
              <div style={{ fontSize:13, color:"#8a7862", marginBottom:16, minHeight:18 }}>
                {STEPS[stepIdx]}
              </div>

              {/* progress bar with sweep on top of fill */}
              <div style={{ position:"relative", height:6, background:"#f0e8db", borderRadius:5, overflow:"hidden", marginBottom:6 }}>
                <div style={{
                  height:"100%", width:`${progress}%`,
                  background:"linear-gradient(90deg,#a9743a,#d6a869)",
                  borderRadius:5, transition:"width 0.7s cubic-bezier(0.4,0,0.2,1)",
                }} />
                <div style={{
                  position:"absolute", top:0, bottom:0, width:"45%",
                  background:"linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.6) 50%,rgba(255,255,255,0) 100%)",
                  animation:"_cad_sweep 1.4s ease-in-out infinite",
                }} />
              </div>
              <div style={{ fontSize:11, color:"#b6a892", marginBottom:20 }}>
                Placing furniture on the canvas — this may take 10–30 seconds
              </div>

              <button
                onClick={handleContinue}
                style={{
                  width:"100%", padding:"11px 0",
                  borderRadius:10, border:"1.5px solid #dcc3a0",
                  background:"transparent",
                  fontSize:13, fontWeight:600, color:"#7a5327",
                  cursor:"pointer", letterSpacing:"0.02em",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                  transition:"background 0.15s, border-color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#faf3e9"; e.currentTarget.style.borderColor = "#c8a06a"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#dcc3a0"; }}
              >
                <span>Continue working on canvas</span>
                <span style={{ fontSize:15 }}>→</span>
              </button>
              <div style={{ fontSize:11, color:"#c3b6a2", textAlign:"center", marginTop:8 }}>
                Results appear automatically when ready
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
