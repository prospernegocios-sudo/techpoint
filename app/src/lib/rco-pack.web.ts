// Site: pacote ZIP com tudo para subir no Transferegov.br (aba "Prestação de Contas" > "Anexos"):
// RCO e folha de ponto em Word, comprovantes por etapa, fotos do plano de mídia e certificados do COB.
import { Packer } from 'docx';
import { zipSync } from 'fflate';
import { DOCS_BUCKET } from './documents';
import { fileKindLabel } from './execution';
import { ORG_DOCS_BUCKET } from './habilitation';
import { stageLabel } from './proposal';
import { buildRcoDoc, type RcoCtx } from './rco-doc';
import { buildPointSheetDoc, type CobStatus, type Media, type PointRow } from './staff';
import { supabase } from './supabase';

export type PackInput = {
  rco: RcoCtx; points: { rows: PointRow[]; from: string; to: string; orgName: string };
  media: Media[]; cob: { athletes: CobStatus[]; staff: CobStatus[] };
};
const safe = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 60);
const ext = (p: string) => p.split('.').pop() ?? 'bin';

async function grab(bucket: string, paths: string[]): Promise<Record<string, Uint8Array>> {
  const out: Record<string, Uint8Array> = {};
  for (let i = 0; i < paths.length; i += 100) {
    const { data } = await supabase.storage.from(bucket).createSignedUrls(paths.slice(i, i + 100), 600);
    for (const d of data ?? []) {
      if (!d.signedUrl || !d.path) continue;
      try { out[d.path] = new Uint8Array(await (await fetch(d.signedUrl)).arrayBuffer()); } catch { /* arquivo removido: fica de fora */ }
    }
  }
  return out;
}

export async function downloadRcoPack(p: PackInput, onProgress?: (t: string) => void) {
  const files: Record<string, Uint8Array> = {};
  onProgress?.('Gerando RCO e folha de ponto...');
  files['01-RCO.docx'] = new Uint8Array(await (await Packer.toBlob(buildRcoDoc(p.rco))).arrayBuffer());
  files['02-Folha-de-ponto.docx'] = new Uint8Array(await (await Packer.toBlob(buildPointSheetDoc({ orgName: p.points.orgName, projectName: p.rco.project.name, from: p.points.from, to: p.points.to, rows: p.points.rows }))).arrayBuffer());

  onProgress?.('Baixando comprovantes...');
  const exp = p.rco.expenses.flatMap((e) => (e.expense_files ?? []).map((f) => ({ e, f })));
  const orgFiles = await grab(ORG_DOCS_BUCKET, [
    ...exp.map((x) => x.f.file_path), ...p.media.filter((m) => m.file_path).map((m) => m.file_path!),
    ...p.cob.staff.flatMap((s) => [s.done.cob_antirracismo, s.done.cob_manipulacao]).filter((x): x is string => Boolean(x)),
  ]);
  const stages = [...new Set(p.rco.items.map((i) => i.stage))];
  exp.forEach(({ e, f }, k) => {
    const item = p.rco.items.find((i) => i.id === e.item_id);
    const n = stages.indexOf(item?.stage ?? 'outro') + 1;
    const dir = `03-Comprovantes/${String(n).padStart(2, '0')}-${safe(stageLabel(item?.stage ?? 'outro'))}/${safe(item?.description ?? 'item')}`;
    const data = orgFiles[f.file_path];
    if (data) files[`${dir}/${e.spent_on}_${safe(e.supplier)}_${safe(fileKindLabel(f.kind))}_${k + 1}.${ext(f.file_path)}`] = data;
  });
  p.media.forEach((m, k) => {
    const data = m.file_path ? orgFiles[m.file_path] : null;
    if (data) files[`04-Plano-de-midia/${String(k + 1).padStart(2, '0')}_${safe(m.kind)}_${safe(m.description ?? '')}.${ext(m.file_path!)}`] = data;
  });
  const links = p.media.filter((m) => m.link).map((m) => `${m.kind}: ${m.description ?? ''} – ${m.link}`).join('\r\n');
  if (links) files['04-Plano-de-midia/links.txt'] = new TextEncoder().encode(links);

  onProgress?.('Baixando certificados do COB...');
  p.cob.staff.forEach((s) => (['cob_antirracismo', 'cob_manipulacao'] as const).forEach((c) => {
    const path = s.done[c]; const data = path ? orgFiles[path] : null;
    if (data) files[`05-Cursos-COB/Equipe/${safe(s.name)}_${c === 'cob_antirracismo' ? 'Antirracismo' : 'Manipulacao'}.${ext(path!)}`] = data;
  }));
  const athletePaths = p.cob.athletes.flatMap((a) => [a.done.cob_antirracismo, a.done.cob_manipulacao]).filter((x): x is string => Boolean(x));
  const athFiles = athletePaths.length ? await grab(DOCS_BUCKET, athletePaths) : {};
  p.cob.athletes.forEach((a) => (['cob_antirracismo', 'cob_manipulacao'] as const).forEach((c) => {
    const path = a.done[c]; const data = path ? athFiles[path] : null;
    if (data) files[`05-Cursos-COB/Atletas/${safe(a.name)}_${c === 'cob_antirracismo' ? 'Antirracismo' : 'Manipulacao'}.${ext(path!)}`] = data;
  }));

  onProgress?.('Compactando...');
  const zip = zipSync(files, { level: 6 });
  const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url; a.download = `Prestacao-de-contas_${safe(p.rco.project.name)}.zip`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return Object.keys(files).length;
}
