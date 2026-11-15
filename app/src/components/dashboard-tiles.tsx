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

type TileProps = { icon: keyof typeof Ionicons.glyphMap; title: string; value?: string | number; sub?: string; tone?: 'warning' | 'danger' | 'success'; onPress: () => void };

export function Tile({ icon, title, value, sub, tone, onPress }: TileProps) {
  const { colors } = useTheme();
  const accent = tone === 'warning' ? colors.warning : tone === 'danger' ? colors.danger : tone === 'success' ? colors.success : colors.primary;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}${value !== undefined ? `: ${value}` : ''}`} onPress={onPress}
      style={({ pressed }) => ({ flexGrow: 1, flexBasis: 150, minHeight: 118, padding: 14, borderRadius: 16, gap: 6, backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: accent + '22', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={20} color={accent} />
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{title}</Text>
      {value !== undefined && <Text style={{ color: tone ? accent : colors.text, fontWeight: '800', fontSize: 22 }}>{value}</Text>}
      {sub ? <Text style={{ color: colors.textMuted, fontSize: 12.5 }}>{sub}</Text> : null}
    </Pressable>
  );
}

const Grid = ({ children }: { children: React.ReactNode }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{children}</View>;
const go = (h: Href) => () => router.push(h);

export function TeamTiles({ dash }: { dash: { today: TodayEvent[]; pendingWeek: number; joinPending: number; cvToConfirm: number; pendingEventId: string | null } }) {
  const me = useMe();
  const alerts = useQuery({
    queryKey: ['doc-alerts', me.org?.id], enabled: Boolean(me.org?.id),
    queryFn: async () => (await supabase.rpc('org_documents_alerts', { p_org_id: me.org!.id })).data as { expiring: number; expired: number } | null,
  });
  const t = dash.today[0];
  const docs = (alerts.data?.expiring ?? 0) + (alerts.data?.expired ?? 0);
  return (
    <Grid>
      <Tile icon="people" title={t ? 'Treino de hoje' : 'Treinos hoje'} value={t ? `${t.present}/${t.expected}` : 0}
        sub={t ? `${t.team} · presentes` : 'Toque para marcar um treino'} onPress={t ? go({ pathname: '/evento/[id]', params: { id: t.id } }) : go('/cadastro/treino')} />
      <Tile icon="hourglass-outline" title="Pendências" value={dash.pendingWeek} tone={dash.pendingWeek ? 'warning' : 'success'}
        sub={dash.pendingWeek ? 'Registros para aprovar' : 'Nada pendente'} onPress={dash.pendingEventId ? go({ pathname: '/evento/[id]', params: { id: dash.pendingEventId } }) : go('/acao')} />
      <Tile icon="person-add-outline" title="Convites e pedidos" value={dash.joinPending} tone={dash.joinPending ? 'warning' : undefined}
        sub={dash.joinPending ? 'Atletas esperando aprovação' : 'Convidar pelo WhatsApp'} onPress={go('/cadastro/convites')} />
      <Tile icon="trophy-outline" title="Currículos" value={dash.cvToConfirm} tone={dash.cvToConfirm ? 'warning' : undefined}
        sub="Itens para confirmar" onPress={go('/cadastro/atletas')} />
      <Tile icon="document-text-outline" title="Documentos" value={docs} tone={docs ? 'danger' : 'success'}
        sub={docs ? 'Atestados vencidos ou vencendo' : 'Atestados em dia'} onPress={go('/cadastro/atletas')} />
      <Tile icon="bar-chart-outline" title="Relatórios" sub="Frequência em PDF ou planilha" onPress={go('/relatorios')} />
      {me.isManager && <Tile icon="shirt-outline" title="Equipes e locais" sub="Categorias, ginásios e raio" onPress={go('/gestao')} />}
    </Grid>
  );
}

export function AthleteTiles({ next }: { next: { title: string; when: string } | null }) {
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
      <Tile icon="finger-print" title="Próximo treino" value={next?.when} sub={next?.title ?? 'Nenhum treino marcado'} onPress={go('/acao')} />
      <Tile icon="medal-outline" title="Competições" value={upcoming} sub={`${comps.length} no currículo`} onPress={go('/competicoes')} />
      <Tile icon="trophy-outline" title="Currículo" value={cv.data?.entries.length ?? 0} sub="itens na trajetória" onPress={go('/curriculo')} />
      <Tile icon="pulse-outline" title="Assiduidade" value={pct != null ? `${String(pct).replace('.', ',')}%` : '—'} sub={`${cv.data?.trainings_total ?? 0} treinos com prova`} onPress={go('/curriculo')} />
      <Tile icon="document-text-outline" title="Documentos" value={docs.data?.filter((d) => !d.superseded_at).length ?? 0}
        tone={atBad ? 'danger' : atSoon ? 'warning' : undefined} sub={atBad ? 'Atestado vencido' : atSoon ? 'Atestado vence logo' : 'Atestado, identidade...'} onPress={go('/perfil')} />
      <Tile icon="person-circle-outline" title="Perfil do atleta" sub="Dados, responsáveis, configurações" onPress={go('/perfil')} />
    </Grid>
  );
}

export function GuardianTiles() {
  const me = useMe();
  const kids = useMyKids(me.profile?.id);
  const pending = (kids.data ?? []).filter((k) => k.status === 'pending_consent').length;
  return (
    <Grid>
      <Tile icon="people" title="Meus atletas" value={kids.data?.length ?? 0} sub="Currículo, dados e documentos" onPress={go('/atletas')} />
      <Tile icon="shield-checkmark-outline" title="Autorizações" value={pending} tone={pending ? 'warning' : 'success'} sub={pending ? 'Esperando você autorizar' : 'Tudo autorizado'} onPress={go('/atletas')} />
      <Tile icon="person-circle-outline" title="Meu perfil" sub="Seus dados e configurações" onPress={go('/perfil')} />
    </Grid>
  );
}
