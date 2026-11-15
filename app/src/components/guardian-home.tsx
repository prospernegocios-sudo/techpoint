// Tela inicial do responsável: cada filho com a autorização e a presença dos últimos treinos.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Badge, Button, Card, Loading, Notice, T, styles } from '@/components/ui';
import { formatDay, formatTime } from '@/lib/format';
import { useMe } from '@/lib/me';
import { supabase } from '@/lib/supabase';

type Kid = { id: string; full_name: string; status: string; birth_date: string };
type Rec = { athlete_id: string; event_id: string; kind: string; server_at: string; status: string; events: { starts_at: string; teams: { name: string } | null } | null };

export function GuardianHome() {
  const me = useMe();
  const q = useQuery({
    queryKey: ['guardian-home', me.profile?.id],
    enabled: Boolean(me.profile),
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data: links } = await supabase.from('athlete_guardians').select('athlete_id').eq('profile_id', me.profile!.id).eq('status', 'active');
      const ids = (links ?? []).map((l) => l.athlete_id);
      if (!ids.length) return { kids: [] as Kid[], recs: [] as Rec[] };
      const since = new Date(Date.now() - 14 * 86400_000).toISOString();
      const [k, r] = await Promise.all([
        supabase.from('athletes').select('id, full_name, status, birth_date').in('id', ids).order('full_name'),
        supabase.from('attendance_records').select('athlete_id, event_id, kind, server_at, status, events(starts_at, teams(name))').in('athlete_id', ids).gte('server_at', since).neq('status', 'rejected').order('server_at', { ascending: false }),
      ]);
      return { kids: (k.data ?? []) as Kid[], recs: (r.data ?? []) as unknown as Rec[] };
    },
  });
  if (q.isLoading) return <Loading />;
  if (!q.data?.kids.length) return <Notice tone="info" text="Nenhum atleta ligado à sua conta ainda. Abra o link de responsável enviado pelo treinador." />;
  return (
    <View style={{ gap: 14 }}>
      {q.data.kids.map((k) => {
        const recs = q.data!.recs.filter((r) => r.athlete_id === k.id);
        const byEvent = [...new Set(recs.map((r) => r.event_id))].slice(0, 6);
        return (
          <Card key={k.id}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <T variant="subtitle" style={{ flex: 1 }}>{k.full_name}</T>
              {k.status === 'pending_consent' ? <Badge label="Falta sua autorização" tone="warning" /> : <Badge label="Autorizado" tone="success" />}
            </View>
            {k.status === 'pending_consent' && (
              <Button title="Autorizar agora" kind="accent" onPress={() => router.push({ pathname: '/consentimento/[athleteId]', params: { athleteId: k.id } })} />
            )}
            {byEvent.length === 0 && <T variant="muted">Nenhum treino registrado nos últimos 14 dias.</T>}
            {byEvent.map((ev) => {
              const ci = recs.find((r) => r.event_id === ev && r.kind === 'check_in');
              const co = recs.find((r) => r.event_id === ev && r.kind === 'check_out');
              const e = (ci ?? co)?.events;
              return (
                <View key={ev} style={{ paddingVertical: 4 }}>
                  <T variant="body" style={{ fontWeight: '600' }}>{e ? `${formatDay(e.starts_at)} · ${e.teams?.name ?? ''}` : 'Treino'}</T>
                  <T variant="small">
                    {ci ? `Chegou às ${formatTime(ci.server_at)}${ci.status === 'pending' ? ' (aguardando treinador)' : ''}` : 'Sem chegada'}
                    {co ? ` · Saiu às ${formatTime(co.server_at)}` : ''}
                  </T>
                </View>
              );
            })}
            {k.status !== 'pending_consent' && (<>
              <Button title="Documentos (atestado, RG)" kind="outline" onPress={() => router.push({ pathname: '/atleta/[id]', params: { id: k.id } })} />
              <Button title="Ver ou revogar a autorização" kind="ghost" onPress={() => router.push({ pathname: '/consentimento/[athleteId]', params: { athleteId: k.id } })} />
            </>)}
          </Card>
        );
      })}
    </View>
  );
}
