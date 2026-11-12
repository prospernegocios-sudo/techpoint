import { ageOn, maskDate, maskTime, parseBrDate, parseTime } from '../format';

describe('datas no padrão brasileiro', () => {
  it('lê dd/mm/aaaa válida', () => {
    const d = parseBrDate('14/03/2011')!;
    expect([d.getDate(), d.getMonth() + 1, d.getFullYear()]).toEqual([14, 3, 2011]);
  });
  it('recusa datas impossíveis', () => {
    expect(parseBrDate('31/02/2012')).toBeNull();
    expect(parseBrDate('2012-01-01')).toBeNull();
  });
  it('lê horário', () => {
    expect(parseTime('17:05')).toEqual([17, 5]);
    expect(parseTime('25:00')).toBeNull();
  });
  it('aplica máscara enquanto digita', () => {
    expect(maskDate('14032011')).toBe('14/03/2011');
    expect(maskTime('1730')).toBe('17:30');
  });
  it('calcula idade (regra dos 10 anos)', () => {
    const on = new Date(2026, 10, 12);
    expect(ageOn(new Date(2016, 10, 12), on)).toBe(10);
    expect(ageOn(new Date(2016, 10, 13), on)).toBe(9);
  });
});
