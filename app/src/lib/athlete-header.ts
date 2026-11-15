// Sexo e categoria (equipes) do atleta logado, para cabeçalhos (perfil e menu da conta).
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export function useAthleteHeader(athleteId: string | undefined) {
  return useQuery({
    queryKey: ['athlete-header', athleteId], enabled: Boolean(athleteId),
    queryFn: async () => {
      const { data } = await supabase.from('athletes').select('sex, team_members(teams(name))').eq('id', athleteId!).single();
      const d = data as { sex: 'M' | 'F' | null; team_members: { teams: { name: string } | null }[] } | null;
      return { sex: d?.sex ?? null, teams: (d?.team_members ?? []).map((t) => t.teams?.name).filter((x): x is string => Boolean(x)) };
    },
  });
}
export const sexLabel = (s: 'M' | 'F' | null | undefined) => (s === 'M' ? 'Masculino' : s === 'F' ? 'Feminino' : null);
