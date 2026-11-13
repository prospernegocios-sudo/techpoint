// Início: atleta vê seus treinos e o botão de check-in/check-out;
// gestor/treinador vê os treinos e abre a lista de presença.
import { useFocusEffect, router } from 'expo-router';
import { Fragment, useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Badge, Button, Card, Chip, Field, Loading, Notice, T, styles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { getQueue, syncQueue } from '@/lib/attendance';
import { formatDay, formatTime } from '@/lib/format';
import { orgLogoUrl, modeLabels, useMe } from '@/lib/me';
import { useSetupSteps, useTeamDashboard } from '@/lib/dashboard';
import { useEvents, useMyAttendance, type AttendanceRow, type EventRow } from '@/lib/queries';
import { useTheme } from '@/lib/theme';

function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString();
}

/** Situação do treino agora: ainda vai começar, acontecendo ou encerrado. */
function eventPhase(ev: EventRow): 'upcoming' | 'live' | 'ended' {
  const now = Date.now();
  if (now < new Date(ev.starts_at).getTime()) return 'upcoming';
  if (now <= new Date(ev.ends_at).getTime()) return 'live';
  return 'ended';
}

type Action = { kind: 'check_in' | 'check_out'; label: string } | null;

function nextAction(ev: EventRow, recs: AttendanceRow[]): { action: Action; status: string } {
  const now = Date.now();
  const start = new Date(ev.starts_at).getTime();
  const end = new Date(ev.ends_at).getTime();
  const ci = recs.find((r) => r.event_id === ev.id && r.kind === 'check_in' && r.status !== 'rejected');
  const co = recs.find((r) => r.event_id === ev.id && r.kind === 'check_out' && r.status !== 'rejected');
  if (co) return { action: null, status: `Saída às ${formatTime(co.server_at)}${co.status === 'pending' ? ' (aguardando treinador)' : ''}` };
  if (ci) {
    const label = `Chegada às ${formatTime(ci.server_at)}${ci.status === 'pending' ? ' (aguardando treinador)' : ''}`;
    if (now >= start && now <= end + 60 * 60_000) return { action: { kind: 'check_out', label: 'Fazer check-out' }, status: label };
    return { action: null, status: label };
  }
  if (now >= start - 30 * 60_000 && now <= start + 30 * 60_000) return { action: { kind: 'check_in', label: 'Fazer check-in' }, status: 'Check-in aberto' };
  // Depois da tolerância continua liberado até o fim do treino, marcado como atrasado (D58).
  if (now > start + 30 * 60_000 && now <= end) return { action: { kind: 'check_in', label: 'Fazer check-in (atrasado)' }, status: 'Treino em andamento: o check-in fica marcado como atrasado' };
  if (now < start - 30 * 60_000) return { action: null, status: `Check-in abre às ${formatTime(new Date(start - 30 * 60_000))}` };
  return { action: null, status: 'Check-in encerrado' };
}

export default function Home() {
  const { colors } = useTheme();
  const me = useMe();
  const events = useEvents(me.org?.id, 0, 7);
  const evIds = (events.data ?? []).map((e) => e.id);
  const isAthlete = me.mode === 'athlete';
  const mine = useMyAttendance(isAthlete ? me.athlete?.id : undefined, evIds);
  const dash = useTeamDashboard(me.org?.id, me.isStaff);
  const setup = useSetupSteps(me.org?.id, me.isManager);
  const [queueInfo, setQueueInfo] = useState<{ pending: number; msg?: string }>({ pending: 0 });
  // Pedido de correção de um registro (o treinador resolve).
  const [corr, setCorr] = useState<{ recordId: string; label: string } | null>(null);
  const [corrReason, setCorrReason] = useState('');
  const [corrMsg, setCorrMsg] = useState<string | null>(null);
  const sendCorrection = async () => {
    if (!corr || !me.athlete || !me.org) return;
    const { error } = await supabase.from('attendance_correction_requests').insert({
      org_id: me.org.id, record_id: corr.recordId, athlete_id: me.athlete.id, reason: corrReason.trim(),
    });
    setCorr(null);
    setCorrReason('');
    setCorrMsg(error ? (/duplicate|unique/i.test(error.message) ? 'Já existe um pedido aberto para este registro.' : 'Não foi possível enviar o pedido agora.') : 'Pedido enviado ao treinador.');
  };

  const refreshQueue = useCallback(async () => {
    const before = (await getQueue()).length;
    if (before === 0) return setQueueInfo({ pending: 0 });
    const r = await syncQueue();
    const msgs: string[] = [];
    if (r.sent) msgs.push(`${r.sent} registro(s) guardado(s) sem internet foram enviados.`);
    r.failed.forEach((f) => msgs.push(`Um registro não pôde ser enviado: ${f.error.message}`));
    setQueueInfo({ pending: r.remaining, msg: msgs.join('\n') || undefined });
    if (r.sent) mine.refetch();
  }, [mine]);

  useFocusEffect(
    useCallback(() => {
      events.refetch();
      refreshQueue();
      const t = setInterval(refreshQueue, 30_000);
      return () => clearInterval(t);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [me.org?.id]),
  );

  if (me.loading) return <Loading />;
  if (me.error) return <View style={{ padding: 16 }}><Notice tone="danger" text="Não foi possível carregar seus dados. Verifique a internet e puxe a tela para baixo." /></View>;

  if (!me.org) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, width: '100%', maxWidth: 1000, alignSelf: 'center' }} style={{ backgroundColor: colors.background }}>
        <T variant="title">Bem-vindo ao TechPoint</T>
        <Notice tone="info" text="Sua conta ainda não está ligada a nenhuma entidade. Peça ao gestor ou treinador para cadastrar o seu e-mail." />
        <Button title="Cadastrar minha entidade" kind="accent" onPress={() => router.push('/entidade/nova')} />
        <T variant="small">Clube, escola ou associação com CNPJ. Você será o administrador e poderá convidar outras pessoas.</T>
        {me.isPlatformAdmin && <Button title="Criar entidade (equipe TechPoint)" kind="outline" onPress={() => router.push('/cadastro/organizacao')} />}
        <Button title="Atualizar" kind="outline" onPress={me.refetch} />
      </ScrollView>
    );
  }

  const list = events.data ?? [];
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 14, width: '100%', maxWidth: 1000, alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={events.isRefetching} onRefresh={() => { events.refetch(); mine.refetch(); me.refetch(); dash.refetch(); setup.refetch(); refreshQueue(); }} />}
    >
      <View style={{ gap: 4 }}>
        <T variant="small">Olá, {me.profile?.full_name?.split(' ')[0] ?? 'atleta'}</T>
        <View style={[styles.row, { alignItems: 'center' }]}>
          {orgLogoUrl(me.org.logo_path) && <Image source={{ uri: orgLogoUrl(me.org.logo_path)! }} style={{ width: 44, height: 44, borderRadius: 10 }} accessibilityLabel={`Logo ${me.org.name}`} />}
          <T variant="title" style={{ flex: 1 }}>{me.org.name}</T>
        </View>
      </View>

      {me.orgs.length > 1 && (
        <View style={styles.wrap}>
          {me.orgs.map((o) => <Chip key={o.id} label={o.name} selected={o.id === me.org?.id} onPress={() => me.setOrgId(o.id)} />)}
        </View>
      )}
      {me.modes.length > 1 && (
        <View style={{ gap: 6 }}>
          <T variant="small">Você está usando o app como:</T>
          <View style={styles.wrap}>
            {me.modes.map((m) => <Chip key={m} label={modeLabels[m]} selected={m === me.mode} onPress={() => me.setMode(m)} />)}
          </View>
        </View>
      )}

      {/* Primeiros passos (entidade nova) */}
      {me.isManager && setup.data && setup.data.some((x) => !x.done) && (
        <Card>
          <T variant="subtitle">Primeiros passos ({setup.data.filter((x) => x.done).length} de {setup.data.length})</T>
          {setup.data.map((x) => (
            <Pressable key={x.key} accessibilityRole="button" onPress={() => !x.done && router.push(x.href as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 }}>
              <Ionicons name={x.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={x.done ? colors.success : colors.textMuted} />
              <T variant="body" style={{ flex: 1, textDecorationLine: x.done ? 'line-through' : 'none', color: x.done ? colors.textMuted : colors.text }}>{x.title}</T>
              {!x.done && <Ionicons name="chevron-forward" size={18} color={colors.primary} />}
            </Pressable>
          ))}
        </Card>
      )}

      {/* Painel do dia da equipe */}
      {me.isStaff && dash.data && (
        <View style={{ gap: 10 }}>
          <T variant="subtitle">Hoje</T>
          <View style={styles.wrap}>
            <Card style={{ flexGrow: 1, flexBasis: 150 }} onPress={dash.data.pendingWeek ? () => { const ev = dash.data!.today.find((t) => t.pending > 0) ?? dash.data!.today[0]; if (ev) router.push({ pathname: '/evento/[id]', params: { id: ev.id } }); } : undefined}>
              <T variant="small">Pendências para aprovar (7 dias)</T>
              <T variant="title" color={dash.data.pendingWeek ? colors.warning : colors.text}>{dash.data.pendingWeek}</T>
            </Card>
            <Card style={{ flexGrow: 1, flexBasis: 150 }}>
              <T variant="small">Treinos hoje</T>
              <T variant="title">{dash.data.today.length}</T>
            </Card>
          </View>
          {dash.data.today.map((t) => (
            <Card key={t.id} onPress={() => router.push({ pathname: '/evento/[id]', params: { id: t.id } })}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <T variant="subtitle" style={{ flex: 1 }}>{formatTime(t.starts_at)} · {t.team}</T>
                <Badge label={`${t.present}/${t.expected} presentes`} tone={t.present ? 'success' : 'muted'} />
              </View>
              {t.pending > 0 && <T variant="small" color={colors.warning}>{t.pending} pendente(s) para aprovar</T>}
              <T variant="small" color={colors.primary}>Abrir lista de presença ›</T>
            </Card>
          ))}
          {dash.data.alerts.length > 0 && (
            <Card>
              <T variant="subtitle">Metas abaixo do alvo</T>
              {dash.data.alerts.slice(0, 5).map((a, i) => (
                <Pressable key={i} accessibilityRole="button" onPress={() => router.push({ pathname: '/projeto/[id]', params: { id: a.projectId } })} style={{ paddingVertical: 4 }}>
                  <T variant="body">{a.goal}</T>
                  <T variant="small">{a.project} · {a.kind === 'avg_frequency' ? `${a.result ?? '—'}%` : a.result ?? '—'} de {a.target ?? '—'} {a.kind === 'avg_frequency' ? '' : a.unit ?? ''}</T>
                </Pressable>
              ))}
            </Card>
          )}
          <T variant="subtitle" style={{ marginTop: 6 }}>Agenda</T>
        </View>
      )}

      {queueInfo.pending > 0 && <Notice tone="warning" text={`${queueInfo.pending} registro(s) guardado(s) no celular. Vamos enviar assim que a internet voltar.`} />}
      {queueInfo.msg && <Notice tone="info" text={queueInfo.msg} />}

      {events.isLoading && <Loading />}
      {events.error && <Notice tone="danger" text="Não foi possível carregar a agenda. Verifique a internet." />}
      {!events.isLoading && list.length === 0 && <T variant="muted">Nenhum treino nos próximos 7 dias.</T>}

      {/* Atleta: cartão fixo do treino de agora, com o botão grande no topo */}
      {isAthlete && me.athlete && (() => {
        const now = list.find((ev) => nextAction(ev, mine.data ?? []).action);
        if (!now) return null;
        const { action, status } = nextAction(now, mine.data ?? []);
        return (
          <Card style={{ borderColor: colors.accent, borderWidth: 2 }}>
            <Badge label="Treino agora" tone="success" />
            <T variant="subtitle">{formatTime(now.starts_at)}–{formatTime(now.ends_at)} · {now.teams?.name}</T>
            <T variant="muted">{now.venues?.name} · {status}</T>
            <Button title={action!.label} kind="accent" big onPress={() => router.push({ pathname: '/checkin/[eventId]', params: { eventId: now.id, kind: action!.kind } })} />
          </Card>
        );
      })()}

      {isAthlete && !me.athlete && (
        <Notice text="Seu cadastro de atleta ainda não está ligado a esta conta. Peça ao gestor para cadastrar seu e-mail do Google no seu cadastro de atleta." />
      )}

      {list.map((ev, i) => {
        const today = isToday(ev.starts_at);
        const prevToday = i > 0 && isToday(list[i - 1].starts_at);
        const sectionTitle = i === 0 ? (today ? 'Hoje' : 'Próximos dias') : prevToday && !today ? 'Próximos dias' : null;
        const phase = eventPhase(ev);
        const title = sectionTitle ? <T variant="subtitle" style={{ marginTop: i === 0 ? 0 : 8 }}>{sectionTitle}</T> : null;
        const header = (
          <>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <T variant="subtitle" style={{ flexShrink: 1 }}>{today ? '' : `${formatDay(ev.starts_at)} · `}{formatTime(ev.starts_at)}–{formatTime(ev.ends_at)}</T>
              {phase === 'live' ? <Badge label="Agora" tone="success" />
                : phase === 'ended' ? <Badge label="Encerrado" tone="muted" />
                : <Badge label={ev.type === 'match' ? 'Jogo' : 'Treino'} tone="primary" />}
            </View>
            <T variant="muted">{ev.teams?.name} · {ev.venues?.name}</T>
          </>
        );
        if (isAthlete) {
          const { action, status } = nextAction(ev, mine.data ?? []);
          return (
            <Fragment key={ev.id}>
            {title}
            <Card>
              {header}
              <T variant="body" style={{ fontWeight: '600' }}>{status}</T>
              {(() => {
                const rec = (mine.data ?? []).filter((r) => r.event_id === ev.id && r.status !== 'rejected').pop();
                return rec ? (
                  <Pressable accessibilityRole="button" onPress={() => setCorr({ recordId: rec.id, label: rec.kind === 'check_in' ? 'chegada' : 'saída' })} style={{ paddingVertical: 4 }}>
                    <T variant="small" color={colors.primary} style={{ fontWeight: '700' }}>Algo errado? Pedir correção ao treinador</T>
                  </Pressable>
                ) : null;
              })()}
              {action && me.athlete && (
                <Button
                  title={action.label}
                  kind="accent"
                  big
                  onPress={() => router.push({ pathname: '/checkin/[eventId]', params: { eventId: ev.id, kind: action.kind } })}
                />
              )}
            </Card>
            </Fragment>
          );
        }
        return (
          <Fragment key={ev.id}>
          {title}
          <Card onPress={() => router.push({ pathname: '/evento/[id]', params: { id: ev.id } })}>
            {header}
            <T variant="small" color={colors.primary}>Toque para ver a lista de presença ›</T>
          </Card>
          </Fragment>
        );
      })}
      {corrMsg && <Notice tone="info" text={corrMsg} />}
      <Modal visible={Boolean(corr)} transparent animationType="slide" onRequestClose={() => setCorr(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: colors.surface, padding: 16, gap: 12, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <T variant="subtitle">Pedir correção da {corr?.label}</T>
            <T variant="small">Explique o que aconteceu. O treinador recebe o pedido e decide.</T>
            <Field label="O que está errado?" value={corrReason} onChangeText={setCorrReason} multiline maxLength={500} placeholder="Ex.: fiz check-in no treino da outra equipe" />
            <Button title="Enviar pedido" disabled={corrReason.trim().length < 5} onPress={sendCorrection} />
            <Button title="Cancelar" kind="ghost" onPress={() => setCorr(null)} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
