import { Stack } from 'expo-router';
import { useTheme } from '@/lib/theme';

export default function ProjetoLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: 'Voltar',
      }}
    />
  );
}
