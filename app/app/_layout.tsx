// Raiz do app: provedores (tema, login, dados) e a trava de biometria.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Button, T } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { MeProvider } from '@/lib/me';
import { configMissing } from '@/lib/supabase';
import { ThemeProvider, useTheme } from '@/lib/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function LockScreen() {
  const { unlock, signOut } = useAuth();
  const { colors } = useTheme();
  const [tried, setTried] = useState(false);
  useEffect(() => {
    unlock().finally(() => setTried(true));
  }, [unlock]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: 24, gap: 16 }}>
      <T variant="title" style={{ textAlign: 'center' }}>TechPoint</T>
      <T variant="muted" style={{ textAlign: 'center' }}>Use sua digital ou o reconhecimento facial para abrir o app.</T>
      {tried && <Button title="Desbloquear" big onPress={() => unlock()} />}
      {tried && <Button title="Sair da conta" kind="ghost" onPress={signOut} />}
    </View>
  );
}

function Shell() {
  const { colors, isDark } = useTheme();
  const { locked, session } = useAuth();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {session && locked ? (
        <LockScreen />
      ) : (
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            contentStyle: { backgroundColor: colors.background },
            headerBackTitle: 'Voltar',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      )}
    </>
  );
}

function ConfigMissingScreen() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: 24, gap: 16 }}>
      <T variant="title" style={{ textAlign: 'center' }}>TechPoint</T>
      <T variant="muted" style={{ textAlign: 'center' }}>
        Esta versão do app foi gerada sem a configuração do servidor. Avise a equipe técnica para gerar uma nova versão.
      </T>
    </View>
  );
}

export default function RootLayout() {
  if (configMissing) {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <ConfigMissingScreen />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <MeProvider>
              <Shell />
            </MeProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
