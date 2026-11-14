// Termo de consentimento do responsável (versão de teste; texto final com revisão jurídica antes do lançamento).
export const CONSENT_VERSION = 'consentimento-2026-11-v1-teste';

export const consentItems = [
  { key: 'attendance', required: true, title: 'Registro de presença', text: 'Registrar a presença do atleta nos treinos com localização (lida só no momento do check-in), foto tirada na hora e horário.' },
  { key: 'photos', required: true, title: 'Fotos como prova de presença', text: 'Guardar a foto de cada registro por 24 meses, vista pela equipe da entidade e usada nos relatórios de prestação de contas.' },
  { key: 'sponsors', required: false, title: 'Compartilhamento com patrocinadores', text: 'Permitir que os patrocinadores do projeto vejam os registros e fotos do atleta, só daquele projeto, sem poder alterar.' },
  { key: 'notifications', required: false, title: 'Avisos para o responsável', text: 'Receber no celular os avisos de chegada e saída do atleta.' },
] as const;

export const consentIntro =
  'O TechPoint trata os dados do atleta para controlar a presença nos treinos e comprovar a execução de projetos esportivos. ' +
  'Você pode revogar este consentimento a qualquer momento pelo app, e pedir a exclusão dos dados.';
