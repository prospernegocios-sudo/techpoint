// Patrocinadores do projeto. O acesso individual de cada patrocinador chega com o painel web (decisão D47).
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Button, Card, Field, Loading, Notice, Screen, T } from '@/components/ui';
import { toFriendlyError } from '@/lib/errors';
import { useMe } from '@/lib/me';
import { useProject } from '@/lib/projects';
import { supabase } from '@/lib/supabase';

export default function Patrocinadores() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isManager } = useMe();
  const project = useProject(id);
  const qc = useQueryClient();
  const [f, setF] = useState({ name: '', document: '', contact_name: '', contact_email: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (project.isLoading) return <Loading />;
  if (!project.data) return <Screen><Notice tone="danger" text="Projeto não encontrado." /></Screen>;
  const { project: p, sponsors } = project.data;
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const add = async () => {
    setError(null);
    if (f.name.trim().length < 2) return setError('Informe o nome do patrocinador.');
    const email = f.contact_email.trim().toLowerCase();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return setError('Confira o e-mail do contato.');
    setBusy(true);
    const { error: e } = await supabase.from('project_sponsors').insert({
      org_id: p.org_id, project_id: p.id, name: f.name.trim(), document: f.document.trim() || null,
      contact_name: f.contact_name.trim() || null, contact_email: email || null,
    });
    setBusy(false);
    if (e) return setError(toFriendlyError(e).message);
    setF({ name: '', document: '', contact_name: '', contact_email: '' });
    qc.invalidateQueries({ queryKey: ['project', id] });
  };

  const remove = (sid: string, name: string) =>
    Alert.alert('Remover patrocinador?', name, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => { await supabase.from('project_sponsors').delete().eq('id', sid); qc.invalidateQueries({ queryKey: ['project', id] }); } },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Patrocinadores' }} />
      <Notice tone="info" text="Em breve, cada patrocinador terá acesso próprio para ver só os projetos que patrocina, depois que o consentimento dos responsáveis estiver no app." />
      {error && <Notice tone="danger" text={error} />}
      {sponsors.length === 0 && <T variant="muted">Nenhum patrocinador cadastrado.</T>}
      {sponsors.map((s) => (
        <Card key={s.id}>
          <T variant="subtitle">{s.name}</T>
          {s.document && <T variant="small">CNPJ {s.document}</T>}
          {(s.contact_name || s.contact_email) && <T variant="small">Contato: {[s.contact_name, s.contact_email].filter(Boolean).join(' · ')}</T>}
          {isManager && <Button title="Remover" kind="ghost" onPress={() => remove(s.id, s.name)} />}
        </Card>
      ))}
      {isManager && (
        <Card>
          <T variant="subtitle">Novo patrocinador</T>
          <Field label="Nome" value={f.name} onChangeText={set('name')} maxLength={160} />
          <Field label="CNPJ (opcional)" value={f.document} onChangeText={set('document')} maxLength={30} keyboardType="number-pad" />
          <Field label="Nome do contato (opcional)" value={f.contact_name} onChangeText={set('contact_name')} maxLength={120} />
          <Field label="E-mail do contato (opcional)" value={f.contact_email} onChangeText={set('contact_email')} keyboardType="email-address" autoCapitalize="none" />
          <Button title="Adicionar" loading={busy} onPress={add} />
        </Card>
      )}
    </Screen>
  );
}
