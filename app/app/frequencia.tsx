// Relatório de frequência interativo (auditoria, itens 15 e 16): presentes × ausentes num gráfico,
// lista ao tocar, detalhe da ausência (atestado) e contato do atleta pelo WhatsApp. Independe do módulo de projetos.
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Button, Card, Chip, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { reasonLabel, useJustifications } from '@/lib/convocations';
import { openAthleteDocument } from '@/lib/documents';
import { openWhatsApp } from '@/lib/links';
import { useMe } from '@/lib/me';
import { useTeams } from '@/lib/queries';
import { brDate, brTime, buildRows, type ReportData, type ReportRow } from '@/lib/report';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type Period = 'ultimo' | '7' | '30';
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayOf = (iso: string) => brDate(iso).split('/').reverse().join('-');

export default function Frequencia() {
  const me = useMe();
  const { colors } = useTheme();
  const teams = useTeams(me.org?.id);
  const [period, setPeriod] = useState<Period>('ultimo');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [show, setShow] = useState<'presentes' | 'ausentes'>('ausentes');
  const [open, setOpen] = useState<string | null>(null);
  const [chart, setChart] = useState<'barra' | 'pizza'>('pizza');

  const report = useQuery({
    queryKey: ['frequencia', me.org?.id, period],
    enabled: Boolean(me.org?.id) && Boolean(teams.data),
    queryFn: async () => {
      const to = new Date(); const from = new Date(); from.setDate(from.getDate() - (period === '30' ? 30 : period === '7' ? 7 : 30));
      const { data, error } = await supabase.rpc('attendance_report', {
        p_org_id: me.org!.id, p_team_ids: (teams.data ?? []).map((t) => t.id), p_from: isoDay(from), p_to: isoDay(to), p_project: {},
      });
      if (error) throw error;
      return data as ReportData;
    },
  });

  const rows = useMemo(() => {
    if (!report.data) return [] as ReportRow[];
    let r = buildRows(report.data).filter((x) => !teamId || x.event.team_id === teamId);
    if (period === 'ultimo') {
      const last = [...new Set(r.map((x) => x.event))].sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
      r = last ? r.filter((x) => x.event.id === last.id) : [];
    }
    return r;
  }, [report.data, teamId, period]);
  const present = rows.filter((r) => r.present || r.pending);
  const absent = rows.filter((r) => !r.present && !r.pending);
  const total = rows.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const events = [...new Set(rows.map((r) => r.event.id))].length;

  // Contato e atestados dos ausentes (só a equipe vê).
  const absentIds = [...new Set(absent.map((r) => r.athleteId))];
  const extra = useQuery({
    queryKey: ['frequencia-extra', absentIds.join()], enabled: absentIds.length > 0,
    queryFn: async () => {
      const [ph, docs] = await Promise.all([
        supabase.from('athlete_details').select('athlete_id, phone').in('athlete_id', absentIds),
        supabase.from('athlete_documents').select('athlete_id, file_path, title, valid_until, created_at').eq('kind', 'atestado').in('athlete_id', absentIds),
      ]);
      return {
        phones: Object.fromEntries(((ph.data ?? []) as { athlete_id: string; phone: string | null }[]).map((x) => [x.athlete_id, x.phone])),
        docs: (docs.data ?? []) as { athlete_id: string; file_path: string; title: string | null; valid_until: string | null; created_at: string }[],
      };
    },
  });

  const justifs = useJustifications(absentIds, [...new Set(absent.map((r) => r.event.id))]);
  if (!me.isStaff) return <Screen><Notice tone="danger" text="Apenas a equipe da entidade vê relatórios." /></Screen>;
  const coachFirst = (me.profile?.full_name ?? '').split(' ')[0] || 'seu treinador';
  const list = show === 'presentes' ? present : absent;

  const message = (r: ReportRow) => {
    const first = r.athleteName.split(' ')[0];
    const today = dayOf(r.event.starts_at) === isoDay(new Date());
    const when = today ? 'hoje' : `do dia ${brDate(r.event.starts_at).slice(0, 5)}`;
    return `Oi, ${first}! Sou o seu treinador, ${coachFirst}. Vi que você não veio ao treino ${when} e gostaria de saber o motivo. Pode me informar por aqui?`;
  };
  const atestadoFor = (r: ReportRow) => {
    const day = dayOf(r.event.starts_at);
    return (extra.data?.docs ?? []).find((d) => d.athlete_id === r.athleteId && d.created_at.slice(0, 10) >= shiftDay(day, -30) && (!d.valid_until || d.valid_until >= day));
  };

  const Seg = ({ k, n, color, label }: { k: 'presentes' | 'ausentes'; n: number; color: string; label: string }) => (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: show === k }} accessibilityLabel={`${label}: ${n}`} onPress={() => { setShow(k); setOpen(null); }}
      style={({ pressed }) => ({ flex: 1, minWidth: 140, padding: 16, borderRadius: 20, gap: 4, opacity: pressed ? 0.85 : 1,
        backgroundColor: show === k ? (k === 'presentes' ? colors.successContainer : colors.dangerContainer) : colors.surfaceContainer,
        borderWidth: 2, borderColor: show === k ? color : 'transparent' })}>
      <View style={[styles.row, { gap: 8 }]}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} /><T variant="body" style={{ fontWeight: '700' }}>{label}</T></View>
      <Text style={{ fontSize: 32, fontWeight: '700', color: colors.text }}>{n}</Text>
      <T variant="small">{pct(n)}% · toque para ver a lista</T>
    </Pressable>
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Relatório de frequência' }} />
      <View style={styles.wrap}>
        <Chip label="Último treino" selected={period === 'ultimo'} onPress={() => setPeriod('ultimo')} />
        <Chip label="Últimos 7 dias" selected={period === '7'} onPress={() => setPeriod('7')} />
        <Chip label="Últimos 30 dias" selected={period === '30'} onPress={() => setPeriod('30')} />
      </View>
      {(teams.data?.length ?? 0) > 1 && (
        <View style={styles.wrap}>
          <Chip label="Todas as equipes" selected={!teamId} onPress={() => setTeamId(null)} />
          {teams.data!.map((t) => <Chip key={t.id} label={t.name} selected={teamId === t.id} onPress={() => setTeamId(t.id)} />)}
        </View>
      )}
      {report.isLoading && <Loading />}
      {report.error && <Notice tone="danger" text="Não foi possível carregar a frequência. Verifique a internet." />}
      {report.data && total === 0 && <Notice tone="info" text="Nenhum treino encerrado nesse período. A frequência aparece depois que o treino termina." />}
      {total > 0 && (
        <>
          <T variant="muted">
            {period === 'ultimo' && rows[0] ? `Treino de ${brDate(rows[0].event.starts_at)} às ${brTime(rows[0].event.starts_at)} · ${rows[0].teamName}` : `${events} treino${events === 1 ? '' : 's'} · ${total} presenças esperadas`}
          </T>
          <View style={[styles.row, { gap: 8 }]}>
            <T variant="small">Gráfico:</T>
            <Chip label="Pizza" selected={chart === 'pizza'} onPress={() => setChart('pizza')} />
            <Chip label="Barras" selected={chart === 'barra'} onPress={() => setChart('barra')} />
          </View>
          {chart === 'barra' ? (
            <View accessibilityLabel={`Gráfico de barras: ${present.length} presentes e ${absent.length} ausentes`} style={{ gap: 10 }}>
              {([['presentes', present.length, colors.success, 'Presentes'], ['ausentes', absent.length, colors.danger, 'Ausentes']] as const).map(([k, n, c, l]) => (
                <Pressable key={k} accessibilityRole="button" accessibilityLabel={`Ver ${l.toLowerCase()}`} onPress={() => { setShow(k); setOpen(null); }} style={{ gap: 4 }}>
                  <View style={[styles.row, { justifyContent: 'space-between' }]}><T variant="small" style={{ fontWeight: '700' }}>{l}</T><T variant="small">{n} · {pct(n)}%</T></View>
                  <View style={{ height: 26, borderRadius: 13, backgroundColor: colors.surfaceContainerHigh, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.max(pct(n), n ? 3 : 0)}%`, height: 26, borderRadius: 13, backgroundColor: c, opacity: show === k ? 1 : 0.55 }} />
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={{ alignItems: 'center' }} accessibilityLabel={`Gráfico de pizza: ${present.length} presentes e ${absent.length} ausentes`}>
              <Pie size={220} parts={[
                { key: 'presentes', value: present.length, color: colors.success, dim: show !== 'presentes', onPress: () => { setShow('presentes'); setOpen(null); } },
                { key: 'ausentes', value: absent.length, color: colors.danger, dim: show !== 'ausentes', onPress: () => { setShow('ausentes'); setOpen(null); } },
              ]} hole={colors.background} label={`${pct(present.length)}%`} sub="presença" text={colors.text} muted={colors.textMuted} />
            </View>
          )}
          <View style={[styles.wrap, { gap: 12 }]}>
            <Seg k="presentes" n={present.length} color={colors.success} label="Presentes" />
            <Seg k="ausentes" n={absent.length} color={colors.danger} label="Ausentes" />
          </View>

          <T variant="subtitle">{show === 'presentes' ? 'Atletas presentes' : 'Atletas ausentes'} ({list.length})</T>
          {list.length === 0 && <T variant="muted">{show === 'presentes' ? 'Ninguém registrou presença.' : 'Nenhuma falta. Todos vieram!'}</T>}
          {list.map((r) => {
            const k = `${r.event.id}|${r.athleteId}`;
            const isOpen = open === k;
            const at = show === 'ausentes' ? atestadoFor(r) : undefined;
            const phone = extra.data?.phones[r.athleteId];
            return (
              <Card key={k} onPress={show === 'ausentes' ? () => setOpen(isOpen ? null : k) : undefined}>
                <View style={[styles.row, { justifyContent: 'space-between' }]}>
                  <View style={{ flex: 1 }}>
                    <T variant="body" style={{ fontWeight: '700' }}>{r.athleteName}</T>
                    <T variant="small">{brDate(r.event.starts_at)} · {r.teamName}{r.pending ? ' · aguardando aprovação' : ''}{r.checkIn ? ` · chegou ${brTime(r.checkIn.server_at)}` : ''}</T>
                  </View>
                  {show === 'ausentes' && <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />}
                </View>
                {isOpen && (
                  <View style={{ gap: 10, marginTop: 6 }}>
                    <T variant="small" style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>Detalhes da ausência</T>
                    {(() => {
                      const j = (justifs.data ?? []).find((x) => x.event_id === r.event.id && x.athlete_id === r.athleteId);
                      return j ? (
                        <View style={[styles.row, { gap: 8, alignItems: 'flex-start' }]}>
                          <Ionicons name="chatbox-ellipses-outline" size={20} color={colors.primary} />
                          <T variant="body" style={{ flex: 1 }}>Justificativa: <T variant="body" style={{ fontWeight: '700' }}>{reasonLabel(j.reason)}</T>{j.details ? ` · ${j.details}` : ''} <T variant="small">(enviada em {new Date(j.updated_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })})</T></T>
                        </View>
                      ) : null;
                    })()}
                    {extra.isLoading ? <Loading /> : at ? (
                      <View style={[styles.row, { gap: 8 }]}>
                        <Ionicons name="medkit-outline" size={20} color={colors.success} />
                        <T variant="body" style={{ flex: 1 }}>Atestado médico enviado{at.valid_until ? ` (válido até ${at.valid_until.split('-').reverse().join('/')})` : ''}.</T>
                        <Button title="Abrir atestado" kind="tonal" onPress={() => openAthleteDocument(at.file_path)} />
                      </View>
                    ) : !(justifs.data ?? []).some((x) => x.event_id === r.event.id && x.athlete_id === r.athleteId)
                      ? <T variant="body">Sem atestado nem justificativa registrados para esta data.</T> : <T variant="small">Sem atestado para esta data.</T>}
                    {phone ? (
                      <Button title="Falar com o atleta no WhatsApp" icon="logo-whatsapp" kind="outline" onPress={() => openWhatsApp(message(r), phone)} />
                    ) : <T variant="small">Sem celular cadastrado. Peça para {r.athleteName.split(' ')[0]} preencher em Perfil › Dados pessoais.</T>}
                    <Button title="Abrir ficha do atleta" kind="ghost" onPress={() => router.push({ pathname: '/atleta/[id]', params: { id: r.athleteId } })} />
                  </View>
                )}
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}

function shiftDay(day: string, n: number) {
  const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDay(d);
}

/** Pizza com fatias clicáveis (presentes × ausentes) e o percentual no meio. */
function Pie({ size, parts, hole, label, sub, text, muted }: {
  size: number; parts: { key: string; value: number; color: string; dim: boolean; onPress: () => void }[]; hole: string; label: string; sub: string; text: string; muted: string;
}) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = size / 2, cx = r, cy = r;
  let ang = -Math.PI / 2;
  const slices = parts.filter((p) => p.value > 0).map((p) => {
    const a0 = ang, a1 = ang + (p.value / total) * Math.PI * 2; ang = a1;
    if (p.value === total) return { p, d: null as string | null };
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z`;
    return { p, d };
  });
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {slices.map(({ p, d }) => d
          ? <Path key={p.key} d={d} fill={p.color} opacity={p.dim ? 0.45 : 1} onPress={p.onPress} />
          : <Circle key={p.key} cx={cx} cy={cy} r={r} fill={p.color} opacity={p.dim ? 0.45 : 1} onPress={p.onPress} />)}
        <Circle cx={cx} cy={cy} r={r * 0.55} fill={hole} />
      </Svg>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 30, fontWeight: '700', color: text }}>{label}</Text>
        <Text style={{ fontSize: 13, color: muted }}>{sub}</Text>
      </View>
    </View>
  );
}
