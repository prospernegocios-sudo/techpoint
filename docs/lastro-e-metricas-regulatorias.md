# TechPoint — Lastro Social e métricas para projetos incentivados

Pesquisa em 12/11/2026. Documento de referência para produto e desenvolvimento. Escopo: informações públicas localizadas do Lastro Social e base inicial de requisitos federais. Não é uma certificação de conformidade nem levantamento concluído de todas as normas estaduais e municipais.

## Decisão de produto

O TechPoint deve vincular os registros de frequência à execução do plano de trabalho aprovado. A cadeia de informação proposta é: projeto → versão do plano aprovado → meta → indicador → atividade → beneficiário → registro/evidência → revisão → relatório. A métrica deve preservar sua definição, unidade, período, denominador e fonte. Alterações futuras não podem reescrever silenciosamente resultados já apresentados.

As funcionalidades do concorrente são uma referência de mercado. Os requisitos normativos devem ser extraídos de fontes oficiais e do instrumento de cada projeto, com responsável pela validação e data da revisão.

## Lastro Social: o que a fonte pública permite afirmar

Fonte: [site do Lastro Social](https://lastrosocial.com.br/), incluindo os links públicos de acesso e contato. Situação dos itens abaixo: anunciados pelo fornecedor, sem teste funcional independente.

| Área | Informação anunciada |
|---|---|
| Público | Projetos sociais esportivos e Lei de Incentivo ao Esporte |
| Beneficiários | Cadastro, foto, responsáveis e histórico |
| Frequência | Chamada digital por turma/mês e alertas de evasão |
| Organização | Núcleos, modalidades, turmas e calendário |
| Financeiro | Receitas, despesas por núcleo e anexos de comprovantes |
| Relatórios | Beneficiários, frequência, prestação de contas e informações para patrocinadores |
| Caso divulgado | Projeto não identificado em Belo Horizonte, com mais de 200 beneficiários; declaração não confirmada externamente |

O link comercial observado aponta para `https://wa.me/5531000000000`, com número aparentemente provisório. A página de login não pôde ser inspecionada pela ferramenta. Não foram confirmados preço, razão social/CNPJ, responsáveis, clientes identificados, aplicativos nas lojas, documentação de segurança, política de retenção, integrações ou funcionamento offline. GPS, selfie individual, assinatura e auditoria detalhada permanecem desconhecidos. A ausência de informação pública não comprova ausência de funcionalidade.

Não foi comprovada ligação com outras empresas chamadas Lastro. Não atribuir a este produto CNPJ, reputação, sócios ou contatos de homônimos. Nenhuma mensagem foi enviada e nenhuma conta foi criada.

**Conclusão sobre o concorrente:** boa referência de posicionamento; existência operacional, maturidade e conformidade ainda precisam ser demonstradas. Corrige-se o peso dado anteriormente à plataforma como concorrente comprovado.

## Base normativa e limites da pesquisa

### Fontes oficiais identificadas

1. [Lei Complementar 222/2025 — texto na Câmara](https://www2.camara.leg.br/legin/fed/leicom/2025/leicomplementar-222-26-novembro-2025-798353-publicacaooriginal-177116-pl.html): marco dos incentivos federal e subnacionais; níveis de prática; prestação de contas a cargo do proponente; revogação da Lei 11.438/2006. Os entes locais possuem condições próprias e regras de transição.
2. [Decreto 12.861/2026 — texto no Senado](https://legis.senado.leg.br/norma/42850096/publicacao/42850139): regulamentação federal. Os arts. 10 e 32 relacionam plano, metas e avaliação; o art. 16 veda cobrança dos beneficiários de prática regular; o art. 18 exige pelo menos 50% de alunos da rede pública nos projetos de formação com prática regular.
3. [Índice oficial de portarias de 2026](https://www.gov.br/esporte/pt-br/acoes-e-programas/lei-de-incentivo-ao-esporte/legislacao-lie/portarias/exercicio-2026): aponta a Portaria MESP 10, de 03/03/2026. [Publicação no DOU](https://www.in.gov.br/web/dou/-/portaria-mesp-n-10-de-3-de-marco-de-2026-690209578). O acesso ao inteiro teor pelo DOU retornou erro nesta consulta. Artigos, anexos, transição e eventuais alterações precisam de leitura integral antes de fechar a implementação.
4. [Comunicado oficial sobre a atualização](https://www.gov.br/esporte/pt-br/noticias-e-conteudos/esporte/ministerio-do-esporte-atualiza-regras-da-lei-de-incentivo-e-fortalece-projetos-sociais): informa exigência de PDF pesquisável e prestação de contas técnica e financeira, entre outros procedimentos.
5. [Fases do projeto — Ministério](https://www.gov.br/esporte/pt-br/acoes-e-programas/lei-de-incentivo-ao-esporte/fases-do-projeto): descreve metas com indicadores e verificadores, acompanhamento e consolidação da execução. Embora publicada em outubro de 2026, ainda referencia a Portaria 424/2020; não usar a data da página como prova de atualização integral.
6. [Normas de Minas Gerais](https://incentivo.esportes.mg.gov.br/legislacao/) e [normas do FazAtleta/Bahia](https://www.ba.gov.br/trabalho/244/legislacao): exemplos de regulamentos próprios. Não foram auditados integralmente; não representam cobertura nacional concluída.
7. [Orientação da ANPD sobre crianças e adolescentes](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-enunciado-sobre-o-tratamento-de-dados-pessoais-de-criancas-e-adolescentes): melhor interesse deve orientar o tratamento e a escolha da hipótese legal. Não basta um aceite genérico.

### Regra de aplicação proposta

Cada projeto terá esfera, programa, órgão, identificação/processo, instrumento, data de protocolo, período, normas aplicáveis e versão do plano aprovado. Projetos antigos exigem checagem das disposições transitórias. Não substituir automaticamente suas regras pelas de um projeto novo.

Cada requisito deve ser classificado como: **obrigação legal**, **condição do edital/instrumento/plano**, **recomendação de produto** ou **pendente de validação**. As propostas abaixo são de implementação; não significam que todas sejam exigências expressas da lei.

## Matriz proposta para desenvolvimento

| ID / prioridade | Métrica ou controle | Definição proposta | Evidência e condição de aceitação | Origem / situação |
|---|---|---|---|---|
| R01 / P0 | Perfil regulatório | Associação do projeto ao regime e à versão de regras | Fonte oficial, dispositivo, vigência, transição e responsável pela revisão | Controle de produto; validação normativa por perfil pendente |
| R02 / P0 | Plano e metas | Meta quantitativa ou qualitativa, unidade, alvo, período e verificador | Anexar plano aprovado e alterações autorizadas; manter versões | Decreto, arts. 10 e 32; desenho proposto |
| R03 / P0 | Beneficiários únicos | Pessoas distintas com atendimento válido no período; cadastro isolado não conta como atendimento | Identificador interno consistente; vínculo ao projeto, turma e período | Definição deve seguir a meta aprovada |
| R04 / P0 | Atendimentos | Pares distintos beneficiário–atividade com presença validada | Deduplicar check-in, sincronização e lançamento manual; registrar origem | Métrica operacional proposta; não confundir com pessoas únicas |
| R05 / P0 | Frequência individual | Presenças válidas ÷ atividades elegíveis efetivamente realizadas enquanto havia vínculo × 100 | Matrícula/desligamento, calendário, cancelamentos e decisões; exibir numerador e denominador | Fórmula padrão proposta, substituível pelo plano aplicável |
| R06 / P0 | Execução de atividades | Atividades realizadas e validadas comparadas às previstas no plano vigente | Calendário, local, professor, evidências, cancelamentos e reposições | Vinculação às metas; reposição não pode duplicar o cumprimento |
| R07 / P0 | Carga horária | Distinguir carga prevista, realizada declarada e intervalo de entrada/saída | Professor confirma execução; horários incompletos geram pendência | Registro de entrada/saída não comprova sozinho tempo de prática |
| R08 / P0 | Rede pública | Beneficiários elegíveis com matrícula pública comprovada ÷ total elegível × 100 | Documento ou verificador aceito, validade e informação desconhecida destacada | Decreto, art. 18: mínimo de 50%, apenas quando aplicável |
| R09 / P0 | Gratuidade | Impedir cobrança de participação ao beneficiário no perfil de prática regular incentivada federal | Bloqueio no módulo de cobrança e revisão de configuração | Decreto, art. 16; assinatura B2B do software não se confunde com mensalidade do atleta |
| R10 / P0 | Cumprimento de metas | Resultado apurado comparado ao alvo e à regra do plano | Evidências vinculadas e justificativa de desvios; cálculo reproduzível | Não criar um percentual universal de aprovação |
| R11 / P0 | Integridade da frequência | Separar capturado, pendente, validado, rejeitado e corrigido | Autor, data, motivo, valor anterior e decisão de revisão | Controle de produto; relatórios não devem somar pendentes como confirmados |
| R12 / P0 | Evidência offline | Horário do aparelho, recebimento no servidor e sincronização separados | Identificador único, atraso visível e tratamento de conflitos | Controle técnico; não declarar horário offline como atestado pelo servidor |
| R13 / P0 | Relatório de execução | Consolidar plano, metas, beneficiários, atividades, resultados, desvios e índice de anexos | PDF com texto pesquisável, exportação estruturada e versão de emissão | PDF pesquisável informado pelo Ministério; leiautes e assinaturas ainda precisam de validação |
| R14 / P0 | Fechamento e correção | Congelar versão emitida, permitir retificação identificada | Histórico de reabertura e vínculo entre relatórios original e retificado | Controle de produto para rastreabilidade |
| R15 / P1 | Evasão e retenção | Alertas de ausências e acompanhamento de coortes com vínculo definido | Distinguir abandono, lesão, transferência e término regular; período configurável | Gestão proposta; não é indicador universal imposto pelo Ministério |
| R16 / P1 | Perfil do público | Recortes previstos no plano, incluindo idade e acessibilidade quando pertinentes | Coletar apenas dados necessários e controlar acesso | Regra específica do projeto e proteção de dados |
| R17 / P1 | Resultado qualitativo | Instrumento de avaliação com critério, momento e responsável | Avaliação inicial/final ou outro verificador aprovado | Frequência não demonstra, sozinha, impacto social ou evolução esportiva |
| R18 / P1 | Financeiro associado | Vincular documentos/despesas à ação e ao projeto, por integração ou módulo específico | Separação de projetos, orçamento aprovado e documentação pertinente | Frequência isolada não equivale à prestação de contas financeira |
| R19 / P0 | Retenção e acesso | Política por categoria documental e finalidade; retenção suspensa em litígio/auditoria quando cabível | Matriz de prazos, exportação ao cliente, registro de acesso e descarte | Validar norma e instrumento; não impor 12 meses para todo acervo nem guardar toda selfie por prazo ilimitado |
| R20 / P0 | Crianças e responsáveis | Hipótese legal, finalidade, informação acessível e vínculo do responsável | Autorizações pertinentes, permissões por papel e alternativa a quem não tem celular | ANPD e legislação aplicável; revisão específica de privacidade pendente |

P0: necessário antes de vender apoio à comprovação de execução. P1: evolução ou dependência do escopo contratado. Priorização recomendada, não classificação legal.

### Regras de cálculo que evitam distorções

- Um atleta presente em 12 treinos gera um beneficiário único e 12 atendimentos, se a definição aprovada assim permitir. Não anunciar 12 pessoas beneficiadas.
- Atividades canceladas não entram automaticamente no denominador de frequência individual, mas continuam visíveis no controle de execução do plano. A regra específica do plano prevalece.
- Ausência justificada não se transforma automaticamente em presença. Se houver exclusão do denominador autorizada, guardar a regra e o motivo.
- Zero atividades elegíveis produz indicador “não aplicável”, e não frequência de 0% ou 100%.
- Uma pessoa em dois núcleos deve ser deduplicada no total do projeto. Totais por turma podem não ser aditivos.
- Campo de escola desconhecido deve aparecer como pendência; não presumir rede pública. Definir o denominador regulatório antes de exibir cumprimento da cota.
- Não há, nas fontes examinadas, base para impor a todos os projetos uma frequência mínima universal de 75%, raio de 150 metros ou selfie obrigatória. Esses parâmetros dependem de política operacional e do instrumento.
- Indicadores de satisfação, evasão e qualidade da evidência devem ficar separados dos indicadores oficiais pactuados. Nenhum “selo de conformidade” será gerado apenas por um check-in.

## Mudanças recomendadas no memorando

1. Substituir a afirmação de exclusividade por uma hipótese de diferenciação a validar em pilotos e demonstrações concorrentes.
2. Antecipar painel do gestor, configuração de metas, revisão e exportação para o primeiro piloto institucional.
3. Especificar os estados de presença e a preservação dos registros corrigidos.
4. Prever participação assistida para quem não tem aparelho ou conexão, com origem do lançamento explícita.
5. Reavaliar a retenção padrão de fotos de 12 meses por categoria e instrumento, considerando necessidade e proteção de dados.
6. Separar relatórios técnicos, gerenciais, públicos e financeiros. Fotos, coordenadas e nomes de menores não devem acompanhar automaticamente relatórios de patrocinadores.
7. Usar o Lastro como referência de organização por projeto/núcleo/modalidade e apresentação de valor. Não declarar equivalência funcional sem demonstração.

## Validação necessária antes de afirmar alinhamento integral

- Obter e ler o inteiro teor vigente da Portaria MESP 10/2026, anexos, alterações e disposições transitórias. O link oficial foi identificado, mas não carregou.
- Selecionar instrumentos reais dos clientes piloto e mapear cada cláusula/meta ao campo, cálculo, evidência e modelo de relatório correspondente.
- Validar assinaturas aceitas, leiautes, documentos de beneficiários, periodicidade, prazos e guarda documental no regime efetivamente aplicável. Selfie e aprovação no aplicativo não devem ser apresentadas como substitutos automáticos de assinaturas exigidas.
- Homologar o perfil federal com responsável técnico/jurídico e com quem prepara a prestação de contas do piloto. A decisão de aceitação permanece com o órgão competente.
- Acrescentar perfis estaduais, distrital e municipais conforme os clientes. Perfil ainda não revisado deve aparecer como pendente, sem promessa de cobertura nacional.
- Para investigar Lastro em demonstração: confirmar entidade responsável, contato válido, ambiente operacional, cliente referenciável, preço, contrato, relatórios de exemplo anonimizados, auditoria, exportação, privacidade e normas efetivamente cobertas. Este roteiro está preparado; nenhum contato foi realizado.

**Resultado desta etapa:** referência pública do Lastro consolidada e matriz inicial de produto definida. Alinhamento regulatório integral permanece sujeito à conferência dos textos completos e dos instrumentos concretos; não foi certificado nesta pesquisa.
