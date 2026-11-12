import { maskCep, maskCnpj, maskCpf, maskPhone, validCnpj, validCpf, validEmail } from '../br';

describe('documentos brasileiros', () => {
  it('confere CPF pelos dígitos verificadores', () => {
    expect(validCpf('529.982.247-25')).toBe(true);
    expect(validCpf('111.444.777-35')).toBe(true);
    expect(validCpf('529.982.247-24')).toBe(false);
    expect(validCpf('111.111.111-11')).toBe(false);
  });
  it('confere CNPJ pelos dígitos verificadores', () => {
    expect(validCnpj('11.222.333/0001-81')).toBe(true);
    expect(validCnpj('11.444.777/0001-61')).toBe(true);
    expect(validCnpj('11.222.333/0001-82')).toBe(false);
    expect(validCnpj('00.000.000/0000-00')).toBe(false);
  });
  it('aplica máscaras enquanto digita', () => {
    expect(maskCpf('52998224725')).toBe('529.982.247-25');
    expect(maskCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(maskCep('70000000')).toBe('70000-000');
    expect(maskPhone('61999990000')).toBe('(61) 99999-0000');
    expect(maskPhone('6133334444')).toBe('(61) 3333-4444');
  });
  it('confere formato de e-mail', () => {
    expect(validEmail('contato@dfvolei.com.br')).toBe(true);
    expect(validEmail('contato@dfvolei')).toBe(false);
  });
});
