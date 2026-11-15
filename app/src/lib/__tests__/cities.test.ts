import { CAPITALS, allCities, searchCities } from '../cities';
test('todas as cidades e capitais', () => {
  expect(allCities().length).toBe(5570);
  expect(CAPITALS.length).toBe(27);
  expect(searchCities('')).toHaveLength(27);
});
test('busca sem acento, começo primeiro', () => {
  expect(searchCities('brasil')[0].label).toBe('Brasília - DF');
  expect(searchCities('goiania')[0].label).toBe('Goiânia - GO');
  expect(searchCities('sao paulo').map((c) => c.label)).toContain('São Paulo - SP');
  expect(searchCities('Anápolis - GO')[0].label).toBe('Anápolis - GO');
});
