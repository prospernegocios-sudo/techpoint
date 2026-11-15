// Currículo esportivo do atleta (D78): itens digitados + o que o TechPoint já sabe (equipes e assiduidade).
import { useQuery } from '@tanstack/react-query';
import { richToHtml } from './rich';
import { supabase } from './supabase';

export type CvKind = 'clube' | 'competicao' | 'titulo' | 'premio' | 'selecao' | 'curso' | 'outro';
export const CV_KINDS: { key: CvKind; label: string; icon: string }[] = [
  { key: 'clube', label: 'Clube ou equipe', icon: '🏐' },
  { key: 'competicao', label: 'Competição', icon: '🏟️' },
  { key: 'titulo', label: 'Título ou prêmio', icon: '🏆' },
  { key: 'premio', label: 'Prêmio individual', icon: '🥇' },
  { key: 'selecao', label: 'Seleção', icon: '⭐' },
  { key: 'curso', label: 'Curso ou camp', icon: '📘' },
  { key: 'outro', label: 'Outro', icon: '•' },
];
export const cvKindLabel = (k: string) => CV_KINDS.find((c) => c.key === k)?.label ?? 'Outro';
export const cvKindIcon = (k: string) => CV_KINDS.find((c) => c.key === k)?.icon ?? '•';

export type CvEntry = {
  id: string; kind: CvKind; title: string; institution: string | null; category: string | null; location: string | null;
  started_on: string; ended_on: string | null; description: string | null; verified: boolean; verified_by_org: string | null;
  result?: string | null;
};
export type Cv = {
  athlete_id: string; full_name: string; age: number; org: string | null;
  modality: string | null; position: string | null; sport_started_on: string | null;
  body: { height_cm: number | null; weight_kg: number | null; dominant_hand: string | null; show_in_cv: boolean } | null;
  teams: { name: string; category: string | null; since: string }[];
  attendance_12m: { events: number; present: number; pct: number | null };
  trainings_total?: number; first_training?: string | null;
  entries: CvEntry[];
  profile?: CvProfile | null;
};
export type CvReference = { name: string; role?: string | null; phone?: string | null };
export type CvProfile = {
  headline: string | null; about: string | null; about_align?: 'left' | 'justify' | 'center'; goals: string[]; goals_done?: string[]; goals_set_on?: Record<string, string>; photo_path: string | null; gallery: string[];
  city: string | null; show_contacts: boolean; contact_phone: string | null; contact_email: string | null; instagram: string | null;
  references: CvReference[];
};
export type CvImages = { photo: string | null; gallery: string[] };

/** Links temporários das fotos do currículo (funcionam também na página pública do link). */
export async function cvImageUrls(cv: Cv): Promise<CvImages> {
  const paths = [cv.profile?.photo_path, ...(cv.profile?.gallery ?? [])].filter((x): x is string => Boolean(x));
  if (!paths.length) return { photo: null, gallery: [] };
  const { data } = await supabase.storage.from('athlete-cv').createSignedUrls(paths, 3600);
  const map = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return { photo: cv.profile?.photo_path ? map.get(cv.profile.photo_path) ?? null : null, gallery: (cv.profile?.gallery ?? []).map((g) => map.get(g)).filter((x): x is string => Boolean(x)) };
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/** "2019-03-01" → "mar/2019" */
export function monthLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m] = iso.split('-').map(Number);
  return `${MESES[m - 1]}/${y}`;
}
/** "03/2019" → "2019-03-01" (ou null se inválido) */
export function parseMonthYear(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const mm = Number(m[1]), yy = Number(m[2]);
  if (mm < 1 || mm > 12 || yy < 1950 || yy > new Date().getFullYear() + 1) return null;
  return `${yy}-${String(mm).padStart(2, '0')}-01`;
}
export const toMonthYear = (iso: string | null | undefined) => (iso ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
export function maskMonthYear(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 6);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}
/** Tempo de esporte: "6 anos e 8 meses" */
export function sportTime(startIso: string | null | undefined, today = new Date()): string {
  if (!startIso) return '';
  const [y, m] = startIso.split('-').map(Number);
  let months = (today.getFullYear() - y) * 12 + (today.getMonth() + 1 - m);
  if (months < 0) months = 0;
  const yrs = Math.floor(months / 12), mo = months % 12;
  const parts = [yrs ? `${yrs} ${yrs === 1 ? 'ano' : 'anos'}` : '', mo ? `${mo} ${mo === 1 ? 'mês' : 'meses'}` : ''].filter(Boolean);
  return parts.length ? parts.join(' e ') : 'menos de 1 mês';
}
export const handLabel = (h: string | null | undefined) => (h === 'direita' ? 'Destro' : h === 'esquerda' ? 'Canhoto' : h === 'ambas' ? 'Ambidestro' : '');

export function useAthleteCv(athleteId: string | undefined) {
  return useQuery({
    queryKey: ['cv', athleteId],
    enabled: Boolean(athleteId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('athlete_cv', { p_athlete_id: athleteId! });
      if (error) throw error;
      return data as Cv;
    },
  });
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Currículo em PDF (A4 retrato), no estilo do modelo do dono do produto: coluna lateral com foto,
 *  contatos, sobre mim, metas e prêmios; à direita nome, experiência, competições, fotos e referências.
 *  É do atleta (white label do atleta): sem a marca da entidade, só "atualmente em ...". */
export function cvHtml(cv: Cv, img: CvImages = { photo: null, gallery: [] }): string {
  const p = cv.profile;
  const period = (e: CvEntry) => `${monthLabel(e.started_on)}${e.ended_on ? ` – ${monthLabel(e.ended_on)}` : e.kind === 'clube' ? ' – atual' : ''}`;
  const clubs = cv.entries.filter((e) => e.kind === 'clube');
  const comps = cv.entries.filter((e) => ['competicao', 'titulo', 'selecao', 'curso', 'outro'].includes(e.kind));
  const awards = cv.entries.filter((e) => e.kind === 'premio');
  const headline = p?.headline || [cv.modality, cv.position].filter(Boolean).join(' · ');
  const body = cv.body && (cv.body.height_cm || cv.body.weight_kg || cv.body.dominant_hand)
    ? [cv.body.height_cm ? `${cv.body.height_cm} cm` : '', cv.body.weight_kg ? `${String(cv.body.weight_kg).replace('.', ',')} kg` : '', handLabel(cv.body.dominant_hand)].filter(Boolean).join(' · ') : '';
  const contacts = [p?.contact_phone, p?.contact_email, p?.instagram, p?.city].filter(Boolean);
  const nums = [
    cv.trainings_total ? `<div><b>${cv.trainings_total}</b><span>treinos com prova</span></div>` : '',
    cv.attendance_12m.pct != null ? `<div><b>${String(cv.attendance_12m.pct).replace('.', ',')}%</b><span>assiduidade 12 meses</span></div>` : '',
    cv.sport_started_on ? `<div><b>${esc(sportTime(cv.sport_started_on))}</b><span>no esporte</span></div>` : '',
  ].join('');
  const item = (e: CvEntry) => `<div class="it"><div class="t">${esc(e.title)}${e.category ? ` · ${esc(e.category)}` : ''}</div>
    <div class="d">${esc(period(e))}${e.institution ? ` · ${esc(e.institution)}` : ''}${e.location ? ` · ${esc(e.location)}` : ''}</div>
    ${e.result ? `<div class="r">Conquista: ${esc(e.result)}</div>` : ''}${e.description ? `<div class="d">${esc(e.description)}</div>` : ''}
    ${e.verified ? `<div class="ok">✓ Confirmado por ${esc(e.verified_by_org ?? 'entidade')}</div>` : ''}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#1E2433;margin:0;font-size:10.5pt}
  .page{display:flex;min-height:100%}
  .side{width:34%;background:#1E2B4A;color:#EEF1F7;padding:26px 20px}
  .photo{width:100%;aspect-ratio:4/5;object-fit:cover;border:6px solid #fff;display:block;background:#2D3B5E}
  .side h3{color:#E9C46A;font-size:11pt;letter-spacing:1.5px;text-transform:uppercase;margin:20px 0 8px;border-bottom:1px solid #E9C46A55;padding-bottom:4px}
  .side p,.side li{font-size:9.5pt;line-height:1.45;margin:0 0 4px} .side ul{padding-left:16px;margin:0}
  .main{width:66%;padding:0 0 24px}
  .band{background:#E9C46A;padding:26px 28px;margin-top:46px}
  .band h1{margin:0;font-size:26pt;letter-spacing:2px;color:#1E2433;text-transform:uppercase}
  .band .h{letter-spacing:3px;text-transform:uppercase;font-size:10pt;margin-top:4px}
  .body{padding:8px 28px}
  h2{font-size:13pt;color:#1E2B4A;border-bottom:2px solid #E9C46A;padding-bottom:3px;margin:18px 0 8px}
  .it{margin:0 0 8px;page-break-inside:avoid} .it .t{font-weight:bold} .it .d{color:#5A6275;font-size:9.5pt} .it .r{color:#1E2B4A;font-size:9.5pt}
  .ok{color:#2A7F62;font-size:8.5pt;font-weight:bold}
  .nums{display:flex;gap:10px;margin-top:12px} .nums div{flex:1;border:1px solid #E3E6EE;border-radius:8px;padding:6px 8px}
  .nums b{display:block;font-size:13pt;color:#1E2B4A} .nums span{font-size:8.5pt;color:#5A6275}
  .gal{display:flex;flex-wrap:wrap;gap:6px} .gal img{width:32%;aspect-ratio:4/3;object-fit:cover;border-radius:4px}
  .refs{display:flex;gap:20px;flex-wrap:wrap} .refs div{min-width:40%} .refs b{display:block}
  .foot{font-size:7.5pt;color:#8A90A0;padding:10px 28px}
  </style></head><body><div class="page">
  <div class="side">
    ${img.photo ? `<img class="photo" src="${esc(img.photo)}">` : ''}
    ${contacts.length ? `<h3>Contato</h3>${contacts.map((c) => `<p>${esc(c)}</p>`).join('')}` : ''}
    ${p?.about ? `<h3>Sobre mim</h3><div style="text-align:${p.about_align ?? 'justify'};font-size:9.5pt;line-height:1.45">${richToHtml(p.about, esc)}</div>` : ''}
    ${p?.goals?.length ? `<h3>Metas</h3><ul style="list-style:none;padding-left:0">${p.goals.map((g) => `<li>${(p.goals_done ?? []).includes(g) ? '<span style="color:#4CC38A;font-weight:bold">✓</span>' : '○'} ${esc(g)}${p.goals_set_on?.[g] ? ` <span style="opacity:.7;font-size:8pt">(${p.goals_set_on[g].slice(8, 10)}/${p.goals_set_on[g].slice(5, 7)}/${p.goals_set_on[g].slice(0, 4)})</span>` : ''}</li>`).join('')}</ul>` : ''}
    ${awards.length ? `<h3>Prêmios individuais</h3><ul>${awards.map((a) => `<li>${esc(a.title)}${a.institution ? ` – ${esc(a.institution)}` : ''} – ${a.started_on.slice(0, 4)}</li>`).join('')}</ul>` : ''}
  </div>
  <div class="main">
    <div class="band"><h1>${esc(cv.full_name)}</h1><div class="h">${esc(headline || 'Atleta')}</div></div>
    <div class="body">
      <div class="d" style="color:#5A6275;margin-top:6px">${esc([`${cv.age} anos`, body, cv.org ? `atualmente em ${cv.org}` : ''].filter(Boolean).join(' · '))}</div>
      ${nums ? `<div class="nums">${nums}</div>` : ''}
      ${clubs.length ? `<h2>Experiência</h2>${clubs.map(item).join('')}` : ''}
      ${comps.length ? `<h2>Competições</h2>${comps.map(item).join('')}` : ''}
      ${img.gallery.length ? `<h2>Fotos</h2><div class="gal">${img.gallery.map((g) => `<img src="${esc(g)}">`).join('')}</div>` : ''}
      ${p?.references?.length ? `<h2>Referências</h2><div class="refs">${p.references.map((r) => `<div><b>${esc(r.name)}</b>${esc(r.role ?? '')}<br>${esc(r.phone ?? '')}</div>`).join('')}</div>` : ''}
    </div>
    <div class="foot">Atualizado em ${new Date().toLocaleDateString('pt-BR')}. Treinos e assiduidade registrados com GPS, foto e hora do servidor. Feito com TechPoint.</div>
  </div></div></body></html>`;
}
