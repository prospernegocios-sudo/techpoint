// Cartão "Documentos" da ficha do atleta: lista, abre, envia (PDF, PNG, JPG ou foto) e apaga.
import { toast } from '@/components/toast';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { DateField } from '@/components/date-field';
import { Badge, Button, Card, Chip, Field, Loading, Notice, T, styles } from '@/components/ui';
import {
  DOC_KINDS, DocKind, MAX_DOC_BYTES, PickedFile, deleteAthleteDocument, docMime, kindLabel,
  openAthleteDocument, uploadAthleteDocument, useAthleteDocuments, validity, type AthleteDoc,
} from '@/lib/documents';
import { toFriendlyError } from '@/lib/errors';
import { parseBrDate, toIsoDate } from '@/lib/format';
import { isoDayToBr } from '@/lib/report';
import { useTheme } from '@/lib/theme';

type Props = { orgId: string; athleteId: string; meId: string; isStaff: boolean };

export function DocumentsCard({ orgId, athleteId, meId, isStaff }: Props) {
  const qc = useQueryClient();
  const docs = useAthleteDocuments(athleteId);
  // Envio (D97/D99): primeiro os arquivos (vários); depois, em cada um, "relacionado a quê?".
  type Queued = { picked: PickedFile; kind: DocKind | null; other: string; valid: string };
  const [queue, setQueue] = useState<Queued[]>([]);
  const [busy, setBusy] = useState(false);
  // Explorador de pastas (auditoria, item 09): pasta raiz e pastas por tipo, que abrem e fecham.
  const [openSet, setOpenSet] = useState<Set<string>>(() => new Set(['root']));
  const isOpen = (k: string) => openSet.has(k);
  const toggle = (k: string) => setOpenSet((cur) => { const n = new Set(cur); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const { colors } = useTheme();
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['athlete-docs', athleteId] });

  const add = (files: PickedFile[]) => {
    const bad = files.find((p) => !p.mime || p.size > MAX_DOC_BYTES);
    if (bad) setMsg({ tone: 'danger', text: !bad.mime ? `${bad.name}: envie PDF, PNG ou JPG.` : `${bad.name}: máximo 10 MB.` }); else setMsg(null);
    const ok = files.filter((p) => p.mime && p.size <= MAX_DOC_BYTES);
    if (ok.length) setQueue((q) => [...q, ...ok.map((picked) => ({ picked, kind: null, other: '', valid: '' }))]);
  };
  const pickFile = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/png', 'image/jpeg'], copyToCacheDirectory: true, multiple: true });
    if (r.canceled || !r.assets.length) return;
    add(r.assets.map((a) => ({ uri: a.uri, name: a.name, mime: docMime(a.name, a.mimeType) ?? '', size: a.size ?? 0, file: a.file })));
  };
  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setMsg({ tone: 'danger', text: 'Libere a câmera nas configurações do celular.' });
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    add([{ uri: a.uri, name: `foto-${queue.length + 1}.jpg`, mime: docMime(a.fileName, a.mimeType) ?? 'image/jpeg', size: a.fileSize ?? 1 }]);
  };
  const setItem = (i: number, patch: Partial<Queued>) => setQueue(queue.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  const sendAll = async () => {
    const missing = queue.findIndex((q) => !q.kind || (q.kind === 'outro' && !q.other.trim()));
    if (missing >= 0) return setMsg({ tone: 'danger', text: `Diga a que se refere o arquivo ${missing + 1} (${queue[missing].picked.name}).` });
    const badDate = queue.findIndex((q) => q.valid.trim() && !parseBrDate(q.valid));
    if (badDate >= 0) return setMsg({ tone: 'danger', text: `Confira a validade do arquivo ${badDate + 1} (dd/mm/aaaa).` });
    setBusy(true); setMsg(null);
    const failed: Queued[] = [];
    for (const q of queue) {
      const d = q.valid.trim() ? parseBrDate(q.valid) : null;
      try {
        await uploadAthleteDocument({ orgId, athleteId, uploaderId: meId, kind: q.kind!, title: q.kind === 'outro' ? q.other.trim() : '', validUntil: d ? toIsoDate(d) : null, picked: q.picked });
      } catch { failed.push(q); }
    }
    setBusy(false);
    const sent = queue.length - failed.length;
    setQueue(failed);
    refresh();
    if (failed.length) setMsg({ tone: 'danger', text: `${failed.length} não foram enviados (continuam na lista). Tente de novo.` });
    if (sent) toast(sent > 1 ? `${sent} documentos enviados.` : 'Documento enviado.');
  };

  const open = async (d: AthleteDoc) => {
    try { await openAthleteDocument(d.file_path); } catch (e) { setMsg({ tone: 'danger', text: toFriendlyError(e).message }); }
  };

  const remove = (d: AthleteDoc) => {
    const run = async () => {
      try { await deleteAthleteDocument(d); toast('Documento apagado.'); refresh(); } catch (e) { setMsg({ tone: 'danger', text: toFriendlyError(e).message }); }
    };
    if (Platform.OS === 'web') { if (window.confirm('Apagar este documento?')) run(); return; }
    Alert.alert('Apagar documento?', kindLabel(d.kind), [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: run }]);
  };

  const all = docs.data ?? [];
  const order = ['atestado', 'identidade', 'comprovante_residencia', 'doc_responsavel', 'autorizacao', 'cpf', 'outro'];
  const groups = order.map((key) => {
    const items = all.filter((d) => d.kind === key);
    return { key, label: kindLabel(key), current: items.filter((d) => !d.superseded_at), old: items.filter((d) => d.superseded_at) };
  }).filter((g) => g.current.length + g.old.length > 0 || ['atestado', 'identidade', 'comprovante_residencia', 'autorizacao', 'outro'].includes(g.key));

  const docRow = (d: AthleteDoc, tag: string | null) => {
    const v = d.superseded_at ? null : validity(d.valid_until);
    return (
      <View key={d.id} style={[styles.row, { paddingVertical: 4, opacity: d.superseded_at ? 0.7 : 1 }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="small" style={{ fontWeight: '700' }}>{d.title || (d.mime_type === 'application/pdf' ? 'PDF' : 'Imagem')}{tag ? ` · ${tag}` : ''}</T>
          <T variant="small">Enviado em {isoDayToBr(d.created_at.slice(0, 10))}{d.valid_until ? ` · válido até ${isoDayToBr(d.valid_until)}` : ''}</T>
        </View>
        {v === 'expired' && <Badge label="Vencido" tone="danger" />}
        {v === 'soon' && <Badge label="Vence logo" tone="warning" />}
        {v === 'ok' && <Badge label="Válido" tone="success" />}
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir documento" onPress={() => open(d)} hitSlop={8}><Ionicons name="eye-outline" size={22} color={colors.primary} /></Pressable>
        {(isStaff || d.uploaded_by === meId) && (
          <Pressable accessibilityRole="button" accessibilityLabel="Apagar documento" onPress={() => remove(d)} hitSlop={8}><Ionicons name="trash-outline" size={20} color={colors.danger} /></Pressable>
        )}
      </View>
    );
  };

  return (
    <Card>
      <T variant="subtitle">Documentos</T>
      <T variant="small">Organizados em pastas por tipo: toque numa pasta para abrir ou fechar. PDF, PNG ou JPG de até 10 MB. Só a equipe da entidade, o atleta e os responsáveis veem.</T>
      {msg && <Notice tone={msg.tone} text={msg.text} />}
      {docs.isLoading && <Loading />}
      {docs.error && <Notice tone="danger" text="Não foi possível carregar os documentos." />}
            {/* Árvore: Documentos (raiz) › pastas por tipo › arquivos › versões anteriores */}
      {!docs.isLoading && (() => {
        const Folder = ({ k, label, count, depth, children }: { k: string; label: string; count: string; depth: number; children: React.ReactNode }) => (
          <View>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen(k) }} accessibilityLabel={`Pasta ${label}, ${count}`} onPress={() => toggle(k)}
              style={({ pressed }) => [styles.row, { minHeight: 44, paddingLeft: depth * 18, gap: 8, borderRadius: 12, backgroundColor: pressed ? colors.surfaceContainerHigh : 'transparent' }]}>
              <Ionicons name={isOpen(k) ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.textMuted} />
              <Ionicons name={isOpen(k) ? 'folder-open' : 'folder'} size={22} color={colors.primary} />
              <T variant="body" style={{ fontWeight: '700', flexShrink: 1 }}>{label}</T>
              <T variant="small">{count}</T>
            </Pressable>
            {isOpen(k) && <View style={{ marginLeft: depth * 18 + 22, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.border, gap: 2 }}>{children}</View>}
          </View>
        );
        const total = all.filter((d) => !d.superseded_at).length;
        return (
          <Folder k="root" label="Documentos" count={`${total} arquivo${total === 1 ? '' : 's'}`} depth={0}>
            {groups.map((g) => (
              <Folder key={g.key} k={g.key} label={g.label} count={g.current.length ? `(${g.current.length})` : '(vazia)'} depth={0}>
                {g.current.length === 0 && <T variant="small" style={{ paddingVertical: 6 }}>Nenhum arquivo nesta pasta.</T>}
                {g.current.map((d, idx) => (
                  <View key={d.id} style={[styles.row, { gap: 8 }]}>
                    <Ionicons name={d.mime_type === 'application/pdf' ? 'document-text-outline' : 'image-outline'} size={20} color={colors.textMuted} />
                    <View style={{ flex: 1 }}>{docRow(d, idx === 0 && g.current.length > 1 ? 'mais recente' : null)}</View>
                  </View>
                ))}
                {g.old.length > 0 && (
                  <Folder k={`${g.key}-old`} label="Versões anteriores" count={`(${g.old.length})`} depth={0}>
                    {g.old.map((d) => (
                      <View key={d.id} style={[styles.row, { gap: 8 }]}>
                        <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                        <View style={{ flex: 1 }}>{docRow(d, 'substituído')}</View>
                      </View>
                    ))}
                  </Folder>
                )}
              </Folder>
            ))}
          </Folder>
        );
      })()}
      {queue.length > 0 && (
        <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
          <T variant="body" style={{ fontWeight: '800' }}>Arquivos para enviar ({queue.length})</T>
          {queue.map((q, i) => (
            <View key={i} style={{ gap: 8, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: q.kind ? colors.outline : colors.warning, backgroundColor: colors.surface }}>
              <View style={[styles.row, { alignItems: 'center' }]}>
                <Ionicons name={q.picked.mime === 'application/pdf' ? 'document-outline' : 'image-outline'} size={20} color={colors.primary} />
                <T variant="small" style={{ flex: 1, fontWeight: '700' }}>{q.picked.name}</T>
                <Pressable accessibilityRole="button" accessibilityLabel="Tirar da lista" onPress={() => setQueue(queue.filter((_, j) => j !== i))} hitSlop={8}>
                  <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                </Pressable>
              </View>
              <T variant="small">Este documento é relacionado a quê?</T>
              <View style={styles.wrap}>
                {DOC_KINDS.map((k) => <Chip key={k.key} label={k.key === 'atestado' ? 'Atestado de saúde' : k.label} selected={q.kind === k.key} onPress={() => setItem(i, { kind: k.key })} />)}
              </View>
              {q.kind === 'outro' && <Field label="Qual documento?" value={q.other} onChangeText={(v) => setItem(i, { other: v })} maxLength={120} placeholder="Ex.: declaração escolar" />}
              {q.kind === 'atestado' && <DateField label="Válido até (opcional)" mode="date" value={q.valid} onChange={(v) => setItem(i, { valid: v })} />}
              {q.kind && DOC_KINDS.find((k) => k.key === q.kind)?.single && <T variant="small">{DOC_KINDS.find((k) => k.key === q.kind)?.hint}</T>}
            </View>
          ))}
        </View>
      )}
      <View style={styles.row}>
        <Button title={queue.length ? '+ Mais arquivos' : 'Enviar documentos'} kind="outline" style={{ flex: 1 }} onPress={pickFile} />
        {Platform.OS !== 'web' && <Button title="+ Foto" kind="outline" style={{ flex: 1 }} onPress={takePhoto} />}
      </View>
      {queue.length > 0 && (
        <View style={styles.row}>
          <Button title={busy ? 'Enviando...' : queue.length === 1 ? 'Enviar 1 documento' : `Enviar ${queue.length} documentos`} kind="primary" style={{ flex: 1 }} disabled={busy} onPress={sendAll} />
          <Button title="Cancelar" kind="outline" style={{ flex: 1 }} onPress={() => { setQueue([]); setMsg(null); }} />
        </View>
      )}
    </Card>
  );
}
