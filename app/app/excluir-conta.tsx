// Exclusão de conta e de dados (LGPD art. 18 e exigência do Google Play).
// Página pública: também é o link web informado na loja. O pedido exige login, para confirmar o titular.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Button, Card, Field, Loading, Notice, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { toFriendlyError } from '@/lib/errors';
import { saveNext } from '@/lib/links';
import { brDateTime } from '@/lib/report';
import { supabase } from '@/lib/supabase';

type Req = { id: string; status: string; requested_at: string; processed_at: string | null };

export default function ExcluirConta() {
  const { session, loading } = useAuth();
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const req = useQuery({
    queryKey: ['deletion-request', session?.user.id],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error: e } = await supabase.from('deletion_requests').select('id, status, requested_at, processed_at').order('requested_at', { ascending: false }).limit(1);
      if (e) throw e;
      return (data?.[0] ?? null) as Req | null;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['deletion-request'] });

  const send = async () => {
    setBusy(true); setError(null);
    const { error: e } = await supabase.rpc('request_account_deletion', { p_reason: reason.trim() || null });
    setBusy(false);
    if (e) return setError(toFriendlyError(e).message);
    setConfirm(false); refresh();
  };
  const cancel = async () => {
    const { error: e } = await supabase.rpc('cancel_account_deletion');
    if (e) return setError(toFriendlyError(e).message);
    refresh();
  };

  const pending = req.data?.status === 'pending';
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Excluir conta e dados' }} />
      <T variant="title">Excluir conta e dados</T>
      <Card>
        <T variant="subtitle">Como funciona</T>
        <T variant="body">1. Você faz o pedido aqui, já conectado à sua conta.</T>
        <T variant="body">2. Em até 15 dias a sua conta é excluída: você perde o acesso, e o seu nome, e-mail, telefone, fotos de perfil, documentos enviados e vínculos de responsável são apagados.</T>
        <T variant="body">3. Registros de presença que fazem parte da prestação de contas de projetos (Lei de Incentivo, convênios, patrocínios) podem ser guardados pelo prazo exigido por lei, sem uso para outra finalidade (LGPD, art. 16).</T>
        <T variant="small">Responsáveis: para excluir os dados de um atleta menor de idade, faça o pedido com a conta de responsável ou fale com a entidade.</T>
      </Card>

      {loading && <Loading />}
      {!loading && !session && (
        <Card>
          <T variant="body">Entre na sua conta para fazer o pedido.</T>
          <Button title="Entrar" onPress={() => { saveNext('/excluir-conta'); router.push('/login'); }} />
        </Card>
      )}
      {session && req.isLoading && <Loading />}
      {error && <Notice tone="danger" text={error} />}
      {session && !req.isLoading && pending && (
        <Card>
          <Notice tone="warning" text={`Pedido recebido em ${brDateTime(req.data!.requested_at)}. A exclusão será feita em até 15 dias.`} />
          <Button title="Desistir do pedido" kind="outline" onPress={cancel} />
        </Card>
      )}
      {session && !req.isLoading && !pending && (
        <Card>
          {req.data?.status === 'done' && <Notice tone="success" text="Seu pedido anterior já foi atendido." />}
          <Field label="Motivo (opcional)" value={reason} onChangeText={setReason} maxLength={500} multiline />
          {!confirm ? (
            <Button title="Quero excluir minha conta" kind="danger" onPress={() => setConfirm(true)} />
          ) : (
            <>
              <Notice tone="danger" text="Tem certeza? Depois de excluída, a conta não pode ser recuperada." />
              <Button title={busy ? 'Enviando...' : 'Sim, pedir a exclusão'} kind="danger" disabled={busy} onPress={send} />
              <Button title="Cancelar" kind="ghost" onPress={() => setConfirm(false)} />
            </>
          )}
        </Card>
      )}
    </Screen>
  );
}
