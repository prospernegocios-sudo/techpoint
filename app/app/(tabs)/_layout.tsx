// Abas principais com o botão central (D62).
// Atleta: Início · Competições · Check-in · Currículo · Perfil (D95).
// Responsável: Início · Meus atletas · Perfil. Equipe: Início · Gestão · Presença · Relatórios · Perfil.
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountButton } from '@/components/account-menu';
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
  // Ícone com a "pílula" do Material You na aba ativa (no celular).
  const icon = (name: keyof typeof Ionicons.glyphMap) => function TabIcon({ color: c, focused }: { color: unknown; focused: boolean }) {
    const color = c as string;
    const glyph = (focused ? name : `${name}-outline`) as keyof typeof Ionicons.glyphMap;
    if (wide) return <Ionicons name={glyph in Ionicons.glyphMap ? glyph : name} color={color} size={22} />;
    return (
      <View style={{ width: 60, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? colors.primaryContainer : 'transparent' }}>
        <Ionicons name={glyph in Ionicons.glyphMap ? glyph : name} color={focused ? colors.onPrimaryContainer : color} size={22} />
      </View>
    );
  };
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerRight: () => <AccountButton />,
        headerTitleStyle: { fontWeight: '600' },
        headerTintColor: colors.text,
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarVariant: wide ? 'material' : 'uikit',
        tabBarLabelPosition: wide ? 'beside-icon' : 'below-icon',
        tabBarStyle: wide
          ? { backgroundColor: colors.surfaceContainer, borderRightWidth: 0, minWidth: 220, paddingTop: 12 }
          : { backgroundColor: colors.surfaceContainer, borderTopWidth: 0, height: 80 + bottom, paddingBottom: 12 + bottom, paddingTop: 10, elevation: 0 },
        tabBarActiveTintColor: wide ? colors.onPrimaryContainer : colors.text,
        tabBarActiveBackgroundColor: wide ? colors.primaryContainer : undefined,
        tabBarItemStyle: wide ? { borderRadius: 999, marginHorizontal: 10, marginVertical: 2 } : undefined,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: mode === 'athlete' ? 11.5 : 12.5, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icon('home') }} />
      <Tabs.Screen
        name="gestao"
        options={{
          title: 'Gestão',
          href: team ? '/(tabs)/gestao' : null,
          tabBarIcon: icon('clipboard'),
        }}
      />
      <Tabs.Screen
        name="competicoes"
        options={{
          title: 'Competições',
          href: mode === 'athlete' ? '/(tabs)/competicoes' : null,
          tabBarIcon: icon('medal'),
        }}
      />
      <Tabs.Screen
        name="atletas"
        options={{
          title: 'Meus atletas',
          tabBarLabel: 'Atletas',
          href: mode === 'guardian' ? '/(tabs)/atletas' : null,
          tabBarIcon: icon('people'),
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
        name="curriculo"
        options={{
          title: 'Currículo',
          href: mode === 'athlete' ? '/(tabs)/curriculo' : null,
          tabBarIcon: icon('trophy'),
        }}
      />
      <Tabs.Screen
        name="relatorios"
        options={{
          title: 'Relatórios',
          href: team ? '/(tabs)/relatorios' : null,
          tabBarIcon: icon('document-text'),
        }}
      />
      <Tabs.Screen
        name="documentos"
        options={{
          title: 'Documentos',
          tabBarLabel: 'Docs',
          href: null,
          tabBarIcon: icon('folder-open'),
        }}
      />
      <Tabs.Screen name="perfil" options={{ title: mode === 'athlete' ? 'Perfil do atleta' : 'Perfil', tabBarLabel: 'Perfil', tabBarIcon: icon('person-circle') }} />
    </Tabs>
  );
}
