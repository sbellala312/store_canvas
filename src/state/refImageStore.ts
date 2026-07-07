import { create } from "zustand";
import { loadRefImages, clearLegacyRefImages } from "../utils/persistence";
import {
  loadAllRefImagesIDB,
  putRefImageIDB,
  deleteRefImageIDB,
} from "../utils/refImageStorage";

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

// Ref images are persisted in IndexedDB (see refImageStorage.ts), not localStorage,
// so their large data URLs no longer exhaust the localStorage quota. The store starts
// empty and is populated asynchronously by initRefImages() below.
export const useRefImageStore = create<RefImageStore>((set) => ({
  refImages: {},
  setRefImage: (planId, img) =>
    set((s) => {
      const next = { ...s.refImages };
      if (img === null) {
        delete next[planId];
        void deleteRefImageIDB(planId);
      } else {
        next[planId] = img;
        void putRefImageIDB(planId, img);
      }
      return { refImages: next };
    }),
  update: (planId, patch) =>
    set((s) => {
      const cur = s.refImages[planId];
      if (!cur) return {};
      const nextImg = { ...cur, ...patch };
      void putRefImageIDB(planId, nextImg);
      return { refImages: { ...s.refImages, [planId]: nextImg } };
    }),
}));

// Load ref images from IndexedDB on startup, migrating any legacy localStorage images
// (which used to blow the quota) into IndexedDB and then clearing the old copy.
async function initRefImages(): Promise<void> {
  const fromIDB = await loadAllRefImagesIDB();
  if (Object.keys(fromIDB).length > 0) {
    useRefImageStore.setState({ refImages: fromIDB });
    return;
  }
  const legacy = loadRefImages() as Record<string, RefImage>;
  if (legacy && Object.keys(legacy).length > 0) {
    await Promise.all(
      Object.entries(legacy).map(([planId, img]) => putRefImageIDB(planId, img))
    );
    useRefImageStore.setState({ refImages: legacy });
    clearLegacyRefImages();
  }
}

void initRefImages();
