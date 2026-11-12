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

## Privacidade e guarda de dados

- **Fotos de check-in e check-out: guardadas por 24 meses** a partir do registro e depois apagadas (decisão D48). O registro de presença (hora, GPS, situação, código de verificação) e os relatórios emitidos continuam guardados.
- Localização lida só no instante do registro; nada em segundo plano.
- Até a Fase 2 (consentimento dos responsáveis), o app usa **apenas dados fictícios**.

## Documentos

- [Concorrentes e cronograma](docs/roadmap.md)
- [Lastro Social e métricas para projetos incentivados](docs/lastro-e-metricas-regulatorias.md) (requisitos R01–R20)

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
# O endereço e a chave pública do Supabase vêm das variáveis do EAS (npx eas-cli env:list --environment preview).
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
