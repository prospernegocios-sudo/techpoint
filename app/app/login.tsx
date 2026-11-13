// Tela de login. Caminho principal: Google (uma vez; depois o app abre com biometria).
// Alternativa discreta: e-mail e senha (entrar, criar conta, recuperar senha).
// No computador: painel da marca à esquerda e cartão de acesso à direita.
import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Button, Notice, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

type Mode = 'choose' | 'login' | 'signup' | 'reset';

function Input({ label, value, onChangeText, secure, ...rest }: {
  label: string; value: string; onChangeText: (v: string) => void; secure?: boolean;
} & Partial<React.ComponentProps<typeof TextInput>>) {
  const { colors } = useTheme();
  const [show, setShow] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface }}>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure && !show}
          placeholderTextColor={colors.textMuted}
          style={{ flex: 1, minHeight: 50, paddingHorizontal: 14, fontSize: 16, color: colors.text }}
          {...rest}
        />
        {secure && (
          <Pressable accessibilityRole="button" accessibilityLabel={show ? 'Esconder senha' : 'Mostrar senha'} onPress={() => setShow(!show)} style={{ padding: 12 }}>
            <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Link({ title, onPress, align = 'center' }: { title: string; onPress: () => void; align?: 'center' | 'flex-end' }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={{ alignSelf: align, paddingVertical: 6 }}>
      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>{title}</Text>
    </Pressable>
  );
}

function Brand({ wide }: { wide: boolean }) {
  const { colors } = useTheme();
  const fg = wide ? colors.onPrimary : colors.text;
  return (
    <View style={{ gap: wide ? 28 : 10, alignItems: wide ? 'flex-start' : 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: wide ? 56 : 64, height: wide ? 56 : 64, borderRadius: 18, backgroundColor: wide ? colors.accent : colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark-done" size={wide ? 32 : 36} color={wide ? colors.onAccent : colors.accent} />
        </View>
        <Text style={{ fontSize: wide ? 30 : 30, fontWeight: '800', color: fg, letterSpacing: -0.5 }}>TechPoint</Text>
      </View>
      {wide ? (
        <>
          <Text style={{ fontSize: 34, fontWeight: '800', color: fg, lineHeight: 40 }}>
            Presença comprovada.{'\n'}Prestação de contas sem papel.
          </Text>
          <View style={{ gap: 16 }}>
            {([
              ['location-outline', 'Check-in com GPS, foto na hora e hora do servidor'],
              ['people-outline', 'Pais avisados da chegada e da saída dos filhos'],
              ['document-text-outline', 'Relatórios prontos para projetos incentivados'],
            ] as const).map(([icon, text]) => (
              <View key={text} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Ionicons name={icon} size={22} color={colors.accent} />
                <Text style={{ color: fg, fontSize: 16, opacity: 0.92 }}>{text}</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text style={{ color: colors.textMuted, fontSize: 15 }}>Presença e gestão de atletas</Text>
      )}
    </View>
  );
}

export default function Login() {
  const { session, signInWithGoogle, signInWithPassword, signUpWithPassword, resetPassword } = useAuth();
  const { colors } = useTheme();
  const wide = useWindowDimensions().width >= 900;
  const [mode, setMode] = useState<Mode>('choose');
  const [busy, setBusy] = useState<null | 'google' | 'email'>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  if (session) return <Redirect href="/(tabs)" />;

  const go = (m: Mode) => { setMode(m); setError(null); setInfo(null); };
  const run = async (kind: 'google' | 'email', fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(kind);
    setError(null);
    setInfo(null);
    const r = await fn();
    setBusy(null);
    if (!r.ok && r.message !== 'Login cancelado.') setError(r.message ?? 'Não foi possível concluir.');
    else if (r.message && r.ok) setInfo(r.message);
  };
  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const strong = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

  const titles: Record<Mode, [string, string]> = {
    choose: ['Entrar', 'Use sua conta Google para entrar em segundos.'],
    login: ['Entrar com e-mail', 'Para quem não usa conta Google.'],
    signup: ['Criar conta', 'Você vai receber um link para confirmar o e-mail.'],
    reset: ['Recuperar acesso', 'Enviamos um link para você entrar e criar uma nova senha.'],
  };

  const card = (
    <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 24, gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{titles[mode][0]}</Text>
        <Text style={{ fontSize: 14, color: colors.textMuted }}>{titles[mode][1]}</Text>
      </View>
      {error && <Notice tone="danger" text={error} />}
      {info && <Notice tone="success" text={info} />}

      {mode === 'choose' && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continuar com Google"
            disabled={Boolean(busy)}
            onPress={() => run('google', signInWithGoogle)}
            style={({ pressed }) => ({
              minHeight: 54, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#FFFFFF',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, opacity: pressed || busy ? 0.7 : 1,
            })}
          >
            <Ionicons name="logo-google" size={22} color="#4285F4" />
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#1F1F1F' }}>{busy === 'google' ? 'Abrindo o Google...' : 'Continuar com Google'}</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>ou</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>
          <Button title="Continuar com e-mail" kind="outline" onPress={() => go('login')} />
          <Text style={{ fontSize: 12.5, color: colors.textMuted, textAlign: 'center' }}>
            {Platform.OS === 'web'
              ? 'Para fazer check-in nos treinos, use o app no celular.'
              : 'Depois do primeiro acesso, o app abre com sua digital ou reconhecimento facial.'}
          </Text>
        </>
      )}

      {mode !== 'choose' && (
        <>
          {mode === 'signup' && <Input label="Nome completo" value={name} onChangeText={setName} maxLength={120} autoComplete="name" />}
          <Input label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="voce@exemplo.com" />
          {mode !== 'reset' && (
            <Input label="Senha" value={password} onChangeText={setPassword} secure autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              onSubmitEditing={() => mode === 'login' && validEmail && password && run('email', () => signInWithPassword(email, password))} />
          )}
          {mode === 'signup' && (
            <Text style={{ fontSize: 12.5, color: strong || !password ? colors.textMuted : colors.danger }}>
              Pelo menos 8 caracteres, com letras e números.
            </Text>
          )}
          {mode === 'login' && <Link title="Esqueci a senha" align="flex-end" onPress={() => go('reset')} />}

          {mode === 'login' && <Button title="Entrar" loading={busy === 'email'} disabled={!validEmail || !password} onPress={() => run('email', () => signInWithPassword(email, password))} />}
          {mode === 'signup' && <Button title="Criar conta" loading={busy === 'email'} disabled={!validEmail || !strong || name.trim().length < 3} onPress={() => run('email', () => signUpWithPassword(email, password, name))} />}
          {mode === 'reset' && <Button title="Enviar link" loading={busy === 'email'} disabled={!validEmail} onPress={() => run('email', () => resetPassword(email))} />}

          <View style={{ alignItems: 'center', gap: 2 }}>
            {mode === 'login' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>Ainda não tem conta?</Text>
                <Link title="Criar conta" onPress={() => go('signup')} />
              </View>
            )}
            {mode !== 'login' && <Link title="Já tenho conta: entrar" onPress={() => go('login')} />}
            <Link title="← Voltar para o Google" onPress={() => go('choose')} />
          </View>
        </>
      )}
    </View>
  );

  const legal = (
    <Text style={{ fontSize: 11.5, color: colors.textMuted, textAlign: 'center', maxWidth: 420, alignSelf: 'center' }}>
      Ao continuar, você concorda com os termos de uso e a política de privacidade do TechPoint (versão de teste).
    </Text>
  );

  if (wide) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
        <View style={{ flex: 1.1, backgroundColor: colors.primary, padding: 56, justifyContent: 'center' }}>
          <View style={{ maxWidth: 520 }}><Brand wide /></View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 40, gap: 16 }} keyboardShouldPersistTaps="handled">
          {card}
          {legal}
        </ScrollView>
      </View>
    );
  }
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20, gap: 22, paddingTop: 56 }} keyboardShouldPersistTaps="handled">
      <Brand wide={false} />
      {card}
      {legal}
    </ScrollView>
  );
}
