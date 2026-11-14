// Consentimento do responsável (LGPD, art. 14): itens obrigatórios e opcionais, registro com versão e data.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { Badge, Button, Card, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { toFriendlyError } from '@/lib/errors';
import { brDateTime } from '@/lib/report';
import { supabase } from '@/lib/supabase';
import { CONSENT_VERSION, consentIntro, consentItems } from '@/lib/terms';

type Consent = { id: string; source: string; terms_version: string; scope: Record<string, boolean>; granted_at: string; revoked_at: string | null; guardian_profile_id: string | null };

export default function Consentimento() {
  const { athleteId } = useLocalSearchParams<{ athleteId: string }>();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['consent', athleteId],
    queryFn: async () => {
      const [a, c] = await Promise.all([
        supabase.from('athletes').select('full_name, status').eq('id', athleteId!).single(),
        supabase.from('guardian_consents').select('*').eq('athlete_id', athleteId!).order('granted_at', { ascending: false }),
      ]);
      return { athlete: a.data as { full_name: string; status: string } | null, consents: (c.data ?? []) as Consent[] };
    },
  });
  const [scope, setScope] = useState<Record<string, boolean>>({ attendance: true, photos: true, sponsors: true, notifications: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (q.isLoading) return <Loading />;
  if (!q.data?.athlete) return <Screen><Notice tone="danger" text="Atleta não encontrado." /></Screen>;
  const active = q.data.consents.find((c) => !c.revoked_at);
  const first = q.data.athlete.full_name.split(' ')[0];

  const grant = async () => {
    setError(null);
    setBusy(true);
    const { error: e } = await supabase.rpc('grant_consent', { p_athlete_id: athleteId, p_terms_version: CONSENT_VERSION, p_scope: scope });
    setBusy(false);
    if (e) return setError(toFriendlyError(e).message);
    qc.invalidateQueries();
    router.replace('/(tabs)');
  };

  const revoke = (c: Consent) =>
    Alert.alert('Revogar consentimento?', `${first} deixa de ter a presença registrada e sai dos relatórios até um novo consentimento.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Revogar', style: 'destructive', onPress: async () => {
        const { error: e } = await supabase.rpc('revoke_consent', { p_consent_id: c.id });
        if (e) setError(toFriendlyError(e).message);
        qc.invalidateQueries();
      } },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Consentimento' }} />
      <T variant="title">Autorização para {first}</T>
      {active ? (
        <Card>
          <Badge label="Autorizado" tone="success" />
          <T variant="body">Autorizado em {brDateTime(active.granted_at)} {active.source === 'paper' ? '(termo em papel)' : 'pelo app'}.</T>
          {consentItems.map((i) => <T key={i.key} variant="small">{active.scope?.[i.key] === false ? '✗' : '✓'} {i.title}</T>)}
          {active.guardian_profile_id && <Button title="Revogar consentimento" kind="danger" onPress={() => revoke(active)} />}
        </Card>
      ) : (
        <>
          <T variant="muted">{consentIntro}</T>
          {consentItems.map((i) => (
            <Card key={i.key}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <T variant="subtitle" style={{ flex: 1 }}>{i.title}</T>
                {i.required ? <Badge label="Necessário" tone="primary" /> : (
                  <Switch accessibilityLabel={i.title} value={scope[i.key] !== false} onValueChange={(v) => setScope({ ...scope, [i.key]: v })} />
                )}
              </View>
              <T variant="small">{i.text}</T>
            </Card>
          ))}
          {error && <Notice tone="danger" text={error} />}
          <Button title={`Autorizo o uso dos dados de ${first}`} kind="accent" big loading={busy} onPress={grant} />
          <T variant="small">Versão do termo: {CONSENT_VERSION}. O aceite fica registrado com data e hora.</T>
        </>
      )}
    </Screen>
  );
}
