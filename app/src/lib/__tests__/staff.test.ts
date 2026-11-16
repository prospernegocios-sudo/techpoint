import { Packer } from 'docx';
import { strFromU8, unzipSync } from 'fflate';
import { buildPointRows, buildPointSheetDoc, cobProgress, fmtMinutes, type StaffRecord } from '../staff';

jest.mock('../supabase', () => ({ supabase: {} }));
jest.mock('../image-reduce', () => ({ reducePicked: jest.fn() }));
jest.mock('../attendance', () => ({ base64ToBytes: jest.fn() }));

const rec = (p: Partial<StaffRecord & { name: string; team: string; starts_at: string }>) => ({
  id: 'x', org_id: 'o', event_id: 'e1', profile_id: 'u1', kind: 'check_in' as const, server_at: '2027-04-01T18:00:00Z', distance_m: 10,
  status: 'valid' as const, justification: null, name: 'Ricardo Almeida', team: 'Sub 17', starts_at: '2027-04-01T18:00:00Z', ...p,
});

describe('Ponto dos profissionais e cursos do COB', () => {
  it('junta entrada e saída por treino e calcula as horas', () => {
    const rows = buildPointRows([
      rec({}), rec({ kind: 'check_out', server_at: '2027-04-01T19:45:00Z' }),
      rec({ event_id: 'e2', starts_at: '2027-04-03T18:00:00Z', server_at: '2027-04-03T18:05:00Z', status: 'pending' }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].minutes).toBe(105);
    expect(rows[1]).toMatchObject({ minutes: null, pending: true });
    expect(fmtMinutes(105)).toBe('1h45');
  });
  it('conta quem tem os 2 certificados', () => {
    const p = cobProgress([
      { id: 'a', name: 'A', who: 'atleta', done: { cob_antirracismo: 'x', cob_manipulacao: 'y' } },
      { id: 'b', name: 'B', who: 'atleta', done: { cob_antirracismo: 'x', cob_manipulacao: null } },
    ]);
    expect(p).toEqual({ complete: 1, total: 2, pct: 50 });
  });
  it('folha de ponto em Word com o profissional e o total', async () => {
    const rows = buildPointRows([rec({}), rec({ kind: 'check_out', server_at: '2027-04-01T19:45:00Z' })]);
    const xml = strFromU8(unzipSync(new Uint8Array(await Packer.toBuffer(buildPointSheetDoc({ orgName: 'BT Sport Club', projectName: 'Núcleo', from: '2027-03-01', to: '2027-04-30', rows }))))['word/document.xml']);
    for (const t of ['FOLHA DE PONTO', 'Ricardo Almeida', '1h45', 'TOTAL']) expect(xml).toContain(t);
  });
});
