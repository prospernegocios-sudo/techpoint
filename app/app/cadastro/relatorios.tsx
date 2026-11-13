// Área única de relatórios (achado de UX nº 4): pergunta se é para um projeto.
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Card, Loading, Notice, Screen, T } from '@/components/ui';
import { useMe } from '@/lib/me';
import { statusLabels, useProjects } from '@/lib/projects';
import { useTheme } from '@/lib/theme';

export default function Relatorios() {
  const { org, isStaff } = useMe();
  const { colors } = useTheme();
  const projects = useProjects(org?.id);
  if (!isStaff) return <Screen><Notice tone="danger" text="Apenas a equipe da entidade gera relatórios." /></Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Relatórios' }} />
      <T variant="subtitle">O relatório é para um projeto incentivado?</T>
      <T variant="muted">Relatório de projeto fica emitido: numerado, congelado e com retificação. O avulso é livre, para consulta ou envio rápido.</T>

      <T variant="small" style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>Sim, de um projeto</T>
      {projects.isLoading && <Loading />}
      {projects.data?.length === 0 && <Notice text="Nenhum projeto cadastrado. Cadastre em Gestão > Projetos incentivados." />}
      {projects.data?.map((p) => (
        <Card key={p.id} onPress={() => router.push({ pathname: '/projeto/[id]/relatorios', params: { id: p.id } })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="ribbon-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <T variant="body" style={{ fontWeight: '700' }}>{p.name}</T>
              <T variant="small">{statusLabels[p.status]}</T>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
        </Card>
      ))}

      <T variant="small" style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>Não, relatório avulso</T>
      <Pressable accessibilityRole="button" onPress={() => router.push('/cadastro/relatorio')}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="document-text-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <T variant="body" style={{ fontWeight: '700' }}>Relatório de frequência</T>
              <T variant="small">PDF com fotos ou planilha, por período e equipes</T>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
        </Card>
      </Pressable>
    </Screen>
  );
}
