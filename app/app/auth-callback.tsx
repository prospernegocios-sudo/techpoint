// Tela de retorno do login com Google (link techpoint://auth-callback).
// Conclui o login se ainda não foi concluído e segue para o app.
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Loading, Notice, Screen } from '@/components/ui';
import { completeSignIn, useAuth } from '@/lib/auth';

export default function AuthCallback() {
  const { session } = useAuth();
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [failed, setFailed] = useState<string | null>(error_description ? `O Google recusou o login: ${error_description}` : null);

  useEffect(() => {
    if (session || !code) return;
    completeSignIn(code).then((r) => {
      if (!r.ok) setFailed(r.message ?? 'Não foi possível concluir o login.');
    });
  }, [code, session]);

  if (session) return <Redirect href="/(tabs)" />;
  if (failed || !code) {
    return (
      <Screen>
        <Notice tone="danger" text={failed ?? 'Não recebemos a confirmação do Google. Tente de novo.'} />
        <Button title="Voltar para o login" onPress={() => router.replace('/login')} />
      </Screen>
    );
  }
  return <Loading text="Concluindo o login..." />;
}
