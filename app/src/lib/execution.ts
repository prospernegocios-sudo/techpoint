// Fase C do incentivo (onda 1): execução do projeto aprovado e prestação de contas (RCO).
// O orçamento aprovado é o valor combinado (pactuado); as despesas são o valor executado.
import { useQuery } from '@tanstack/react-query';
import { Linking, Platform } from 'react-native';
import type { PickedFile } from './documents';
import { reducePicked } from './image-reduce';
import { ORG_DOCS_BUCKET } from './habilitation';
import { STAGES, type BudgetItem, type Goal, type Proposal, type Stage } from './proposal';
import { supabase } from './supabase';

export type Transfer = { id: string; project_id: string; source: 'concedente' | 'convenente'; received_on: string; value: number; note: string | null };
export type ExpenseFile = { id: string; expense_id: string; kind: FileKind; file_path: string; mime_type: string; size_bytes: number; created_at: string };
export type Expense = {
  id: string; org_id: string; project_id: string; item_id: string; description: string | null; supplier: string; supplier_doc: string | null;
  doc_number: string | null; quantity: number | null; value: number; spent_on: string; paid_on: string | null;
  payment_method: 'transferencia' | 'outro'; note: string | null; created_at: string; expense_files: ExpenseFile[];
};
export type FileKind = 'nota' | 'recibo' | 'pagamento' | 'cotacao' | 'foto' | 'lista' | 'embarque' | 'encargos' | 'contrato' | 'outro';
export const FILE_KINDS: { key: FileKind; label: string }[] = [
  { key: 'nota', label: 'Nota fiscal' }, { key: 'recibo', label: 'Recibo' }, { key: 'pagamento', label: 'Comprovante de pagamento' },
  { key: 'cotacao', label: 'Cotação da compra' }, { key: 'foto', label: 'Foto (item em uso, local)' }, { key: 'lista', label: 'Lista de beneficiários' },
  { key: 'embarque', label: 'Cartão de embarque' }, { key: 'encargos', label: 'Guia de encargos' }, { key: 'contrato', label: 'Contrato' }, { key: 'outro', label: 'Outro' },
];
export const fileKindLabel = (k: string) => FILE_KINDS.find((x) => x.key === k)?.label ?? k;

/** Comprovantes que o RCO pede para cada tipo de despesa (modelo da SNE). "nota" aceita nota OU recibo. */
export function requiredFiles(stage: Stage, opts: { clt?: boolean } = {}): { kind: FileKind | 'nota_ou_recibo'; label: string; min?: number }[] {
  const base: { kind: FileKind | 'nota_ou_recibo'; label: string; min?: number }[] = [
    { kind: 'nota_ou_recibo', label: 'Nota fiscal ou recibo' },
    { kind: 'pagamento', label: 'Comprovante de pagamento (transferência)' },
  ];
  const quotes = { kind: 'cotacao' as const, label: '3 cotações feitas na hora da compra', min: 3 };
  switch (stage) {
    case 'rh': return [{ kind: 'recibo', label: 'Recibo (bruto, descontos, líquido, RG, CPF e assinatura) ou folha' }, base[1], ...(opts.clt ? [{ kind: 'encargos' as const, label: 'Guias de recolhimento dos encargos' }] : [])];
    case 'material': case 'uniformes': case 'equipamentos': return [...base, quotes, { kind: 'foto', label: 'Fotos dos itens em uso pelos atletas' }];
    case 'passagens': return [...base, quotes, { kind: 'lista', label: 'Lista de beneficiários com trechos' }, { kind: 'embarque', label: 'Cartões de embarque' }];
    case 'hospedagem': return [...base, quotes, { kind: 'lista', label: 'Lista de hóspedes (nome, CPF e telefone)' }];
    case 'diarias': return [{ kind: 'recibo', label: 'Recibo com a composição da diária' }, base[1]];
    case 'transporte': return [...base, quotes, { kind: 'lista', label: 'Lista com trechos e beneficiários' }, { kind: 'foto', label: 'Fotos' }];
    case 'infraestrutura': return [...base, quotes, { kind: 'foto', label: 'Fotos dos equipamentos/espaço' }];
    default: return [...base, quotes];
  }
}

/** O que falta anexar numa despesa. */
export function missingFiles(stage: Stage, files: Pick<ExpenseFile, 'kind'>[], opts: { clt?: boolean } = {}): string[] {
  const count = (k: FileKind) => files.filter((f) => f.kind === k).length;
  return requiredFiles(stage, opts).filter((r) => {
    if (r.kind === 'nota_ou_recibo') return count('nota') + count('recibo') === 0;
    return count(r.kind) < (r.min ?? 1);
  }).map((r) => r.label);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export type ItemExec = { item: BudgetItem; expenses: Expense[]; executed: number; balance: number; pct: number; over: boolean; pendingDocs: number };
export type StageExec = { stage: Stage; label: string; agreed: number; executed: number };

/** Combinado × executado por item e por etapa, saldo, estouros e comprovantes que faltam. */
export function executionSummary(items: BudgetItem[], expenses: Expense[], transfers: Transfer[]) {
  const byItem: ItemExec[] = items.map((item) => {
    const xs = expenses.filter((e) => e.item_id === item.id);
    const executed = round2(xs.reduce((s, e) => s + Number(e.value), 0));
    const agreed = Number(item.total);
    const pendingDocs = xs.filter((e) => missingFiles(item.stage, e.expense_files ?? [], { clt: item.rh?.contract === 'CLT' }).length > 0).length;
    return { item, expenses: xs, executed, balance: round2(agreed - executed), pct: agreed ? Math.round((executed / agreed) * 100) : 0, over: executed > agreed + 0.005, pendingDocs };
  });
  const byStage: StageExec[] = STAGES.map((s) => ({
    stage: s.key, label: s.label,
    agreed: round2(byItem.filter((x) => x.item.stage === s.key).reduce((a, x) => a + Number(x.item.total), 0)),
    executed: round2(byItem.filter((x) => x.item.stage === s.key).reduce((a, x) => a + x.executed, 0)),
  })).filter((x) => x.agreed > 0 || x.executed > 0);
  const agreed = round2(items.reduce((s, i) => s + Number(i.total), 0));
  const executed = round2(expenses.reduce((s, e) => s + Number(e.value), 0));
  const paid = round2(expenses.filter((e) => e.paid_on).reduce((s, e) => s + Number(e.value), 0));
  const received = round2(transfers.reduce((s, t) => s + Number(t.value), 0));
  const receivedMesp = round2(transfers.filter((t) => t.source === 'concedente').reduce((s, t) => s + Number(t.value), 0));
  return {
    byItem, byStage, agreed, executed, paid, received, receivedMesp, inAccount: round2(received - paid),
    pct: agreed ? Math.round((executed / agreed) * 100) : 0,
    over: byItem.filter((x) => x.over).length, pendingDocs: byItem.reduce((s, x) => s + x.pendingDocs, 0),
    changed: byItem.filter((x) => (x.item.exec_status ?? 'normal') !== 'normal'),
  };
}

// ---------------------------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------------------------
export type ExecItem = BudgetItem & { exec_status: 'normal' | 'substituido' | 'nao_adquirido'; exec_note: string | null };
export type ExecProject = {
  id: string; org_id: string; name: string; process_number: string | null; starts_on: string; ends_on: string; signed_on: string | null;
  proposal_id: string | null; planned_beneficiaries: number | null; rco: Record<string, string>; status: string;
};

export function useExecution(projectId: string | undefined) {
  return useQuery({
    queryKey: ['execution', projectId], enabled: Boolean(projectId),
    queryFn: async () => {
      const pr = await supabase.from('projects').select('id, org_id, name, process_number, starts_on, ends_on, signed_on, proposal_id, planned_beneficiaries, rco, status').eq('id', projectId!).single();
      if (pr.error) throw pr.error;
      const project = pr.data as ExecProject;
      if (!project.proposal_id) return { project, proposal: null, goals: [] as Goal[], items: [] as ExecItem[], expenses: [] as Expense[], transfers: [] as Transfer[] };
      const [p, g, i, e, t] = await Promise.all([
        supabase.from('tech_proposals').select('*').eq('id', project.proposal_id).single(),
        supabase.from('proposal_goals').select('*').eq('proposal_id', project.proposal_id).order('position'),
        supabase.from('proposal_budget_items').select('*').eq('proposal_id', project.proposal_id).order('position'),
        supabase.from('project_expenses').select('*, expense_files(id, expense_id, kind, file_path, mime_type, size_bytes, created_at)').eq('project_id', projectId!).order('spent_on'),
        supabase.from('project_transfers').select('*').eq('project_id', projectId!).order('received_on'),
      ]);
      if (p.error) throw p.error;
      const num = <T extends Record<string, unknown>>(x: T, keys: string[]) => ({ ...x, ...Object.fromEntries(keys.map((k) => [k, Number(x[k] ?? 0)])) });
      return {
        project, proposal: p.data as Proposal, goals: (g.data ?? []) as Goal[],
        items: ((i.data ?? []) as ExecItem[]).map((x) => num(x, ['quantity', 'unit_value', 'total']) as ExecItem),
        expenses: ((e.data ?? []) as Expense[]).map((x) => num(x, ['value']) as Expense),
        transfers: ((t.data ?? []) as Transfer[]).map((x) => num(x, ['value']) as Transfer),
      };
    },
  });
}

export async function approveProposal(proposalId: string, agreement: string, signedOn: string) {
  const { data, error } = await supabase.rpc('approve_proposal', { p_proposal: proposalId, p_agreement: agreement, p_signed_on: signedOn });
  if (error) throw error;
  return data as string;
}
export async function addTransfer(t: Omit<Transfer, 'id'> & { org_id: string }) {
  const { error } = await supabase.from('project_transfers').insert(t);
  if (error) throw error;
}
export async function deleteTransfer(id: string) {
  const { error } = await supabase.from('project_transfers').delete().eq('id', id);
  if (error) throw error;
}
export async function saveExpense(e: Partial<Expense> & { org_id: string; project_id: string; item_id: string }) {
  const { id, expense_files: _f, ...rest } = e;
  const q = id ? supabase.from('project_expenses').update(rest).eq('id', id).select('id').single() : supabase.from('project_expenses').insert(rest).select('id').single();
  const { data, error } = await q;
  if (error) throw error;
  return (data as { id: string }).id;
}
export async function deleteExpense(e: Expense) {
  const paths = (e.expense_files ?? []).map((f) => f.file_path);
  const { error } = await supabase.from('project_expenses').delete().eq('id', e.id);
  if (error) throw error;
  if (paths.length) await supabase.storage.from(ORG_DOCS_BUCKET).remove(paths);
}
export async function setItemExecution(itemId: string, status: ExecItem['exec_status'], note: string) {
  const { error } = await supabase.rpc('set_item_execution', { p_item: itemId, p_status: status, p_note: note });
  if (error) throw error;
}
export async function saveRcoTexts(projectId: string, rco: Record<string, string>) {
  const { error } = await supabase.from('projects').update({ rco }).eq('id', projectId);
  if (error) throw error;
}

/** Envia um comprovante (fotos reduzidas antes) para a pasta <entidade>/execucao/. */
export async function uploadExpenseFile(p: { orgId: string; expenseId: string; uploaderId: string; kind: FileKind; picked: PickedFile }) {
  const r = await reducePicked(p.picked);
  const ext = r.mime === 'application/pdf' ? 'pdf' : r.mime === 'image/png' ? 'png' : 'jpg';
  const path = `${p.orgId}/execucao/${p.expenseId}-${p.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from(ORG_DOCS_BUCKET).upload(path, r.body, { contentType: r.mime, upsert: false });
  if (upErr) throw upErr;
  const { error } = await supabase.from('expense_files').insert({
    org_id: p.orgId, expense_id: p.expenseId, kind: p.kind, file_path: path, mime_type: r.mime, size_bytes: Math.max(1, r.size), uploaded_by: p.uploaderId,
  });
  if (error) { await supabase.storage.from(ORG_DOCS_BUCKET).remove([path]); throw error; }
}
export async function deleteExpenseFile(f: ExpenseFile) {
  const { error } = await supabase.from('expense_files').delete().eq('id', f.id);
  if (error) throw error;
  await supabase.storage.from(ORG_DOCS_BUCKET).remove([f.file_path]);
}
export async function openExpenseFile(f: ExpenseFile) {
  const { data, error } = await supabase.storage.from(ORG_DOCS_BUCKET).createSignedUrl(f.file_path, 120);
  if (error || !data?.signedUrl) throw error ?? new Error('Não foi possível abrir o arquivo.');
  if (Platform.OS === 'web') window.open(data.signedUrl, '_blank', 'noopener');
  else await Linking.openURL(data.signedUrl);
}
