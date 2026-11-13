// Metas do plano: cadastro (gestor) e lançamento de resultado das metas manuais.
import { DateField } from '@/components/date-field';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Badge, Button, Card, Chip, Field, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { toFriendlyError } from '@/lib/errors';
import { parseBrDate, toIsoDate } from '@/lib/format';
import { useMe } from '@/lib/me';
import { goalKindLabels, num, pct, useIndicators, useProject, type GoalKind } from '@/lib/projects';
import { supabase } from '@/lib/supabase';

const kinds = Object.keys(goalKindLabels) as GoalKind[];

export default function Metas() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isManager } = useMe();
  const project = useProject(id);
  const ind = useIndicators(id);
  const qc = useQueryClient();
  const [form, setForm] = useState({ code: '', description: '', indicator: '', unit: '', target: '', verifier: '' });
  const [kind, setKind] = useState<GoalKind>('unique_beneficiaries');
  const [entry, setEntry] = useState<{ goalId: string; value: string; date: string; note: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (project.isLoading) return <Loading />;
  if (!project.data) return <Screen><Notice tone="danger" text="Projeto não encontrado." /></Screen>;
  const { project: p, goals, plans } = project.data;
  const results = new Map((ind.data?.goals ?? []).map((g) => [g.id, g]));
  const refresh = () => { qc.invalidateQueries({ queryKey: ['project', id] }); qc.invalidateQueries({ queryKey: ['indicators', id] }); };
  const set = (k: keyof typeof form) => (v: string) => setForm((x) => ({ ...x, [k]: v }));

  const addGoal = async () => {
    setError(null);
    if (form.description.trim().length < 3) return setError('Descreva a meta.');
    const target = form.target.trim() ? Number(form.target.replace(',', '.')) : null;
    if (target != null && Number.isNaN(target)) return setError('O alvo precisa ser um número.');
    setBusy(true);
    const { error: e } = await supabase.from('project_goals').insert({
      org_id: p.org_id, project_id: p.id, plan_version_id: plans[0]?.id ?? null, code: form.code.trim() || null,
      description: form.description.trim(), indicator: form.indicator.trim() || null, kind,
      unit: form.unit.trim() || (kind === 'avg_frequency' ? '%' : null), target, verifier: form.verifier.trim() || null,
    });
    setBusy(false);
    if (e) return setError(toFriendlyError(e).message);
    setForm({ code: '', description: '', indicator: '', unit: '', target: '', verifier: '' });
    refresh();
  };

  const deactivate = (goalId: string) => {
    Alert.alert('Desativar meta?', 'Ela deixa de aparecer nos próximos relatórios. Os relatórios já emitidos não mudam.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desativar', style: 'destructive', onPress: async () => { await supabase.from('project_goals').update({ active: false }).eq('id', goalId); refresh(); } },
    ]);
  };

  const saveEntry = async () => {
    if (!entry) return;
    setError(null);
    const value = Number(entry.value.replace(',', '.'));
    const d = parseBrDate(entry.date);
    if (Number.isNaN(value) || !entry.value.trim()) return setError('Informe o resultado (número).');
    if (!d) return setError('Confira a data de referência (dd/mm/aaaa).');
    setBusy(true);
    const { error: e } = await supabase.from('project_goal_entries').insert({
      org_id: p.org_id, goal_id: entry.goalId, value, reference_date: toIsoDate(d), note: entry.note.trim() || null,
    });
    setBusy(false);
    if (e) return setError(toFriendlyError(e).message);
    setEntry(null);
    refresh();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Metas' }} />
      <T variant="muted">Metas com apuração automática são calculadas pelas presenças. Metas "lançadas manualmente" recebem o resultado do gestor, que fica registrado e não pode ser apagado.</T>
      {error && <Notice tone="danger" text={error} />}

      {goals.filter((g) => g.active).map((g) => {
        const r = results.get(g.id);
        return (
          <Card key={g.id}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <T variant="subtitle" style={{ flex: 1 }}>{g.code ? `${g.code} · ` : ''}{g.description}</T>
              {r?.reached != null && <Badge label={r.reached ? 'Alcançada' : 'Abaixo'} tone={r.reached ? 'success' : 'warning'} />}
            </View>
            {g.indicator && <T variant="small">Indicador: {g.indicator}</T>}
            <T variant="small">Apuração: {goalKindLabels[g.kind]}</T>
            <T variant="body">Resultado: <T variant="body" style={{ fontWeight: '700' }}>{r ? (g.kind === 'avg_frequency' ? pct(r.result) : num(r.result)) : '...'}</T> de {num(g.target)} {g.unit ?? ''}</T>
            {g.verifier && <T variant="small">Verificador: {g.verifier}</T>}
            {isManager && g.kind === 'manual' && <Button title="Lançar resultado" kind="outline" onPress={() => setEntry({ goalId: g.id, value: '', date: '', note: '' })} />}
            {isManager && <Button title="Desativar meta" kind="ghost" onPress={() => deactivate(g.id)} />}
            {entry?.goalId === g.id && (
              <View style={{ gap: 8 }}>
                <Field label="Resultado" keyboardType="decimal-pad" value={entry.value} onChangeText={(v) => setEntry({ ...entry, value: v })} />
                <DateField mode="date" label="Data de referência" value={entry.date} onChange={(v) => setEntry({ ...entry, date: v })} />
                <Field label="Observação / evidência" value={entry.note} onChangeText={(v) => setEntry({ ...entry, note: v })} multiline maxLength={1000} />
                <Button title="Salvar resultado" loading={busy} onPress={saveEntry} />
                <Button title="Cancelar" kind="ghost" onPress={() => setEntry(null)} />
              </View>
            )}
          </Card>
        );
      })}

      {isManager && (
        <Card>
          <T variant="subtitle">Nova meta</T>
          <Field label="Código (ex.: Meta 1)" value={form.code} onChangeText={set('code')} maxLength={30} />
          <Field label="Descrição da meta" value={form.description} onChangeText={set('description')} multiline maxLength={500} />
          <Field label="Indicador (como está no plano)" value={form.indicator} onChangeText={set('indicator')} maxLength={300} />
          <T variant="small">Como apurar o resultado</T>
          <View style={styles.wrap}>{kinds.map((k) => <Chip key={k} label={goalKindLabels[k]} selected={kind === k} onPress={() => setKind(k)} />)}</View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Alvo" keyboardType="decimal-pad" value={form.target} onChangeText={set('target')} /></View>
            <View style={{ flex: 1 }}><Field label="Unidade" value={form.unit} onChangeText={set('unit')} maxLength={40} placeholder={kind === 'avg_frequency' ? '%' : 'pessoas'} /></View>
          </View>
          <Field label="Verificador (meio de comprovação)" value={form.verifier} onChangeText={set('verifier')} maxLength={300} />
          <Button title="Adicionar meta" loading={busy} onPress={addGoal} />
        </Card>
      )}
    </Screen>
  );
}
