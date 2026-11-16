// Declarações do checklist do Termo de Fomento (Revelar Talentos), Anexos I a XV, em Word (decisão do TG: 2a).
// Os textos seguem os modelos do Ministério do Esporte (SNE/MEsp). O Anexo XV não veio no checklist:
// sai como MINUTA, marcada no próprio documento, para conferir com o modelo oficial.
import { AlignmentType, BorderStyle, Document, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import type { HabilProfile, Officer } from './habilitation';

export type DeclOrg = {
  name: string; legal_name?: string | null; cnpj?: string | null; street?: string | null; street_number?: string | null;
  complement?: string | null; district?: string | null; city?: string | null; uf?: string | null; cep?: string | null; website?: string | null;
};
export type DeclCtx = { org: DeclOrg; signer: Officer | null; officers: Officer[]; profile: HabilProfile | null; date: Date };

export type Annex = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' | 'VIII' | 'IX' | 'X' | 'XI' | 'XII' | 'XIII' | 'XIV' | 'XV';
export const ANNEXES: { key: Annex; title: string; draft?: boolean }[] = [
  { key: 'I', title: 'Ofício de solicitação de apoio financeiro' },
  { key: 'II', title: 'Atestado de Capacidade Técnica e Gerencial' },
  { key: 'III', title: 'Declaração de Cessão/Posse de Uso de Espaço Físico' },
  { key: 'IV', title: 'Declaração da Não Ocorrência de Impedimentos, Art. 39 da Lei nº 13.019/2014' },
  { key: 'V', title: 'Declaração sobre Instalações e Condições Materiais' },
  { key: 'VI', title: 'Declaração da Não Utilização dos Recursos para Finalidade Alheia' },
  { key: 'VII', title: 'Declaração do Art. 27, do Decreto nº 8.726/2016' },
  { key: 'VIII', title: 'Declaração de Acessibilidade' },
  { key: 'IX', title: 'Declaração com a Relação Atualizada dos Dirigentes da Entidade' },
  { key: 'X', title: 'Declaração que Não Recebe Recursos para a mesma Finalidade' },
  { key: 'XI', title: 'Declaração de Não Contratação com Recursos da Parceria' },
  { key: 'XII', title: 'Declaração de Autonomia Financeira – Art. 299 Código Penal' },
  { key: 'XIII', title: 'Declaração de Disponibilidade de Contrapartida Financeira' },
  { key: 'XIV', title: 'Declaração de comprovação de que inexista irregularidade' },
  { key: 'XV', title: 'Declaração de Inexistência de Nepotismo e de Vedações às Emendas Parlamentares', draft: true },
];

const BLANK = '..............................';
const v = (s: string | null | undefined, blank = BLANK) => (s && s.trim() ? s.trim() : blank);
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const longDate = (d: Date) => `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
const fmtCnpj = (c?: string | null) => (c && /^\d{14}$/.test(c) ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : v(c));
const fmtCpf = (c?: string | null) => (c && /^\d{11}$/.test(c) ? c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : v(c));
const fmtPhone = (p?: string | null) => (p && /^\d{10,11}$/.test(p) ? p.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') : v(p, ''));
const fmtDate = (d?: string | null) => (d ? d.split('-').reverse().join('/') : '');
const money = (n?: number | null) => (n == null ? BLANK : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export function orgAddress(o: DeclOrg): string {
  const line = [o.street, o.street_number].filter(Boolean).join(', ');
  const parts = [line, o.complement, o.district, o.city && o.uf ? `${o.city}/${o.uf}` : o.city, o.cep ? `CEP ${o.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}` : null];
  return v(parts.filter(Boolean).join(' – '));
}

/** Uma declaração em blocos simples (texto, lista, tabela). Separado do Word para poder testar. */
export type Block =
  | { t: 'title'; text: string } | { t: 'p'; text: string; bold?: boolean; center?: boolean; note?: boolean }
  | { t: 'list'; items: string[] } | { t: 'table'; rows: string[][] } | { t: 'sign' };

export function annexBlocks(a: Annex, c: DeclCtx): Block[] {
  const ent = v(c.org.legal_name || c.org.name);
  const s = c.signer;
  const p = c.profile;
  const proposal = v(p?.proposal_number, '...................');
  const object = v(p?.partnership_object);
  const place = v(p?.execution_place);
  const ident = `Eu, ${v(s?.full_name)}, portador(a) da carteira de identidade nº ${v(s?.rg, '...................')}, expedida pela ${v(s?.rg_issuer, '...............')}, e do CPF nº ${fmtCpf(s?.cpf)}, na condição de representante legal da ${ent}, inscrita no CNPJ nº ${fmtCnpj(c.org.cnpj)}`;
  const forProposal = `${ident}, para fins de formalização da proposta cadastrada no Portal Transferegov.br nº ${proposal}`;
  const title = ANNEXES.find((x) => x.key === a)!.title;
  const head: Block[] = [{ t: 'p', text: `ANEXO ${a}`, bold: true, center: true }, { t: 'title', text: title }];

  switch (a) {
    case 'I': return [
      { t: 'p', text: 'ANEXO I', bold: true, center: true },
      { t: 'p', text: `Ofício nº ____/${c.date.getFullYear()}.` },
      { t: 'p', text: `${v(c.org.city, 'Cidade')}/${v(c.org.uf, 'UF')}, ${longDate(c.date)}.` },
      { t: 'p', text: 'À Secretaria Nacional de Excelência Esportiva\nSQSW – 301/302, LOTE 1 – TÉRREO – SALA 02, EDIFÍCIO MONTES – SETOR SUDOESTE\nCEP: 70673-150. BRASÍLIA / DF.' },
      { t: 'p', text: `Assunto: solicitação de apoio financeiro para ações de alto rendimento – ${object}.`, bold: true },
      { t: 'p', text: `Em nome da ${ent}, sem fins lucrativos com finalidade esportiva conforme estabelecido em seu Estatuto Social, inscrita no CNPJ/MF sob o nº ${fmtCnpj(c.org.cnpj)}, com endereço ${orgAddress(c.org)}, representada conforme seus atos constitutivos, vem solicitar apoio financeiro para ${object}, na modalidade ${v(p?.sport)}, em ${place}, visando o desenvolvimento desse esporte na região, a qual possui alto potencial esportivo, proporcionando o fortalecimento do esporte de alto rendimento no país.` },
      { t: 'p', text: 'Atenciosamente,' },
      { t: 'sign' },
    ];
    case 'II': return [...head,
      { t: 'p', text: `${ident}, ATESTO, para fins de formalização da proposta cadastrada no Portal Transferegov.br nº ${proposal} com a Secretaria Nacional de Excelência Esportiva - SNE, do Ministério do Esporte - MEsp, que a ${ent}, situada na ${orgAddress(c.org)}, apresenta capacidade técnica e operacional para ${object} em atendimento ao art. 33, V, da Lei nº 13.019/2014 c/c art. 26, III, do Decreto nº 8.726/2016, considerando as experiências adquiridas na execução de projeto(s)/ação(ões) na(s) área(s) esportiva(s), devidamente especificada(s) no histórico em anexo.` },
      { t: 'p', text: 'O(s) projeto(s)/ação(ões) descrito(s) foi(ram) executado(s) com qualidade, não existindo, até a presente data, fatos que desabonem a conduta e a responsabilidade da entidade com as obrigações assumidas, confirmando assim a capacidade técnica e operacional para a execução do que foi proposto.' },
      { t: 'sign' },
      { t: 'p', text: 'ANEXO HISTÓRICO', bold: true, center: true },
      { t: 'p', text: 'I. Apresentação:', bold: true },
      { t: 'list', items: ['Nome do projeto/ação:', 'Entidades parceiras:', 'Período de vigência:', 'Número de beneficiados:', 'Ações/atividades desenvolvidas:', 'Documentos comprobatórios a serem encaminhados em anexo:'] },
      { t: 'list', items: ['a) fotos;', 'b) materiais de divulgação (folders, cartazes etc.) e matérias veiculadas na mídia (jornal, revistas etc.); e', 'c) cópia de instrumento específico (contratos, convênios, termos de parceria etc.).'] },
    ];
    case 'III': return [...head,
      { t: 'p', text: `${forProposal}.` },
      { t: 'p', text: `DECLARO que o espaço físico abaixo qualificado pertence a ${v(p?.space_owner)}, assim como está disponível, apto e compatível para o atendimento do público-alvo, no que tange ao desenvolvimento das atividades propostas na realização de ${object}, que ocorrerá no período de ${v(p?.execution_period)}.` },
      { t: 'table', rows: [['NOME DO ESPAÇO FÍSICO', 'ENDEREÇO DO ESPAÇO FÍSICO'], [v(p?.space_name, ''), v(p?.space_address, '')]] },
      { t: 'sign' },
      { t: 'p', text: 'Assinatura do representante legal da entidade proponente OU do proprietário do espaço físico a ser utilizado.', note: true },
    ];
    case 'IV': return [...head,
      { t: 'p', text: `${forProposal}.` },
      { t: 'p', text: `DECLARO, para os devidos fins, nos termos do art. 26, caput, inciso IX, do Decreto nº 8.726, de 2016, que a ${ent} e seus dirigentes não incorrem em quaisquer das vedações previstas no art. 39 da Lei nº 13.019/2014 c/c art. 26, IX, do Decreto nº 8.726/2016. Nesse sentido, a citada entidade:` },
      { t: 'list', items: [
        'a) Está regularmente constituída ou, se estrangeira, está autorizada a funcionar no território nacional;',
        'b) Não foi omissa no dever de prestar contas de parceria anteriormente celebrada;',
        'c) Não tem como dirigente membro de Poder ou do Ministério Público, ou dirigente de órgão ou entidade da administração pública da mesma esfera governamental na qual será celebrado o termo de fomento, estendendo-se a vedação aos respectivos cônjuges ou companheiros, bem como parentes em linha reta, colateral ou por afinidade, até o segundo grau. Observação: a presente vedação não se aplica às entidades que, pela sua própria natureza, sejam constituídas pelas autoridades ora referidas (o que deverá ser devidamente informado e justificado pela OSC), sendo vedado que a mesma pessoa figure no instrumento de parceria simultaneamente como dirigente e administrador público (art. 39, §5º, da Lei nº 13.019, de 2014);',
        'd) Não teve as contas rejeitadas pela administração pública nos últimos cinco anos, observadas as exceções previstas no art. 39, caput, inciso IV, alíneas “a” a “c”, da Lei nº 13.019, de 2014;',
        'e) Não se encontra submetida aos efeitos das sanções de suspensão de participação em licitação e impedimento de contratar com a administração, declaração de inidoneidade para licitar ou contratar com a administração pública, suspensão temporária da participação em chamamento público e impedimento de celebrar parceria ou contrato com órgãos e entidades da esfera de governo da administração pública sancionadora e, por fim, declaração de inidoneidade para participar de chamamento público ou celebrar parceria ou contrato com órgãos e entidades de todas as esferas de governo;',
        'f) Não teve contas de parceria julgadas irregulares ou rejeitadas por Tribunal ou Conselho de Contas de qualquer esfera da Federação, em decisão irrecorrível, nos últimos 8 (oito) anos; e',
        'g) Não tem entre seus dirigentes pessoa cujas contas relativas a parcerias tenham sido julgadas irregulares ou rejeitadas por Tribunal ou Conselho de Contas de qualquer esfera da Federação, em decisão irrecorrível, nos últimos 8 (oito) anos; julgada responsável por falta grave e inabilitada para o exercício de cargo em comissão ou função de confiança, enquanto durar a inabilitação; ou considerada responsável por ato de improbidade, enquanto durarem os prazos estabelecidos nos incisos I, II e III do art. 12 da Lei nº 8.429, de 2 de junho de 1992.',
      ] },
      { t: 'sign' },
    ];
    case 'V': return [...head,
      { t: 'p', text: `${forProposal}.` },
      { t: 'p', text: `DECLARO, em conformidade com o art. 33, caput, inciso V, alínea “c”, da Lei nº 13.019, de 2014, c/c o art. 26, caput, inciso X, do Decreto nº 8.726, de 2016, que a ${ent} dispõe de instalações e outras condições materiais para o desenvolvimento das atividades ou projetos previstos na parceria e o cumprimento das metas estabelecidas, bem como pretende, ainda, contratar ou adquirir com recursos da parceria outros bens para tanto.` },
      { t: 'sign' },
    ];
    case 'VI': return [...head,
      { t: 'p', text: `${forProposal}.` },
      { t: 'p', text: `DECLARO, em conformidade com o art. 45 da Lei nº 13.019/2014 c/c art. 27, III, do Decreto nº 8.726/2016, que os recursos do presente termo não serão utilizados para finalidade alheia aos relacionados na proposta inserida no Portal Transferegov.br sob nº ${proposal}, cujo objeto é ${object}, em ${place}, e não pagará, a qualquer título, servidor ou empregado público com recursos vinculados à parceria, salvo nas exceções previstas em lei.` },
      { t: 'sign' },
    ];
    case 'VII': return [...head,
      { t: 'p', text: `${forProposal}.` },
      { t: 'p', text: 'DECLARO, para os devidos fins, nos termos dos arts. 26, caput, inciso VII, e 27 do Decreto nº 8.726, de 2016, que:' },
      { t: 'list', items: [
        'I. Não há em seu quadro de dirigentes: (a) membro de Poder ou do Ministério Público ou dirigente de órgão ou entidade da administração pública federal; ou (b) cônjuge, companheiro ou parente em linha reta, colateral ou por afinidade, até o segundo grau, das pessoas mencionadas na alínea “a”.',
        'II. Não contratará com recursos da parceria, para prestação de serviços, servidor ou empregado público, inclusive aquele que exerça cargo em comissão ou função de confiança, de órgão ou entidade da administração pública federal celebrante, ou seu cônjuge, companheiro ou parente em linha reta, colateral ou por afinidade, até o segundo grau, ressalvadas as hipóteses previstas em lei específica e na lei de diretrizes orçamentárias;',
        'III. Não serão remunerados, a qualquer título, com os recursos repassados: (a) membro de Poder ou do Ministério Público ou dirigente de órgão ou entidade da administração pública federal; (b) servidor ou empregado público, inclusive aquele que exerça cargo em comissão ou função de confiança, de órgão ou entidade da administração pública federal celebrante, ou seu cônjuge, companheiro ou parente em linha reta, colateral ou por afinidade, até o segundo grau, ressalvadas as hipóteses previstas em lei específica e na lei de diretrizes orçamentárias; e (c) pessoas naturais condenadas pela prática de crimes contra a administração pública ou contra o patrimônio público, de crimes eleitorais para os quais a lei comine pena privativa de liberdade, e de crimes de lavagem ou ocultação de bens, direitos e valores.',
      ] },
      { t: 'sign' },
    ];
    case 'VIII': return [...head,
      { t: 'p', text: `${forProposal}.` },
      { t: 'p', text: 'DECLARO, para os devidos fins de direito, que adotará medidas de acessibilidade para pessoas com deficiência, em conformidade com o previsto na Lei nº 13.146, de 6 de julho de 2015 – Estatuto da Pessoa com Deficiência, bem como a Lei nº 10.741, de 1º de outubro de 2003.' },
      { t: 'sign' },
    ];
    case 'IX': return [...head,
      { t: 'p', text: `${forProposal}.` },
      { t: 'p', text: `DECLARO, nos termos do art. 34, inciso VI, da Lei nº 13.019/2014 e art. 26, inciso VII, do Decreto nº 8.726/2016, a veracidade das informações relativas à relação nominal atualizada dos dirigentes da ${ent}, conforme descrito abaixo:` },
      { t: 'table', rows: [
        ['Nome do dirigente', 'Cargo', 'RG/órgão expedidor', 'CPF', 'Data de nascimento', 'Endereço residencial', 'Telefone', 'E-mail'],
        ...(c.officers.length ? c.officers : [null]).map((o) => o
          ? [o.full_name, o.role_title, [o.rg, o.rg_issuer].filter(Boolean).join(' / '), fmtCpf(o.cpf), fmtDate(o.birth_date), o.address ?? '', fmtPhone(o.phone), o.email ?? '']
          : ['', '', '', '', '', '', '', '']),
      ] },
      { t: 'sign' },
    ];
    case 'X': return [...head,
      { t: 'p', text: `${forProposal}.` },
      { t: 'p', text: `DECLARO, para todos os fins de direito, que a entidade a qual represento não recebe recursos financeiros de outra entidade, pública ou privada, para a mesma finalidade na execução das ações apresentadas e especificadas na Proposta nº ${proposal}, cadastrada no Portal Transferegov.br, para ${object}, em ${place}, evitando desta forma a sobreposição de recursos.` },
      { t: 'sign' },
    ];
    case 'XI': return [...head,
      { t: 'p', text: `${ident},` },
      { t: 'p', text: `DECLARO, para fins de direito, quanto à proposta inserida no Portal Transferegov.br sob nº ${proposal}, cujo objeto é ${object}, em ${place}, que a entidade se compromete a não contratar, com recursos da parceria, empresas que se enquadrem nas seguintes situações:` },
      { t: 'list', items: [
        'a) sejam do mesmo grupo econômico;',
        'b) tenham participação societária cruzada;',
        'c) pertençam a ou tenham participação societária de parentes de dirigentes ou funcionários da entidade;',
        'd) destinar recursos de parcerias decorrentes de emendas parlamentares a pessoas físicas ou jurídicas que tenham, em seus quadros diretivos, societários ou administrativos, cônjuge, companheiro ou parente em linha reta, colateral ou por afinidade, até o terceiro grau, do parlamentar responsável pela indicação da emenda ou de assessor a ele vinculado;',
        'e) possuam o mesmo endereço, telefone e CNPJ; e',
        'f) apresentem incompatibilidade entre o objeto social e inscrição na Receita Federal da empresa com o serviço ou fornecimento de material relacionado à respectiva cotação - situação cadastral dos fornecedores e a classificação de atividades econômicas - CNAE.',
      ] },
      { t: 'sign' },
    ];
    case 'XII': return [...head,
      { t: 'p', text: `${ident}, com sede em ${orgAddress(c.org)}, para fins de formalização da proposta cadastrada no Portal Transferegov.br nº ${proposal},` },
      { t: 'p', text: `DECLARO que a ${ent} possui autonomia financeira, de acordo com as demonstrações contábeis devidamente escrituradas conforme exigido por lei.` },
      { t: 'p', text: `Certificamos que todas as operações financeiras realizadas pela ${ent} estão em conformidade com as normas e regulamentos estabelecidos pelos órgãos competentes, garantindo transparência e responsabilidade na gestão dos recursos.` },
      { t: 'p', text: 'Ressaltamos ainda que qualquer irregularidade ou falsificação de documentos relacionados às finanças da instituição será tratada com rigor, conforme previsto na base legal da SNE/MEsp e no Art. 299 do Código Penal Brasileiro.' },
      { t: 'p', text: `Esta declaração é emitida para os devidos fins legais e pode ser utilizada como comprovação da situação financeira da ${ent}.` },
      { t: 'sign' },
    ];
    case 'XIII': return [...head,
      { t: 'p', text: 'PROJETOS ACIMA DE R$ 1.000.000,00', bold: true, center: true },
      { t: 'p', text: `${ident},` },
      { t: 'p', text: `DECLARO, para fins de direito, quanto à proposta inserida no Portal Transferegov.br sob nº ${proposal}, cujo objeto é ${object}, em ${place}, que a entidade ${ent} dispõe de recursos financeiros para arcar com a contrapartida no valor de R$ ${money(p?.counterpart_value)}, conforme demonstração de crédito devidamente apresentada no extrato bancário (${v(p?.counterpart_account, 'conta, banco, extrato anexo')}).` },
      { t: 'sign' },
    ];
    case 'XIV': return [...head,
      { t: 'p', text: 'EMENDA PARLAMENTAR', bold: true, center: true },
      { t: 'p', text: `${ident}, com endereço eletrônico ${v(c.org.website)}, para fins de formalização da proposta cadastrada no Portal Transferegov.br nº ${proposal},` },
      { t: 'p', text: 'DECLARO, quanto às emendas (de todas as modalidades) destinadas a ONGs e entidades do Terceiro Setor, que inexiste irregularidade e que os valores recebidos de emendas anteriores estão publicados no sítio da entidade na internet.' },
      { t: 'p', text: 'Anexar: print da tela no site da organização esportiva, dando publicidade aos recursos recebidos de emendas parlamentares. (Parecer de Força Executória nº 00446/2024/SGCT/AGU)', note: true },
      { t: 'sign' },
    ];
    case 'XV': return [
      { t: 'p', text: 'MINUTA – o modelo oficial do Anexo XV não veio no checklist do Ministério. Confira com o modelo oficial (SNE/MEsp) antes de assinar e apague este aviso.', note: true },
      ...head,
      { t: 'p', text: `${forProposal}.` },
      { t: 'p', text: `DECLARO, para os devidos fins, em observância à Súmula Vinculante nº 13 do Supremo Tribunal Federal e ao art. 11, inciso XI, da Lei nº 8.429/1992, que a ${ent}:` },
      { t: 'list', items: [
        'a) não possui em seu quadro de dirigentes, nem contratará com recursos da parceria, cônjuge, companheiro ou parente em linha reta, colateral ou por afinidade, até o terceiro grau, de autoridade ou de servidor investido em cargo de direção, chefia ou assessoramento do órgão concedente, em situação que configure nepotismo; e',
        'b) não destinará recursos de parcerias decorrentes de emendas parlamentares a pessoas físicas ou jurídicas que tenham, em seus quadros diretivos, societários ou administrativos, cônjuge, companheiro ou parente em linha reta, colateral ou por afinidade, até o terceiro grau, do parlamentar responsável pela indicação da emenda ou de assessor a ele vinculado.',
      ] },
      { t: 'sign' },
    ];
  }
}

// ---------------------------------------------------------------------------------------------
// Word
// ---------------------------------------------------------------------------------------------
const FONT = 'Arial';
const run = (text: string, o: { bold?: boolean; italic?: boolean; color?: string; size?: number } = {}) =>
  text.split('\n').map((line, i) => new TextRun({ text: line, font: FONT, size: o.size ?? 22, bold: o.bold, italics: o.italic, color: o.color, break: i ? 1 : 0 }));

function signature(c: DeclCtx): Paragraph[] {
  const s = c.signer;
  return [
    new Paragraph({ spacing: { before: 360 }, children: run(`${v(c.org.city, 'Cidade')}/${v(c.org.uf, 'UF')}, ${longDate(c.date)}.`) }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 720 }, children: run('_______________________________________________') }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: run(v(s?.full_name, 'NOME DO RESPONSÁVEL'), { bold: true }) }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: run(`${s?.role_title ?? 'Dirigente'} – representante legal da entidade proponente`) }),
  ];
}

function toParagraphs(blocks: Block[], c: DeclCtx, first: boolean): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  blocks.forEach((b, i) => {
    const pageBreakBefore = !first && i === 0;
    if (b.t === 'title') out.push(new Paragraph({ pageBreakBefore, alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: run(b.text, { bold: true, size: 24 }) }));
    else if (b.t === 'p') out.push(new Paragraph({
      pageBreakBefore, alignment: b.center ? AlignmentType.CENTER : b.text.includes('\n') ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
      spacing: { before: b.center && b.bold && i > 1 ? 480 : 0, after: 200, line: 300 },
      children: run(b.text, b.note ? { italic: true, color: 'B00020', size: 20 } : { bold: b.bold }),
    }));
    else if (b.t === 'list') b.items.forEach((it) => out.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { left: 360 }, spacing: { after: 120, line: 300 }, children: run(it) })));
    else if (b.t === 'table') {
      const border = { style: BorderStyle.SINGLE, size: 4, color: '666666' };
      out.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: b.rows.map((r, ri) => new TableRow({
          children: r.map((cell) => new TableCell({
            borders: { top: border, bottom: border, left: border, right: border },
            children: [new Paragraph({ children: run(cell || ' ', { bold: ri === 0, size: b.rows[0].length > 4 ? 16 : 20 }) })],
          })),
        })),
      }));
      out.push(new Paragraph({ children: [] }));
    } else if (b.t === 'sign') out.push(...signature(c));
  });
  return out;
}

/** Monta o Word com as declarações pedidas, uma por página. */
export function buildDeclarationsDoc(annexes: Annex[], c: DeclCtx): Document {
  const children = annexes.flatMap((a, i) => toParagraphs(annexBlocks(a, c), c, i === 0));
  return new Document({
    creator: 'TechPoint',
    title: annexes.length === 1 ? `Anexo ${annexes[0]}` : 'Declarações – Termo de Fomento',
    sections: [{ properties: { page: { margin: { top: 1700, bottom: 1134, left: 1418, right: 1134 } } }, children }],
  });
}

export function declarationsFileName(annexes: Annex[], orgName: string): string {
  const slug = orgName.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 30);
  return annexes.length === 1 ? `Anexo-${annexes[0]}_${slug}.docx` : `Declaracoes-Termo-de-Fomento_${slug}.docx`;
}
