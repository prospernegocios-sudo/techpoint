// Painel principal (D95): cartões grandes e clicáveis, para cada perfil. Cada cartão leva à sua área.
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAthleteCv } from '@/lib/cv';
import type { TodayEvent } from '@/lib/dashboard';
import { useAthleteDocuments, validity } from '@/lib/documents';
import { useMyKids } from '@/lib/kids';
import { useMe } from '@/lib/me';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type Hue = 'primary' | 'accent' | 'tertiary' | 'neutral';
type TileProps = { icon: keyof typeof Ionicons.glyphMap; title: string; value?: string | number; sub?: string; tone?: 'warning' | 'danger' | 'success'; hue?: Hue; onPress: () => void };

/** Bloco colorido do painel (Material You): fundo em tom suave; avisos trocam a cor. */
export function Tile({ icon, title, value, sub, tone, hue = 'neutral', onPress }: TileProps) {
  const { colors } = useTheme();
  const [bg, fg] = tone === 'warning' ? [colors.warningContainer, colors.onWarningContainer]
    : tone === 'danger' ? [colors.dangerContainer, colors.onDangerContainer]
    : hue === 'primary' ? [colors.primaryContainer, colors.onPrimaryContainer]
    : hue === 'accent' ? [colors.accentContainer, colors.onAccentContainer]
    : hue === 'tertiary' ? [colors.tertiaryContainer, colors.onTertiaryContainer]
    : [colors.surfaceContainerHigh, colors.text];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}${value !== undefined ? `: ${value}` : ''}`} onPress={onPress}
      style={({ pressed }) => ({ flexGrow: 1, flexBasis: 150, minHeight: 124, padding: 16, borderRadius: 24, gap: 4, backgroundColor: bg,
        justifyContent: 'space-between', opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Ionicons name={icon} size={28} color={fg} />
        {value !== undefined && <Text style={{ color: fg, fontWeight: '700', fontSize: 24, letterSpacing: -0.3 }}>{value}</Text>}
      </View>
      <View style={{ gap: 2 }}>
        <Text style={{ color: fg, fontWeight: '700', fontSize: 16 }}>{title}</Text>
        {sub ? <Text style={{ color: fg, opacity: 0.8, fontSize: 12.5 }}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

const Grid = ({ children }: { children: React.ReactNode }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{children}</View>;
const go = (h: Href) => () => router.push(h);

/** Início da equipe (auditoria 13–21): exatamente 5 botões, nesta ordem. */
export function TeamTiles({ dash }: { dash: { today: TodayEvent[]; pendingWeek: number; joinPending: number; cvToConfirm: number; pendingEventId: string | null } }) {
  const me = useMe();
  const alerts = useQuery({
    queryKey: ['doc-alerts', me.org?.id], enabled: Boolean(me.org?.id),
    queryFn: async () => (await supabase.rpc('org_documents_alerts', { p_org_id: me.org!.id })).data as { expiring: number; expired: number } | null,
  });
  const t = dash.today[0];
  const docs = (alerts.data?.expiring ?? 0) + (alerts.data?.expired ?? 0);
  const athleteNotes = [dash.cvToConfirm ? `${dash.cvToConfirm} ${dash.cvToConfirm === 1 ? 'item' : 'itens'} de currículo para confirmar` : '', docs ? `${docs} atestado${docs === 1 ? '' : 's'} vencendo ou vencido${docs === 1 ? '' : 's'}` : ''].filter(Boolean);
  return (
    <Grid>
      <Tile hue="primary" icon="calendar" title="Treinos" value={t ? `${t.present}/${t.expected}` : dash.today.length}
        sub={t ? `Hoje: ${t.team} · presentes` : 'Ver treinos e criar novo'} onPress={go('/treinos')} />
      <Tile hue="tertiary" icon="people" title="Atletas" tone={docs ? 'warning' : undefined}
        sub={athleteNotes.length ? athleteNotes.join(' · ') : 'Currículos, documentos e dados'} onPress={go('/cadastro/atletas')} />
      <Tile hue="accent" icon="bar-chart" title="Relatórios" sub="Frequência: presenças e faltas" onPress={go('/relatorios')} />
      <Tile hue="neutral" icon="person-add" title="Convites e pedidos" value={dash.joinPending} tone={dash.joinPending ? 'warning' : undefined}
        sub={dash.joinPending ? 'Atletas esperando aprovação' : 'Link do time pelo WhatsApp'} onPress={go('/cadastro/convites')} />
      <Tile hue="neutral" icon="hourglass" title="Pendências" value={dash.pendingWeek} tone={dash.pendingWeek ? 'warning' : 'success'}
        sub={dash.pendingWeek ? 'Registros para aprovar' : 'Nada pendente'} onPress={dash.pendingEventId ? go({ pathname: '/evento/[id]', params: { id: dash.pendingEventId } }) : go('/treinos')} />
    </Grid>
  );
}

// O próximo treino agora fica no cartão de destaque do Início.
export function AthleteTiles(_: { next: { title: string; when: string } | null }) {
  const me = useMe();
  const cv = useAthleteCv(me.athlete?.id);
  const docs = useAthleteDocuments(me.athlete?.id);
  const month = new Date(); month.setDate(1);
  const iso = month.toISOString().slice(0, 10);
  const comps = (cv.data?.entries ?? []).filter((e) => ['competicao', 'titulo', 'selecao'].includes(e.kind));
  const upcoming = comps.filter((e) => e.started_on >= iso).length;
  const at = (docs.data ?? []).filter((d) => d.kind === 'atestado' && !d.superseded_at);
  const atBad = at.length > 0 && at.every((d) => validity(d.valid_until) === 'expired');
  const atSoon = at.some((d) => validity(d.valid_until) === 'soon');
  const pct = cv.data && cv.data.attendance_12m.events > 0 ? cv.data.attendance_12m.pct : null;
  return (
    <Grid>
      <Tile hue="accent" icon="medal-outline" title="Competições" value={upcoming} sub={`${comps.length} no currículo`} onPress={go('/competicoes')} />
      <Tile hue="primary" icon="trophy-outline" title="Currículo" value={cv.data?.entries.length ?? 0} sub="itens na trajetória" onPress={go('/curriculo')} />
      <Tile hue="tertiary" icon="pulse-outline" title="Assiduidade" value={pct != null ? `${String(pct).replace('.', ',')}%` : '—'} sub={`${cv.data?.trainings_total ?? 0} treinos com prova`} onPress={go('/curriculo')} />
      <Tile hue="tertiary" icon="document-text-outline" title="Documentos" value={docs.data?.filter((d) => !d.superseded_at).length ?? 0}
        tone={atBad ? 'danger' : atSoon ? 'warning' : undefined} sub={atBad ? 'Atestado vencido' : atSoon ? 'Atestado vence logo' : 'Atestado, identidade...'} onPress={go('/perfil')} />
      <Tile hue="neutral" icon="person-circle-outline" title="Perfil do atleta" sub="Dados, responsáveis, configurações" onPress={go('/perfil')} />
    </Grid>
  );
}

export function GuardianTiles() {
  const me = useMe();
  const kids = useMyKids(me.profile?.id);
  const pending = (kids.data ?? []).filter((k) => k.status === 'pending_consent').length;
  return (
    <Grid>
      <Tile hue="primary" icon="people" title="Meus atletas" value={kids.data?.length ?? 0} sub="Currículo, dados e documentos" onPress={go('/atletas')} />
      <Tile icon="shield-checkmark-outline" title="Autorizações" value={pending} tone={pending ? 'warning' : 'success'} sub={pending ? 'Esperando você autorizar' : 'Tudo autorizado'} onPress={go('/atletas')} />
      <Tile icon="person-circle-outline" title="Meu perfil" sub="Seus dados e configurações" onPress={go('/perfil')} />
    </Grid>
  );
}
