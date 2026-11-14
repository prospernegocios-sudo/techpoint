# TechPoint em módulos (proposta, aguardando aprovação)

## Ideia
Um **núcleo** comum e **módulos** que cada cliente liga ou desliga e paga à parte.
Tudo continua sendo um único app, um único site e um único banco: o cliente vê apenas os módulos que contratou.

## Mapa
| Módulo | O que tem | Quem compra | Situação |
|---|---|---|---|
| **Núcleo** (sempre incluso) | Entidade, pessoas e papéis, equipes, locais, login, LGPD e consentimento, avisos (push), arquivos e documentos | Todos | Pronto, exceto o envio de documentos |
| **M1 Atletas e Presença** | Check-in com prova, treinos, responsáveis, correções, relatório de assiduidade | Clubes, escolas, projetos | Em desenvolvimento (Fases 1 e 2) |
| **M2 Gestão de Investimentos** | Gestão do dinheiro captado pelos projetos (LIE, emendas, editais, patrocínio): orçamento por rubrica, despesas com comprovantes, saldo, metas, patrocinadores e prestação de contas física e financeira | Quem capta recurso (LIE, emendas, patrocínio) | Base já feita (projetos); a parte financeira está prevista |
| **M3 Competições** | A entidade cadastra a competição (própria ou de fora, ex.: Copa Goiânia), convoca os atletas pela plataforma, o atleta/responsável confirma, gera a lista de inscritos com documentos, e registra jogos e resultados | Clubes, escolas, projetos | Escopo definido (14/11) |
| **M4 Reservas (arenas)** | Agenda de quadras, disponibilidade, reserva pelo aluno, bloqueio automático, base de alunos, pagamento | Arenas, beach tennis, escolinhas | A validar no mercado |
| Futuro | Desempenho e avaliação técnica | Clubes | Roteiro da Fase 5 |

## Como fica por dentro
- No banco: uma tabela `org_modules` registra a entidade, o módulo e se ele está ativo, em teste ou suspenso.
- Uma função `org_has_module()` protege as regras de acesso (RLS) e as funções do banco. O módulo desligado fica fechado no servidor, não só escondido na tela.
- No app, os menus e as telas aparecem conforme os módulos ativos.
- No código, cada módulo tem sua pasta (`src/modules/<nome>`) e suas migrações próprias.
- Cobrança: um preço base (Núcleo + M1) e os demais módulos como adicionais. Os valores entram na revisão de preço já combinada.

## Ponto crítico: M4 Reservas
- **É outro comprador e outra dor.** O dono da arena quer encher a agenda e receber, não prestar contas. O pitch e o marketing serão outros (Linha B).
- **O mercado já tem aplicativos de reserva estabelecidos.** O diferencial precisa ser claro, por exemplo arena + escolinha + projeto social num lugar só.
- **Pagamento online (Pix ou cartão)** traz taxas, estorno e política de cancelamento. São decisões de custo e segurança.
- **Sinergia:** usa o mesmo núcleo (pessoas, locais, agenda), e muitas arenas também têm escolinha ou projeto.
- **Sugestão:** conversar com 3 a 5 arenas de Brasília antes de programar.

## Ordem sugerida
1. Terminar a Fase 2 (LGPD) e publicar na Google Play, como já planejado.
2. Fazer a "Fase 2.5 Módulos": criar `org_modules`, ligar M1 e M2 em todas as entidades atuais e ajustar os menus. É pequena e evita retrabalho.
3. M2 completo (parte financeira), vendido como adicional.
4. M3 Competições.
5. M4 Reservas: **por último** (decisão do dono do produto, 14/11), depois da validação com as arenas.

## M3 Competições: fluxo combinado
1. O gestor ou treinador cadastra a competição: nome, cidade, datas, categoria e local (ex.: Copa Goiânia).
2. Escala o time escolhendo os atletas da equipe (convocação).
3. Cada convocado recebe aviso no celular (o responsável também, se for menor) e responde **vou / não vou**.
4. Para menor de idade, o responsável **autoriza a participação e a viagem** pelo app (a validar com advogado: regras do ECA para viagem de menor).
5. A plataforma gera a **lista de inscritos** com os dados e documentos exigidos (RG, atestado), aproveitando o envio de documentos do núcleo.
6. Durante e depois: jogos, placares, presença e relatório da competição (entra também na prestação de contas do M2).
