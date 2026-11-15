// Importar currículo (D85, sem custo): PDF com texto, texto colado ou resposta do assistente externo.
// O leitor monta os itens; a pessoa revisa, corrige e escolhe o que salvar.
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Badge, Button, Card, Chip, Field, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { CV_KINDS, cvKindLabel, maskMonthYear, monthLabel, parseMonthYear, toMonthYear, type CvKind } from '@/lib/cv';
import { ASSISTANT_PROMPT, parseCvText, type DraftEntry, type ParsedCv } from '@/lib/cv-parser';
import { toFriendlyError } from '@/lib/errors';
import { shareText } from '@/lib/links';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type Row = DraftEntry & { use: boolean; month: string };
type Source = 'pdf' | 'texto' | 'assistente';

export default function ImportarCurriculo() {
  const { athleteId } = useLocalSearchParams<{ athleteId: string }>();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const a = useQuery({
    queryKey: ['athlete-min', athleteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('athletes').select('id, org_id, full_name').eq('id', athleteId!).single();
      if (error) throw error;
      return data as { id: string; org_id: string; full_name: string };
    },
  });
  const [source, setSource] = useState<Source>('pdf');
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedCv | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [useProfile, setUseProfile] = useState(true);
  const [edit, setEdit] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (a.isLoading) return <Loading />;
  if (!a.data) return <Screen><Notice tone="danger" text="Atleta não encontrado." /></Screen>;

  const load = (t: string) => {
    const p = parseCvText(t);
    setParsed(p);
    setRows(p.entries.map((e) => ({ ...e, use: Boolean(e.started_on), month: toMonthYear(e.started_on) })));
    setMsg(p.entries.length ? { tone: 'success', text: `Encontramos ${p.entries.length} itens. Confira, corrija e salve.` } : { tone: 'danger', text: 'Não encontramos itens. Tente o assistente gratuito.' });
  };

  const readPdf = async () => {
    setMsg(null);
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    const asset = r.assets[0];
    if ((asset.size ?? 0) > 10 * 1024 * 1024) return setMsg({ tone: 'danger', text: 'O PDF pode ter no máximo 10 MB.' });
    setBusy(true);
    try {
      const bytes = Platform.OS === 'web' && asset.file ? await asset.file.arrayBuffer() : await new File(asset.uri).arrayBuffer();
      const { data, error } = await supabase.functions.invoke('pdf-text', { body: bytes, headers: { 'Content-Type': 'application/pdf' } });
      if (error) {
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(body?.error ?? 'Não foi possível ler este PDF.');
      }
      load((data as { lines: string[] }).lines.join('\n'));
    } catch (e) {
      setMsg({ tone: 'danger', text: `${toFriendlyError(e).message} Se o PDF for escaneado ou foto, use o assistente.` });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const chosen = rows.filter((r) => r.use);
    const bad = chosen.find((r) => !parseMonthYear(r.month) || r.title.trim().length < 2);
    if (bad) return setMsg({ tone: 'danger', text: `Confira "${bad.title || 'item sem nome'}": precisa de nome e mês/ano.` });
    setBusy(true);
    try {
      if (chosen.length) {
        const { error } = await supabase.from('athlete_cv_entries').insert(chosen.map((r) => ({
          athlete_id: athleteId, org_id: a.data!.org_id, kind: r.kind, title: r.title.trim().slice(0, 120), institution: r.institution, category: r.category,
          location: r.location, started_on: parseMonthYear(r.month), ended_on: r.ended_on, description: r.description?.slice(0, 600) ?? null, result: r.result?.slice(0, 80) ?? null,
        })));
        if (error) throw error;
      }
      if (useProfile && parsed) {
        const { data: cur } = await supabase.from('athlete_cv_profile').select('*').eq('athlete_id', athleteId!).maybeSingle();
        const c = (cur ?? {}) as Record<string, unknown>;
        // Só preenche o que está vazio: não apaga o que a família já escreveu.
        const patch: Record<string, unknown> = { athlete_id: athleteId, updated_at: new Date().toISOString() };
        if (!c.headline && parsed.headline) patch.headline = parsed.headline.slice(0, 80);
        if (!c.about && parsed.about) patch.about = parsed.about.slice(0, 1500);
        if (!(c.goals as string[] | undefined)?.length && parsed.goals.length) patch.goals = parsed.goals.slice(0, 10);
        if (!c.contact_phone && parsed.contacts.phone) patch.contact_phone = parsed.contacts.phone.slice(0, 30);
        if (!c.contact_email && parsed.contacts.email) patch.contact_email = parsed.contacts.email.slice(0, 120);
        if (!c.instagram && parsed.contacts.instagram) patch.instagram = parsed.contacts.instagram.slice(0, 60);
        if (!c.city && parsed.contacts.city) patch.city = parsed.contacts.city.slice(0, 80);
        if (!((c.references as unknown[] | undefined)?.length) && parsed.references.length) patch.references = parsed.references.slice(0, 4);
        const { error } = await supabase.from('athlete_cv_profile').upsert(patch);
        if (error) throw error;
      }
      await supabase.from('cv_import_log').insert({ athlete_id: athleteId, source, items: chosen.length });
      qc.invalidateQueries({ queryKey: ['cv', athleteId] });
      setMsg({ tone: 'success', text: `${chosen.length} itens salvos no currículo.` });
      setTimeout(() => router.back(), 800);
    } catch (e) {
      setMsg({ tone: 'danger', text: toFriendlyError(e).message });
    } finally {
      setBusy(false);
    }
  };

  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const profileBits = parsed ? [parsed.headline && 'título', parsed.about && 'sobre mim', parsed.goals.length && 'metas',
    (parsed.contacts.phone || parsed.contacts.email || parsed.contacts.instagram) && 'contatos', parsed.references.length && 'referências'].filter(Boolean) : [];

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Importar currículo' }} />
      {!parsed && (
        <>
          <T variant="muted">Traga o currículo que já existe. O TechPoint monta os itens; você confere antes de salvar.</T>
          <View style={styles.wrap}>
            <Chip label="Enviar PDF" selected={source === 'pdf'} onPress={() => setSource('pdf')} />
            <Chip label="Colar texto" selected={source === 'texto'} onPress={() => setSource('texto')} />
            <Chip label="Assistente gratuito" selected={source === 'assistente'} onPress={() => setSource('assistente')} />
          </View>
          {source === 'pdf' && (
            <Card>
              <T variant="body">Funciona com PDF feito no Canva, Word ou Google Docs. PDF escaneado ou foto: use o assistente.</T>
              <Button title={busy ? 'Lendo o PDF...' : 'Escolher PDF'} kind="accent" disabled={busy} onPress={readPdf} />
            </Card>
          )}
          {source === 'texto' && (
            <Card>
              <Field label="Cole o currículo aqui" value={text} onChangeText={setText} multiline placeholder={'Ex.:\n2023 - Supervôlei Esporte Clube\nCircuito Brasiliense - sub 17\nMarço, 2025\nConquista: Vice-campeões'} />
              <Button title="Montar itens" kind="accent" disabled={text.trim().length < 10} onPress={() => load(text)} />
            </Card>
          )}
          {source === 'assistente' && (
            <Card>
              <T variant="body">1. Copie o pedido abaixo.</T>
              <Button title={copied ? 'Pedido copiado' : 'Copiar pedido'} kind="outline" onPress={async () => setCopied((await shareText(ASSISTANT_PROMPT)) === 'copied')} />
              <T variant="body">2. Abra um assistente gratuito (ChatGPT, Gemini ou outro), cole o pedido e, logo abaixo, o currículo (texto, PDF ou foto).</T>
              <T variant="body">3. Copie a resposta e cole aqui:</T>
              <Field label="Resposta do assistente" value={text} onChangeText={setText} multiline placeholder="competição | Circuito Brasiliense | Sub 17 | 03/2025 | Vice-campeão | Brasília" />
              <Button title="Montar itens" kind="accent" disabled={text.trim().length < 10} onPress={() => load(text)} />
            </Card>
          )}
          {msg && <Notice tone={msg.tone} text={msg.text} />}
        </>
      )}

      {parsed && (
        <>
          {msg && <Notice tone={msg.tone} text={msg.text} />}
          {profileBits.length > 0 && (
            <Card>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <T variant="body" style={{ flex: 1 }}>Também encontramos: {profileBits.join(', ')}. Usar no currículo (só onde estiver vazio)?</T>
                <Chip label={useProfile ? 'Sim' : 'Não'} selected={useProfile} onPress={() => setUseProfile(!useProfile)} />
              </View>
            </Card>
          )}
          <T variant="subtitle">Itens ({rows.filter((r) => r.use).length} de {rows.length} marcados)</T>
          {rows.map((r, i) => (
            <Card key={i} style={{ opacity: r.use ? 1 : 0.55 }}>
              <Pressable accessibilityRole="button" onPress={() => setEdit(edit === i ? null : i)} style={{ gap: 4 }}>
                <View style={[styles.row, { justifyContent: 'space-between' }]}>
                  <T variant="small" color={colors.primary}>{cvKindLabel(r.kind)} · {r.month ? monthLabel(parseMonthYear(r.month)) || r.month : 'sem data'}</T>
                  {!parseMonthYear(r.month) && <Badge label="Falta mês/ano" tone="warning" />}
                </View>
                <T variant="body" style={{ fontWeight: '700' }}>{r.title}{r.category ? ` · ${r.category}` : ''}</T>
                {r.result && <T variant="small">Conquista: {r.result}</T>}
                {r.institution && <T variant="small">{r.institution}</T>}
              </Pressable>
              {edit === i && (
                <View style={{ gap: 8 }}>
                  <View style={styles.wrap}>{CV_KINDS.map((k) => <Chip key={k.key} label={k.label} selected={r.kind === k.key} onPress={() => setRow(i, { kind: k.key as CvKind })} />)}</View>
                  <Field label="Nome" value={r.title} onChangeText={(v) => setRow(i, { title: v })} maxLength={120} />
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}><Field label="Mês/ano" keyboardType="number-pad" value={r.month} onChangeText={(v) => setRow(i, { month: maskMonthYear(v) })} placeholder="03/2025" /></View>
                    <View style={{ flex: 1 }}><Field label="Categoria" value={r.category ?? ''} onChangeText={(v) => setRow(i, { category: v || null })} maxLength={60} /></View>
                  </View>
                  <Field label="Conquista" value={r.result ?? ''} onChangeText={(v) => setRow(i, { result: v || null })} maxLength={80} />
                </View>
              )}
              <View style={styles.row}>
                <Button title={r.use ? 'Não importar' : 'Importar'} kind="ghost" style={{ flex: 1 }} onPress={() => setRow(i, { use: !r.use })} />
                <Button title={edit === i ? 'Fechar' : 'Corrigir'} kind="ghost" style={{ flex: 1 }} onPress={() => setEdit(edit === i ? null : i)} />
              </View>
            </Card>
          ))}
          <Button title={busy ? 'Salvando...' : `Salvar ${rows.filter((r) => r.use).length} itens no currículo`} kind="accent" disabled={busy} onPress={save} />
          <Button title="Começar de novo" kind="ghost" onPress={() => { setParsed(null); setRows([]); setMsg(null); }} />
        </>
      )}
    </Screen>
  );
}
