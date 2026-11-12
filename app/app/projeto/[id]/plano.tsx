// Plano de trabalho aprovado: versões com o PDF anexado. Versões não são alteradas nem apagadas.
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking } from 'react-native';
import { Button, Card, Field, Loading, Notice, Screen, T } from '@/components/ui';
import { toFriendlyError } from '@/lib/errors';
import { maskDate, parseBrDate, toIsoDate } from '@/lib/format';
import { useMe } from '@/lib/me';
import { signedProjectFileUrl, uploadPlanFile, useProject } from '@/lib/projects';
import { isoDayToBr } from '@/lib/report';
import { supabase } from '@/lib/supabase';

export default function Plano() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isManager } = useMe();
  const project = useProject(id);
  const qc = useQueryClient();
  const [approved, setApproved] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<{ uri: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (project.isLoading) return <Loading />;
  if (!project.data) return <Screen><Notice tone="danger" text="Projeto não encontrado." /></Screen>;
  const { project: p, plans } = project.data;
  const next = (plans[0]?.version ?? 0) + 1;

  const pick = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (!r.canceled && r.assets[0]) {
      if ((r.assets[0].size ?? 0) > 20 * 1024 * 1024) return setError('O PDF pode ter no máximo 20 MB.');
      setFile({ uri: r.assets[0].uri, name: r.assets[0].name });
    }
  };

  const save = async () => {
    setError(null);
    const d = approved ? parseBrDate(approved) : null;
    if (approved && !d) return setError('Confira a data de aprovação (dd/mm/aaaa).');
    setBusy(true);
    try {
      const path = file ? await uploadPlanFile(p.org_id, p.id, next, file.uri) : null;
      const { error: e } = await supabase.from('project_plan_versions').insert({
        org_id: p.org_id, project_id: p.id, version: next, approved_on: d ? toIsoDate(d) : null,
        description: description.trim() || null, file_path: path,
      });
      if (e) throw e;
      setApproved(''); setDescription(''); setFile(null);
      qc.invalidateQueries({ queryKey: ['project', id] });
    } catch (e) {
      setError(toFriendlyError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const open = async (path: string) => {
    const url = await signedProjectFileUrl(path);
    if (url) Linking.openURL(url);
    else setError('Não foi possível abrir o arquivo agora.');
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Plano de trabalho' }} />
      <T variant="muted">Cada alteração autorizada do plano vira uma nova versão. As versões anteriores ficam guardadas e não podem ser mudadas.</T>
      {error && <Notice tone="danger" text={error} />}
      {plans.length === 0 && <T variant="muted">Nenhuma versão cadastrada.</T>}
      {plans.map((v) => (
        <Card key={v.id}>
          <T variant="subtitle">Versão {v.version}{v === plans[0] ? ' (vigente)' : ''}</T>
          <T variant="small">{v.approved_on ? `Aprovada em ${isoDayToBr(v.approved_on)}` : 'Data de aprovação não informada'}</T>
          {v.description && <T variant="body">{v.description}</T>}
          {v.file_path ? <Button title="Abrir PDF do plano" kind="outline" onPress={() => open(v.file_path!)} /> : <T variant="small">Sem PDF anexado.</T>}
        </Card>
      ))}
      {isManager && (
        <Card>
          <T variant="subtitle">Cadastrar versão {next}</T>
          <Field label="Data de aprovação" keyboardType="number-pad" placeholder="dd/mm/aaaa" value={approved} onChangeText={(v) => setApproved(maskDate(v))} />
          <Field label="O que mudou / observações" value={description} onChangeText={setDescription} multiline maxLength={1000} />
          <Button title={file ? `PDF: ${file.name}` : 'Escolher PDF do plano'} kind="outline" onPress={pick} />
          <Button title={`Salvar versão ${next}`} loading={busy} onPress={save} />
        </Card>
      )}
    </Screen>
  );
}
