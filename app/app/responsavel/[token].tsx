// Link do responsável: entra, fica ligado ao atleta e segue para o consentimento.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image } from 'react-native';
import { Button, Card, Loading, Notice, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { toFriendlyError } from '@/lib/errors';
import { saveNext } from '@/lib/links';
import { orgLogoUrl, useMe } from '@/lib/me';
import { supabase } from '@/lib/supabase';

export default function ConviteResponsavel() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session, loading } = useAuth();
  const me = useMe();
  const qc = useQueryClient();
  const info = useQuery({
    queryKey: ['guardian-invite', token],
    queryFn: async () => {
      const { data } = await supabase.rpc('guardian_invite_info', { p_token: token });
      return data as { athlete_first_name: string; org: string; logo_path: string | null; status: string; minor: boolean } | null;
    },
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading || info.isLoading) return <Loading />;
  if (!info.data || info.data.status === 'revoked') {
    return <Screen><Stack.Screen options={{ title: 'Responsável' }} /><Notice tone="danger" text="Este link não é mais válido. Peça um novo ao treinador." /></Screen>;
  }
  if (!session) {
    saveNext(`/responsavel/${token}`);
    return <Redirect href="/login" />;
  }

  const accept = async () => {
    setError(null);
    setBusy(true);
    const { data, error: e } = await supabase.rpc('accept_guardian_invite', { p_token: token });
    setBusy(false);
    if (e) return setError(toFriendlyError(e).message);
    await qc.invalidateQueries({ queryKey: ['me'] });
    me.setMode('guardian');
    router.replace({ pathname: '/consentimento/[athleteId]', params: { athleteId: (data as { athlete_id: string }).athlete_id } });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Responsável' }} />
      <Card style={{ alignItems: 'center' }}>
        {orgLogoUrl(info.data.logo_path) && <Image source={{ uri: orgLogoUrl(info.data.logo_path)! }} style={{ width: 72, height: 72, borderRadius: 16 }} accessibilityLabel="Logo" />}
        <T variant="title" style={{ textAlign: 'center' }}>{info.data.org}</T>
      </Card>
      <T variant="body">Você foi indicado como responsável por <T variant="body" style={{ fontWeight: '800' }}>{info.data.athlete_first_name}</T> no TechPoint.</T>
      <T variant="muted">Com isso você acompanha a presença dele nos treinos e decide sobre o uso dos dados.</T>
      {error && <Notice tone="danger" text={error} />}
      <Button title="Sou o responsável: continuar" kind="accent" big loading={busy} onPress={accept} />
      <T variant="small">Entrou com a conta errada? Saia em Perfil e entre com a sua conta.</T>
    </Screen>
  );
}
