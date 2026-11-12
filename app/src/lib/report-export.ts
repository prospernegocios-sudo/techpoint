// Gera os arquivos do relatório no celular (PDF com fotos e planilha CSV) e abre o compartilhamento.
import { File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildRows, toCsv, toHtml, type ReportData } from './report';
import { PHOTO_BUCKET, supabase } from './supabase';

export type ReportParams = {
  orgId: string; teamIds: string[]; from: string; to: string; // datas "aaaa-mm-dd"
  project: { name: string; number?: string; proponent?: string };
};

export async function fetchReport(p: ReportParams): Promise<ReportData> {
  const { data, error } = await supabase.rpc('attendance_report', {
    p_org_id: p.orgId, p_team_ids: p.teamIds, p_from: p.from, p_to: p.to, p_project: p.project,
  });
  if (error) throw error;
  return data as ReportData;
}

const fileName = (data: ReportData, ext: string) =>
  `frequencia_${(data.project.name || 'projeto').replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40)}_${data.period.from}_a_${data.period.to}.${ext}`;

/** Baixa as fotos e reduz para miniaturas (o PDF fica leve). */
async function loadThumbs(paths: string[], onProgress: (done: number, total: number) => void): Promise<Record<string, string>> {
  const thumbs: Record<string, string> = {};
  if (paths.length === 0) return thumbs;
  const urls: Record<string, string> = {};
  for (let i = 0; i < paths.length; i += 100) {
    const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths.slice(i, i + 100), 600);
    data?.forEach((d) => { if (d.signedUrl && d.path) urls[d.path] = d.signedUrl; });
  }
  let done = 0;
  const queue = [...paths];
  const worker = async () => {
    while (queue.length) {
      const path = queue.shift()!;
      const url = urls[path];
      if (url) {
        let tmp: File | null = null;
        try {
          tmp = await File.downloadFileAsync(url, new File(Paths.cache, `rel-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`));
          const out = await ImageManipulator.manipulateAsync(tmp.uri, [{ resize: { width: 140 } }], {
            compress: 0.55, format: ImageManipulator.SaveFormat.JPEG, base64: true,
          });
          if (out.base64) thumbs[path] = `data:image/jpeg;base64,${out.base64}`;
        } catch {
          // foto apagada (prazo de guarda) ou falha de rede: o PDF mostra "foto indisponível"
        } finally {
          try { tmp?.delete(); } catch { /* ignora */ }
        }
      }
      onProgress(++done, paths.length);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return thumbs;
}

export async function exportPdf(data: ReportData, onProgress: (msg: string) => void) {
  const rows = buildRows(data);
  const paths = [...new Set(rows.flatMap((r) => [r.checkIn?.photo_path, r.checkOut?.photo_path]).filter((x): x is string => Boolean(x)))];
  const thumbs = await loadThumbs(paths, (d, t) => onProgress(`Preparando fotos ${d} de ${t}...`));
  onProgress('Montando o PDF...');
  // A4 deitado (pontos).
  const { uri } = await Print.printToFileAsync({ html: toHtml(data, rows, thumbs), width: 842, height: 595, margins: { left: 24, right: 24, top: 24, bottom: 24 } });
  const target = new File(Paths.cache, fileName(data, 'pdf'));
  try { if (target.exists) target.delete(); } catch { /* ignora */ }
  new File(uri).move(target);
  await share(target.uri, 'application/pdf', 'com.adobe.pdf');
}

export async function exportCsv(data: ReportData) {
  const rows = buildRows(data);
  const target = new File(Paths.cache, fileName(data, 'csv'));
  try { if (target.exists) target.delete(); } catch { /* ignora */ }
  target.create();
  target.write(toCsv(data, rows));
  await share(target.uri, 'text/csv', 'public.comma-separated-values-text');
}

async function share(uri: string, mimeType: string, UTI: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Compartilhamento indisponível neste celular.');
  await Sharing.shareAsync(uri, { mimeType, UTI, dialogTitle: 'Enviar relatório' });
}
