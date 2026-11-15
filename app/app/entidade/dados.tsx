// Dados da entidade, responsáveis legais e meus dados de administrador (só administradores).
import { toast } from '@/components/toast';
import { SITE_URL, shareText } from '@/lib/links';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { BrandingCard, type Branding } from '@/components/branding-card';
import { OrgForm, RepCard, emptyOrg, emptyRep, orgFromDb, orgToDb, repFromDb, repToDb, validateOrg, validateRep, type OrgFields, type Rep } from '@/components/org-form';
import { Badge, Button, Card, Field, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { digits, maskCpf, maskPhone, validCpf, validPhone } from '@/lib/br';
import { toFriendlyError } from '@/lib/errors';
import { orgLogoUrl, useMe } from '@/lib/me';
import { uploadLogo } from '@/lib/logo';
import { supabase } from '@/lib/supabase';

export default function DadosEntidade() {
  const me = useMe();
  const qc = useQueryClient();
  const orgId = me.org?.id;
  const uid = me.profile?.id;
  const q = useQuery({
    queryKey: ['org-data', orgId],
    enabled: Boolean(orgId && uid),
    queryFn: async () => {
      const [o, r, p, m] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', orgId!).single(),
        supabase.from('org_legal_representatives').select('*').eq('org_id', orgId!).order('created_at'),
        supabase.from('profile_private').select('cpf, phone').eq('profile_id', uid!).maybeSingle(),
        supabase.from('memberships').select('id, title').eq('org_id', orgId!).eq('profile_id', uid!).eq('role', 'admin').maybeSingle(),
      ]);
      if (o.error) throw o.error;
      return { org: o.data as Record<string, string | null>, reps: (r.data ?? []) as Record<string, string | null>[], mine: p.data, membership: m.data };
    },
  });
  const [org, setOrg] = useState<OrgFields>(emptyOrg);
  const [reps, setReps] = useState<Rep[]>([]);
  const [mine, setMine] = useState({ cpf: '', phone: '', title: '' });
  const [brand, setBrand] = useState<Branding>({ logo: null, logoUrl: null, primary: null, accent: null, candidates: [] });
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  // Erros também aparecem no aviso rápido, perto de onde a pessoa tocou (D86).
  useEffect(() => { if (msg?.tone === 'danger') toast(msg.text, 'danger'); }, [msg]);

  useEffect(() => {
    if (!q.data) return;
    setOrg(orgFromDb(q.data.org));
    setBrand({ logo: null, logoUrl: orgLogoUrl(q.data.org.logo_path), primary: q.data.org.theme_primary, accent: q.data.org.theme_accent, candidates: [] });
    setReps(q.data.reps.map(repFromDb));
    setMine({ cpf: maskCpf(q.data.mine?.cpf ?? ''), phone: maskPhone(q.data.mine?.phone ?? ''), title: q.data.membership?.title ?? '' });
  }, [q.data]);

  if (!me.isAdmin && !me.isPlatformAdmin) return <Screen><Notice tone="danger" text="Apenas administradores da entidade veem estes dados." /></Screen>;
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <Screen><Notice tone="danger" text="Não foi possível carregar os dados. Verifique a internet." /></Screen>;
  const status = q.data.org.review_status;

  const saveOrg = async () => {
    setMsg(null);
    const e = validateOrg(org);
    if (e) return setMsg({ tone: 'danger', text: e });
    setBusy(true);
    const { error } = await supabase.from('organizations').update(orgToDb(org)).eq('id', orgId!);
    setBusy(false);
    if (error) return setMsg({ tone: 'danger', text: toFriendlyError(error).message });
    toast('Dados da entidade salvos.');
    qc.invalidateQueries({ queryKey: ['org-data', orgId] });
  };

  const saveBrand = async () => {
    setMsg(null);
    setBusy(true);
    try {
      const logo_path = brand.logo ? await uploadLogo(orgId!, brand.logo) : q.data.org.logo_path;
      const { error } = await supabase.from('organizations').update({ logo_path, theme_primary: brand.primary, theme_accent: brand.accent }).eq('id', orgId!);
      if (error) throw error;
      toast('Logo e cores salvos.');
      qc.invalidateQueries({ queryKey: ['org-data', orgId] });
      me.refetch();
    } catch (e) {
      setMsg({ tone: 'danger', text: toFriendlyError(e).message });
    } finally {
      setBusy(false);
    }
  };

  const saveRep = async (r: Rep, i: number) => {
    setMsg(null);
    const e = validateRep(r);
    if (e) return setMsg({ tone: 'danger', text: e });
    const row = repToDb(r);
    const { error } = r.id
      ? await supabase.from('org_legal_representatives').update(row).eq('id', r.id)
      : await supabase.from('org_legal_representatives').insert({ ...row, org_id: orgId! });
    if (error) return setMsg({ tone: 'danger', text: toFriendlyError(error).message });
    toast(`Responsável ${i + 1} salvo.`);
    qc.invalidateQueries({ queryKey: ['org-data', orgId] });
  };

  const removeRep = (r: Rep, i: number) => {
    if (!r.id) return setReps((all) => all.filter((_, j) => j !== i));
    Alert.alert('Remover responsável?', r.full_name, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('org_legal_representatives').delete().eq('id', r.id!);
        if (error) setMsg({ tone: 'danger', text: toFriendlyError(error).message });
        qc.invalidateQueries({ queryKey: ['org-data', orgId] });
      } },
    ]);
  };

  const saveMine = async () => {
    setMsg(null);
    if (mine.cpf && !validCpf(mine.cpf)) return setMsg({ tone: 'danger', text: 'Confira seu CPF.' });
    if (mine.phone && !validPhone(mine.phone)) return setMsg({ tone: 'danger', text: 'Confira seu telefone com DDD.' });
    const p = await supabase.from('profile_private').upsert({ profile_id: uid!, cpf: digits(mine.cpf) || null, phone: digits(mine.phone) || null });
    const t = q.data.membership ? await supabase.from('memberships').update({ title: mine.title.trim() || null }).eq('id', q.data.membership.id) : { error: null };
    const err = p.error ?? t.error;
    if (err) return setMsg({ tone: 'danger', text: toFriendlyError(err).message });
    toast('Seus dados foram salvos.');
    qc.invalidateQueries({ queryKey: ['org-data', orgId] });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Dados da entidade' }} />
      <View style={styles.wrap}>
        {status === 'pending' && <Badge label="Cadastro em análise pela equipe TechPoint" tone="warning" />}
        {status === 'approved' && <Badge label="Cadastro verificado" tone="success" />}
      </View>
      {msg && <Notice tone={msg.tone} text={msg.text} />}

      <Card>
        <T variant="subtitle">Endereço do clube na internet</T>
        <T variant="small">É a porta de entrada com a marca do clube. Mande para atletas e famílias. Se o clube tiver domínio próprio (ex.: dfvolei.com.br), peça para redirecioná-lo para este endereço.</T>
        <Field label="Endereço" autoCapitalize="none" value={slug ?? q.data.org.slug ?? ""} maxLength={40}
          onChangeText={(v) => setSlug(v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]/g, ''))}
          hint={`${SITE_URL}/${slug ?? q.data.org.slug}`} />
        <View style={styles.row}>
          <Button title="Copiar endereço" kind="outline" style={{ flex: 1 }} onPress={() => shareText(`${SITE_URL}/${slug ?? q.data!.org.slug}`)} />
          {slug != null && slug !== q.data.org.slug && <Button title="Salvar endereço" style={{ flex: 1 }} onPress={async () => {
            const { error } = await supabase.from('organizations').update({ slug }).eq('id', orgId!);
            setMsg(error ? { tone: 'danger', text: error.code === '23505' ? 'Esse endereço já está em uso. Tente outro.' : 'Endereço inválido: use letras minúsculas, números e hífen (3 a 40).' } : null); if (!error) toast('Endereço salvo.');
            if (!error) { setSlug(null); q.refetch(); }
          }} />}
        </View>
      </Card>

      <BrandingCard value={brand} onChange={setBrand} orgName={q.data.org.name ?? undefined} />
      <Button title="Salvar logo e cores" loading={busy} onPress={saveBrand} />

      <OrgForm value={org} onChange={setOrg} cnpjLocked={Boolean(q.data.org.cnpj)} />
      <Button title="Salvar dados da entidade" loading={busy} onPress={saveOrg} />

      <T variant="subtitle">Responsáveis legais pelo CNPJ</T>
      {reps.map((r, i) => (
        <View key={r.id ?? `novo-${i}`} style={{ gap: 8 }}>
          <RepCard value={r} onChange={(v) => setReps((all) => all.map((x, j) => (j === i ? v : x)))} onRemove={() => removeRep(r, i)} />
          <Button title={r.id ? 'Salvar alterações' : 'Salvar responsável'} kind="outline" onPress={() => saveRep(r, i)} />
        </View>
      ))}
      <Button title="Adicionar responsável" kind="ghost" onPress={() => setReps((r) => [...r, emptyRep])} />

      {me.isAdmin && (
        <Card>
          <T variant="subtitle">Meus dados de administrador</T>
          <Field label="CPF" keyboardType="number-pad" value={mine.cpf} onChangeText={(v) => setMine({ ...mine, cpf: maskCpf(v) })} />
          <Field label="Telefone (WhatsApp)" keyboardType="phone-pad" value={mine.phone} onChangeText={(v) => setMine({ ...mine, phone: maskPhone(v) })} />
          <Field label="Cargo na entidade" value={mine.title} onChangeText={(v) => setMine({ ...mine, title: v })} maxLength={80} />
          <Button title="Salvar meus dados" kind="outline" onPress={saveMine} />
        </Card>
      )}
    </Screen>
  );
}
