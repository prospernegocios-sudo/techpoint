# TechPoint

App de presença e gestão de atletas para clubes, escolas esportivas, núcleos de base,
federações e instituições de ensino. Android e iOS.

- Check-in e check-out com geolocalização, foto na hora e raio do local
- Agenda de treinos e jogos, convocações, desempenho e histórico do atleta
- Portal do responsável com avisos de chegada e saída
- Relatórios em PDF e CSV
- LGPD desde o início (muitos atletas são menores de idade)

Clube piloto: **DF Vôlei**.

## Status

- **Fase 0 — Planejamento:** concluída.
- **Fase 1 — Base e check-in:** pronta para teste no celular (APK de teste gerado em 12/11/2026 pelo EAS, perfil `preview`). Aguardando validação do dono do produto.

## Documentos

- [DECISOES.md](DECISOES.md) — decisões tomadas e o porquê
- [docs/modelo-de-dados.md](docs/modelo-de-dados.md) — tabelas do banco

## Estrutura de pastas (planejada)

```
techpoint/
├── app/            → aplicativo Expo (React Native + TypeScript)
├── supabase/
│   ├── migrations/ → criação do banco e regras de segurança (RLS)
│   ├── functions/  → check-in, antifraude, notificações, exclusão de dados
│   ├── tests/      → testes das regras de acesso
│   └── seed.sql    → dados de exemplo
├── web/            → painel do gestor (Fase 5)
├── docs/           → termos, política de privacidade, modelo de dados
├── README.md · DECISOES.md · .env.example
```

## Como rodar

Pré-requisitos: Node 22+, conta no Supabase (projeto de teste) e no Expo.

```bash
cp .env.example .env            # preencha SUPABASE_PROJECT_REF e SUPABASE_ACCESS_TOKEN
cp app/.env.example app/.env    # preencha URL e chave publishable do Supabase
npm run db:migrate              # cria/atualiza o banco
npm run db:seed                 # dados de exemplo do DF Vôlei
cd app && npm install
```

O app usa recursos nativos (câmera, GPS, biometria e login), então é testado por um **APK de teste**:

```bash
cd app && npx eas-cli build --profile preview --platform android
```

## Como testar

```bash
npm run test:db                 # 26 testes: regras de acesso (RLS), check-in, raio, hora do servidor, antifraude
cd app && npm test              # 18 testes: cálculo do raio, datas, mensagens de erro
cd app && npm run typecheck     # verificação de tipos
```

## Estrutura atual

- `supabase/migrations/` — banco, regras de acesso e funções de check-in
- `supabase/seed.sql` — dados de exemplo (fictícios)
- `supabase/tests/` — testes de segurança e check-in
- `scripts/db.mjs` — aplica migrações e seed pela API do Supabase
- `app/app/` — telas (Expo Router)
- `app/src/lib/` — login, tema, check-in, fila offline, consultas

## Como publicar

Será detalhado na Fase 6.
