// Abas da onda 2 da execução: Ponto (folha de ponto), Cursos do COB e Plano de mídia.
import { Ionicons } from '@expo/vector-icons';
import { Packer } from 'docx';
import { useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { DateField } from '@/components/date-field';
import { toast } from '@/components/toast';
import { Badge, Button, Card, Chip, Field, Loading, Notice, T } from '@/components/ui';
import { MAX_DOC_BYTES, pickIdDocument } from '@/lib/documents';
import { toFriendlyError } from '@/lib/errors';
import { parseBrDate, toIsoDate } from '@/lib/format';
import {
  COB_COURSES, COB_URL, MEDIA_KINDS, addMedia, buildPointSheetDoc, cobProgress, deleteMedia, fmtMinutes, uploadStaffCertificate,
  type CobCourse, type CobStatus, type Media, type MediaKind, type PointRow,
} from '@/lib/staff';
import { useTheme } from '@/lib/theme';

const br = (iso: string | null | undefined) => (iso ? iso.split('-').reverse().join('/') : '');

async function downloadDoc(doc: Parameters<typeof Packer.toBlob>[0], name: string) {
  if (Platform.OS !== 'web') { toast('A folha de ponto em Word é baixada pelo site.', 'danger'); return; }
  const url = URL.createObjectURL(await Packer.toBlob(doc));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function PontoTab({ rows, loading, orgName, projectName, from, to }: { rows: PointRow[]; loading: boolean; orgName: string; projectName: string; from: string; to: string }) {
  const { colors } = useTheme();
  if (loading) return <Loading text="Carregando a folha de ponto..." />;
  const people = [...new Set(rows.map((r) => r.profileId))];
  return (
    <View style={{ gap: 12 }}>
      <T variant="small">Treinadores e equipe batem ponto pelo app em cada treino (Treinos › Bater ponto), com foto, localização e hora do servidor. Aqui sai a folha de ponto que o RCO pede.</T>
      {rows.length === 0 && <Notice tone="info" text="Nenhum ponto registrado ainda na vigência do projeto." />}
      {people.map((pid) => {
        const xs = rows.filter((r) => r.profileId === pid);
        const total = xs.reduce((s, r) => s + (r.minutes ?? 0), 0);
        return (
          <Card key={pid} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T variant="body" style={{ fontWeight: '700', flex: 1 }}>{xs[0].name}</T>
              <Badge label={`${fmtMinutes(total)} em ${xs.length} treino(s)`} tone="primary" />
            </View>
            {xs.slice(-6).map((r) => (
              <T key={r.eventId} variant="small">{br(r.date)} · {r.team} · {r.inAt ? new Date(r.inAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'} às {r.outAt ? new Date(r.outAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'sem saída'}{r.pending ? ' · fora do local (justificado)' : ''}</T>
            ))}
            {xs.some((r) => !r.outAt) && <T variant="small" color={colors.warning}>Há treino com entrada e sem saída.</T>}
          </Card>
        );
      })}
      <Button icon="document-text-outline" title="Baixar folha de ponto (Word)" onPress={() => downloadDoc(buildPointSheetDoc({ orgName, projectName, from, to, rows }), `Folha-de-ponto_${from}_a_${to}.docx`).catch((e) => toast(toFriendlyError(e).message, 'danger'))} />
    </View>
  );
}

export function CobTab({ data, loading, orgId, userId, refresh }: { data: { athletes: CobStatus[]; staff: CobStatus[] } | undefined; loading: boolean; orgId: string; userId: string; refresh: () => void }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  if (loading || !data) return <Loading text="Conferindo certificados..." />;
  const a = cobProgress(data.athletes), s = cobProgress(data.staff);
  const upload = async (p: CobStatus, course: CobCourse) => {
    const picked = await pickIdDocument();
    if (!picked) return;
    if (!picked.mime) { toast('Envie PDF, PNG ou JPG.', 'danger'); return; }
    if (picked.size > MAX_DOC_BYTES * 3) { toast('Arquivo muito grande.', 'danger'); return; }
    setBusy(`${p.id}${course}`);
    try { await uploadStaffCertificate({ orgId, profileId: p.id, course, uploaderId: userId, picked }); toast('Certificado enviado.'); refresh(); }
    catch (e) { toast(toFriendlyError(e).message, 'danger'); } finally { setBusy(null); }
  };
  const Row = ({ p }: { p: CobStatus }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, flexWrap: 'wrap' }}>
      <T variant="body" style={{ flex: 1, minWidth: 140 }}>{p.name}</T>
      {COB_COURSES.map((c) => p.done[c.key]
        ? <Badge key={c.key} label={`✓ ${c.label.split(' ')[0]}`} tone="success" />
        : p.who === 'equipe'
          ? <Button key={c.key} kind="outline" icon="cloud-upload-outline" title={c.label.split(' ')[0]} loading={busy === `${p.id}${c.key}`} onPress={() => upload(p, c.key)} />
          : <Badge key={c.key} label={`Falta ${c.label.split(' ')[0]}`} tone="warning" />)}
    </View>
  );
  return (
    <View style={{ gap: 12 }}>
      <T variant="small">Todos os beneficiários fazem os 2 cursos gratuitos do COB (EAD, 5 h cada). O atleta (ou o responsável) envia o certificado pelo app em Documentos; o certificado da equipe é enviado aqui.</T>
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL(COB_URL)}><T variant="small" color={colors.primary}>Abrir os cursos no site do COB ›</T></Pressable>
      <Card style={{ gap: 4 }}>
        <T variant="body" style={{ fontWeight: '700' }}>Atletas: {a.complete} de {a.total} completos ({a.pct}%)</T>
        {data.athletes.map((p) => <Row key={p.id} p={p} />)}
        {data.athletes.length === 0 && <T variant="small">Nenhum beneficiário no projeto.</T>}
      </Card>
      <Card style={{ gap: 4 }}>
        <T variant="body" style={{ fontWeight: '700' }}>Equipe: {s.complete} de {s.total} completos ({s.pct}%)</T>
        {data.staff.map((p) => <Row key={p.id} p={p} />)}
      </Card>
    </View>
  );
}

export function MidiaTab({ media, loading, orgId, projectId, userId, refresh }: { media: Media[]; loading: boolean; orgId: string; projectId: string; userId: string; refresh: () => void }) {
  const [f, setF] = useState<{ kind: MediaKind; description: string; link: string; date: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  const save = async (withFile: boolean) => {
    if (!f) return;
    const picked = withFile ? await pickIdDocument() : null;
    if (withFile && !picked) return;
    if (!withFile && !f.link.trim()) { toast('Informe o link ou envie uma foto.', 'danger'); return; }
    setBusy(true);
    try {
      const d = parseBrDate(f.date);
      await addMedia({ orgId, projectId, uploaderId: userId, kind: f.kind, description: f.description, link: f.link, takenOn: d ? toIsoDate(d) : null, picked });
      toast('Registro de mídia salvo.'); setF(null); refresh();
    } catch (e) { toast(toFriendlyError(e).message, 'danger'); } finally { setBusy(false); }
  };
  return (
    <View style={{ gap: 12 }}>
      <T variant="small">Fotos de placas, banners, uniformes e posts com a marca do Governo Federal e do Revelar Talentos, como pede o plano de mídia. Vão para o RCO e para o pacote de anexos. Fotos são reduzidas antes de enviar.</T>
      {!f && <Button icon="add" title="Adicionar registro de mídia" onPress={() => setF({ kind: 'placa', description: '', link: '', date: new Date().toLocaleDateString('pt-BR') })} />}
      {f && (
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {MEDIA_KINDS.map((k) => <Chip key={k.key} label={k.label} selected={f.kind === k.key} onPress={() => setF({ ...f, kind: k.key })} />)}
          </View>
          <Field label="Descrição" value={f.description} onChangeText={(t) => setF({ ...f, description: t })} placeholder="Ex.: placa na entrada do ginásio" />
          <Field label="Link (rede social ou matéria)" value={f.link} onChangeText={(t) => setF({ ...f, link: t })} autoCapitalize="none" />
          <DateField label="Data" mode="date" value={f.date} onChange={(t) => setF({ ...f, date: t })} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Button icon="camera-outline" title="Enviar foto" onPress={() => save(true)} loading={busy} />
            <Button kind="tonal" icon="link-outline" title="Salvar só o link" onPress={() => save(false)} disabled={busy} />
            <Button kind="outline" title="Cancelar" onPress={() => setF(null)} />
          </View>
        </Card>
      )}
      {media.length === 0 && !f && <Notice tone="info" text="Nenhum registro de mídia ainda." />}
      {media.map((m) => (
        <Card key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name={m.file_path ? 'image-outline' : 'link-outline'} size={22} />
          <View style={{ flex: 1 }}>
            <T variant="body" style={{ fontWeight: '700' }}>{MEDIA_KINDS.find((k) => k.key === m.kind)?.label}{m.description ? ` · ${m.description}` : ''}</T>
            <T variant="small">{br(m.taken_on)}{m.link ? ` · ${m.link}` : ''}</T>
          </View>
          <Button kind="ghost" icon="trash-outline" title="" onPress={() => deleteMedia(m).then(() => { toast('Registro apagado.'); refresh(); }).catch((e) => toast(toFriendlyError(e).message, 'danger'))} />
        </Card>
      ))}
    </View>
  );
}
