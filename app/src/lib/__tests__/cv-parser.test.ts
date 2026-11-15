// Leitor de currículo (D85). O texto de exemplo é inventado, mas segue a estrutura de um currículo real
// feito no Canva e extraído do PDF (coluna lateral e principal, cabeçalho repetido por página,
// letras espaçadas e duas referências lado a lado).
import { normalizeResult, parseCvText, parseDateLine, segmentWords } from '../cv-parser';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs') as { readFileSync: (p: string, e: string) => string };

const text = fs.readFileSync(`${process.cwd()}/src/lib/__tests__/fixtures/cv-exemplo.txt`, 'utf8');

test('datas e conquistas em português', () => {
  expect(parseDateLine('Março, 2025')).toBe('2025-03-01');
  expect(parseDateLine('setembro, 2024')).toBe('2024-09-01');
  expect(parseDateLine('03/2025')).toBe('2025-03-01');
  expect(parseDateLine('mar/2025')).toBe('2025-03-01');
  expect(normalizeResult('Vice Campeões')).toBe('Vice-campeão');
  expect(normalizeResult('Segundo Lugar')).toBe('2º lugar');
  expect(normalizeResult('Segundo Lugar - Div. Especial')).toBe('2º lugar - Div. Especial');
  expect(normalizeResult('Campeões')).toBe('Campeão');
  expect(segmentWords('JOGADORDEVOLEIDEAREIA')).toBe('Jogador de vôlei de areia');
});

test('lê um currículo extraído de PDF', () => {
  const cv = parseCvText(text);
  expect(cv.name).toBe('Atleta Exemplo');
  expect(cv.headline).toBe('Jogadora de vôlei de praia');
  expect(cv.contacts).toEqual({ phone: '61.90000.0000', email: 'atleta@exemplo.com', instagram: '@atleta.exemplo', city: 'Goiânia - GO' });
  expect(cv.about).toMatch(/^Sou estudante do 9º ano/);
  expect(cv.goals).toEqual(['Entrar na seleção estadual', 'Jogar um campeonato brasileiro', 'Ser Campeã Mundial']);
  const clubs = cv.entries.filter((e) => e.kind === 'clube');
  expect(clubs.map((c) => [c.title, c.started_on, c.ended_on])).toEqual(expect.arrayContaining([
    ['Clube Azul de Volei', '2020-01-01', '2022-01-01'],
    ['Associacao Verde Esportes', '2022-01-01', '2024-01-01'],
    ['Arena Sol Volei de Praia', '2024-01-01', '2025-12-01'],
  ]));
  const est = cv.entries.find((e) => e.title === 'Circuito Estadual de Volei de Praia')!;
  expect([est.category, est.started_on, est.result]).toEqual(['Sub 17', '2025-03-01', 'Vice-campeão']);
  const arena = cv.entries.find((e) => e.title === '2a Edição Arena Sol')!;
  expect([arena.kind, arena.category, arena.result]).toEqual(['titulo', 'Sub 15', 'Campeão']);
  const cidade = cv.entries.find((e) => e.title === 'Torneio da Cidade')!;
  expect([cidade.category, cidade.description, cidade.result]).toEqual(['Sub 16', 'Quadra', '3º lugar']);
  expect(cv.entries.find((e) => e.title === 'Copa Regional de Seleções')!.started_on).toBe('2025-05-01');
  const awards = cv.entries.filter((e) => e.kind === 'premio');
  expect(awards.map((a) => [a.title, a.institution, a.started_on])).toEqual([
    ['Melhor defensora', null, '2023-01-01'],
    ['Atleta Destaque', 'Copa Primavera', '2023-01-01'],
    ['Atleta Destaque', 'Estadual', '2024-01-01'],
  ]);
  expect(cv.references).toEqual([
    { name: 'Treinador Um', role: 'Treinador', phone: '+5562.90000.1111' },
    { name: 'Treinador Dois', role: 'Treinador', phone: '+5562.90000.2222' },
  ]);
  expect(cv.entries.filter((e) => !e.started_on)).toEqual([]);
});

test('lê o formato simples do assistente externo', () => {
  const cv = parseCvText(`competição | Circuito Brasiliense | Sub 17 | 03/2025 | Vice-campeão | Brasília
prêmio | Melhor levantador | | 2023 | |
SOBRE MIM:
Atleta de vôlei de praia.
METAS:
Ser campeão mundial`);
  expect(cv.entries[0]).toMatchObject({ kind: 'competicao', title: 'Circuito Brasiliense', category: 'Sub 17', started_on: '2025-03-01', result: 'Vice-campeão', location: 'Brasília' });
  expect(cv.entries[1]).toMatchObject({ kind: 'premio', started_on: '2023-01-01' });
  expect(cv.about).toBe('Atleta de vôlei de praia.');
  expect(cv.goals).toEqual(['Ser campeão mundial']);
});
