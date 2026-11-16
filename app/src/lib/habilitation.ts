// Fase A do incentivo: "Clube apto" (Revelar Talentos / Termo de Fomento).
// Catálogo do checklist do Ministério do Esporte (SNE/MEsp) e as regras de situação de cada item.
// Fonte: docs/incentivo/revelar-talentos.md. Regras automáticas são avisos; a análise oficial é do Ministério.
import { useQuery } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { Linking, Platform } from 'react-native';
import type { PickedFile } from './documents';
import { supabase } from './supabase';

export const ORG_DOCS_BUCKET = 'org-docs';

export type HabilSection = 'cadastro' | 'certidoes' | 'declaracoes';
export type HabilItem = {
  code: string;
  section: HabilSection;
  title: string;
  hint: string;
  /** doc: precisa de arquivo · confirm: basta confirmar que foi feito (arquivo opcional). */
  kind: 'doc' | 'confirm';
  /** Certidão com prazo de validade: exige a data "válida até". */
  expires?: boolean;
  /** Comprovante que só vale se emitido há no máximo N dias. */
  maxAgeDays?: number;
  /** Item que pode não se aplicar ao clube (ex.: só com emenda parlamentar). */
  conditional?: string;
  /** Declaração gerada pelo app (Anexo do Ministério). */
  annex?: string;
};

export const HABIL_SECTIONS: { key: HabilSection; title: string }[] = [
  { key: 'cadastro', title: 'Cadastro e documentos da entidade' },
  { key: 'certidoes', title: 'Certidões (têm validade)' },
  { key: 'declaracoes', title: 'Declarações assinadas' },
];

export const HABIL_ITEMS: HabilItem[] = [
  { code: '1.1', section: 'cadastro', kind: 'confirm', title: 'Cadastro no Transferegov.br atualizado', hint: 'Mantenha o cadastro da entidade atualizado na celebração e durante a execução.' },
  { code: '1.2', section: 'cadastro', kind: 'doc', title: 'Cartão CNPJ', hint: 'Comprovante de inscrição emitido pela Receita Federal. A entidade precisa de no mínimo 3 anos de CNPJ ativo.' },
  { code: '1.3', section: 'cadastro', kind: 'doc', title: 'Estatuto social registrado', hint: 'Com as alterações. Confira se tem: finalidade de relevância pública e social; destino do patrimônio em caso de dissolução para entidade de mesma natureza; escrituração contábil conforme as Normas Brasileiras de Contabilidade.' },
  { code: '1.4', section: 'cadastro', kind: 'doc', title: 'Certificação de Registro Cadastral do Ministério do Esporte', hint: 'Comprova os requisitos dos arts. 18 e 18-A da Lei 9.615/1998 e do art. 36 da Lei 14.597/2023.' },
  { code: '1.5', section: 'cadastro', kind: 'doc', title: 'Ata de eleição da diretoria atual', hint: 'Cópia registrada da ata que elegeu o quadro dirigente atual.' },
  { code: '1.6', section: 'cadastro', kind: 'doc', title: 'Documento de identidade do dirigente', hint: 'RG ou CNH com CPF e foto do dirigente que assina pela entidade.' },
  { code: '1.7', section: 'cadastro', kind: 'doc', maxAgeDays: 90, title: 'Comprovante de residência do dirigente', hint: 'Conta de luz ou água dos últimos 3 meses, ou contrato de locação vigente.' },
  { code: '1.8', section: 'cadastro', kind: 'doc', maxAgeDays: 90, title: 'Comprovante de endereço da entidade', hint: 'Conta de luz ou água dos últimos 3 meses, ou contrato de locação vigente, no endereço declarado.' },
  { code: '1.9', section: 'cadastro', kind: 'doc', annex: 'II', title: 'Atestado de capacidade técnica (mínimo 1 ano de experiência)', hint: 'Anexo II assinado, com o histórico: fotos, matérias e cópias de contratos ou termos de projetos anteriores.' },
  { code: '1.10', section: 'cadastro', kind: 'doc', title: 'Filiação ao COB (ou à federação internacional)', hint: 'Entidades não vinculadas ao COB apresentam a filiação à federação internacional da modalidade.' },
  { code: '1.11', section: 'cadastro', kind: 'confirm', title: 'Cadastro de usuário externo no SEI do Ministério', hint: 'Cadastro no Sistema Eletrônico de Informações do Ministério do Esporte.' },
  { code: '2.6', section: 'cadastro', kind: 'doc', annex: 'III', title: 'Espaço físico: propriedade, cessão ou locação', hint: 'Escritura, termo de cessão de uso ou contrato de locação, mais a declaração do Anexo III. Em eventos, inclua o leiaute.' },

  { code: '4.1', section: 'certidoes', kind: 'doc', expires: true, title: 'Certidão de débitos federais e Dívida Ativa da União', hint: 'Certidão da Receita Federal e PGFN, ou extrato do CAUC.' },
  { code: '4.2', section: 'certidoes', kind: 'doc', expires: true, title: 'Certificado de regularidade do FGTS (CRF)', hint: 'Emitido pela Caixa, ou extrato do CAUC.' },
  { code: '4.3', section: 'certidoes', kind: 'doc', expires: true, title: 'Certidão negativa de débitos trabalhistas (CNDT)', hint: 'Emitida pelo Tribunal Superior do Trabalho.' },
  { code: '4.4', section: 'certidoes', kind: 'doc', title: 'Consulta ao CEPIM', hint: 'Cadastro de Entidades Privadas Sem Fins Lucrativos Impedidas, no Portal da Transparência. Faça perto da data de envio.' },
  { code: '4.5', section: 'certidoes', kind: 'doc', title: 'Consulta ao CEIS', hint: 'Cadastro de Empresas Inidôneas e Suspensas, no Portal da Transparência. Faça perto da data de envio.' },
  { code: '4.6', section: 'certidoes', kind: 'doc', title: 'Extrato do CAUC (sem ocorrência impeditiva)', hint: 'Extrato do CAUC pelo Siconfi.' },
  { code: '4.7', section: 'certidoes', kind: 'doc', expires: true, title: 'Certidão do CNJ (improbidade e inelegibilidade)', hint: 'Cadastro Nacional de Condenações Cíveis por Ato de Improbidade Administrativa e Inelegibilidade.' },
  { code: '4.8', section: 'certidoes', kind: 'doc', expires: true, title: 'Regularidade no CADIN', hint: 'Extrato do CAUC ou certidão do CADIN com validade ativa.' },
  { code: '4.9', section: 'certidoes', kind: 'doc', title: 'Prestação de contas de recursos federais em dia', hint: 'Extrato do CAUC ou consulta ao SIAFI.' },

  { code: '4.10', section: 'declaracoes', kind: 'doc', annex: 'IV', title: 'Não ocorrência de impedimentos (art. 39 da Lei 13.019)', hint: 'Anexo IV assinado.' },
  { code: '4.11', section: 'declaracoes', kind: 'doc', annex: 'V', title: 'Instalações e condições materiais', hint: 'Anexo V assinado.' },
  { code: '4.12', section: 'declaracoes', kind: 'doc', annex: 'VI', title: 'Não uso dos recursos para finalidade alheia', hint: 'Anexo VI assinado.' },
  { code: '4.13', section: 'declaracoes', kind: 'doc', annex: 'VII', title: 'Art. 27 do Decreto 8.726 (parentesco com agentes públicos)', hint: 'Anexo VII assinado.' },
  { code: '4.14', section: 'declaracoes', kind: 'doc', annex: 'VIII', title: 'Acessibilidade', hint: 'Anexo VIII assinado.' },
  { code: '4.15', section: 'declaracoes', kind: 'doc', annex: 'IX', title: 'Relação atualizada dos dirigentes', hint: 'Anexo IX assinado, gerado com os dirigentes cadastrados aqui.' },
  { code: '4.16', section: 'declaracoes', kind: 'doc', title: 'Currículos dos dirigentes', hint: 'Currículo profissional de cada dirigente da entidade.' },
  { code: '4.17', section: 'declaracoes', kind: 'doc', annex: 'X', title: 'Não recebe recursos para a mesma finalidade', hint: 'Anexo X assinado.' },
  { code: '4.18', section: 'declaracoes', kind: 'doc', annex: 'XI', title: 'Não contratação de empresas relacionadas', hint: 'Anexo XI assinado.' },
  { code: '4.19', section: 'declaracoes', kind: 'doc', annex: 'XII', title: 'Autonomia financeira', hint: 'Anexo XII assinado.' },
  { code: '4.20', section: 'declaracoes', kind: 'doc', annex: 'XIII', conditional: 'Só para projetos acima de R$ 1.000.000,00.', title: 'Contrapartida financeira assegurada', hint: 'Anexo XIII assinado, com o extrato bancário.' },
  { code: '4.21', section: 'declaracoes', kind: 'doc', annex: 'XIV', conditional: 'Só quando o recurso vem de emenda parlamentar.', title: 'Emendas: inexistência de irregularidade', hint: 'Anexo XIV assinado e print do site da entidade publicando os valores recebidos de emendas anteriores.' },
  { code: '4.22', section: 'declaracoes', kind: 'doc', annex: 'XV', title: 'Inexistência de nepotismo', hint: 'Anexo XV assinado.' },
];

export type HabilDoc = {
  id: string; org_id: string; item_code: string; status: 'enviado' | 'confirmado' | 'nao_aplica';
  file_path: string | null; mime_type: string | null; size_bytes: number | null;
  issued_on: string | null; valid_until: string | null; note: string | null; uploaded_by: string | null; created_at: string;
};

export type HabilState = 'ok' | 'vencendo' | 'vencido' | 'pendente' | 'nao_aplica' | 'impeditivo';
export type ItemStatus = { item: HabilItem; state: HabilState; doc: HabilDoc | null; history: HabilDoc[]; message: string };

const DAY = 86400_000;
const parse = (d: string) => new Date(d + 'T12:00:00');
const fmt = (d: string) => d.split('-').reverse().join('/');
/** Aviso de vencimento: 15 dias antes. */
export const WARN_DAYS = 15;

export function yearsBetween(from: string, to: Date): number {
  const a = parse(from);
  let y = to.getFullYear() - a.getFullYear();
  if (to.getMonth() < a.getMonth() || (to.getMonth() === a.getMonth() && to.getDate() < a.getDate())) y--;
  return y;
}

/** Situação de um item a partir dos envios (o mais recente vale). */
export function itemStatus(item: HabilItem, docs: HabilDoc[], ctx: { today?: Date; foundedOn?: string | null } = {}): ItemStatus {
  const today = ctx.today ?? new Date();
  const history = docs.filter((d) => d.item_code === item.code).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const doc = history[0] ?? null;
  const done = (state: HabilState, message: string): ItemStatus => ({ item, state, doc, history, message });

  // Regra automática do CNPJ: no mínimo 3 anos de existência.
  if (item.code === '1.2' && ctx.foundedOn) {
    const y = yearsBetween(ctx.foundedOn, today);
    if (y < 3) return done('impeditivo', `CNPJ aberto em ${fmt(ctx.foundedOn)}: tem ${y} ano(s). O Ministério exige no mínimo 3 anos.`);
  }
  if (!doc) return done('pendente', item.conditional ? `Falta enviar. ${item.conditional}` : 'Falta enviar.');
  if (doc.status === 'nao_aplica') return done('nao_aplica', `Não se aplica: ${doc.note ?? ''}`.trim());
  if (doc.status === 'confirmado' && item.kind === 'confirm') return done('ok', `Confirmado em ${fmt(doc.created_at.slice(0, 10))}.`);
  if (!doc.file_path) return done('pendente', 'Falta o arquivo.');

  if (item.expires) {
    if (!doc.valid_until) return done('pendente', 'Informe a data de validade da certidão.');
    const days = Math.floor((parse(doc.valid_until).getTime() - today.getTime()) / DAY);
    if (days < 0) return done('vencido', `Venceu em ${fmt(doc.valid_until)}. Emita uma nova.`);
    if (days <= WARN_DAYS) return done('vencendo', `Vence em ${fmt(doc.valid_until)} (${days} dia(s)).`);
    return done('ok', `Válida até ${fmt(doc.valid_until)}.`);
  }
  if (item.maxAgeDays) {
    if (!doc.issued_on) return done('pendente', 'Informe a data de emissão do comprovante.');
    const age = Math.floor((today.getTime() - parse(doc.issued_on).getTime()) / DAY);
    const left = item.maxAgeDays - age;
    if (left < 0) return done('vencido', `Emitido em ${fmt(doc.issued_on)}: passou de 3 meses. Envie um mais recente.`);
    if (left <= WARN_DAYS) return done('vencendo', `Emitido em ${fmt(doc.issued_on)}: vale por mais ${left} dia(s).`);
    return done('ok', `Emitido em ${fmt(doc.issued_on)}.`);
  }
  if (item.code === '1.2' && !ctx.foundedOn) return done('vencendo', 'Arquivo enviado. Informe a data de abertura do CNPJ para conferir os 3 anos.');
  return done('ok', `Enviado em ${fmt(doc.created_at.slice(0, 10))}.`);
}

export type HabilSummary = { items: ItemStatus[]; total: number; done: number; pct: number; apt: boolean; blockers: number; warnings: number };

/** Resumo: % pronto e se o clube está apto (nada pendente, vencido ou impeditivo). */
export function summarize(docs: HabilDoc[], ctx: { today?: Date; foundedOn?: string | null } = {}): HabilSummary {
  const items = HABIL_ITEMS.map((i) => itemStatus(i, docs, ctx));
  const done = items.filter((s) => s.state === 'ok' || s.state === 'vencendo' || s.state === 'nao_aplica').length;
  const blockers = items.filter((s) => s.state === 'pendente' || s.state === 'vencido' || s.state === 'impeditivo').length;
  const warnings = items.filter((s) => s.state === 'vencendo').length;
  return { items, total: items.length, done, pct: Math.round((done / items.length) * 100), apt: blockers === 0, blockers, warnings };
}

// ---------------------------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------------------------
export type HabilProfile = {
  org_id: string; founded_on: string | null; proposal_number: string | null; partnership_object: string | null;
  execution_place: string | null; sport: string | null; space_name: string | null; space_address: string | null;
  space_owner: string | null; execution_period: string | null; counterpart_value: number | null;
  counterpart_account: string | null; signatory_id: string | null;
};
export type Officer = {
  id: string; full_name: string; role_title: string; cpf: string | null; rg: string | null; rg_issuer: string | null;
  birth_date: string | null; address: string | null; phone: string | null; email: string | null;
  term_start: string | null; term_end: string | null; is_signatory: boolean;
};

export function useHabilDocs(orgId: string | undefined) {
  return useQuery({
    queryKey: ['habil-docs', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase.from('org_habil_docs')
        .select('id, org_id, item_code, status, file_path, mime_type, size_bytes, issued_on, valid_until, note, uploaded_by, created_at')
        .eq('org_id', orgId!).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as HabilDoc[];
    },
  });
}

export function useHabilProfile(orgId: string | undefined) {
  return useQuery({
    queryKey: ['habil-profile', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase.from('org_habil_profile').select('*').eq('org_id', orgId!).maybeSingle();
      if (error) throw error;
      return (data ?? null) as HabilProfile | null;
    },
  });
}

export async function saveHabilProfile(orgId: string, patch: Partial<HabilProfile>) {
  const { error } = await supabase.from('org_habil_profile').upsert({ org_id: orgId, ...patch, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Lista os dirigentes (cada leitura fica registrada no histórico da entidade). */
export function useOfficers(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-officers', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_org_officers', { p_org: orgId });
      if (error) throw error;
      return (data ?? []) as Officer[];
    },
  });
}

export async function saveOfficer(orgId: string, o: Partial<Officer>) {
  const { data, error } = await supabase.rpc('save_org_officer', { p_org: orgId, p: o });
  if (error) throw error;
  return data as string;
}

export async function deleteOfficer(id: string) {
  const { error } = await supabase.rpc('delete_org_officer', { p_id: id });
  if (error) throw error;
}

const EXT_BY_MIME: Record<string, string> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' };

export async function uploadHabilDoc(p: {
  orgId: string; uploaderId: string; itemCode: string; picked: PickedFile; issuedOn?: string | null; validUntil?: string | null; note?: string;
}) {
  const ext = EXT_BY_MIME[p.picked.mime] ?? 'bin';
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `${p.orgId}/habilitacao/${p.itemCode.replace(/\./g, '-')}-${Date.now()}-${rand}.${ext}`;
  const bytes = Platform.OS === 'web' && p.picked.file ? p.picked.file : await new File(p.picked.uri).arrayBuffer();
  const { error: upErr } = await supabase.storage.from(ORG_DOCS_BUCKET).upload(path, bytes, { contentType: p.picked.mime, upsert: false });
  if (upErr) throw upErr;
  const { error } = await supabase.from('org_habil_docs').insert({
    org_id: p.orgId, item_code: p.itemCode, status: 'enviado', file_path: path, mime_type: p.picked.mime,
    size_bytes: p.picked.size || 1, issued_on: p.issuedOn || null, valid_until: p.validUntil || null,
    note: p.note?.trim() || null, uploaded_by: p.uploaderId,
  });
  if (error) {
    await supabase.storage.from(ORG_DOCS_BUCKET).remove([path]);
    throw error;
  }
}

export async function markHabilItem(p: { orgId: string; uploaderId: string; itemCode: string; status: 'confirmado' | 'nao_aplica'; note?: string }) {
  const { error } = await supabase.from('org_habil_docs').insert({
    org_id: p.orgId, item_code: p.itemCode, status: p.status, note: p.note?.trim() || null, uploaded_by: p.uploaderId,
  });
  if (error) throw error;
}

export async function openHabilDoc(doc: HabilDoc) {
  if (!doc.file_path) return;
  await supabase.rpc('log_habil_doc_open', { p_doc: doc.id });
  const { data, error } = await supabase.storage.from(ORG_DOCS_BUCKET).createSignedUrl(doc.file_path, 120);
  if (error || !data?.signedUrl) throw error ?? new Error('Não foi possível abrir o documento.');
  if (Platform.OS === 'web') window.open(data.signedUrl, '_blank', 'noopener');
  else await Linking.openURL(data.signedUrl);
}

export async function deleteHabilDoc(doc: HabilDoc) {
  const { error } = await supabase.from('org_habil_docs').delete().eq('id', doc.id);
  if (error) throw error;
  if (doc.file_path) await supabase.storage.from(ORG_DOCS_BUCKET).remove([doc.file_path]);
}
