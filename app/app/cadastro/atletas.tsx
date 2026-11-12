// Atletas: lista e cadastro. Com o e-mail Google do atleta (10 anos ou mais),
// a conta dele é ligada automaticamente ao cadastro no primeiro login.
import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, Chip, Field, Notice, Screen, T, styles } from '@/components/ui';
import { toFriendlyError } from '@/lib/errors';
import { ageOn, maskDate, parseBrDate, toIsoDate } from '@/lib/format';
import { useMe } from '@/lib/me';
import { useAthletes, useTeams } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

const MIN_ACCOUNT_AGE = 10;

export default function Atletas() {
  const { org, isStaff } = useMe();
  const athletes = useAthletes(org?.id);
  const teams = useTeams(org?.id);
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [email, setEmail] = useState('');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  const birthDate = parseBrDate(birth);
  const age = birthDate ? ageOn(birthDate) : null;

  const save = async () => {
    setError(null);
    if (name.trim().length < 2) return setError('Informe o nome do atleta.');
    if (!birthDate || age === null || age < 3 || age > 100) return setError('Data de nascimento inválida. Use o formato dd/mm/aaaa.');
    const mail = email.trim().toLowerCase();
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return setError('E-mail inválido.');
    if (mail && age < MIN_ACCOUNT_AGE) return setError(`Atletas com menos de ${MIN_ACCOUNT_AGE} anos não têm conta própria. Deixe o e-mail em branco: o treinador registra a presença.`);
    if (!teamId) return setError('Escolha a equipe.');
    setSaving(true);
    const { data, error: e } = await supabase
      .from('athletes')
      .insert({ org_id: org!.id, full_name: name.trim(), birth_date: toIsoDate(birthDate), email: mail || null })
      .select('id')
      .single();
    if (!e && data) {
      const { error: e2 } = await supabase.from('team_members').insert({ team_id: teamId, athlete_id: data.id });
      if (e2) setError(toFriendlyError(e2).message);
    }
    setSaving(false);
    if (e) return setError(toFriendlyError(e).message);
    setName(''); setBirth(''); setEmail(''); setAdding(false);
    qc.invalidateQueries({ queryKey: ['athletes'] });
  };

  if (!isStaff) return <Screen><Notice tone="danger" text="Apenas gestor ou treinador gerenciam atletas." /></Screen>;

  const list = (athletes.data ?? []).filter((a) => !filter || a.team_members.some((t) => t.team_id === filter));
  const teamName = (id: string) => teams.data?.find((t) => t.id === id)?.name ?? '';

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Atletas' }} />
      {adding ? (
        <Card>
          <T variant="subtitle">Novo atleta</T>
          <Field label="Nome completo" value={name} onChangeText={setName} />
          <Field label="Data de nascimento" value={birth} onChangeText={(t) => setBirth(maskDate(t))} placeholder="dd/mm/aaaa" keyboardType="number-pad"
            hint={age !== null ? `${age} anos` : undefined} />
          <Field label="E-mail Google do atleta (opcional)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
            hint={`Só para ${MIN_ACCOUNT_AGE} anos ou mais. Com ele, o atleta entra no app e faz o próprio check-in.`} />
          <T variant="small">Equipe</T>
          <View style={styles.wrap}>
            {(teams.data ?? []).map((t) => <Chip key={t.id} label={t.name} selected={teamId === t.id} onPress={() => setTeamId(t.id)} />)}
          </View>
          {error && <Notice tone="danger" text={error} />}
          <Button title="Salvar atleta" loading={saving} onPress={save} />
          <Button title="Cancelar" kind="ghost" onPress={() => setAdding(false)} />
        </Card>
      ) : (
        <Button title="+ Novo atleta" onPress={() => setAdding(true)} />
      )}
      <View style={styles.wrap}>
        <Chip label="Todos" selected={!filter} onPress={() => setFilter(null)} />
        {(teams.data ?? []).map((t) => <Chip key={t.id} label={t.name} selected={filter === t.id} onPress={() => setFilter(t.id)} />)}
      </View>
      {athletes.error && <Notice tone="danger" text="Não foi possível carregar os atletas." />}
      {list.map((a) => (
        <Card key={a.id}>
          <T variant="subtitle">{a.full_name}</T>
          <T variant="muted">{ageOn(new Date(a.birth_date + 'T12:00:00'))} anos · {a.team_members.map((t) => teamName(t.team_id)).join(', ') || 'Sem equipe'}</T>
          <View style={styles.wrap}>
            {a.profile_id ? <Badge label="Com conta no app" tone="success" /> : a.email ? <Badge label="Aguardando 1º login" tone="warning" /> : <Badge label="Sem conta" />}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
