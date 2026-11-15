// Currículo esportivo do atleta (D78): itens digitados + o que o TechPoint já sabe (equipes e assiduidade).
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type CvKind = 'clube' | 'competicao' | 'titulo' | 'selecao' | 'curso' | 'outro';
export const CV_KINDS: { key: CvKind; label: string; icon: string }[] = [
  { key: 'clube', label: 'Clube ou equipe', icon: '🏐' },
  { key: 'competicao', label: 'Competição', icon: '🏟️' },
  { key: 'titulo', label: 'Título ou prêmio', icon: '🏆' },
  { key: 'selecao', label: 'Seleção', icon: '⭐' },
  { key: 'curso', label: 'Curso ou camp', icon: '📘' },
  { key: 'outro', label: 'Outro', icon: '•' },
];
export const cvKindLabel = (k: string) => CV_KINDS.find((c) => c.key === k)?.label ?? 'Outro';
export const cvKindIcon = (k: string) => CV_KINDS.find((c) => c.key === k)?.icon ?? '•';

export type CvEntry = {
  id: string; kind: CvKind; title: string; institution: string | null; category: string | null; location: string | null;
  started_on: string; ended_on: string | null; description: string | null; verified: boolean; verified_by_org: string | null;
};
export type Cv = {
  athlete_id: string; full_name: string; age: number; org: string | null;
  modality: string | null; position: string | null; sport_started_on: string | null;
  body: { height_cm: number | null; weight_kg: number | null; dominant_hand: string | null; show_in_cv: boolean } | null;
  teams: { name: string; category: string | null; since: string }[];
  attendance_12m: { events: number; present: number; pct: number | null };
  trainings_total?: number; first_training?: string | null;
  entries: CvEntry[];
};

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

/** HTML do currículo para PDF (A4 retrato). */
export function cvHtml(cv: Cv): string {
  const period = (e: CvEntry) => `${monthLabel(e.started_on)}${e.ended_on ? ` – ${monthLabel(e.ended_on)}` : e.kind === 'clube' ? ' – atual' : ''}`;
  const body = cv.body && (cv.body.height_cm || cv.body.weight_kg || cv.body.dominant_hand)
    ? `<div class="chips">${cv.body.height_cm ? `<span>${esc(cv.body.height_cm)} cm</span>` : ''}${cv.body.weight_kg ? `<span>${esc(String(cv.body.weight_kg).replace('.', ','))} kg</span>` : ''}${cv.body.dominant_hand ? `<span>${esc(handLabel(cv.body.dominant_hand))}</span>` : ''}</div>` : '';
  const att = cv.attendance_12m.pct != null ? `<div class="stat"><b>${String(cv.attendance_12m.pct).replace('.', ',')}%</b><small>assiduidade nos treinos (12 meses, registrada com GPS e foto)</small></div>` : '';
  const start = cv.sport_started_on ? `<div class="stat"><b>${esc(sportTime(cv.sport_started_on))}</b><small>no esporte, desde ${monthLabel(cv.sport_started_on)}</small></div>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;color:#14213D;margin:0;font-size:11pt}
  .top{background:#0B2A5C;color:#F5F7F0;padding:22px 26px;border-radius:12px}
  .top h1{margin:0;font-size:24pt}.top p{margin:4px 0 0;color:#C9D6EA}.brand{float:right;font-weight:bold}.brand span{color:#C6F432}
  .chips span{display:inline-block;background:#C6F432;color:#14213D;border-radius:10px;padding:2px 10px;margin:8px 6px 0 0;font-weight:bold;font-size:10pt}
  .stats{display:flex;gap:12px;margin:14px 0}.stat{flex:1;border:1px solid #C9D6EA;border-radius:10px;padding:10px}.stat b{display:block;font-size:16pt;color:#0E7C86}.stat small{color:#4A5568}
  h2{color:#0B2A5C;border-left:6px solid #C6F432;padding-left:8px;font-size:13pt;margin:18px 0 8px}
  .item{border-left:3px solid #C9D6EA;padding:4px 0 8px 12px;margin-left:6px;page-break-inside:avoid}
  .item .when{color:#0E7C86;font-weight:bold;font-size:10pt}.item .t{font-weight:bold;font-size:12pt}.item .s{color:#4A5568}
  .ok{color:#0E7C86;font-size:9pt;font-weight:bold}.foot{margin-top:20px;font-size:8.5pt;color:#4A5568;border-top:1px solid #C9D6EA;padding-top:6px}
  </style></head><body>
  <div class="top"><div class="brand">Tech<span>Point</span></div><h1>${esc(cv.full_name)}</h1>
  <p>${esc([cv.modality, cv.position, `${cv.age} anos`, cv.org].filter(Boolean).join(' · '))}</p>${body}</div>
  <div class="stats">${start}${att}${cv.trainings_total ? `<div class="stat"><b>${cv.trainings_total}</b><small>treinos registrados com prova${cv.first_training ? ` desde ${monthLabel(cv.first_training)}` : ''}</small></div>` : ''}<div class="stat"><b>${cv.entries.filter((e) => e.verified).length}</b><small>itens confirmados pela entidade</small></div></div>
  ${cv.teams.length ? `<h2>Equipes</h2>${cv.teams.map((t) => `<div class="item"><div class="when">desde ${monthLabel(t.since)}</div><div class="t">${esc(t.name)}</div><div class="s">${esc(t.category ?? '')}</div></div>`).join('')}` : ''}
  <h2>Trajetória</h2>
  ${cv.entries.length ? cv.entries.map((e) => `<div class="item"><div class="when">${period(e)} · ${esc(cvKindLabel(e.kind))}</div><div class="t">${esc(e.title)}</div>
    <div class="s">${esc([e.institution, e.category, e.location].filter(Boolean).join(' · '))}</div>${e.description ? `<div>${esc(e.description)}</div>` : ''}
    ${e.verified ? `<div class="ok">✓ Confirmado por ${esc(e.verified_by_org ?? 'entidade')}</div>` : ''}</div>`).join('') : '<p class="s">Nenhum item cadastrado.</p>'}
  <div class="foot">Currículo esportivo atualizado em ${new Date().toLocaleDateString('pt-BR')}. Assiduidade calculada a partir de check-ins com GPS, foto e hora do servidor. Itens “confirmados” foram validados pela equipe da entidade.</div>
  </body></html>`;
}
