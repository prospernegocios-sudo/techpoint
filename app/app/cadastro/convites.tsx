// Convidar atletas (link por time) e aprovar os pedidos de entrada (D37).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, Chip, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { maskPhone } from '@/lib/br';
import { toFriendlyError } from '@/lib/errors';
import { ageOn } from '@/lib/format';
import { guardianUrl, inviteUrl, openWhatsApp, shareText } from '@/lib/links';
import { useMe } from '@/lib/me';
import { useAthletes, useTeams } from '@/lib/queries';
import { isoDayToBr } from '@/lib/report';
import { supabase } from '@/lib/supabase';

type Req = {
  id: string; team_id: string; full_name: string; birth_date: string; status: string; created_at: string;
  guardian_name: string | null; guardian_phone: string | null; guardian_email: string | null; guardian_relationship: string | null;
  profiles: { email: string | null } | null;
};

export default function Convites() {
  const { org, isStaff } = useMe();
  const teams = useTeams(org?.id);
  const athletes = useAthletes(org?.id);
  const qc = useQueryClient();
  const reqs = useQuery({
    queryKey: ['join-requests', org?.id],
    enabled: Boolean(org),
    queryFn: async () => {
      const { data } = await supabase.from('athlete_join_requests')
        .select('id, team_id, full_name, birth_date, status, created_at, guardian_name, guardian_phone, guardian_email, guardian_relationship, profiles(email)')
        .eq('org_id', org!.id).eq('status', 'pending').order('created_at');
      return (data ?? []) as unknown as Req[];
    },
  });
  const [teamId, setTeamId] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [linkFor, setLinkFor] = useState<Record<string, string | null>>({});
  const [done, setDone] = useState<{ name: string; guardianToken: string | null; phone: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isStaff) return <Screen><Notice tone="danger" text="Apenas a equipe da entidade convida atletas." /></Screen>;
  const teamName = (id: string) => teams.data?.find((t) => t.id === id)?.name ?? '';

  const makeLink = async () => {
    if (!teamId) return setError('Escolha o time.');
    setError(null);
    const { data: existing } = await supabase.from('team_invites').select('token').eq('team_id', teamId).eq('active', true).gt('expires_at', new Date().toISOString()).limit(1).maybeSingle();
    let token = existing?.token as string | undefined;
    if (!token) {
      const { data, error: e } = await supabase.from('team_invites').insert({ org_id: org!.id, team_id: teamId }).select('token').single();
      if (e) return setError(toFriendlyError(e).message);
      token = data.token;
    }
    setLink(inviteUrl(token!));
  };
  const inviteText = () => `Olá! Este é o convite para entrar no ${teamName(teamId!)} (${org?.name}) no TechPoint: ${link}`;

  const decide = async (r: Req, approve: boolean) => {
    setError(null);
    const { data, error: e } = await supabase.rpc('decide_join_request', { p_request_id: r.id, p_approve: approve, p_link_athlete_id: linkFor[r.id] ?? null });
    if (e) return setError(toFriendlyError(e).message);
    qc.invalidateQueries({ queryKey: ['join-requests'] });
    qc.invalidateQueries({ queryKey: ['athletes'] });
    if (approve) setDone({ name: r.full_name, guardianToken: (data as { guardian_token: string | null }).guardian_token, phone: r.guardian_phone });
  };

  // Cadastros sem conta com nome parecido: sugestão para ligar em vez de duplicar.
  const similar = (r: Req) => (athletes.data ?? []).filter((a) => !a.profile_id && a.full_name.toLowerCase().split(' ')[0] === r.full_name.toLowerCase().split(' ')[0]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Convites e pedidos' }} />
      <Card>
        <T variant="subtitle">Convidar atletas</T>
        <T variant="small">Gere o link do time e mande no WhatsApp (no grupo ou para cada atleta). Quem abrir faz um pedido, e você aprova aqui.</T>
        <View style={styles.wrap}>{(teams.data ?? []).map((t) => <Chip key={t.id} label={t.name} selected={teamId === t.id} onPress={() => { setTeamId(t.id); setLink(null); }} />)}</View>
        <Button title="Gerar link do time" onPress={makeLink} />
        {link && (
          <View style={{ gap: 8 }}>
            <T variant="small" style={{ fontWeight: '700' }}>{link}</T>
            <Button title="Enviar pelo WhatsApp" kind="accent" onPress={() => openWhatsApp(inviteText())} />
            <Button title={copied ? 'Link copiado' : 'Compartilhar ou copiar'} kind="outline" onPress={async () => setCopied((await shareText(inviteText())) === 'copied')} />
          </View>
        )}
      </Card>

      {error && <Notice tone="danger" text={error} />}
      {done && (
        <Card>
          <Notice tone="success" text={`${done.name} foi aprovado.`} />
          {done.guardianToken ? (
            <>
              <T variant="small">Agora o responsável precisa autorizar. Envie o link para ele:</T>
              <Button title="Enviar link ao responsável (WhatsApp)" kind="accent"
                onPress={() => openWhatsApp(`Olá! Para autorizar ${done.name.split(' ')[0]} a usar o TechPoint no ${org?.name}, abra: ${guardianUrl(done.guardianToken!)}`, done.phone)} />
            </>
          ) : <T variant="small">Atleta maior de idade: já pode fazer check-in.</T>}
          <Button title="Fechar" kind="ghost" onPress={() => setDone(null)} />
        </Card>
      )}

      <T variant="subtitle">Pedidos para aprovar ({reqs.data?.length ?? 0})</T>
      {reqs.isLoading && <Loading />}
      {reqs.data?.length === 0 && <T variant="muted">Nenhum pedido pendente.</T>}
      {(reqs.data ?? []).map((r) => {
        const age = ageOn(new Date(r.birth_date + 'T12:00:00'));
        const sims = similar(r);
        return (
          <Card key={r.id}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <T variant="subtitle" style={{ flex: 1 }}>{r.full_name}</T>
              <Badge label={teamName(r.team_id)} tone="primary" />
            </View>
            <T variant="small">{age} anos · nascimento {isoDayToBr(r.birth_date)} · {r.profiles?.email}</T>
            {r.guardian_name && <T variant="small">Responsável: {r.guardian_name}{r.guardian_relationship ? ` (${r.guardian_relationship})` : ''}{r.guardian_phone ? ` · ${maskPhone(r.guardian_phone)}` : ''}{r.guardian_email ? ` · ${r.guardian_email}` : ''}</T>}
            {sims.length > 0 && (
              <View style={{ gap: 6 }}>
                <T variant="small">Já existe cadastro parecido. Ligar a ele em vez de criar outro?</T>
                <View style={styles.wrap}>
                  <Chip label="Criar novo" selected={!linkFor[r.id]} onPress={() => setLinkFor({ ...linkFor, [r.id]: null })} />
                  {sims.map((a) => <Chip key={a.id} label={`Ligar a ${a.full_name}`} selected={linkFor[r.id] === a.id} onPress={() => setLinkFor({ ...linkFor, [r.id]: a.id })} />)}
                </View>
              </View>
            )}
            <View style={styles.row}>
              <Button title="Aprovar" style={{ flex: 1 }} onPress={() => decide(r, true)} />
              <Button title="Recusar" kind="danger" style={{ flex: 1 }} onPress={() => decide(r, false)} />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
