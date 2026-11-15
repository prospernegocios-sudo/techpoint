// Aba "Currículo" do atleta.
import { CvView } from '@/components/cv-view';
import { Notice, Screen } from '@/components/ui';
import { useMe } from '@/lib/me';

export default function MeuCurriculo() {
  const me = useMe();
  if (!me.athlete) return <Screen><Notice tone="info" text="O currículo aparece para quem tem cadastro de atleta." /></Screen>;
  return (
    <Screen>
      <CvView athleteId={me.athlete.id} orgId={me.athlete.org_id} isStaff={false} canShare />
    </Screen>
  );
}
