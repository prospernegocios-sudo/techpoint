// Versão para o navegador (site): o PDF sai pela janela de impressão ("Salvar como PDF")
// e a planilha é baixada direto. As fotos entram por links temporários (10 min).
import { buildProjectRows, buildRows, toCsv, toHtml, toProjectHtml, type ProjectSnapshot, type ReportData } from './report';
import { PHOTO_BUCKET, supabase } from './supabase';

export type ReportParams = {
  orgId: string; teamIds: string[]; from: string; to: string;
  project: { name: string; number?: string; proponent?: string };
};

export async function fetchReport(p: ReportParams): Promise<ReportData> {
  const { data, error } = await supabase.rpc('attendance_report', {
    p_org_id: p.orgId, p_team_ids: p.teamIds, p_from: p.from, p_to: p.to, p_project: p.project,
  });
  if (error) throw error;
  return data as ReportData;
}

async function photoUrls(paths: string[]): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};
  for (let i = 0; i < paths.length; i += 100) {
    const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths.slice(i, i + 100), 600);
    data?.forEach((d) => { if (d.signedUrl && d.path) urls[d.path] = d.signedUrl; });
  }
  return urls;
}

const photoPaths = (rows: ReturnType<typeof buildRows>) =>
  [...new Set(rows.flatMap((r) => [r.checkIn?.photo_path, r.checkOut?.photo_path]).filter((x): x is string => Boolean(x)))];

/** Abre a impressão do navegador num quadro escondido, depois que as fotos carregam. */
async function printHtml(html: string, title: string) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html.replace('<head>', `<head><title>${title}</title><style>@page { size: A4 landscape; margin: 10mm; }</style>`));
  doc.close();
  await Promise.all(Array.from(doc.images).map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
  setTimeout(() => frame.remove(), 60_000);
}

const slug = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40);

async function logoUrl(orgId: string): Promise<string | null> {
  const { data } = await supabase.from('organizations').select('logo_path').eq('id', orgId).maybeSingle();
  return data?.logo_path ? supabase.storage.from('org-logos').getPublicUrl(data.logo_path).data.publicUrl : null;
}

export async function exportPdf(input: ReportData, onProgress: (msg: string) => void) {
  const data = { ...input, logo_url: await logoUrl(input.org.id) };
  const rows = buildRows(data);
  onProgress('Preparando as fotos...');
  const thumbs = await photoUrls(photoPaths(rows));
  onProgress('Abrindo a impressão: escolha "Salvar como PDF".');
  await printHtml(toHtml(data, rows, thumbs), `frequencia_${slug(data.project.name ?? 'projeto')}`);
}

export async function exportCsv(data: ReportData) {
  const blob = new Blob([toCsv(data, buildRows(data))], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `frequencia_${slug(data.project.name ?? 'projeto')}_${data.period.from}_a_${data.period.to}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export async function exportProjectPdf(input: ProjectSnapshot, sha256: string, onProgress: (msg: string) => void) {
  const snap = { ...input, logo_url: await logoUrl(input.org.id) };
  const rows = buildProjectRows(snap);
  onProgress('Preparando as fotos...');
  const thumbs = await photoUrls(photoPaths(rows));
  onProgress('Abrindo a impressão: escolha "Salvar como PDF".');
  const n = snap.issue ? `relatorio-${snap.issue.number}${snap.issue.version > 1 ? `-v${snap.issue.version}` : ''}` : 'previa';
  await printHtml(toProjectHtml(snap, sha256, thumbs), `${n}_${slug(snap.project.name)}`);
}
