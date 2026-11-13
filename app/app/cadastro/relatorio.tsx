// Relatório de frequência para prestação de contas (gestor e treinador).
import { DateField } from '@/components/date-field';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, Field, Notice, Screen, T, styles } from '@/components/ui';
import { toFriendlyError } from '@/lib/errors';
import { parseBrDate, toIsoDate } from '@/lib/format';
import { useMe } from '@/lib/me';
import { useTeams } from '@/lib/queries';
import { buildRows, summarize, type ReportData } from '@/lib/report';
import { exportCsv, exportPdf, fetchReport } from '@/lib/report-export';

const pad = (n: number) => String(n).padStart(2, '0');
const br = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

export default function Relatorio() {
  const { org, isStaff } = useMe();
  const teams = useTeams(org?.id);
  const today = new Date();
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [proponent, setProponent] = useState('');
  const [from, setFrom] = useState(br(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(br(today));
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);

  useEffect(() => {
    if (teams.data && teamIds.length === 0) setTeamIds(teams.data.map((t) => t.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams.data]);

  if (!isStaff) return <Screen><Notice tone="danger" text="Apenas gestor ou treinador podem gerar relatórios." /></Screen>;

  const toggle = (id: string) => setTeamIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const load = async (): Promise<ReportData | null> => {
    setError(null);
    setLast(null);
    const f = parseBrDate(from), t = parseBrDate(to);
    if (name.trim().length < 3) { setError('Informe o nome do projeto.'); return null; }
    if (!f || !t) { setError('Confira as datas do período (dd/mm/aaaa).'); return null; }
    if (t < f) { setError('A data final precisa ser depois da data inicial.'); return null; }
    if (teamIds.length === 0) { setError('Escolha pelo menos uma equipe.'); return null; }
    setBusy('Buscando os registros...');
    const data = await fetchReport({
      orgId: org!.id, teamIds, from: toIsoDate(f), to: toIsoDate(t),
      project: { name: name.trim(), number: number.trim() || undefined, proponent: proponent.trim() || undefined },
    });
    if (data.events.length === 0) {
      setBusy(null);
      setError('Nenhum treino encerrado nesse período para as equipes escolhidas.');
      return null;
    }
    return data;
  };

  const run = async (kind: 'pdf' | 'csv') => {
    try {
      const data = await load();
      if (!data) return;
      const s = summarize(buildRows(data));
      const present = s.reduce((a, x) => a + x.present, 0), expected = s.reduce((a, x) => a + x.expected, 0);
      if (kind === 'pdf') await exportPdf(data, setBusy);
      else { setBusy('Montando a planilha...'); await exportCsv(data); }
      setLast(`${data.events.length} treino(s), ${s.length} atleta(s), ${present} presença(s) de ${expected} previstas.`);
    } catch (e) {
      setError(toFriendlyError(e).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Relatório de frequência' }} />
      <T variant="muted">Para prestação de contas de projetos incentivados e patrocinadores. Cada registro sai com hora do servidor, GPS, distância do local, foto e código de verificação.</T>

      <Card>
        <Field label="Nome do projeto" placeholder="Ex.: Vôlei para Todos 2026" value={name} onChangeText={setName} maxLength={120} />
        <Field label="Número do projeto (opcional)" placeholder="Ex.: 58000.012345/2026-00" value={number} onChangeText={setNumber} maxLength={60} />
        <Field label="Entidade proponente (opcional)" placeholder={org?.name} value={proponent} onChangeText={setProponent} maxLength={120} />
      </Card>

      <Card>
        <T variant="subtitle">Período</T>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><DateField mode="date" label="De" value={from} onChange={(v) => setFrom(v)} /></View>
          <View style={{ flex: 1 }}><DateField mode="date" label="Até" value={to} onChange={(v) => setTo(v)} /></View>
        </View>
        <T variant="small">Entram só treinos já encerrados.</T>
      </Card>

      <Card>
        <T variant="subtitle">Equipes</T>
        <View style={styles.wrap}>
          {(teams.data ?? []).map((t) => <Chip key={t.id} label={t.name} selected={teamIds.includes(t.id)} onPress={() => toggle(t.id)} />)}
        </View>
      </Card>

      <Notice tone="info" text="O relatório tem nomes e fotos de atletas menores de idade. Envie apenas ao órgão ou patrocinador da prestação de contas. Cada relatório gerado fica registrado." />
      {error && <Notice tone="danger" text={error} />}
      {last && <Notice tone="success" text={`Relatório gerado: ${last}`} />}
      {busy && <T variant="muted" style={{ textAlign: 'center' }}>{busy}</T>}

      <Button title="Gerar PDF com fotos" kind="accent" big loading={Boolean(busy)} onPress={() => run('pdf')} />
      <Button title="Gerar planilha (Excel)" kind="outline" disabled={Boolean(busy)} onPress={() => run('csv')} />
    </Screen>
  );
}
