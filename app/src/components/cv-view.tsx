// Currículo esportivo: cabeçalho, números, equipes, linha do tempo (com edição), selo da entidade,
// PDF e link de compartilhamento.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Badge, Button, Card, Chip, Field, Loading, Notice, T, styles } from '@/components/ui';
import {
  CV_KINDS, CvEntry, CvKind, cvKindIcon, cvKindLabel, handLabel, maskMonthYear, monthLabel, parseMonthYear,
  sportTime, toMonthYear, useAthleteCv,
} from '@/lib/cv';
import { exportCvPdf } from '@/lib/cv-export';
import { toFriendlyError } from '@/lib/errors';
import { SITE_URL, openWhatsApp, shareText } from '@/lib/links';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type Props = { athleteId: string; orgId: string; isStaff: boolean; canShare: boolean };
type Form = { id?: string; kind: CvKind; title: string; institution: string; category: string; location: string; start: string; end: string; description: string };
const empty: Form = { kind: 'competicao', title: '', institution: '', category: '', location: '', start: '', end: '', description: '' };

export function CvView({ athleteId, orgId, isStaff, canShare }: Props) {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const cv = useAthleteCv(athleteId);
  const [form, setForm] = useState<Form | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const shares = useQuery({
    queryKey: ['cv-shares', athleteId],
    enabled: canShare,
    queryFn: async () => {
      const { data, error } = await supabase.from('athlete_cv_shares').select('id, token, expires_at, revoked_at').eq('athlete_id', athleteId)
        .is('revoked_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
      if (error) throw error;
      return data as { id: string; token: string; expires_at: string }[];
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['cv', athleteId] }); qc.invalidateQueries({ queryKey: ['cv-shares', athleteId] }); };
  const fail = (e: unknown) => setMsg({ tone: 'danger', text: toFriendlyError(e).message });

  if (cv.isLoading) return <Loading />;
  if (cv.error || !cv.data) return <Notice tone="danger" text="Não foi possível carregar o currículo." />;
  const c = cv.data;

  const edit = (e: CvEntry) => setForm({
    id: e.id, kind: e.kind, title: e.title, institution: e.institution ?? '', category: e.category ?? '', location: e.location ?? '',
    start: toMonthYear(e.started_on), end: toMonthYear(e.ended_on), description: e.description ?? '',
  });

  const save = async () => {
    if (!form) return;
    setMsg(null);
    if (form.title.trim().length < 2) return setMsg({ tone: 'danger', text: 'Dê um nome ao item (ex.: Campeão Sub 17).' });
    const start = parseMonthYear(form.start);
    if (!start) return setMsg({ tone: 'danger', text: 'Informe o início no formato mês/ano (ex.: 03/2024).' });
    const end = form.end.trim() ? parseMonthYear(form.end) : null;
    if (form.end.trim() && !end) return setMsg({ tone: 'danger', text: 'Confira o fim no formato mês/ano.' });
    if (end && end < start) return setMsg({ tone: 'danger', text: 'O fim precisa ser depois do início.' });
    const row = {
      athlete_id: athleteId, org_id: orgId, kind: form.kind, title: form.title.trim(), institution: form.institution.trim() || null,
      category: form.category.trim() || null, location: form.location.trim() || null, started_on: start, ended_on: end,
      description: form.description.trim() || null,
    };
    setBusy(true);
    const { error } = form.id ? await supabase.from('athlete_cv_entries').update(row).eq('id', form.id) : await supabase.from('athlete_cv_entries').insert(row);
    setBusy(false);
    if (error) return fail(error);
    setForm(null); refresh();
  };

  const remove = (e: CvEntry) => {
    const run = async () => { const { error } = await supabase.from('athlete_cv_entries').delete().eq('id', e.id); if (error) fail(error); refresh(); };
    if (Platform.OS === 'web') { if (window.confirm('Apagar este item do currículo?')) run(); return; }
    Alert.alert('Apagar item?', e.title, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: run }]);
  };

  const verify = async (e: CvEntry, v: boolean) => {
    const { error } = await supabase.rpc('verify_cv_entry', { p_entry_id: e.id, p_verified: v });
    if (error) return fail(error);
    refresh();
  };

  const pdf = async () => { try { await exportCvPdf(c); } catch (e) { fail(e); } };

  const newShare = async () => {
    const { data, error } = await supabase.from('athlete_cv_shares').insert({ athlete_id: athleteId }).select('token').single();
    if (error) return fail(error);
    refresh();
    const url = `${SITE_URL}/cv/${data.token}`;
    openWhatsApp(`Currículo esportivo de ${c.full_name}: ${url}`);
  };
  const revoke = async (id: string) => {
    const { error } = await supabase.from('athlete_cv_shares').update({ revoked_at: new Date().toISOString() }).eq('id', id);
    if (error) return fail(error);
    refresh();
  };

  const period = (e: CvEntry) => `${monthLabel(e.started_on)}${e.ended_on ? ` – ${monthLabel(e.ended_on)}` : e.kind === 'clube' ? ' – atual' : ''}`;
  const body = c.body && (c.body.height_cm || c.body.weight_kg || c.body.dominant_hand)
    ? [c.body.height_cm ? `${c.body.height_cm} cm` : '', c.body.weight_kg ? `${String(c.body.weight_kg).replace('.', ',')} kg` : '', handLabel(c.body.dominant_hand)].filter(Boolean).join(' · ') : '';

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ backgroundColor: colors.primary }}>
        <T variant="title" color={colors.onPrimary}>{c.full_name}</T>
        <T variant="body" color={colors.onPrimary}>{[c.modality, c.position, `${c.age} anos`, c.org].filter(Boolean).join(' · ')}</T>
        {body ? <T variant="small" color={colors.onPrimary}>{body}{c.body?.show_in_cv ? '' : ' (só você e os responsáveis veem)'}</T> : null}
      </Card>
      <View style={styles.wrap}>
        {c.sport_started_on && <Card style={{ flexGrow: 1, flexBasis: 150 }}><T variant="subtitle">{sportTime(c.sport_started_on)}</T><T variant="small">no esporte, desde {monthLabel(c.sport_started_on)}</T></Card>}
        <Card style={{ flexGrow: 1, flexBasis: 150 }}>
          <T variant="subtitle">{c.attendance_12m.pct != null ? `${String(c.attendance_12m.pct).replace('.', ',')}%` : '—'}</T>
          <T variant="small">assiduidade nos treinos (12 meses)</T>
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: 150 }}><T variant="subtitle">{c.trainings_total ?? 0}</T><T variant="small">treinos registrados{c.first_training ? ` desde ${monthLabel(c.first_training)}` : ''}</T></Card>
        <Card style={{ flexGrow: 1, flexBasis: 150 }}><T variant="subtitle">{c.entries.filter((e) => e.verified).length}</T><T variant="small">confirmados pela entidade</T></Card>
      </View>
      {!c.sport_started_on && <Notice tone="info" text="Informe o início no esporte (mês e ano) em Meus dados → Esporte." />}

      {msg && <Notice tone={msg.tone} text={msg.text} />}
      <Button title="Baixar currículo em PDF" kind="accent" onPress={pdf} />

      {c.teams.length > 0 && (
        <Card>
          <T variant="subtitle">Equipes</T>
          {c.teams.map((t, i) => <T key={i} variant="body">• {t.name}{t.category ? ` (${t.category})` : ''} · desde {monthLabel(t.since)}</T>)}
        </Card>
      )}

      <Card>
        <T variant="subtitle">Trajetória</T>
        {c.entries.length === 0 && <T variant="muted">Comece pelos clubes por onde passou, as competições e os títulos.</T>}
        {c.entries.map((e) => (
          <View key={e.id} style={{ gap: 4, paddingVertical: 8, borderLeftWidth: 3, borderLeftColor: colors.border, paddingLeft: 10 }}>
            <T variant="small" color={colors.primary}>{period(e)} · {cvKindIcon(e.kind)} {cvKindLabel(e.kind)}</T>
            <T variant="body" style={{ fontWeight: '700' }}>{e.title}</T>
            {(e.institution || e.category || e.location) && <T variant="small">{[e.institution, e.category, e.location].filter(Boolean).join(' · ')}</T>}
            {e.description && <T variant="small">{e.description}</T>}
            {e.verified && <Badge label={`✓ Confirmado por ${e.verified_by_org ?? 'entidade'}`} tone="success" />}
            <View style={styles.row}>
              <Button title="Editar" kind="ghost" style={{ flex: 1 }} onPress={() => edit(e)} />
              <Button title="Apagar" kind="ghost" style={{ flex: 1 }} onPress={() => remove(e)} />
              {isStaff && <Button title={e.verified ? 'Tirar selo' : 'Confirmar'} kind="outline" style={{ flex: 1 }} onPress={() => verify(e, !e.verified)} />}
            </View>
          </View>
        ))}
        {form ? (
          <View style={{ gap: 8 }}>
            <View style={styles.wrap}>{CV_KINDS.map((k) => <Chip key={k.key} label={`${k.icon} ${k.label}`} selected={form.kind === k.key} onPress={() => setForm({ ...form, kind: k.key })} />)}</View>
            <Field label="O quê" value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} maxLength={120} placeholder="Ex.: Campeão Brasiliense Sub 17" />
            <Field label="Clube, federação ou organizador" value={form.institution} onChangeText={(v) => setForm({ ...form, institution: v })} maxLength={120} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}><Field label="Categoria" value={form.category} onChangeText={(v) => setForm({ ...form, category: v })} maxLength={60} placeholder="Sub 17" /></View>
              <View style={{ flex: 1 }}><Field label="Cidade/local" value={form.location} onChangeText={(v) => setForm({ ...form, location: v })} maxLength={120} /></View>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}><Field label="Início (mês/ano)" keyboardType="number-pad" value={form.start} onChangeText={(v) => setForm({ ...form, start: maskMonthYear(v) })} placeholder="03/2024" /></View>
              <View style={{ flex: 1 }}><Field label="Fim (opcional)" keyboardType="number-pad" value={form.end} onChangeText={(v) => setForm({ ...form, end: maskMonthYear(v) })} placeholder="11/2024" /></View>
            </View>
            <Field label="Detalhes (opcional)" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} maxLength={600} multiline />
            {form.id && <T variant="small">Ao salvar uma edição, o selo da entidade sai até ser confirmado de novo.</T>}
            <Button title={busy ? 'Salvando...' : 'Salvar'} kind="accent" disabled={busy} onPress={save} />
            <Button title="Cancelar" kind="ghost" onPress={() => setForm(null)} />
          </View>
        ) : (
          <Button title="Adicionar à trajetória" kind="outline" onPress={() => { setMsg(null); setForm({ ...empty }); }} />
        )}
      </Card>

      {canShare && (
        <Card>
          <T variant="subtitle">Compartilhar com olheiro, escola ou clube</T>
          <T variant="small">Gera um link que mostra só o currículo (sem CPF, endereço, documentos ou data de nascimento). Vale 90 dias e pode ser cancelado.</T>
          <Button title="Gerar link e enviar pelo WhatsApp" kind="outline" onPress={newShare} />
          {(shares.data ?? []).map((s) => (
            <View key={s.id} style={[styles.row, { justifyContent: 'space-between' }]}>
              <T variant="small" style={{ flex: 1 }}>Link ativo até {new Date(s.expires_at).toLocaleDateString('pt-BR')}</T>
              <Button title="Copiar" kind="ghost" onPress={() => shareText(`${SITE_URL}/cv/${s.token}`)} />
              <Button title="Cancelar" kind="ghost" onPress={() => revoke(s.id)} />
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}
