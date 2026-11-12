import { buildProjectRows, toProjectHtml, type ProjectSnapshot } from '../report';

const venue = { name: 'Ginásio', latitude: -15.79, longitude: -47.88, radius_m: 150 };
const snap: ProjectSnapshot = {
  generated_at: '2026-11-13T15:00:00Z', generated_by: 'Gestor',
  period: { from: '2026-11-01', to: '2026-11-13' },
  issue: { number: 3, version: 2, rectifies_version: 1, rectification_reason: 'Presença aprovada depois' },
  project: { name: 'Vôlei para Todos', process_number: '58000.1/2026', sphere: 'federal', agency: 'Ministério do Esporte', program: 'LIE', proponent: 'Associação', starts_on: '2026-01-01', ends_on: '2026-12-31', free_of_charge: true, public_school_min_pct: 50 },
  org: { id: 'o', name: 'DF Vôlei' },
  plan: { version: 2, approved_on: '2026-02-10', description: null },
  indicators: { activities_done: 2, activities_canceled: 1, beneficiaries_enrolled: 3, unique_beneficiaries: 1, attendances: 2, eligible_total: 3, pending_total: 1, avg_frequency_pct: 66.7, school_public: 1, school_private: 1, school_unknown: 1, public_school_pct: 33.3 },
  goals: [{ code: 'Meta 1', description: 'Atender <crianças>', indicator: null, kind: 'unique_beneficiaries', unit: 'pessoas', target: 2, verifier: 'Lista de presença', result: 1, reached: false }],
  teams: [{ id: 't1', name: 'Sub 15', category: null }],
  events: [
    { id: 'e1', team_id: 't1', type: 'training', title: null, starts_at: '2026-11-10T20:00:00Z', ends_at: '2026-11-10T21:30:00Z', venue },
    { id: 'e2', team_id: 't1', type: 'training', title: null, starts_at: '2026-11-12T20:00:00Z', ends_at: '2026-11-12T21:30:00Z', venue },
  ],
  canceled_events: [{ id: 'e3', team_id: 't1', starts_at: '2026-11-11T20:00:00Z' }],
  beneficiaries: [
    { athlete_id: 'a', full_name: 'Ana', starts_on: '2026-01-01', ends_on: null, end_reason: null, school_type: 'publica', eligible: 2, present: 2, pending: 0, frequency_pct: 100 },
    { athlete_id: 'b', full_name: 'Bruno', starts_on: '2026-11-12', ends_on: null, end_reason: null, school_type: 'nao_informado', eligible: 1, present: 0, pending: 1, frequency_pct: 0 },
    { athlete_id: 'd', full_name: 'Davi', starts_on: '2026-01-01', ends_on: '2026-11-05', end_reason: 'transferencia', school_type: 'privada', eligible: 0, present: 0, pending: 0, frequency_pct: null },
  ],
  eligible: [{ athlete_id: 'a', event_id: 'e1' }, { athlete_id: 'a', event_id: 'e2' }, { athlete_id: 'b', event_id: 'e2' }],
  records: [],
};

describe('relatório emitido do projeto', () => {
  it('linhas seguem só os pares elegíveis calculados no servidor', () => {
    const rows = buildProjectRows(snap);
    expect(rows.map((r) => `${r.event.id}:${r.athleteName}`)).toEqual(['e1:Ana', 'e2:Ana', 'e2:Bruno']);
  });
  it('mostra número, retificação, metas, contas e "não aplicável"', () => {
    const html = toProjectHtml(snap, 'a'.repeat(64), {});
    expect(html).toContain('Relatório de execução nº 3 — retificação (versão 2)');
    expect(html).toContain('Retifica a versão 1');
    expect(html).toContain('Atender &lt;crianças&gt;');
    expect(html).toContain('2 presenças ÷ 3 atividades elegíveis');
    expect(html).toContain('66,7%');
    expect(html).toContain('mínimo do projeto: 50%');
    expect(html).toContain('não aplicável');
    expect(html).toContain('(transferência)');
    expect(html).toContain('Abaixo do alvo');
  });
});
