// Ficha do atleta: autorização (LGPD), responsáveis (link pelo WhatsApp) e consentimento em papel.
// Usada pela equipe e pelo próprio atleta (para cadastrar o responsável).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Badge, Button, Card, Chip, Field, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { digits, maskPhone, validEmail, validPhone } from '@/lib/br';
import { toFriendlyError } from '@/lib/errors';
import { ageOn } from '@/lib/format';
import { guardianUrl, openWhatsApp } from '@/lib/links';
import { useMe } from '@/lib/me';
import { brDateTime } from '@/lib/report';
import { supabase } from '@/lib/supabase';

type Guardian = { id: string; name: string | null; phone: string | null; email: string | null; relationship: string | null; status: string; token: string; profile_id: string | null };
type Consent = { id: string; source: string; granted_at: string; revoked_at: string | null; note: string | null };
const relations = ['Mãe', 'Pai', 'Responsável legal', 'Outro'];

export default function FichaAtleta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['athlete', id],
    queryFn: async () => {
      const [a, g, c] = await Promise.all([
        supabase.from('athletes').select('id, org_id, full_name, birth_date, status, profile_id, email').eq('id', id!).single(),
        supabase.from('athlete_guardians').select('id, name, phone, email, relationship, status, token, profile_id').eq('athlete_id', id!).neq('status', 'revoked').order('created_at'),
        supabase.from('guardian_consents').select('id, source, granted_at, revoked_at, note').eq('athlete_id', id!).order('granted_at', { ascending: false }),
      ]);
      if (a.error) throw a.error;
      return { a: a.data as { id: string; org_id: string; full_name: string; birth_date: string; status: string; profile_id: string | null; email: string | null }, g: (g.data ?? []) as Guardian[], c: (c.data ?? []) as Consent[] };
    },
  });
  const [form, setForm] = useState<{ name: string; phone: string; email: string; relationship: string } | null>(null);
  const [paper, setPaper] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  if (q.isLoading) return <Loading />;
  if (!q.data) return <Screen><Notice tone="danger" text="Atleta não encontrado." /></Screen>;
  const { a, g, c } = q.data;
  const age = ageOn(new Date(a.birth_date + 'T12:00:00'));
  const minor = age < 18;
  const active = c.find((x) => !x.revoked_at);
  const isSelf = a.profile_id === me.profile?.id;
  const first = a.full_name.split(' ')[0];
  const refresh = () => qc.invalidateQueries({ queryKey: ['athlete', id] });

  const sendLink = (gd: Guardian) =>
    openWhatsApp(`Olá${gd.name ? `, ${gd.name.split(' ')[0]}` : ''}! Para acompanhar ${first} no TechPoint (${me.org?.name}) e autorizar o uso dos dados, abra: ${guardianUrl(gd.token)}`, gd.phone);

  const addGuardian = async () => {
    if (!form) return;
    setMsg(null);
    if (form.name.trim().length < 3) return setMsg({ tone: 'danger', text: 'Informe o nome do responsável.' });
    if (!validPhone(form.phone) && !validEmail(form.email)) return setMsg({ tone: 'danger', text: 'Informe o WhatsApp ou o e-mail do responsável.' });
    const { data, error } = await supabase.from('athlete_guardians').insert({
      org_id: a.org_id, athlete_id: a.id, name: form.name.trim(), phone: digits(form.phone) || null,
      email: form.email.trim().toLowerCase() || null, relationship: form.relationship,
    }).select('id, name, phone, email, relationship, status, token, profile_id').single();
    if (error) return setMsg({ tone: 'danger', text: toFriendlyError(error).message });
    setForm(null);
    refresh();
    sendLink(data as Guardian);
  };

  const removeGuardian = (gd: Guardian) =>
    Alert.alert('Remover responsável?', gd.name ?? '', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('athlete_guardians').update({ status: 'revoked' }).eq('id', gd.id);
        if (error) setMsg({ tone: 'danger', text: toFriendlyError(error).message });
        refresh();
      } },
    ]);

  const recordPaper = async () => {
    setMsg(null);
    const { error } = await supabase.rpc('record_paper_consent', { p_athlete_id: a.id, p_terms_version: 'papel', p_note: paper.trim() });
    if (error) return setMsg({ tone: 'danger', text: toFriendlyError(error).message });
    setPaper('');
    setMsg({ tone: 'success', text: 'Consentimento em papel registrado.' });
    refresh();
    qc.invalidateQueries({ queryKey: ['athletes'] });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: isSelf ? 'Meus responsáveis' : 'Atleta' }} />
      <T variant="title">{a.full_name}</T>
      <T variant="muted">{age} anos{a.email ? ` · ${a.email}` : ''}</T>
      {msg && <Notice tone={msg.tone} text={msg.text} />}

      <Card>
        <T variant="subtitle">Autorização (LGPD)</T>
        {!minor ? <Badge label="Maior de idade: não precisa de autorização" tone="success" />
          : active ? (
            <>
              <Badge label="Autorizado" tone="success" />
              <T variant="small">Desde {brDateTime(active.granted_at)} {active.source === 'paper' ? `(papel: ${active.note})` : '(pelo responsável, no app)'}</T>
            </>
          ) : (
            <>
              <Badge label="Aguardando autorização do responsável" tone="warning" />
              <T variant="small">Enquanto isso, {first} não consegue fazer check-in e não aparece nos relatórios.</T>
            </>
          )}
      </Card>

      {minor && (
        <Card>
          <T variant="subtitle">Responsáveis</T>
          {g.length === 0 && <T variant="muted">Nenhum responsável cadastrado.</T>}
          {g.map((gd) => (
            <View key={gd.id} style={{ gap: 6, paddingVertical: 4 }}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <T variant="body" style={{ flex: 1, fontWeight: '700' }}>{gd.name}{gd.relationship ? ` (${gd.relationship})` : ''}</T>
                <Badge label={gd.status === 'active' ? 'Ligado' : 'Convite enviado'} tone={gd.status === 'active' ? 'success' : 'warning'} />
              </View>
              <T variant="small">{[gd.phone && maskPhone(gd.phone), gd.email].filter(Boolean).join(' · ')}</T>
              {gd.status === 'invited' && <Button title="Reenviar link pelo WhatsApp" kind="outline" onPress={() => sendLink(gd)} />}
              {me.isStaff && <Button title="Remover" kind="ghost" onPress={() => removeGuardian(gd)} />}
            </View>
          ))}
          {form ? (
            <View style={{ gap: 8 }}>
              <Field label="Nome do responsável" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} maxLength={120} />
              <View style={styles.wrap}>{relations.map((r) => <Chip key={r} label={r} selected={form.relationship === r} onPress={() => setForm({ ...form, relationship: r })} />)}</View>
              <Field label="WhatsApp" keyboardType="phone-pad" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: maskPhone(v) })} />
              <Field label="E-mail (opcional)" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} />
              <Button title="Salvar e enviar link pelo WhatsApp" kind="accent" onPress={addGuardian} />
              <Button title="Cancelar" kind="ghost" onPress={() => setForm(null)} />
            </View>
          ) : (
            <Button title="Adicionar responsável" kind="outline" onPress={() => setForm({ name: '', phone: '', email: '', relationship: 'Mãe' })} />
          )}
        </Card>
      )}

      {minor && !active && me.isManager && (
        <Card>
          <T variant="subtitle">Termo assinado em papel</T>
          <T variant="small">Se o responsável assinou o termo na secretaria, registre aqui. Guarde o papel: ele é a prova.</T>
          <Field label="Onde está o termo / observação" value={paper} onChangeText={setPaper} placeholder="Ex.: termo assinado pela mãe em 14/11, pasta 2026" maxLength={500} />
          <Button title="Registrar consentimento em papel" kind="outline" disabled={paper.trim().length < 5} onPress={recordPaper} />
        </Card>
      )}
      {isSelf && <Button title="Voltar" kind="ghost" onPress={() => router.back()} />}
    </Screen>
  );
}
