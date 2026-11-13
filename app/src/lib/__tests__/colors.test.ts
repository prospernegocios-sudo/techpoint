import { clubPalette, contrast, extractColors, readableOn, suggestTheme } from '../colors';

const img = (colors: [number, number, number, number][]) => {
  const arr: number[] = [];
  for (const [r, g, b, n] of colors) for (let i = 0; i < n; i++) arr.push(r, g, b);
  return new Uint8Array(arr);
};

describe('cores do clube', () => {
  it('ignora o fundo branco e pega as cores do logo, da mais presente para a menos', () => {
    const px = img([[255, 255, 255, 500], [200, 16, 46, 300], [0, 51, 160, 120], [10, 10, 10, 50]]);
    const c = extractColors(px, 3);
    expect(c[0]).toBe('#C8102E');
    expect(c[1]).toBe('#0033A0');
    expect(c).toHaveLength(2);
  });
  it('sugere principal legível e destaque de outro tom', () => {
    const s = suggestTheme(['#C8102E', '#D01030', '#0033A0'])!;
    expect(s.primary).toBe('#C8102E');
    expect(s.accent).toBe('#0033A0');
  });
  it('escurece uma cor clara demais para servir de cor principal', () => {
    const s = suggestTheme(['#FFE600'])!;
    expect(contrast(s.primary, '#FFFFFF')).toBeGreaterThanOrEqual(3);
  });
  it('texto sobre a cor fica claro ou escuro conforme o contraste', () => {
    expect(readableOn('#0B3D91')).toBe('#FFFFFF');
    expect(readableOn('#C6F432')).toBe('#0E1116');
  });
  it('monta tema claro e escuro legíveis', () => {
    const t = clubPalette('#C8102E', '#FFD100');
    expect(contrast(t.light.primary, t.light.onPrimary)).toBeGreaterThanOrEqual(3);
    expect(contrast(t.dark.primary, t.dark.background)).toBeGreaterThanOrEqual(4.5);
    expect(t.light.onAccent).toBe('#0E1116');
  });
});
