export interface CadDetection {
  rawLabel: string;
  skus: string[];
  /**
   * Bounding box in Gemini's 0-1000 normalized space (y1=top, x1=left, y2=bottom, x2=right).
   * Center: nx = (x1+x2)/2000, ny = (y1+y2)/2000.
   */
  box: { y1: number; x1: number; y2: number; x2: number };
  rotationDeg: number;
  confidence: number;
}

export interface CadUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;   // includes thinking tokens
  thinkingTokens: number;
  estCostUsd: number;
}

export interface CadExtraction {
  detections: CadDetection[];
  usage: CadUsage | null;
}

const SYSTEM_INSTRUCTION = `You are a meticulous expert at reading Ashley Furniture retail store floor-plan CAD drawings.
Ashley furniture item IDs follow patterns like: D824-50B, B376-31, T257-3, W100-08, A3000-17, A4000598.
You have deep experience recognizing these codes even when they are small, rotated to any angle, or partially obscured.
You NEVER skip an item just because its label is at a difficult angle — you mentally rotate to read every label.`;

const PROMPT = `Carefully scan this entire CAD floor-plan image and identify EVERY furniture item.

KEY FACTS about how labels appear on these drawings:
1. Labels are often ROTATED to match the furniture orientation — a sofa at 45° will have its label at 45°.
   Mentally rotate to read them. Do NOT skip items just because the text is tilted.
2. Labels may appear INSIDE the furniture outline, ALONG its edge, or BESIDE it.
3. Labels can be very SMALL — zoom in mentally to read tiny text.
4. Furniture pieces can OVERLAP each other — each still has its own label.

OUTPUT FORMAT — to keep the response compact, return each item as a COMPACT ARRAY
(a tuple), NOT an object. Return ONLY this JSON (no markdown, no explanation, no extra whitespace):
{"items":[[rawLabel, skus, [x1,y1,x2,y2], rotationDeg]]}

Where each tuple is [rawLabel, skus, box, rotationDeg]:
- rawLabel (string): exactly as written on the drawing (verbatim, preserving spacing)
- skus (array of strings): the full expanded Ashley SKU list
  * Single label "D824-50B" → ["D824-50B"]
  * Stacked "D824-50B  50T" → ["D824-50B","D824-50T"]  (prefix "D824-" + suffixes "50B","50T")
  * Stacked "B376-31  36" → ["B376-31","B376-36"]
- box [x1,y1,x2,y2] (4 integers): axis-aligned bounding box of the furniture FOOTPRINT in 0-1000 coords
  * x1=left, y1=top, x2=right, y2=bottom
  * Cover the full floor area the piece occupies, not just the label text
- rotationDeg (integer): clockwise angle of the piece's longer axis (0=horizontal, 90=vertical, 45=diagonal)

Example (two items):
{"items":[["D824-50B  50T",["D824-50B","D824-50T"],[340,120,480,210],0],["B376-31 36",["B376-31","B376-36"],[500,400,640,470],90]]}

CRITICAL — every detection must be GROUNDED in the actual drawing:
- Only report a piece if you can point to BOTH (a) a real drawn rectangle/outline AND (b) a
  readable item-ID label on or beside it. If you cannot read the label text, DO NOT guess it.
- The bounding box MUST tightly enclose that specific drawn outline — NOT an empty area of the page.
- NEVER invent a regular grid of evenly-spaced boxes. Real floor plans are irregular. If your
  boxes form a neat grid, you are hallucinating — stop and re-read the actual outlines.
- NEVER copy one label (e.g. "B814-35") onto many pieces. Each outline has its OWN distinct ID.
  Read each label individually; different pieces almost always have different IDs.
- If a region has no readable label, SKIP it rather than filling it with a guess.
- Prefer returning FEWER, well-grounded items over many uncertain ones. A typical zone has 10–40 pieces.

Checklist before returning:
- Does EACH box sit directly on a real drawn outline (not blank space)?
- Did you read each label individually, rather than repeating one ID across many boxes?
- Do the boxes look irregular (matching the real layout), NOT a uniform grid?
- Did you skip every outline whose label you could not actually read?
- Is every item a COMPACT ARRAY of exactly 4 elements (not an object)?
Do NOT include: room/zone names, wall labels, door/window symbols, dimension lines, scale bars, or north arrows.`;

// Approximate USD price per 1M tokens (input, output). Output includes "thinking"
// tokens. Verify against https://ai.google.dev/gemini-api/docs/pricing — these are
// estimates for the on-screen cost readout only, not billing.
const PRICE_PER_M: Record<string, { in: number; out: number }> = {
  "gemini-2.5-pro":         { in: 1.25, out: 10.0 },
  "gemini-2.5-flash":       { in: 0.30, out: 2.50 },
  "gemini-3.1-pro-preview": { in: 2.00, out: 12.0 },
};

/** Compute real token usage + estimated cost for one vision call, and log it. */
function computeUsage(model: string, usage: unknown): CadUsage | null {
  if (!usage || typeof usage !== "object") return null;
  const u = usage as Record<string, number>;
  const inTok = u.promptTokenCount ?? 0;
  const thoughtTok = u.thoughtsTokenCount ?? 0;
  const outTok = (u.candidatesTokenCount ?? 0) + thoughtTok;
  const price = PRICE_PER_M[model] ?? PRICE_PER_M["gemini-2.5-pro"];
  const cost = (inTok / 1e6) * price.in + (outTok / 1e6) * price.out;
  console.info(
    `[cadVision] ${model} usage — input: ${inTok} tok, output: ${outTok} tok ` +
    `(incl. ${thoughtTok} thinking) → est. $${cost.toFixed(4)} this call`
  );
  return { model, inputTokens: inTok, outputTokens: outTok, thinkingTokens: thoughtTok, estCostUsd: cost };
}

function getConfig(): { apiKey: string; model: string } {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string;
  const model = (import.meta.env.VITE_GEMINI_MODEL as string) || "gemini-2.5-flash";
  if (!apiKey || apiKey.includes("your-") || apiKey === "undefined") {
    throw new Error(
      "Gemini API is not configured. Add VITE_GEMINI_API_KEY to your .env file and restart the dev server."
    );
  }
  return { apiKey, model };
}

function dataUrlToBase64(dataUrl: string): { mimeType: string; data: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Reference image is not a valid base64 data URL.");
  return { mimeType: match[1], data: match[2] };
}

const clamp1000 = (v: unknown) =>
  typeof v === "number" ? Math.max(0, Math.min(1000, Math.round(v))) : 0;

/** Parse a box from either the compact [x1,y1,x2,y2] array or the legacy object form. */
function parseBox(raw: unknown): { y1: number; x1: number; y2: number; x2: number } {
  if (Array.isArray(raw) && raw.length >= 4) {
    // Compact form: [x1, y1, x2, y2]
    return { x1: clamp1000(raw[0]), y1: clamp1000(raw[1]), x2: clamp1000(raw[2]), y2: clamp1000(raw[3]) };
  }
  if (raw && typeof raw === "object") {
    const b = raw as Record<string, unknown>;
    return { y1: clamp1000(b.y1), x1: clamp1000(b.x1), y2: clamp1000(b.y2), x2: clamp1000(b.x2) };
  }
  return { y1: 0, x1: 0, y2: 1000, x2: 1000 };
}

/**
 * Normalize one raw item — accepts the compact tuple form
 * [rawLabel, skus, [x1,y1,x2,y2], rotationDeg] or the legacy object form.
 */
function parseItem(raw: unknown): CadDetection | null {
  if (Array.isArray(raw)) {
    // Compact tuple: [rawLabel, skus, box, rotationDeg]
    const [rawLabel, skus, box, rot] = raw;
    return {
      rawLabel: String(rawLabel ?? ""),
      skus: Array.isArray(skus) ? skus.map(String) : [],
      box: parseBox(box),
      rotationDeg: typeof rot === "number" ? ((rot % 360) + 360) % 360 : 0,
      confidence: 0.9,
    };
  }
  if (raw && typeof raw === "object") {
    const item = raw as Record<string, unknown>;
    return {
      rawLabel: String(item.rawLabel ?? ""),
      skus: Array.isArray(item.skus) ? item.skus.map(String) : [],
      box: parseBox(item.box),
      rotationDeg: typeof item.rotationDeg === "number" ? ((item.rotationDeg % 360) + 360) % 360 : 0,
      confidence: typeof item.confidence === "number" ? Math.max(0, Math.min(1, item.confidence)) : 0.9,
    };
  }
  return null;
}

/** Send a data URL image to Gemini and extract CAD furniture detections + usage. */
export async function extractCadItems(dataUrl: string): Promise<CadExtraction> {
  const { apiKey, model } = getConfig();
  if (!dataUrl) throw new Error("No image data URL provided.");

  const { mimeType, data } = dataUrlToBase64(dataUrl);

  const url = `/gemini/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        parts: [
          { inlineData: { mimeType, data } },
          { text: PROMPT },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0,
      maxOutputTokens: 65536,
      thinkingConfig: { thinkingBudget: 2048 },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const usage = computeUsage(model, json.usageMetadata);
  const candidate = json.candidates?.[0];
  const finishReason: string = candidate?.finishReason ?? "UNKNOWN";
  const content: string = candidate?.content?.parts?.[0]?.text ?? "{}";

  let parsed: { items?: unknown[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    // If the response was cut off (MAX_TOKENS), salvage the complete tuples we did get.
    if (finishReason === "MAX_TOKENS") {
      const salvaged = guardRepetition(salvageItems(content));
      if (salvaged.length > 0) {
        console.warn(`[cadVision] Response truncated — salvaged ${salvaged.length} items from partial JSON`);
        return { detections: salvaged, usage };
      }
      throw new Error(
        "Gemini hit the output token limit and the response was cut off. " +
        "Try scanning a specific zone instead of the entire store."
      );
    }
    throw new Error(`Gemini returned invalid JSON (finishReason: ${finishReason}): ${content.slice(0, 300)}`);
  }

  if (!Array.isArray(parsed.items)) return { detections: [], usage };

  const detections = parsed.items
    .map(parseItem)
    .filter((d): d is CadDetection => d !== null && d.skus.length > 0);

  return { detections: guardRepetition(detections), usage };
}

/**
 * Backstop against Gemini repetition-loop hallucinations (e.g. emitting the same
 * item ID hundreds of times). Caps how many detections any single SKU set may
 * contribute. A real zone almost never contains more than ~30 identical pieces,
 * so anything beyond the cap is discarded as degenerate output.
 */
const MAX_PER_SKU = 30;
function guardRepetition(detections: CadDetection[]): CadDetection[] {
  const counts = new Map<string, number>();
  const kept: CadDetection[] = [];
  let dropped = 0;

  for (const d of detections) {
    const key = [...d.skus].sort().join("|");
    const n = counts.get(key) ?? 0;
    if (n >= MAX_PER_SKU) {
      dropped++;
      continue;
    }
    counts.set(key, n + 1);
    kept.push(d);
  }

  if (dropped > 0) {
    console.warn(`[cadVision] Repetition guard dropped ${dropped} likely-hallucinated detections`);
  }
  return kept;
}

/**
 * Recover as many complete item tuples as possible from a truncated JSON string.
 * Walks the `items` array bracket-by-bracket and JSON.parses each balanced tuple,
 * ignoring the final incomplete one. Ensures a huge scan still returns useful data
 * rather than failing outright.
 */
function salvageItems(content: string): CadDetection[] {
  const start = content.indexOf("[", content.indexOf('"items"'));
  if (start === -1) return [];

  const results: CadDetection[] = [];
  let depth = 0;
  let tupleStart = -1;
  let inStr = false;
  let esc = false;

  // Scan from just inside the outer items array
  for (let i = start + 1; i < content.length; i++) {
    const ch = content[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;

    if (ch === "[") {
      if (depth === 0) tupleStart = i;
      depth++;
    } else if (ch === "]") {
      depth--;
      if (depth === 0 && tupleStart !== -1) {
        const chunk = content.slice(tupleStart, i + 1);
        try {
          const det = parseItem(JSON.parse(chunk));
          if (det && det.skus.length > 0) results.push(det);
        } catch {
          // incomplete/garbled tuple — skip
        }
        tupleStart = -1;
      } else if (depth < 0) {
        break; // closed the outer items array
      }
    }
  }

  return results;
}
