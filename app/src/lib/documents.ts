// Documentos do atleta (atestado, identidade...). Regras de acesso no banco:
// equipe da entidade, o próprio atleta e os responsáveis ligados a ele.
import { useQuery } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { Linking, Platform } from 'react-native';
import { supabase } from './supabase';

export const DOCS_BUCKET = 'athlete-docs';
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

export type DocKind = 'atestado' | 'identidade' | 'cpf' | 'comprovante_residencia' | 'autorizacao' | 'outro';
/** Tipos que aparecem para envio (D94). "Único": o novo substitui o anterior, que vira histórico. */
export const DOC_KINDS: { key: DocKind; label: string; single: boolean; hint: string }[] = [
  { key: 'atestado', label: 'Atestado médico', single: false, hint: 'Sem limite. Cada atestado fica registrado com a validade.' },
  { key: 'identidade', label: 'Documento de identidade', single: true, hint: 'RG, CNH ou certidão. O novo substitui o atual.' },
  { key: 'comprovante_residencia', label: 'Comprovante de residência', single: true, hint: 'O novo substitui o atual.' },
  { key: 'autorizacao', label: 'Autorização assinada', single: false, hint: 'Ex.: autorização de viagem de uma competição.' },
  { key: 'outro', label: 'Outro', single: false, hint: 'Qualquer outro documento.' },
];
const LEGACY: Record<string, string> = { cpf: 'CPF' };
export const kindLabel = (k: string) => DOC_KINDS.find((d) => d.key === k)?.label ?? LEGACY[k] ?? 'Documento';

export type AthleteDoc = {
  id: string; org_id: string; athlete_id: string; kind: DocKind; title: string | null; file_path: string;
  mime_type: string; size_bytes: number; valid_until: string | null; uploaded_by: string | null; created_at: string;
  superseded_at?: string | null;
};

const MIME_BY_EXT: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

/** Tipo do arquivo pelo que o seletor informa ou pela extensão. Só PDF, PNG e JPG. */
export function docMime(name: string | null | undefined, mime: string | null | undefined): string | null {
  const m = (mime ?? '').toLowerCase();
  if (Object.values(MIME_BY_EXT).includes(m)) return m;
  const ext = (name ?? '').split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? null;
}
const EXT_BY_MIME: Record<string, string> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' };

/** Situação do documento com validade (ex.: atestado). */
export function validity(validUntil: string | null, today = new Date()): 'ok' | 'soon' | 'expired' | null {
  if (!validUntil) return null;
  const end = new Date(validUntil + 'T23:59:59');
  const days = (end.getTime() - today.getTime()) / 86400_000;
  return days < 0 ? 'expired' : days <= 30 ? 'soon' : 'ok';
}

export function useAthleteDocuments(athleteId: string | undefined) {
  return useQuery({
    queryKey: ['athlete-docs', athleteId],
    enabled: Boolean(athleteId),
    queryFn: async () => {
      const { data, error } = await supabase.from('athlete_documents')
        .select('id, org_id, athlete_id, kind, title, file_path, mime_type, size_bytes, valid_until, uploaded_by, created_at, superseded_at')
        .eq('athlete_id', athleteId!).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AthleteDoc[];
    },
  });
}

export type PickedFile = { uri: string; name: string; mime: string; size: number; file?: Blob };

export async function uploadAthleteDocument(p: {
  orgId: string; athleteId: string; uploaderId: string; kind: DocKind; title?: string; validUntil?: string | null; picked: PickedFile;
}) {
  const ext = EXT_BY_MIME[p.picked.mime] ?? 'bin';
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `${p.orgId}/${p.athleteId}/${p.kind}-${Date.now()}-${rand}.${ext}`;
  // No navegador o seletor entrega o arquivo pronto; no celular lemos pelo endereço local.
  const bytes = Platform.OS === 'web' && p.picked.file ? p.picked.file : await new File(p.picked.uri).arrayBuffer();
  const { error: upErr } = await supabase.storage.from(DOCS_BUCKET).upload(path, bytes, { contentType: p.picked.mime, upsert: false });
  if (upErr) throw upErr;
  const { error } = await supabase.from('athlete_documents').insert({
    org_id: p.orgId, athlete_id: p.athleteId, kind: p.kind, title: p.title?.trim() || null, file_path: path,
    mime_type: p.picked.mime, size_bytes: p.picked.size || 1, valid_until: p.validUntil ?? null, uploaded_by: p.uploaderId,
  });
  if (error) {
    await supabase.storage.from(DOCS_BUCKET).remove([path]); // não deixa arquivo solto
    throw error;
  }
}

export async function openAthleteDocument(path: string) {
  const { data, error } = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(path, 120);
  if (error || !data?.signedUrl) throw error ?? new Error('Não foi possível abrir o documento.');
  if (Platform.OS === 'web') window.open(data.signedUrl, '_blank', 'noopener');
  else await Linking.openURL(data.signedUrl);
}

export async function deleteAthleteDocument(doc: AthleteDoc) {
  const { error } = await supabase.from('athlete_documents').delete().eq('id', doc.id);
  if (error) throw error;
  await supabase.storage.from(DOCS_BUCKET).remove([doc.file_path]);
}
