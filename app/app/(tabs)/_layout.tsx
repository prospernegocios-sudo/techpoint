// Abas principais com o botão central (D62).
// Atleta: Início · Currículo · Check-in · Documentos · Meus dados.
// Responsável: Início · Meus atletas · Documentos · Meus dados. Equipe: Início · Gestão · Presença · Relatórios · Perfil.
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CenterButton } from '@/components/center-button';
import { useAuth } from '@/lib/auth';
import { useMe } from '@/lib/me';
import { useTheme } from '@/lib/theme';

export default function TabsLayout() {
  const { session } = useAuth();
  const { isStaff, isPlatformAdmin, mode } = useMe();
  const team = isStaff || isPlatformAdmin;
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
          href: team ? '/(tabs)/gestao' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="clipboard" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="curriculo"
        options={{
          title: 'Currículo',
          href: mode === 'athlete' ? '/(tabs)/curriculo' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="atletas"
        options={{
          title: 'Meus atletas',
          href: mode === 'guardian' ? '/(tabs)/atletas' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="acao"
        options={{
          title: team ? 'Presença' : 'Check-in',
          // Responsável não tem botão central (acompanha pela tela inicial).
          tabBarButton: mode === 'guardian' ? () => null : () => <CenterButton wide={wide} />,
        }}
      />
      <Tabs.Screen
        name="relatorios"
        options={{
          title: 'Relatórios',
          href: team ? '/(tabs)/relatorios' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="documentos"
        options={{
          title: 'Documentos',
          href: mode === 'athlete' || mode === 'guardian' ? '/(tabs)/documentos' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="folder-open" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen name="perfil" options={{ title: team ? 'Perfil' : 'Meus dados', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" color={color as string} size={size} /> }} />
    </Tabs>
  );
}
