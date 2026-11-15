// Aba "Meus atletas" do responsável: atalhos para currículo, dados e documentos de cada filho.
import { router } from 'expo-router';
import { Badge, Button, Card, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { ageOn } from '@/lib/format';
import { useMyKids } from '@/lib/kids';
import { useMe } from '@/lib/me';
import { View } from 'react-native';

export default function MeusAtletas() {
  const me = useMe();
  const kids = useMyKids(me.profile?.id);
  if (kids.isLoading) return <Loading />;
  return (
    <Screen>
      {(kids.data ?? []).length === 0 && <Notice tone="info" text="Nenhum atleta ligado a você ainda. Peça o link à entidade ou ao atleta." />}
      {(kids.data ?? []).map((k) => (
        <Card key={k.id}>
          <T variant="subtitle">{k.full_name}</T>
          <View style={styles.wrap}>
            <T variant="small">{ageOn(new Date(k.birth_date + 'T12:00:00'))} anos</T>
            {k.status === 'pending_consent' && <Badge label="Aguardando sua autorização" tone="warning" />}
          </View>
          <Button title="Currículo esportivo" kind="accent" onPress={() => router.push({ pathname: '/curriculo/[athleteId]', params: { athleteId: k.id } })} />
          <Button title="Dados, documentos e responsáveis" kind="outline" onPress={() => router.push({ pathname: '/atleta/[id]', params: { id: k.id } })} />
          <Button title="Autorização (LGPD)" kind="ghost" onPress={() => router.push({ pathname: '/consentimento/[athleteId]', params: { athleteId: k.id } })} />
        </Card>
      ))}
    </Screen>
  );
}
