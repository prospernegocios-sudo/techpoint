// Atletas ligados ao responsável logado.
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type Kid = { id: string; org_id: string; full_name: string; birth_date: string; status: string };

export function useMyKids(profileId: string | undefined) {
  return useQuery({
    queryKey: ['my-kids', profileId],
    enabled: Boolean(profileId),
    queryFn: async () => {
      const { data: links, error } = await supabase.from('athlete_guardians').select('athlete_id').eq('profile_id', profileId!).eq('status', 'active');
      if (error) throw error;
      const ids = (links ?? []).map((l) => l.athlete_id as string);
      if (!ids.length) return [] as Kid[];
      const { data, error: e2 } = await supabase.from('athletes').select('id, org_id, full_name, birth_date, status').in('id', ids).order('full_name');
      if (e2) throw e2;
      return (data ?? []) as Kid[];
    },
  });
}
