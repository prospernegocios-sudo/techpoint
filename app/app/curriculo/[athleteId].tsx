// Currículo esportivo de um atleta (equipe, responsável ou o próprio atleta).
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { CvView } from '@/components/cv-view';
import { Loading, Notice, Screen } from '@/components/ui';
import { useMyKids } from '@/lib/kids';
import { useMe } from '@/lib/me';
import { supabase } from '@/lib/supabase';

export default function Curriculo() {
  const { athleteId } = useLocalSearchParams<{ athleteId: string }>();
  const me = useMe();
  const kids = useMyKids(me.profile?.id);
  const a = useQuery({
    queryKey: ['athlete-min', athleteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('athletes').select('id, org_id, profile_id').eq('id', athleteId!).single();
      if (error) throw error;
      return data as { id: string; org_id: string; profile_id: string | null };
    },
  });
  if (a.isLoading) return <Loading />;
  if (!a.data) return <Screen><Notice tone="danger" text="Atleta não encontrado." /></Screen>;
  const canShare = a.data.profile_id === me.profile?.id || (kids.data ?? []).some((k) => k.id === a.data!.id);
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Currículo esportivo' }} />
      <CvView athleteId={a.data.id} orgId={a.data.org_id} isStaff={me.isStaff} canShare={canShare} />
    </Screen>
  );
}
