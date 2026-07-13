import type { Zone } from "../types/model";
import type { RefImage } from "../state/refImageStore";

export interface WorldBounds {
  x: number; // world inches
  y: number;
  width: number;
  height: number;
}

/** Bounding box of a zone in world inches */
export function zoneBounds(zone: Zone): WorldBounds {
  if (zone.kind === "rect") {
    return { x: zone.x, y: zone.y, width: zone.width, height: zone.height };
  }
  const xs = zone.points.map((p) => p.x);
  const ys = zone.points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}

/**
 * Crop a base64 data URL to a pixel region and return a new JPEG data URL.
 * Optionally upscales the crop to ensure the shorter dimension is at least `minDim` pixels
 * (so small zones don't produce unreadable thumbnails for the vision model).
 */
export function cropImageDataUrl(
  dataUrl: string,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  minDim = 900
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const srcW = Math.max(1, Math.round(sw));
      const srcH = Math.max(1, Math.round(sh));

      // Upscale if the crop is too small for the model to read labels
      const scale = Math.max(1, minDim / Math.min(srcW, srcH));
      const outW = Math.round(srcW * scale);
      const outH = Math.round(srcH * scale);

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas 2D context unavailable"));
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => reject(new Error("Failed to load image for cropping"));
    img.src = dataUrl;
  });
}

export interface ZoneCropResult {
  croppedDataUrl: string;
  /** World bounds of the actual zone (used for placement clipping) */
  zoneBounds: WorldBounds;
  /** World bounds of the padded crop sent to Gemini (used for coordinate mapping) */
  imageBounds: WorldBounds;
}

/**
 * Crop the reference image to the zone bounding box + 15% padding on each side.
 * The padded bounds are returned so callers can correctly map Gemini's bounding-box
 * coordinates (0-1000 relative to the cropped image) back to world inches.
 */
export async function cropRefImageToZone(
  refImage: RefImage,
  zone: Zone
): Promise<ZoneCropResult> {
  const imgW = refImage.imageWidth ?? 1;
  const imgH = refImage.imageHeight ?? 1;
  const worldW = refImage.realWidthFt * 12;
  const worldH = worldW * (imgH / imgW);

  const zb = zoneBounds(zone);

  // 15% padding for context around the zone
  const PAD = 0.15;
  const padX = zb.width * PAD;
  const padY = zb.height * PAD;

  const imageBounds: WorldBounds = {
    x: Math.max(0, zb.x - padX),
    y: Math.max(0, zb.y - padY),
    width: 0,
    height: 0,
  };
  imageBounds.width = Math.min(worldW, zb.x + zb.width + padX) - imageBounds.x;
  imageBounds.height = Math.min(worldH, zb.y + zb.height + padY) - imageBounds.y;

  const sx = (imageBounds.x / worldW) * imgW;
  const sy = (imageBounds.y / worldH) * imgH;
  const sw = (imageBounds.width / worldW) * imgW;
  const sh = (imageBounds.height / worldH) * imgH;

  // Use 2048px minimum so rotated/small labels remain readable after upscaling
  const croppedDataUrl = await cropImageDataUrl(refImage.dataUrl, sx, sy, sw, sh, 2048);
  return { croppedDataUrl, zoneBounds: zb, imageBounds };
}
