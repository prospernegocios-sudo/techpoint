import { parseInline, richToHtml } from '../rich';
const esc = (s: string) => s.replace(/</g, '&lt;');
test('negrito, itálico e lista', () => {
  expect(parseInline('Sou **atleta** e *levantador*')).toEqual([{ t: 'Sou ' }, { t: 'atleta', b: true }, { t: ' e ' }, { t: 'levantador', i: true }]);
  expect(richToHtml('**Oi** <x>\n• item', esc)).toBe('<p style="margin:0 0 6px"><b>Oi</b> &lt;x></p><div style="padding-left:12px">• item</div>');
});
