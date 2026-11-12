# Decisões do projeto TechPoint

Registro das decisões tomadas, com data e motivo. Decisões novas entram no fim.

## Fase 0 — Planejamento (12/11/2026)

| # | Decisão | Motivo |
|---|---|---|
| D01 | Nome do app: **TechPoint** (referência a *match point*) | Escolha do dono do produto. Pendente: checar marca no INPI (classes 9 e 42), Play Store e domínio |
| D02 | Clube piloto: **DF Vôlei**; esporte inicial: **vôlei** | Dados de exemplo e campos de estatística partem do vôlei; o modelo é genérico para outros esportes |
| D03 | Celular de teste: **Android** — testes via APK de teste (EAS Build) | Não exige conta Apple por enquanto |
| D04 | Atleta tem conta própria e faz o próprio check-in **a partir de 10 anos**, sem limite superior. Abaixo de 10, responsável ou treinador registra | Equilíbrio entre autonomia e proteção do menor |
| D05 | Login: **Google (SSO) uma única vez + biometria** para reabrir o app | Sem senha e sem código a cada acesso |
| D06 | Atletas cuja conta Google não permite login em apps de terceiros (menores de 13 com Family Link): **ativação por QR Code gerado no app do responsável** (entra na Fase 2) | O Google limita contas de menores de 13; o QR também reforça o consentimento do responsável. Revisável |
| D07 | "Entrar com Apple" será adicionado na Fase 6 (iOS) | Exigência da App Store para apps com login social |
| D08 | Check-in sem internet: guarda **hora do aparelho** e **hora em que o servidor recebeu**; registro marcado "sincronizado depois"; aceito se chegar em até **24h** | Resolve o conflito entre "hora do servidor" e "funcionar offline", com transparência para o treinador |
| D09 | Janela: check-in de **30 min antes até 30 min depois do início**; check-out até **60 min após o fim**. Configurável por organização | Proposta aprovada |
| D10 | Foto do check-in serve **apenas como prova visual** para o treinador. **Sem reconhecimento facial** | Evita tratar dado biométrico (sensível na LGPD), custo e complexidade |
| D11 | **Cobrança das organizações fora do MVP** | Validar o produto antes; cobrança por fora |
| D12 | **Duas paletas no app** ("Quadra" e "Areia & Mar"), escolhidas pelo usuário nas configurações; padrão "Quadra" | Escolha do dono do produto. Cores ficam em tokens de tema, então o custo é baixo |
| D13 | Dados hospedados no Supabase **região São Paulo (sa-east-1)** | LGPD e menor latência no Brasil |
| D14 | Dois ambientes Supabase: **teste** e **produção** | Não misturar dados de teste com dados reais |
| D15 | Código em **repositório privado no GitHub** | Segurança; o ambiente de desenvolvimento na nuvem é temporário |
| D16 | **Sem mapa pago no MVP**: local cadastrado com "Estou no local agora" + endereço digitado | Custo zero; mapa interativo pode vir depois |
| D17 | Stack: Expo (React Native + TypeScript), Expo Router, TanStack Query, Zod, Supabase (Postgres + RLS + Storage + Edge Functions). Painel web em Next.js na Fase 5 | Um código para Android e iOS; segurança por linha no banco |
| D18 | Papel do usuário fica **por organização** (`memberships`), não no perfil | A mesma pessoa pode ser treinadora num clube e responsável em outro |
| D19 | Atleta existe **mesmo sem conta** (`athletes` com `profile_id` opcional) | Crianças pequenas e atletas sem celular |
| D20 | Cada check-in e check-out é **um registro separado** (`attendance_records`) | Auditoria mais simples e clara |
| D21 | Fotos e documentos em **armazenamento privado**, acessados por links temporários | Requisito de LGPD |
| D22 | Contas das lojas (Apple/Google) **preferencialmente no CNPJ**, com D-U-N-S | Google exige 12 testadores por 14 dias para contas pessoais novas; nome de empresa passa mais confiança |

## Fase 1 — Base e check-in (12/11/2026)

| # | Decisão | Motivo |
|---|---|---|
| D23 | Login Google pelo **navegador seguro do sistema** (OAuth do Supabase com PKCE), sem SDK nativo do Google | Não exige configurar impressão digital (SHA-1) do app no Google; funciona igual em Android e iOS |
| D24 | Identificador do app nas lojas: **br.com.techpoint.app** | Não pode mudar depois de publicado. Pode ser trocado até a Fase 6 se preferir outro |
| D25 | Treinador vê **todos os atletas da organização** (não só das suas equipes) | Simplicidade no MVP; treinador é da comissão do clube. Revisável |
| D26 | Check-in, check-out, presença manual e revisão passam por **funções do servidor** (o app não grava direto na tabela) | Hora, raio, janela e antifraude não podem ser burlados pelo celular |
| D27 | Check-in fora do raio **sem justificativa é recusado**; com justificativa vira **pendente**. Localização falsa sempre vira pendente | Regra do produto: o treinador decide os casos duvidosos |
| D28 | "Foto repetida" compara a impressão digital (SHA-256) calculada no app. Detecta reenvio da mesma foto, não fotos parecidas | Limitação aceita no MVP; comparação por semelhança pode vir depois |
| D29 | Detecção de localização falsa funciona **só no Android** (o iPhone não informa) | Limitação do sistema operacional |
| D30 | Sessão de login guardada **criptografada** no aparelho (SecureStore), dividida em pedaços | Segurança da conta |
| D31 | Biometria volta a ser pedida se o app ficar **mais de 2 min** em segundo plano | Equilíbrio entre segurança e praticidade |
| D32 | Conta do atleta é ligada ao cadastro **pelo e-mail Google**; só se tiver **10 anos ou mais** (regra no banco) | Sem códigos de convite no MVP; idade mínima garantida no servidor |
| D33 | Banco atualizado e testado pela **API de gestão do Supabase** (sem Docker); testes rodam numa transação desfeita no fim | O ambiente na nuvem não tem Docker; nada de teste fica gravado |
| D34 | **Consentimento LGPD de menores ainda não implementado** (Fase 2). Até lá, o ambiente de teste usa **apenas dados fictícios** e a conta do dono do produto | Requisito obrigatório entra antes de qualquer atleta real usar o app |
| D35 | App em **Expo SDK 58**; build de teste Android (APK) pelo EAS | Versão atual do Expo |
| D36 | Endereço e chave pública do Supabase ficam nas **variáveis de ambiente do EAS** (preview/production), não no arquivo `.env` | O 1º APK fechou ao abrir: o `.env` não foi enviado ao build (é ignorado pelo git). Agora o app também mostra um aviso em vez de fechar se faltar configuração |
