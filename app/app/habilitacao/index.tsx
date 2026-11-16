// Fase A do incentivo: "Seu clube está apto?" — pasta de habilitação do Termo de Fomento (Revelar Talentos).
// Só gestor e administrador, e só com o módulo "investimentos". O servidor também bloqueia.
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { DateField } from '@/components/date-field';
import { toast } from '@/components/toast';
import { Badge, Button, Card, Field, Loading, Notice, Screen, T } from '@/components/ui';
import { lookupCnpj } from '@/lib/br';
import { MAX_DOC_BYTES, pickIdDocument } from '@/lib/documents';
import { toFriendlyError } from '@/lib/errors';
import { parseBrDate, toIsoDate } from '@/lib/format';
import {
  HABIL_SECTIONS, deleteHabilDoc, markHabilItem, openHabilDoc, saveHabilProfile, summarize, uploadHabilDoc,
  useHabilDocs, useHabilProfile, useOfficers, type HabilState, type ItemStatus,
} from '@/lib/habilitation';
import { useMe } from '@/lib/me';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

const STATE: Record<HabilState, { label: string; tone: 'success' | 'warning' | 'danger' | 'muted' | 'primary' }> = {
  ok: { label: 'Em dia', tone: 'success' },
  vencendo: { label: 'Atenção', tone: 'warning' },
  vencido: { label: 'Vencido', tone: 'danger' },
  pendente: { label: 'Pendente', tone: 'muted' },
  nao_aplica: { label: 'Não se aplica', tone: 'primary' },
  impeditivo: { label: 'Impede', tone: 'danger' },
};
const br = (iso: string | null | undefined) => (iso ? iso.split('-').reverse().join('/') : '');
const iso = (brDate: string) => { const d = parseBrDate(brDate); return d ? toIsoDate(d) : null; };

export default function Habilitacao() {
  const me = useMe();
  const orgId = me.org?.id;
  const allowed = (me.isManager || me.isPlatformAdmin) && me.hasModule('investimentos');
  const docs = useHabilDocs(allowed ? orgId : undefined);
  const profile = useHabilProfile(allowed ? orgId : undefined);
  const officers = useOfficers(allowed ? orgId : undefined);
  const org = useQuery({
    queryKey: ['org-cnpj', orgId], enabled: Boolean(orgId && allowed),
    queryFn: async () => (await supabase.from('organizations').select('cnpj').eq('id', orgId!).single()).data as { cnpj: string | null } | null,
  });
  const qc = useQueryClient();
  const { colors } = useTheme();
  const [open, setOpen] = useState<string | null>(null);
  const [founded, setFounded] = useState<string | null>(null);

  const foundedOn = profile.data?.founded_on ?? null;
  const sum = useMemo(() => summarize(docs.data ?? [], { foundedOn }), [docs.data, foundedOn]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['habil-docs', orgId] }); qc.invalidateQueries({ queryKey: ['habil-profile', orgId] }); };

  if (!allowed) return <Screen><Stack.Screen options={{ title: 'Clube apto' }} /><Notice tone="info" text="Disponível para gestores e administradores de entidades com o módulo de Gestão de Investimentos." /></Screen>;
  if (docs.isLoading || profile.isLoading) return <Loading />;

  const foundedValue = founded ?? br(foundedOn);
  const saveFounded = async (value: string | null) => {
    try { await saveHabilProfile(orgId!, { founded_on: value }); setFounded(null); refresh(); toast('Data de abertura salva.'); }
    catch (e) { toast(toFriendlyError(e).message, 'danger'); }
  };
  const fromReceita = async () => {
    if (!org.data?.cnpj) { toast('Cadastre o CNPJ em Dados da entidade.', 'danger'); return; }
    const info = await lookupCnpj(org.data.cnpj);
    if (!info?.founded_on) { toast('A Receita não respondeu agora. Digite a data.', 'danger'); return; }
    await saveFounded(info.founded_on);
  };
  const signer = officers.data?.find((o) => o.is_signatory);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Clube apto' }} />
      <T variant="title">Seu clube está apto?</T>
      <T variant="small">Revelar Talentos · Termo de Fomento (Ministério do Esporte). Checklist dos documentos que a entidade precisa ter em dia para receber o recurso.</T>

      <Card style={{ gap: 10, backgroundColor: sum.apt ? colors.successContainer : colors.surfaceContainer }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <T variant="title" style={{ fontSize: 40 }}>{sum.pct}%</T>
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="body" style={{ fontWeight: '700' }}>{sum.apt ? 'Documentação completa' : `Faltam ${sum.blockers} item(ns)`}</T>
            <T variant="small">{sum.done} de {sum.total} itens prontos{sum.warnings ? ` · ${sum.warnings} pedem atenção` : ''}</T>
          </View>
        </View>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.surfaceContainerHigh, overflow: 'hidden' }}>
          <View style={{ width: `${sum.pct}%`, height: 10, backgroundColor: sum.apt ? colors.success : colors.primary }} />
        </View>
        <T variant="small">A análise oficial é do Ministério. Este painel ajuda a não esquecer nada e avisa 15 dias antes de uma certidão vencer.</T>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Button kind="tonal" icon="people-outline" title={`Dirigentes (${officers.data?.length ?? 0})`} onPress={() => router.push('/habilitacao/dirigentes')} style={{ flexGrow: 1 }} />
        <Button kind="tonal" icon="document-text-outline" title="Declarações em Word" onPress={() => router.push('/habilitacao/declaracoes')} style={{ flexGrow: 1 }} />
      </View>
      {!signer && <Notice text="Cadastre os dirigentes e marque quem assina pela entidade. Os dados entram nas declarações." />}

      <Card style={{ gap: 10 }}>
        <T variant="body" style={{ fontWeight: '700' }}>Data de abertura do CNPJ</T>
        <T variant="small">O Ministério exige no mínimo 3 anos de CNPJ ativo.</T>
        <DateField label="Abertura" mode="date" value={foundedValue} onChange={setFounded} placeholder="dd/mm/aaaa" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {founded != null && <Button title="Salvar data" onPress={() => saveFounded(iso(founded))} />}
          <Button kind="outline" icon="cloud-download-outline" title="Buscar na Receita" onPress={fromReceita} />
        </View>
      </Card>

      {HABIL_SECTIONS.map((sec) => (
        <View key={sec.key} style={{ gap: 8 }}>
          <T variant="small" style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>{sec.title}</T>
          <View style={{ borderRadius: 24, backgroundColor: colors.surfaceContainer, overflow: 'hidden' }}>
            {sum.items.filter((s) => s.item.section === sec.key).map((s, idx) => (
              <ItemRow key={s.item.code} s={s} first={idx === 0} open={open === s.item.code}
                onToggle={() => setOpen(open === s.item.code ? null : s.item.code)}
                orgId={orgId!} userId={me.profile?.id ?? ''} onChanged={refresh} />
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

function ItemRow({ s, first, open, onToggle, orgId, userId, onChanged }: {
  s: ItemStatus; first: boolean; open: boolean; onToggle: () => void; orgId: string; userId: string; onChanged: () => void;
}) {
  const { colors } = useTheme();
  const st = STATE[s.state];
  const [issued, setIssued] = useState('');
  const [valid, setValid] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { item } = s;

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true); setErr('');
    try { await fn(); toast(ok); setIssued(''); setValid(''); setReason(''); onChanged(); }
    catch (e) { setErr(toFriendlyError(e).message); }
    finally { setBusy(false); }
  };
  const send = async () => {
    if (item.expires && !iso(valid)) { setErr('Informe até quando a certidão vale.'); return; }
    if (item.maxAgeDays && !iso(issued)) { setErr('Informe a data de emissão do comprovante.'); return; }
    const picked = await pickIdDocument();
    if (!picked) return;
    if (!picked.mime) { setErr('Envie PDF, PNG ou JPG.'); return; }
    if (picked.size > MAX_DOC_BYTES) { setErr('Arquivo acima de 10 MB.'); return; }
    await run(() => uploadHabilDoc({ orgId, uploaderId: userId, itemCode: item.code, picked, issuedOn: iso(issued), validUntil: iso(valid) }), 'Documento enviado.');
  };
  const remove = () => {
    if (!s.doc) return;
    const go = () => run(() => deleteHabilDoc(s.doc!), 'Registro apagado.');
    if (Platform.OS === 'web') { if (window.confirm('Apagar este registro?')) go(); }
    else Alert.alert('Apagar este registro?', 'O arquivo também é apagado.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: go }]);
  };

  return (
    <View style={{ borderTopWidth: first ? 0 : 1, borderTopColor: colors.border }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${item.code} ${item.title}. ${st.label}`} onPress={onToggle}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 64, opacity: pressed ? 0.7 : 1 })}>
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="body" style={{ fontWeight: '700' }}>{item.title}</T>
          <T variant="small">{s.message}</T>
        </View>
        <Badge label={st.label} tone={st.tone} />
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 16, gap: 10 }}>
          <T variant="small">Item {item.code} do checklist. {item.hint}</T>
          {item.annex && <T variant="small" color={colors.primary}>Modelo pronto: Anexo {item.annex}, em Declarações em Word.</T>}
          {item.expires && <DateField label="Válida até" mode="date" value={valid} onChange={setValid} placeholder="dd/mm/aaaa" />}
          {item.maxAgeDays && <DateField label="Data de emissão do comprovante" mode="date" value={issued} onChange={setIssued} placeholder="dd/mm/aaaa" />}
          {err ? <Notice tone="danger" text={err} /> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Button icon="cloud-upload-outline" title={s.doc?.file_path ? 'Enviar nova versão' : 'Enviar arquivo'} onPress={send} loading={busy} />
            {item.kind === 'confirm' && s.state !== 'ok' && (
              <Button kind="tonal" icon="checkmark-outline" title="Já está feito" onPress={() => run(() => markHabilItem({ orgId, uploaderId: userId, itemCode: item.code, status: 'confirmado' }), 'Item confirmado.')} disabled={busy} />
            )}
            {s.doc?.file_path && <Button kind="outline" icon="eye-outline" title="Ver arquivo" onPress={() => openHabilDoc(s.doc!).catch((e) => setErr(toFriendlyError(e).message))} />}
            {s.doc && <Button kind="outline" icon="trash-outline" title="Apagar" onPress={remove} disabled={busy} />}
          </View>
          {item.conditional && s.state !== 'nao_aplica' && (
            <View style={{ gap: 8 }}>
              <T variant="small">{item.conditional} Se não for o seu caso, marque como “não se aplica” e diga o motivo.</T>
              <Field label="Motivo" value={reason} onChangeText={setReason} placeholder="Ex.: o projeto é de R$ 400 mil" />
              <Button kind="tonal" title="Não se aplica" disabled={busy || reason.trim().length < 3}
                onPress={() => run(() => markHabilItem({ orgId, uploaderId: userId, itemCode: item.code, status: 'nao_aplica', note: reason }), 'Marcado como não se aplica.')} />
            </View>
          )}
          {s.history.length > 1 && (
            <T variant="small">Histórico: {s.history.slice(1).map((h) => `${br(h.created_at.slice(0, 10))}${h.valid_until ? ` (válida até ${br(h.valid_until)})` : ''}`).join(' · ')}</T>
          )}
        </View>
      )}
    </View>
  );
}
