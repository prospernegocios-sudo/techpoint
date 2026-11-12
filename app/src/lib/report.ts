// Relatório de frequência para prestação de contas (projetos incentivados e patrocinadores).
// Funções puras: montam linhas, resumo, planilha (CSV) e o HTML do PDF a partir dos dados do servidor.

export type ReportRecord = {
  id: string; event_id: string; athlete_id: string; kind: 'check_in' | 'check_out';
  server_at: string; client_at: string | null; synced_offline: boolean;
  latitude: number | null; longitude: number | null; accuracy_m: number | null; distance_m: number | null;
  photo_path: string | null; source: 'app' | 'manual'; manual_reason: string | null; recorded_by_name: string | null;
  status: 'valid' | 'pending'; justification: string | null; reviewed_by_name: string | null; reviewed_at: string | null;
  flags: string[]; code: string;
};
export type ReportEvent = {
  id: string; team_id: string; type: string; title: string | null; starts_at: string; ends_at: string;
  venue: { name: string; latitude: number; longitude: number; radius_m: number };
};
export type ReportData = {
  generated_at: string; generated_by: string | null;
  period: { from: string; to: string };
  project: { name?: string; number?: string; proponent?: string };
  org: { id: string; name: string };
  teams: { id: string; name: string; category: string | null }[];
  events: ReportEvent[];
  members: { team_id: string; athlete_id: string; full_name: string; joined_at: string }[];
  records: ReportRecord[];
};

export type ReportRow = {
  event: ReportEvent; teamName: string; athleteId: string; athleteName: string;
  checkIn?: ReportRecord; checkOut?: ReportRecord;
  /** Presença confirmada: check-in válido (no raio, aprovado pelo treinador ou manual). */
  present: boolean; pending: boolean;
};

export type AthleteSummary = { athleteId: string; name: string; teamName: string; expected: number; present: number; pending: number; pct: number };

// O Brasil não tem horário de verão desde 2019: horário de Brasília = UTC−3.
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');
const brt = (iso: string) => new Date(new Date(iso).getTime() + BRT_OFFSET_MS);
export const brDate = (iso: string) => { const d = brt(iso); return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`; };
export const brTime = (iso: string) => { const d = brt(iso); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
export const brDateTime = (iso: string) => `${brDate(iso)} ${brTime(iso)}`;
/** "2026-11-01" → "01/11/2026" */
export const isoDayToBr = (day: string) => day.split('-').reverse().join('/');

export function buildRows(data: ReportData): ReportRow[] {
  const teamName = new Map(data.teams.map((t) => [t.id, t.name]));
  const recs = new Map<string, ReportRecord>();
  for (const r of data.records) recs.set(`${r.event_id}|${r.athlete_id}|${r.kind}`, r);
  const rows: ReportRow[] = [];
  for (const ev of data.events) {
    const evDay = brDate(ev.starts_at).split('/').reverse().join('-');
    // Atleta conta no treino se já estava na equipe naquele dia, ou se registrou presença.
    const members = data.members.filter((m) => m.team_id === ev.team_id && (
      brDate(m.joined_at).split('/').reverse().join('-') <= evDay
      || recs.has(`${ev.id}|${m.athlete_id}|check_in`)
    ));
    for (const m of members) {
      const checkIn = recs.get(`${ev.id}|${m.athlete_id}|check_in`);
      const checkOut = recs.get(`${ev.id}|${m.athlete_id}|check_out`);
      rows.push({
        event: ev, teamName: teamName.get(ev.team_id) ?? '', athleteId: m.athlete_id, athleteName: m.full_name,
        checkIn, checkOut,
        present: checkIn?.status === 'valid',
        pending: checkIn?.status === 'pending',
      });
    }
  }
  return rows;
}

export function summarize(rows: ReportRow[]): AthleteSummary[] {
  const map = new Map<string, AthleteSummary>();
  for (const r of rows) {
    const key = `${r.athleteId}|${r.teamName}`;
    const s = map.get(key) ?? { athleteId: r.athleteId, name: r.athleteName, teamName: r.teamName, expected: 0, present: 0, pending: 0, pct: 0 };
    s.expected++;
    if (r.present) s.present++;
    if (r.pending) s.pending++;
    map.set(key, s);
  }
  return [...map.values()]
    .map((s) => ({ ...s, pct: s.expected ? Math.round((s.present / s.expected) * 100) : 0 }))
    .sort((a, b) => a.teamName.localeCompare(b.teamName) || a.name.localeCompare(b.name));
}

export function statusLabel(r?: ReportRecord): string {
  if (!r) return 'Sem registro';
  if (r.status === 'pending') return 'Pendente de aprovação';
  if (r.source === 'manual') return 'Manual (registrado pelo treinador)';
  if (r.reviewed_by_name) return 'Aprovado pelo treinador';
  return 'Válido';
}

export function stayMinutes(row: ReportRow): number | null {
  if (!row.checkIn || !row.checkOut) return null;
  return Math.round((new Date(row.checkOut.server_at).getTime() - new Date(row.checkIn.server_at).getTime()) / 60000);
}

const coord = (n: number | null) => (n == null ? '' : n.toFixed(6));
const meters = (n: number | null) => (n == null ? '' : String(Math.round(n)));

// ---------------- Planilha (CSV para Excel) ----------------
const csvCell = (v: string | number | null | undefined) => {
  const s = v == null ? '' : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(data: ReportData, rows: ReportRow[]): string {
  const head = [
    'Data', 'Início do treino', 'Fim do treino', 'Equipe', 'Local', 'Atleta', 'Presença',
    'Entrada (hora do servidor)', 'Entrada - situação', 'Entrada - distância do local (m)', 'Entrada - latitude', 'Entrada - longitude',
    'Entrada - precisão do GPS (m)', 'Entrada - código de verificação',
    'Saída (hora do servidor)', 'Saída - situação', 'Saída - distância do local (m)', 'Saída - latitude', 'Saída - longitude',
    'Saída - código de verificação', 'Permanência (min)', 'Observações',
  ];
  const lines = rows.map((r) => {
    const ci = r.checkIn, co = r.checkOut;
    const notes = [
      ci?.synced_offline ? 'entrada enviada depois (sem internet no momento)' : '',
      ci?.justification ? `justificativa: ${ci.justification}` : '',
      ci?.manual_reason ? `motivo manual: ${ci.manual_reason}` : '',
      co?.manual_reason ? `saída manual: ${co.manual_reason}` : '',
    ].filter(Boolean).join(' | ');
    return [
      brDate(r.event.starts_at), brTime(r.event.starts_at), brTime(r.event.ends_at), r.teamName, r.event.venue.name, r.athleteName,
      r.present ? 'Presente' : r.pending ? 'Pendente' : 'Ausente',
      ci ? brDateTime(ci.server_at) : '', statusLabel(ci), meters(ci?.distance_m ?? null), coord(ci?.latitude ?? null), coord(ci?.longitude ?? null),
      meters(ci?.accuracy_m ?? null), ci?.code ?? '',
      co ? brDateTime(co.server_at) : '', co ? statusLabel(co) : '', meters(co?.distance_m ?? null), coord(co?.latitude ?? null), coord(co?.longitude ?? null),
      co?.code ?? '', stayMinutes(r) ?? '', notes,
    ].map(csvCell).join(';');
  });
  const title = [`Relatório de frequência - ${data.project.name ?? ''}`, `Período ${isoDayToBr(data.period.from)} a ${isoDayToBr(data.period.to)}`, 'Horários de Brasília'];
  // BOM para o Excel reconhecer os acentos.
  return '﻿' + [title.map(csvCell).join(';'), head.map(csvCell).join(';'), ...lines].join('\r\n');
}

// ---------------- PDF (HTML impresso pelo celular) ----------------
export const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function recordCell(r: ReportRecord | undefined, thumbs: Record<string, string>) {
  if (!r) return '<td class="rec none">—</td>';
  const img = r.photo_path && thumbs[r.photo_path]
    ? `<img src="${thumbs[r.photo_path]}" alt="foto"/>`
    : r.source === 'manual' ? '<div class="nophoto">sem foto<br/>(manual)</div>' : '<div class="nophoto">foto<br/>indisponível</div>';
  const lines = [
    `<b>${brTime(r.server_at)}</b> · ${esc(statusLabel(r))}`,
    r.distance_m != null ? `${Math.round(r.distance_m)} m do local` : '',
    r.latitude != null ? `GPS ${coord(r.latitude)}, ${coord(r.longitude)}${r.accuracy_m != null ? ` (±${Math.round(r.accuracy_m)} m)` : ''}` : '',
    r.synced_offline ? 'Enviado depois (sem internet)' : '',
    r.justification ? `Justificativa: ${esc(r.justification)}` : '',
    r.manual_reason ? `Motivo: ${esc(r.manual_reason)}${r.recorded_by_name ? ` — ${esc(r.recorded_by_name)}` : ''}` : '',
    r.reviewed_by_name ? `Aprovado por ${esc(r.reviewed_by_name)}` : '',
    `Código: <span class="code">${r.code}</span>`,
  ].filter(Boolean);
  return `<td class="rec"><div class="recwrap">${img}<div>${lines.join('<br/>')}</div></div></td>`;
}

export function toHtml(data: ReportData, rows: ReportRow[], thumbs: Record<string, string>): string {
  const summary = summarize(rows);
  const totalExpected = summary.reduce((a, s) => a + s.expected, 0);
  const totalPresent = summary.reduce((a, s) => a + s.present, 0);
  const avg = totalExpected ? Math.round((totalPresent / totalExpected) * 100) : 0;
  const p = data.project;

  const eventsHtml = data.events.map((ev) => {
    const evRows = rows.filter((r) => r.event.id === ev.id);
    const present = evRows.filter((r) => r.present).length;
    return `
    <div class="event">
      <h3>${brDate(ev.starts_at)} · ${brTime(ev.starts_at)}–${brTime(ev.ends_at)} · ${esc(evRows[0]?.teamName ?? '')} · ${present}/${evRows.length} presentes</h3>
      <div class="muted">Local: ${esc(ev.venue.name)} — ${coord(ev.venue.latitude)}, ${coord(ev.venue.longitude)} — raio permitido ${ev.venue.radius_m} m</div>
      <table>
        <thead><tr><th style="width:18%">Atleta</th><th style="width:8%">Presença</th><th>Entrada</th><th>Saída</th><th style="width:7%">Permanência</th></tr></thead>
        <tbody>
        ${evRows.map((r) => `<tr>
          <td>${esc(r.athleteName)}</td>
          <td class="${r.present ? 'ok' : r.pending ? 'warn' : 'bad'}">${r.present ? 'Presente' : r.pending ? 'Pendente' : 'Ausente'}</td>
          ${recordCell(r.checkIn, thumbs)}
          ${recordCell(r.checkOut, thumbs)}
          <td>${stayMinutes(r) != null ? `${stayMinutes(r)} min` : '—'}</td>
        </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }).join('');

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, Arial, sans-serif; font-size: 9.5px; color: #111; margin: 0; }
  h1 { font-size: 17px; margin: 0 0 4px; } h2 { font-size: 13px; margin: 16px 0 6px; } h3 { font-size: 11px; margin: 0 0 2px; }
  .muted { color: #555; margin-bottom: 4px; }
  .head { border: 1px solid #999; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; }
  .head td { padding: 1px 8px 1px 0; border: none; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #bbb; padding: 3px 4px; vertical-align: top; text-align: left; }
  th { background: #eef2f8; }
  .event { margin-top: 12px; page-break-inside: auto; } tr { page-break-inside: avoid; }
  .recwrap { display: flex; gap: 5px; align-items: flex-start; }
  .rec img { width: 46px; height: 61px; object-fit: cover; border-radius: 3px; flex: none; }
  .nophoto { width: 46px; height: 61px; border: 1px dashed #aaa; color: #777; font-size: 7.5px; text-align: center; padding-top: 18px; flex: none; }
  .code { font-family: monospace; letter-spacing: 0.5px; }
  .ok { color: #11753b; font-weight: 700; } .warn { color: #a66300; font-weight: 700; } .bad { color: #b3261e; font-weight: 700; }
  .note { border-top: 1px solid #999; margin-top: 14px; padding-top: 6px; color: #333; }
  .sign { display: flex; gap: 40px; margin-top: 36px; } .sign div { flex: 1; border-top: 1px solid #111; padding-top: 3px; text-align: center; }
  .lgpd { margin-top: 10px; font-size: 8.5px; color: #555; }
</style></head><body>
  <div class="head">
    <h1>Relatório de frequência de atletas</h1>
    <table><tbody>
      <tr><td><b>Projeto:</b> ${esc(p.name)}</td><td><b>Nº do projeto:</b> ${esc(p.number) || '—'}</td></tr>
      <tr><td><b>Entidade proponente:</b> ${esc(p.proponent || data.org.name)}</td><td><b>Clube:</b> ${esc(data.org.name)}</td></tr>
      <tr><td><b>Período:</b> ${isoDayToBr(data.period.from)} a ${isoDayToBr(data.period.to)}</td><td><b>Equipes:</b> ${data.teams.map((t) => esc(t.name)).join(', ')}</td></tr>
      <tr><td><b>Treinos no período:</b> ${data.events.length}</td><td><b>Frequência média:</b> ${avg}% (${totalPresent} presenças de ${totalExpected} previstas)</td></tr>
      <tr><td><b>Gerado em:</b> ${brDateTime(data.generated_at)} (horário de Brasília)</td><td><b>Gerado por:</b> ${esc(data.generated_by)} — TechPoint</td></tr>
    </tbody></table>
  </div>

  <h2>Resumo por atleta</h2>
  <table>
    <thead><tr><th>Atleta</th><th>Equipe</th><th>Treinos previstos</th><th>Presenças</th><th>Pendentes</th><th>Frequência</th></tr></thead>
    <tbody>${summary.map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(s.teamName)}</td><td>${s.expected}</td><td>${s.present}</td><td>${s.pending || ''}</td><td><b>${s.pct}%</b></td></tr>`).join('')}</tbody>
  </table>

  <h2>Registros por treino</h2>
  ${eventsHtml || '<p>Nenhum treino encerrado no período.</p>'}

  <div class="note">
    <b>Como os registros foram feitos.</b> Cada atleta registrou entrada e saída pelo próprio celular, no aplicativo TechPoint.
    No momento do registro, o aplicativo leu a localização do GPS uma única vez e tirou uma foto na hora pela câmera (não é possível usar foto da galeria).
    O servidor conferiu o horário do treino e a distância até o local, e gravou a <b>hora do servidor</b>, que não depende do relógio do celular.
    Registros fora do raio permitido só contam como presença depois da aprovação do treinador. Registros "manuais" foram feitos pelo treinador, com motivo, para atletas sem celular.
    O <b>código de verificação</b> de cada registro é uma impressão digital dos seus dados (hora, localização, foto e situação): qualquer alteração posterior muda o código.
  </div>

  <div class="sign">
    <div>Treinador(a) responsável</div>
    <div>Responsável pela entidade proponente</div>
  </div>

  <div class="lgpd">Documento com dados pessoais de atletas, incluindo menores de idade (Lei 13.709/2018 — LGPD). Uso restrito à prestação de contas do projeto indicado. Não divulgar.</div>
</body></html>`;
}
