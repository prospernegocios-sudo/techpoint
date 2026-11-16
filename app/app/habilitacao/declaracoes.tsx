// Declarações do Termo de Fomento (Anexos I a XV) em Word, já preenchidas com os dados da entidade e do dirigente.
// O clube cola no papel timbrado, confere, imprime e assina.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { toast } from '@/components/toast';
import { Badge, Button, Card, Chip, Field, Loading, Notice, Screen, T } from '@/components/ui';
import { ANNEXES, type Annex, type DeclOrg } from '@/lib/declarations';
import { exportDeclarations } from '@/lib/declarations-export';
import { toFriendlyError } from '@/lib/errors';
import { saveHabilProfile, useHabilProfile, useOfficers, type HabilProfile } from '@/lib/habilitation';
import { useMe } from '@/lib/me';
import { supabase } from '@/lib/supabase';

type Form = Record<'proposal_number' | 'partnership_object' | 'execution_place' | 'sport' | 'space_name' | 'space_address' | 'space_owner' | 'execution_period' | 'counterpart_value' | 'counterpart_account', string>;
const KEYS: (keyof Form)[] = ['proposal_number', 'partnership_object', 'execution_place', 'sport', 'space_name', 'space_address', 'space_owner', 'execution_period', 'counterpart_value', 'counterpart_account'];
const toForm = (p: HabilProfile | null): Form => Object.fromEntries(KEYS.map((k) => [k, k === 'counterpart_value'
  ? (p?.counterpart_value != null ? String(p.counterpart_value).replace('.', ',') : '') : String(p?.[k] ?? '')])) as Form;

export default function Declaracoes() {
  const me = useMe();
  const orgId = me.org?.id;
  const allowed = (me.isManager || me.isPlatformAdmin) && me.hasModule('investimentos');
  const profile = useHabilProfile(allowed ? orgId : undefined);
  const officers = useOfficers(allowed ? orgId : undefined);
  const org = useQuery({
    queryKey: ['org-decl', orgId], enabled: Boolean(orgId && allowed),
    queryFn: async () => {
      const { data, error } = await supabase.from('organizations')
        .select('name, legal_name, cnpj, street, street_number, complement, district, city, uf, cep, website').eq('id', orgId!).single();
      if (error) throw error;
      return data as DeclOrg;
    },
  });
  const qc = useQueryClient();
  // Enquanto não há edição, o formulário mostra o que está salvo.
  const [edited, setEdited] = useState<Form | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const form = edited ?? toForm(profile.data ?? null);
  const dirty = edited !== null;

  if (!allowed) return <Screen><Stack.Screen options={{ title: 'Declarações' }} /><Notice tone="info" text="Disponível para gestores e administradores com o módulo de Gestão de Investimentos." /></Screen>;
  if (profile.isLoading || officers.isLoading || org.isLoading) return <Loading />;

  const list = officers.data ?? [];
  const signer = list.find((o) => o.is_signatory) ?? null;
  const set = (k: keyof Form) => (t: string) => setEdited({ ...form, [k]: t });
  const num = (s: string) => { const n = Number(s.replace(/\./g, '').replace(',', '.')); return s.trim() && Number.isFinite(n) ? n : null; };

  const persist = async () => {
    const patch: Partial<HabilProfile> = Object.fromEntries(KEYS.map((k) => [k, k === 'counterpart_value' ? num(form[k]) : form[k].trim() || null]));
    await saveHabilProfile(orgId!, patch);
    setEdited(null);
    qc.invalidateQueries({ queryKey: ['habil-profile', orgId] });
  };
  const save = async () => {
    setBusy('save');
    try { await persist(); toast('Dados salvos.'); } catch (e) { toast(toFriendlyError(e).message, 'danger'); } finally { setBusy(null); }
  };
  const download = async (annexes: Annex[], key: string) => {
    if (!org.data) return;
    setBusy(key);
    try {
      if (dirty) await persist();
      const p: HabilProfile = { ...(profile.data ?? ({} as HabilProfile)), ...Object.fromEntries(KEYS.map((k) => [k, k === 'counterpart_value' ? num(form[k]) : form[k].trim() || null])) } as HabilProfile;
      await exportDeclarations(annexes, { org: org.data, signer, officers: list, profile: p, date: new Date() });
    } catch (e) { toast(toFriendlyError(e).message, 'danger'); }
    finally { setBusy(null); }
  };

  const missing = [
    !signer && 'quem assina (em Dirigentes)',
    signer && (!signer.cpf || !signer.rg) && 'CPF e RG de quem assina',
    !org.data?.cnpj && 'CNPJ (em Dados da entidade)',
    !form.partnership_object.trim() && 'objeto da parceria',
  ].filter(Boolean) as string[];

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Declarações' }} />
      <T variant="title">Declarações em Word</T>
      <T variant="small">Os 15 modelos do Ministério já preenchidos. Abra no Word, cole no papel timbrado da entidade, confira, imprima e assine. Depois envie o arquivo assinado no item correspondente do checklist.</T>
      {missing.length > 0 && <Notice text={`Para sair completo, falta: ${missing.join(', ')}. O que faltar sai com pontilhado para preencher à mão.`} />}

      <Card style={{ gap: 10 }}>
        <T variant="body" style={{ fontWeight: '700' }}>Quem assina</T>
        {signer ? <T variant="body">{signer.full_name} · {signer.role_title}</T> : <T variant="small">Nenhum dirigente marcado para assinar.</T>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {list.map((o) => <Chip key={o.id} label={o.full_name.split(' ')[0]} selected={o.is_signatory} onPress={() => router.push('/habilitacao/dirigentes')} />)}
        </View>
        <Button kind="tonal" icon="people-outline" title="Dirigentes" onPress={() => router.push('/habilitacao/dirigentes')} />
      </Card>

      <Card style={{ gap: 12 }}>
        <T variant="body" style={{ fontWeight: '700' }}>Dados da proposta</T>
        <Field label="Nº da proposta no Transferegov.br" value={form.proposal_number} onChangeText={set('proposal_number')} hint="Se ainda não tem, deixe em branco." />
        <Field label="Objeto da parceria" value={form.partnership_object} onChangeText={set('partnership_object')} multiline
          placeholder="Ex.: Implantação e manutenção de núcleo de treinamento esportivo de categoria de base – Programa Revelar Talentos" />
        <Field label="Esporte / modalidade / categoria" value={form.sport} onChangeText={set('sport')} placeholder="Ex.: vôlei de quadra, Sub 15 e Sub 17" />
        <Field label="Local de execução" value={form.execution_place} onChangeText={set('execution_place')} placeholder="Ex.: Brasília/DF" />
        <Field label="Período de execução" value={form.execution_period} onChangeText={set('execution_period')} placeholder="Ex.: março/2027 a abril/2028" />
      </Card>

      <Card style={{ gap: 12 }}>
        <T variant="body" style={{ fontWeight: '700' }}>Espaço físico (Anexo III)</T>
        <Field label="Nome do espaço" value={form.space_name} onChangeText={set('space_name')} />
        <Field label="Endereço do espaço" value={form.space_address} onChangeText={set('space_address')} />
        <Field label="Proprietário do espaço" value={form.space_owner} onChangeText={set('space_owner')} placeholder="Ex.: Secretaria de Esporte do DF" />
      </Card>

      <Card style={{ gap: 12 }}>
        <T variant="body" style={{ fontWeight: '700' }}>Contrapartida (Anexo XIII, só acima de R$ 1 milhão)</T>
        <Field label="Valor da contrapartida (R$)" value={form.counterpart_value} onChangeText={set('counterpart_value')} keyboardType="decimal-pad" placeholder="0,00" />
        <Field label="Conta e banco do extrato" value={form.counterpart_account} onChangeText={set('counterpart_account')} />
      </Card>

      {dirty && <Button title="Salvar dados" onPress={save} loading={busy === 'save'} />}

      <Button big icon="download-outline" title="Baixar todas (um arquivo Word)" onPress={() => download(ANNEXES.map((a) => a.key), 'all')} loading={busy === 'all'} />
      <View style={{ gap: 8 }}>
        {ANNEXES.map((a) => (
          <Card key={a.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <T variant="body" style={{ fontWeight: '700' }}>Anexo {a.key}</T>
                {a.draft && <Badge label="Minuta" tone="warning" />}
              </View>
              <T variant="small">{a.title}</T>
              {a.draft && <T variant="small">O modelo oficial não veio no checklist do Ministério. Confira antes de assinar.</T>}
            </View>
            <Button kind="tonal" icon="download-outline" title="Word" onPress={() => download([a.key], a.key)} loading={busy === a.key} />
          </Card>
        ))}
      </View>
    </Screen>
  );
}
