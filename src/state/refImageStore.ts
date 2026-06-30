import { create } from "zustand";

export interface RefImage {
  dataUrl: string;
  opacity: number;
  visible: boolean;
  realWidthFt: number;
  // Auto-detected from the uploaded image file
  imageWidth?: number;     // natural pixel width
  imageHeight?: number;    // natural pixel height
  // Architectural scale (read directly off the PDF title block)
  scalePaperIn?: string;   // paper side as typed, e.g. "3/32"
  scaleRealFt?: number;    // real-world side in feet, e.g. 1
  // Physical width of the drawing in inches (e.g. 42" for a 42-inch wide sheet)
  drawingWidthIn?: number;
}

interface RefImageStore {
  refImages: Record<string, RefImage>;
  setRefImage: (planId: string, img: RefImage | null) => void;
  update: (planId: string, patch: Partial<RefImage>) => void;
}

export const useRefImageStore = create<RefImageStore>((set) => ({
  refImages: {},
  setRefImage: (planId, img) =>
    set((s) => {
      const next = { ...s.refImages };
      if (img === null) {
        delete next[planId];
      } else {
        next[planId] = img;
      }
      return { refImages: next };
    }),
  update: (planId, patch) =>
    set((s) => {
      const cur = s.refImages[planId];
      if (!cur) return {};
      return { refImages: { ...s.refImages, [planId]: { ...cur, ...patch } } };
    }),
}));
