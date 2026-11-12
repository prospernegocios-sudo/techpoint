// Painel do projeto: indicadores, metas (resultado × alvo) e acesso às partes do projeto.
import { Stack, router, useLocalSearchParams, type Href } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Badge, Button, Card, Loading, Notice, T, styles } from '@/components/ui';
import { useMe } from '@/lib/me';
import { goalKindLabels, num, pct, sphereLabels, statusLabels, useIndicators, useProject } from '@/lib/projects';
import { isoDayToBr } from '@/lib/report';
import { useTheme } from '@/lib/theme';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: colors.surface }}>
      <T variant="small">{label}</T>
      <T variant="title" style={{ fontSize: 22 }}>{value}</T>
      {hint && <T variant="small">{hint}</T>}
    </View>
  );
}

export default function ProjetoPainel() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isManager } = useMe();
  const { colors } = useTheme();
  const project = useProject(id);
  const ind = useIndicators(id);

  if (project.isLoading) return <Loading />;
  if (project.error || !project.data) return <View style={{ padding: 16 }}><Notice tone="danger" text="Projeto não encontrado ou sem internet." /></View>;
  const { project: p, plans, teamIds, beneficiaries, sponsors, reports, goals } = project.data;
  const i = ind.data?.indicators;

  const links: { title: string; desc: string; href: Href }[] = [
    { title: 'Relatórios emitidos', desc: `${reports.length} emitido(s) · emitir, abrir PDF, retificar`, href: { pathname: '/projeto/[id]/relatorios', params: { id } } },
    { title: 'Metas', desc: `${goals.filter((g) => g.active).length} meta(s)`, href: { pathname: '/projeto/[id]/metas', params: { id } } },
    { title: 'Equipes e beneficiários', desc: `${teamIds.length} equipe(s) · ${beneficiaries.length} beneficiário(s)`, href: { pathname: '/projeto/[id]/beneficiarios', params: { id } } },
    { title: 'Plano de trabalho aprovado', desc: plans[0] ? `Versão ${plans[0].version}${plans[0].approved_on ? ` de ${isoDayToBr(plans[0].approved_on)}` : ''}` : 'Nenhuma versão cadastrada', href: { pathname: '/projeto/[id]/plano', params: { id } } },
    { title: 'Patrocinadores', desc: `${sponsors.length} patrocinador(es)`, href: { pathname: '/projeto/[id]/patrocinadores', params: { id } } },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 14, width: '100%', maxWidth: 1000, alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={ind.isRefetching} onRefresh={() => { project.refetch(); ind.refetch(); }} />}
    >
      <Stack.Screen options={{ title: 'Projeto' }} />
      <View style={{ gap: 4 }}>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <T variant="title" style={{ flex: 1 }}>{p.name}</T>
          <Badge label={statusLabels[p.status]} tone={p.status === 'active' ? 'success' : 'muted'} />
        </View>
        <T variant="muted">{[sphereLabels[p.sphere], p.agency, p.program].filter(Boolean).join(' · ')}</T>
        <T variant="small">Vigência {isoDayToBr(p.starts_on)} a {isoDayToBr(p.ends_on)}{p.process_number ? ` · Processo ${p.process_number}` : ''}</T>
        {isManager && <Button title="Editar dados do projeto" kind="ghost" onPress={() => router.push({ pathname: '/projeto/editar', params: { id } })} />}
      </View>

      {teamIds.length === 0 && <Notice text="Ligue as equipes (núcleos/turmas) do projeto para os treinos contarem como atividades." />}
      {beneficiaries.length === 0 && <Notice text="Cadastre os beneficiários do projeto para calcular frequência e metas." />}

      <T variant="subtitle">Indicadores até hoje</T>
      {ind.isLoading && <Loading text="Calculando indicadores..." />}
      {ind.error && <Notice tone="danger" text="Não foi possível calcular os indicadores agora." />}
      {i && (
        <View style={styles.wrap}>
          <Stat label="Atividades realizadas" value={String(i.activities_done)} hint={i.activities_canceled ? `${i.activities_canceled} cancelada(s)` : undefined} />
          <Stat label="Beneficiários atendidos" value={String(i.unique_beneficiaries)} hint={`de ${i.beneficiaries_enrolled} vinculados`} />
          <Stat label="Atendimentos" value={String(i.attendances)} hint="presenças válidas" />
          <Stat label="Frequência média" value={pct(i.avg_frequency_pct)} hint={`${i.attendances} ÷ ${i.eligible_total}${i.pending_total ? ` · ${i.pending_total} pendente(s)` : ''}`} />
          {p.public_school_min_pct != null && (
            <Stat label="Escola pública" value={pct(i.public_school_pct)} hint={`mínimo ${p.public_school_min_pct}%${i.school_unknown ? ` · ${i.school_unknown} sem escola` : ''}`} />
          )}
        </View>
      )}

      {ind.data && ind.data.goals.length > 0 && (
        <Card>
          <T variant="subtitle">Metas</T>
          {ind.data.goals.map((g) => (
            <View key={g.id} style={{ gap: 2, paddingVertical: 4 }}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <T variant="body" style={{ flex: 1, fontWeight: '600' }}>{g.code ? `${g.code} · ` : ''}{g.description}</T>
                {g.reached != null && <Badge label={g.reached ? 'Alcançada' : 'Abaixo'} tone={g.reached ? 'success' : 'warning'} />}
              </View>
              <T variant="small">
                {goalKindLabels[g.kind]}: {g.kind === 'avg_frequency' ? pct(g.result) : num(g.result)} de {num(g.target)} {g.unit ?? ''}
              </T>
            </View>
          ))}
        </Card>
      )}

      {links.map((l) => (
        <Card key={l.title} onPress={() => router.push(l.href)}>
          <T variant="subtitle">{l.title}</T>
          <T variant="muted">{l.desc}</T>
          <T variant="small" color={colors.primary}>Abrir ›</T>
        </Card>
      ))}
    </ScrollView>
  );
}
