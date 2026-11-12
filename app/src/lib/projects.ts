// Projetos incentivados: consultas e gravações. As regras de acesso ficam no banco
// (leitura: gestor e treinador; escrita: gestor; relatórios: só pela função de emissão).
import { useQuery } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export const PROJECT_FILES_BUCKET = 'project-files';

export type Project = {
  id: string; org_id: string; name: string; process_number: string | null;
  sphere: 'federal' | 'estadual' | 'distrital' | 'municipal'; agency: string | null; program: string | null; proponent: string | null;
  starts_on: string; ends_on: string; status: 'draft' | 'active' | 'closed';
  free_of_charge: boolean; public_school_min_pct: number | null; notes: string | null;
};
export type PlanVersion = { id: string; version: number; approved_on: string | null; description: string | null; file_path: string | null; created_at: string };
export type GoalKind = 'unique_beneficiaries' | 'attendances' | 'avg_frequency' | 'activities_done' | 'manual';
export type Goal = {
  id: string; code: string | null; description: string; indicator: string | null; kind: GoalKind;
  unit: string | null; target: number | null; verifier: string | null; active: boolean; plan_version_id: string | null;
};
export type Beneficiary = {
  project_id: string; athlete_id: string; starts_on: string; ends_on: string | null;
  end_reason: 'abandono' | 'lesao' | 'transferencia' | 'termino' | 'outro' | null;
  school_type: 'publica' | 'privada' | 'nao_informado'; athletes: { full_name: string } | null;
};
export type Sponsor = { id: string; name: string; document: string | null; contact_name: string | null; contact_email: string | null };
export type IssuedReport = {
  id: string; number: number; version: number; period_from: string; period_to: string; sha256: string;
  rectifies_id: string | null; rectification_reason: string | null; issued_at: string;
};

export const sphereLabels: Record<Project['sphere'], string> = { federal: 'Federal', estadual: 'Estadual', distrital: 'Distrital', municipal: 'Municipal' };
export const statusLabels: Record<Project['status'], string> = { draft: 'Em elaboração', active: 'Em execução', closed: 'Encerrado' };
export const goalKindLabels: Record<GoalKind, string> = {
  unique_beneficiaries: 'Beneficiários atendidos (pessoas)',
  attendances: 'Atendimentos (presenças)',
  avg_frequency: 'Frequência média (%)',
  activities_done: 'Atividades realizadas',
  manual: 'Lançado manualmente',
};
export const schoolLabels: Record<Beneficiary['school_type'], string> = { publica: 'Escola pública', privada: 'Escola particular', nao_informado: 'Escola não informada' };
export const endReasonLabels: Record<NonNullable<Beneficiary['end_reason']>, string> = {
  abandono: 'Abandono', lesao: 'Lesão', transferencia: 'Transferência', termino: 'Término', outro: 'Outro',
};

const unwrap = <T,>(r: { data: unknown; error: unknown }): T => {
  if (r.error) throw r.error;
  return r.data as T;
};

export function useProjects(orgId: string | undefined) {
  return useQuery({
    queryKey: ['projects', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => unwrap<Project[]>(await supabase.from('projects').select('*').eq('org_id', orgId!).order('starts_on', { ascending: false })),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['project', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const [p, plans, goals, teams, bens, sponsors, reports] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id!).single(),
        supabase.from('project_plan_versions').select('id, version, approved_on, description, file_path, created_at').eq('project_id', id!).order('version', { ascending: false }),
        supabase.from('project_goals').select('*').eq('project_id', id!).order('code'),
        supabase.from('project_teams').select('team_id').eq('project_id', id!),
        supabase.from('project_beneficiaries').select('*, athletes(full_name)').eq('project_id', id!),
        supabase.from('project_sponsors').select('id, name, document, contact_name, contact_email').eq('project_id', id!).order('name'),
        supabase.from('project_reports').select('id, number, version, period_from, period_to, sha256, rectifies_id, rectification_reason, issued_at').eq('project_id', id!).order('number', { ascending: false }).order('version', { ascending: false }),
      ]);
      return {
        project: unwrap<Project>(p as never),
        plans: unwrap<PlanVersion[]>(plans as never),
        goals: unwrap<Goal[]>(goals as never),
        teamIds: unwrap<{ team_id: string }[]>(teams as never).map((t) => t.team_id),
        beneficiaries: unwrap<Beneficiary[]>(bens as never).sort((a, b) => (a.athletes?.full_name ?? '').localeCompare(b.athletes?.full_name ?? '')),
        sponsors: unwrap<Sponsor[]>(sponsors as never),
        reports: unwrap<IssuedReport[]>(reports as never),
      };
    },
  });
}

export type Indicators = {
  activities_done: number; activities_canceled: number; activities_upcoming: number;
  beneficiaries_enrolled: number; unique_beneficiaries: number; attendances: number; eligible_total: number; pending_total: number;
  school_public: number; school_private: number; school_unknown: number;
  avg_frequency_pct: number | null; public_school_pct: number | null;
};
export type IndicatorsResult = {
  period: { from: string; to: string };
  project: Project;
  plan: { id: string; version: number; approved_on: string | null; description: string | null; has_file: boolean } | null;
  indicators: Indicators;
  goals: (Pick<Goal, 'id' | 'code' | 'description' | 'indicator' | 'kind' | 'unit' | 'target' | 'verifier'> & { result: number | null; reached: boolean | null })[];
  beneficiaries: { athlete_id: string; full_name: string; starts_on: string; ends_on: string | null; end_reason: string | null; school_type: Beneficiary['school_type']; eligible: number; present: number; pending: number; frequency_pct: number | null }[];
};

export function useIndicators(projectId: string | undefined) {
  return useQuery({
    queryKey: ['indicators', projectId],
    enabled: Boolean(projectId),
    queryFn: async () => unwrap<IndicatorsResult>(await supabase.rpc('project_indicators', { p_project_id: projectId! })),
  });
}

export async function issueReport(projectId: string, from: string, to: string, rectifiesId?: string, reason?: string) {
  return unwrap<{ id: string; number: number; version: number; sha256: string }>(
    await supabase.rpc('issue_project_report', {
      p_project_id: projectId, p_from: from, p_to: to, p_rectifies_id: rectifiesId ?? null, p_reason: reason ?? null,
    }),
  );
}

export async function loadIssuedReport(id: string) {
  return unwrap<{ data: unknown; sha256: string; issued_at: string }>(await supabase.from('project_reports').select('data, sha256, issued_at').eq('id', id).single());
}

/** Envia o PDF do plano aprovado para a pasta do projeto. */
export async function uploadPlanFile(orgId: string, projectId: string, version: number, asset: { uri: string; file?: Blob }): Promise<string> {
  const path = `${orgId}/${projectId}/plano-v${version}-${Date.now()}.pdf`;
  // No navegador o seletor entrega o arquivo pronto; no celular lemos pelo endereço local.
  const bytes = Platform.OS === 'web' && asset.file ? asset.file : await new File(asset.uri).arrayBuffer();
  const { error } = await supabase.storage.from(PROJECT_FILES_BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: false });
  if (error) throw error;
  return path;
}

export async function signedProjectFileUrl(path: string) {
  const { data } = await supabase.storage.from(PROJECT_FILES_BUCKET).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

/** Texto do indicador: "66,7%" ou "não aplicável". */
export const pct = (v: number | null | undefined) => (v == null ? 'não aplicável' : `${String(Number(v)).replace('.', ',')}%`);
export const num = (v: number | null | undefined) => (v == null ? '—' : String(Number(v)).replace('.', ','));
