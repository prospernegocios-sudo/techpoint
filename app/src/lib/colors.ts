// Cores do clube: lê as cores principais do logo, garante leitura (contraste) e monta o tema.
import type { BaseColors } from './theme';

type RGB = [number, number, number];

export const hexToRgb = (hex: string): RGB => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
export const rgbToHex = ([r, g, b]: RGB) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/** Luminância relativa (WCAG). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** Texto que fica legível sobre a cor: branco ou quase preto. */
export const readableOn = (bg: string) => (contrast(bg, '#FFFFFF') >= contrast(bg, '#0E1116') ? '#FFFFFF' : '#0E1116');

/** Mistura a cor com outra (t = 0..1 da segunda). */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

/** Ajusta a cor até ter contraste mínimo com o fundo (escurece ou clareia aos poucos). */
export function ensureContrast(color: string, bg: string, min = 3): string {
  let c = color;
  const toward = luminance(bg) > 0.5 ? '#000000' : '#FFFFFF';
  for (let i = 0; i < 20 && contrast(c, bg) < min; i++) c = mix(c, toward, 0.08);
  return c;
}

/**
 * Cores principais de uma imagem pequena (pixels RGB ou RGBA). Ignora quase branco, quase preto
 * e cinzas (fundo do logo), agrupa tons parecidos e devolve do mais presente para o menos.
 */
export function extractColors(pixels: Uint8Array | Uint8ClampedArray, channels: 3 | 4, max = 6): string[] {
  const buckets = new Map<string, { n: number; r: number; g: number; b: number; w: number }>();
  for (let i = 0; i + channels - 1 < pixels.length; i += channels) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    if (channels === 4 && pixels[i + 3] < 128) continue; // transparente
    const [, s, l] = rgbToHsl([r, g, b]);
    if (l > 0.93 || l < 0.07 || s < 0.15) continue;
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const cur = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0, w: 0 };
    cur.n++; cur.r += r; cur.g += g; cur.b += b;
    cur.w += 0.3 + s * (1 - Math.abs(2 * l - 1)); // cores vivas pesam mais que sombras e brilhos
    buckets.set(key, cur);
  }
  const ranked = [...buckets.values()]
    .map((v) => ({ n: v.w, hex: rgbToHex([v.r / v.n, v.g / v.n, v.b / v.n]) }))
    .sort((a, b) => b.n - a.n);
  const out: string[] = [];
  for (const c of ranked) {
    const [r1, g1, b1] = hexToRgb(c.hex);
    const far = out.every((o) => { const [r2, g2, b2] = hexToRgb(o); return Math.hypot(r1 - r2, g1 - g2, b1 - b2) > 60; });
    if (far) out.push(c.hex);
    if (out.length >= max) break;
  }
  return out;
}

/** Sugestão: principal = a cor mais presente que funciona com texto; destaque = a próxima de tom diferente. */
export function suggestTheme(candidates: string[]): { primary: string; accent: string } | null {
  if (candidates.length === 0) return null;
  const primary = ensureContrast(candidates[0], '#FFFFFF', 3);
  const hue = rgbToHsl(hexToRgb(candidates[0]))[0];
  const other = candidates.slice(1).find((c) => {
    const d = Math.abs(rgbToHsl(hexToRgb(c))[0] - hue);
    return Math.min(d, 360 - d) > 30;
  });
  return { primary, accent: other ?? mix(candidates[0], '#FFFFFF', 0.55) };
}

/** Agrupa as cores do logo por matiz; em cada grupo guarda a mais escura (cabeçalho) e a mais viva (destaque). */
function hueGroups(candidates: string[]) {
  const groups: { hue: number; members: string[] }[] = [];
  for (const c of candidates) {
    const [h, s] = rgbToHsl(hexToRgb(c));
    if (s < 0.15) continue;
    const g = groups.find((x) => Math.min(Math.abs(x.hue - h), 360 - Math.abs(x.hue - h)) < 30);
    if (g) g.members.push(c); else groups.push({ hue: h, members: [c] });
  }
  const vivid = (c: string) => { const [, s, l] = rgbToHsl(hexToRgb(c)); return s * (1 - Math.abs(2 * l - 1)); };
  return groups.map((g) => ({
    dark: [...g.members].sort((a, b) => luminance(a) - luminance(b))[0],
    vivid: [...g.members].sort((a, b) => vivid(b) - vivid(a))[0],
  }));
}

/** Até 3 temas prontos a partir das cores do logo: clássico, invertido e suave. */
export function suggestThemes(candidates: string[]): { name: string; primary: string; accent: string }[] {
  const s = suggestTheme(candidates);
  if (!s) return [];
  const g = hueGroups(candidates);
  if (g.length >= 2) {
    return [
      { name: 'Clássico', primary: ensureContrast(g[1].dark, '#FFFFFF', 4.5), accent: g[0].vivid },
      { name: 'Invertido', primary: ensureContrast(g[0].dark, '#FFFFFF', 4.5), accent: g[1].vivid },
      { name: 'Suave', primary: ensureContrast(mix(g[1].dark, '#FFFFFF', 0.15), '#FFFFFF', 4.5), accent: mix(g[0].vivid, '#FFFFFF', 0.3) },
    ];
  }
  const out = [{ name: 'Clássico', ...s }];
  const inv = { primary: ensureContrast(s.accent, '#FFFFFF', 3), accent: s.primary };
  if (inv.primary !== s.primary) out.push({ name: 'Invertido', ...inv });
  out.push({ name: 'Suave', primary: ensureContrast(mix(s.primary, '#0E1116', 0.25), '#FFFFFF', 4.5), accent: mix(s.accent, '#FFFFFF', 0.35) });
  return out;
}

const status = { success: '#16A34A', warning: '#F59E0B', danger: '#DC2626' };

/** Tema "Cores do clube" (claro e escuro) a partir das duas cores escolhidas. */
export function clubPalette(primary: string, accent: string): { light: BaseColors; dark: BaseColors } {
  const p = ensureContrast(primary, '#FFFFFF', 3);
  const lightBg = mix('#FFFFFF', p, 0.05);
  const darkBg = mix('#0E1116', p, 0.08);
  const pDark = ensureContrast(mix(primary, '#FFFFFF', 0.25), darkBg, 4.5);
  return {
    light: {
      primary: p, onPrimary: readableOn(p), accent, onAccent: readableOn(accent),
      background: lightBg, surface: '#FFFFFF', border: mix('#DDE3EC', p, 0.12), text: '#0E1116', textMuted: '#5B6577', ...status,
    },
    dark: {
      primary: pDark, onPrimary: readableOn(pDark), accent, onAccent: readableOn(accent),
      background: darkBg, surface: mix('#171B22', p, 0.08), border: mix('#2A303B', p, 0.15), text: '#F2F4F8', textMuted: '#A3ACBB', ...status,
    },
  };
}

function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}
/** A mesma cor (matiz) com outra claridade, como os "tons" do Material You. Cinzas continuam cinzas. */
export function tone(hex: string, lightness: number, minSat = 0.45): string {
  const [h, s] = rgbToHsl(hexToRgb(hex));
  return hslToHex(h, s < 0.08 ? s : Math.max(s, minSat), lightness);
}
