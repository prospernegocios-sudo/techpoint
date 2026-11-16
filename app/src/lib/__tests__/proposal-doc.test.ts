import { Packer } from 'docx';
import { strFromU8, unzipSync } from 'fflate';
import { buildBudgetCsv, buildProposalDoc, type ProposalDocCtx } from '../proposal-doc';
import { summarizeAudience, type BudgetItem, type Proposal } from '../proposal';

jest.mock('../supabase', () => ({ supabase: {} }));

const p: Proposal = {
  id: 'p', org_id: 'o', project_id: null, title: 'Núcleo de vôlei', axis: 'nucleo', instrument: 'fomento', status: 'rascunho',
  mesp_value: 400000, counterpart_value: 0, starts_on: '2027-03-01', months: 14, sections: { objeto: 'Implantação de núcleo de vôlei de base' },
  audience: { teams: [{ team_id: 't', phase: 'aperfeicoamento' }], comissao: 2, staff: 1 },
  schedule: [{ action: 'Treinamentos', months: [3, 4, 5] }], disbursement: [{ who: 'concedente', month: 3, year: 2027, value: 400000 }], created_at: '', updated_at: '',
};
const base = { proposal_id: 'p', org_id: 'o', goal_id: 'g', action: 'Equipe', unit: 'un', start_month: null, end_month: null, position: 1, justification: null } as const;
const items: BudgetItem[] = [
  { ...base, id: 'a', stage: 'rh', description: 'Treinador', gnd: 3, quantity: 1, quotes: [], adopted_rule: 'menor', unit_value: 3000, total: 50000, rh: { role: 'Treinador principal', contract: 'CLT', months: 12, salary: 3000 } },
  { ...base, id: 'b', stage: 'material', description: 'Bola oficial', gnd: 3, quantity: 30, quotes: [{ supplier: 'Loja A', value: 300 }, { supplier: 'Loja B', value: 320 }, { supplier: 'Loja C', value: 340 }], adopted_rule: 'media', justification: 'Especificação oficial', unit_value: 320, total: 9600, rh: null },
];
const ctx: ProposalDocCtx = {
  p, goals: [{ id: 'g', proposal_id: 'p', org_id: 'o', position: 1, objective: 'Treinar 60 atletas', qualitative: 'q', quantitative: '75%', expected_result: 'r', method: 'check-in', period_months: 12, indicator: 'avg_frequency', target: 75 }],
  items, aud: summarizeAudience(p.audience, [{ id: '1', sex: 'F', birth_date: '2010-01-01', team_ids: ['t'] }], new Date('2027-03-01T12:00:00')),
  org: { name: 'BT Sport Club', cnpj: '11222333000181', city: 'Brasília', uf: 'DF', address: 'SGAS 915' }, signer: { full_name: 'Paulo Nogueira' }, sport: 'Vôlei',
};

describe('Projeto Técnico em Word e planilha', () => {
  it('Word com as seções do modelo, metas, equipe, cotações e cronogramas', async () => {
    const xml = strFromU8(unzipSync(new Uint8Array(await Packer.toBuffer(buildProposalDoc(ctx))))['word/document.xml']);
    for (const s of ['PROJETO TÉCNICO / PLANO DE TRABALHO', '11.222.333/0001-81', 'Implantação de núcleo de vôlei de base', 'OBJETIVO 1 – Treinar 60 atletas',
      'Treinador principal', 'Loja B: 320,00', '(média)', 'Especificação oficial', 'CRONOGRAMA DE DESEMBOLSO', '21. AÇÕES TRANSVERSAIS', 'Paulo Nogueira']) {
      expect(xml).toContain(s);
    }
  });
  it('planilha com menor, média, mediana, critério e memória de cálculo', () => {
    const csv = buildBudgetCsv(ctx);
    expect(csv.split('\r\n')).toHaveLength(3);
    expect(csv).toContain('"Média"');
    expect(csv).toContain('320,00 x 30 = 9600,00');
    expect(csv).toContain('13º, férias e encargos');
  });
});
