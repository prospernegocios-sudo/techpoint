// Convocações para competições (ciência do atleta) e justificativas de falta.
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type Convocation = {
  id: string; org_id: string; team_id: string | null; title: string; location: string | null;
  starts_on: string; ends_on: string | null; notes: string | null; created_at: string;
};
export type ConvAthlete = { convocation_id: string; athlete_id: string; acknowledged_at: string | null; athletes?: { full_name: string } | null };

/** Convocações do atleta (ou do filho, para o responsável), com a ciência. */
export function useMyConvocations(athleteId: string | undefined) {
  return useQuery({
    queryKey: ['my-convocations', athleteId], enabled: Boolean(athleteId),
    queryFn: async () => {
      const { data, error } = await supabase.from('convocation_athletes')
        .select('convocation_id, athlete_id, acknowledged_at, convocations(id, org_id, team_id, title, location, starts_on, ends_on, notes, created_at)')
        .eq('athlete_id', athleteId!);
      if (error) throw error;
      return ((data ?? []) as unknown as (ConvAthlete & { convocations: Convocation | null })[])
        .filter((x) => x.convocations)
        .map((x) => ({ ...x.convocations!, acknowledged_at: x.acknowledged_at }))
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
        .select('id, org_id, team_id, title, location, starts_on, ends_on, notes, created_at, convocation_athletes(convocation_id, athlete_id, acknowledged_at, athletes(full_name))')
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
