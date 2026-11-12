// Tradução dos erros do servidor e do aparelho para mensagens em português,
// sempre dizendo o que a pessoa pode fazer.

const serverMessages: Record<string, string> = {
  TP_NOT_AUTHENTICATED: 'Sua sessão expirou. Entre novamente no app.',
  TP_EVENT_NOT_FOUND: 'Treino não encontrado. Atualize a agenda e tente de novo.',
  TP_EVENT_CANCELED: 'Este treino foi cancelado.',
  TP_INVALID_PERIOD: 'Confira as datas do período.',
  TP_PERIOD_TOO_LONG: 'O período pode ter no máximo 1 ano.',
  TP_TEAMS_REQUIRED: 'Escolha pelo menos uma equipe.',
  TP_NOT_IN_TEAM: 'Você não faz parte da equipe deste treino. Fale com seu treinador.',
  TP_INVALID_KIND: 'Ação inválida. Tente de novo.',
  TP_PHOTO_REQUIRED: 'A foto é obrigatória. Tire uma foto na hora para continuar.',
  TP_PHOTO_NOT_FOUND: 'A foto não chegou ao servidor. Verifique a internet e tente de novo.',
  TP_LOCATION_REQUIRED: 'Não conseguimos sua localização. Ligue o GPS e tente de novo.',
  TP_OUTSIDE_WINDOW: 'Fora do horário permitido. O check-in abre 30 min antes do treino e fecha 30 min depois do início; o check-out vai até 60 min após o fim.',
  TP_OFFLINE_TOO_OLD: 'Este registro foi feito sem internet há muito tempo e não pode mais ser enviado. Fale com seu treinador.',
  TP_OUTSIDE_RADIUS: 'Você está fora da área do local do treino.',
  TP_NO_CHECK_IN: 'Faça o check-in antes do check-out.',
  TP_ALREADY_RECORDED: 'Esse registro já foi feito para este treino.',
  TP_FORBIDDEN: 'Você não tem permissão para fazer isso.',
  TP_REASON_REQUIRED: 'Escreva o motivo (pelo menos 3 letras).',
  TP_RECORD_NOT_FOUND: 'Registro não encontrado. Atualize a lista.',
};

export type FriendlyError = { code: string; message: string; detail?: Record<string, unknown> };

export function isNetworkError(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e ?? '');
  return /Network request failed|Failed to fetch|network|timed? ?out|ECONN|ENOTFOUND/i.test(msg);
}

export function toFriendlyError(e: unknown): FriendlyError {
  const err = e as { message?: string; details?: string; code?: string };
  const raw = err?.message ?? String(e);
  const code = Object.keys(serverMessages).find((c) => raw.includes(c));
  if (code) {
    let detail: Record<string, unknown> | undefined;
    try {
      detail = err.details ? JSON.parse(err.details) : undefined;
    } catch {
      detail = undefined;
    }
    return { code, message: serverMessages[code], detail };
  }
  if (isNetworkError(e)) {
    return { code: 'NETWORK', message: 'Sem conexão com a internet. Verifique o Wi-Fi ou os dados móveis.' };
  }
  if (err?.code === '42501' || /row-level security|permission denied/i.test(raw)) {
    return { code: 'FORBIDDEN', message: 'Você não tem permissão para fazer isso.' };
  }
  return { code: 'UNKNOWN', message: 'Algo deu errado. Tente de novo em instantes.' };
}

export const flagLabels: Record<string, string> = {
  outside_radius: 'Fora do raio',
  mock_location: 'Localização falsa',
  duplicate_photo: 'Foto repetida',
  shared_device: 'Mesmo celular de outro atleta',
  low_accuracy: 'GPS impreciso',
  offline_sync: 'Enviado depois (sem internet)',
  manual: 'Registro manual',
};
