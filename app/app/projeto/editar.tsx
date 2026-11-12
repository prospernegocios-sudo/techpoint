// Criar ou editar os dados do projeto (gestor).
import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { Button, Card, Chip, Field, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { toFriendlyError } from '@/lib/errors';
import { maskDate, parseBrDate, toIsoDate } from '@/lib/format';
import { useMe } from '@/lib/me';
import { sphereLabels, statusLabels, useProject, type Project } from '@/lib/projects';
import { isoDayToBr } from '@/lib/report';
import { supabase } from '@/lib/supabase';

export default function EditarProjeto() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { org, isManager } = useMe();
  const existing = useProject(id);
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: '', process_number: '', agency: 'Ministério do Esporte', program: 'Lei de Incentivo ao Esporte', proponent: '',
    starts: '', ends: '', notes: '', minPct: '',
  });
  const [sphere, setSphere] = useState<Project['sphere']>('federal');
  const [status, setStatus] = useState<Project['status']>('draft');
  const [free, setFree] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = existing.data?.project;
    if (!p) return;
    setF({
      name: p.name, process_number: p.process_number ?? '', agency: p.agency ?? '', program: p.program ?? '', proponent: p.proponent ?? '',
      starts: isoDayToBr(p.starts_on), ends: isoDayToBr(p.ends_on), notes: p.notes ?? '', minPct: p.public_school_min_pct?.toString() ?? '',
    });
    setSphere(p.sphere);
    setStatus(p.status);
    setFree(p.free_of_charge);
  }, [existing.data]);

  if (!isManager) return <Screen><Notice tone="danger" text="Apenas o gestor cadastra projetos." /></Screen>;
  if (id && existing.isLoading) return <Loading />;

  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setError(null);
    const s = parseBrDate(f.starts), e = parseBrDate(f.ends);
    if (f.name.trim().length < 3) return setError('Informe o nome do projeto.');
    if (!s || !e) return setError('Confira as datas de vigência (dd/mm/aaaa).');
    if (e < s) return setError('O fim da vigência precisa ser depois do início.');
    const minPct = f.minPct.trim() ? Number(f.minPct) : null;
    if (minPct != null && (!Number.isInteger(minPct) || minPct < 0 || minPct > 100)) return setError('A cota mínima de escola pública deve ser um número de 0 a 100.');
    const row = {
      org_id: org!.id, name: f.name.trim(), process_number: f.process_number.trim() || null, sphere, agency: f.agency.trim() || null,
      program: f.program.trim() || null, proponent: f.proponent.trim() || null, starts_on: toIsoDate(s), ends_on: toIsoDate(e),
      status, free_of_charge: free, public_school_min_pct: minPct, notes: f.notes.trim() || null,
    };
    setSaving(true);
    const r = id
      ? await supabase.from('projects').update(row).eq('id', id).select('id').single()
      : await supabase.from('projects').insert(row).select('id').single();
    setSaving(false);
    if (r.error) return setError(toFriendlyError(r.error).message);
    qc.invalidateQueries({ queryKey: ['projects'] });
    qc.invalidateQueries({ queryKey: ['project', id] });
    qc.invalidateQueries({ queryKey: ['indicators', id] });
    if (id) router.back();
    else router.replace({ pathname: '/projeto/[id]', params: { id: (r.data as { id: string }).id } });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Editar projeto' : 'Novo projeto' }} />
      <Card>
        <Field label="Nome do projeto" value={f.name} onChangeText={set('name')} maxLength={160} placeholder="Ex.: Vôlei para Todos 2026" />
        <Field label="Número do processo (opcional)" value={f.process_number} onChangeText={set('process_number')} maxLength={80} />
        <Field label="Entidade proponente" value={f.proponent} onChangeText={set('proponent')} maxLength={160} placeholder={org?.name} />
      </Card>
      <Card>
        <T variant="subtitle">Esfera</T>
        <View style={styles.wrap}>
          {(Object.keys(sphereLabels) as Project['sphere'][]).map((k) => <Chip key={k} label={sphereLabels[k]} selected={sphere === k} onPress={() => setSphere(k)} />)}
        </View>
        <Field label="Órgão" value={f.agency} onChangeText={set('agency')} maxLength={160} />
        <Field label="Programa" value={f.program} onChangeText={set('program')} maxLength={160} />
      </Card>
      <Card>
        <T variant="subtitle">Vigência</T>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label="Início" keyboardType="number-pad" value={f.starts} onChangeText={(v) => set('starts')(maskDate(v))} placeholder="dd/mm/aaaa" /></View>
          <View style={{ flex: 1 }}><Field label="Fim" keyboardType="number-pad" value={f.ends} onChangeText={(v) => set('ends')(maskDate(v))} placeholder="dd/mm/aaaa" /></View>
        </View>
        <T variant="subtitle">Situação</T>
        <View style={styles.wrap}>
          {(Object.keys(statusLabels) as Project['status'][]).map((k) => <Chip key={k} label={statusLabels[k]} selected={status === k} onPress={() => setStatus(k)} />)}
        </View>
      </Card>
      <Card>
        <T variant="subtitle">Regras do instrumento</T>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <T variant="body" style={{ flex: 1 }}>Participação gratuita para o beneficiário</T>
          <Switch value={free} onValueChange={setFree} accessibilityLabel="Participação gratuita" />
        </View>
        <Field label="Mínimo de alunos de escola pública (%) — deixe vazio se não se aplica" keyboardType="number-pad" value={f.minPct} onChangeText={set('minPct')} maxLength={3} />
        <Field label="Observações" value={f.notes} onChangeText={set('notes')} multiline maxLength={2000} />
      </Card>
      {error && <Notice tone="danger" text={error} />}
      <Button title="Salvar" loading={saving} onPress={save} />
    </Screen>
  );
}
