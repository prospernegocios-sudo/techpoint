// Site: reduz fotos no navegador (lado maior até 1600 px, JPEG 70%) antes de enviar. PDF passa direto.
import type { PickedFile } from './documents';

export const MAX_SIDE = 1600;

export async function reducePicked(p: PickedFile): Promise<{ body: ArrayBuffer | Blob; mime: string; size: number }> {
  const blob = p.file ?? (await (await fetch(p.uri)).blob());
  if (p.mime !== 'image/jpeg' && p.mime !== 'image/png') return { body: blob, mime: p.mime, size: blob.size };
  try {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * k); canvas.height = Math.round(bmp.height * k);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.7));
    if (out && out.size < blob.size) return { body: out, mime: 'image/jpeg', size: out.size };
  } catch { /* se o navegador não conseguir, envia o original */ }
  return { body: blob, mime: p.mime, size: blob.size };
}
