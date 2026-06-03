/* ============================================================================
 * Chat Wars — sprite pre-processor
 *
 * Runs ONCE on image load. Splits the sprite into two canvas layers:
 *   neutral  → desaturated pixels (gray/white/black) — these get player-tinted
 *   colored  → saturated pixels (colored details like glow rings) — kept as-is
 *
 * At render time we draw: tinted-neutral → colored overlay → face/effects.
 * ========================================================================== */

export interface ProcessedSprite {
  neutral: HTMLCanvasElement;
  colored: HTMLCanvasElement;
  width: number;
  height: number;
  /** Cache of fully-composited sprites keyed by quantized hue. */
  tintCache: Map<number, HTMLCanvasElement>;
}

/** Pixels with HSV saturation below this are treated as "neutral" (gets tinted). */
const SAT_THRESHOLD = 0.22;

export function processSprite(img: HTMLImageElement): ProcessedSprite {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  // read source pixels
  const src = document.createElement('canvas');
  src.width = w; src.height = h;
  const srcCtx = src.getContext('2d')!;
  srcCtx.drawImage(img, 0, 0);
  const { data } = srcCtx.getImageData(0, 0, w, h);

  // two output layers
  const neutral = document.createElement('canvas');
  neutral.width = w; neutral.height = h;
  const nCtx = neutral.getContext('2d')!;
  const nData = nCtx.createImageData(w, h);

  const colored = document.createElement('canvas');
  colored.width = w; colored.height = h;
  const cCtx = colored.getContext('2d')!;
  const cData = cCtx.createImageData(w, h);

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 4) continue; // fully / nearly transparent — skip both layers

    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    // HSV saturation: how "colorful" vs gray the pixel is
    const sat = max < 0.001 ? 0 : (max - min) / max;

    if (sat < SAT_THRESHOLD) {
      // neutral — goes to tintable layer
      nData.data[i] = data[i];
      nData.data[i + 1] = data[i + 1];
      nData.data[i + 2] = data[i + 2];
      nData.data[i + 3] = a;
    } else {
      // colored detail — stays exactly as uploaded
      cData.data[i] = data[i];
      cData.data[i + 1] = data[i + 1];
      cData.data[i + 2] = data[i + 2];
      cData.data[i + 3] = a;
    }
  }

  nCtx.putImageData(nData, 0, 0);
  cCtx.putImageData(cData, 0, 0);

  return { neutral, colored, width: w, height: h, tintCache: new Map() };
}

/**
 * Returns a canvas with the sprite fully composited for a given player hue:
 * neutral pixels tinted (texture preserved), colored pixels kept as-is, and the
 * tint masked strictly to the sprite's silhouette (no square leak). Cached per
 * quantized hue so it's built at most ~45 times total.
 */
export function getTintedSprite(sprite: ProcessedSprite, hue: number): HTMLCanvasElement {
  const bucket = Math.round(hue / 8) * 8;             // quantize to ~45 buckets
  const cached = sprite.tintCache.get(bucket);
  if (cached) return cached;

  const c = document.createElement('canvas');
  c.width = sprite.width; c.height = sprite.height;
  const x = c.getContext('2d')!;

  // tint the neutral layer (texture kept via 'color' blend)
  x.drawImage(sprite.neutral, 0, 0);
  x.globalCompositeOperation = 'color';
  x.fillStyle = `hsl(${bucket},80%,52%)`;
  x.fillRect(0, 0, sprite.width, sprite.height);
  // mask the tint back to the neutral silhouette (removes leak in transparent areas)
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(sprite.neutral, 0, 0);
  // colored detail on top, untouched
  x.globalCompositeOperation = 'source-over';
  x.drawImage(sprite.colored, 0, 0);

  sprite.tintCache.set(bucket, c);
  return c;
}
