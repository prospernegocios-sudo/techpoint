// Celular: reduz fotos antes de enviar (comprovantes ocupam menos espaço; decisão 2a do TG). PDF passa direto.
import * as ImageManipulator from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import type { PickedFile } from './documents';

export const MAX_SIDE = 1600;

export async function reducePicked(p: PickedFile): Promise<{ body: ArrayBuffer | Blob; mime: string; size: number }> {
  if (p.mime === 'image/jpeg' || p.mime === 'image/png') {
    const out = await ImageManipulator.manipulateAsync(p.uri, [{ resize: { width: MAX_SIDE } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
    const buf = await new File(out.uri).arrayBuffer();
    if (buf.byteLength < (p.size || Infinity)) return { body: buf, mime: 'image/jpeg', size: buf.byteLength };
  }
  const buf = await new File(p.uri).arrayBuffer();
  return { body: buf, mime: p.mime, size: buf.byteLength };
}
