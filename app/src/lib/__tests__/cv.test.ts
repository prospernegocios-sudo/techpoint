import { cvHtml, maskMonthYear, monthLabel, parseMonthYear, sportTime, toMonthYear, type Cv } from '../cv';

test('mês/ano: máscara, leitura e exibição', () => {
  expect(maskMonthYear('032019')).toBe('03/2019');
  expect(parseMonthYear('03/2019')).toBe('2019-03-01');
  expect(parseMonthYear('13/2019')).toBeNull();
  expect(parseMonthYear('3-2019')).toBeNull();
  expect(monthLabel('2019-03-01')).toBe('mar/2019');
  expect(toMonthYear('2019-03-01')).toBe('03/2019');
});

test('tempo de esporte em anos e meses', () => {
  const today = new Date('2026-11-15T12:00:00');
  expect(sportTime('2019-03-01', today)).toBe('7 anos e 8 meses');
  expect(sportTime('2026-10-01', today)).toBe('1 mês');
  expect(sportTime('2026-11-01', today)).toBe('menos de 1 mês');
});

test('PDF do currículo mostra trajetória e selo, e escapa texto', () => {
  const cv: Cv = {
    athlete_id: 'a', full_name: 'Ana <Teste>', age: 15, org: 'DF Vôlei', modality: 'Vôlei de praia', position: 'Defesa',
    sport_started_on: '2019-03-01', body: null, teams: [{ name: 'Sub 15', category: 'Sub 15', since: '2026-01-10' }],
    attendance_12m: { events: 10, present: 9, pct: 90 },
    entries: [{ id: '1', kind: 'titulo', title: 'Campeã Sub 15', institution: 'FBV', category: null, location: 'Brasília', started_on: '2025-10-01', ended_on: null, description: null, verified: true, verified_by_org: 'DF Vôlei' }],
  };
  const html = cvHtml(cv);
  expect(html).toContain('Ana &lt;Teste&gt;');
  expect(html).toContain('Campeã Sub 15');
  expect(html).toContain('Confirmado por DF Vôlei');
  expect(html).toContain('90%');
});
