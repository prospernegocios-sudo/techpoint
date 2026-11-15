// Ficha do atleta: autorização (LGPD), responsáveis (link pelo WhatsApp), consentimento em papel e documentos.
// Usada pela equipe e pelo próprio atleta (para cadastrar o responsável).
import { toast } from '@/components/toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DocumentsCard } from '@/components/documents-card';
import { MAX_DOC_BYTES, pickIdDocument, uploadAthleteDocument, useAthleteDocuments, type PickedFile } from '@/lib/documents';
import { useTheme } from '@/lib/theme';
import { AthleteDataForm } from '@/components/personal-data';
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
  const { colors } = useTheme();
  const q = useQuery({
    queryKey: ['athlete', id],
    queryFn: async () => {
      const [a, g, c] = await Promise.all([
        supabase.from('athletes').select('id, org_id, full_name, birth_date, status, profile_id, email, is_demo, sex').eq('id', id!).single(),
        supabase.from('athlete_guardians').select('id, name, phone, email, relationship, status, token, profile_id').eq('athlete_id', id!).neq('status', 'revoked').order('created_at'),
        supabase.from('guardian_consents').select('id, source, granted_at, revoked_at, note').eq('athlete_id', id!).order('granted_at', { ascending: false }),
      ]);
      if (a.error) throw a.error;
      return { a: a.data as { id: string; org_id: string; full_name: string; birth_date: string; status: string; profile_id: string | null; email: string | null; is_demo: boolean; sex: 'M' | 'F' | null }, g: (g.data ?? []) as Guardian[], c: (c.data ?? []) as Consent[] };
    },
  });
  const [form, setForm] = useState<{ name: string; phone: string; email: string; relationship: string } | null>(null);
  const [paper, setPaper] = useState('');
  const [idDoc, setIdDoc] = useState<PickedFile | null>(null);
  const docs = useAthleteDocuments(id);
  const [tab, setTab] = useState<'resumo' | 'dados' | 'docs' | 'resp'>('resumo');
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
    openWhatsApp(`Olá${gd.name ? `, ${gd.name.split(' ')[0]}` : ''}! Para acompanhar ${first} no app do ${me.org?.name} e autorizar o uso dos dados, abra: ${guardianUrl(gd.token)}`, gd.phone);

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
    if (idDoc && me.profile) {
      try {
        await uploadAthleteDocument({ orgId: a.org_id, athleteId: a.id, uploaderId: me.profile.id, kind: 'doc_responsavel', title: `Documento de ${form.name.trim()}`, picked: idDoc, guardianId: (data as Guardian).id });
      } catch (e) { toast(`Responsável salvo, mas o documento não subiu: ${toFriendlyError(e).message}`, 'danger'); }
    }
    setForm(null); setIdDoc(null);
    toast('Responsável salvo.');
    refresh(); qc.invalidateQueries({ queryKey: ['athlete-docs', id] });
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
    toast('Consentimento em papel registrado.');
    refresh();
    qc.invalidateQueries({ queryKey: ['athletes'] });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: isSelf ? 'Meus dados' : 'Atleta' }} />
      <T variant="title">{a.full_name}</T>
      <T variant="muted">{age} anos{a.sex ? ` · ${a.sex === 'M' ? 'Masculino' : 'Feminino'}` : ''}{a.email ? ` · ${a.email}` : ''}</T>
      {me.isStaff && !isSelf && (
        <View style={[styles.row, { gap: 8 }]}>
          <T variant="small">Sexo:</T>
          {(['M', 'F'] as const).map((x) => (
            <Chip key={x} label={x === 'M' ? 'Masculino' : 'Feminino'} selected={a.sex === x} onPress={async () => {
              const { error } = await supabase.from('athletes').update({ sex: a.sex === x ? null : x }).eq('id', a.id);
              if (error) return setMsg({ tone: 'danger', text: toFriendlyError(error).message });
              toast('Cadastro atualizado.'); refresh();
            }} />
          ))}
        </View>
      )}
      {a.is_demo && <Badge label="Dado fictício (teste)" />}
      {msg && <Notice tone={msg.tone} text={msg.text} />}
      <View style={styles.wrap}>
        {([['resumo', 'Resumo'], ['dados', 'Dados'], ['docs', 'Documentos'], ['resp', 'Responsáveis']] as const)
          .filter(([k]) => !(isSelf && k === 'dados'))
          .map(([k, l]) => <Chip key={k} label={l} selected={tab === k} onPress={() => setTab(k)} />)}
      </View>

      {tab === 'resumo' && <Card>
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
      </Card>}
      {tab === 'resumo' && <Button title="Currículo esportivo" kind="accent" onPress={() => router.push({ pathname: '/curriculo/[athleteId]', params: { athleteId: a.id } })} />}
      {tab === 'resp' && !minor && <Notice tone="info" text="Atleta maior de idade: responsável não é obrigatório." />}

      {tab === 'resp' && minor && (
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
              {(() => {
                const has = (docs.data ?? []).some((d) => d.kind === 'doc_responsavel' && d.guardian_id === gd.id && !d.superseded_at);
                return (
                  <Pressable accessibilityRole="button" onPress={async () => {
                    const f = await pickIdDocument();
                    if (!f || !me.profile) return;
                    if (!f.mime || f.size > MAX_DOC_BYTES) return toast('Envie PDF, PNG ou JPG de até 10 MB.', 'danger');
                    try {
                      await uploadAthleteDocument({ orgId: a.org_id, athleteId: a.id, uploaderId: me.profile.id, kind: 'doc_responsavel', title: `Documento de ${gd.name ?? 'responsável'}`, picked: f, guardianId: gd.id });
                      toast('Documento do responsável salvo.'); qc.invalidateQueries({ queryKey: ['athlete-docs', id] });
                    } catch (e) { toast(toFriendlyError(e).message, 'danger'); }
                  }} style={[styles.row, { alignItems: 'center' }]}>
                    <Ionicons name={has ? 'checkmark-circle' : 'id-card-outline'} size={18} color={has ? colors.success : colors.primary} />
                    <T variant="small" color={colors.primary}>{has ? 'Documento enviado · trocar' : 'Enviar RG, CNH ou passaporte'}</T>
                  </Pressable>
                );
              })()}
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
              <T variant="small" style={{ fontWeight: '600' }}>Documento de identificação do responsável (opcional)</T>
              <Pressable accessibilityRole="button" onPress={async () => { const f = await pickIdDocument(); if (!f) return; if (!f.mime || f.size > MAX_DOC_BYTES) return toast('Envie PDF, PNG ou JPG de até 10 MB.', 'danger'); setIdDoc(f); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.outline }}>
                <Ionicons name={idDoc ? 'checkmark-circle' : 'id-card-outline'} size={22} color={idDoc ? colors.success : colors.primary} />
                <T variant="small" style={{ flex: 1 }}>{idDoc ? idDoc.name : 'RG, CNH ou passaporte (PDF ou foto)'}</T>
              </Pressable>
              <Button title="Salvar e enviar link pelo WhatsApp" kind="accent" onPress={addGuardian} />
              <Button title="Cancelar" kind="ghost" onPress={() => { setForm(null); setIdDoc(null); }} />
            </View>
          ) : (
            <Button title="Adicionar responsável" kind="outline" onPress={() => setForm({ name: '', phone: '', email: '', relationship: 'Mãe' })} />
          )}
        </Card>
      )}

      {tab === 'resp' && minor && !active && me.isManager && (
        <Card>
          <T variant="subtitle">Termo assinado em papel</T>
          <T variant="small">Se o responsável assinou o termo na secretaria, registre aqui. Guarde o papel: ele é a prova.</T>
          <Field label="Onde está o termo / observação" value={paper} onChangeText={setPaper} placeholder="Ex.: termo assinado pela mãe em 14/11, pasta 2026" maxLength={500} />
          <Button title="Registrar consentimento em papel" kind="outline" disabled={paper.trim().length < 5} onPress={recordPaper} />
        </Card>
      )}
      {tab === 'dados' && !isSelf && <AthleteDataForm athleteId={a.id} orgId={a.org_id} birthDate={a.birth_date} canSeeBody={!me.isStaff} />}
      {tab === 'docs' && me.profile && <DocumentsCard orgId={a.org_id} athleteId={a.id} meId={me.profile.id} isStaff={me.isStaff} />}
      {isSelf && <Button title="Voltar" kind="ghost" onPress={() => router.back()} />}
    </Screen>
  );
}
