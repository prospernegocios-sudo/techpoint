import { HABIL_ITEMS, itemStatus, summarize, yearsBetween, type HabilDoc } from '../habilitation';

jest.mock('../supabase', () => ({ supabase: {} }));

const item = (code: string) => HABIL_ITEMS.find((i) => i.code === code)!;
const today = new Date('2026-11-16T12:00:00');
let n = 0;
const doc = (code: string, p: Partial<HabilDoc> = {}): HabilDoc => ({
  id: `d${++n}`, org_id: 'o', item_code: code, status: 'enviado', file_path: `o/habilitacao/${n}.pdf`, mime_type: 'application/pdf',
  size_bytes: 10, issued_on: null, valid_until: null, note: null, uploaded_by: 'u', created_at: '2026-11-10T10:00:00Z', ...p,
});

describe('habilitação (Revelar Talentos)', () => {
  it('catálogo tem códigos únicos e as 15 declarações geradas (anexos II a XV)', () => {
    const codes = HABIL_ITEMS.map((i) => i.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(HABIL_ITEMS.filter((i) => i.annex).map((i) => i.annex)).toEqual(['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV']);
  });

  it('sem envio fica pendente; item condicional explica quando se aplica', () => {
    expect(itemStatus(item('4.1'), [], { today }).state).toBe('pendente');
    expect(itemStatus(item('4.20'), [], { today }).message).toContain('1.000.000');
  });

  it('certidão: exige validade, avisa 15 dias antes e marca vencida', () => {
    expect(itemStatus(item('4.1'), [doc('4.1')], { today }).state).toBe('pendente');
    expect(itemStatus(item('4.1'), [doc('4.1', { valid_until: '2027-01-30' })], { today }).state).toBe('ok');
    expect(itemStatus(item('4.1'), [doc('4.1', { valid_until: '2026-11-25' })], { today }).state).toBe('vencendo');
    expect(itemStatus(item('4.1'), [doc('4.1', { valid_until: '2026-11-15' })], { today }).state).toBe('vencido');
  });

  it('comprovante de endereço vale 3 meses a partir da emissão', () => {
    expect(itemStatus(item('1.8'), [doc('1.8', { issued_on: '2026-10-01' })], { today }).state).toBe('ok');
    expect(itemStatus(item('1.8'), [doc('1.8', { issued_on: '2026-08-25' })], { today }).state).toBe('vencendo');
    expect(itemStatus(item('1.8'), [doc('1.8', { issued_on: '2026-07-01' })], { today }).state).toBe('vencido');
  });

  it('vale o envio mais recente', () => {
    const old = doc('4.2', { valid_until: '2026-10-01', created_at: '2026-09-01T10:00:00Z' });
    const neu = doc('4.2', { valid_until: '2027-03-01', created_at: '2026-11-01T10:00:00Z' });
    const s = itemStatus(item('4.2'), [old, neu], { today });
    expect(s.state).toBe('ok');
    expect(s.history).toHaveLength(2);
  });

  it('CNPJ com menos de 3 anos é impeditivo', () => {
    expect(yearsBetween('2023-11-17', today)).toBe(2);
    expect(yearsBetween('2023-11-16', today)).toBe(3);
    expect(itemStatus(item('1.2'), [doc('1.2')], { today, foundedOn: '2024-01-01' }).state).toBe('impeditivo');
    expect(itemStatus(item('1.2'), [doc('1.2')], { today, foundedOn: '2015-01-01' }).state).toBe('ok');
    expect(itemStatus(item('1.2'), [doc('1.2')], { today }).state).toBe('vencendo'); // falta a data de abertura
  });

  it('confirmação e "não se aplica" contam como feitos', () => {
    expect(itemStatus(item('1.11'), [doc('1.11', { status: 'confirmado', file_path: null, mime_type: null })], { today }).state).toBe('ok');
    expect(itemStatus(item('4.21'), [doc('4.21', { status: 'nao_aplica', file_path: null, mime_type: null, note: 'Sem emenda' })], { today }).state).toBe('nao_aplica');
  });

  it('resumo: apto só sem pendências', () => {
    const empty = summarize([], { today });
    expect(empty.apt).toBe(false);
    expect(empty.pct).toBe(0);
    const all = HABIL_ITEMS.map((i) => i.kind === 'confirm'
      ? doc(i.code, { status: 'confirmado', file_path: null, mime_type: null })
      : doc(i.code, { valid_until: '2027-06-01', issued_on: '2026-11-01' }));
    const full = summarize(all, { today, foundedOn: '2010-01-01' });
    expect(full.apt).toBe(true);
    expect(full.pct).toBe(100);
  });
});
