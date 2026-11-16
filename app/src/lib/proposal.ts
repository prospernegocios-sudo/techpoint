// Fase B do incentivo: Projeto Técnico / Plano de Trabalho (Revelar Talentos, modelo do Ministério do Esporte).
// Regras e cálculos (puros, testados) + leitura e gravação. Fonte: docs/incentivo/revelar-talentos.md.
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

// ---------------------------------------------------------------------------------------------
// Eixos e faixas de valor (apresentação da SNE, 2025)
// ---------------------------------------------------------------------------------------------
export type Axis = 'nucleo' | 'competicao' | 'capacitacao';
export const AXES: { key: Axis; label: string; desc: string; min: number; max: number }[] = [
  { key: 'nucleo', label: 'Eixo 1 · Núcleo de treinamento', desc: 'Implantação e desenvolvimento de núcleos de especialização e aperfeiçoamento', min: 400_000, max: 1_000_000 },
  { key: 'competicao', label: 'Eixo 2 · Competições', desc: 'Participação e realização de competições', min: 200_000, max: 5_000_000 },
  { key: 'capacitacao', label: 'Eixo 3 · Capacitação e inovação', desc: 'Eventos científicos e tecnológicos, pesquisa e capacitação', min: 250_000, max: 1_000_000 },
];
export const COUNTERPART_FROM = 1_000_000; // contrapartida exigida acima de R$ 1 milhão (Anexo XIII)
export const MAX_AGE = 21;                  // atletas até 21 anos (Eixo 1)

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function axisCheck(axis: Axis, mespValue: number): { ok: boolean; message: string } {
  const a = AXES.find((x) => x.key === axis)!;
  if (mespValue < a.min) return { ok: false, message: `Abaixo da faixa do ${a.label.split(' · ')[0]} (${brl(a.min)} a ${brl(a.max)}).` };
  if (mespValue > a.max) return { ok: false, message: `Acima da faixa do ${a.label.split(' · ')[0]} (${brl(a.min)} a ${brl(a.max)}).` };
  return { ok: true, message: `Dentro da faixa (${brl(a.min)} a ${brl(a.max)}).` };
}

// ---------------------------------------------------------------------------------------------
// Cotações e valor adotado (decisão do TG: menor, média ou mediana; fora do menor, justificativa)
// ---------------------------------------------------------------------------------------------
export type Quote = { supplier: string; cnpj?: string; value: number };
export type AdoptedRule = 'menor' | 'media' | 'mediana';
export const RULES: { key: AdoptedRule; label: string }[] = [
  { key: 'menor', label: 'Menor preço' }, { key: 'media', label: 'Média' }, { key: 'mediana', label: 'Mediana' },
];
const round2 = (n: number) => Math.round(n * 100) / 100;

export function quoteStats(quotes: Quote[]): { menor: number; media: number; mediana: number } | null {
  const v = quotes.map((q) => Number(q.value)).filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return {
    menor: v[0],
    media: round2(v.reduce((s, x) => s + x, 0) / v.length),
    mediana: v.length % 2 ? v[mid] : round2((v[mid - 1] + v[mid]) / 2),
  };
}
export const adoptedValue = (quotes: Quote[], rule: AdoptedRule) => quoteStats(quotes)?.[rule] ?? 0;

// ---------------------------------------------------------------------------------------------
// Equipe (RH) com encargos de CLT, como no modelo: INSS patronal 26,5%, FGTS 8%, PIS 1%, 13º e férias
// ---------------------------------------------------------------------------------------------
export type Contract = 'CLT' | 'RPA' | 'Bolsa' | 'Consultoria' | 'Outro';
export type RhInfo = { role: string; duties?: string; profile?: string; contract: Contract; workload?: string; months: number; salary: number };
export const ENCARGOS = { inss: 0.265, fgts: 0.08, pis: 0.01 };

export function rhCost(rh: RhInfo) {
  const base = round2(rh.salary * rh.months);
  if (rh.contract !== 'CLT') return { base, decimo: 0, ferias: 0, encargos: 0, total: base };
  const decimo = round2(base / 12);                 // 13º proporcional
  const ferias = round2((base / 12) * (4 / 3));     // férias + 1/3 proporcionais
  const encargos = round2((base + decimo + ferias) * (ENCARGOS.inss + ENCARGOS.fgts + ENCARGOS.pis));
  return { base, decimo, ferias, encargos, total: round2(base + decimo + ferias + encargos) };
}

// ---------------------------------------------------------------------------------------------
// Itens do orçamento (Meta → Ação → Etapa). Etapas = tipos que o RCO detalha na prestação de contas.
// ---------------------------------------------------------------------------------------------
export type Stage = 'rh' | 'material' | 'uniformes' | 'passagens' | 'hospedagem' | 'alimentacao' | 'diarias' | 'transporte' | 'infraestrutura' | 'servicos' | 'equipamentos' | 'outro';
export const STAGES: { key: Stage; label: string; gnd: 3 | 4; hint: string }[] = [
  { key: 'rh', label: 'Recursos humanos', gnd: 3, hint: 'Treinadores, auxiliares, preparador físico, fisioterapeuta, psicólogo. Com cargo, perfil, contrato e carga horária.' },
  { key: 'material', label: 'Material esportivo', gnd: 3, hint: 'Bolas, redes, coletes... quantidade por beneficiário.' },
  { key: 'uniformes', label: 'Uniformes', gnd: 3, hint: 'Camisetas, agasalhos, shorts... quantidade por beneficiário.' },
  { key: 'passagens', label: 'Passagens aéreas', gnd: 3, hint: 'Relação nominal dos beneficiários, trechos e datas.' },
  { key: 'hospedagem', label: 'Hospedagem', gnd: 3, hint: 'Relação nominal e tipo de acomodação (duplo, simples).' },
  { key: 'alimentacao', label: 'Alimentação', gnd: 3, hint: 'Memória de cálculo: refeições por dia × pessoas.' },
  { key: 'diarias', label: 'Diárias', gnd: 3, hint: 'Beneficiários, dias e destino; composição da diária.' },
  { key: 'transporte', label: 'Locação de transporte', gnd: 3, hint: 'Trechos, capacidade do veículo compatível com o número de pessoas.' },
  { key: 'infraestrutura', label: 'Locação de infraestrutura', gnd: 3, hint: 'Espaços e equipamentos alugados.' },
  { key: 'servicos', label: 'Serviços', gnd: 3, hint: 'Arbitragem, segurança, ambulância, comunicação...' },
  { key: 'equipamentos', label: 'Equipamentos permanentes', gnd: 4, hint: 'Bens que duram mais de 2 anos (investimento): defina destino e titularidade.' },
  { key: 'outro', label: 'Outro', gnd: 3, hint: 'Outra despesa compatível com o objeto.' },
];
export const stageLabel = (s: string) => STAGES.find((x) => x.key === s)?.label ?? s;

export type BudgetItem = {
  id: string; proposal_id: string; org_id: string; goal_id: string | null; action: string | null; stage: Stage;
  description: string; gnd: 3 | 4; unit: string | null; quantity: number; quotes: Quote[]; adopted_rule: AdoptedRule;
  justification: string | null; unit_value: number; rh: RhInfo | null; total: number; start_month: number | null;
  end_month: number | null; position: number;
  /** Na execução: item trocado ou não adquirido, com justificativa (RCO). */
  exec_status?: 'normal' | 'substituido' | 'nao_adquirido'; exec_note?: string | null;
};

/** Valor unitário e total de um item (RH usa salário × meses + encargos; os demais, quantidade × valor adotado). */
export function itemValues(i: Pick<BudgetItem, 'stage' | 'quantity' | 'quotes' | 'adopted_rule' | 'rh'>): { unit: number; total: number } {
  if (i.stage === 'rh' && i.rh) {
    const c = rhCost(i.rh);
    return { unit: i.rh.salary, total: round2(c.total * (i.quantity || 1)) };
  }
  const unit = adoptedValue(i.quotes, i.adopted_rule);
  return { unit, total: round2(unit * (i.quantity || 0)) };
}

/** Pendências de um item (o que falta para ficar pronto para o Ministério). */
export function itemIssues(i: BudgetItem): string[] {
  const out: string[] = [];
  if (i.stage === 'rh') {
    if (!i.rh?.role) out.push('cargo');
    if (!i.rh?.salary) out.push('remuneração');
    if (!i.rh?.months) out.push('meses');
  } else {
    const valid = i.quotes.filter((q) => q.supplier?.trim() && Number(q.value) > 0);
    if (valid.length < 3) out.push(`${3 - valid.length} cotação(ões)`);
  }
  if (i.adopted_rule !== 'menor' && (i.justification ?? '').trim().length < 5) out.push('justificativa do valor');
  return out;
}

// ---------------------------------------------------------------------------------------------
// Totais, cronograma e conferências
// ---------------------------------------------------------------------------------------------
export type Parcel = { who: 'concedente' | 'convenente'; month: number; year: number; value: number };
export type ScheduleRow = { action: string; months: number[] };

export function totals(items: BudgetItem[]) {
  const sum = (xs: BudgetItem[]) => round2(xs.reduce((s, i) => s + Number(i.total || 0), 0));
  const byStage = STAGES.map((s) => ({ stage: s.key, label: s.label, total: sum(items.filter((i) => i.stage === s.key)) })).filter((x) => x.total > 0);
  return { total: sum(items), gnd3: sum(items.filter((i) => i.gnd === 3)), gnd4: sum(items.filter((i) => i.gnd === 4)), byStage };
}

/** Gasto mês a mês: cada item é dividido igualmente entre o mês de início e o de fim (sem datas: vigência toda). */
export function monthlySpend(items: BudgetItem[], months: number): number[] {
  const m = Math.max(1, months || 1);
  const out = Array(m).fill(0);
  items.forEach((i) => {
    const a = Math.min(m, Math.max(1, i.start_month ?? 1));
    const b = Math.min(m, Math.max(a, i.end_month ?? m));
    const per = Number(i.total || 0) / (b - a + 1);
    for (let k = a; k <= b; k++) out[k - 1] += per;
  });
  return out.map(round2);
}

export type Proposal = {
  id: string; org_id: string; project_id: string | null; title: string; axis: Axis; instrument: 'fomento' | 'convenio' | 'ted';
  status: 'rascunho' | 'enviada' | 'aprovada' | 'arquivada'; mesp_value: number; counterpart_value: number;
  starts_on: string | null; months: number | null; sections: Record<string, string>; audience: Audience;
  schedule: ScheduleRow[]; disbursement: Parcel[]; created_at: string; updated_at: string;
};
export type Goal = {
  id: string; proposal_id: string; org_id: string; position: number; objective: string; qualitative: string | null;
  quantitative: string | null; expected_result: string | null; method: string | null; period_months: number | null;
  indicator: 'manual' | 'avg_frequency' | 'unique_beneficiaries' | 'attendances'; target: number | null;
};

export type Check = { ok: boolean; level: 'erro' | 'aviso'; text: string };
/** Conferências antes de exportar (somas, faixa do eixo, contrapartida, pendências). */
export function proposalChecks(p: Proposal, goals: Goal[], items: BudgetItem[], aud?: AudienceSummary | null): Check[] {
  const c: Check[] = [];
  const t = totals(items).total;
  const global = round2(Number(p.mesp_value) + Number(p.counterpart_value));
  const ax = axisCheck(p.axis, Number(p.mesp_value));
  c.push({ ok: ax.ok, level: 'aviso', text: `Valor pedido ao Ministério: ${brl(Number(p.mesp_value))}. ${ax.message}` });
  if (global > COUNTERPART_FROM) c.push({ ok: Number(p.counterpart_value) > 0, level: 'aviso', text: `Projeto acima de ${brl(COUNTERPART_FROM)}: informe a contrapartida (Anexo XIII).` });
  c.push({ ok: Math.abs(t - global) < 0.01, level: 'erro', text: `Orçamento (${brl(t)}) igual ao valor do projeto (${brl(global)}: Ministério + contrapartida).` });
  const parcels = round2(p.disbursement.reduce((s, x) => s + Number(x.value || 0), 0));
  c.push({ ok: Math.abs(parcels - global) < 0.01, level: 'erro', text: `Parcelas do desembolso (${brl(parcels)}) somam o valor do projeto.` });
  c.push({ ok: Boolean(p.starts_on && p.months), level: 'erro', text: 'Vigência informada (início e número de meses; até 3 anos no Termo de Fomento).' });
  c.push({ ok: !p.months || p.instrument !== 'fomento' || p.months <= 36, level: 'erro', text: 'Vigência do Termo de Fomento de até 36 meses.' });
  c.push({ ok: goals.length > 0, level: 'erro', text: 'Pelo menos um objetivo específico com metas.' });
  const incompleteGoals = goals.filter((g) => !g.qualitative || !g.quantitative || !g.expected_result || !g.method || !g.period_months).length;
  c.push({ ok: incompleteGoals === 0, level: 'aviso', text: incompleteGoals ? `${incompleteGoals} meta(s) sem todos os campos (qualitativa, quantitativa, resultado, aferição, período).` : 'Metas completas.' });
  const pend = items.filter((i) => itemIssues(i).length).length;
  c.push({ ok: pend === 0, level: 'aviso', text: pend ? `${pend} item(ns) do orçamento com pendência (cotações, justificativa ou dados da equipe).` : 'Itens do orçamento completos (3 cotações cada).' });
  c.push({ ok: Boolean((p.sections.objeto ?? '').trim()), level: 'erro', text: 'Objeto da proposta em uma frase.' });
  if (aud) c.push({ ok: aud.overAge === 0, level: 'aviso', text: aud.overAge ? `${aud.overAge} atleta(s) com mais de ${MAX_AGE} anos no início: o Eixo 1 atende atletas até ${MAX_AGE}.` : `Todos os atletas com até ${MAX_AGE} anos no início.` });
  return c;
}

// ---------------------------------------------------------------------------------------------
// Público-alvo e indicadores (os mesmos números do painel do Ministério)
// ---------------------------------------------------------------------------------------------
export type Phase = 'especializacao' | 'aperfeicoamento';
export type Audience = { teams?: { team_id: string; phase: Phase }[]; comissao?: number; staff?: number; indirect?: number; selection?: string };
export type AthleteLite = { id: string; sex: 'M' | 'F' | null; birth_date: string | null; team_ids: string[] };
export const AGE_BANDS = [{ label: 'Até 12', max: 12 }, { label: '13 a 15', max: 15 }, { label: '16 a 18', max: 18 }, { label: '19 a 21', max: 21 }, { label: '22 ou mais', max: 999 }];

export function ageAt(birth: string, on: Date): number {
  const b = new Date(birth + 'T12:00:00');
  let a = on.getFullYear() - b.getFullYear();
  if (on.getMonth() < b.getMonth() || (on.getMonth() === b.getMonth() && on.getDate() < b.getDate())) a--;
  return a;
}

export type AudienceSummary = {
  rows: { phase: Phase; M: number; F: number; other: number }[]; athletes: number; men: number; women: number; noSex: number;
  ages: { label: string; n: number }[]; overAge: number; comissao: number; staff: number; total: number; indirect: number;
};

/** Quadro do público-alvo: atletas das equipes escolhidas, por fase e sexo, faixas de idade no início da vigência. */
export function summarizeAudience(aud: Audience, athletes: AthleteLite[], startsOn: Date): AudienceSummary {
  const phaseOf = new Map((aud.teams ?? []).map((t) => [t.team_id, t.phase]));
  const chosen = athletes.filter((a) => a.team_ids.some((t) => phaseOf.has(t)));
  const rows = (['especializacao', 'aperfeicoamento'] as Phase[]).map((phase) => {
    const xs = chosen.filter((a) => a.team_ids.some((t) => phaseOf.get(t) === phase) && !(phase === 'especializacao' && a.team_ids.some((t) => phaseOf.get(t) === 'aperfeicoamento')));
    return { phase, M: xs.filter((a) => a.sex === 'M').length, F: xs.filter((a) => a.sex === 'F').length, other: xs.filter((a) => !a.sex).length };
  });
  const ages = AGE_BANDS.map((b) => ({ label: b.label, n: 0 }));
  let overAge = 0;
  chosen.forEach((a) => {
    if (!a.birth_date) return;
    const age = ageAt(a.birth_date, startsOn);
    if (age > MAX_AGE) overAge++;
    ages[AGE_BANDS.findIndex((b) => age <= b.max)].n++;
  });
  const comissao = aud.comissao ?? 0, staff = aud.staff ?? 0;
  return {
    rows, athletes: chosen.length, men: chosen.filter((a) => a.sex === 'M').length, women: chosen.filter((a) => a.sex === 'F').length,
    noSex: chosen.filter((a) => !a.sex).length, ages, overAge, comissao, staff, total: chosen.length + comissao + staff, indirect: aud.indirect ?? 0,
  };
}

// ---------------------------------------------------------------------------------------------
// Seções de texto do modelo (com o que o Ministério pede em cada uma)
// ---------------------------------------------------------------------------------------------
export const SECTIONS: { key: string; title: string; hint: string; oneLine?: boolean; preset?: string }[] = [
  { key: 'objeto', title: 'Objeto da proposta', oneLine: true, hint: 'Uma frase só, com o que será entregue. Ex.: Implantação e desenvolvimento de núcleo de treinamento esportivo de base – Programa Revelar Talentos: Especialização e Aperfeiçoamento – na modalidade vôlei, em Brasília/DF, no espaço esportivo X.' },
  { key: 'introducao', title: '1. Introdução', hint: 'Problema a resolver e relevância social; interesse recíproco com o Revelar Talentos; origem do recurso (emenda parlamentar, chamada pública...); cenário da entidade; capacidade de gestão (logística, infraestrutura, gestão financeira, governança, transparência); modalidade (olímpica, ranking); resultados anteriores e onde quer chegar; materiais disponíveis; tipo de projeto (núcleo, camping, intercâmbio).' },
  { key: 'selecao', title: '3. Público-alvo: forma de seleção', hint: 'Como os beneficiados são escolhidos (ranking, indicação de clubes, peneira), beneficiários indiretos e, se quiser, fotos.' },
  { key: 'objetivo_geral', title: '4. Objetivo geral', hint: 'O quê se pretende realizar, como e para quê. Ex.: preparar atletas de base de vôlei, por meio de treinos sistemáticos e competições, para renovar a seleção do DF.' },
  { key: 'infraestrutura', title: '7. Infraestrutura', hint: 'Espaço (ginásio, quadra, CT), capacidade, apoio (vestiário, banheiros, sala médica, academia), acessibilidade, fotos e documento que comprova o uso (cessão, escritura ou cooperação).' },
  { key: 'metodologia', title: '8. Metodologia', hint: 'Recursos humanos, materiais e tecnológicos; carga horária dos treinos; forma de contratação (CLT, RPA, bolsa); parcerias e chancelas (federação, confederação); comissão técnica; gestão financeira (pesquisa de preços); meios de fiscalização e avaliação da execução física e financeira; matriz de responsabilidades (ação × responsável × prazo).' },
  { key: 'justificativa', title: '10. Justificativa', hint: 'Problema e solução; adequação às diretrizes do programa; impacto (mercado de trabalho, economia local, pós-carreira, formação de profissionais, equipe multidisciplinar); relevância para a excelência esportiva; abrangência e legado. Caracterize o interesse recíproco entre a entidade e o Ministério.' },
  { key: 'receitas', title: '12. Previsão de receitas', hint: 'Outras fontes (patrocínio, recursos próprios) e para que serão usadas. Despesa paga por mais de uma fonte precisa da memória de cálculo do rateio; é proibido pagar a mesma parcela com duas fontes.' },
  { key: 'comunicacao', title: '16. Estratégias de comunicação', hint: 'Placas, banners, redes sociais e mídia, com período e quantidade, seguindo os manuais de identidade visual do Governo Federal e do Revelar Talentos.' },
  { key: 'monitoramento', title: '17. Monitoramento e avaliação', preset: 'Controle de frequência e evasão dos atletas por check-in com localização (GPS), foto e hora do servidor, com relatórios de frequência mensais; avaliação das metas em reuniões técnicas; relatórios técnicos periódicos dos profissionais.', hint: 'Procedimentos de monitoramento, relatórios (mensais, trimestrais...), controle de metas, auditorias e controle de frequência e evasão dos atletas.' },
  { key: 'complementares', title: '18. Informações complementares', preset: 'Todos os beneficiários (atletas, treinadores, gestores e equipe) farão os cursos do COB "Esporte Antirracista: Todo Mundo Sai Ganhando" e "Combate à Manipulação de Resultados: Juntos em defesa do jogo responsável" (EAD, 5 horas cada), com os certificados apresentados no acompanhamento e na prestação de contas.', hint: 'Cobrança de inscrição; atuação em rede; destino dos bens; parcerias; práticas de sustentabilidade; os 2 cursos obrigatórios do COB; plano de ação para intercorrências com atletas.' },
  { key: 'capacidade', title: '19. Capacidade técnica da entidade', hint: 'Histórico e estrutura da entidade; no mínimo 1 ano de experiência no objeto ou semelhante (projetos, relatórios, publicações, currículos, prêmios, declarações).' },
  { key: 'resultados', title: '20. Resultados esperados / conclusão', hint: 'Benefícios esperados e resultados esportivos (estaduais, regionais, nacionais, rankings...). Termine pedindo o apoio do Ministério.' },
  { key: 'transversais', title: '21. Ações transversais', hint: 'Direitos humanos (gênero, diversidade, antirracismo); sustentabilidade; canais seguros de escuta e denúncia; clima e igualdade racial; combate à manipulação de resultados.' },
];

// ---------------------------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------------------------
export function useProposals(orgId: string | undefined) {
  return useQuery({
    queryKey: ['proposals', orgId], enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase.from('tech_proposals').select('*').eq('org_id', orgId!).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Proposal[];
    },
  });
}

export function useProposal(id: string | undefined) {
  return useQuery({
    queryKey: ['proposal', id], enabled: Boolean(id),
    queryFn: async () => {
      const [p, g, i] = await Promise.all([
        supabase.from('tech_proposals').select('*').eq('id', id!).single(),
        supabase.from('proposal_goals').select('*').eq('proposal_id', id!).order('position'),
        supabase.from('proposal_budget_items').select('*').eq('proposal_id', id!).order('position'),
      ]);
      if (p.error) throw p.error;
      return { p: p.data as Proposal, goals: (g.data ?? []) as Goal[], items: ((i.data ?? []) as BudgetItem[]).map((x) => ({ ...x, quantity: Number(x.quantity), unit_value: Number(x.unit_value), total: Number(x.total) })) };
    },
  });
}

/** Atletas da entidade com sexo, nascimento e equipes (para o público-alvo). */
export function useOrgAthletes(orgId: string | undefined) {
  return useQuery({
    queryKey: ['proposal-athletes', orgId], enabled: Boolean(orgId),
    queryFn: async () => {
      const [a, t] = await Promise.all([
        supabase.from('athletes').select('id, sex, birth_date, status, team_members(team_id)').eq('org_id', orgId!),
        supabase.from('teams').select('id, name').eq('org_id', orgId!).order('name'),
      ]);
      if (a.error) throw a.error;
      type Row = { id: string; sex: 'M' | 'F' | null; birth_date: string | null; status: string; team_members: { team_id: string }[] };
      const athletes: AthleteLite[] = ((a.data ?? []) as Row[]).filter((r) => r.status !== 'inactive')
        .map((r) => ({ id: r.id, sex: r.sex, birth_date: r.birth_date, team_ids: (r.team_members ?? []).map((m) => m.team_id) }));
      return { athletes, teams: (t.data ?? []) as { id: string; name: string }[] };
    },
  });
}

export async function createProposal(orgId: string, title: string, axis: Axis) {
  const sections: Record<string, string> = {};
  SECTIONS.forEach((s) => { if (s.preset) sections[s.key] = s.preset; });
  const { data, error } = await supabase.from('tech_proposals').insert({ org_id: orgId, title, axis, sections, months: 14 }).select('id').single();
  if (error) throw error;
  return data.id as string;
}
export async function updateProposal(id: string, patch: Partial<Proposal>) {
  const { error } = await supabase.from('tech_proposals').update(patch).eq('id', id);
  if (error) throw error;
}
export async function deleteProposal(id: string) {
  const { error } = await supabase.from('tech_proposals').delete().eq('id', id);
  if (error) throw error;
}
export async function saveGoal(g: Partial<Goal> & { proposal_id: string; org_id: string }) {
  const { id, ...rest } = g;
  const q = id ? supabase.from('proposal_goals').update(rest).eq('id', id) : supabase.from('proposal_goals').insert(rest);
  const { error } = await q;
  if (error) throw error;
}
export async function deleteGoal(id: string) {
  const { error } = await supabase.from('proposal_goals').delete().eq('id', id);
  if (error) throw error;
}
export async function saveItem(i: Partial<BudgetItem> & { proposal_id: string; org_id: string; stage: Stage }) {
  const v = itemValues({ stage: i.stage, quantity: Number(i.quantity ?? 1), quotes: i.quotes ?? [], adopted_rule: i.adopted_rule ?? 'menor', rh: i.rh ?? null });
  const { id, ...rest } = { ...i, unit_value: v.unit, total: v.total };
  const q = id ? supabase.from('proposal_budget_items').update(rest).eq('id', id) : supabase.from('proposal_budget_items').insert(rest);
  const { error } = await q;
  if (error) throw error;
}
export async function deleteItem(id: string) {
  const { error } = await supabase.from('proposal_budget_items').delete().eq('id', id);
  if (error) throw error;
}
