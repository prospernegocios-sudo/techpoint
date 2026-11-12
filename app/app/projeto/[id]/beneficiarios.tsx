// Equipes do projeto e beneficiários (entrada, saída com motivo e tipo de escola).
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, Chip, Field, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { toFriendlyError } from '@/lib/errors';
import { maskDate, parseBrDate, toIsoDate } from '@/lib/format';
import { useMe } from '@/lib/me';
import { endReasonLabels, schoolLabels, useProject, type Beneficiary } from '@/lib/projects';
import { useAthletes, useTeams } from '@/lib/queries';
import { isoDayToBr } from '@/lib/report';
import { supabase } from '@/lib/supabase';

const schools = Object.keys(schoolLabels) as Beneficiary['school_type'][];
const reasons = Object.keys(endReasonLabels) as NonNullable<Beneficiary['end_reason']>[];

export default function Beneficiarios() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { org, isManager } = useMe();
  const project = useProject(id);
  const teams = useTeams(org?.id);
  const athletes = useAthletes(org?.id);
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [exit, setExit] = useState<{ athleteId: string; date: string; reason: NonNullable<Beneficiary['end_reason']> } | null>(null);

  if (project.isLoading || teams.isLoading || athletes.isLoading) return <Loading />;
  if (!project.data) return <Screen><Notice tone="danger" text="Projeto não encontrado." /></Screen>;
  const { project: p, teamIds, beneficiaries } = project.data;
  const refresh = () => { qc.invalidateQueries({ queryKey: ['project', id] }); qc.invalidateQueries({ queryKey: ['indicators', id] }); };
  const benIds = new Set(beneficiaries.map((b) => b.athlete_id));
  const candidates = (athletes.data ?? []).filter((a) => !benIds.has(a.id) && a.team_members.some((tm) => teamIds.includes(tm.team_id)));
  const defaultStart = startDate || isoDayToBr(p.starts_on);

  const run = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setError(null);
    const { error: e } = await fn();
    if (e) setError(toFriendlyError(e).message);
    refresh();
  };

  const toggleTeam = (teamId: string) =>
    run(() => (teamIds.includes(teamId)
      ? supabase.from('project_teams').delete().eq('project_id', p.id).eq('team_id', teamId)
      : supabase.from('project_teams').insert({ project_id: p.id, team_id: teamId, org_id: p.org_id })));

  const add = (athleteId: string) => {
    const d = parseBrDate(defaultStart);
    if (!d) return setError('Confira a data de entrada (dd/mm/aaaa).');
    run(() => supabase.from('project_beneficiaries').insert({ project_id: p.id, athlete_id: athleteId, org_id: p.org_id, starts_on: toIsoDate(d) }));
  };

  const setSchool = (b: Beneficiary, school: Beneficiary['school_type']) =>
    run(() => supabase.from('project_beneficiaries').update({ school_type: school }).eq('project_id', p.id).eq('athlete_id', b.athlete_id));

  const saveExit = () => {
    if (!exit) return;
    const d = parseBrDate(exit.date);
    if (!d) return setError('Confira a data de saída (dd/mm/aaaa).');
    run(() => supabase.from('project_beneficiaries').update({ ends_on: toIsoDate(d), end_reason: exit.reason }).eq('project_id', p.id).eq('athlete_id', exit.athleteId));
    setExit(null);
  };

  const reopen = (b: Beneficiary) =>
    run(() => supabase.from('project_beneficiaries').update({ ends_on: null, end_reason: null }).eq('project_id', p.id).eq('athlete_id', b.athlete_id));

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Equipes e beneficiários' }} />
      {error && <Notice tone="danger" text={error} />}

      <Card>
        <T variant="subtitle">Equipes do projeto (núcleos/turmas)</T>
        <T variant="small">Os treinos destas equipes, dentro da vigência, contam como atividades do projeto.</T>
        <View style={styles.wrap}>
          {(teams.data ?? []).map((t) => (
            <Chip key={t.id} label={t.name} selected={teamIds.includes(t.id)} onPress={isManager ? () => toggleTeam(t.id) : undefined} />
          ))}
        </View>
      </Card>

      <T variant="subtitle">Beneficiários ({beneficiaries.length})</T>
      {beneficiaries.map((b) => (
        <Card key={b.athlete_id}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <T variant="subtitle" style={{ flex: 1 }}>{b.athletes?.full_name}</T>
            {b.ends_on ? <Badge label={`Saiu: ${endReasonLabels[b.end_reason!]}`} /> : <Badge label="Ativo" tone="success" />}
          </View>
          <T variant="small">Entrada {isoDayToBr(b.starts_on)}{b.ends_on ? ` · saída ${isoDayToBr(b.ends_on)}` : ''}</T>
          <View style={styles.wrap}>
            {schools.map((s) => <Chip key={s} label={schoolLabels[s]} selected={b.school_type === s} onPress={isManager ? () => setSchool(b, s) : undefined} />)}
          </View>
          {isManager && !b.ends_on && exit?.athleteId !== b.athlete_id && (
            <Button title="Registrar saída do projeto" kind="ghost" onPress={() => setExit({ athleteId: b.athlete_id, date: '', reason: 'termino' })} />
          )}
          {isManager && b.ends_on && <Button title="Desfazer saída" kind="ghost" onPress={() => reopen(b)} />}
          {exit?.athleteId === b.athlete_id && (
            <View style={{ gap: 8 }}>
              <Field label="Data de saída" keyboardType="number-pad" placeholder="dd/mm/aaaa" value={exit.date} onChangeText={(v) => setExit({ ...exit, date: maskDate(v) })} />
              <View style={styles.wrap}>{reasons.map((r) => <Chip key={r} label={endReasonLabels[r]} selected={exit.reason === r} onPress={() => setExit({ ...exit, reason: r })} />)}</View>
              <Button title="Salvar saída" onPress={saveExit} />
              <Button title="Cancelar" kind="ghost" onPress={() => setExit(null)} />
            </View>
          )}
        </Card>
      ))}

      {isManager && (
        <Card>
          <T variant="subtitle">Adicionar beneficiários</T>
          <T variant="small">Aparecem os atletas das equipes do projeto que ainda não são beneficiários.</T>
          <Field label="Data de entrada" keyboardType="number-pad" placeholder="dd/mm/aaaa" value={defaultStart} onChangeText={(v) => setStartDate(maskDate(v))} />
          {teamIds.length === 0 && <Notice text="Escolha primeiro as equipes do projeto." />}
          {candidates.length === 0 && teamIds.length > 0 && <T variant="muted">Todos os atletas das equipes já são beneficiários.</T>}
          <View style={styles.wrap}>
            {candidates.map((a) => <Chip key={a.id} label={`+ ${a.full_name}`} onPress={() => add(a.id)} />)}
          </View>
          {candidates.length > 1 && <Button title={`Adicionar todos (${candidates.length})`} kind="outline" onPress={() => candidates.forEach((a) => add(a.id))} />}
        </Card>
      )}
    </Screen>
  );
}
