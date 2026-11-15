// Formatação básica do texto (D89): **negrito**, *itálico* e lista com "• ". Funções puras.
export type Piece = { t: string; b?: boolean; i?: boolean };

export function parseInline(s: string): Piece[] {
  const out: Piece[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: s.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: m[1], b: true }); else out.push({ t: m[2], i: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: s.slice(last) });
  return out;
}

/** Para o PDF e páginas HTML. */
export function richToHtml(text: string, esc: (s: string) => string): string {
  return text.split('\n').map((p) => {
    const bullet = /^\s*[•\-*]\s+/.test(p) && !/^\s*\*\*/.test(p);
    const body = (bullet ? p.replace(/^\s*[•\-*]\s+/, '') : p);
    const html = parseInline(body).map((x) => (x.b ? `<b>${esc(x.t)}</b>` : x.i ? `<i>${esc(x.t)}</i>` : esc(x.t))).join('');
    return bullet ? `<div style="padding-left:12px">• ${html}</div>` : `<p style="margin:0 0 6px">${html}</p>`;
  }).join('');
}

// ---- Edição (D89): liga/desliga negrito, itálico e lista; limpar formatação.
export type Sel = { start: number; end: number };

/** Liga ou desliga uma marca (** ou *) no trecho selecionado. Sem seleção: null (nada a fazer). */
export function toggleWrap(value: string, sel: Sel, mark: '**' | '*'): { value: string; sel: Sel } | null {
  let { start, end } = sel;
  if (start === end) return null;
  // Ignora espaços nas pontas da seleção (comum ao selecionar com duplo clique)
  while (start < end && value[start] === ' ') start++;
  while (end > start && value[end - 1] === ' ') end--;
  const chosen = value.slice(start, end);
  const n = mark.length;
  const isItalicOnly = (s: string) => mark === '*' && s.startsWith('*') && !s.startsWith('**');
  // Já marcado por dentro (seleção inclui as marcas)
  if (chosen.length > 2 * n && chosen.startsWith(mark) && chosen.endsWith(mark) && (mark === '**' || isItalicOnly(chosen))) {
    const inner = chosen.slice(n, -n);
    return { value: value.slice(0, start) + inner + value.slice(end), sel: { start, end: start + inner.length } };
  }
  // Já marcado por fora (marcas logo antes e depois da seleção)
  if (value.slice(start - n, start) === mark && value.slice(end, end + n) === mark && (mark === '**' || value[start - 2] !== '*')) {
    return { value: value.slice(0, start - n) + chosen + value.slice(end + n), sel: { start: start - n, end: end - n } };
  }
  return { value: value.slice(0, start) + mark + chosen + mark + value.slice(end), sel: { start: start + n, end: end + n } };
}

/** Liga ou desliga a lista nas linhas tocadas pela seleção (ou na linha do cursor). */
export function toggleBullets(value: string, sel: Sel): string {
  const lineStart = value.lastIndexOf('\n', Math.max(0, sel.start - 1)) + 1;
  const nextBreak = value.indexOf('\n', Math.max(sel.end, sel.start));
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const lines = value.slice(lineStart, lineEnd).split('\n');
  const all = lines.every((l) => /^\s*•\s?/.test(l) || !l.trim());
  const out = lines.map((l) => (!l.trim() ? l : all ? l.replace(/^\s*(•\s?)+/, '') : `• ${l.replace(/^\s*(•\s?)+/, '')}`));
  return value.slice(0, lineStart) + out.join('\n') + value.slice(lineEnd);
}

/** Tira negrito, itálico e marcadores do trecho (ou do texto todo, sem seleção). */
export function clearFormat(value: string, sel: Sel): string {
  const strip = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/^\s*(•\s?)+/gm, '');
  if (sel.start === sel.end) return strip(value);
  const lineStart = value.lastIndexOf('\n', Math.max(0, sel.start - 1)) + 1;
  const nextBreak = value.indexOf('\n', sel.end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  return value.slice(0, lineStart) + strip(value.slice(lineStart, lineEnd)) + value.slice(lineEnd);
}
