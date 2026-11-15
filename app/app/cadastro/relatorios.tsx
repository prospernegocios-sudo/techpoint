// Relatórios da equipe (auditoria, itens 15 e 16): frequência interativa e desempenho (em breve).
// A prestação de contas fica só no módulo Projetos Incentivados (dentro de cada projeto).
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { View } from 'react-native';
import { Badge, Card, Notice, Screen, T } from '@/components/ui';
import { useMe } from '@/lib/me';
import { useTheme } from '@/lib/theme';

export default function Relatorios() {
  const { isStaff } = useMe();
  const { colors } = useTheme();
  if (!isStaff) return <Screen><Notice tone="danger" text="Apenas a equipe da entidade gera relatórios." /></Screen>;
  const Item = ({ icon, title, sub, onPress, soon }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; onPress?: () => void; soon?: boolean }) => (
    <Card onPress={onPress} style={soon ? { opacity: 0.7 } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: soon ? colors.surfaceContainerHigh : colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={22} color={soon ? colors.textMuted : colors.onPrimaryContainer} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="body" style={{ fontWeight: '700' }}>{title}</T>
          <T variant="small">{sub}</T>
        </View>
        {soon ? <Badge label="Em desenvolvimento" /> : <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
      </View>
    </Card>
  );
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Relatórios' }} />
      <Item icon="pie-chart-outline" title="Relatório de Frequência" sub="Presenças e faltas dos atletas por treino ou período" onPress={() => router.push('/frequencia')} />
      <Item icon="trending-up-outline" title="Relatório de Desempenho" sub="Em breve: evolução dos atletas" soon />
      <Item icon="download-outline" title="Exportar frequência (PDF ou planilha)" sub="Documento com fotos dos registros, por período e equipes" onPress={() => router.push('/cadastro/relatorio')} />
    </Screen>
  );
}
