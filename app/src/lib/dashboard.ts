// Painel do dia da equipe e "primeiros passos" de uma entidade nova.
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type TodayEvent = { id: string; starts_at: string; ends_at: string; team: string; present: number; expected: number; pending: number };
export type GoalAlert = { project: string; projectId: string; goal: string; result: number | null; target: number | null; unit: string | null; kind: string };

export function useTeamDashboard(orgId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', orgId],
    enabled: Boolean(orgId) && enabled,
    refetchInterval: 30_000,
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);
      const weekAgo = new Date(Date.now() - 7 * 86400_000);
      const [evs, pend, projects] = await Promise.all([
        supabase.from('events').select('id, team_id, starts_at, ends_at, teams(name)').eq('org_id', orgId!).neq('status', 'canceled')
          .gte('starts_at', start.toISOString()).lte('starts_at', end.toISOString()).order('starts_at'),
        supabase.from('attendance_records').select('id', { count: 'exact', head: true }).eq('org_id', orgId!).eq('status', 'pending').gte('server_at', weekAgo.toISOString()),
        supabase.from('projects').select('id, name').eq('org_id', orgId!).eq('status', 'active').limit(3),
      ]);
      const events = (evs.data ?? []) as unknown as { id: string; team_id: string; starts_at: string; ends_at: string; teams: { name: string } | null }[];
      const ids = events.map((e) => e.id);
      const teamIds = [...new Set(events.map((e) => e.team_id))];
      const [recs, members] = await Promise.all([
        ids.length ? supabase.from('attendance_records').select('event_id, status').in('event_id', ids).eq('kind', 'check_in').neq('status', 'rejected') : Promise.resolve({ data: [] }),
        teamIds.length ? supabase.from('team_members').select('team_id').in('team_id', teamIds) : Promise.resolve({ data: [] }),
      ]);
      const r = (recs.data ?? []) as { event_id: string; status: string }[];
      const m = (members.data ?? []) as { team_id: string }[];
      const today: TodayEvent[] = events.map((e) => ({
        id: e.id, starts_at: e.starts_at, ends_at: e.ends_at, team: e.teams?.name ?? '',
        present: r.filter((x) => x.event_id === e.id && x.status === 'valid').length,
        pending: r.filter((x) => x.event_id === e.id && x.status === 'pending').length,
        expected: m.filter((x) => x.team_id === e.team_id).length,
      }));
      // Metas abaixo do alvo nos projetos em execução (até 3 projetos, para ser rápido).
      const alerts: GoalAlert[] = [];
      for (const p of (projects.data ?? []) as { id: string; name: string }[]) {
        const { data } = await supabase.rpc('project_indicators', { p_project_id: p.id });
        const goals = ((data as { goals?: { description: string; result: number | null; target: number | null; unit: string | null; kind: string; reached: boolean | null }[] })?.goals ?? []);
        goals.filter((g) => g.reached === false).forEach((g) => alerts.push({ project: p.name, projectId: p.id, goal: g.description, result: g.result, target: g.target, unit: g.unit, kind: g.kind }));
      }
      return { today, pendingWeek: pend.count ?? 0, alerts };
    },
  });
}

export type SetupStep = { key: string; title: string; done: boolean; href: string };

/** Primeiros passos: aparece enquanto a entidade não tem o básico cadastrado. */
export function useSetupSteps(orgId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['setup', orgId],
    enabled: Boolean(orgId) && enabled,
    queryFn: async (): Promise<SetupStep[]> => {
      const count = async (table: string, extra?: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
        let q = base(table);
        if (extra) q = extra(q);
        const { count: n } = await q;
        return n ?? 0;
      };
      function base(table: string) {
        return supabase.from(table).select('*', { count: 'exact', head: true }).eq('org_id', orgId!);
      }
      const [venues, teams, athletes, events, people] = await Promise.all([
        count('venues'), count('teams'), count('athletes'), count('events'),
        count('memberships', (q) => q.in('role', ['coach', 'manager', 'admin'])),
      ]);
      return [
        { key: 'venue', title: 'Cadastrar o local de treino', done: venues > 0, href: '/cadastro/locais' },
        { key: 'team', title: 'Criar as equipes', done: teams > 0, href: '/cadastro/equipes' },
        { key: 'athletes', title: 'Cadastrar os atletas', done: athletes > 0, href: '/cadastro/atletas' },
        { key: 'event', title: 'Marcar o primeiro treino', done: events > 0, href: '/cadastro/treino' },
        { key: 'people', title: 'Convidar um treinador ou gestor', done: people > 1, href: '/cadastro/pessoas' },
      ];
    },
  });
}
