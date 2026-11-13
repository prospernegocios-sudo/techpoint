// Tela de login: Google uma única vez. Depois o app abre com biometria.
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Button, Field, Notice, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export default function Login() {
  const { session, signInWithGoogle, signInWithPassword, signUpWithPassword, resetPassword } = useAuth();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Entrada alternativa para quem não tem conta Google.
  const [emailMode, setEmailMode] = useState<null | 'login' | 'signup'>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const run = async (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) setError(r.message ?? 'Não foi possível concluir.');
    else if (r.message) setInfo(r.message);
  };
  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const strong = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

  if (session) return <Redirect href="/(tabs)" />;

  const onPress = async () => {
    setBusy(true);
    setError(null);
    const r = await signInWithGoogle();
    setBusy(false);
    if (!r.ok && r.message && r.message !== 'Login cancelado.') setError(r.message);
  };

  return (
    <Screen style={{ justifyContent: 'center', paddingTop: 48, maxWidth: 440 }}>
      <View style={{ alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <View style={{ width: 88, height: 88, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <T variant="title" color={colors.accent} style={{ fontSize: 44 }}>✓</T>
        </View>
        <T variant="title" style={{ fontSize: 32 }}>TechPoint</T>
        <T variant="muted" style={{ textAlign: 'center' }}>Presença e gestão de atletas</T>
      </View>
      {error && <Notice tone="danger" text={error} />}
      {info && <Notice tone="success" text={info} />}
      <Button title="Entrar com Google" big loading={busy && !emailMode} onPress={onPress} />
      <T variant="small" style={{ textAlign: 'center', marginTop: 12 }}>
        {Platform.OS === 'web'
          ? 'Entre com sua conta Google. Para fazer check-in nos treinos, use o app no celular.'
          : 'Você entra com o Google só uma vez. Depois, o app abre com sua digital ou reconhecimento facial.'}
      </T>

      {!emailMode ? (
        <Button title="Não tenho conta Google: entrar com e-mail e senha" kind="ghost" onPress={() => setEmailMode('login')} />
      ) : (
        <View style={{ gap: 10, marginTop: 16 }}>
          {emailMode === 'signup' && <Field label="Nome completo" value={name} onChangeText={setName} maxLength={120} />}
          <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry autoComplete={emailMode === 'signup' ? 'new-password' : 'current-password'}
            hint={emailMode === 'signup' ? 'Pelo menos 8 caracteres, com letras e números.' : undefined} />
          {emailMode === 'login' ? (
            <>
              <Button title="Entrar" loading={busy} disabled={!validEmail || !password} onPress={() => run(() => signInWithPassword(email, password))} />
              <Button title="Criar conta com e-mail" kind="outline" onPress={() => { setEmailMode('signup'); setError(null); }} />
              <Button title="Esqueci a senha" kind="ghost" disabled={!validEmail} onPress={() => run(() => resetPassword(email))} />
            </>
          ) : (
            <>
              <Button title="Criar conta" loading={busy} disabled={!validEmail || !strong || name.trim().length < 3} onPress={() => run(() => signUpWithPassword(email, password, name))} />
              <Button title="Já tenho conta: entrar" kind="ghost" onPress={() => { setEmailMode('login'); setError(null); }} />
            </>
          )}
        </View>
      )}
    </Screen>
  );
}
