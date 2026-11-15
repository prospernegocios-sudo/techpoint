// Cartão "Documentos" da ficha do atleta: lista, abre, envia (PDF, PNG, JPG ou foto) e apaga.
import { toast } from '@/components/toast';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { DateField } from '@/components/date-field';
import { Badge, Button, Card, Chip, Field, Loading, Notice, T, styles } from '@/components/ui';
import {
  DOC_KINDS, DocKind, MAX_DOC_BYTES, PickedFile, deleteAthleteDocument, docMime, kindLabel,
  openAthleteDocument, uploadAthleteDocument, useAthleteDocuments, validity, type AthleteDoc,
} from '@/lib/documents';
import { toFriendlyError } from '@/lib/errors';
import { parseBrDate, toIsoDate } from '@/lib/format';
import { isoDayToBr } from '@/lib/report';

type Props = { orgId: string; athleteId: string; meId: string; isStaff: boolean };

export function DocumentsCard({ orgId, athleteId, meId, isStaff }: Props) {
  const qc = useQueryClient();
  const docs = useAthleteDocuments(athleteId);
  const [form, setForm] = useState<{ kind: DocKind; title: string; valid: string; picked: PickedFile | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['athlete-docs', athleteId] });

  const accept = (p: PickedFile) => {
    if (!p.mime) return setMsg({ tone: 'danger', text: 'Envie PDF, PNG ou JPG.' });
    if (p.size > MAX_DOC_BYTES) return setMsg({ tone: 'danger', text: 'O arquivo pode ter no máximo 10 MB.' });
    setMsg(null);
    setForm((f) => (f ? { ...f, picked: p } : f));
  };

  const pickFile = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/png', 'image/jpeg'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    accept({ uri: a.uri, name: a.name, mime: docMime(a.name, a.mimeType) ?? '', size: a.size ?? 0, file: a.file });
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setMsg({ tone: 'danger', text: 'Libere a câmera nas configurações do celular.' });
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    accept({ uri: a.uri, name: 'foto.jpg', mime: docMime(a.fileName, a.mimeType) ?? 'image/jpeg', size: a.fileSize ?? 1 });
  };

  const save = async () => {
    if (!form?.picked) return setMsg({ tone: 'danger', text: 'Escolha o arquivo ou tire a foto.' });
    let validUntil: string | null = null;
    if (form.valid.trim()) {
      const d = parseBrDate(form.valid);
      if (!d) return setMsg({ tone: 'danger', text: 'Confira a data de validade (dd/mm/aaaa).' });
      validUntil = toIsoDate(d);
    }
    setBusy(true);
    try {
      await uploadAthleteDocument({ orgId, athleteId, uploaderId: meId, kind: form.kind, title: form.title, validUntil, picked: form.picked });
      setForm(null);
      setMsg(null); toast('Documento enviado.');
      refresh();
    } catch (e) {
      setMsg({ tone: 'danger', text: toFriendlyError(e).message });
    } finally {
      setBusy(false);
    }
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

  return (
    <Card>
      <T variant="subtitle">Documentos</T>
      <T variant="small">Atestado, RG, CPF e outros. PDF, PNG ou JPG de até 10 MB. Só a equipe da entidade, o atleta e os responsáveis veem.</T>
      {msg && <Notice tone={msg.tone} text={msg.text} />}
      {docs.isLoading && <Loading />}
      {docs.error && <Notice tone="danger" text="Não foi possível carregar os documentos." />}
      {docs.data?.length === 0 && <T variant="muted">Nenhum documento enviado.</T>}
      {(docs.data ?? []).map((d) => {
        const v = validity(d.valid_until);
        return (
          <View key={d.id} style={{ gap: 6, paddingVertical: 6 }}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <T variant="body" style={{ flex: 1, fontWeight: '700' }}>{kindLabel(d.kind)}{d.title ? ` · ${d.title}` : ''}</T>
              {v === 'expired' && <Badge label="Vencido" tone="danger" />}
              {v === 'soon' && <Badge label="Vence em breve" tone="warning" />}
              {v === 'ok' && <Badge label="Válido" tone="success" />}
            </View>
            <T variant="small">
              Enviado em {isoDayToBr(d.created_at.slice(0, 10))}{d.valid_until ? ` · válido até ${isoDayToBr(d.valid_until)}` : ''} · {d.mime_type === 'application/pdf' ? 'PDF' : 'imagem'}
            </T>
            <View style={styles.row}>
              <Button title="Abrir" kind="outline" style={{ flex: 1 }} onPress={() => open(d)} />
              {(isStaff || d.uploaded_by === meId) && <Button title="Apagar" kind="ghost" style={{ flex: 1 }} onPress={() => remove(d)} />}
            </View>
          </View>
        );
      })}
      {form ? (
        <View style={{ gap: 8 }}>
          <View style={styles.wrap}>{DOC_KINDS.map((k) => <Chip key={k.key} label={k.label} selected={form.kind === k.key} onPress={() => setForm({ ...form, kind: k.key })} />)}</View>
          <Field label="Descrição (opcional)" value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} maxLength={120} placeholder="Ex.: atestado para a temporada 2027" />
          {form.kind === 'atestado' && (
            <DateField label="Válido até (opcional)" mode="date" value={form.valid} onChange={(v) => setForm({ ...form, valid: v })} hint="O app avisa quando estiver perto de vencer." />
          )}
          <View style={styles.row}>
            <Button title="Escolher arquivo" kind="outline" style={{ flex: 1 }} onPress={pickFile} />
            {Platform.OS !== 'web' && <Button title="Tirar foto" kind="outline" style={{ flex: 1 }} onPress={takePhoto} />}
          </View>
          {form.picked && <T variant="small">Arquivo: {form.picked.name}</T>}
          <Button title={busy ? 'Enviando...' : 'Enviar documento'} kind="accent" disabled={busy || !form.picked} onPress={save} />
          <Button title="Cancelar" kind="ghost" onPress={() => setForm(null)} />
        </View>
      ) : (
        <Button title="Enviar documento" kind="outline" onPress={() => { setMsg(null); setForm({ kind: 'atestado', title: '', valid: '', picked: null }); }} />
      )}
    </Card>
  );
}
