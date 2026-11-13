// Escolha do logo no site: arquivo do computador, recorte quadrado central em 512 px (PNG,
// mantém transparência) e leitura das cores por uma miniatura 24x24.
import { extractColors } from './colors';
import { supabase } from './supabase';

export type PickedLogo = { previewUri: string; body: ArrayBuffer | Blob; contentType: string; colors: string[] };

const chooseFile = () => new Promise<File | null>((resolve) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp';
  input.onchange = () => resolve(input.files?.[0] ?? null);
  input.click();
});

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

export async function pickLogo(): Promise<PickedLogo | null> {
  const file = await chooseFile();
  if (!file) return null;
  const img = await loadImage(URL.createObjectURL(file));
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  canvas.getContext('2d')!.drawImage(img, sx, sy, side, side, 0, 0, 512, 512);
  const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'));
  const tiny = document.createElement('canvas');
  tiny.width = tiny.height = 24;
  const ctx = tiny.getContext('2d')!;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, 24, 24);
  const data = ctx.getImageData(0, 0, 24, 24).data;
  return { previewUri: URL.createObjectURL(blob), body: blob, contentType: 'image/png', colors: extractColors(data, 4) };
}

export async function uploadLogo(orgId: string, logo: PickedLogo): Promise<string> {
  const path = `${orgId}/logo-${Date.now()}.png`;
  const { error } = await supabase.storage.from('org-logos').upload(path, logo.body, { contentType: logo.contentType, upsert: false });
  if (error) throw error;
  return path;
}
