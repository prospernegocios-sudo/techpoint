// Botão "Início" no cabeçalho das telas da equipe (o menu lateral saiu; auditoria 13–21).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useTheme } from '@/lib/theme';

export function HomeButton() {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Voltar ao Início" onPress={() => router.navigate('/(tabs)')}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8, paddingHorizontal: 12, minHeight: 40, borderRadius: 999, backgroundColor: pressed ? colors.surfaceContainerHigh : 'transparent' })}>
      <Ionicons name="home-outline" size={20} color={colors.text} />
      <Text style={{ color: colors.text, fontWeight: '600' }}>Início</Text>
    </Pressable>
  );
}
