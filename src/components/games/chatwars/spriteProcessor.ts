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
/** Alpha mínimo pra um pixel contar no recorte: ignora o halo/brilho que
 * desvanece na borda, pra a caixa apertar no CORPO sólido do personagem —
 * assim duas bolas encostam de verdade, não só o brilho. */
const BOUND_ALPHA = 32;

export function processSprite(img: HTMLImageElement): ProcessedSprite {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  // read source pixels
  const src = document.createElement('canvas');
  src.width = w; src.height = h;
  const srcCtx = src.getContext('2d')!;
  srcCtx.drawImage(img, 0, 0);
  const { data } = srcCtx.getImageData(0, 0, w, h);

  // two full-size output layers (recortados pro conteúdo visível no fim)
  const neutralFull = document.createElement('canvas');
  neutralFull.width = w; neutralFull.height = h;
  const nCtx = neutralFull.getContext('2d')!;
  const nData = nCtx.createImageData(w, h);

  const coloredFull = document.createElement('canvas');
  coloredFull.width = w; coloredFull.height = h;
  const cCtx = coloredFull.getContext('2d')!;
  const cData = cCtx.createImageData(w, h);

  // caixa apertada dos pixels visíveis — pra cortar a margem transparente que
  // fazia as bolas "colidirem no vazio" (o círculo de colisão é o sprite todo).
  let minX = w, minY = h, maxX = -1, maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a < 4) continue; // fully / nearly transparent — skip both layers

      // recorte só pela parte sólida (ignora o brilho que desvanece na borda)
      if (a >= BOUND_ALPHA) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }

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
  }

  nCtx.putImageData(nData, 0, 0);
  cCtx.putImageData(cData, 0, 0);

  // sem nada opaco? mantém a imagem inteira (fallback seguro)
  if (maxX < minX || maxY < minY) { minX = 0; minY = 0; maxX = w - 1; maxY = h - 1; }
  const bw = maxX - minX + 1, bh = maxY - minY + 1;

  // recorta as duas camadas pra caixa do conteúdo — agora o personagem preenche
  // a bola e dois sprites encostam de verdade quando as bolas colidem.
  const neutral = document.createElement('canvas');
  neutral.width = bw; neutral.height = bh;
  neutral.getContext('2d')!.drawImage(neutralFull, minX, minY, bw, bh, 0, 0, bw, bh);

  const colored = document.createElement('canvas');
  colored.width = bw; colored.height = bh;
  colored.getContext('2d')!.drawImage(coloredFull, minX, minY, bw, bh, 0, 0, bw, bh);

  return { neutral, colored, width: bw, height: bh, tintCache: new Map() };
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
