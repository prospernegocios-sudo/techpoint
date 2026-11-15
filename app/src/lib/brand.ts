// White label (D83/D104): a marca da entidade (nome, logo e cores) aparece na entrada /<endereço-da-entidade>
// e no login que vem dela, só naquele acesso. Não fica guardada no aparelho: quem abre o site direto vê o
// login neutro do TechPoint, e a marca do time vem depois, pela conta que entrou.
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
let current: Brand | null = null; // só durante este acesso (memória), nunca salvo no aparelho
// Limpa a marca que versões antigas guardavam no aparelho.
AsyncStorage.removeItem(KEY).catch(() => {});

export const saveBrand = (b: Brand | null) => { current = b; };
export async function loadBrand(): Promise<Brand | null> { return current; }
export function useSavedBrand() {
  const [brand, setBrand] = useState<Brand | null>(current);
  useEffect(() => { setBrand(current); }, []);
  return brand;
}
