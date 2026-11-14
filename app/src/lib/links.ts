// Links públicos (convites) e compartilhamento por WhatsApp sem custo (D42).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform, Share } from 'react-native';
import { digits } from './br';

/** Endereço do site; trocar pelo domínio próprio antes do lançamento. */
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || 'https://techpoint.expo.app';
export const inviteUrl = (token: string) => `${SITE_URL}/convite/${token}`;
export const guardianUrl = (token: string) => `${SITE_URL}/responsavel/${token}`;

/** Abre o WhatsApp com a mensagem pronta (para um número, se houver). */
export function openWhatsApp(text: string, phone?: string | null) {
  const p = digits(phone ?? '');
  const url = `https://wa.me/${p ? `55${p}` : ''}?text=${encodeURIComponent(text)}`;
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}

/** Compartilhar (menu do celular) ou copiar no site. */
export async function shareText(text: string): Promise<'shared' | 'copied'> {
  if (Platform.OS === 'web') {
    const nav = globalThis.navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
    if (nav?.share) { await nav.share({ text }); return 'shared'; }
    await nav.clipboard.writeText(text);
    return 'copied';
  }
  await Share.share({ message: text });
  return 'shared';
}

// Depois do login, voltar para o link que a pessoa abriu (convite, responsável).
const NEXT_KEY = 'techpoint.next-link';
export const saveNext = (path: string) => AsyncStorage.setItem(NEXT_KEY, path).catch(() => {});
export async function takeNext(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(NEXT_KEY);
    if (v) await AsyncStorage.removeItem(NEXT_KEY);
    return v;
  } catch {
    return null;
  }
}
