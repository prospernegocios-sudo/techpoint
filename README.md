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

**Fase 0 — Planejamento: concluída.** Próxima: Fase 1 (base e check-in).

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

## Como rodar, testar e publicar

Será preenchido a partir da Fase 1.
