import { docMime, kindLabel, validity } from '../documents';

test('aceita só PDF, PNG e JPG (pelo tipo ou pela extensão)', () => {
  expect(docMime('atestado.pdf', null)).toBe('application/pdf');
  expect(docMime('foto.JPG', '')).toBe('image/jpeg');
  expect(docMime('x', 'image/png')).toBe('image/png');
  expect(docMime('planilha.xlsx', 'application/vnd.ms-excel')).toBeNull();
});

test('validade do atestado: vencido, vence em 30 dias ou válido', () => {
  const today = new Date('2026-11-15T12:00:00');
  expect(validity(null, today)).toBeNull();
  expect(validity('2026-11-14', today)).toBe('expired');
  expect(validity('2026-11-15', today)).toBe('soon');
  expect(validity('2026-12-10', today)).toBe('soon');
  expect(validity('2027-06-01', today)).toBe('ok');
});

test('nome do tipo de documento em português', () => {
  expect(kindLabel('atestado')).toBe('Atestado médico');
  expect(kindLabel('qualquer')).toBe('Documento');
});
