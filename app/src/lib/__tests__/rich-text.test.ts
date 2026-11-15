import { parseInline, richToHtml } from '../rich';
const esc = (s: string) => s.replace(/</g, '&lt;');
test('negrito, itálico e lista', () => {
  expect(parseInline('Sou **atleta** e *levantador*')).toEqual([{ t: 'Sou ' }, { t: 'atleta', b: true }, { t: ' e ' }, { t: 'levantador', i: true }]);
  expect(richToHtml('**Oi** <x>\n• item', esc)).toBe('<p style="margin:0 0 6px"><b>Oi</b> &lt;x></p><div style="padding-left:12px">• item</div>');
});

import { clearFormat, toggleBullets, toggleWrap } from '../rich';
test('negrito liga e desliga; sem seleção não faz nada', () => {
  const v = 'Sou atleta de vôlei';
  const a = toggleWrap(v, { start: 4, end: 10 }, '**')!;
  expect(a.value).toBe('Sou **atleta** de vôlei');
  expect(toggleWrap(a.value, a.sel, '**')!.value).toBe(v);
  expect(toggleWrap(a.value, { start: 4, end: 14 }, '**')!.value).toBe(v);
  expect(toggleWrap(v, { start: 3, end: 3 }, '**')).toBeNull();
  const it = toggleWrap(v, { start: 4, end: 10 }, '*')!;
  expect(it.value).toBe('Sou *atleta* de vôlei');
  expect(toggleWrap(it.value, it.sel, '*')!.value).toBe(v);
});
test('lista liga e desliga sem empilhar marcadores', () => {
  const v = 'linha 1\nlinha 2';
  const on = toggleBullets(v, { start: 0, end: 0 });
  expect(on).toBe('• linha 1\nlinha 2');
  expect(toggleBullets(on, { start: 2, end: 2 })).toBe(v);
  expect(toggleBullets(v, { start: 0, end: v.length })).toBe('• linha 1\n• linha 2');
  expect(toggleBullets('• • • texto', { start: 0, end: 0 })).toBe('texto');
});
test('limpar formatação', () => {
  expect(clearFormat('• **Oi** e *tchau*', { start: 0, end: 0 })).toBe('Oi e tchau');
});
