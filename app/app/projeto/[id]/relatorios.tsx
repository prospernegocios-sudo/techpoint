// Relatórios emitidos do projeto: emitir (congela os dados), abrir o PDF e retificar.
import { DateField } from '@/components/date-field';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, Field, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { toFriendlyError } from '@/lib/errors';
import { parseBrDate, toIsoDate } from '@/lib/format';
import { issueReport, loadIssuedReport, useProject, type IssuedReport } from '@/lib/projects';
import { brDateTime, isoDayToBr, type ProjectSnapshot } from '@/lib/report';
import { exportProjectPdf } from '@/lib/report-export';

const pad = (n: number) => String(n).padStart(2, '0');
const br = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

export default function Relatorios() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = useProject(id);
  const qc = useQueryClient();
  const today = new Date();
  const [from, setFrom] = useState(br(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(br(today));
  const [rectify, setRectify] = useState<IssuedReport | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (project.isLoading) return <Loading />;
  if (!project.data) return <Screen><Notice tone="danger" text="Projeto não encontrado." /></Screen>;
  const { project: p, reports, teamIds } = project.data;

  const openPdf = async (r: Pick<IssuedReport, 'id'>) => {
    setError(null);
    setBusy('Abrindo o relatório...');
    try {
      const rep = await loadIssuedReport(r.id);
      await exportProjectPdf(rep.data as ProjectSnapshot, rep.sha256, setBusy);
    } catch (e) {
      setError(toFriendlyError(e).message);
    } finally {
      setBusy(null);
    }
  };

  const issue = async () => {
    setError(null);
    setDone(null);
    let f: string, t: string;
    if (rectify) {
      if (reason.trim().length < 5) return setError('Explique o motivo da retificação.');
      f = rectify.period_from; t = rectify.period_to;
    } else {
      const df = parseBrDate(from), dt = parseBrDate(to);
      if (!df || !dt) return setError('Confira as datas do período (dd/mm/aaaa).');
      if (dt < df) return setError('A data final precisa ser depois da inicial.');
      f = toIsoDate(df); t = toIsoDate(dt);
    }
    setBusy('Emitindo e congelando os dados...');
    try {
      const r = await issueReport(p.id, f, t, rectify?.id, rectify ? reason.trim() : undefined);
      qc.invalidateQueries({ queryKey: ['project', id] });
      setDone(`Relatório nº ${r.number}${r.version > 1 ? ` (versão ${r.version})` : ''} emitido.`);
      setRectify(null);
      setReason('');
      await openPdf({ id: r.id });
    } catch (e) {
      setError(toFriendlyError(e).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Relatórios do projeto' }} />
      <T variant="muted">Ao emitir, os dados do período ficam congelados, com número e impressão digital. Uma correção posterior gera uma retificação, sem apagar o original.</T>
      {teamIds.length === 0 && <Notice text="Ligue as equipes do projeto antes de emitir relatórios." />}
      <Notice tone="info" text="O PDF tem nomes e fotos de atletas menores de idade. Envie apenas ao órgão da prestação de contas ou ao patrocinador do projeto. Cada emissão fica registrada." />
      {error && <Notice tone="danger" text={error} />}
      {done && <Notice tone="success" text={done} />}
      {busy && <T variant="muted" style={{ textAlign: 'center' }}>{busy}</T>}

      <Card>
        <T variant="subtitle">{rectify ? `Retificar o relatório nº ${rectify.number}` : 'Emitir novo relatório'}</T>
        {rectify ? (
          <>
            <T variant="small">Mesmo período ({isoDayToBr(rectify.period_from)} a {isoDayToBr(rectify.period_to)}), com os dados atuais.</T>
            <Field label="Motivo da retificação" value={reason} onChangeText={setReason} multiline maxLength={500} placeholder="Ex.: presença aprovada pelo treinador depois da emissão" />
          </>
        ) : (
          <View style={styles.row}>
            <View style={{ flex: 1 }}><DateField mode="date" label="De" value={from} onChange={(v) => setFrom(v)} /></View>
            <View style={{ flex: 1 }}><DateField mode="date" label="Até" value={to} onChange={(v) => setTo(v)} /></View>
          </View>
        )}
        <Button title={rectify ? 'Emitir retificação' : 'Emitir relatório'} kind="accent" loading={Boolean(busy)} onPress={issue} />
        {rectify && <Button title="Cancelar retificação" kind="ghost" onPress={() => { setRectify(null); setReason(''); }} />}
      </Card>

      <T variant="subtitle">Emitidos</T>
      {reports.length === 0 && <T variant="muted">Nenhum relatório emitido.</T>}
      {reports.map((r) => (
        <Card key={r.id}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <T variant="subtitle">Nº {r.number}{r.version > 1 ? ` · versão ${r.version}` : ''}</T>
            {r.version > 1 ? <Badge label="Retificação" tone="warning" /> : <Badge label="Original" tone="primary" />}
          </View>
          <T variant="small">Período {isoDayToBr(r.period_from)} a {isoDayToBr(r.period_to)} · emitido em {brDateTime(r.issued_at)}</T>
          {r.rectification_reason && <T variant="small">Motivo: {r.rectification_reason}</T>}
          <T variant="small">Impressão digital: {r.sha256.slice(0, 16)}…</T>
          <View style={styles.wrap}>
            <Button title="Abrir PDF" kind="outline" disabled={Boolean(busy)} onPress={() => openPdf(r)} />
            {r.version === Math.max(...reports.filter((x) => x.number === r.number).map((x) => x.version)) && (
              <Button title="Retificar" kind="ghost" disabled={Boolean(busy)} onPress={() => { setRectify(r); setDone(null); }} />
            )}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
