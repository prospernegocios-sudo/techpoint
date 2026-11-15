// Política de Privacidade (página pública; link exigido pelo Google Play).
// Rascunho v1: aguarda aprovação do dono do produto e revisão jurídica.
import { Stack } from 'expo-router';
import { Card, Screen, T } from '@/components/ui';

const VERSION = 'Versão 1 (rascunho) · 15/11/2026';

const sections: { title: string; items: string[] }[] = [
  { title: '1. Quem somos', items: [
    'O TechPoint é uma plataforma da Prosper Negócios para clubes, escolas e projetos esportivos registrarem a presença de atletas e prestarem contas a patrocinadores e órgãos públicos.',
    'A entidade esportiva (clube, escola ou projeto) decide como usa os dados dos seus atletas: ela é a controladora. A Prosper Negócios trata os dados em nome da entidade: é a operadora (LGPD, art. 5º).',
  ] },
  { title: '2. Quais dados tratamos', items: [
    'Cadastro: nome, data de nascimento, e-mail, telefone, equipe e papel (atleta, responsável, treinador, gestor).',
    'Presença: data e hora oficiais do servidor, localização lida só no momento do check-in e do check-out, foto tirada na hora e identificação do aparelho (para evitar fraudes).',
    'Documentos enviados: atestado médico, RG ou certidão, CPF, comprovante de residência e autorizações.',
    'Responsáveis: vínculo com o atleta, consentimento (com data, hora e versão do termo) e o aparelho para receber avisos.',
    'Registros de segurança: quem fez cada alteração e quando (auditoria).',
  ] },
  { title: '3. Para que usamos', items: [
    'Registrar e comprovar a presença nos treinos e atividades.',
    'Gerar relatórios de frequência e de prestação de contas de projetos (Lei de Incentivo ao Esporte, convênios, emendas e patrocínios).',
    'Avisar o responsável sobre a chegada e a saída do atleta, quando autorizado.',
    'Manter a segurança da plataforma e evitar fraudes.',
    'Não vendemos dados, não usamos para publicidade e não exibimos anúncios.',
  ] },
  { title: '4. Bases legais (LGPD)', items: [
    'Crianças e adolescentes: consentimento específico de pelo menos um dos pais ou do responsável legal, no app ou em papel na entidade (art. 14). Sem ele, o atleta menor não registra presença.',
    'Execução do serviço contratado pela entidade e pelo usuário (art. 7º, V).',
    'Cumprimento de obrigação legal ou regulatória, como a prestação de contas de projetos com recursos públicos ou incentivados (art. 7º, II, e art. 11, II, a).',
    'Segurança e prevenção de fraude nos registros de presença (legítimo interesse, art. 7º, IX), sempre com o mínimo de dados.',
  ] },
  { title: '5. Com quem compartilhamos', items: [
    'Com a equipe da entidade (gestores e treinadores) e com os responsáveis do próprio atleta.',
    'Com patrocinadores do projeto, só se o responsável autorizar, só daquele projeto e sem poder alterar.',
    'Com órgãos públicos e financiadores, nos relatórios de prestação de contas exigidos.',
    'Com fornecedores que mantêm a plataforma funcionando: banco de dados e arquivos (Supabase, servidores em São Paulo), hospedagem do site e envio do app (Expo) e entrega dos avisos no celular (Google Firebase). Alguns desses serviços podem processar dados fora do Brasil, com garantias contratuais de proteção (art. 33).',
  ] },
  { title: '6. Por quanto tempo guardamos', items: [
    'Fotos dos registros de presença: 24 meses, salvo quando o prazo legal da prestação de contas exigir mais.',
    'Dados exigidos para a prestação de contas: arquivados, sem outro uso, pelo prazo da norma do projeto ou do convênio; depois são apagados.',
    'Ao pedir a exclusão da conta, ela é desativada em até 15 dias. O que a lei manda guardar fica arquivado até o fim do prazo (art. 16).',
  ] },
  { title: '7. Seus direitos', items: [
    'Confirmar se tratamos seus dados, acessá-los, corrigi-los, pedir a portabilidade, saber com quem compartilhamos, revogar o consentimento e pedir a exclusão (art. 18).',
    'Revogar o consentimento: no app, área do responsável → “Ver ou revogar a autorização”.',
    'Excluir a conta: no app, Perfil → “Excluir minha conta”, ou em techpoint.expo.app/excluir-conta.',
    'Outros pedidos: fale com a entidade esportiva ou com a Prosper Negócios pelo WhatsApp (61) 98340-0404. Você também pode reclamar à ANPD (gov.br/anpd).',
  ] },
  { title: '8. Segurança', items: [
    'Conexão protegida (HTTPS), regras de acesso no próprio banco de dados (cada pessoa vê só o que pode), fotos e documentos em área privada com links temporários, registro de auditoria e bloqueio do app por biometria.',
  ] },
  { title: '9. Mudanças nesta política', items: [
    'Quando houver mudança importante, avisaremos no app. O consentimento do responsável fica registrado com a versão do termo aceito.',
  ] },
];

export default function Privacidade() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Política de Privacidade' }} />
      <T variant="title">Política de Privacidade do TechPoint</T>
      <T variant="small">{VERSION}</T>
      {sections.map((s) => (
        <Card key={s.title}>
          <T variant="subtitle">{s.title}</T>
          {s.items.map((t, i) => <T key={i} variant="body">• {t}</T>)}
        </Card>
      ))}
    </Screen>
  );
}
