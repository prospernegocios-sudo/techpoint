// Treinos (auditoria, item 13): primeiro o resumo dos treinos; criar só no botão "Criar novo treino".
// A presença de cada treino abre daqui (a aba Presença saiu do menu da equipe).
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Button, Card, Chip, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { formatDay, formatTime } from '@/lib/format';
import { useMe } from '@/lib/me';
import { useEvents, type EventRow } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type View_ = 'hoje' | 'proximos' | 'anteriores';
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export default function Treinos() {
  const me = useMe();
  const { colors } = useTheme();
  const [view, setView] = useState<View_>('hoje');
  const events = useEvents(me.org?.id, 30, 30);
  const all = events.data ?? [];
  const today = dayKey(new Date());
  const now = Date.now();
  const lists: Record<View_, EventRow[]> = {
    hoje: all.filter((e) => dayKey(new Date(e.starts_at)) === today),
    proximos: all.filter((e) => new Date(e.starts_at).getTime() > now && dayKey(new Date(e.starts_at)) !== today),
    anteriores: all.filter((e) => new Date(e.ends_at).getTime() < now && dayKey(new Date(e.starts_at)) !== today).reverse(),
  };
  const list = lists[view];
  const ids = list.map((e) => e.id);
  const counts = useQuery({
    queryKey: ['treinos-counts', ids.join()], enabled: ids.length > 0,
    queryFn: async () => {
      const teamIds = [...new Set(list.map((e) => e.team_id))];
      const [r, m] = await Promise.all([
        supabase.from('attendance_records').select('event_id, status').in('event_id', ids).eq('kind', 'check_in').neq('status', 'rejected'),
        supabase.from('team_members').select('team_id').in('team_id', teamIds),
      ]);
      const recs = (r.data ?? []) as { event_id: string; status: string }[];
      const mem = (m.data ?? []) as { team_id: string }[];
      return Object.fromEntries(list.map((e) => [e.id, {
        present: recs.filter((x) => x.event_id === e.id && x.status === 'valid').length,
        pending: recs.filter((x) => x.event_id === e.id && x.status === 'pending').length,
        expected: mem.filter((x) => x.team_id === e.team_id).length,
      }]));
    },
  });

  if (!me.isStaff) return <Screen><Notice tone="danger" text="Apenas a equipe da entidade vê os treinos." /></Screen>;
  const empty = { hoje: 'Nenhum treino hoje.', proximos: 'Nenhum treino marcado nos próximos 30 dias.', anteriores: 'Nenhum treino nos últimos 30 dias.' }[view];
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Treinos' }} />
      <Button title="Criar novo treino" icon="add" kind="accent" onPress={() => router.push('/cadastro/treino')} />
      <View style={styles.wrap}>
        <Chip label={`Hoje (${lists.hoje.length})`} selected={view === 'hoje'} onPress={() => setView('hoje')} />
        <Chip label={`Próximos (${lists.proximos.length})`} selected={view === 'proximos'} onPress={() => setView('proximos')} />
        <Chip label={`Anteriores (${lists.anteriores.length})`} selected={view === 'anteriores'} onPress={() => setView('anteriores')} />
      </View>
      {events.isLoading && <Loading />}
      {events.error && <Notice tone="danger" text="Não foi possível carregar os treinos. Verifique a internet." />}
      {!events.isLoading && all.length === 0 && <Notice tone="info" text="Ainda não há treinos cadastrados. Toque em “Criar novo treino” para marcar o primeiro." />}
      {!events.isLoading && all.length > 0 && list.length === 0 && <T variant="muted">{empty}</T>}
      {list.map((e) => {
        const c = counts.data?.[e.id];
        const live = now >= new Date(e.starts_at).getTime() && now <= new Date(e.ends_at).getTime();
        return (
          <Card key={e.id} onPress={() => router.push({ pathname: '/evento/[id]', params: { id: e.id } })}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <T variant="subtitle" style={{ flexShrink: 1 }}>{view === 'hoje' ? '' : `${formatDay(e.starts_at)} · `}{formatTime(e.starts_at)}–{formatTime(e.ends_at)}</T>
              {live ? <Badge label="Agora" tone="success" /> : <Badge label={e.type === 'match' ? 'Jogo' : 'Treino'} tone="primary" />}
            </View>
            <T variant="muted">{e.teams?.name} · {e.venues?.name}</T>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>
                {c ? `${c.present} de ${c.expected} presentes${c.pending ? ` · ${c.pending} para aprovar` : ''}` : ' '}
              </Text>
              <View style={[styles.row, { gap: 4 }]}>
                <T variant="small" color={colors.primary} style={{ fontWeight: '700' }}>Lista de presença</T>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </View>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
