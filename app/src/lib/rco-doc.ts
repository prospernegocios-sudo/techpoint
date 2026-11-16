// RCO – Relatório de Prestação de Contas (modelo anexo SEI 71000.042304/2020-44), em Word.
// Sai quase pronto: identificação, metas com o resultado medido, beneficiários real × previsto,
// combinado × executado por etapa, detalhamento por etapa, despesas e a lista de comprovantes. Os textos o clube completa.
import { AlignmentType, BorderStyle, Document, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { executionSummary, fileKindLabel, missingFiles, type ExecItem, type ExecProject, type Expense, type Transfer } from './execution';
import { brl, rhCost, stageLabel, type Goal, type Proposal } from './proposal';

export type RcoGoalResult = { code: string; result: number | null; reached: boolean | null; unit: string | null; target: number | null };
export type RcoCtx = {
  project: ExecProject; proposal: Proposal; goals: Goal[]; items: ExecItem[]; expenses: Expense[]; transfers: Transfer[];
  goalResults: RcoGoalResult[]; realBeneficiaries: number | null; avgFrequency: number | null;
  org: { name: string; legal_name?: string | null; cnpj?: string | null };
  /** Onda 2: plano de mídia, cursos do COB e folha de ponto (opcionais). */
  media?: { kind: string; description: string | null; link: string | null; taken_on: string | null; file_path: string | null }[];
  cob?: { athletes: { complete: number; total: number }; staff: { complete: number; total: number } };
  points?: { people: number; minutes: number; records: number };
};

export const RCO_TEXTS: { key: string; title: string; hint: string }[] = [
  { key: 'resultados', title: '2.1 Objetivos e metas: comentário geral', hint: 'Como foi o alcance dos objetivos do Projeto Técnico durante a parceria. Cada meta já sai com o resultado medido; aqui vai o comentário.' },
  { key: 'links', title: '2.2 Resultados: links de matérias', hint: 'Um link por linha: matérias, publicações e redes com os resultados do projeto.' },
  { key: 'beneficiarios', title: '2.3 Beneficiários: comentário', hint: 'Se o número real ficou diferente do previsto, explique (entradas, saídas, motivo).' },
  { key: 'ajustes', title: '3. Ajustes do plano de trabalho', hint: 'Mudança de local, objetivos ou metas e remanejamentos aprovados. Itens trocados ou não comprados já saem listados com a justificativa.' },
  { key: 'midia', title: '4. Plano de mídia', hint: 'Meios de divulgação feitos durante o projeto (placas, banners, redes) com a marca do Governo Federal. As fotos vão nos anexos.' },
  { key: 'conclusao', title: '5. Conclusão', hint: 'Benefícios e resultados obtidos com o projeto.' },
];

const FONT = 'Arial';
const r = (t: string, o: { bold?: boolean; size?: number; italic?: boolean; color?: string } = {}) =>
  String(t ?? '').split('\n').map((line, i) => new TextRun({ text: line, font: FONT, size: o.size ?? 21, bold: o.bold, italics: o.italic, color: o.color, break: i ? 1 : 0 }));
const P = (t: string, o: { bold?: boolean; center?: boolean; size?: number; italic?: boolean; before?: number; color?: string } = {}) =>
  new Paragraph({ alignment: o.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED, spacing: { before: o.before ?? 0, after: 140, line: 290 }, children: r(t, o) });
const H = (t: string) => new Paragraph({ spacing: { before: 280, after: 140 }, shading: { fill: 'A6A6A6' }, children: r(t, { bold: true, size: 22 }) });
const PAGE_W = 9638;
const border = { style: BorderStyle.SINGLE, size: 4, color: '777777' };
function T(rows: string[][], o: { header?: boolean; size?: number; widths?: number[] } = {}): Table {
  const n = rows[0]?.length ?? 1;
  const w = o.widths && o.widths.length === n ? o.widths : Array(n).fill(1);
  const sw = w.reduce((a, b) => a + b, 0);
  const cols = w.map((x) => Math.floor((x / sw) * PAGE_W));
  return new Table({
    width: { size: PAGE_W, type: WidthType.DXA }, columnWidths: cols,
    rows: rows.map((row, ri) => new TableRow({
      children: row.map((cell, ci) => new TableCell({
        width: { size: cols[ci], type: WidthType.DXA }, borders: { top: border, bottom: border, left: border, right: border },
        shading: o.header !== false && ri === 0 ? { fill: 'EFEFEF' } : undefined,
        children: [new Paragraph({ children: r(cell || ' ', { bold: o.header !== false && ri === 0, size: o.size ?? 17 }) })],
      })),
    })),
  });
}
const money = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const d = (iso: string | null | undefined) => (iso ? iso.split('-').reverse().join('/') : '');
const fmtDoc = (c?: string | null) => !c ? '' : c.length === 14 ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
const txt = (c: RcoCtx, k: string) => (c.project.rco?.[k] ?? '').trim();

export function buildRcoDoc(c: RcoCtx): Document {
  const sum = executionSummary(c.items, c.expenses, c.transfers);
  const global = Number(c.proposal.mesp_value) + Number(c.proposal.counterpart_value);
  const out: (Paragraph | Table)[] = [];
  const note = (k: string) => { const t = txt(c, k); out.push(t ? P(t) : P('(a preencher)', { italic: true, color: '888888' })); };

  out.push(P('MODELO DE RELATÓRIO DE PRESTAÇÃO DE CONTAS – RCO', { bold: true, center: true, size: 24 }));
  out.push(P('Este documento deve ser anexado junto à aba "Cumprimento do Objeto", da plataforma Transferegov.br.', { center: true, size: 19 }));

  out.push(H('1. IDENTIFICAÇÃO'));
  out.push(T([
    ['Nº CONVÊNIO / Nº TED / OU TERMO DE FOMENTO:', c.project.process_number ?? ''], ['CNPJ:', fmtDoc(c.org.cnpj)],
    ['NOME DA ENTIDADE:', c.org.legal_name || c.org.name], ['OBJETO:', (c.proposal.sections?.objeto ?? c.project.name).trim()],
    ['VIGÊNCIA:', `${d(c.project.starts_on)} a ${d(c.project.ends_on)}`], ['VALOR GLOBAL:', brl(global)],
    ['VALOR DE REPASSE:', brl(Number(c.proposal.mesp_value))], ['CONTRAPARTIDA FINANCEIRA:', brl(Number(c.proposal.counterpart_value))],
  ], { header: false, size: 19, widths: [1.5, 3] }));

  out.push(H('2. RESULTADOS ALCANÇADOS'));
  out.push(P('2.1 Objetivos e metas qualitativas e quantitativas', { bold: true }));
  c.goals.forEach((g, i) => {
    const res = c.goalResults[i];
    const measured = res && res.result != null
      ? `${money(res.result).replace(',00', '')}${res.unit ? ` ${res.unit}` : ''}${res.target != null ? ` (meta: ${res.target}${res.unit ? ` ${res.unit}` : ''}) – ${res.reached ? 'ALCANÇADA' : 'NÃO ALCANÇADA'}` : ''}`
      : g.indicator !== 'manual' ? 'ainda sem treinos registrados no período (medido pelo check-in)' : 'medição manual (preencher)';
    out.push(T([
      [`OBJETIVO ${i + 1} – ${g.objective}`, ''], ['Meta qualitativa:', g.qualitative ?? ''], ['Meta quantitativa:', g.quantitative ?? ''],
      ['Resultado esperado:', g.expected_result ?? ''], ['Resultado alcançado (medido):', measured], ['Forma de aferição:', g.method ?? ''],
    ], { header: true, size: 18, widths: [1.5, 3] }));
    out.push(new Paragraph({ children: [] }));
  });
  note('resultados');
  out.push(P('2.2 Resultados', { bold: true }));
  const links = txt(c, 'links');
  out.push(links ? P(links) : P('(inserir os links das matérias com os resultados do projeto, se houver)', { italic: true, color: '888888' }));
  out.push(P('2.3 Beneficiários', { bold: true }));
  out.push(T([
    ['BENEFICIÁRIOS DIRETOS', 'PREVISTO NO PROJETO TÉCNICO', 'REAL (ATENDIDOS COM PRESENÇA)'],
    ['Atletas', c.project.planned_beneficiaries != null ? String(c.project.planned_beneficiaries) : '', c.realBeneficiaries != null ? String(c.realBeneficiaries) : ''],
  ], { size: 19 }));
  if (c.avgFrequency != null) out.push(P(`Frequência média nos treinos: ${String(c.avgFrequency).replace('.', ',')}% (check-in com localização, foto e hora do servidor).`, { before: 100 }));
  note('beneficiarios');

  out.push(H('3. EXECUÇÃO DAS METAS'));
  out.push(T([
    ['META / ETAPAS', 'VALOR PACTUADO', 'VALOR EXECUTADO'],
    ...sum.byStage.map((s, i) => [`${i + 1}. ${s.label}`, money(s.agreed), money(s.executed)]),
    ['TOTAL', money(sum.agreed), money(sum.executed)],
  ], { size: 19, widths: [3, 1.5, 1.5] }));
  if (sum.changed.length) {
    out.push(P('Itens substituídos ou não adquiridos:', { bold: true, before: 140 }));
    sum.changed.forEach((x) => out.push(P(`• ${x.item.description} – ${x.item.exec_status === 'substituido' ? 'substituído' : 'não adquirido'}: ${(x.item as ExecItem).exec_note ?? ''}`, { size: 19 })));
  }
  note('ajustes');

  out.push(H('3.1 DETALHAMENTO DA EXECUÇÃO DAS METAS'));
  sum.byStage.forEach((s, si) => {
    const xs = sum.byItem.filter((x) => x.item.stage === s.stage);
    out.push(P(`3.1.${si + 1} ETAPA ${si + 1} – ${s.label.toUpperCase()}`, { bold: true, before: 160 }));
    if (s.stage === 'rh') {
      out.push(T([
        ['CARGOS', 'CARGA HORÁRIA', 'QTD.', 'MESES', 'VALOR UNITÁRIO PACTUADO', 'VALOR TOTAL PACTUADO', 'VALOR TOTAL EXECUTADO'],
        ...xs.map((x) => [x.item.rh?.role ?? x.item.description, x.item.rh?.workload ?? '', String(x.item.quantity), String(x.item.rh?.months ?? ''),
          money(x.item.rh?.salary ?? 0), money(Number(x.item.total)), money(x.executed)]),
      ], { size: 16, widths: [2.2, 1.3, 0.7, 0.8, 1.4, 1.4, 1.4] }));
      const clt = xs.filter((x) => x.item.rh?.contract === 'CLT');
      if (clt.length) {
        out.push(P('ENCARGOS DE RECURSOS HUMANOS (INSS patronal 26,5%, FGTS 8%, PIS 1%, 13º e férias proporcionais)', { bold: true, size: 18, before: 120 }));
        out.push(T([
          ['CARGOS', 'QTD.', 'MESES', 'ENCARGOS, 13º E FÉRIAS (PACTUADO)'],
          ...clt.map((x) => { const k = rhCost(x.item.rh!); return [x.item.rh!.role, String(x.item.quantity), String(x.item.rh!.months), money((k.encargos + k.decimo + k.ferias) * (x.item.quantity || 1))]; }),
        ], { size: 16, widths: [2.5, 0.8, 0.8, 2] }));
      }
    } else {
      out.push(T([
        ['ITEM', 'QTD.', 'VALOR UNITÁRIO PACTUADO', 'VALOR TOTAL PACTUADO', 'VALOR TOTAL EXECUTADO'],
        ...xs.map((x) => [`${x.item.description}${(x.item.exec_status ?? 'normal') !== 'normal' ? ` (${x.item.exec_status === 'substituido' ? 'substituído' : 'não adquirido'})` : ''}`,
          `${String(x.item.quantity).replace('.', ',')} ${x.item.unit ?? ''}`.trim(), money(Number(x.item.unit_value)), money(Number(x.item.total)), money(x.executed)]),
      ], { size: 16, widths: [3, 1, 1.4, 1.4, 1.4] }));
    }
    const files = xs.flatMap((x) => x.expenses.flatMap((e) => (e.expense_files ?? []).map((f) => f.kind)));
    const kinds = [...new Set(files)].map(fileKindLabel);
    out.push(P(`Documentos anexados na plataforma Transferegov.br (aba "Prestação de Contas", sub aba "Anexos"): ${kinds.length ? kinds.join(', ') : '(nenhum enviado ainda)'}.`, { size: 18, italic: true, before: 80 }));
    const pend = xs.flatMap((x) => x.expenses.filter((e) => missingFiles(x.item.stage, e.expense_files ?? [], { clt: x.item.rh?.contract === 'CLT' }).length > 0));
    if (pend.length) out.push(P(`Atenção: ${pend.length} despesa(s) desta etapa ainda sem todos os comprovantes.`, { size: 18, color: 'B00020' }));
  });

  out.push(H('RELAÇÃO DE DESPESAS'));
  out.push(T([
    ['DATA', 'FORNECEDOR', 'CNPJ/CPF', 'DOCUMENTO', 'ITEM', 'VALOR', 'PAGO EM'],
    ...c.expenses.map((e) => [d(e.spent_on), e.supplier, fmtDoc(e.supplier_doc), e.doc_number ?? '', c.items.find((i) => i.id === e.item_id)?.description ?? '', money(Number(e.value)), d(e.paid_on)]),
    ['', '', '', '', 'TOTAL', money(sum.executed), ''],
  ], { size: 15, widths: [1, 2, 1.6, 1.1, 2, 1.1, 1] }));
  out.push(P(`Repasses recebidos: ${money(sum.received)} (Ministério: ${money(sum.receivedMesp)}). Pago: ${money(sum.paid)}. Saldo em conta: ${money(sum.inAccount)}.`, { before: 120, size: 19 }));
  out.push(P('Todos os valores em moeda nacional. Pessoa jurídica: nota fiscal acompanhada de recibo. Pessoa física: recibo com valor bruto, descontos (ISS, INSS, IRRF), líquido, RG, CPF e assinatura, com o comprovante de recolhimento dos impostos. Comprovantes sem rasuras.', { italic: true, size: 17 }));

  if (c.points || c.cob) {
    out.push(H('COMPROVAÇÃO DA EXECUÇÃO'));
    if (c.points) out.push(P(`Folha de ponto dos profissionais: ${c.points.people} profissional(is), ${c.points.records} registro(s) de entrada e saída, ${Math.floor(c.points.minutes / 60)}h${String(c.points.minutes % 60).padStart(2, '0')} registradas pelo app (localização, foto e hora do servidor). Folhas em anexo.`));
    if (c.cob) out.push(P(`Cursos obrigatórios do COB ("Esporte Antirracista" e "Combate à Manipulação de Resultados"): ${c.cob.athletes.complete} de ${c.cob.athletes.total} atletas e ${c.cob.staff.complete} de ${c.cob.staff.total} profissionais com os 2 certificados. Certificados em anexo.`));
  }
  out.push(H('4. PLANO DE MÍDIA'));
  if (c.media?.length) {
    out.push(T([
      ['TIPO', 'DESCRIÇÃO', 'DATA', 'COMPROVAÇÃO'],
      ...c.media.map((m) => [m.kind.replace('_', ' '), m.description ?? '', d(m.taken_on), [m.file_path ? 'foto em anexo' : '', m.link ?? ''].filter(Boolean).join(' · ')]),
    ], { size: 17, widths: [1.2, 3, 1, 2.5] }));
    out.push(new Paragraph({ children: [] }));
  }
  note('midia');
  out.push(H('5. CONCLUSÃO'));
  note('conclusao');

  return new Document({
    creator: 'TechPoint', title: `RCO – ${c.project.name}`,
    sections: [{ properties: { page: { margin: { top: 1418, bottom: 1134, left: 1134, right: 1134 } } }, children: out }],
  });
}

export const rcoFileName = (p: ExecProject) => `RCO_${p.name.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40)}.docx`;
