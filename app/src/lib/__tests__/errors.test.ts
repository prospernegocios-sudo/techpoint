import { isNetworkError, toFriendlyError } from '../errors';

describe('mensagens de erro em português', () => {
  it('traduz códigos do servidor', () => {
    expect(toFriendlyError({ message: 'TP_OUTSIDE_WINDOW' }).message).toMatch(/Fora do horário/);
    expect(toFriendlyError({ message: 'TP_ALREADY_RECORDED' }).code).toBe('TP_ALREADY_RECORDED');
  });
  it('lê distância e raio do erro de fora do raio', () => {
    const e = toFriendlyError({ message: 'TP_OUTSIDE_RADIUS', details: '{"distance_m": 1300, "radius_m": 150}' });
    expect(e.detail).toEqual({ distance_m: 1300, radius_m: 150 });
  });
  it('reconhece falta de internet', () => {
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
    expect(toFriendlyError(new TypeError('Network request failed')).message).toMatch(/Sem conexão/);
  });
  it('erro desconhecido vira mensagem genérica amigável', () => {
    expect(toFriendlyError(new Error('xyz')).message).toMatch(/Tente de novo/);
  });
});
