// Fase C (onda 2): ponto dos profissionais pelo app, cursos do COB, plano de mídia, folha de ponto em Word
// e uso do armazenamento. Ponto: mesma prova do check-in do atleta (localização, foto e hora do servidor).
import { useQuery } from '@tanstack/react-query';
import { AlignmentType, BorderStyle, Document, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { base64ToBytes, type Fix } from './attendance';
import type { PickedFile } from './documents';
import { ORG_DOCS_BUCKET } from './habilitation';
import { reducePicked } from './image-reduce';
import { supabase } from './supabase';

// ---------------------------------------------------------------------------------------------
// Ponto
// ---------------------------------------------------------------------------------------------
export type StaffKind = 'check_in' | 'check_out';
export type StaffRecord = {
  id: string; org_id: string; event_id: string; profile_id: string; kind: StaffKind; server_at: string; distance_m: number | null;
  status: 'valid' | 'pending'; justification: string | null;
};
export type StaffResult = { type: 'done'; status: 'valid' | 'pending'; serverAt: string } | { type: 'outside_radius'; distance?: number; radius?: number } | { type: 'error'; message: string };

const MESSAGES: Record<string, string> = {
  TP_OUTSIDE_WINDOW: 'Fora do horário de ponto deste treino.',
  TP_NO_CHECK_IN: 'Registre a entrada antes da saída.',
  TP_ALREADY_RECORDED: 'Este ponto já foi registrado.',
  TP_FORBIDDEN: 'Só treinadores, gestores e administradores da entidade batem ponto.',
  TP_EVENT_CANCELED: 'Treino cancelado.',
};

export async function recordStaffPoint(p: {
  orgId: string; userId: string; eventId: string; kind: StaffKind; fix: Fix; photoBase64: string; photoSha256: string; deviceId: string; justification?: string | null;
}): Promise<StaffResult> {
  const path = `${p.orgId}/ponto/${p.userId}/${p.eventId}-${p.kind}-${Date.now()}.jpg`;
  const up = await supabase.storage.from(ORG_DOCS_BUCKET).upload(path, base64ToBytes(p.photoBase64), { contentType: 'image/jpeg', upsert: false });
  if (up.error) return { type: 'error', message: 'Não foi possível enviar a foto. Verifique a internet.' };
  const { data, error } = await supabase.rpc('record_staff_attendance', {
    p_event_id: p.eventId, p_kind: p.kind, p_latitude: p.fix.latitude, p_longitude: p.fix.longitude, p_accuracy_m: p.fix.accuracy ?? null,
    p_photo_path: path, p_photo_sha256: p.photoSha256, p_device_id: p.deviceId, p_is_mocked: Boolean(p.fix.mocked), p_justification: p.justification ?? null,
  });
  if (error) {
    if (error.message.includes('TP_OUTSIDE_RADIUS')) {
      try { const d = JSON.parse(error.details ?? '{}'); return { type: 'outside_radius', distance: d.distance_m, radius: d.radius_m }; } catch { return { type: 'outside_radius' }; }
    }
    const code = Object.keys(MESSAGES).find((k) => error.message.includes(k));
    return { type: 'error', message: code ? MESSAGES[code] : 'Não foi possível registrar o ponto agora.' };
  }
  const r = data as { status: 'valid' | 'pending'; server_at: string };
  return { type: 'done', status: r.status, serverAt: r.server_at };
}

export function useMyStaffPoints(eventIds: string[]) {
  return useQuery({
    queryKey: ['my-staff-points', eventIds.join(',')], enabled: eventIds.length > 0,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('staff_attendance').select('event_id, kind').eq('profile_id', u.user?.id ?? '').in('event_id', eventIds);
      if (error) throw error;
      return (data ?? []) as { event_id: string; kind: StaffKind }[];
    },
  });
}

export type PointRow = { profileId: string; name: string; eventId: string; team: string; date: string; inAt: string | null; outAt: string | null; minutes: number | null; pending: boolean };

/** Folha de ponto: entrada e saída por profissional e treino, com horas trabalhadas. */
export function buildPointRows(records: (StaffRecord & { name: string; team: string; starts_at: string })[]): PointRow[] {
  const map = new Map<string, PointRow>();
  records.forEach((r) => {
    const key = `${r.profile_id}|${r.event_id}`;
    const row = map.get(key) ?? { profileId: r.profile_id, name: r.name, eventId: r.event_id, team: r.team, date: r.starts_at.slice(0, 10), inAt: null, outAt: null, minutes: null, pending: false };
    if (r.kind === 'check_in') row.inAt = r.server_at; else row.outAt = r.server_at;
    row.pending = row.pending || r.status === 'pending';
    map.set(key, row);
  });
  return [...map.values()].map((r) => ({ ...r, minutes: r.inAt && r.outAt ? Math.max(0, Math.round((new Date(r.outAt).getTime() - new Date(r.inAt).getTime()) / 60000)) : null }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.date.localeCompare(b.date));
}

export function useProjectPoints(orgId: string | undefined, teamIds: string[], from: string, to: string) {
  return useQuery({
    queryKey: ['project-points', orgId, teamIds.join(','), from, to], enabled: Boolean(orgId),
    queryFn: async () => {
      const ev = await supabase.from('events').select('id, starts_at, team_id, teams(name)').eq('org_id', orgId!).gte('starts_at', `${from}T00:00:00`).lte('starts_at', `${to}T23:59:59`);
      if (ev.error) throw ev.error;
      type Ev = { id: string; starts_at: string; team_id: string; teams: { name: string } | null };
      const events = ((ev.data ?? []) as unknown as Ev[]).filter((e) => !teamIds.length || teamIds.includes(e.team_id));
      if (!events.length) return [] as PointRow[];
      const st = await supabase.from('staff_attendance').select('*').in('event_id', events.map((e) => e.id));
      if (st.error) throw st.error;
      const recs = (st.data ?? []) as StaffRecord[];
      const ids = [...new Set(recs.map((r) => r.profile_id))];
      const pr = ids.length ? await supabase.from('profiles').select('id, full_name').in('id', ids) : { data: [] };
      const names = new Map(((pr.data ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? 'Profissional']));
      const evMap = new Map(events.map((e) => [e.id, e]));
      return buildPointRows(recs.map((r) => ({ ...r, name: names.get(r.profile_id) ?? 'Profissional', team: evMap.get(r.event_id)?.teams?.name ?? '', starts_at: evMap.get(r.event_id)?.starts_at ?? r.server_at })));
    },
  });
}

const FONT = 'Arial';
const run = (t: string, o: { bold?: boolean; size?: number } = {}) => new TextRun({ text: t, font: FONT, size: o.size ?? 18, bold: o.bold });
const border = { style: BorderStyle.SINGLE, size: 4, color: '777777' };
const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '—');
export const fmtMinutes = (m: number | null) => (m == null ? '—' : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`);

/** Folha de ponto em Word (um bloco por profissional), para os anexos do RCO. */
export function buildPointSheetDoc(p: { orgName: string; projectName: string; from: string; to: string; rows: PointRow[] }): Document {
  const out: (Paragraph | Table)[] = [];
  const people = [...new Set(p.rows.map((r) => r.profileId))];
  const br = (d: string) => d.split('-').reverse().join('/');
  people.forEach((pid, i) => {
    const rows = p.rows.filter((r) => r.profileId === pid);
    const total = rows.reduce((s, r) => s + (r.minutes ?? 0), 0);
    out.push(new Paragraph({ pageBreakBefore: i > 0, alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [run('FOLHA DE PONTO', { bold: true, size: 26 })] }));
    out.push(new Paragraph({ spacing: { after: 60 }, children: [run(`Entidade: ${p.orgName}`)] }));
    out.push(new Paragraph({ spacing: { after: 60 }, children: [run(`Projeto: ${p.projectName}`)] }));
    out.push(new Paragraph({ spacing: { after: 60 }, children: [run(`Profissional: ${rows[0].name}`, { bold: true })] }));
    out.push(new Paragraph({ spacing: { after: 160 }, children: [run(`Período: ${br(p.from)} a ${br(p.to)} · Registros pelo app TechPoint com localização, foto e hora do servidor.`)] }));
    const head = ['DATA', 'EQUIPE/TREINO', 'ENTRADA', 'SAÍDA', 'HORAS', 'OBS.'];
    out.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [head, ...rows.map((r) => [br(r.date), r.team, hhmm(r.inAt), hhmm(r.outAt), fmtMinutes(r.minutes), r.pending ? 'Fora do local: justificado' : '']), ['', 'TOTAL', '', '', fmtMinutes(total), '']].map((row, ri) => new TableRow({
        children: row.map((c) => new TableCell({ borders: { top: border, bottom: border, left: border, right: border }, shading: ri === 0 ? { fill: 'EFEFEF' } : undefined, children: [new Paragraph({ children: [run(c || ' ', { bold: ri === 0 })] })] })),
      })),
    }));
    out.push(new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER, children: [run('_______________________________________')] }));
    out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [run(rows[0].name)] }));
  });
  if (!people.length) out.push(new Paragraph({ children: [run('Nenhum ponto registrado no período.')] }));
  return new Document({ creator: 'TechPoint', title: 'Folha de ponto', sections: [{ children: out }] });
}

// ---------------------------------------------------------------------------------------------
// Cursos do COB
// ---------------------------------------------------------------------------------------------
export const COB_COURSES = [
  { key: 'cob_antirracismo', label: 'Esporte Antirracista' },
  { key: 'cob_manipulacao', label: 'Combate à Manipulação de Resultados' },
] as const;
export type CobCourse = (typeof COB_COURSES)[number]['key'];
export const COB_URL = 'https://www.cob.org.br/cultura-educacao/cursos-do-iob';

export type CobStatus = { id: string; name: string; who: 'atleta' | 'equipe'; done: Record<CobCourse, string | null> };

export function useCobStatus(orgId: string | undefined, projectId: string | undefined) {
  return useQuery({
    queryKey: ['cob', orgId, projectId], enabled: Boolean(orgId && projectId),
    queryFn: async () => {
      const [b, d, m, s] = await Promise.all([
        supabase.from('project_beneficiaries').select('athlete_id, ends_on, athletes(full_name)').eq('project_id', projectId!),
        supabase.from('athlete_documents').select('athlete_id, kind, file_path').eq('org_id', orgId!).in('kind', ['cob_antirracismo', 'cob_manipulacao']).is('superseded_at', null),
        supabase.from('memberships').select('profile_id, role, profiles(full_name)').eq('org_id', orgId!).eq('active', true).in('role', ['admin', 'manager', 'coach']),
        supabase.from('staff_certificates').select('id, profile_id, course, file_path, mime_type, size_bytes').eq('org_id', orgId!),
      ]);
      type B = { athlete_id: string; ends_on: string | null; athletes: { full_name: string } | null };
      type M = { profile_id: string | null; role: string; profiles: { full_name: string | null } | null };
      const docs = (d.data ?? []) as { athlete_id: string; kind: CobCourse; file_path: string }[];
      const certs = (s.data ?? []) as { id: string; profile_id: string; course: CobCourse; file_path: string }[];
      const athletes: CobStatus[] = ((b.data ?? []) as unknown as B[]).map((x) => ({
        id: x.athlete_id, name: x.athletes?.full_name ?? 'Atleta', who: 'atleta',
        done: { cob_antirracismo: docs.find((y) => y.athlete_id === x.athlete_id && y.kind === 'cob_antirracismo')?.file_path ?? null, cob_manipulacao: docs.find((y) => y.athlete_id === x.athlete_id && y.kind === 'cob_manipulacao')?.file_path ?? null },
      }));
      const seen = new Set<string>();
      const staff: CobStatus[] = ((m.data ?? []) as unknown as M[]).filter((x) => x.profile_id && !seen.has(x.profile_id) && seen.add(x.profile_id)).map((x) => ({
        id: x.profile_id!, name: x.profiles?.full_name ?? 'Profissional', who: 'equipe',
        done: { cob_antirracismo: certs.find((y) => y.profile_id === x.profile_id && y.course === 'cob_antirracismo')?.file_path ?? null, cob_manipulacao: certs.find((y) => y.profile_id === x.profile_id && y.course === 'cob_manipulacao')?.file_path ?? null },
      }));
      return { athletes: athletes.sort((a, b2) => a.name.localeCompare(b2.name)), staff: staff.sort((a, b2) => a.name.localeCompare(b2.name)) };
    },
  });
}

export function cobProgress(list: CobStatus[]) {
  const complete = list.filter((x) => x.done.cob_antirracismo && x.done.cob_manipulacao).length;
  return { complete, total: list.length, pct: list.length ? Math.round((complete / list.length) * 100) : 0 };
}

export async function uploadStaffCertificate(p: { orgId: string; profileId: string; course: CobCourse; uploaderId: string; picked: PickedFile }) {
  const r = await reducePicked(p.picked);
  const ext = r.mime === 'application/pdf' ? 'pdf' : 'jpg';
  const path = `${p.orgId}/execucao/cob-${p.profileId}-${p.course}-${Date.now()}.${ext}`;
  const up = await supabase.storage.from(ORG_DOCS_BUCKET).upload(path, r.body, { contentType: r.mime, upsert: false });
  if (up.error) throw up.error;
  const { error } = await supabase.from('staff_certificates').insert({ org_id: p.orgId, profile_id: p.profileId, course: p.course, file_path: path, mime_type: r.mime, size_bytes: Math.max(1, r.size), uploaded_by: p.uploaderId });
  if (error) { await supabase.storage.from(ORG_DOCS_BUCKET).remove([path]); throw error; }
}

// ---------------------------------------------------------------------------------------------
// Plano de mídia
// ---------------------------------------------------------------------------------------------
export const MEDIA_KINDS = [
  { key: 'placa', label: 'Placa' }, { key: 'banner', label: 'Banner' }, { key: 'rede_social', label: 'Rede social' },
  { key: 'uniforme', label: 'Uniforme' }, { key: 'materia', label: 'Matéria / reportagem' }, { key: 'outro', label: 'Outro' },
] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number]['key'];
export type Media = { id: string; project_id: string; kind: MediaKind; description: string | null; link: string | null; taken_on: string | null; file_path: string | null; mime_type: string | null; created_at: string };

export function useProjectMedia(projectId: string | undefined) {
  return useQuery({
    queryKey: ['media', projectId], enabled: Boolean(projectId),
    queryFn: async () => {
      const { data, error } = await supabase.from('project_media').select('*').eq('project_id', projectId!).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Media[];
    },
  });
}
export async function addMedia(p: { orgId: string; projectId: string; uploaderId: string; kind: MediaKind; description: string; link?: string; takenOn?: string | null; picked?: PickedFile | null }) {
  let file: { path: string; mime: string; size: number } | null = null;
  if (p.picked) {
    const r = await reducePicked(p.picked);
    const path = `${p.orgId}/execucao/midia-${p.projectId}-${Date.now()}.${r.mime === 'application/pdf' ? 'pdf' : 'jpg'}`;
    const up = await supabase.storage.from(ORG_DOCS_BUCKET).upload(path, r.body, { contentType: r.mime, upsert: false });
    if (up.error) throw up.error;
    file = { path, mime: r.mime, size: Math.max(1, r.size) };
  }
  const { error } = await supabase.from('project_media').insert({
    org_id: p.orgId, project_id: p.projectId, kind: p.kind, description: p.description.trim() || null, link: p.link?.trim() || null,
    taken_on: p.takenOn ?? null, file_path: file?.path ?? null, mime_type: file?.mime ?? null, size_bytes: file?.size ?? null, uploaded_by: p.uploaderId,
  });
  if (error) { if (file) await supabase.storage.from(ORG_DOCS_BUCKET).remove([file.path]); throw error; }
}
export async function deleteMedia(m: Media) {
  const { error } = await supabase.from('project_media').delete().eq('id', m.id);
  if (error) throw error;
  if (m.file_path) await supabase.storage.from(ORG_DOCS_BUCKET).remove([m.file_path]);
}

// ---------------------------------------------------------------------------------------------
// Armazenamento (plano grátis: 1 GB)
// ---------------------------------------------------------------------------------------------
export const STORAGE_WARN = 0.8;
export function useStorageUsage(enabled: boolean) {
  return useQuery({
    queryKey: ['storage-usage'], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('storage_usage');
      if (error) throw error;
      return data as { total_bytes: number; by_bucket: Record<string, number>; limit_bytes: number };
    },
  });
}
export const mb = (b: number) => `${(b / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
