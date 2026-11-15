// Tema do app: "Cores do clube" (lidas do logo da entidade), "Quadra" e "Areia & Mar",
// cada uma com modo claro e escuro. A escolha do usuário fica salva no aparelho.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { clubPalette, ensureContrast, mix, tone } from './colors';

export type PaletteId = 'clube' | 'quadra' | 'areia';
type FixedPalette = Exclude<PaletteId, 'clube'>;
export type ModePref = 'system' | 'light' | 'dark';

export type BaseColors = {
  primary: string;
  onPrimary: string;
  accent: string;      // botão principal (check-in)
  onAccent: string;
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  success: string;
  warning: string;
  danger: string;
};

/** Tons do Material You (MD3), calculados a partir das cores base: valem para qualquer entidade (white label). */
export type Tones = {
  primaryContainer: string; onPrimaryContainer: string;
  accentContainer: string; onAccentContainer: string;
  tertiary: string; tertiaryContainer: string; onTertiaryContainer: string;
  successContainer: string; onSuccessContainer: string;
  warningContainer: string; onWarningContainer: string;
  dangerContainer: string; onDangerContainer: string;
  surfaceContainer: string; surfaceContainerHigh: string;
  outline: string; hero: string; onHero: string; onHeroMuted: string;
};
export type Colors = BaseColors & Tones;

const TEAL = '#0E7C86';
/** Container claro (fundo suave) e o texto legível sobre ele, para uma cor qualquer. */
function container(c: string, isDark: boolean, bg: string) {
  if (isDark) {
    const box = mix(bg, tone(c, 0.3), 0.75);
    return [box, ensureContrast(tone(c, 0.86), box, 4.5)] as const;
  }
  const box = tone(c, 0.92);
  return [box, ensureContrast(tone(c, 0.2), box, 4.5)] as const;
}
export function withTones(b: BaseColors, isDark: boolean): Colors {
  const [primaryContainer, onPrimaryContainer] = container(b.primary, isDark, b.background);
  const [accentContainer, onAccentContainer] = container(b.accent, isDark, b.background);
  const [tertiaryContainer, onTertiaryContainer] = container(TEAL, isDark, b.background);
  const [successContainer, onSuccessContainer] = container(b.success, isDark, b.background);
  const [warningContainer, onWarningContainer] = container(b.warning, isDark, b.background);
  const [dangerContainer, onDangerContainer] = container(b.danger, isDark, b.background);
  // Cartão de destaque (treino de agora): a cor da entidade bem escura, com texto branco.
  const hero = isDark ? mix(b.background, b.primary, 0.45) : ensureContrast(mix(b.primary, '#0E1116', 0.25), '#FFFFFF', 9);
  return {
    ...b,
    primaryContainer, onPrimaryContainer, accentContainer, onAccentContainer,
    tertiary: isDark ? '#4FD8E2' : TEAL, tertiaryContainer, onTertiaryContainer,
    successContainer, onSuccessContainer, warningContainer, onWarningContainer, dangerContainer, onDangerContainer,
    surfaceContainer: isDark ? mix(b.surface, '#FFFFFF', 0.04) : mix('#FFFFFF', b.primary, 0.06),
    surfaceContainerHigh: isDark ? mix(b.surface, '#FFFFFF', 0.08) : mix('#FFFFFF', b.primary, 0.1),
    outline: isDark ? '#8E95A3' : '#787680',
    hero, onHero: '#FFFFFF', onHeroMuted: mix('#FFFFFF', b.primary, 0.25),
  };
}

const status = { success: '#16A34A', warning: '#F59E0B', danger: '#DC2626' };

export const palettes: Record<FixedPalette, { name: string; light: BaseColors; dark: BaseColors }> = {
  quadra: {
    name: 'Quadra',
    light: {
      primary: '#0B3D91', onPrimary: '#FFFFFF', accent: '#C6F432', onAccent: '#0E1116',
      background: '#F5F7FA', surface: '#FFFFFF', border: '#DDE3EC', text: '#0E1116', textMuted: '#5B6577',
      ...status,
    },
    dark: {
      primary: '#5B8DEF', onPrimary: '#0E1116', accent: '#C6F432', onAccent: '#0E1116',
      background: '#0E1116', surface: '#171B22', border: '#2A303B', text: '#F2F4F8', textMuted: '#A3ACBB',
      ...status,
    },
  },
  areia: {
    name: 'Areia & Mar',
    light: {
      primary: '#0E7C86', onPrimary: '#FFFFFF', accent: '#FF7A3D', onAccent: '#FFFFFF',
      background: '#F4EBDD', surface: '#FFFDF8', border: '#E3D6C1', text: '#1B2426', textMuted: '#5E6A6C',
      ...status,
    },
    dark: {
      primary: '#3FB8C2', onPrimary: '#0F1A1C', accent: '#FF7A3D', onAccent: '#0F1A1C',
      background: '#0F1A1C', surface: '#182628', border: '#2B3B3E', text: '#F3EEE5', textMuted: '#A9B5B6',
      ...status,
    },
  },
};

type ThemeCtx = {
  colors: Colors;
  isDark: boolean;
  palette: PaletteId;
  mode: ModePref;
  setPalette: (p: PaletteId) => void;
  setMode: (m: ModePref) => void;
  /** Cores do clube atual (vêm do cadastro da entidade); null = clube sem cores. */
  clubColors: { primary: string; accent: string } | null;
  setClubColors: (c: { primary: string; accent: string } | null) => void;
};

const Ctx = createContext<ThemeCtx | null>(null);
const KEY = 'techpoint.theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [palette, setPalette] = useState<PaletteId>('clube');
  const [clubColors, setClubColors] = useState<{ primary: string; accent: string } | null>(null);
  const [mode, setMode] = useState<ModePref>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (saved.palette === 'clube' || saved.palette in palettes) setPalette(saved.palette);
        if (['system', 'light', 'dark'].includes(saved.mode)) setMode(saved.mode);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(KEY, JSON.stringify({ palette, mode })).catch(() => {});
  }, [palette, mode]);

  const value = useMemo(() => {
    const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
    const club = palette === 'clube' && clubColors ? clubPalette(clubColors.primary, clubColors.accent) : null;
    const base = club ?? palettes[palette === 'clube' ? 'quadra' : palette];
    return { colors: withTones(base[isDark ? 'dark' : 'light'], isDark), isDark, palette, mode, setPalette, setMode, clubColors, setClubColors };
  }, [palette, mode, system, clubColors]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme fora do ThemeProvider');
  return ctx;
}
