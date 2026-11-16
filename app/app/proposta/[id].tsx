// Editor do Projeto Técnico em 7 passos (modelo do Ministério do Esporte, Revelar Talentos).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView } from 'react-native';
import {
  StepCronogramas, StepDados, StepMetas, StepOrcamento, StepPublico, StepRevisar, StepTextos,
} from '@/components/proposal-steps';
import { toast } from '@/components/toast';
import { Button, Card, Chip, Field, Loading, Notice, Screen, T } from '@/components/ui';
import { toFriendlyError } from '@/lib/errors';
import { useOfficers } from '@/lib/habilitation';
import { useMe } from '@/lib/me';
import { DateField } from '@/components/date-field';
import { approveProposal } from '@/lib/execution';
import { parseBrDate, toIsoDate } from '@/lib/format';
import { AXES, deleteProposal, summarizeAudience, updateProposal, useOrgAthletes, useProposal, type Proposal } from '@/lib/proposal';
import { exportBudgetCsv, exportProposalDoc } from '@/lib/proposal-export';
import { supabase } from '@/lib/supabase';

const STEPS = ['Dados', 'Textos', 'Público', 'Metas', 'Orçamento', 'Cronogramas', 'Revisar'] as const;
type Step = (typeof STEPS)[number];
const STATUS: { key: Proposal['status']; label: string }[] = [
  { key: 'rascunho', label: 'Rascunho' }, { key: 'enviada', label: 'Enviada ao Ministério' }, { key: 'arquivada', label: 'Arquivada' },
];

export default function ProjetoTecnico() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const allowed = (me.isManager || me.isPlatformAdmin) && me.hasModule('investimentos');
  const q = useProposal(allowed ? id : undefined);
  const orgId = q.data?.p.org_id;
  const ath = useOrgAthletes(orgId);
  const officers = useOfficers(orgId);
  const org = useQuery({
    queryKey: ['org-proposal', orgId], enabled: Boolean(orgId),
    queryFn: async () => (await supabase.from('organizations').select('name, legal_name, cnpj, phone, email, street, street_number, complement, district, city, uf, cep').eq('id', orgId!).single()).data,
  });
  const profile = useQuery({
    queryKey: ['habil-profile', orgId], enabled: Boolean(orgId),
    queryFn: async () => (await supabase.from('org_habil_profile').select('sport').eq('org_id', orgId!).maybeSingle()).data as { sport: string | null } | null,
  });
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('Dados');
  const [approve, setApprove] = useState<{ number: string; date: string } | null>(null);
  const [approving, setApproving] = useState(false);

  const aud = useMemo(() => {
    if (!q.data || !ath.data) return null;
    const start = q.data.p.starts_on ? new Date(q.data.p.starts_on + 'T12:00:00') : new Date();
    return summarizeAudience(q.data.p.audience ?? {}, ath.data.athletes, start);
  }, [q.data, ath.data]);

  if (!allowed) return <Screen><Stack.Screen options={{ title: 'Projeto Técnico' }} /><Notice tone="info" text="Disponível para gestores e administradores com o módulo de Gestão de Investimentos." /></Screen>;
  if (q.isLoading) return <Loading />;
  if (!q.data) return <Screen><Notice tone="danger" text="Projeto não encontrado." /></Screen>;
  const { p, goals, items } = q.data;
  const refresh = () => { qc.invalidateQueries({ queryKey: ['proposal', id] }); qc.invalidateQueries({ queryKey: ['proposals', p.org_id] }); };
  const props = { p, goals, items, refresh };

  const ctx = () => {
    const o = org.data;
    const signer = officers.data?.find((x) => x.is_signatory) ?? null;
    const address = o ? [[o.street, o.street_number].filter(Boolean).join(', '), o.complement, o.district, o.cep ? `CEP ${o.cep}` : null].filter(Boolean).join(' – ') : '';
    return { p, goals, items, aud, org: { ...(o ?? { name: me.org?.name ?? '' }), address }, signer, sport: profile.data?.sport ?? null };
  };
  const remove = () => {
    const go = async () => {
      try { await deleteProposal(p.id); toast('Projeto apagado.'); qc.invalidateQueries({ queryKey: ['proposals', p.org_id] }); router.back(); }
      catch (e) { toast(toFriendlyError(e).message, 'danger'); }
    };
    if (Platform.OS === 'web') { if (window.confirm('Apagar este Projeto Técnico?')) go(); }
    else Alert.alert('Apagar este Projeto Técnico?', undefined, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: go }]);
  };

  const doApprove = async () => {
    const d = approve && parseBrDate(approve.date);
    if (!approve || approve.number.trim().length < 3 || !d) { toast('Informe o número do Termo de Fomento e a data de assinatura.', 'danger'); return; }
    setApproving(true);
    try {
      const projectId = await approveProposal(p.id, approve.number.trim(), toIsoDate(d));
      toast('Aprovado! O projeto de execução foi criado.');
      refresh();
      qc.invalidateQueries({ queryKey: ['projects'] });
      router.push({ pathname: '/projeto/[id]/execucao', params: { id: projectId } });
    } catch (e) { toast(toFriendlyError(e).message, 'danger'); } finally { setApproving(false); }
  };
  const approved = p.status === 'aprovada';

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Projeto Técnico' }} />
      <T variant="title">{p.title}</T>
      {approved && (
        <Card style={{ gap: 8 }}>
          <Notice tone="success" text="Proposta aprovada: virou o projeto de execução. O orçamento aprovado é o valor combinado e não muda mais; ajustes ficam registrados na execução." />
          {p.project_id && <Button icon="cash-outline" title="Abrir execução e prestação de contas" onPress={() => router.push({ pathname: '/projeto/[id]/execucao', params: { id: p.project_id! } })} />}
        </Card>
      )}
      <T variant="small">{AXES.find((a) => a.key === p.axis)?.label} · Termo de Fomento</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
        {STEPS.filter((s) => !approved || s === 'Revisar').map((s) => <Chip key={s} label={`${STEPS.indexOf(s) + 1}. ${s}`} selected={(approved ? 'Revisar' : step) === s} onPress={() => setStep(s)} />)}
      </ScrollView>

      {!approved && step === 'Dados' && <StepDados {...props} />}
      {!approved && step === 'Textos' && <StepTextos {...props} />}
      {!approved && step === 'Público' && <StepPublico {...props} teams={ath.data?.teams ?? []} aud={aud} />}
      {!approved && step === 'Metas' && <StepMetas {...props} />}
      {!approved && step === 'Orçamento' && <StepOrcamento {...props} />}
      {!approved && step === 'Cronogramas' && <StepCronogramas {...props} />}
      {(approved || step === 'Revisar') && (
        <StepRevisar {...props} aud={aud} onExportDoc={() => exportProposalDoc(ctx())} onExportCsv={() => exportBudgetCsv(ctx())} />
      )}

      {!approved && step !== 'Revisar' && (
        <Button kind="tonal" title={`Próximo: ${STEPS[STEPS.indexOf(step) + 1]}`} onPress={() => setStep(STEPS[STEPS.indexOf(step) + 1])} />
      )}
      {!approved && step === 'Dados' && (
        <>
          <T variant="small" style={{ fontWeight: '700', marginTop: 8 }}>Situação</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {STATUS.map((s) => (
              <Chip key={s.key} label={s.label} selected={p.status === s.key}
                onPress={() => updateProposal(p.id, { status: s.key }).then(() => { toast('Situação atualizada.'); refresh(); }).catch((e) => toast(toFriendlyError(e).message, 'danger'))} />
            ))}
          </ScrollView>
          {approve ? (
            <Card style={{ gap: 10 }}>
              <T variant="body" style={{ fontWeight: '700' }}>Aprovar e criar o projeto de execução</T>
              <T variant="small">Vai junto: vigência, equipes e atletas do público-alvo (viram beneficiários), metas (as de check-in seguem automáticas) e o orçamento como valor combinado. Depois disso o Projeto Técnico fica travado.</T>
              <Field label="Nº do Termo de Fomento" value={approve.number} onChangeText={(t) => setApprove({ ...approve, number: t })} placeholder="Ex.: 951234/2027" />
              <DateField label="Data de assinatura" mode="date" value={approve.date} onChange={(t) => setApprove({ ...approve, date: t })} placeholder="dd/mm/aaaa" />
              <Button title="Aprovar e criar projeto" icon="checkmark-done-outline" onPress={doApprove} loading={approving} />
              <Button kind="outline" title="Cancelar" onPress={() => setApprove(null)} />
            </Card>
          ) : (
            <Button kind="tonal" icon="checkmark-done-outline" title="Proposta aprovada pelo Ministério? Aprovar e criar o projeto" onPress={() => setApprove({ number: '', date: '' })} />
          )}
          <Button kind="outline" icon="trash-outline" title="Apagar este Projeto Técnico" onPress={remove} />
        </>
      )}
    </Screen>
  );
}
