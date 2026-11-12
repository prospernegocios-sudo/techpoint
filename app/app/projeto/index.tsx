// Lista de projetos incentivados do clube.
import { Stack, router } from 'expo-router';
import { Badge, Button, Card, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { useMe } from '@/lib/me';
import { sphereLabels, statusLabels, useProjects } from '@/lib/projects';
import { isoDayToBr } from '@/lib/report';
import { useTheme } from '@/lib/theme';
import { View } from 'react-native';

export default function Projetos() {
  const { org, isStaff, isManager } = useMe();
  const { colors } = useTheme();
  const projects = useProjects(org?.id);
  if (!isStaff) return <Screen><Notice tone="danger" text="Apenas gestor ou treinador podem ver os projetos." /></Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Projetos incentivados' }} />
      <T variant="muted">Ligue os treinos ao plano de trabalho aprovado: metas, beneficiários, indicadores e relatórios emitidos para a prestação de contas.</T>
      {isManager && <Button title="Novo projeto" onPress={() => router.push('/projeto/editar')} />}
      {projects.isLoading && <Loading />}
      {projects.error && <Notice tone="danger" text="Não foi possível carregar os projetos. Verifique a internet." />}
      {projects.data?.length === 0 && <T variant="muted">Nenhum projeto cadastrado ainda.</T>}
      {projects.data?.map((p) => (
        <Card key={p.id} onPress={() => router.push({ pathname: '/projeto/[id]', params: { id: p.id } })}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <T variant="subtitle" style={{ flex: 1 }}>{p.name}</T>
            <Badge label={statusLabels[p.status]} tone={p.status === 'active' ? 'success' : 'muted'} />
          </View>
          <T variant="muted">{sphereLabels[p.sphere]}{p.process_number ? ` · ${p.process_number}` : ''}</T>
          <T variant="small">Vigência: {isoDayToBr(p.starts_on)} a {isoDayToBr(p.ends_on)}</T>
          <T variant="small" color={colors.primary}>Abrir ›</T>
        </Card>
      ))}
    </Screen>
  );
}
