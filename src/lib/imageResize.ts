'use client';

/**
 * Downscales an image file client-side and returns it as a PNG data URL.
 * Uploads here go straight into a JSON body (base64, no multipart/blob storage),
 * and Vercel hard-caps Serverless Function request bodies at 4.5MB — an
 * unresized phone photo alone can blow past that, so shrink before encoding.
 * PNG (not JPEG) to keep alpha transparency, which the Chat Wars sprites need.
 */
export function fileToResizedDataUrl(file: File, maxDim = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('canvas 2d context unavailable')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('falha ao carregar a imagem'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('falha ao ler o arquivo'));
    reader.readAsDataURL(file);
  });
}
