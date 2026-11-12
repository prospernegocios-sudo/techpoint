import { distanceMeters, formatDistance, isInsideRadius } from '../geo';

// Centro de referência: Brasília. 0,0001° de latitude ≈ 11,1 m.
const venue = { latitude: -15.7942, longitude: -47.8822, radius_m: 150 };

describe('cálculo do raio (Haversine)', () => {
  it('distância zero no mesmo ponto', () => {
    expect(distanceMeters(-15.7942, -47.8822, -15.7942, -47.8822)).toBe(0);
  });

  it('1 grau de latitude ≈ 111,2 km', () => {
    expect(distanceMeters(0, 0, 1, 0)).toBeCloseTo(111195, -1);
  });

  it('é simétrica', () => {
    const a = distanceMeters(-15.79, -47.88, -15.80, -47.90);
    const b = distanceMeters(-15.80, -47.90, -15.79, -47.88);
    expect(a).toBeCloseTo(b, 6);
  });

  it('bate com o valor calculado pelo servidor (150 m)', () => {
    // O mesmo par de pontos deu 150 m na função SQL public.distance_m.
    expect(Math.round(distanceMeters(-15.7942, -47.8822, -15.7942, -47.8808))).toBe(150);
  });

  it('dentro do raio a 100 m', () => {
    const r = isInsideRadius({ latitude: -15.7942 + 0.0009, longitude: -47.8822 }, venue);
    expect(r.distance).toBeGreaterThan(95);
    expect(r.distance).toBeLessThan(105);
    expect(r.inside).toBe(true);
  });

  it('exatamente no limite conta como dentro', () => {
    const r = isInsideRadius({ latitude: -15.7942, longitude: -47.8822 }, { ...venue, radius_m: 0 });
    expect(r.inside).toBe(true);
  });

  it('fora do raio a ~200 m', () => {
    const r = isInsideRadius({ latitude: -15.7942 + 0.0018, longitude: -47.8822 }, venue);
    expect(r.inside).toBe(false);
  });

  it('raio configurável por local', () => {
    const p = { latitude: -15.7942 + 0.0018, longitude: -47.8822 };
    expect(isInsideRadius(p, { ...venue, radius_m: 250 }).inside).toBe(true);
  });

  it('formata distâncias em português', () => {
    expect(formatDistance(85.4)).toBe('85 m');
    expect(formatDistance(1349)).toBe('1,3 km');
  });
});
