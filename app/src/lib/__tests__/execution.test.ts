import { Packer } from 'docx';
import { strFromU8, unzipSync } from 'fflate';
import { executionSummary, missingFiles, requiredFiles, type ExecItem, type ExecProject, type Expense, type Transfer } from '../execution';
import { buildRcoDoc } from '../rco-doc';
import type { Proposal } from '../proposal';

jest.mock('../supabase', () => ({ supabase: {} }));
jest.mock('../image-reduce', () => ({ reducePicked: jest.fn() }));

const item = (p: Partial<ExecItem>): ExecItem => ({
  id: 'i', proposal_id: 'p', org_id: 'o', goal_id: null, action: null, stage: 'material', description: 'Bola', gnd: 3, unit: 'un', quantity: 30,
  quotes: [], adopted_rule: 'menor', justification: null, unit_value: 320, rh: null, total: 9600, start_month: null, end_month: null, position: 1,
  exec_status: 'normal', exec_note: null, ...p,
});
let n = 0;
const exp = (p: Partial<Expense>): Expense => ({
  id: `e${++n}`, org_id: 'o', project_id: 'pr', item_id: 'i', description: null, supplier: 'Loja A', supplier_doc: '11222333000181', doc_number: 'NF 1',
  quantity: null, value: 1000, spent_on: '2027-04-01', paid_on: '2027-04-02', payment_method: 'transferencia', note: null, created_at: '', expense_files: [], ...p,
});
const files = (...kinds: string[]) => kinds.map((k, i) => ({ id: `f${i}`, expense_id: 'e', kind: k, file_path: `o/execucao/${i}.pdf`, mime_type: 'application/pdf', size_bytes: 1, created_at: '' })) as Expense['expense_files'];

describe('Execução e RCO (Fase C)', () => {
  it('comprovantes pedidos mudam por tipo de despesa (modelo do RCO)', () => {
    expect(requiredFiles('passagens').map((r) => r.kind)).toEqual(expect.arrayContaining(['lista', 'embarque', 'cotacao']));
    expect(requiredFiles('rh', { clt: true }).map((r) => r.kind)).toContain('encargos');
    expect(requiredFiles('rh').map((r) => r.kind)).not.toContain('encargos');
    expect(missingFiles('material', files('nota', 'pagamento', 'cotacao', 'cotacao', 'cotacao', 'foto'))).toEqual([]);
    expect(missingFiles('material', files('recibo', 'pagamento', 'cotacao'))).toEqual(['3 cotações feitas na hora da compra', 'Fotos dos itens em uso pelos atletas']);
  });

  it('combinado × gasto por item e etapa, saldo em conta, estouro e pendências', () => {
    const items = [item({ id: 'a' }), item({ id: 'b', stage: 'rh', description: 'Treinador', total: 50000, rh: { role: 'Treinador', contract: 'RPA', months: 10, salary: 5000 } })];
    const expenses = [exp({ item_id: 'a', value: 9800 }), exp({ item_id: 'b', value: 5000, paid_on: null, expense_files: files('recibo', 'pagamento') })];
    const transfers: Transfer[] = [{ id: 't', project_id: 'pr', source: 'concedente', received_on: '2027-03-10', value: 59600, note: null }];
    const s = executionSummary(items, expenses, transfers);
    expect(s.agreed).toBe(59600);
    expect(s.executed).toBe(14800);
    expect(s.paid).toBe(9800);
    expect(s.inAccount).toBe(49800);
    expect(s.over).toBe(1);                     // bola: 9.800 > 9.600
    expect(s.pendingDocs).toBe(1);              // a bola está sem comprovantes; o treinador tem recibo e pagamento
    expect(s.byStage.find((x) => x.stage === 'rh')).toMatchObject({ agreed: 50000, executed: 5000 });
  });

  it('RCO em Word com identificação, metas medidas, real × previsto, etapas e despesas', async () => {
    const project: ExecProject = { id: 'pr', org_id: 'o', name: 'Núcleo de vôlei', process_number: '951234/2027', starts_on: '2027-03-01', ends_on: '2028-04-30', signed_on: '2027-02-20', proposal_id: 'p', planned_beneficiaries: 60, rco: { conclusao: 'Projeto concluído com sucesso.' }, status: 'active' };
    const proposal = { id: 'p', mesp_value: 400000, counterpart_value: 0, sections: { objeto: 'Núcleo de vôlei de base' } } as unknown as Proposal;
    const items = [item({ id: 'a', exec_status: 'substituido', exec_note: 'Modelo oficial da federação' })];
    const doc = buildRcoDoc({
      project, proposal, items, expenses: [exp({ item_id: 'a', value: 9600, supplier: 'Loja Exemplo' })], transfers: [],
      goals: [{ id: 'g', proposal_id: 'p', org_id: 'o', position: 1, objective: 'Treinar os atletas', qualitative: 'q', quantitative: '75%', expected_result: 'r', method: 'check-in', period_months: 12, indicator: 'avg_frequency', target: 75 }],
      goalResults: [{ code: 'Meta 1', result: 82, reached: true, unit: '%', target: 75 }], realBeneficiaries: 58, avgFrequency: 82,
      org: { name: 'BT Sport Club', cnpj: '11222333000181' },
    });
    const xml = strFromU8(unzipSync(new Uint8Array(await Packer.toBuffer(doc)))['word/document.xml']);
    for (const t of ['RCO', '951234/2027', '11.222.333/0001-81', 'Núcleo de vôlei de base', 'ALCANÇADA', '>60<', '>58<', 'VALOR PACTUADO',
      'substituído: Modelo oficial da federação', 'Loja Exemplo', 'RELAÇÃO DE DESPESAS', 'Projeto concluído com sucesso.']) {
      expect(xml).toContain(t);
    }
  });
});
