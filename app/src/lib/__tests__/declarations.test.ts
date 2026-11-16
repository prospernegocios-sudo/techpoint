import { Packer } from 'docx';
import { strFromU8, unzipSync } from 'fflate';
import { ANNEXES, annexBlocks, buildDeclarationsDoc, orgAddress, type DeclCtx } from '../declarations';

const ctx: DeclCtx = {
  org: { name: 'BT Sport Club', legal_name: 'BT Sport Club Associação', cnpj: '11222333000181', street: 'Rua A', street_number: '10', city: 'Brasília', uf: 'DF', cep: '70000000', website: 'btsport.exemplo' },
  signer: { id: 's', full_name: 'Paulo Nogueira', role_title: 'Presidente', cpf: '52998224725', rg: '1234567', rg_issuer: 'SSP/DF', birth_date: '1980-01-02', address: 'Rua X', phone: '61999998888', email: 'p@x.com', term_start: null, term_end: null, is_signatory: true },
  officers: [],
  profile: { org_id: 'o', founded_on: null, proposal_number: '123/2026', partnership_object: 'Núcleo de vôlei de base', execution_place: 'Brasília/DF', sport: 'Vôlei', space_name: 'Arena BT', space_address: 'Rua B', space_owner: 'GDF', execution_period: '2027', counterpart_value: 1500000, counterpart_account: 'BB 123', signatory_id: null },
  date: new Date('2026-11-16T12:00:00'),
};
ctx.officers = [ctx.signer!];
const text = (a: Parameters<typeof annexBlocks>[0], c = ctx) => JSON.stringify(annexBlocks(a, c));

describe('declarações (Anexos I a XV)', () => {
  it('gera os 15 anexos, e o XV sai como minuta', () => {
    expect(ANNEXES).toHaveLength(15);
    expect(ANNEXES.filter((a) => a.draft).map((a) => a.key)).toEqual(['XV']);
    expect(text('XV')).toContain('MINUTA');
  });
  it('preenche dirigente, CNPJ, proposta e objeto', () => {
    const t = text('VI');
    expect(t).toContain('Paulo Nogueira');
    expect(t).toContain('529.982.247-25');
    expect(t).toContain('11.222.333/0001-81');
    expect(t).toContain('123/2026');
    expect(t).toContain('Núcleo de vôlei de base');
    expect(text('XIII')).toContain('1.500.000,00');
    expect(orgAddress(ctx.org)).toBe('Rua A, 10 – Brasília/DF – CEP 70000-000');
  });
  it('sem dados, deixa pontilhado para preencher à mão', () => {
    const t = text('IV', { ...ctx, signer: null, profile: null });
    expect(t).toContain('......');
  });
  it('relação de dirigentes (Anexo IX) em tabela', () => {
    const blocks = annexBlocks('IX', ctx);
    const table = blocks.find((b) => b.t === 'table');
    expect(table && table.t === 'table' && table.rows[1][0]).toBe('Paulo Nogueira');
  });
  it('monta um Word válido com todas as declarações', async () => {
    const buf = await Packer.toBuffer(buildDeclarationsDoc(ANNEXES.map((a) => a.key), ctx));
    const xml = strFromU8(unzipSync(new Uint8Array(buf))['word/document.xml']);
    expect(xml).toContain('Paulo Nogueira');
    expect(xml).toContain('ANEXO XV');
  });
});
