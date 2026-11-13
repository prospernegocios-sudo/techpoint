// Equipes e categorias.
import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, Field, Notice, Screen, T, styles } from '@/components/ui';
import { toFriendlyError } from '@/lib/errors';
import { useMe } from '@/lib/me';
import { useTeams } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

const categories = ['Sub 11', 'Sub 13', 'Sub 15', 'Sub 17', 'Sub 19', 'Adulto'];

export default function Equipes() {
  const { org, isManager } = useMe();
  const teams = useTeams(org?.id);
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (name.trim().length < 2) return setError('Dê um nome à equipe.');
    setSaving(true);
    setError(null);
    const { data: sport } = await supabase.from('sports').select('id').eq('name', 'Vôlei').is('org_id', null).maybeSingle();
    const { error: e } = await supabase.from('teams').insert({ org_id: org!.id, name: name.trim(), category, sport_id: sport?.id ?? null, season: String(new Date().getFullYear()) });
    setSaving(false);
    if (e) return setError(toFriendlyError(e).message);
    setName('');
    setCategory(null);
    qc.invalidateQueries({ queryKey: ['teams'] });
  };

  if (!isManager) return <Screen><Notice tone="danger" text="Apenas o gestor cadastra equipes." /></Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Equipes' }} />
      <Card>
        <T variant="subtitle">Nova equipe</T>
        <Field label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Sub 15 Feminino" />
        <T variant="small">Categoria</T>
        <View style={styles.wrap}>
          {categories.map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(category === c ? null : c)} />)}
        </View>
        {error && <Notice tone="danger" text={error} />}
        <Button title="Criar equipe" loading={saving} onPress={save} />
      </Card>
      {teams.data?.length === 0 && <Notice tone="info" text="Nenhuma equipe ainda. Crie a primeira acima (ex.: Sub 15 Masculino)." />}
      {(teams.data ?? []).map((t) => (
        <Card key={t.id}>
          <T variant="subtitle">{t.name}</T>
          {t.category && <T variant="muted">{t.category}</T>}
        </Card>
      ))}
    </Screen>
  );
}
