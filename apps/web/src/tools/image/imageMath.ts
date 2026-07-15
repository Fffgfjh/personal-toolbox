export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function rotatedSize(width: number, height: number, rotation: number) {
  const normalized = ((rotation % 360) + 360) % 360;
  return normalized === 90 || normalized === 270 ? { width: height, height: width } : { width, height };
}

export function clampCrop(crop: CropRect): CropRect {
  const width = Math.min(1, Math.max(0.05, crop.width));
  const height = Math.min(1, Math.max(0.05, crop.height));
  return {
    x: Math.min(1 - width, Math.max(0, crop.x)),
    y: Math.min(1 - height, Math.max(0, crop.y)),
    width,
    height,
  };
}

export function fittedPreviewSize(width: number, height: number, maxWidth = 840, maxHeight = 520) {
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
}
