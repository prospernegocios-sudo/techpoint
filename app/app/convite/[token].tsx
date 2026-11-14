// Link de convite do time: o atleta entra e pede para fazer parte; o treinador aprova (D37).
import { useQuery } from '@tanstack/react-query';
import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { DateField } from '@/components/date-field';
import { Button, Card, Chip, Field, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { digits, maskPhone, validEmail, validPhone } from '@/lib/br';
import { toFriendlyError } from '@/lib/errors';
import { ageOn, parseBrDate, toIsoDate } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { saveNext } from '@/lib/links';
import { orgLogoUrl } from '@/lib/me';
import { supabase } from '@/lib/supabase';

const relations = ['Mãe', 'Pai', 'Responsável legal', 'Outro'];

export default function Convite() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session, loading } = useAuth();
  const info = useQuery({
    queryKey: ['invite', token],
    queryFn: async () => {
      const { data } = await supabase.rpc('invite_info', { p_token: token });
      return data as { team: string; org: string; logo_path: string | null; valid: boolean } | null;
    },
  });
  const [name, setName] = useState(session?.user.user_metadata?.full_name ?? '');
  const [birth, setBirth] = useState('');
  const [g, setG] = useState({ name: '', phone: '', email: '', relationship: 'Mãe' });
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading || info.isLoading) return <Loading />;
  if (!info.data || !info.data.valid) {
    return <Screen><Stack.Screen options={{ title: 'Convite' }} /><Notice tone="danger" text="Este convite não existe mais ou expirou. Peça um link novo ao treinador." /></Screen>;
  }
  if (!session) {
    saveNext(`/convite/${token}`);
    return <Redirect href="/login" />;
  }

  const b = parseBrDate(birth);
  const age = b ? ageOn(b) : null;
  const minor = age !== null && age < 18;

  const send = async () => {
    setError(null);
    if (name.trim().length < 3) return setError('Informe seu nome completo.');
    if (!b) return setError('Escolha sua data de nascimento.');
    if (age !== null && age < 10) return setError('Para menores de 10 anos, quem faz o cadastro é o responsável.');
    if (minor) {
      if (g.name.trim().length < 3) return setError('Informe o nome do seu responsável.');
      if (!validPhone(g.phone) && !validEmail(g.email)) return setError('Informe o WhatsApp ou o e-mail do seu responsável.');
    }
    setBusy(true);
    const { error: e } = await supabase.rpc('request_to_join', {
      p_token: token, p_full_name: name.trim(), p_birth_date: toIsoDate(b),
      p_guardian: minor ? { name: g.name.trim(), phone: digits(g.phone), email: g.email.trim().toLowerCase(), relationship: g.relationship } : {},
    });
    setBusy(false);
    if (e) return setError(toFriendlyError(e).message);
    setSent(true);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Convite' }} />
      <Card style={{ alignItems: 'center' }}>
        {orgLogoUrl(info.data.logo_path) && <Image source={{ uri: orgLogoUrl(info.data.logo_path)! }} style={{ width: 72, height: 72, borderRadius: 16 }} accessibilityLabel="Logo" />}
        <T variant="title" style={{ textAlign: 'center' }}>{info.data.team}</T>
        <T variant="muted">{info.data.org}</T>
      </Card>
      {sent ? (
        <View style={{ gap: 12 }}>
          <Notice tone="success" text={`Pedido enviado! O treinador do ${info.data.team} vai aprovar.${minor ? ' Depois, seu responsável recebe um link para autorizar.' : ''}`} />
          <Button title="Ir para o início" onPress={() => router.replace('/(tabs)')} />
        </View>
      ) : (
        <>
          <Card>
            <T variant="subtitle">Seus dados</T>
            <Field label="Nome completo" value={name} onChangeText={setName} maxLength={120} />
            <DateField label="Data de nascimento" mode="date" value={birth} onChange={setBirth} hint={age !== null ? `${age} anos` : undefined} />
          </Card>
          {minor && (
            <Card>
              <T variant="subtitle">Seu responsável</T>
              <T variant="small">Como você tem menos de 18 anos, seu responsável precisa autorizar o uso dos seus dados.</T>
              <Field label="Nome do responsável" value={g.name} onChangeText={(v) => setG({ ...g, name: v })} maxLength={120} />
              <View style={styles.wrap}>{relations.map((r) => <Chip key={r} label={r} selected={g.relationship === r} onPress={() => setG({ ...g, relationship: r })} />)}</View>
              <Field label="WhatsApp do responsável" keyboardType="phone-pad" value={g.phone} onChangeText={(v) => setG({ ...g, phone: maskPhone(v) })} />
              <Field label="E-mail do responsável (opcional)" keyboardType="email-address" autoCapitalize="none" value={g.email} onChangeText={(v) => setG({ ...g, email: v })} />
            </Card>
          )}
          {error && <Notice tone="danger" text={error} />}
          <Button title="Pedir para entrar no time" kind="accent" big loading={busy} onPress={send} />
        </>
      )}
    </Screen>
  );
}
