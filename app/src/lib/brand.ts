// White label (D83): a marca da entidade (nome, logo e cores) aparece desde a tela de entrada.
// Guardada no aparelho quando a pessoa abre techpoint.app.br/<endereço-da-entidade>.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type Brand = { id: string; name: string; slug: string; logo_url: string | null; primary: string | null; accent: string | null };
const KEY = 'techpoint.brand';

export async function fetchBrand(slug: string): Promise<Brand | null> {
  const { data, error } = await supabase.rpc('org_brand', { p_slug: slug });
  if (error || !data) return null;
  const d = data as { id: string; name: string; slug: string; logo_path: string | null; primary: string | null; accent: string | null };
  return {
    id: d.id, name: d.name, slug: d.slug, primary: d.primary, accent: d.accent,
    logo_url: d.logo_path ? supabase.storage.from('org-logos').getPublicUrl(d.logo_path).data.publicUrl : null,
  };
}
export const saveBrand = (b: Brand | null) => (b ? AsyncStorage.setItem(KEY, JSON.stringify(b)) : AsyncStorage.removeItem(KEY)).catch(() => {});
export async function loadBrand(): Promise<Brand | null> {
  try { const raw = await AsyncStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Brand) : null; } catch { return null; }
}
export function useSavedBrand() {
  const [brand, setBrand] = useState<Brand | null>(null);
  useEffect(() => { loadBrand().then(setBrand); }, []);
  return brand;
}
