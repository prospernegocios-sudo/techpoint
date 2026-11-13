// Escolha do logo no celular: galeria com recorte quadrado, versão leve para enviar
// e uma miniatura 24x24 para ler as cores.
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'jpeg-js';
import { base64ToBytes } from './attendance';
import { extractColors } from './colors';
import { supabase } from './supabase';

export type PickedLogo = { previewUri: string; body: ArrayBuffer | Blob; contentType: string; colors: string[] };

export async function pickLogo(): Promise<PickedLogo | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (r.canceled || !r.assets[0]) return null;
  const uri = r.assets[0].uri;
  const big = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 512 } }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  const tiny = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 24, height: 24 } }], { compress: 1, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  const raw = decode(base64ToBytes(tiny.base64!), { useTArray: true, formatAsRGBA: true });
  return { previewUri: big.uri, body: base64ToBytes(big.base64!).buffer, contentType: 'image/jpeg', colors: extractColors(raw.data, 4) };
}

export async function uploadLogo(orgId: string, logo: PickedLogo): Promise<string> {
  const path = `${orgId}/logo-${Date.now()}.${logo.contentType === 'image/png' ? 'png' : 'jpg'}`;
  const { error } = await supabase.storage.from('org-logos').upload(path, logo.body, { contentType: logo.contentType, upsert: false });
  if (error) throw error;
  return path;
}
