// Tela de login: Google uma única vez. Depois o app abre com biometria.
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Notice, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export default function Login() {
  const { session, signInWithGoogle } = useAuth();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Redirect href="/(tabs)" />;

  const onPress = async () => {
    setBusy(true);
    setError(null);
    const r = await signInWithGoogle();
    setBusy(false);
    if (!r.ok && r.message && r.message !== 'Login cancelado.') setError(r.message);
  };

  return (
    <Screen scroll={false} style={{ justifyContent: 'center', paddingTop: 48 }}>
      <View style={{ alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <View style={{ width: 88, height: 88, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <T variant="title" color={colors.accent} style={{ fontSize: 44 }}>✓</T>
        </View>
        <T variant="title" style={{ fontSize: 32 }}>TechPoint</T>
        <T variant="muted" style={{ textAlign: 'center' }}>Presença e gestão de atletas</T>
      </View>
      {error && <Notice tone="danger" text={error} />}
      <Button title="Entrar com Google" big loading={busy} onPress={onPress} />
      <T variant="small" style={{ textAlign: 'center', marginTop: 12 }}>
        Você entra com o Google só uma vez. Depois, o app abre com sua digital ou reconhecimento facial.
      </T>
    </Screen>
  );
}
