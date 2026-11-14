// Próxima ação do botão central e dos cartões de treino.
import { useMe } from './me';
import { formatDay, formatTime } from './format';
import { useEvents, useMyAttendance, type AttendanceRow, type EventRow } from './queries';

export type Action = { kind: 'check_in' | 'check_out'; label: string } | null;

export function nextAction(ev: EventRow, recs: AttendanceRow[]): { action: Action; status: string } {
  const now = Date.now();
  const start = new Date(ev.starts_at).getTime();
  const end = new Date(ev.ends_at).getTime();
  const ci = recs.find((r) => r.event_id === ev.id && r.kind === 'check_in' && r.status !== 'rejected');
  const co = recs.find((r) => r.event_id === ev.id && r.kind === 'check_out' && r.status !== 'rejected');
  if (co) return { action: null, status: `Saída às ${formatTime(co.server_at)}${co.status === 'pending' ? ' (aguardando treinador)' : ''}` };
  if (ci) {
    const label = `Chegada às ${formatTime(ci.server_at)}${ci.status === 'pending' ? ' (aguardando treinador)' : ''}`;
    if (now >= start && now <= end + 60 * 60_000) return { action: { kind: 'check_out', label: 'Fazer check-out' }, status: label };
    return { action: null, status: label };
  }
  if (now >= start - 30 * 60_000 && now <= start + 30 * 60_000) return { action: { kind: 'check_in', label: 'Fazer check-in' }, status: 'Check-in aberto' };
  // Depois da tolerância continua liberado até o fim do treino, marcado como atrasado (D58).
  if (now > start + 30 * 60_000 && now <= end) return { action: { kind: 'check_in', label: 'Fazer check-in (atrasado)' }, status: 'Treino em andamento: o check-in fica marcado como atrasado' };
  if (now < start - 30 * 60_000) return { action: null, status: `Check-in abre às ${formatTime(new Date(start - 30 * 60_000))}` };
  return { action: null, status: 'Check-in encerrado' };
}


export type CenterAction =
  | { kind: 'checkin' | 'checkout'; eventId: string; label: string }
  | { kind: 'roster'; eventId: string; label: string }
  | { kind: 'none'; label: string; hint: string };

/** O que o botão central faz agora: check-in/check-out (atleta) ou abrir a presença do treino de agora (equipe). */
export function useCenterAction(): CenterAction {
  const me = useMe();
  const events = useEvents(me.org?.id, 0, 7);
  const list = events.data ?? [];
  const athlete = me.mode === 'athlete';
  const mine = useMyAttendance(athlete ? me.athlete?.id : undefined, list.map((e) => e.id));
  const next = list.find((e) => new Date(e.ends_at).getTime() > Date.now());
  const hint = next ? `Próximo: ${formatDay(next.starts_at)}, ${formatTime(next.starts_at)}` : 'Nenhum treino nos próximos 7 dias';
  if (athlete) {
    if (!me.athlete) return { kind: 'none', label: 'Check-in', hint: 'Seu cadastro de atleta ainda não está ligado a esta conta.' };
    for (const ev of list) {
      const { action } = nextAction(ev, mine.data ?? []);
      if (action) return { kind: action.kind === 'check_in' ? 'checkin' : 'checkout', eventId: ev.id, label: action.kind === 'check_in' ? 'Check-in' : 'Check-out' };
    }
    return { kind: 'none', label: 'Check-in', hint };
  }
  // Equipe: o treino acontecendo agora; senão, o próximo de hoje.
  const now = Date.now();
  const live = list.find((e) => new Date(e.starts_at).getTime() - 30 * 60_000 <= now && now <= new Date(e.ends_at).getTime() + 60 * 60_000);
  const today = list.find((e) => new Date(e.starts_at).toDateString() === new Date().toDateString() && new Date(e.ends_at).getTime() > now);
  const ev: EventRow | undefined = live ?? today;
  if (ev) return { kind: 'roster', eventId: ev.id, label: 'Presença' };
  return { kind: 'none', label: 'Presença', hint };
}
