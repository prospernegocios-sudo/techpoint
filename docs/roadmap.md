# TechPoint — Concorrentes e cronograma (proposta)

> Versão 4 — 14/11/2026. Reorganizado pelos módulos (D69–D72): Plano Base = Núcleo + Atletas e Presença + Competições; adicionais: M2 Gestão de Investimentos e M4 Reservas (por último). Versão 3 (13/11): projetos na Fase 1, painel web antecipado (D46), patrocinadores (D47), fotos 24 meses (D48). Datas são estimativas e dependem dos testes no celular e da fila de builds do Expo.
> Fontes: planilha "TechPoint Clientes e Concorrentes" + buscas na web. Os sites dos concorrentes não puderam ser abertos diretamente; os recursos **não foram testados**.

## 1. O que os concorrentes oferecem

| Concorrente | Segmento | Principais recursos |
|---|---|---|
| **Gestão Sports** | Escolas esportivas | Confirmação/consulta de presença por evento; **convocações enviadas ao WhatsApp do responsável** com resposta pendente; mensalidades, inscrições e taxas por **Pix e cartão com baixa automática**; web app sem instalação. A partir de R$ 49,95 (plano anual, a confirmar) |
| **Athletic Gear / AG Sports** | Times e turmas | Treinos, jogos, confirmação e chamada, histórico de presença; mensalidades, produtos, contratos, campeonatos, notificações; em desenvolvimento: **processo seletivo (peneira)**, caixa, performance. Plano gratuito + pago |
| **Clupik** | Clubes, ligas, federações | Convocações e presença; **comunicação com push e e-mail**; inscrições, cobranças, licenças, torneios, **loja online**, site e app personalizados do clube. A partir de ~US$ 35/mês (não verificado) |
| **Sistema FUJI** | Lutas e projetos sociais | Frequência por aula/turma, graduações, avaliação técnica, cobranças; **relatórios de impacto para patrocinadores e instituições públicas** |
| **TeamCheck** | Equipes (internacional) | Confirmação de presença com lembretes; **comunicados com reações**; estatísticas por atleta (**atrasos, faltas, lesões**), ranking; documentos e cotas. Gratuito até 15 membros |
| **Fitofan** | Clubes e federações | Inscrições, pagamentos, **termos de consentimento dos pais com assinatura e data**, chaves de campeonato, arbitragem, histórico de competições |
| **Elevation Sport** | Clubes e escolas | Presença e relatórios por atleta, multi-clube, pagamentos, documentos (disponibilidade no Brasil a confirmar) |
| **AppFUT** (encontrado na pesquisa) | Escolinhas | Presença rápida, frequência por aluno, **contratos digitais**, comunicados, convocações, LGPD |
| **Next Fit / Tecnofit / ABC EVO / Hubfit / Pacto** | Academias | Agenda e check-in em aulas, **catraca, biometria e reconhecimento facial**, contratos, cobrança recorrente, CRM; ABC EVO: exceção manual com justificativa e **72 h offline** |
| **Ticket Sports / Sympla / SporTickets** | Eventos e provas | **Check-in por QR** e busca por nome/CPF, offline, vários operadores ao mesmo tempo, **desfazer check-in**, recusa de ingresso inválido |

## 2. Onde o TechPoint já se diferencia

- **Check-in pelo celular do atleta com GPS, raio e selfie na hora**, com antifraude (GPS falso, foto repetida, fora do horário). Os concorrentes de clube fazem chamada manual ou "confirmação"; os de academia dependem de catraca.
- **Hora do servidor + modo offline** com registro da hora real.
- **Foco em menores e LGPD** desde a base (regras no banco, aprovação de pendências, auditoria).

## 3. O que vale trazer (por prioridade)

| Prioridade | Recurso | Quem tem | Fase |
|---|---|---|---|
| Alta | Aviso de chegada/saída ao responsável (push) | — (diferencial) | 2 |
| Alta | Termos e consentimento dos pais com registro de data | Fitofan, AppFUT | 2 |
| Alta | Convite do atleta por link (WhatsApp) + aprovação | — | 2 |
| Alta | Agenda recorrente + confirmação "vou / não vou" com lembrete | TeamCheck, AG | 3 |
| Alta | Convocações com resposta do responsável | Gestão Sports, Clupik | 3 |
| Alta | Comunicados (time todo ou um responsável) com leitura | Clupik, TeamCheck | 3 |
| Média | **Modo totem**: tablet do treinador lê QR do atleta (quem não tem celular) | Ticket Sports, SporTickets | 3 |
| Média | Avaliações por critério, evolução e histórico | FUJI, Controla o Jogo | 4 |
| Média | Estatísticas: faltas, atrasos, lesões, ranking de presença | TeamCheck | 4 |
| Média | Atestados e documentos do atleta | TeamCheck, Elevation | 4 |
| **Alta** | **Relatório de frequência para projetos incentivados e patrocinadores** (PDF/Excel) | FUJI | 5 |
| Alta | Painel web do gestor | Todos | 5 |
| Média | Mensalidades por Pix/cartão com baixa automática | Gestão Sports, AG, academias | 7 (decisão) |
| Baixa | Peneira / processo seletivo | AG (em desenvolvimento) | Futuro |
| Baixa | Campeonatos, loja, multi-unidade/federação | Clupik, Fitofan, AG | Futuro |
| Fora do foco | Catraca, biometria de porta, reconhecimento facial | Academias | Não fazer (decisão: foto é só prova) |

## 4. Cronograma (versão 4)

| Fase | Conteúdo | Duração | Previsão |
|---|---|---|---|
| **1 · Base, check-in e projetos** | Validação no celular; relatório de frequência; projetos incentivados (plano, metas, beneficiários, relatório congelado); patrocinadores | em andamento | 04/12/2026 |
| **2 · Responsáveis, LGPD e documentos** | Convite + aprovação; responsáveis e consentimento; push de chegada/saída; ativação por QR (10–12 anos); **envio de documentos do atleta** (atestado, RG; PDF/PNG/JPG); **exclusão de conta e de dados**; exclusão das fotos após 24 meses; itens exigidos pela loja (política de privacidade, conta de demonstração, pacote de produção, atualização rápida) | 3,5 semanas | 23/12/2026 |
| **Google Play** | Teste interno (Thiago e Carla) → teste fechado (piloto DF Vôlei) → produção. Depende da conta da Prosper (D-U-N-S) | em paralelo | interno ~06/01 · produção ~22/01/2027 |
| **Domínio** | techpoint.app.br no ar (Cloudflare Pages, gratuito), links do app atualizados | 2 dias | junto com a produção |
| **2.5 · Estrutura de módulos** | `org_modules`, regras de acesso por módulo, menus conforme o contrato | 1 semana | 13/01/2027 |
| **3 · Painel web e patrocinador** | Painel web do gestor; acesso individual do patrocinador; relatórios para órgãos e patrocinadores; verificação pública do registro | 4 semanas | 10/02/2027 |
| **4 · Competições, agenda e comunicação** (Plano Base) | Treinos recorrentes; vou/não vou com lembrete; comunicados e enquetes; check-in por QR em tablet; **competições** (cadastro, convocação, logística de ônibus/voo e hotel, inscritos, jogos e resultados); **autorização de viagem e hospedagem pronta para o cartório** (fica desligada até a validação do advogado) | 5 semanas | 17/03/2027 |
| **5 · M2 Gestão de Investimentos** (adicional pago) | Orçamento por rubrica; despesas com comprovante; saldo em tempo real; prestação de contas física + financeira | 4 semanas | 14/04/2027 |
| **6 · Desempenho e App Store** | Avaliação técnica e evolução; estatísticas de faltas, atrasos e lesões; publicação para iPhone | 4 semanas | 12/05/2027 |
| **7 · M4 Reservas** (por último) | Agenda de quadras, reserva pelo aluno, bloqueio automático, base de alunos, pagamento online | 6 semanas | jul/2027 (após validar com 3–5 arenas) |

**O que depende do dono do produto (para não atrasar):**
- Teste completo do APK atual (agora).
- Conta Prosper no Google Play com D-U-N-S (até o início de janeiro).
- Advogado validar os modelos de autorização de viagem e hospedagem (até março).
- Conversar com 3–5 arenas antes da Fase 7.

## 5. Decisões pendentes do dono do produto

1. Revisão do racional de preço (preço atual mantido por enquanto: Plano Base a partir de R$ 349).
2. Mensalidades de atletas por Pix/cartão: entram junto com o pagamento do M4 ou ficam fora? (tem custo de taxa do intermediador)
3. WhatsApp: botão "Compartilhar no WhatsApp" (grátis) ou API oficial (paga por mensagem)?
4. Conta Apple (US$ 99 por ano), necessária na Fase 6.
