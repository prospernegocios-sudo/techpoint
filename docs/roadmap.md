# TechPoint — Concorrentes e cronograma (proposta)

> Versão 1 — 12/11/2026. **Proposta para aprovação do dono do produto.** Datas são estimativas e dependem dos testes no celular e da fila de builds do Expo.
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

## 4. Cronograma proposto

| Fase | Conteúdo | Duração estimada | Previsão |
|---|---|---|---|
| **1 — Base e check-in** | Concluída no código; falta validação no celular | — | até 20/11/2026 |
| **2 — Responsáveis e LGPD** | Convite do atleta por link + aprovação; vínculo responsável–atleta; consentimento e termos com data; ativação por QR (10–12 anos); **push de chegada/saída**; área do responsável (presença do filho); exclusão de dados | 3 semanas | 11/12/2026 |
| **3 — Agenda e comunicação** | Treinos recorrentes; confirmação "vou/não vou" com lembrete; convocações para jogos com resposta; comunicados (opção A); modo totem com QR | 3–4 semanas (pausa de fim de ano) | 15/01/2027 |
| **4 — Desempenho** | Avaliações por critério do esporte; estatísticas e evolução; faltas, atrasos, lesões; atestados e documentos | 3 semanas | 05/02/2027 |
| **5 — Relatórios e painel web** | Painel web (Next.js) do gestor; relatório de frequência para projetos incentivados/patrocinadores (PDF e Excel); indicadores do clube | 4 semanas | 05/03/2027 |
| **6 — Publicação nas lojas** | Google Play e App Store; política de privacidade; testes finais; ambiente de produção | 2 semanas | 19/03/2027 |
| **7 — Financeiro (a decidir)** | Mensalidades Pix/cartão com baixa automática; inadimplência | 3–4 semanas | abril/2027 |

## 5. Decisões pendentes do dono do produto

1. Aprovar o cronograma e as prioridades.
2. Financeiro: entra na Fase 7 ou fica fora? (tem custo de taxa do intermediador de pagamento)
3. WhatsApp: botão "Compartilhar no WhatsApp" (grátis) ou API oficial do WhatsApp (paga por mensagem)?
4. Contas das lojas: Google Play (US$ 25, uma vez) e Apple (US$ 99 por ano), necessárias na Fase 6.
