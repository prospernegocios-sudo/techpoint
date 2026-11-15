// Aba "Documentos": do próprio atleta ou de cada atleta do responsável.
import { View } from 'react-native';
import { DocumentsCard } from '@/components/documents-card';
import { Loading, Notice, Screen, T } from '@/components/ui';
import { useMyKids } from '@/lib/kids';
import { useMe } from '@/lib/me';

export default function Documentos() {
  const me = useMe();
  const kids = useMyKids(me.mode === 'guardian' ? me.profile?.id : undefined);
  if (!me.profile) return <Loading />;
  if (me.mode === 'athlete' && me.athlete) {
    return <Screen><DocumentsCard orgId={me.athlete.org_id} athleteId={me.athlete.id} meId={me.profile.id} isStaff={false} /></Screen>;
  }
  if (kids.isLoading) return <Loading />;
  return (
    <Screen>
      {(kids.data ?? []).length === 0 && <Notice tone="info" text="Nenhum atleta ligado a você ainda." />}
      {(kids.data ?? []).map((k) => (
        <View key={k.id} style={{ gap: 8 }}>
          <T variant="subtitle">{k.full_name}</T>
          <DocumentsCard orgId={k.org_id} athleteId={k.id} meId={me.profile!.id} isStaff={false} />
        </View>
      ))}
    </Screen>
  );
}
