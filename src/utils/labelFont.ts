// Label font options. `css` is used for on-screen (Konva/canvas) rendering; `pdf` maps
// to one of jsPDF's built-in font families for the vector PDF export.
export interface FontOption {
  key: string;
  name: string;
  css: string;
  pdf: "helvetica" | "times" | "courier";
}

export const FONT_OPTIONS: FontOption[] = [
  { key: "sans", name: "Sans (Helvetica)", css: "Helvetica, Arial, sans-serif", pdf: "helvetica" },
  { key: "verdana", name: "Verdana", css: "Verdana, Geneva, sans-serif", pdf: "helvetica" },
  { key: "trebuchet", name: "Trebuchet MS", css: "'Trebuchet MS', Tahoma, sans-serif", pdf: "helvetica" },
  { key: "tahoma", name: "Tahoma", css: "Tahoma, Geneva, sans-serif", pdf: "helvetica" },
  { key: "georgia", name: "Serif (Georgia)", css: "Georgia, 'Times New Roman', serif", pdf: "times" },
  { key: "times", name: "Times New Roman", css: "'Times New Roman', Times, serif", pdf: "times" },
  { key: "mono", name: "Monospace (Courier)", css: "'Courier New', Courier, monospace", pdf: "courier" },
  { key: "impact", name: "Impact (condensed)", css: "Impact, 'Arial Narrow', sans-serif", pdf: "helvetica" },
];

export const DEFAULT_LABEL_FONT = "sans";

function find(key: string): FontOption {
  return FONT_OPTIONS.find((f) => f.key === key) ?? FONT_OPTIONS[0];
}

/** CSS font-family stack for on-screen (canvas) rendering. */
export function fontCss(key: string): string {
  return find(key).css;
}

/** jsPDF built-in font family name for the vector PDF export. */
export function fontPdf(key: string): "helvetica" | "times" | "courier" {
  return find(key).pdf;
}
