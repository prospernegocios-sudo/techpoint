import { brDateTime, buildRows, summarize, toCsv, toHtml, type ReportData, type ReportRecord } from '../report';

const venue = { name: 'Ginásio', latitude: -15.7942, longitude: -47.8822, radius_m: 150 };
const rec = (o: Partial<ReportRecord>): ReportRecord => ({
  id: 'r', event_id: 'e1', athlete_id: 'a1', kind: 'check_in', server_at: '2026-11-10T20:02:00Z', client_at: null,
  synced_offline: false, latitude: -15.7943, longitude: -47.8821, accuracy_m: 8, distance_m: 14, photo_path: 'a1/e1/x.jpg',
  source: 'app', manual_reason: null, recorded_by_name: null, status: 'valid', justification: null, reviewed_by_name: null,
  reviewed_at: null, flags: [], code: 'ABCDEF1234', ...o,
});

const data: ReportData = {
  generated_at: '2026-11-12T22:00:00Z', generated_by: 'Treinador',
  period: { from: '2026-11-01', to: '2026-11-12' },
  project: { name: 'Vôlei para Todos', number: '123' },
  org: { id: 'o', name: 'DF Vôlei' },
  teams: [{ id: 't1', name: 'Sub 17', category: null }],
  events: [
    { id: 'e1', team_id: 't1', type: 'training', title: null, starts_at: '2026-11-10T20:00:00Z', ends_at: '2026-11-10T21:30:00Z', venue },
    { id: 'e2', team_id: 't1', type: 'training', title: null, starts_at: '2026-11-12T20:00:00Z', ends_at: '2026-11-12T21:30:00Z', venue },
  ],
  members: [
    { team_id: 't1', athlete_id: 'a1', full_name: 'Ana "Bia" <Souza>', joined_at: '2026-01-01T00:00:00Z' },
    { team_id: 't1', athlete_id: 'a2', full_name: 'Bruno; Lima', joined_at: '2026-01-01T00:00:00Z' },
    // Entrou na equipe depois do primeiro treino: só conta no segundo.
    { team_id: 't1', athlete_id: 'a3', full_name: 'Caio', joined_at: '2026-11-11T12:00:00Z' },
  ],
  records: [
    rec({ id: 'r1' }),
    rec({ id: 'r2', kind: 'check_out', server_at: '2026-11-10T21:31:00Z', code: 'FFFF000011' }),
    rec({ id: 'r3', athlete_id: 'a2', status: 'pending', distance_m: 900, justification: 'GPS ruim' }),
    rec({ id: 'r4', event_id: 'e2', athlete_id: 'a3', source: 'manual', photo_path: null, manual_reason: 'Sem celular', latitude: null, longitude: null, distance_m: null }),
  ],
};

describe('relatório de frequência', () => {
  const rows = buildRows(data);

  it('mostra horário de Brasília (UTC−3)', () => {
    expect(brDateTime('2026-11-10T20:02:00Z')).toBe('10/11/2026 17:02');
    expect(brDateTime('2026-11-11T01:30:00Z')).toBe('10/11/2026 22:30');
  });

  it('só cobra presença de quem já estava na equipe no dia do treino', () => {
    expect(rows.filter((r) => r.event.id === 'e1').map((r) => r.athleteId).sort()).toEqual(['a1', 'a2']);
    expect(rows.filter((r) => r.event.id === 'e2').map((r) => r.athleteId).sort()).toEqual(['a1', 'a2', 'a3']);
  });

  it('pendente não conta como presença; manual conta', () => {
    const s = summarize(rows);
    const by = Object.fromEntries(s.map((x) => [x.athleteId, x]));
    expect(by.a1).toMatchObject({ expected: 2, present: 1, pct: 50 });
    expect(by.a2).toMatchObject({ expected: 2, present: 0, pending: 1, pct: 0 });
    expect(by.a3).toMatchObject({ expected: 1, present: 1, pct: 100 });
  });

  it('planilha usa ponto e vírgula, protege textos e calcula permanência', () => {
    const csv = toCsv(data, rows);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Bruno; Lima"');
    expect(csv).toContain('"Ana ""Bia"" <Souza>"');
    const line = csv.split('\r\n').find((l) => l.startsWith('10/11/2026') && l.includes('Ana'))!;
    expect(line).toContain('ABCDEF1234');
    expect(line).toContain(';89;'); // 17:02 → 18:31
  });

  it('registro sem internet mostra a hora do aparelho separada da hora do servidor', () => {
    const off: ReportData = { ...data, records: [rec({ id: 'x', synced_offline: true, client_at: '2026-11-10T20:01:00Z', server_at: '2026-11-11T09:00:00Z' })] };
    const r = buildRows(off);
    const html = toHtml(off, r, {});
    expect(html).toContain('<b>17:01</b> (hora do aparelho)');
    expect(html).toContain('Recebido pelo servidor em 11/11/2026 06:00');
    const line = toCsv(off, r).split('\r\n').find((l) => l.includes('Ana'))!;
    expect(line).toContain('11/11/2026 06:00;10/11/2026 17:01;');
  });

  it('PDF escapa nomes e mostra códigos, fotos e resumo', () => {
    const html = toHtml(data, rows, { 'a1/e1/x.jpg': 'data:image/jpeg;base64,AAAA' });
    expect(html).toContain('Ana &quot;Bia&quot; &lt;Souza&gt;');
    expect(html).not.toContain('<Souza>');
    expect(html).toContain('ABCDEF1234');
    expect(html).toContain('data:image/jpeg;base64,AAAA');
    expect(html).toContain('sem foto<br/>(manual)');
    expect(html).toContain('Vôlei para Todos');
    expect(html).toMatch(/Frequência média:<\/b> 40%/); // 2 presenças de 5 previstas
  });
});
