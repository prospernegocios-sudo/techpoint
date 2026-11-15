// Termo de consentimento do responsável. Versão v2 (rascunho): aguarda aprovação do dono do produto e revisão jurídica.
// Ao aprovar, trocar a versão para 'consentimento-AAAA-MM-v2' (sem "rascunho").
export const CONSENT_VERSION = 'consentimento-2026-11-v2-rascunho';

export const consentItems = [
  { key: 'attendance', required: true, title: 'Registro de presença', text: 'Registrar a presença do atleta nos treinos com localização (lida só no momento do check-in), foto tirada na hora e horário.' },
  { key: 'photos', required: true, title: 'Fotos como prova de presença', text: 'Guardar a foto de cada registro por 24 meses, vista pela equipe da entidade e usada nos relatórios de prestação de contas.' },
  { key: 'sponsors', required: false, title: 'Compartilhamento com patrocinadores', text: 'Permitir que os patrocinadores do projeto vejam os registros e fotos do atleta, só daquele projeto, sem poder alterar.' },
  { key: 'documents', required: false, title: 'Documentos do atleta', text: 'Guardar documentos enviados por você, pelo atleta ou pela entidade (atestado médico, RG ou certidão, CPF, autorizações), vistos só pela equipe da entidade, pelo atleta e pelos responsáveis.' },
  { key: 'notifications', required: false, title: 'Avisos para o responsável', text: 'Receber no celular os avisos de chegada e saída do atleta.' },
] as const;

export const consentIntro =
  'A entidade esportiva usa o TechPoint para controlar a presença do atleta nos treinos e comprovar a execução de projetos esportivos. ' +
  'Os dados ficam em servidores no Brasil, protegidos e vistos só por quem precisa. ' +
  'Você pode revogar este consentimento a qualquer momento pelo app e pedir a exclusão da conta. ' +
  'Dados exigidos para a prestação de contas ficam arquivados, sem uso, pelo prazo legal. Detalhes na Política de Privacidade (techpoint.expo.app/privacidade).';
