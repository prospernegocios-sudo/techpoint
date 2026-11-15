// Cidades do Brasil (D91): 27 capitais primeiro e busca em todos os municípios, sem acento e sem internet.
import { CIDADES_RAW } from '../data/cidades';

export type City = { name: string; uf: string; label: string; key: string };
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

let cache: City[] | null = null;
export function allCities(): City[] {
  if (cache) return cache;
  const out: City[] = [];
  for (const part of CIDADES_RAW.split(';')) {
    const [uf, list] = part.split(':');
    for (const name of list.split('|')) out.push({ name, uf, label: `${name} - ${uf}`, key: norm(name) });
  }
  out.sort((a, b) => a.key.localeCompare(b.key) || a.uf.localeCompare(b.uf));
  cache = out;
  return out;
}

const CAPITAIS: [string, string][] = [
  ['Aracaju', 'SE'], ['Belém', 'PA'], ['Belo Horizonte', 'MG'], ['Boa Vista', 'RR'], ['Brasília', 'DF'], ['Campo Grande', 'MS'],
  ['Cuiabá', 'MT'], ['Curitiba', 'PR'], ['Florianópolis', 'SC'], ['Fortaleza', 'CE'], ['Goiânia', 'GO'], ['João Pessoa', 'PB'],
  ['Macapá', 'AP'], ['Maceió', 'AL'], ['Manaus', 'AM'], ['Natal', 'RN'], ['Palmas', 'TO'], ['Porto Alegre', 'RS'],
  ['Porto Velho', 'RO'], ['Recife', 'PE'], ['Rio Branco', 'AC'], ['Rio de Janeiro', 'RJ'], ['Salvador', 'BA'], ['São Luís', 'MA'],
  ['São Paulo', 'SP'], ['Teresina', 'PI'], ['Vitória', 'ES'],
];
export const CAPITALS: City[] = CAPITAIS.map(([name, uf]) => ({ name, uf, label: `${name} - ${uf}`, key: norm(name) }));

/** Busca por nome (sem acento): primeiro as que começam com o texto, depois as que contêm. */
export function searchCities(q: string, limit = 8): City[] {
  const k = norm(q.replace(/\s*-\s*[A-Za-z]{2}$/, ''));
  if (!k) return CAPITALS;
  const all = allCities();
  const isCap = (c: City) => CAPITALS.some((x) => x.key === c.key && x.uf === c.uf);
  // Capitais aparecem antes (quem digita "brasil" quer Brasília)
  const starts = all.filter((c) => c.key.startsWith(k)).sort((a, b) => Number(isCap(b)) - Number(isCap(a)));
  const has = starts.length >= limit ? [] : all.filter((c) => !c.key.startsWith(k) && c.key.includes(k));
  return [...starts, ...has].slice(0, limit);
}
