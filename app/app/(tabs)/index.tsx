// Início: atleta vê seus treinos e o botão de check-in/check-out;
// gestor/treinador vê os treinos e abre a lista de presença.
import { useFocusEffect, router } from 'expo-router';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Badge, Button, Card, Chip, Field, Loading, Notice, T, styles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { getQueue, syncQueue } from '@/lib/attendance';
import { formatDay, formatTime } from '@/lib/format';
import { orgLogoUrl, modeLabels, useMe } from '@/lib/me';
import { useSetupSteps, useTeamDashboard } from '@/lib/dashboard';
import { GuardianTiles, TeamTiles } from '@/components/dashboard-tiles';
import { GuardianHome } from '@/components/guardian-home';
import { useEvents, useMyAttendance, type EventRow } from '@/lib/queries';
import { nextAction } from '@/lib/next-action';
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

  // Conta ainda sem entidade: confere sozinha a cada 15 s se já foi ligada a uma (item 12 da auditoria).
  const noOrg = !me.loading && !me.org;
  const refetchMe = useRef(me.refetch);
  refetchMe.current = me.refetch;
  useEffect(() => {
    if (!noOrg) return;
    const t = setInterval(() => refetchMe.current(), 15_000);
    return () => clearInterval(t);
  }, [noOrg]);

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
      </ScrollView>
    );
  }

  // Responsável acompanha pelos cartões dos filhos; a agenda é da equipe e dos atletas.
  // Equipe: a agenda fica em Treinos (auditoria 13–21); Início só com os 5 botões.
  const list = me.mode === 'guardian' || me.mode === 'team' ? [] : events.data ?? [];
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 14, width: '100%', maxWidth: 1000, alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={events.isRefetching} onRefresh={() => { events.refetch(); mine.refetch(); me.refetch(); dash.refetch(); setup.refetch(); refreshQueue(); }} />}
    >
      <View style={[styles.row, { gap: 12 }]}>
        {orgLogoUrl(me.org.logo_path)
          ? <Image source={{ uri: orgLogoUrl(me.org.logo_path)! }} style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.surfaceContainer }} resizeMode="contain" accessibilityLabel={`Logo ${me.org.name}`} />
          : <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.onPrimaryContainer, fontWeight: '700', fontSize: 18 }}>{me.org.name.slice(0, 2).toUpperCase()}</Text></View>}
        <View style={{ flex: 1 }}>
          <T variant="small">Olá, {me.profile?.full_name?.split(' ')[0] ?? 'atleta'}</T>
          <T variant="title">{me.org.name}</T>
        </View>
      </View>

      {me.asGuest && <Notice tone="info" text={`Você está vendo ${me.org.name} como gestor master (administrador da plataforma). Tudo o que fizer fica registrado na auditoria.`} />}
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
          <TeamTiles dash={dash.data} />
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
        </View>
      )}

      {me.mode === 'guardian' && <GuardianTiles />}
      {me.mode === 'guardian' && <GuardianHome />}

      {queueInfo.pending > 0 && <Notice tone="warning" text={`${queueInfo.pending} registro(s) guardado(s) no celular. Vamos enviar assim que a internet voltar.`} />}
      {queueInfo.msg && <Notice tone="info" text={queueInfo.msg} />}

      {events.isLoading && <Loading />}
      {events.error && <Notice tone="danger" text="Não foi possível carregar a agenda. Verifique a internet." />}
      {!events.isLoading && list.length === 0 && me.mode === 'athlete' && <T variant="muted">Nenhum treino nos próximos 7 dias.</T>}

      {/* Atleta: cartão de destaque (Material You) com o treino de agora ou o próximo, e o botão de check-in */}
      {isAthlete && me.athlete && (() => {
        const now = list.find((ev) => nextAction(ev, mine.data ?? []).action);
        const ev = now ?? list[0];
        if (!ev) return null;
        const na = now ? nextAction(now, mine.data ?? []) : null;
        const live = eventPhase(ev) === 'live';
        return (
          <View style={{ backgroundColor: colors.hero, borderRadius: 28, padding: 20, gap: 14, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', right: -50, top: -50, width: 170, height: 170, borderRadius: 85, backgroundColor: '#FFFFFF', opacity: 0.07 }} />
            <View style={[styles.row, { gap: 8 }]}>
              <Ionicons name={live ? 'radio-button-on' : 'calendar-outline'} size={18} color={live ? colors.accent : colors.onHeroMuted} />
              <Text style={{ color: colors.onHeroMuted, fontSize: 14, fontWeight: '500' }}>
                {live ? 'Treino agora' : isToday(ev.starts_at) ? 'Próximo treino · hoje' : `Próximo treino · ${formatDay(ev.starts_at)}`}
              </Text>
            </View>
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.onHero, fontSize: 34, fontWeight: '600', letterSpacing: -0.5 }}>{formatTime(ev.starts_at)} – {formatTime(ev.ends_at)}</Text>
              <Text style={{ color: colors.onHeroMuted, fontSize: 15 }}>{ev.teams?.name}{ev.venues?.name ? ` · ${ev.venues.name}` : ''}</Text>
              {na?.status ? <Text style={{ color: colors.onHero, fontSize: 14, fontWeight: '600', marginTop: 4 }}>{na.status}</Text> : null}
            </View>
            {na?.action ? (
              <Button title={na.action.label} kind="accent" big icon="location" style={{ alignSelf: 'flex-start', minWidth: 220 }}
                onPress={() => router.push({ pathname: '/checkin/[eventId]', params: { eventId: ev.id, kind: na.action!.kind } })} />
            ) : (
              <View style={{ gap: 2 }}>
                <Text style={{ color: colors.onHero, fontSize: 14, fontWeight: '600' }}>Não há treino disponível para check-in neste momento.</Text>
                <Text style={{ color: colors.onHeroMuted, fontSize: 13 }}>O check-in abre 30 minutos antes do treino, pelo app ou pelo site.</Text>
              </View>
            )}
          </View>
        );
      })()}
      {/* Atleta: o Início fica só com os treinos (auditoria, item 03); o resto está no menu. */}

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
          <View style={{ backgroundColor: colors.surface, padding: 20, gap: 12, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
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
