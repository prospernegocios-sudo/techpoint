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
