// Nova organização (somente admin da plataforma).
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Button, Field, Notice, Screen, T } from '@/components/ui';
import { toFriendlyError } from '@/lib/errors';
import { useMe } from '@/lib/me';
import { supabase } from '@/lib/supabase';

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export default function NovaOrganizacao() {
  const { isPlatformAdmin, profile, refetch } = useMe();
  const [name, setName] = useState('');
  const [managerEmail, setManagerEmail] = useState(profile?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (name.trim().length < 2) return setError('Informe o nome.');
    const mail = managerEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return setError('E-mail do gestor inválido.');
    setSaving(true);
    setError(null);
    const { data, error: e } = await supabase.from('organizations').insert({ name: name.trim(), slug: slugify(name) }).select('id').single();
    if (!e && data) {
      const { error: e2 } = await supabase.from('memberships').insert({ org_id: data.id, invited_email: mail, role: 'manager' });
      if (e2) setError(toFriendlyError(e2).message);
    }
    setSaving(false);
    if (e) return setError(/duplicate|unique/i.test(e.message) ? 'Já existe uma organização com esse nome.' : toFriendlyError(e).message);
    refetch();
    Alert.alert('Organização criada', `O gestor (${mail}) já pode entrar no app.`);
    router.back();
  };

  if (!isPlatformAdmin) return <Screen><Notice tone="danger" text="Apenas o administrador da plataforma cria organizações." /></Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Nova organização' }} />
      <T variant="muted">Cada organização (clube, escola, federação) só enxerga os próprios dados.</T>
      <Field label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Clube Esportivo Brasília" />
      <Field label="E-mail Google do gestor" value={managerEmail} onChangeText={setManagerEmail} autoCapitalize="none" keyboardType="email-address" />
      {error && <Notice tone="danger" text={error} />}
      <Button title="Criar organização" loading={saving} onPress={save} />
    </Screen>
  );
}
