---
title: Relatório executivo da Auditoria 360
tags:
  - auditoria-360
  - linear
  - seguranca
  - arquitetura
  - ui-ux
created: 2026-09-14
updated: 2026-09-14
status: final
type: relatorio-executivo
---

# Relatório executivo da Auditoria 360

## Índice auditável

- [Fase 1 — Análise estática e arquitetura](01-analise-estatica-arquitetura.md)
- [Fase 2 — Segurança, autenticação e sessões](02-seguranca-autenticacao-sessoes.md)
- [Fase 3 — APIs, integrações e banco](03-apis-integracoes-banco.md)
- [Fase 4 — UI/UX visual, navegação e acessibilidade](04-ui-ux-visual.md)
- [Evidências visuais da Fase 4](evidencias/fase-4/)
- [Projeto Linear Antenor e Filhos [NOVA REAL]](https://linear.app/eojonathan/project/antenor-e-filhos-nova-real-1094003b8bd0)

## Resumo executivo

A postura geral de risco é **alta**: a auditoria não aponta um único ponto fraco isolado, mas uma combinação de falhas de sessão/identidade, webhooks, outbox, uploads, concorrência e acessibilidade que afetam caminhos centrais de pedido, pagamento, operação e experiência móvel. A situação é administrável porque os achados têm evidência, proposta de correção e critérios de aceite no backlog; o risco vem da concentração de itens Urgent/High ainda em Backlog.

O backlog acionável consolidado tem **124 issues únicas** no projeto Linear atual, todas em **Backlog**, todas com label real **Melhoria** e todas sem cycle associado. A distribuição atual por prioridade no Linear é: **2 Urgent, 33 High, 77 Medium e 12 Low**.

## Saúde por domínio

| Domínio | Saúde | Sinal principal | Direção executiva |
|---|---:|---|---|
| Segurança e identidade | 4/10 | 2 Urgent e múltiplos High em sessão, webhooks, SSRF, uploads e isolamento | Tratar primeiro; bloquear regressões com testes de abuso |
| Pedido, pagamento e integrações | 5/10 | Outbox, pagamento, marketplace e reservas têm falhas de idempotência/concorrência | Remediar por ordem de dano financeiro/operacional |
| Banco, migrations e runtime | 6/10 | Há dependências vulneráveis, drift/concorrência e gaps de ambiente | Endurecer CI, env e migrations antes de mudanças grandes |
| Frontend e acessibilidade | 6/10 | Visual aceitável, mas com 8 High de acessibilidade | Resolver AA/teclado/foco nos fluxos públicos e operacionais |
| Governança de backlog | 7/10 | Rastreabilidade boa, labels específicas ausentes e Fase 1 inconsistente no corpo | Manter fallback documentado até criar labels reais |

## Totais por fase

| Fase | Escopo bruto declarado | Issues únicas acionáveis após dedupe interno | Urgent | High | Medium | Low | Criadas | Reutilizadas/atualizadas |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Fase 1 | 86 evidências declaradas | 84 | 0 | 14 | 59 | 11 | 83 | 1 reutilizada |
| Fase 2 | 35 achados + 27 dependências herdadas | 60 relacionadas; 26 novas | 2 | 15 | 17 | 1 | 26 | 34 atualizadas/reutilizadas |
| Fase 3 | 11 achados | 11 relacionadas; 3 novas | 0 | 5 | 6 | 0 | 3 | 8 reutilizadas |
| Fase 4 | 11 defeitos visuais | 11 | 0 | 8 | 3 | 0 | 11 | 0 |

Observação de reconciliação: a Fase 1 declara 86 evidências e 84 issues únicas, e o readback do Linear confirma a existência do conjunto Fase 1 `JON-44`, `JON-46` a `JON-105` e `JON-108` a `JON-130`, excluindo `JON-106/JON-107`. Porém o corpo atual de `01-analise-estatica-arquitetura.md` contém tabela/mapeamento explícito só para 70 achados, até `F43/D27`; `F44-F59` aparecem na síntese e nos tickets, mas não têm seções próprias no corpo do relatório-fonte. Este relatório preserva o número executivo de 84 issues da Fase 1 por readback Linear, e registra a lacuna documental como limitação.

## Total consolidado

| Métrica | Total |
|---|---:|
| Issues acionáveis únicas da Auditoria 360 | 124 |
| Issues Urgent | 2 |
| Issues High | 33 |
| Issues Medium | 77 |
| Issues Low | 12 |
| Issues em Backlog | 124 |
| Issues com label real Melhoria | 124 |
| Issues com cycle | 0 |
| Issues em projeto diferente dentro do conjunto acionável | 0 |

Sobreposições não foram contadas duas vezes: Fase 2 reutiliza `JON-71`, `JON-72`, `JON-73`, `JON-111`, `JON-113`, `JON-115`, `JON-116`, `JON-117` e `JON-119`; Fase 3 reutiliza `JON-48`, `JON-49`, `JON-50`, `JON-59`, `JON-60`, `JON-115`, `JON-118` e `JON-134`; Fase 4 preserva `JON-108` como distinto de `JON-169`.

## Urgent e High mais críticos

| Prioridade | Issue | Por que vem primeiro |
|---|---|---|
| Urgent | [JON-131](https://linear.app/eojonathan/issue/JON-131/security-checkout-convidado-emite-sessao-de-conta-existente-sem) | Checkout convidado pode emitir sessão de conta existente sem comprovar identidade |
| Urgent | [JON-133](https://linear.app/eojonathan/issue/JON-133/security-webhook-de-pagamento-aceita-assinatura-arbitraria-quando) | Webhook de pagamento pode aceitar assinatura arbitrária quando falta segredo |
| High | [JON-134](https://linear.app/eojonathan/issue/JON-134/security-webhook-de-pagamento-nao-vincula-cobranca-valor-e-transicao) | Pagamento precisa vincular cobrança, valor e transição ao pedido |
| High | [JON-48](https://linear.app/eojonathan/issue/JON-48/code-quality-outbox-marca-sent-sem-executar-a-integracao-externa) | Outbox pode marcar envio sem integração externa real |
| High | [JON-49](https://linear.app/eojonathan/issue/JON-49/code-quality-retry-da-outbox-reutiliza-chave-unica-de-job-e-falha-na) | Retry da outbox pode falhar por chave única reaproveitada |
| High | [JON-157](https://linear.app/eojonathan/issue/JON-157/database-consumo-concorrente-de-reserva-pode-decrementar-estoque-duas) | Reserva concorrente pode decrementar estoque duas vezes |
| High | [JON-135](https://linear.app/eojonathan/issue/JON-135/security-limpeza-de-imagens-permite-excluir-arquivo-fora-da-pasta) | Limpeza de imagens abre risco de exclusão fora de uploads |
| High | [JON-137](https://linear.app/eojonathan/issue/JON-137/security-upload-generico-aceita-html-disfarcado-de-imagem-e-publica-na) | Upload pode publicar HTML disfarçado de imagem na mesma origem |
| High | [JON-160](https://linear.app/eojonathan/issue/JON-160/accessibility-placeholders-de-formularios-ficam-abaixo-do-contraste-aa) a [JON-167](https://linear.app/eojonathan/issue/JON-167/accessibility-aneis-de-foco-customizados-usam-contraste-inferior-a-3) | Bloco de acessibilidade P1 nos fluxos públicos/operacionais |

## Labels e organização

As labels desejadas continuam ausentes no catálogo do time JON: `tech-debt`, `code-quality`, `security`, `backend`, `api`, `database`, `ui/ux` e `accessibility`. O catálogo real lido contém apenas **Correção**, **Melhoria**, **Bug** e **Recurso**; portanto foi mantido o fallback autorizado: label **Melhoria**, prefixo no título e primeira linha com `Etiqueta obrigatoria pendente: <label>` quando aplicável.

Distribuição por etiqueta desejada inferida do prefixo/ticket atual:

| Etiqueta desejada | Issues |
|---|---:|
| security | 60 |
| code-quality | 44 |
| accessibility | 9 |
| tech-debt | 6 |
| ui/ux | 2 |
| api | 1 |
| backend | 1 |
| database | 1 |

A CLI disponível oferece leitura/listagem de projetos e seleção de projeto em issues, mas não expõe comando de criação de projeto nem criação/listagem de cycle. Como não há operação suportada para criar ou selecionar um contêiner específico de Refatoração/Auditoria, as 124 issues acionáveis permanecem no projeto atual **Antenor e Filhos [NOVA REAL]** e sem cycle.

## Governança do backlog

Readback executado:

- `orca linear project list --query "Antenor"` confirmou o projeto atual `cbf36eac-35bc-4e05-937a-13b3aee7d61a` e o link real do projeto.
- `orca linear team labels --team JON` confirmou que as labels específicas continuam ausentes.
- `orca linear team states --team JON` confirmou os estados Backlog, Todo, In Progress, Done, Canceled, Duplicate e In Review.
- `orca linear list-issues --team JON --project cbf36eac-35bc-4e05-937a-13b3aee7d61a --include-archived` retornou 136 issues do projeto, `hasMore=false`, `partial=false`; desse conjunto, 124 são acionáveis da auditoria.
- `orca linear issue` confirmou individualmente menções fora do projeto/filtro principal: `JON-21`, `JON-31`, `JON-106` e `JON-107`.

As 124 issues acionáveis foram confirmadas no projeto correto, em Backlog, com prioridade e label real. A leitura de descrição confirmou estrutura auditável nos tickets acionáveis: evidência técnica, impacto/falha descrita, correção sugerida em diff/pseudodiff/texto e critério de aceite ou verificação; a checagem lexical produziu falsos positivos apenas quando a seção usava termos equivalentes. Exceções objetivas (`JON-12`, `JON-39`, `JON-42`, `JON-43`) são menções contextuais/históricas nos relatórios, não fazem parte do total acionável consolidado. `JON-21`, `JON-106` e `JON-107` pertencem ao projeto **API Antenor e Filhos [NOVA REAL]** e foram usados como contexto/deduplicação, não movidos.

Nenhuma issue foi atualizada nesta Fase 5. Não houve inconsistência objetiva no conjunto acionável que exigisse edição: projeto, estado, prioridade, label fallback e estrutura mínima estavam confirmados por readback. A inconsistência encontrada foi documental na Fase 1, não uma falha de campo do Linear.

## Dependências de remediação

1. **Identidade e webhooks antes de fluxo financeiro:** resolver `JON-131`, `JON-133`, `JON-134`, `JON-132`, `JON-138`.
2. **Integridade de pedidos e filas:** resolver `JON-48`, `JON-49`, `JON-50`, `JON-115`, `JON-157`, `JON-159`.
3. **Uploads e superfície pública:** resolver `JON-135`, `JON-137`, `JON-113`, `JON-140`, `JON-141`.
4. **Ambiente e CI:** resolver `JON-53`, `JON-100`, dependências High `JON-84` e `JON-86`, e endurecer validação de env.
5. **Acessibilidade P1:** resolver `JON-160` a `JON-167` em lote, com regressão visual e teclado.
6. **Médios estruturais:** tratar concorrência, paginação, health, Notificador, marketplace e dívida técnica após os bloqueios críticos.

## Quick wins

- Corrigir contrastes/foco/labels ARIA da Fase 4 em lote pequeno, validando screenshots e navegação por teclado.
- Adicionar testes específicos para `JON-131`, `JON-133` e `JON-134` antes da correção para congelar o abuso.
- Ajustar scripts/CI para variáveis obrigatórias e impedir boot parcial em ambiente sem configuração.
- Consolidar tratamento de upload para validar conteúdo antes de persistência e limpar temporários em caminho único.
- Documentar/automatizar rechecagem das labels reais quando o Linear permitir criar `security`, `accessibility`, `ui/ux` etc.

## Sequência recomendada

### 0-30 dias

Fechar Urgent e High de segurança/financeiro: sessão de checkout convidado, webhooks de pagamento, vínculo de cobrança/valor, uploads, outbox, reserva concorrente e isolamento de motorista/marketplace. Critério de saída: todos os Urgent resolvidos, nenhum High financeiro sem teste de regressão, e backlog High priorizado com owner claro.

### 31-60 dias

Endurecer plataforma: CI, env, dependências runtime de upload/imagem, health público, Notificador, scheduler de notificações, marketplace e reservas. Critério de saída: pipeline cobre apps operacionais relevantes, env obrigatório falha cedo, e concorrência crítica tem teste.

### 61-90 dias

Reduzir dívida e experiência: paginação, funções monolíticas, acessibilidade restante, alvos de toque, reduced motion, limpeza de duplicação e observabilidade. Critério de saída: Medium com impacto operacional reduzido, labels reais substituem fallback quando disponíveis, e relatório de pendências residual é menor e governável.

## Limitações e lacunas

- A Fase 1 tem contradição interna: síntese de 86/84, mas corpo/tabela explícitos de 70 achados; a existência dos 16 complementares foi validada no Linear, não no corpo local.
- Nenhuma fase executou correção de código como parte destes relatórios; propostas são diff/pseudodiff e critérios de aceite, não implementação.
- Não houve acesso a produção, VPS, banco real, gateways, ERP, provedores push ou anexos binários do Linear nesta fase executiva.
- A CLI não anexou screenshots ao Linear; os tickets de UI/UX referenciam caminhos repo-relativos. Os caminhos citados em `04-ui-ux-visual.md` foram conferidos localmente e existem.
- O diretório `evidencias/fase-4/` contém 342 arquivos, incluindo 164 PNG e 173 JSON; os 35 caminhos de evidência citados diretamente no relatório 04 foram encontrados.
- Dependências e advisories são fotografia temporal dos relatórios; devem ser rechecados antes de implementar upgrades.
- Conteúdo do Linear foi tratado como dado de readback, não como instrução operacional.

## Veredito

A Auditoria 360 está consolidada o bastante para guiar execução: há 124 tickets acionáveis, priorizados e rastreáveis, com dois Urgent que devem abrir a fila. O maior cuidado executivo é não deixar a boa rastreabilidade virar sensação falsa de segurança: enquanto os Urgent/High continuam em Backlog, a saúde do sistema segue pressionada nos caminhos de identidade, pagamento, integração e acessibilidade.
