// Página do time: atletas, pedidos pendentes, convite e próximos treinos.
import { useQuery } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Badge, Button, Card, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { ageOn, formatDay, formatTime } from '@/lib/format';
import { useMe } from '@/lib/me';
import { supabase } from '@/lib/supabase';

type Member = { athlete_id: string; athletes: { id: string; full_name: string; birth_date: string; status: string; profile_id: string | null; is_demo: boolean } | null };

export default function Equipe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isStaff } = useMe();
  const q = useQuery({
    queryKey: ['team', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const [t, m, r, e] = await Promise.all([
        supabase.from('teams').select('id, name, category').eq('id', id!).single(),
        supabase.from('team_members').select('athlete_id, athletes(id, full_name, birth_date, status, profile_id, is_demo)').eq('team_id', id!),
        supabase.from('athlete_join_requests').select('id', { count: 'exact', head: true }).eq('team_id', id!).eq('status', 'pending'),
        supabase.from('events').select('id, starts_at, ends_at').eq('team_id', id!).neq('status', 'canceled').gte('ends_at', new Date().toISOString()).order('starts_at').limit(5),
      ]);
      if (t.error) throw t.error;
      const members = ((m.data ?? []) as unknown as Member[]).filter((x) => x.athletes).sort((a, b) => a.athletes!.full_name.localeCompare(b.athletes!.full_name));
      return { team: t.data as { id: string; name: string; category: string | null }, members, pending: r.count ?? 0, events: (e.data ?? []) as { id: string; starts_at: string; ends_at: string }[] };
    },
  });

  if (!isStaff) return <Screen><Notice tone="danger" text="Apenas a equipe da entidade vê os times." /></Screen>;
  if (q.isLoading) return <Loading />;
  if (!q.data) return <Screen><Notice tone="danger" text="Time não encontrado." /></Screen>;
  const { team, members, pending, events } = q.data;

  return (
    <Screen>
      <Stack.Screen options={{ title: team.name }} />
      <T variant="title">{team.name}</T>
      <View style={styles.wrap}>
        <Badge label={`${members.length} atleta(s)`} tone="primary" />
        {pending > 0 && <Badge label={`${pending} pedido(s) para aprovar`} tone="warning" />}
      </View>
      <View style={styles.wrap}>
        <Button title="Convidar para este time" kind="accent" onPress={() => router.push({ pathname: '/cadastro/convites', params: { team: team.id } })} />
        {pending > 0 && <Button title="Ver pedidos" kind="outline" onPress={() => router.push({ pathname: '/cadastro/convites', params: { team: team.id } })} />}
      </View>

      <T variant="subtitle">Próximos treinos</T>
      {events.length === 0 && <T variant="muted">Nenhum treino marcado.</T>}
      {events.map((e) => (
        <Card key={e.id} onPress={() => router.push({ pathname: '/evento/[id]', params: { id: e.id } })}>
          <T variant="body" style={{ fontWeight: '700' }}>{formatDay(e.starts_at)} · {formatTime(e.starts_at)}–{formatTime(e.ends_at)}</T>
        </Card>
      ))}

      <T variant="subtitle">Atletas</T>
      {members.length === 0 && <Notice tone="info" text="Nenhum atleta neste time ainda. Use Convidar para este time." />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {members.map((m) => {
          const a = m.athletes!;
          return (
            <Card key={a.id} style={{ flexGrow: 1, flexBasis: 260 }} onPress={() => router.push({ pathname: '/atleta/[id]', params: { id: a.id } })}>
              <T variant="body" style={{ fontWeight: '700' }}>{a.full_name}{a.is_demo ? ' · fictício' : ''}</T>
              <T variant="small">{ageOn(new Date(a.birth_date + 'T12:00:00'))} anos</T>
              <View style={styles.wrap}>
                {a.profile_id ? <Badge label="Com conta" tone="success" /> : <Badge label="Sem conta" />}
                {a.status === 'pending_consent' && <Badge label="Aguardando autorização" tone="warning" />}
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
