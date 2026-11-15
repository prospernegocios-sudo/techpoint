// Convocações para competições (ciência do atleta) e justificativas de falta.
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type EventKind = 'competicao' | 'reuniao' | 'palestra' | 'outro';
export const EVENT_KINDS: { key: EventKind; label: string; icon: 'trophy-outline' | 'people-outline' | 'mic-outline' | 'calendar-outline' }[] = [
  { key: 'competicao', label: 'Competição', icon: 'trophy-outline' },
  { key: 'reuniao', label: 'Reunião', icon: 'people-outline' },
  { key: 'palestra', label: 'Palestra', icon: 'mic-outline' },
  { key: 'outro', label: 'Outro', icon: 'calendar-outline' },
];
export const eventKind = (k: string) => EVENT_KINDS.find((x) => x.key === k) ?? EVENT_KINDS[3];

export type Convocation = {
  id: string; org_id: string; team_id: string | null; title: string; location: string | null; kind: EventKind; start_time: string | null;
  starts_on: string; ends_on: string | null; notes: string | null; created_at: string;
};
export type ConvAthlete = { convocation_id: string; athlete_id: string; acknowledged_at: string | null; cv_entry_id?: string | null; athletes?: { full_name: string } | null };
/** Data e hora do evento para exibir: "29/11/2026 às 19:00" ou "29/11 a 30/11/2026". */
export function eventWhen(c: Pick<Convocation, 'starts_on' | 'ends_on' | 'start_time'>) {
  const d = (x: string) => x.split('-').reverse().join('/');
  return `${d(c.starts_on)}${c.ends_on && c.ends_on !== c.starts_on ? ` a ${d(c.ends_on)}` : ''}${c.start_time ? ` às ${c.start_time.slice(0, 5)}` : ''}`;
}
/** Evento já realizado (o último dia passou). */
export const eventPast = (c: Pick<Convocation, 'starts_on' | 'ends_on'>, today = new Date().toISOString().slice(0, 10)) => (c.ends_on ?? c.starts_on) < today;

/** Convocações do atleta (ou do filho, para o responsável), com a ciência. */
export function useMyConvocations(athleteId: string | undefined) {
  return useQuery({
    queryKey: ['my-convocations', athleteId], enabled: Boolean(athleteId),
    queryFn: async () => {
      const { data, error } = await supabase.from('convocation_athletes')
        .select('convocation_id, athlete_id, acknowledged_at, cv_entry_id, convocations(id, org_id, team_id, kind, start_time, title, location, starts_on, ends_on, notes, created_at)')
        .eq('athlete_id', athleteId!);
      if (error) throw error;
      return ((data ?? []) as unknown as (ConvAthlete & { convocations: Convocation | null })[])
        .filter((x) => x.convocations)
        .map((x) => ({ ...x.convocations!, acknowledged_at: x.acknowledged_at, cv_entry_id: x.cv_entry_id ?? null }))
        .sort((a, b) => b.starts_on.localeCompare(a.starts_on));
    },
  });
}

/** Convocações da entidade, com a lista de atletas e quem já deu ciência (equipe). */
export function useOrgConvocations(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-convocations', orgId], enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase.from('convocations')
        .select('id, org_id, team_id, kind, start_time, title, location, starts_on, ends_on, notes, created_at, convocation_athletes(convocation_id, athlete_id, acknowledged_at, athletes(full_name))')
        .eq('org_id', orgId!).order('starts_on', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as (Convocation & { convocation_athletes: ConvAthlete[] })[];
    },
  });
}

export async function acknowledgeConvocation(convocationId: string, athleteId: string) {
  const { error } = await supabase.rpc('acknowledge_convocation', { p_convocation_id: convocationId, p_athlete_id: athleteId });
  if (error) throw error;
}

/** Incluir ou tirar do currículo um evento realizado (escolha do atleta). */
export async function setEventInCv(convocationId: string, athleteId: string, include: boolean) {
  const { error } = await supabase.rpc('set_event_in_cv', { p_convocation_id: convocationId, p_athlete_id: athleteId, p_include: include });
  if (error) throw error;
}

export const REASONS: { key: Reason; label: string }[] = [
  { key: 'saude', label: 'Saúde' },
  { key: 'escola', label: 'Prova ou compromisso da escola' },
  { key: 'viagem', label: 'Viagem' },
  { key: 'familia', label: 'Compromisso de família' },
  { key: 'outro', label: 'Outro motivo' },
];
export type Reason = 'saude' | 'escola' | 'viagem' | 'familia' | 'outro';
export const reasonLabel = (r: string) => REASONS.find((x) => x.key === r)?.label ?? 'Outro motivo';
export type Justification = { id: string; event_id: string; athlete_id: string; reason: Reason; details: string | null; created_at: string; updated_at: string };

export async function saveJustification(p: { orgId: string; eventId: string; athleteId: string; reason: Reason; details: string }) {
  const { error } = await supabase.from('absence_justifications').upsert(
    { org_id: p.orgId, event_id: p.eventId, athlete_id: p.athleteId, reason: p.reason, details: p.details.trim() || null, updated_at: new Date().toISOString() },
    { onConflict: 'event_id,athlete_id' },
  );
  if (error) throw error;
}

export function useJustifications(athleteIds: string[], eventIds: string[]) {
  return useQuery({
    queryKey: ['justifications', athleteIds.join(), eventIds.join()], enabled: athleteIds.length > 0 && eventIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('absence_justifications').select('id, event_id, athlete_id, reason, details, created_at, updated_at')
        .in('athlete_id', athleteIds).in('event_id', eventIds);
      if (error) throw error;
      return (data ?? []) as Justification[];
    },
  });
}
