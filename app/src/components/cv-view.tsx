// Currículo esportivo (D84/D87): visual enxuto e minimalista.
// Cabeçalho com foto, nome e números; 3 ações do mesmo tamanho; seções em lista simples com
// "Editar"/"Adicionar" sempre no mesmo canto. É do atleta: só ele e os responsáveis editam; a equipe confirma itens.
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Image, Platform, Pressable, Switch, Text, View } from 'react-native';
import { CityField } from '@/components/city-field';
import { DateField } from '@/components/date-field';
import { RichField, RichText, type Align } from '@/components/rich-text';
import { toast } from '@/components/toast';
import { Button, Card, Chip, Field, Loading, Notice, T, styles } from '@/components/ui';
import {
  CV_KINDS, cvImageUrls, cvKindLabel, handLabel, maskMonthYear, monthLabel, parseMonthYear, sportTime, toMonthYear,
  useAthleteCv, type CvEntry, type CvKind, type CvReference,
} from '@/lib/cv';
import { exportCvPdf } from '@/lib/cv-export';
import { pickAndUploadCvImage, removeCvImage } from '@/lib/cv-media';
import { toFriendlyError } from '@/lib/errors';
import { SITE_URL, openWhatsApp, shareText } from '@/lib/links';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type Props = { athleteId: string; orgId: string; isStaff: boolean; canShare: boolean };
type Form = { id?: string; kind: CvKind; title: string; institution: string; category: string; location: string; start: string; end: string; description: string; result: string };
const empty: Form = { kind: 'competicao', title: '', institution: '', category: '', location: '', start: '', end: '', description: '', result: '' };
type Panel = null | 'perfil' | 'contatos' | 'item' | 'compartilhar';
type GoalRow = { text: string; date: string };

/** Campos do formulário conforme o tipo de item (D93). */
const KIND_FORM: Record<CvKind, { help: string; name: string; namePh: string; period: boolean; category: boolean; result: string | null; inst: string | null; instPh?: string; city: boolean }> = {
  clube: { help: 'Clube, equipe ou escolinha onde treinou ou treina.', name: 'Clube ou equipe', namePh: 'Ex.: NCT Vôlei de Praia', period: true, category: true, result: null, inst: null, city: true },
  competicao: { help: 'Campeonato, circuito, torneio ou copa que disputou.', name: 'Competição', namePh: 'Ex.: Circuito Brasiliense de Vôlei de Praia', period: false, category: true, result: 'Conquista', inst: 'Organizador', instPh: 'Ex.: Federação de Vôlei do DF', city: true },
  titulo: { help: 'Título conquistado pela equipe ou dupla.', name: 'Título', namePh: 'Ex.: Campeão Brasiliense', period: false, category: true, result: null, inst: 'Competição ou organizador', instPh: 'Ex.: Circuito Brasiliense', city: true },
  premio: { help: 'Reconhecimento individual: melhor jogador, destaque, revelação.', name: 'Prêmio', namePh: 'Ex.: Melhor levantador', period: false, category: false, result: null, inst: 'Em qual competição', instPh: 'Ex.: Taça Brasília', city: false },
  selecao: { help: 'Convocação para seleção estadual, regional ou nacional.', name: 'Seleção', namePh: 'Ex.: Seleção do Distrito Federal', period: true, category: true, result: 'Resultado', inst: 'Competição', instPh: 'Ex.: Campeonato Brasileiro de Seleções', city: true },
  curso: { help: 'Curso, camp, clínica ou intercâmbio esportivo.', name: 'Curso ou camp', namePh: 'Ex.: Intercâmbio de Atletas de Vôlei de Praia', period: true, category: false, result: null, inst: 'Instituição', instPh: 'Ex.: CBV', city: true },
  outro: { help: 'Qualquer outra experiência esportiva relevante.', name: 'Nome', namePh: '', period: false, category: true, result: 'Resultado', inst: 'Organizador', city: true },
};
const todayBr = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
const isoToBr = (iso?: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const brToIso = (br: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim()); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };

/** Título de seção com uma ação de texto à direita (sempre no mesmo lugar). */
function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View style={[styles.row, { justifyContent: 'space-between', alignItems: 'center' }]}>
        <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted }}>{title}</Text>
        {action && onAction && (
          <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>{action}</Text>
          </Pressable>
        )}
      </View>
      <View style={{ backgroundColor: colors.surfaceContainer, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 6 }}>{children}</View>
    </View>
  );
}

function Line({ left, title, sub, badge, onPress, last }: { left?: string; title: string; sub?: string; badge?: string; onPress?: () => void; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined}
      style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      {left !== undefined && <Text style={{ width: 64, color: colors.textMuted, fontSize: 13, paddingTop: 2 }}>{left}</Text>}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{title}</Text>
        {sub ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>{sub}</Text> : null}
      </View>
      {badge ? <Ionicons name="checkmark-circle" size={18} color={colors.success} accessibilityLabel={badge} /> : null}
    </Pressable>
  );
}

const Empty = ({ text }: { text: string }) => { const { colors } = useTheme(); return <Text style={{ color: colors.textMuted, paddingVertical: 12 }}>{text}</Text>; };

export function CvView({ athleteId, orgId, isStaff, canShare }: Props) {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const cv = useAthleteCv(athleteId);
  const imgs = useQuery({ queryKey: ['cv-imgs', athleteId, cv.data?.profile?.photo_path, cv.data?.profile?.gallery?.join()], enabled: Boolean(cv.data), queryFn: () => cvImageUrls(cv.data!) });
  const shares = useQuery({
    queryKey: ['cv-shares', athleteId], enabled: canShare,
    queryFn: async () => {
      const { data, error } = await supabase.from('athlete_cv_shares').select('id, token, expires_at').eq('athlete_id', athleteId)
        .is('revoked_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
      if (error) throw error;
      return data as { id: string; token: string; expires_at: string }[];
    },
  });
  const [panel, setPanel] = useState<Panel>(null);
  const [form, setForm] = useState<Form>(empty);
  const [open, setOpen] = useState<string | null>(null);
  const [prof, setProf] = useState({ align: 'justify' as Align, headline: '', about: '', phone: '', email: '', instagram: '', city: '', show: false });
  const [refs, setRefs] = useState<CvReference[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [goalRows, setGoalRows] = useState<GoalRow[]>([]);
  const [goalsDone, setGoalsDone] = useState<string[] | null>(null); // marcação imediata, antes do servidor responder
  const p = cv.data?.profile;
  useEffect(() => {
    setProf({ align: (p?.about_align ?? 'justify') as Align, headline: p?.headline ?? '', about: p?.about ?? '', phone: p?.contact_phone ?? '', email: p?.contact_email ?? '',
      instagram: p?.instagram ?? '', city: p?.city ?? '', show: p?.show_contacts ?? false });
    setRefs(p?.references ?? []);
    setGoalRows((p?.goals ?? []).map((g) => ({ text: g, date: isoToBr(p?.goals_set_on?.[g]) })));
  }, [p]);

  if (cv.isLoading) return <Loading />;
  if (cv.error || !cv.data) return <Notice tone="danger" text="Não foi possível carregar o currículo." />;
  const c = cv.data;
  const refresh = () => { qc.invalidateQueries({ queryKey: ['cv', athleteId] }); qc.invalidateQueries({ queryKey: ['cv-shares', athleteId] }); };
  const fail = (e: unknown) => { setError(toFriendlyError(e).message); toast(toFriendlyError(e).message, 'danger'); };
  const close = () => { setPanel(null); setError(null); };
  const upsertProfile = async (patch: Record<string, unknown>) => {
    const { error: e } = await supabase.from('athlete_cv_profile').upsert({ athlete_id: athleteId, ...patch, updated_at: new Date().toISOString() });
    if (e) throw e;
  };

  // ---- ações
  const pdf = async () => { try { await exportCvPdf(c); } catch (e) { fail(e); } };
  const setPhoto = async () => {
    if (!canShare) return;
    try {
      const path = await pickAndUploadCvImage(athleteId, 'foto');
      if (!path) return;
      const old = p?.photo_path;
      await upsertProfile({ photo_path: path });
      if (old) await removeCvImage(old);
      toast('Foto salva.'); refresh();
    } catch (e) { fail(e); }
  };
  const addPhoto = async () => {
    if ((p?.gallery?.length ?? 0) >= 6) return toast('Até 6 fotos.', 'danger');
    try {
      const path = await pickAndUploadCvImage(athleteId, 'galeria');
      if (!path) return;
      await upsertProfile({ gallery: [...(p?.gallery ?? []), path] });
      toast('Foto adicionada.'); refresh();
    } catch (e) { fail(e); }
  };
  const removePhoto = async (i: number) => {
    const g = [...(p?.gallery ?? [])];
    const [gone] = g.splice(i, 1);
    try { await upsertProfile({ gallery: g }); if (gone) await removeCvImage(gone); toast('Foto removida.'); refresh(); } catch (e) { fail(e); }
  };
  const saveProfile = async (part: 'perfil' | 'contatos') => {
    setBusy(true);
    try {
      await upsertProfile(part === 'perfil'
        ? { headline: prof.headline.trim() || null, about: prof.about.trim() || null, about_align: prof.align,
            goals: goalRows.map((g) => g.text.trim()).filter(Boolean).slice(0, 10),
            goals_set_on: Object.fromEntries(goalRows.filter((g) => g.text.trim() && brToIso(g.date)).map((g) => [g.text.trim(), brToIso(g.date)])),
            goals_done: (p?.goals_done ?? []).filter((d) => goalRows.some((g) => g.text.trim() === d)) }
        : { contact_phone: prof.phone.trim() || null, contact_email: prof.email.trim() || null, instagram: prof.instagram.trim() || null,
            city: prof.city.trim() || null, show_contacts: prof.show,
            references: refs.filter((r) => r.name.trim()).slice(0, 4).map((r) => ({ name: r.name.trim(), role: r.role?.trim() || null, phone: r.phone?.trim() || null })) });
      toast('Currículo salvo.'); close(); refresh();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const toggleGoal = async (g: string) => {
    const doneList = goalsDone ?? p?.goals_done ?? [];
    const now = doneList.includes(g) ? doneList.filter((x) => x !== g) : [...doneList, g];
    setGoalsDone(now);
    try { await upsertProfile({ goals_done: now }); toast(now.includes(g) ? 'Meta conquistada!' : 'Meta desmarcada.'); refresh(); } catch (e) { setGoalsDone(null); fail(e); }
  };
  const editItem = (e?: CvEntry, kind: CvKind = 'competicao') => {
    setForm(e ? { id: e.id, kind: e.kind, title: e.title, institution: e.institution ?? '', category: e.category ?? '', location: e.location ?? '',
      start: toMonthYear(e.started_on), end: toMonthYear(e.ended_on), description: e.description ?? '', result: e.result ?? '' } : { ...empty, kind });
    setError(null); setPanel('item');
  };
  const saveItem = async () => {
    if (form.title.trim().length < 2) return setError('Dê um nome ao item.');
    const start = parseMonthYear(form.start);
    if (!start) return setError('Informe o início em mês/ano (ex.: 03/2024).');
    const end = form.end.trim() ? parseMonthYear(form.end) : null;
    if (form.end.trim() && !end) return setError('Confira o fim em mês/ano.');
    const row = { athlete_id: athleteId, org_id: orgId, kind: form.kind, title: form.title.trim(), institution: form.institution.trim() || null,
      category: form.category.trim() || null, location: form.location.trim() || null, started_on: start, ended_on: end,
      description: form.description.trim() || null, result: form.result.trim() || null };
    setBusy(true);
    const { error: e } = form.id ? await supabase.from('athlete_cv_entries').update(row).eq('id', form.id) : await supabase.from('athlete_cv_entries').insert(row);
    setBusy(false);
    if (e) return fail(e);
    toast(form.id ? 'Item atualizado.' : 'Item adicionado.'); close(); refresh();
  };
  const removeItem = (e: CvEntry) => {
    const run = async () => { const { error: er } = await supabase.from('athlete_cv_entries').delete().eq('id', e.id); if (er) return fail(er); toast('Item apagado.'); setOpen(null); refresh(); };
    if (Platform.OS === 'web') { if (window.confirm(`Apagar "${e.title}"?`)) run(); return; }
    Alert.alert('Apagar item?', e.title, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: run }]);
  };
  const verify = async (e: CvEntry) => {
    const { error: er } = await supabase.rpc('verify_cv_entry', { p_entry_id: e.id, p_verified: !e.verified });
    if (er) return fail(er);
    toast(e.verified ? 'Selo retirado.' : 'Item confirmado.'); refresh();
  };
  const newShare = async () => {
    const { data, error: e } = await supabase.from('athlete_cv_shares').insert({ athlete_id: athleteId }).select('token').single();
    if (e) return fail(e);
    toast('Link criado.'); refresh();
    openWhatsApp(`Currículo esportivo de ${c.full_name}: ${SITE_URL}/cv/${data.token}`);
  };
  const revoke = async (id: string) => {
    const { error: e } = await supabase.from('athlete_cv_shares').update({ revoked_at: new Date().toISOString() }).eq('id', id);
    if (e) return fail(e);
    toast('Link cancelado.'); refresh();
  };

  // ---- dados para a tela
  const clubs = c.entries.filter((e) => e.kind === 'clube');
  const comps = c.entries.filter((e) => !['clube', 'premio'].includes(e.kind));
  const awards = c.entries.filter((e) => e.kind === 'premio');
  const headline = p?.headline || [c.modality, c.position].filter(Boolean).join(' · ');
  const stats = [
    c.sport_started_on ? `${sportTime(c.sport_started_on)} no esporte` : null,
    `${c.trainings_total ?? 0} treinos com prova`,
    c.attendance_12m.events > 0 && c.attendance_12m.pct != null ? `${String(c.attendance_12m.pct).replace('.', ',')}% de assiduidade` : null,
  ].filter(Boolean).join('  ·  ');
  const body = c.body && (c.body.height_cm || c.body.weight_kg || c.body.dominant_hand)
    ? [c.body.height_cm ? `${c.body.height_cm} cm` : '', c.body.weight_kg ? `${String(c.body.weight_kg).replace('.', ',')} kg` : '', handLabel(c.body.dominant_hand)].filter(Boolean).join(' · ') : '';
  const period = (e: CvEntry) => `${monthLabel(e.started_on)}${e.ended_on ? ` – ${monthLabel(e.ended_on)}` : e.kind === 'clube' ? ' – atual' : ''}`;
  const sub = (e: CvEntry) => [e.category, e.result, e.institution, e.location].filter(Boolean).join(' · ');

  const entryLines = (list: CvEntry[], withDate = true) => list.map((e, i) => (
    <View key={e.id}>
      <Line left={withDate ? monthLabel(e.started_on) : undefined} title={e.title} sub={withDate ? sub(e) : `${period(e)}${sub(e) ? ` · ${sub(e)}` : ''}`}
        badge={e.verified ? `Confirmado por ${e.verified_by_org ?? 'entidade'}` : undefined}
        onPress={canShare || isStaff ? () => setOpen(open === e.id ? null : e.id) : undefined} last={i === list.length - 1 && open !== e.id} />
      {open === e.id && (
        <View style={[styles.row, { paddingBottom: 12, borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: colors.border }]}>
          {canShare && <Button title="Editar" kind="outline" style={{ flex: 1 }} onPress={() => editItem(e)} />}
          {canShare && <Button title="Apagar" kind="outline" style={{ flex: 1 }} onPress={() => removeItem(e)} />}
          {isStaff && <Button title={e.verified ? 'Tirar selo' : 'Confirmar'} kind="outline" style={{ flex: 1 }} onPress={() => verify(e)} />}
        </View>
      )}
    </View>
  ));

  return (
    <View style={{ gap: 18, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
      {/* Cabeçalho */}
      <Card>
        <View style={[styles.row, { alignItems: 'center', gap: 16 }]}>
          <Pressable accessibilityRole={canShare ? 'button' : undefined} accessibilityLabel={canShare ? 'Trocar foto' : undefined} onPress={canShare ? setPhoto : undefined}>
            {imgs.data?.photo
              ? <Image source={{ uri: imgs.data.photo }} style={{ width: 84, height: 84, borderRadius: 42 }} accessibilityLabel={`Foto de ${c.full_name}`} />
              : <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <Ionicons name={canShare ? 'camera-outline' : 'person-outline'} size={26} color={colors.onPrimaryContainer} />
                  {canShare && <Text style={{ color: colors.onPrimaryContainer, fontSize: 11, fontWeight: '600' }}>Adicionar foto</Text>}
                </View>}
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{c.full_name}</Text>
            {headline ? <Text style={{ fontSize: 15, color: colors.text }}>{headline}</Text> : null}
            <Text style={{ fontSize: 13, color: colors.textMuted }}>{[`${c.age} anos`, body, c.org ? `atualmente em ${c.org}` : ''].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>{stats}</Text>
      </Card>

      {!c.sport_started_on && canShare && (
        <Pressable onPress={() => router.push('/(tabs)/perfil')} accessibilityRole="link">
          <Text style={{ color: colors.primary, fontSize: 14 }}>Informe o início no esporte em Dados › Esporte</Text>
        </Pressable>
      )}

      {/* Sobre e metas */}
      {panel === 'perfil' ? (
        <Card>
          <T variant="subtitle">Sobre mim e metas</T>
          <Field label="Título" value={prof.headline} onChangeText={(v) => setProf({ ...prof, headline: v })} maxLength={80} placeholder="Jogador de vôlei de areia" />
          <RichField label="Sobre mim" value={prof.about} onChange={(v) => setProf({ ...prof, about: v })} align={prof.align} onAlign={(a) => setProf({ ...prof, align: a })} maxLength={1500} />
          <T variant="subtitle">Metas</T>
          {goalRows.map((g, i) => (
            <View key={i} style={{ gap: 6, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Field label={`Meta ${i + 1}`} value={g.text} onChangeText={(v) => setGoalRows(goalRows.map((x, j) => (j === i ? { ...x, text: v } : x)))} maxLength={120} placeholder="Ex.: Jogar um mundial Sub 19" />
              <DateField label="Definida em" mode="date" value={g.date} onChange={(v) => setGoalRows(goalRows.map((x, j) => (j === i ? { ...x, date: v } : x)))} />
              <Pressable accessibilityRole="button" onPress={() => setGoalRows(goalRows.filter((_, j) => j !== i))} style={{ alignSelf: 'flex-end' }}>
                <Text style={{ color: colors.danger, fontWeight: '700' }}>Remover meta</Text>
              </Pressable>
            </View>
          ))}
          {goalRows.length < 10 && (
            <Pressable accessibilityRole="button" onPress={() => setGoalRows([...goalRows, { text: '', date: todayBr() }])}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>+ Meta</Text>
            </Pressable>
          )}
          {error && <Notice tone="danger" text={error} />}
          <View style={styles.row}>
            <Button title="Salvar" kind="primary" style={{ flex: 1 }} loading={busy} onPress={() => saveProfile('perfil')} />
            <Button title="Cancelar" kind="outline" style={{ flex: 1 }} onPress={close} />
          </View>
        </Card>
      ) : (
        <Section title="Sobre mim" action={canShare ? 'Editar' : undefined} onAction={() => setPanel('perfil')}>
          {p?.about ? <View style={{ paddingVertical: 12 }}><RichText text={p.about} align={p.about_align ?? 'justify'} /></View> : <Empty text="Conte quem você é, sua rotina e seus objetivos." />}
          {(p?.goals?.length ?? 0) > 0 && (
            <View style={{ paddingBottom: 12, gap: 4 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>Metas</Text>
              {p!.goals.map((g, i) => {
                const done = (goalsDone ?? p!.goals_done ?? []).includes(g);
                return (
                  <Pressable key={i} disabled={!canShare} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={g}
                    onPress={() => toggleGoal(g)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
                    <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={done ? colors.success : colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 15, textDecorationLine: done ? 'line-through' : 'none', opacity: done ? 0.75 : 1 }}>{g}</Text>
                      {p!.goals_set_on?.[g] ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>definida em {isoToBr(p!.goals_set_on[g])}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Section>
      )}

      {/* Formulário de item */}
      {panel === 'item' && (
        <Card>
          <T variant="subtitle">{form.id ? 'Editar item' : 'Novo item'}</T>
          <View style={styles.wrap}>{CV_KINDS.map((k) => <Chip key={k.key} label={k.label} selected={form.kind === k.key} onPress={() => setForm({ ...form, kind: k.key })} />)}</View>
          {(() => {
            const k = KIND_FORM[form.kind];
            return (
              <View style={{ gap: 10 }}>
                <T variant="small">{k.help}</T>
                <Field label={k.name} value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} maxLength={120} placeholder={k.namePh} />
                <View style={styles.row}>
                  <View style={{ flex: 1 }}><Field label={k.period ? 'Entrada (mm/aaaa)' : 'Mês/ano'} keyboardType="number-pad" value={form.start} onChangeText={(v) => setForm({ ...form, start: maskMonthYear(v) })} placeholder="03/2025" /></View>
                  {k.period && <View style={{ flex: 1 }}><Field label="Saída (vazio = atual)" keyboardType="number-pad" value={form.end} onChangeText={(v) => setForm({ ...form, end: maskMonthYear(v) })} placeholder="12/2025" /></View>}
                </View>
                {(k.category || k.result) && (
                  <View style={styles.row}>
                    {k.category && <View style={{ flex: 1 }}><Field label="Categoria" value={form.category} onChangeText={(v) => setForm({ ...form, category: v })} maxLength={60} placeholder="Sub 17" /></View>}
                    {k.result && <View style={{ flex: 1 }}><Field label={k.result} value={form.result} onChangeText={(v) => setForm({ ...form, result: v })} maxLength={80} placeholder="Campeão, 3º lugar..." /></View>}
                  </View>
                )}
                {k.inst && <Field label={k.inst} value={form.institution} onChangeText={(v) => setForm({ ...form, institution: v })} maxLength={120} placeholder={k.instPh} />}
                {k.city && <CityField value={form.location} onChange={(v) => setForm({ ...form, location: v })} />}
              </View>
            );
          })()}
          {form.id && <T variant="small">Ao salvar, o selo da entidade sai até ser confirmado de novo.</T>}
          {error && <Notice tone="danger" text={error} />}
          <View style={styles.row}>
            <Button title="Salvar" kind="primary" style={{ flex: 1 }} loading={busy} onPress={saveItem} />
            <Button title="Cancelar" kind="outline" style={{ flex: 1 }} onPress={close} />
          </View>
        </Card>
      )}

      <Section title="Experiência" action={canShare ? 'Adicionar' : undefined} onAction={() => editItem(undefined, 'clube')}>
        {clubs.length ? entryLines(clubs, false) : <Empty text="Clubes e equipes por onde passou." />}
        {c.teams.length > 0 && clubs.length === 0 && c.teams.map((t, i) => <Line key={i} title={t.name} sub={`desde ${monthLabel(t.since)} · no TechPoint`} last={i === c.teams.length - 1} />)}
      </Section>

      <Section title="Competições" action={canShare ? 'Adicionar' : undefined} onAction={() => editItem(undefined, 'competicao')}>
        {comps.length ? entryLines(comps) : <Empty text="Campeonatos, torneios, seleções e cursos." />}
      </Section>

      {(awards.length > 0 || canShare) && (
        <Section title="Prêmios individuais" action={canShare ? 'Adicionar' : undefined} onAction={() => editItem(undefined, 'premio')}>
          {awards.length ? entryLines(awards) : <Empty text="Melhor jogador, atleta destaque..." />}
        </Section>
      )}

      {(canShare || (imgs.data?.gallery.length ?? 0) > 0) && (
        <Section title={`Fotos ${(imgs.data?.gallery.length ?? 0)}/6`} action={canShare && (imgs.data?.gallery.length ?? 0) < 6 ? 'Adicionar' : undefined} onAction={addPhoto}>
          {(imgs.data?.gallery.length ?? 0) > 0 ? (
            <View style={[styles.wrap, { paddingVertical: 12 }]}>
              {imgs.data!.gallery.map((u, i) => (
                <Pressable key={u} onLongPress={canShare ? () => removePhoto(i) : undefined} accessibilityHint={canShare ? 'Toque longo para remover' : undefined}>
                  <Image source={{ uri: u }} style={{ width: 104, height: 78, borderRadius: 8 }} accessibilityLabel={`Foto ${i + 1}`} />
                </Pressable>
              ))}
            </View>
          ) : <Empty text="Até 6 fotos em jogos e treinos." />}
        </Section>
      )}

      {/* Contatos e referências */}
      {panel === 'contatos' ? (
        <Card>
          <T variant="subtitle">Contatos e referências</T>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Telefone" keyboardType="phone-pad" value={prof.phone} onChangeText={(v) => setProf({ ...prof, phone: v })} maxLength={30} /></View>
            <View style={{ flex: 1 }}><Field label="Instagram" autoCapitalize="none" value={prof.instagram} onChangeText={(v) => setProf({ ...prof, instagram: v })} maxLength={60} placeholder="@" /></View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="E-mail" autoCapitalize="none" keyboardType="email-address" value={prof.email} onChangeText={(v) => setProf({ ...prof, email: v })} maxLength={120} /></View>
            <View style={{ flex: 1 }}><CityField value={prof.city} onChange={(v) => setProf({ ...prof, city: v })} /></View>
          </View>
          {refs.map((r, i) => (
            <View key={i} style={styles.row}>
              <View style={{ flex: 2 }}><Field label={`Referência ${i + 1}`} value={r.name} onChangeText={(v) => setRefs(refs.map((x, j) => (j === i ? { ...x, name: v } : x)))} maxLength={80} placeholder="Nome" /></View>
              <View style={{ flex: 1 }}><Field label="Função" value={r.role ?? ''} onChangeText={(v) => setRefs(refs.map((x, j) => (j === i ? { ...x, role: v } : x)))} maxLength={40} /></View>
              <View style={{ flex: 2 }}><Field label="Telefone" value={r.phone ?? ''} onChangeText={(v) => setRefs(refs.map((x, j) => (j === i ? { ...x, phone: v } : x)))} maxLength={30} /></View>
            </View>
          ))}
          {refs.length < 4 && (
            <Pressable onPress={() => setRefs([...refs, { name: '', role: 'Treinador', phone: '' }])} accessibilityRole="button">
              <Text style={{ color: colors.primary, fontWeight: '700' }}>+ Referência</Text>
            </Pressable>
          )}
          <View style={[styles.row, { justifyContent: 'space-between', alignItems: 'center' }]}>
            <T variant="small" style={{ flex: 1 }}>Mostrar contatos e referências no link compartilhado</T>
            <Switch accessibilityLabel="Mostrar contatos no link" value={prof.show} onValueChange={(v) => setProf({ ...prof, show: v })} />
          </View>
          {error && <Notice tone="danger" text={error} />}
          <View style={styles.row}>
            <Button title="Salvar" kind="primary" style={{ flex: 1 }} loading={busy} onPress={() => saveProfile('contatos')} />
            <Button title="Cancelar" kind="outline" style={{ flex: 1 }} onPress={close} />
          </View>
        </Card>
      ) : (canShare || p?.contact_phone || p?.contact_email || (p?.references?.length ?? 0) > 0) ? (
        <Section title="Contatos e referências" action={canShare ? 'Editar' : undefined} onAction={() => setPanel('contatos')}>
          {[p?.contact_phone, p?.contact_email, p?.instagram, p?.city].filter(Boolean).length === 0 && !(p?.references?.length)
            ? <Empty text="Telefone, e-mail, Instagram e treinadores que indicam o atleta." />
            : <>
                {[p?.contact_phone, p?.contact_email, p?.instagram, p?.city].filter(Boolean).length > 0 &&
                  <Line title={[p?.contact_phone, p?.contact_email].filter(Boolean).join(' · ') || (p?.instagram ?? '')} sub={[p?.instagram, p?.city].filter(Boolean).join(' · ')} last={!(p?.references?.length)} />}
                {(p?.references ?? []).map((r, i) => <Line key={i} title={r.name} sub={[r.role, r.phone].filter(Boolean).join(' · ')} last={i === (p?.references?.length ?? 0) - 1} />)}
              </>}
        </Section>
      ) : null}
      {/* Ações no fim do currículo (auditoria, item 07) */}
      <View style={{ gap: 10 }}>
        <Button title="Gerar PDF" icon="document-outline" kind="primary" onPress={pdf} />
        {canShare && <Button title="Compartilhar através de link" icon="link-outline" kind="outline" onPress={() => setPanel(panel === 'compartilhar' ? null : 'compartilhar')} />}
        {canShare && <Button title="Importar currículo" icon="cloud-upload-outline" kind="outline" onPress={() => router.push({ pathname: '/curriculo/importar/[athleteId]', params: { athleteId } })} />}
      </View>
      {panel === 'compartilhar' && (
        <Card>
          <T variant="subtitle">Compartilhar</T>
          <T variant="small">Link só do currículo, sem CPF, endereço, documentos ou nascimento. Vale 90 dias.</T>
          {(shares.data ?? []).map((s) => (
            <View key={s.id} style={[styles.row, { alignItems: 'center' }]}>
              <T variant="small" style={{ flex: 1 }}>Ativo até {new Date(s.expires_at).toLocaleDateString('pt-BR')}</T>
              <Button title="Copiar" kind="outline" onPress={async () => { if ((await shareText(`${SITE_URL}/cv/${s.token}`)) === 'copied') toast('Link copiado.'); }} />
              <Button title="Cancelar" kind="outline" onPress={() => revoke(s.id)} />
            </View>
          ))}
          <View style={styles.row}>
            <Button title="Novo link no WhatsApp" kind="primary" style={{ flex: 1 }} onPress={newShare} />
            <Button title="Fechar" kind="outline" style={{ flex: 1 }} onPress={close} />
          </View>
        </Card>
      )}

    </View>
  );
}
