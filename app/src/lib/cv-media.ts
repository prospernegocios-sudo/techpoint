// Fotos do currículo (perfil e galeria): escolhe, reduz e envia para a área privada do atleta.
import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export async function pickAndUploadCvImage(athleteId: string, kind: 'foto' | 'galeria'): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: kind === 'foto', aspect: [4, 5], quality: 1 });
  if (r.canceled || !r.assets[0]) return null;
  const small = await ImageManipulator.manipulateAsync(r.assets[0].uri, [{ resize: { width: kind === 'foto' ? 800 : 1200 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
  const body = Platform.OS === 'web' ? await (await fetch(small.uri)).blob() : await new File(small.uri).arrayBuffer();
  const path = `${athleteId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from('athlete-cv').upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

export async function removeCvImage(path: string) {
  await supabase.storage.from('athlete-cv').remove([path]);
}
