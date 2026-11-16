import {
  adoptedValue, axisCheck, itemIssues, itemValues, monthlySpend, proposalChecks, quoteStats, rhCost, summarizeAudience, totals,
  type BudgetItem, type Goal, type Proposal,
} from '../proposal';

jest.mock('../supabase', () => ({ supabase: {} }));

let n = 0;
const item = (p: Partial<BudgetItem>): BudgetItem => ({
  id: `i${++n}`, proposal_id: 'p', org_id: 'o', goal_id: null, action: null, stage: 'material', description: 'x', gnd: 3, unit: 'un',
  quantity: 1, quotes: [], adopted_rule: 'menor', justification: null, unit_value: 0, rh: null, total: 0, start_month: null, end_month: null, position: 1, ...p,
});
const Q = [{ supplier: 'A', value: 30 }, { supplier: 'B', value: 35 }, { supplier: 'C', value: 40 }];

describe('Projeto Técnico (Fase B)', () => {
  it('faixa de valor por eixo (SNE)', () => {
    expect(axisCheck('nucleo', 400_000).ok).toBe(true);
    expect(axisCheck('nucleo', 300_000).ok).toBe(false);
    expect(axisCheck('nucleo', 1_200_000).message).toContain('Acima');
    expect(axisCheck('competicao', 5_000_000).ok).toBe(true);
    expect(axisCheck('capacitacao', 200_000).ok).toBe(false);
  });

  it('valor adotado: menor, média e mediana das 3 cotações', () => {
    expect(quoteStats(Q)).toEqual({ menor: 30, media: 35, mediana: 35 });
    expect(adoptedValue([{ supplier: 'A', value: 50 }, { supplier: 'B', value: 45 }, { supplier: 'C', value: 60 }], 'menor')).toBe(45);
    expect(quoteStats([{ supplier: 'A', value: 10 }, { supplier: 'B', value: 20 }])?.mediana).toBe(15);
    expect(quoteStats([])).toBeNull();
  });

  it('item: quantidade × valor adotado; pendências de cotação e justificativa', () => {
    expect(itemValues({ stage: 'material', quantity: 20, quotes: Q, adopted_rule: 'media', rh: null })).toEqual({ unit: 35, total: 700 });
    expect(itemIssues(item({ quotes: Q.slice(0, 2) }))).toContain('1 cotação(ões)');
    expect(itemIssues(item({ quotes: Q, adopted_rule: 'media' }))).toContain('justificativa do valor');
    expect(itemIssues(item({ quotes: Q }))).toEqual([]);
  });

  it('equipe CLT com encargos do modelo (INSS 26,5%, FGTS 8%, PIS 1%, 13º e férias)', () => {
    const c = rhCost({ role: 'Auxiliar técnico', contract: 'CLT', months: 12, salary: 2300 });
    expect(c.base).toBe(27600);
    expect(c.decimo).toBe(2300);
    expect(c.ferias).toBeCloseTo(3066.67, 2);
    expect(c.encargos).toBeCloseTo((27600 + 2300 + 3066.67) * 0.355, 1);
    expect(rhCost({ role: 'Fisioterapeuta', contract: 'RPA', months: 10, salary: 1000 }).total).toBe(10000);
    expect(itemValues({ stage: 'rh', quantity: 2, quotes: [], adopted_rule: 'menor', rh: { role: 'X', contract: 'RPA', months: 10, salary: 1000 } }).total).toBe(20000);
  });

  it('totais por tipo de despesa e gasto mês a mês', () => {
    const items = [item({ total: 1200, start_month: 1, end_month: 12 }), item({ total: 600, gnd: 4, start_month: 3, end_month: 3, stage: 'equipamentos' })];
    const t = totals(items);
    expect(t).toMatchObject({ total: 1800, gnd3: 1200, gnd4: 600 });
    const m = monthlySpend(items, 12);
    expect(m[0]).toBe(100);
    expect(m[2]).toBe(700);
    expect(m.reduce((s, x) => s + x, 0)).toBeCloseTo(1800, 2);
  });

  it('público-alvo por fase e sexo, faixas de idade e aviso acima de 21 anos', () => {
    const athletes = [
      { id: '1', sex: 'M' as const, birth_date: '2010-05-01', team_ids: ['sub15'] },
      { id: '2', sex: 'F' as const, birth_date: '2009-01-01', team_ids: ['sub17'] },
      { id: '3', sex: 'M' as const, birth_date: '2000-01-01', team_ids: ['sub17'] },
      { id: '4', sex: null, birth_date: '2012-01-01', team_ids: ['outra'] },
    ];
    const s = summarizeAudience({ teams: [{ team_id: 'sub15', phase: 'especializacao' }, { team_id: 'sub17', phase: 'aperfeicoamento' }], comissao: 3, staff: 1 }, athletes, new Date('2027-03-01T12:00:00'));
    expect(s.athletes).toBe(3);
    expect(s.rows[0]).toEqual({ phase: 'especializacao', M: 1, F: 0, other: 0 });
    expect(s.rows[1]).toEqual({ phase: 'aperfeicoamento', M: 1, F: 1, other: 0 });
    expect(s.overAge).toBe(1);
    expect(s.total).toBe(7);
    expect(s.ages.find((a) => a.label === '16 a 18')?.n).toBe(2);
  });

  it('conferências: soma do orçamento, parcelas, vigência e contrapartida', () => {
    const p: Proposal = {
      id: 'p', org_id: 'o', project_id: null, title: 'T', axis: 'nucleo', instrument: 'fomento', status: 'rascunho', mesp_value: 400000,
      counterpart_value: 0, starts_on: '2027-03-01', months: 14, sections: { objeto: 'Núcleo' }, audience: {}, schedule: [],
      disbursement: [{ who: 'concedente', month: 3, year: 2027, value: 400000 }], created_at: '', updated_at: '',
    };
    const goals = [{ id: 'g', objective: 'x', qualitative: 'a', quantitative: 'b', expected_result: 'c', method: 'd', period_months: 12 } as Goal];
    const good = proposalChecks(p, goals, [item({ quotes: Q, total: 400000 })]);
    expect(good.filter((c) => !c.ok)).toEqual([]);
    const bad = proposalChecks({ ...p, mesp_value: 1_200_000, months: 40 }, [], [item({ total: 1000 })]);
    const failing = bad.filter((c) => !c.ok).map((c) => c.text).join(' | ');
    expect(failing).toContain('Acima da faixa');
    expect(failing).toContain('contrapartida');
    expect(failing).toContain('36 meses');
    expect(failing).toContain('Orçamento');
  });
});
