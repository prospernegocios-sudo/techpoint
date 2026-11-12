// Consultas ao banco usadas pelas telas. As regras de acesso (RLS) garantem
// que cada pessoa só recebe o que pode ver.
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type Venue = { id: string; name: string; address: string | null; latitude: number; longitude: number; radius_m: number };
export type Team = { id: string; name: string; category: string | null };
export type EventRow = {
  id: string; org_id: string; team_id: string; type: 'training' | 'match'; title: string | null;
  starts_at: string; ends_at: string; status: string;
  venues: Venue | null; teams: Team | null;
};
export type AttendanceRow = {
  id: string; event_id: string; athlete_id: string; kind: 'check_in' | 'check_out';
  server_at: string; status: 'valid' | 'pending' | 'rejected'; source: 'app' | 'manual';
  distance_m: number | null; accuracy_m: number | null; photo_path: string | null; flags: string[];
  justification: string | null; manual_reason: string | null; synced_offline: boolean;
};
export type AthleteRow = { id: string; full_name: string; birth_date: string; email: string | null; profile_id: string | null; status: string };

const unwrap = <T,>(r: { data: unknown; error: unknown }): T => {
  if (r.error) throw r.error;
  return r.data as T;
};

export function useEvents(orgId: string | undefined, daysBack = 0, daysAhead = 7) {
  return useQuery({
    queryKey: ['events', orgId, daysBack, daysAhead],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      from.setDate(from.getDate() - daysBack);
      const to = new Date();
      to.setDate(to.getDate() + daysAhead);
      return unwrap<EventRow[]>(
        await supabase
          .from('events')
          .select('id, org_id, team_id, type, title, starts_at, ends_at, status, venues(id, name, address, latitude, longitude, radius_m), teams(id, name, category)')
          .eq('org_id', orgId!)
          .gte('ends_at', from.toISOString())
          .lte('starts_at', to.toISOString())
          .neq('status', 'canceled')
          .order('starts_at'),
      );
    },
  });
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: ['event', id],
    enabled: Boolean(id),
    queryFn: async () =>
      unwrap<EventRow>(
        await supabase
          .from('events')
          .select('id, org_id, team_id, type, title, starts_at, ends_at, status, venues(id, name, address, latitude, longitude, radius_m), teams(id, name, category)')
          .eq('id', id!)
          .single(),
      ),
  });
}

export function useMyAttendance(athleteId: string | undefined, eventIds: string[]) {
  return useQuery({
    queryKey: ['my-attendance', athleteId, eventIds.join(',')],
    enabled: Boolean(athleteId) && eventIds.length > 0,
    queryFn: async () =>
      unwrap<AttendanceRow[]>(
        await supabase.from('attendance_records').select('*').eq('athlete_id', athleteId!).in('event_id', eventIds),
      ),
  });
}

export function useVenues(orgId: string | undefined) {
  return useQuery({
    queryKey: ['venues', orgId],
    enabled: Boolean(orgId),
    queryFn: async () =>
      unwrap<Venue[]>(await supabase.from('venues').select('id, name, address, latitude, longitude, radius_m').eq('org_id', orgId!).eq('active', true).order('name')),
  });
}

export function useTeams(orgId: string | undefined) {
  return useQuery({
    queryKey: ['teams', orgId],
    enabled: Boolean(orgId),
    queryFn: async () =>
      unwrap<Team[]>(await supabase.from('teams').select('id, name, category').eq('org_id', orgId!).eq('active', true).order('name')),
  });
}

export function useAthletes(orgId: string | undefined) {
  return useQuery({
    queryKey: ['athletes', orgId],
    enabled: Boolean(orgId),
    queryFn: async () =>
      unwrap<(AthleteRow & { team_members: { team_id: string }[] })[]>(
        await supabase.from('athletes').select('id, full_name, birth_date, email, profile_id, status, team_members(team_id)').eq('org_id', orgId!).order('full_name'),
      ),
  });
}

/** Lista de presença de um evento (para gestor/treinador). */
export function useEventRoster(event: EventRow | undefined) {
  return useQuery({
    queryKey: ['roster', event?.id],
    enabled: Boolean(event),
    refetchInterval: 20_000,
    queryFn: async () => {
      const [members, records] = await Promise.all([
        supabase.from('team_members').select('athlete_id, jersey_number, athletes(id, full_name, profile_id)').eq('team_id', event!.team_id),
        supabase.from('attendance_records').select('*').eq('event_id', event!.id).order('server_at'),
      ]);
      const m = unwrap<{ athlete_id: string; jersey_number: number | null; athletes: { id: string; full_name: string; profile_id: string | null } | null }[]>(members as never);
      const r = unwrap<AttendanceRow[]>(records as never);
      return m
        .filter((x) => x.athletes)
        .map((x) => ({
          athlete: x.athletes!,
          jersey: x.jersey_number,
          checkIn: r.find((a) => a.athlete_id === x.athlete_id && a.kind === 'check_in' && a.status !== 'rejected')
            ?? r.find((a) => a.athlete_id === x.athlete_id && a.kind === 'check_in'),
          checkOut: r.find((a) => a.athlete_id === x.athlete_id && a.kind === 'check_out' && a.status !== 'rejected')
            ?? r.find((a) => a.athlete_id === x.athlete_id && a.kind === 'check_out'),
        }))
        .sort((a, b) => a.athlete.full_name.localeCompare(b.athlete.full_name));
    },
  });
}

/** Link temporário (60 s) para ver a foto privada de um check-in. */
export async function signedPhotoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('attendance-photos').createSignedUrl(path, 60);
  return data?.signedUrl ?? null;
}
