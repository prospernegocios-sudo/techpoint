// Lê o texto de um PDF de currículo (D85, sem custo): devolve as linhas na ordem de leitura,
// separando a coluna lateral da principal. Exige login. O PDF não é guardado.
import { getDocumentProxy } from 'npm:unpdf@0.12.1';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

async function pdfLines(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(bytes);
  const out: string[] = [];
  for (let n = 1; n <= Math.min(pdf.numPages, 10); n++) {
    const page = await pdf.getPage(n);
    const width = page.getViewport({ scale: 1 }).width;
    const tc = await page.getTextContent();
    // deno-lint-ignore no-explicit-any
    const items = (tc.items as any[]).filter((i) => i.str && i.str.trim()).map((i) => ({ s: i.str as string, x: i.transform[4] as number, w: (i.width as number) || 0, y: i.transform[5] as number, h: (i.height as number) || 10 }));
    let cut: number | null = null, bestGap = 0;
    for (let c = width * 0.25; c <= width * 0.55; c += 2) {
      if (items.some((i) => i.x < c && i.x + i.w > c)) continue;
      const left = items.filter((i) => i.x + i.w <= c), right = items.filter((i) => i.x >= c);
      if (left.length < 3 || right.length < 3) continue;
      const gap = Math.min(...right.map((i) => i.x)) - Math.max(...left.map((i) => i.x + i.w));
      if (gap > bestGap) { bestGap = gap; cut = c; }
    }
    if (bestGap < 6) cut = null;
    const cols = cut ? [items.filter((i) => i.x < cut!), items.filter((i) => i.x >= cut!)] : [items];
    for (const col of cols) {
      col.sort((a, b) => b.y - a.y || a.x - b.x);
      let line: typeof col = [], y: number | null = null;
      const flush = () => { if (line.length) out.push(line.map((l) => l.s).join(' ').replace(/\s+/g, ' ').trim()); line = []; };
      for (const it of col) {
        if (y !== null && Math.abs(it.y - y) > Math.max(2, it.h * 0.5)) flush();
        line.push(it); y = it.y;
      }
      flush();
      out.push('');
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Use POST', { status: 405, headers: cors });
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) return Response.json({ error: 'Envie um PDF de até 10 MB.' }, { status: 400, headers: cors });
  try {
    const lines = await pdfLines(bytes);
    if (!lines.some((l) => l.trim())) return Response.json({ error: 'Este PDF não tem texto (parece escaneado ou foto). Use o assistente.' }, { status: 422, headers: cors });
    return Response.json({ lines }, { headers: cors });
  } catch {
    return Response.json({ error: 'Não foi possível ler este PDF.' }, { status: 422, headers: cors });
  }
});
