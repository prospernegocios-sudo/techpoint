// Abas principais. "Gestão" só aparece para gestor e treinador.
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { useMe } from '@/lib/me';
import { useTheme } from '@/lib/theme';

export default function TabsLayout() {
  const { session } = useAuth();
  const { isStaff, isPlatformAdmin } = useMe();
  const { colors } = useTheme();
  // Deixa a barra de abas acima dos botões de navegação do Android.
  const { bottom } = useSafeAreaInsets();
  // Tela larga (computador/tablet deitado): menu na lateral.
  const wide = useWindowDimensions().width >= 900;
  if (!session) return <Redirect href="/login" />;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarVariant: wide ? 'material' : 'uikit',
        tabBarLabelPosition: wide ? 'beside-icon' : 'below-icon',
        tabBarStyle: wide
          ? { backgroundColor: colors.surface, borderRightColor: colors.border, minWidth: 220, paddingTop: 12 }
          : { backgroundColor: colors.surface, borderTopColor: colors.border, height: 64 + bottom, paddingBottom: 8 + bottom, paddingTop: 6 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color as string} size={size} /> }} />
      <Tabs.Screen
        name="gestao"
        options={{
          title: 'Gestão',
          href: isStaff || isPlatformAdmin ? '/(tabs)/gestao' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="clipboard" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" color={color as string} size={size} /> }} />
    </Tabs>
  );
}
