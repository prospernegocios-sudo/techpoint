// Documentos e endereços brasileiros: máscaras, conferência de CPF/CNPJ e consulta pública
// de CNPJ e CEP na BrasilAPI (gratuita, dados abertos da Receita; decisão D52).

export const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');

export function validCpf(v: string): boolean {
  const d = digits(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function validCnpj(v: string): boolean {
  const d = digits(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (n: number) => {
    const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = w.reduce((acc, wi, i) => acc + wi * Number(d[i]), 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export const validEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());
export const validPhone = (v: string) => /^\d{10,11}$/.test(digits(v));

const fmt = (d: string, pattern: string) => {
  let i = 0;
  let out = '';
  for (const ch of pattern) {
    if (i >= d.length) break;
    out += ch === '#' ? d[i++] : ch;
  }
  return out;
};
export const maskCpf = (v: string) => fmt(digits(v).slice(0, 11), '###.###.###-##');
export const maskCnpj = (v: string) => fmt(digits(v).slice(0, 14), '##.###.###/####-##');
export const maskCep = (v: string) => fmt(digits(v).slice(0, 8), '#####-###');
export const maskPhone = (v: string) => {
  const d = digits(v).slice(0, 11);
  return d.length <= 10 ? fmt(d, '(##) ####-####') : fmt(d, '(##) #####-####');
};

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export type CnpjInfo = {
  legal_name: string; trade_name: string; status: string; cep: string; street: string; street_number: string;
  complement: string; district: string; city: string; uf: string; phone: string; email: string;
  partners: { name: string; role: string }[];
};

const BRASILAPI = 'https://brasilapi.com.br/api';

/** Busca os dados públicos do CNPJ. Devolve null se não encontrar ou se o serviço estiver fora. */
export async function lookupCnpj(cnpj: string): Promise<CnpjInfo | null> {
  try {
    const r = await fetch(`${BRASILAPI}/cnpj/v1/${digits(cnpj)}`);
    if (!r.ok) return null;
    const j = await r.json();
    const title = (s: string | null | undefined) => (s ?? '').trim();
    return {
      legal_name: title(j.razao_social),
      trade_name: title(j.nome_fantasia),
      status: title(j.descricao_situacao_cadastral),
      cep: digits(String(j.cep ?? '')),
      street: [title(j.descricao_tipo_de_logradouro), title(j.logradouro)].filter(Boolean).join(' '),
      street_number: title(j.numero),
      complement: title(j.complemento),
      district: title(j.bairro),
      city: title(j.municipio),
      uf: title(j.uf).toUpperCase(),
      phone: digits(j.ddd_telefone_1),
      email: title(j.email).toLowerCase(),
      partners: Array.isArray(j.qsa) ? j.qsa.map((s: { nome_socio?: string; qualificacao_socio?: string }) => ({ name: title(s.nome_socio), role: title(s.qualificacao_socio) })) : [],
    };
  } catch {
    return null;
  }
}

export type CepInfo = { street: string; district: string; city: string; uf: string };

export async function lookupCep(cep: string): Promise<CepInfo | null> {
  try {
    const r = await fetch(`${BRASILAPI}/cep/v2/${digits(cep)}`);
    if (!r.ok) return null;
    const j = await r.json();
    return { street: j.street ?? '', district: j.neighborhood ?? '', city: j.city ?? '', uf: (j.state ?? '').toUpperCase() };
  } catch {
    return null;
  }
}
