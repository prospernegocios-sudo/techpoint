// Leitor automático de currículo esportivo (D85, opção A, sem custo): lê texto colado ou extraído de PDF
// e monta os itens no padrão da plataforma. Tudo passa pela tela de revisão antes de salvar.
// Também lê o "formato simples" devolvido pelo assistente externo (opção B): uma linha por item,
// campos separados por "|": tipo | título | categoria | mês/ano | conquista | local.
import type { CvKind } from './cv';

export type DraftEntry = {
  kind: CvKind; title: string; institution: string | null; category: string | null; location: string | null;
  started_on: string | null; ended_on: string | null; result: string | null; description: string | null;
};
export type DraftReference = { name: string; role: string | null; phone: string | null };
export type ParsedCv = {
  name: string | null; headline: string | null; about: string | null; goals: string[];
  contacts: { phone: string | null; email: string | null; instagram: string | null; city: string | null };
  entries: DraftEntry[]; references: DraftReference[];
};

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const MONTHS: Record<string, number> = {
  janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, mar: 3, abril: 4, abr: 4, maio: 5, mai: 5, junho: 6, jun: 6,
  julho: 7, jul: 7, agosto: 8, ago: 8, setembro: 9, set: 9, outubro: 10, out: 10, novembro: 11, nov: 11, dezembro: 12, dez: 12,
};
const iso = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}-01`;

/** "Março, 2025", "mar/2025", "03/2025", "março de 2025" → "2025-03-01" */
export function parseDateLine(line: string): string | null {
  const s = strip(line).replace(/\s+/g, ' ');
  let m = /^([a-z]+)\.?\s*(?:,|\/|-|de)?\s*(\d{4})$/.exec(s);
  if (m && MONTHS[m[1]]) return iso(Number(m[2]), MONTHS[m[1]]);
  m = /^(\d{1,2})\s*[/.-]\s*(\d{4})$/.exec(s);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return iso(Number(m[2]), Number(m[1]));
  return null;
}

/** Padroniza a conquista: "Vice Campeões" → "Vice-campeão", "Segundo lugar" → "2º lugar". */
export function normalizeResult(r: string): string {
  const s = strip(r);
  if (/^vice/.test(s)) return 'Vice-campeão';
  if (/^campe/.test(s)) return 'Campeão';
  const ord: Record<string, number> = { primeiro: 1, segundo: 2, terceiro: 3, quarto: 4, quinto: 5, sexto: 6, setimo: 7, oitavo: 8 };
  const m = /^(primeiro|segundo|terceiro|quarto|quinto|sexto|setimo|oitavo|\d+)\s*(?:º|o|°)?\s*(lugar|colocado)?(.*)$/.exec(s);
  if (m) {
    const n = ord[m[1]] ?? Number(m[1]);
    const rest = r.split(/lugar|colocado/i).slice(1).join('').trim();
    return `${n}º lugar${rest ? ` ${rest}` : ''}`.trim();
  }
  return r.trim();
}

const HEADINGS: [RegExp, string][] = [
  [/^(sobre mim|sobre|perfil|resumo|apresentacao)$/, 'about'],
  [/^(metas( e projecoes)?|objetivos|projecoes|metas e objetivos)$/, 'goals'],
  [/^(premios( individuais)?|premiacoes( individuais)?|conquistas individuais|destaques)$/, 'awards'],
  [/^(experiencia|experiencias|clubes|trajetoria|historico)$/, 'exp'],
  [/^(competicoes|campeonatos|torneios|resultados|titulos)$/, 'comp'],
  [/^(referencias?|contatos de referencia)$/, 'refs'],
  [/^(fotos|galeria|contato|contatos|dados pessoais)$/, 'skip'],
];
const headingOf = (line: string) => HEADINGS.find(([re]) => re.test(strip(line).replace(/[:]/g, '')))?.[1] ?? null;

const titleCase = (s: string) =>
  /[a-zà-ú]/.test(s) ? s : s.toLowerCase().replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w) => w.toLowerCase());

function splitCategory(title: string): { title: string; category: string | null; extra: string | null } {
  let category: string | null = null, extra: string | null = null;
  let t = title;
  const paren = /\(([^)]*)\)/.exec(t);
  if (paren) {
    const sub = /sub\s*-?\s*(\d{1,2})/i.exec(paren[1]);
    if (sub) category = `Sub ${sub[1]}`;
    const rest = paren[1].replace(/sub\s*-?\s*\d{1,2}/i, '').replace(/[-–,]/g, ' ').trim();
    if (rest) extra = rest.charAt(0).toUpperCase() + rest.slice(1);
    t = t.replace(paren[0], '').trim();
  }
  const tail = /\s*[-–]\s*sub\s*-?\s*(\d{1,2})\s*$/i.exec(t);
  if (tail) { category = `Sub ${tail[1]}`; t = t.slice(0, tail.index).trim(); }
  return { title: t.replace(/\s*[-–]\s*$/, '').trim(), category, extra };
}

/** Referências: nome, função e telefone. Aceita duas lado a lado ("Ana Lima João Reis" / "Treinador Treinador"). */
function parseReferences(lines: string[]): DraftReference[] {
  const telRe = /(?:telefone|tel\.?|cel\.?|whatsapp)?\s*:?\s*(\+?\d[\d\s().-]{8,}\d)/gi;
  const twoCols = lines.some((l) => (l.match(telRe) ?? []).length >= 2);
  const cols: string[][] = twoCols ? [[], []] : [lines];
  if (twoCols) {
    for (const l of lines) {
      const tels = [...l.matchAll(telRe)];
      if (tels.length >= 2) { cols[0].push(tels[0][0]); cols[1].push(tels[1][0]); continue; }
      const w = l.split(' ');
      const half = Math.ceil(w.length / 2);
      cols[0].push(w.slice(0, half).join(' ')); cols[1].push(w.slice(half).join(' '));
    }
  }
  const refs: DraftReference[] = [];
  for (const col of cols) {
    let ref: DraftReference | null = null;
    for (const line of col) {
      const tel = /(\+?\d[\d\s().-]{8,}\d)/.exec(line);
      if (tel && ref) { ref.phone = tel[1].trim(); continue; }
      if (ref && !ref.role && line.split(' ').length <= 3) { ref.role = line; continue; }
      ref = { name: line, role: null, phone: null };
      refs.push(ref);
    }
  }
  return refs;
}

const KIND_WORDS: [RegExp, CvKind][] = [
  [/^(clube|equipe|time)/, 'clube'], [/^(compet|campeonato|torneio)/, 'competicao'], [/^(titulo|conquista)/, 'titulo'],
  [/^(premio|premiacao|destaque)/, 'premio'], [/^(selecao)/, 'selecao'], [/^(curso|camp|clinica)/, 'curso'],
];

function parsePipe(line: string): DraftEntry | null {
  const parts = line.split('|').map((p) => p.trim());
  if (parts.length < 3) return null;
  const kind = KIND_WORDS.find(([re]) => re.test(strip(parts[0])))?.[1] ?? 'outro';
  const date = parts[3] ? parseDateLine(parts[3]) ?? (/^\d{4}$/.test(parts[3]) ? iso(Number(parts[3]), 1) : null) : null;
  return {
    kind, title: parts[1], institution: null, category: parts[2] || null, location: parts[5] || null,
    started_on: date, ended_on: null, result: parts[4] ? normalizeResult(parts[4]) : null, description: null,
  };
}

const WORDS = ['jogador', 'jogadora', 'atleta', 'de', 'do', 'da', 'e', 'volei', 'voleibol', 'areia', 'praia', 'quadra', 'futebol', 'futsal',
  'basquete', 'handebol', 'tenis', 'beach', 'natacao', 'nadador', 'nadadora', 'levantador', 'levantadora', 'oposto', 'oposta', 'ponteiro',
  'ponteira', 'libero', 'central', 'defesa', 'ataque', 'goleiro', 'goleira', 'atacante', 'zagueiro', 'meia', 'lateral', 'ala', 'pivo',
  'armador', 'armadora', 'corredor', 'corredora', 'judoca', 'lutador', 'lutadora', 'ginasta', 'atletismo', 'surf', 'surfista'];
const ACCENT: Record<string, string> = { volei: 'vôlei', tenis: 'tênis', libero: 'líbero', natacao: 'natação', pivo: 'pivô' };
/** "JOGADORDEVOLEIDEAREIA" → "Jogador de vôlei de areia" (separa palavras conhecidas). */
export function segmentWords(raw: string): string {
  const s = strip(raw);
  const best: (string[] | null)[] = Array(s.length + 1).fill(null);
  best[0] = [];
  for (let i = 0; i < s.length; i++) {
    if (!best[i]) continue;
    for (const w of WORDS) if (s.startsWith(w, i) && (!best[i + w.length] || best[i + w.length]!.length > best[i]!.length + 1)) best[i + w.length] = [...best[i]!, w];
  }
  const words = best[s.length];
  if (!words) return titleCase(raw);
  const out = words.map((w) => ACCENT[w] ?? w).join(' ');
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export function parseCvText(text: string): ParsedCv {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const out: ParsedCv = { name: null, headline: null, about: null, goals: [], contacts: { phone: null, email: null, instagram: null, city: null }, entries: [], references: [] };
  const about: string[] = [];
  let section: string | null = null;
  let cur: DraftEntry | null = null;
  const seen = new Set<string>();
  const refLines: string[] = [];
  const push = () => {
    if (!cur) return;
    const key = `${strip(cur.title)}|${cur.institution ?? ""}|${cur.started_on}|${cur.category}`;
    if (!seen.has(key)) { seen.add(key); out.entries.push(cur); }
    cur = null;
  };

  for (const line of lines) {
    if (!line) continue;
    // Contatos (em qualquer lugar)
    const email = /[\w.+-]+@[\w-]+\.[\w.]+/.exec(line);
    if (email && line.split(' ').length <= 2) { out.contacts.email ??= email[0]; continue; }
    if (/^@[\w.]+$/.test(line)) { out.contacts.instagram ??= line; continue; }
    if (/^\+?[\d\s().-]{10,}$/.test(line) && section !== 'refs') { out.contacts.phone ??= line; continue; }
    if (/^[A-Za-zÀ-ú .]+ ?- ?[A-Z]{2}$/.test(line) && line.length <= 40) { out.contacts.city ??= line; continue; }
    // Letras espaçadas: "J O G A D O R D E V O L E I" → "Jogador de vôlei"
    if (/^([A-ZÀ-Ú] ){4,}[A-ZÀ-Ú]$/.test(line)) {
      if (!out.headline) out.headline = segmentWords(line.replace(/\s+/g, ''));
      continue;
    }
    const h = headingOf(line);
    if (h) { push(); section = h; continue; }
    // Nome: primeira linha toda em maiúsculas com 2+ palavras, antes de qualquer seção
    if (!out.name && /^[A-ZÀ-Ú]{2,}( [A-ZÀ-Ú]{2,}){1,3}$/.test(line) && line.length <= 40) { push(); out.name = titleCase(line); section = null; continue; }
    if (out.name && strip(line) === strip(out.name)) continue;

    if (section === 'about') { about.push(line); continue; }
    if (section === 'goals') { out.goals.push(line.replace(/^[•\-–*]\s*/, '')); continue; }
    if (section === 'refs') {
      // Duas referências lado a lado na mesma linha (layout em 2 colunas): guarda para separar no fim.
      refLines.push(line);
      continue;
    }
    if (section === 'skip') continue;

    if (line.includes('|')) { const p = parsePipe(line); if (p) { push(); out.entries.push(p); continue; } }

    const date = parseDateLine(line);
    if (date && cur) { cur.started_on = date; continue; }
    const res = /^(conquista|resultado|coloca[cç][aã]o)\s*:\s*(.+)$/i.exec(line);
    if (res && cur) { cur.result = normalizeResult(res[2]); continue; }

    if (section === 'awards') {
      push();
      const parts = line.replace(/^[•\-–*]\s*/, '').split(/\s+[-–]\s+/);
      const yr = /^\d{4}$/.test(parts[parts.length - 1] ?? '') ? Number(parts.pop()) : null;
      cur = { kind: 'premio', title: parts[0], institution: parts.slice(1).join(' - ') || null, category: null, location: null,
        started_on: yr ? iso(yr, 1) : null, ended_on: null, result: null, description: null };
      push();
      continue;
    }
    // Clube por ano: "2023 - CLUBE AZUL DE VOLEI" ou "2021 a 2023 - Arena Sol"
    const club = /^(\d{4})(?:\s*(?:a|-|–|até)\s*(\d{4}|atual))?\s*[-–:]\s+(.+)$/i.exec(line);
    if (club) {
      push();
      cur = { kind: 'clube', title: titleCase(club[3]), institution: null, category: null, location: null,
        started_on: iso(Number(club[1]), 1), ended_on: club[2] && /^\d{4}$/.test(club[2]) ? iso(Number(club[2]), 12) : null,
        result: null, description: null };
      push();
      continue;
    }
    // Qualquer outra linha com letras vira uma competição (o mês/ano e a conquista vêm nas linhas seguintes).
    if (/[A-Za-zÀ-ú]{3,}/.test(line) && (section === 'comp' || section === 'exp' || section === null)) {
      push();
      const yearTail = /\s*[-–]\s*(\d{4})\s*$/.exec(line);
      const base = yearTail ? line.slice(0, yearTail.index) : line;
      const { title, category, extra } = splitCategory(base);
      cur = { kind: 'competicao', title, institution: null, category, location: null,
        started_on: yearTail ? iso(Number(yearTail[1]), 1) : null, ended_on: null, result: null, description: extra };
    }
  }
  push();
  out.references = parseReferences(refLines);
  // Clube repetido em anos seguidos vira um período só ("2024 - NCT", "2025 - NCT" → 2024–2025)
  const clubs = out.entries.filter((e) => e.kind === 'clube').sort((a, b) => (a.started_on ?? '').localeCompare(b.started_on ?? ''));
  for (let i = clubs.length - 1; i > 0; i--) {
    if (strip(clubs[i].title) === strip(clubs[i - 1].title)) {
      clubs[i - 1].ended_on = clubs[i].ended_on ?? clubs[i].started_on?.replace(/-01-01$/, '-12-01') ?? null;
      out.entries.splice(out.entries.indexOf(clubs[i]), 1);
    }
  }
  // Clube anterior termina quando começa o seguinte (só o mais recente fica "atual")
  const ordered = out.entries.filter((e) => e.kind === 'clube' && e.started_on).sort((x, y) => x.started_on!.localeCompare(y.started_on!));
  for (let i = 0; i < ordered.length - 1; i++) {
    if (!ordered[i].ended_on) ordered[i].ended_on = ordered[i + 1].started_on;
  }
  // Títulos conquistados viram também "Título" quando o resultado é campeão
  for (const e of out.entries) if (e.kind === 'competicao' && e.result === 'Campeão') e.kind = 'titulo';
  out.about = about.length ? about.join(' ').replace(/\s+/g, ' ').trim() : null;
  return out;
}

/** Pedido pronto para o assistente externo gratuito (ChatGPT, Gemini...). */
export const ASSISTANT_PROMPT = `Transforme o currículo esportivo abaixo em uma lista, uma linha por item, exatamente neste formato:
tipo | título | categoria | mês/ano | conquista | local
Tipos possíveis: clube, competição, título, prêmio, seleção, curso.
Exemplos:
clube | NCT Vôlei de Praia | | 01/2024 | | Brasília
competição | Circuito Brasiliense de Vôlei de Praia | Sub 17 | 03/2025 | Vice-campeão | Brasília
prêmio | Melhor levantador | | 2023 | |
Depois da lista, escreva "SOBRE MIM:" com um resumo de até 5 linhas e "METAS:" com uma meta por linha.
Responda só com isso. Currículo:
`;
