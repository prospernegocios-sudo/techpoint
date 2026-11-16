// Projeto Técnico / Plano de Trabalho em Word, na ordem do modelo do Ministério (Revelar Talentos, abril/2026),
// e a planilha do orçamento (para copiar no Plano de Aplicação Detalhado do Transferegov.br).
import { AlignmentType, BorderStyle, Document, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import {
  AXES, RULES, SECTIONS, brl, monthlySpend, quoteStats, rhCost, stageLabel, totals,
  type AudienceSummary, type BudgetItem, type Goal, type Proposal,
} from './proposal';

export type ProposalDocCtx = {
  p: Proposal; goals: Goal[]; items: BudgetItem[]; aud: AudienceSummary | null;
  org: { name: string; legal_name?: string | null; cnpj?: string | null; phone?: string | null; email?: string | null; address?: string; city?: string | null; uf?: string | null };
  signer?: { full_name: string; phone?: string | null; email?: string | null } | null;
  sport?: string | null;
};

const FONT = 'Arial';
const r = (text: string, o: { bold?: boolean; size?: number; italic?: boolean } = {}) =>
  String(text ?? '').split('\n').map((line, i) => new TextRun({ text: line, font: FONT, size: o.size ?? 21, bold: o.bold, italics: o.italic, break: i ? 1 : 0 }));
const P = (text: string, o: { bold?: boolean; center?: boolean; size?: number; italic?: boolean; before?: number } = {}) =>
  new Paragraph({ alignment: o.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED, spacing: { before: o.before ?? 0, after: 140, line: 290 }, children: r(text, o) });
const H = (text: string) => new Paragraph({ spacing: { before: 280, after: 140 }, shading: { fill: 'D9D9D9' }, children: r(text, { bold: true, size: 23 }) });
const border = { style: BorderStyle.SINGLE, size: 4, color: '777777' };
const PAGE_W = 9638; // largura útil do A4 com as margens usadas (em twips)
/** Tabela; widths = proporção de cada coluna (ex.: [3, 1, 1]). */
function T(rows: string[][], opts: { header?: boolean; size?: number; widths?: number[] } = {}): Table {
  const n = rows[0]?.length ?? 1;
  const w = opts.widths && opts.widths.length === n ? opts.widths : Array(n).fill(1);
  const sumW = w.reduce((a, b) => a + b, 0);
  const cols = w.map((x) => Math.floor((x / sumW) * PAGE_W));
  return new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: cols,
    rows: rows.map((row, ri) => new TableRow({
      children: row.map((cell, ci) => new TableCell({
        width: { size: cols[ci] ?? cols[0], type: WidthType.DXA },
        borders: { top: border, bottom: border, left: border, right: border },
        shading: opts.header !== false && ri === 0 ? { fill: 'EFEFEF' } : undefined,
        children: [new Paragraph({ children: r(cell || ' ', { bold: opts.header !== false && ri === 0, size: opts.size ?? 17 }) })],
      })),
    })),
  });
}
const gap = () => new Paragraph({ children: [] });
const money = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthName = (iso: string | null, add: number) => {
  if (!iso) return `${add + 1}º`;
  const d = new Date(iso + 'T12:00:00'); d.setMonth(d.getMonth() + add);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
const fmtCnpj = (c?: string | null) => (c && /^\d{14}$/.test(c) ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : c ?? '');
const text = (p: Proposal, key: string) => (p.sections?.[key] ?? '').trim() || '(a preencher)';

export function buildProposalDoc(c: ProposalDocCtx): Document {
  const { p, goals, items, aud } = c;
  const global = Number(p.mesp_value) + Number(p.counterpart_value);
  const months = p.months ?? 12;
  const end = p.starts_on ? monthName(p.starts_on, months - 1) : '';
  const t = totals(items);
  const out: (Paragraph | Table)[] = [];

  out.push(P('PROJETO TÉCNICO / PLANO DE TRABALHO', { bold: true, center: true, size: 26 }));
  out.push(P(`Programa REVELAR TALENTOS: Especialização e Aperfeiçoamento · ${AXES.find((a) => a.key === p.axis)?.label ?? ''}`, { center: true }));
  out.push(T([
    ['NOME DA ENTIDADE:', c.org.legal_name || c.org.name], ['CNPJ:', fmtCnpj(c.org.cnpj)],
    ['TELEFONE/E-MAIL:', [c.org.phone, c.org.email].filter(Boolean).join(' · ')], ['ENDEREÇO COMPLETO:', c.org.address ?? ''],
    ['CIDADE/ESTADO:', [c.org.city, c.org.uf].filter(Boolean).join('/')],
    ['NOME DO DIRIGENTE:', c.signer?.full_name ?? ''], ['TELEFONE/E-MAIL:', [c.signer?.phone, c.signer?.email].filter(Boolean).join(' · ')],
    ['OBJETO DA PROPOSTA:', text(p, 'objeto')],
    ['INÍCIO DA VIGÊNCIA:', p.starts_on ? monthName(p.starts_on, 0) : ''], ['TÉRMINO DA VIGÊNCIA:', end],
    ['VALOR MESP:', brl(Number(p.mesp_value))], ['VALOR CONTRAPARTIDA:', brl(Number(p.counterpart_value))], ['VALOR DO PROJETO:', brl(global)],
  ], { header: false, size: 19, widths: [1.2, 3] }));
  if (aud) {
    out.push(gap());
    const e = aud.rows[0], a = aud.rows[1];
    out.push(T([
      ['ESPORTE/MODALIDADE', 'Especialização M', 'Especialização F', 'Aperfeiçoamento M', 'Aperfeiçoamento F', 'Profissionais', 'Subtotal'],
      [c.sport || 'Modalidade', String(e.M), String(e.F), String(a.M), String(a.F), String(aud.comissao + aud.staff), String(aud.total)],
    ]));
  }

  out.push(H('1. INTRODUÇÃO')); out.push(P(text(p, 'introducao')));
  out.push(H('2. OBJETO DA PROPOSTA')); out.push(P(text(p, 'objeto')));
  out.push(H('3. PÚBLICO-ALVO / BENEFICIADOS'));
  if (aud) {
    out.push(T([
      ['FASE', 'ATLETAS FEM', 'ATLETAS MASC', 'COMISSÃO TÉCNICA', 'STAFF', 'TOTAL'],
      ['Especialização', String(aud.rows[0].F), String(aud.rows[0].M), '', '', String(aud.rows[0].F + aud.rows[0].M + aud.rows[0].other)],
      ['Aperfeiçoamento', String(aud.rows[1].F), String(aud.rows[1].M), '', '', String(aud.rows[1].F + aud.rows[1].M + aud.rows[1].other)],
      ['TOTAL GERAL', String(aud.women), String(aud.men), String(aud.comissao), String(aud.staff), String(aud.total)],
    ]));
    out.push(P(`Faixa etária dos atletas no início da vigência: ${aud.ages.filter((x) => x.n).map((x) => `${x.label} anos: ${x.n}`).join('; ') || 'a informar'}.`, { before: 120 }));
    if (aud.indirect) out.push(P(`Beneficiários indiretos: ${aud.indirect} pessoas.`));
  }
  out.push(P(text(p, 'selecao')));
  out.push(H('4. OBJETIVO GERAL')); out.push(P(text(p, 'objetivo_geral')));
  out.push(H('5. OBJETIVOS ESPECÍFICOS'));
  goals.forEach((g, i) => out.push(P(`${i + 1}) ${g.objective}`)));
  out.push(H('6. METAS'));
  goals.forEach((g, i) => {
    out.push(P(`OBJETIVO ${i + 1} – ${g.objective}`, { bold: true }));
    out.push(T([
      ['Meta qualitativa:', g.qualitative ?? ''], ['Meta quantitativa:', g.quantitative ?? ''], ['Resultado esperado:', g.expected_result ?? ''],
      ['Metodologia/modo de aferição/cumprimento:', g.method ?? ''], ['Período de avaliação das metas:', g.period_months ? `${g.period_months} meses` : ''],
    ], { header: false, size: 19, widths: [1.3, 3] }));
    out.push(gap());
  });
  out.push(H('7. INFRAESTRUTURA')); out.push(P(text(p, 'infraestrutura')));
  out.push(H('8. METODOLOGIA')); out.push(P(text(p, 'metodologia')));
  out.push(H('9. VIGÊNCIA')); out.push(P(`${months} meses${p.starts_on ? `, de ${monthName(p.starts_on, 0)} a ${end}` : ''}.`));
  out.push(H('10. JUSTIFICATIVA')); out.push(P(text(p, 'justificativa')));

  out.push(H('11. CUSTOS / NATUREZA DAS DESPESAS'));
  const goalName = (id: string | null) => goals.find((g) => g.id === id)?.objective ?? '';
  const rh = items.filter((i) => i.stage === 'rh' && i.rh);
  if (rh.length) {
    out.push(P('RECURSOS HUMANOS', { bold: true }));
    out.push(T([
      ['CARGO', 'ATRIBUIÇÃO', 'PERFIL', 'CONTRATO', 'CARGA HORÁRIA', 'MESES', 'REMUNERAÇÃO BRUTA (MÊS)', 'ENCARGOS, 13º E FÉRIAS', 'VALOR TOTAL'],
      ...rh.map((i) => {
        const x = rhCost(i.rh!); const q = i.quantity || 1;
        return [`${i.rh!.role}${q > 1 ? ` (${q})` : ''}`, i.rh!.duties ?? '', i.rh!.profile ?? '', i.rh!.contract, i.rh!.workload ?? '', String(i.rh!.months),
          money(i.rh!.salary), money((x.decimo + x.ferias + x.encargos) * q), money(Number(i.total))];
      }),
    ], { size: 15, widths: [2, 2.4, 2.4, 1.2, 1.3, 0.8, 1.4, 1.5, 1.5] }));
    out.push(P('Encargos de CLT conforme o modelo: INSS patronal 26,5%, FGTS 8%, PIS 1%, 13º salário e férias proporcionais (art. 46 da Lei 13.019/2014 e art. 42 do Decreto 8.726/2016).', { italic: true, size: 17, before: 80 }));
  }
  const others = items.filter((i) => i.stage !== 'rh');
  if (others.length) {
    out.push(P('DEMAIS AÇÕES E ETAPAS', { bold: true, before: 160 }));
    out.push(T([
      ['META / AÇÃO', 'ETAPA', 'DESCRIÇÃO', 'QUANT.', 'COTAÇÕES (3 EMPRESAS)', 'VALOR ADOTADO', 'VALOR TOTAL', 'GND'],
      ...others.map((i) => {
        const q = [0, 1, 2].map((k) => (i.quotes[k] ? `${k + 1}) ${i.quotes[k].supplier}: ${money(Number(i.quotes[k].value))}` : `${k + 1}) —`)).join('\n');
        return [[goalName(i.goal_id), i.action].filter(Boolean).join(' / '), stageLabel(i.stage), i.description, `${String(i.quantity).replace('.', ',')} ${i.unit ?? ''}`.trim(), q,
          `${money(Number(i.unit_value))}\n(${RULES.find((x) => x.key === i.adopted_rule)?.label.toLowerCase()})`, money(Number(i.total)), String(i.gnd)];
      }),
    ], { size: 15, widths: [2.2, 1.3, 2.6, 1, 2.8, 1.3, 1.4, 0.6] }));
    const just = others.filter((i) => i.adopted_rule !== 'menor' && i.justification);
    if (just.length) {
      out.push(P('Justificativa do valor adotado (quando não é o menor preço):', { bold: true, before: 120 }));
      just.forEach((i) => out.push(P(`• ${i.description}: ${i.justification}`, { size: 19 })));
    }
  }
  out.push(T([
    ['RESUMO', 'VALOR'], ...t.byStage.map((s) => [s.label, brl(s.total)]),
    ['Custeio (GND 3)', brl(t.gnd3)], ['Investimento (GND 4)', brl(t.gnd4)], ['TOTAL', brl(t.total)],
  ], { size: 18 }));

  out.push(H('12. PREVISÃO DE RECEITA')); out.push(P(text(p, 'receitas')));

  out.push(H('14. CRONOGRAMA DE EXECUÇÃO DO PROJETO'));
  if (p.schedule.length) {
    out.push(T([
      ['Nº', 'AÇÕES', ...Array.from({ length: months }, (_, k) => `${k + 1}º`)],
      ...p.schedule.map((s, i) => [String(i + 1), s.action, ...Array.from({ length: months }, (_, k) => (s.months.includes(k + 1) ? 'x' : ''))]),
    ], { size: months > 14 ? 12 : 15, widths: [0.5, 4, ...Array(months).fill(0.55)] }));
  } else out.push(P('(a preencher)'));

  out.push(H('15. CRONOGRAMA DE DESEMBOLSO'));
  out.push(T([
    ['PARCELA', 'RESPONSÁVEL', 'MÊS PREVISÃO', 'ANO', 'VALOR (R$)'],
    ...p.disbursement.map((d, i) => [`${i + 1}ª parcela`, d.who === 'concedente' ? 'Concedente' : 'Convenente', String(d.month), String(d.year), money(Number(d.value))]),
    ['TOTAL GLOBAL', '', '', '', money(p.disbursement.reduce((s, d) => s + Number(d.value || 0), 0))],
  ], { size: 18 }));
  const spend = monthlySpend(items, months);
  out.push(P('Cronograma de desembolso mensal (gasto previsto por mês):', { bold: true, before: 160 }));
  out.push(T([
    ['MÊS', ...spend.map((_, k) => monthName(p.starts_on, k))],
    ['VALOR', ...spend.map((v) => money(v))],
  ], { size: months > 12 ? 11 : 14 }));

  out.push(H('16. ESTRATÉGIAS DE COMUNICAÇÃO')); out.push(P(text(p, 'comunicacao')));
  out.push(H('17. MONITORAMENTO E AVALIAÇÃO')); out.push(P(text(p, 'monitoramento')));
  out.push(H('18. INFORMAÇÕES COMPLEMENTARES DA PROPOSTA')); out.push(P(text(p, 'complementares')));
  out.push(H('19. CAPACIDADE TÉCNICA DA ENTIDADE')); out.push(P(text(p, 'capacidade')));
  out.push(H('20. RESULTADOS ESPERADOS / CONCLUSÃO')); out.push(P(text(p, 'resultados')));
  out.push(H('21. AÇÕES TRANSVERSAIS')); out.push(P(text(p, 'transversais')));

  return new Document({
    creator: 'TechPoint', title: `Projeto Técnico – ${p.title}`,
    sections: [{ properties: { page: { margin: { top: 1418, bottom: 1134, left: 1134, right: 1134 } } }, children: out }],
  });
}

/** Planilha do orçamento (CSV com ; e vírgula decimal, abre direto no Excel). */
export function buildBudgetCsv(c: ProposalDocCtx): string {
  const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const num = (n: number) => money(n).replace(/\./g, '');
  const goalName = (id: string | null) => c.goals.find((g) => g.id === id)?.objective ?? '';
  const head = ['Meta', 'Ação', 'Etapa', 'Descrição', 'GND', 'Unidade', 'Quantidade', 'Empresa 1', 'Valor 1', 'Empresa 2', 'Valor 2', 'Empresa 3', 'Valor 3', 'Menor', 'Média', 'Mediana', 'Critério', 'Valor unitário adotado', 'Valor total', 'Memória de cálculo', 'Justificativa', 'Mês início', 'Mês fim'];
  const rows = c.items.map((i) => {
    const s = quoteStats(i.quotes);
    const memo = i.stage === 'rh' && i.rh
      ? `${i.rh.role}: ${num(i.rh.salary)} x ${i.rh.months} meses${i.rh.contract === 'CLT' ? ' + 13º, férias e encargos (INSS 26,5%, FGTS 8%, PIS 1%)' : ''}${i.quantity > 1 ? ` x ${i.quantity}` : ''} = ${num(Number(i.total))}`
      : `${num(Number(i.unit_value))} x ${i.quantity} = ${num(Number(i.total))}`;
    return [goalName(i.goal_id), i.action, stageLabel(i.stage), i.description, i.gnd, i.unit, String(i.quantity).replace('.', ','),
      i.quotes[0]?.supplier, i.quotes[0] ? num(Number(i.quotes[0].value)) : '', i.quotes[1]?.supplier, i.quotes[1] ? num(Number(i.quotes[1].value)) : '',
      i.quotes[2]?.supplier, i.quotes[2] ? num(Number(i.quotes[2].value)) : '', s ? num(s.menor) : '', s ? num(s.media) : '', s ? num(s.mediana) : '',
      i.stage === 'rh' ? '' : RULES.find((x) => x.key === i.adopted_rule)?.label, num(Number(i.unit_value)), num(Number(i.total)), memo, i.justification, i.start_month, i.end_month];
  });
  return '﻿' + [head, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
}

export const proposalFileName = (p: Proposal, ext: string) => `Projeto-Tecnico_${p.title.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40)}.${ext}`;
