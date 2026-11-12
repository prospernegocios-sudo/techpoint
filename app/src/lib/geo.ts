// Cálculo de distância (fórmula de Haversine) — a mesma usada no servidor.
// O app usa só para mostrar ao atleta "você está a X metros"; quem decide é o servidor.

const EARTH_RADIUS_M = 6371008.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function isInsideRadius(
  point: { latitude: number; longitude: number },
  venue: { latitude: number; longitude: number; radius_m: number },
): { inside: boolean; distance: number } {
  const distance = distanceMeters(point.latitude, point.longitude, venue.latitude, venue.longitude);
  return { inside: distance <= venue.radius_m, distance };
}

/** "85 m" ou "1,3 km" */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}
