import { describe, expect, it } from 'vitest';
import { clampCrop, fittedPreviewSize, rotatedSize } from './imageMath';

describe('interactive image geometry', () => {
  it('swaps dimensions for quarter rotations', () => {
    expect(rotatedSize(1200, 800, 90)).toEqual({ width: 800, height: 1200 });
    expect(rotatedSize(1200, 800, 180)).toEqual({ width: 1200, height: 800 });
  });

  it('keeps crop rectangles inside the image', () => {
    expect(clampCrop({ x: 0.9, y: -1, width: 0.4, height: 0.01 })).toEqual({ x: 0.6, y: 0, width: 0.4, height: 0.05 });
  });

  it('fits large previews without enlarging small images', () => {
    expect(fittedPreviewSize(1680, 1040)).toMatchObject({ width: 840, height: 520, scale: 0.5 });
    expect(fittedPreviewSize(100, 80)).toMatchObject({ width: 100, height: 80, scale: 1 });
  });
});
