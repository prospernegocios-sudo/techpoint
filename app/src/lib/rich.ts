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
