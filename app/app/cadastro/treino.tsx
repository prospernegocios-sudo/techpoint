// Novo treino (único). Treinos recorrentes chegam na Fase 3.
import { useQueryClient } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Card, Chip, Field, Notice, Screen, T, styles } from '@/components/ui';
import { toFriendlyError } from '@/lib/errors';
import { maskDate, maskTime, parseBrDate, parseTime } from '@/lib/format';
import { useMe } from '@/lib/me';
import { useTeams, useVenues } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

const durations = [60, 90, 120];

export default function NovoTreino() {
  const { org, isStaff } = useMe();
  const teams = useTeams(org?.id);
  const venues = useVenues(org?.id);
  const qc = useQueryClient();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(90);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const create = async (start: Date) => {
    if (!teamId || !venueId) return setError('Escolha a equipe e o local.');
    setSaving(true);
    setError(null);
    const end = new Date(start.getTime() + duration * 60_000);
    const team = teams.data?.find((t) => t.id === teamId);
    const { error: e } = await supabase.from('events').insert({
      org_id: org!.id, team_id: teamId, venue_id: venueId, type: 'training',
      title: `Treino ${team?.category ?? team?.name ?? ''}`.trim(), starts_at: start.toISOString(), ends_at: end.toISOString(),
    });
    setSaving(false);
    if (e) return setError(toFriendlyError(e).message);
    qc.invalidateQueries({ queryKey: ['events'] });
    Alert.alert('Treino criado', 'O treino já aparece na agenda dos atletas da equipe.');
    router.back();
  };

  const save = () => {
    const d = parseBrDate(date);
    const t = parseTime(time);
    if (!d || !t) return setError('Informe data (dd/mm/aaaa) e horário (hh:mm).');
    d.setHours(t[0], t[1], 0, 0);
    create(d);
  };

  // Atalho para testar: começa daqui a 5 minutos (check-in já liberado).
  const testNow = () => create(new Date(Date.now() + 5 * 60_000));

  if (!isStaff) return <Screen><Notice tone="danger" text="Apenas gestor ou treinador criam treinos." /></Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Novo treino' }} />
      <T variant="small">Equipe</T>
      <View style={styles.wrap}>
        {(teams.data ?? []).map((t) => <Chip key={t.id} label={t.name} selected={teamId === t.id} onPress={() => setTeamId(t.id)} />)}
      </View>
      <T variant="small">Local</T>
      <View style={styles.wrap}>
        {(venues.data ?? []).map((v) => <Chip key={v.id} label={v.name} selected={venueId === v.id} onPress={() => setVenueId(v.id)} />)}
      </View>
      {venues.data?.length === 0 && <Notice text="Cadastre um local antes (Gestão > Locais de treino)." />}
      <T variant="small">Duração</T>
      <View style={styles.wrap}>
        {durations.map((m) => <Chip key={m} label={m === 60 ? '1h' : m === 90 ? '1h30' : '2h'} selected={duration === m} onPress={() => setDuration(m)} />)}
      </View>
      <Card>
        <Field label="Data" value={date} onChangeText={(t) => setDate(maskDate(t))} placeholder="dd/mm/aaaa" keyboardType="number-pad" />
        <Field label="Horário de início" value={time} onChangeText={(t) => setTime(maskTime(t))} placeholder="hh:mm" keyboardType="number-pad" />
        <Button title="Criar treino" loading={saving} onPress={save} />
      </Card>
      {error && <Notice tone="danger" text={error} />}
      <Card>
        <T variant="subtitle">Para testar agora</T>
        <T variant="muted">Cria um treino que começa em 5 minutos, com o check-in já liberado.</T>
        <Button title="Criar treino de teste agora" kind="outline" loading={saving} onPress={testNow} />
      </Card>
    </Screen>
  );
}
