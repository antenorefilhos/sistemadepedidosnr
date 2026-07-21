---
tipo: dashboard
status: ativo
area: memory-wiki
prioridade: alta
criado: 2026-05-24
atualizado: 2026-06-06
tags:
  - dashboard
  - roadmap
  - tarefas
---

# Próximas Ações

As próximas grandes fases e entregas do projeto estão listadas em detalhes em:

👉 **[[../01 - Projeto/ROADMAP.md|ROADMAP.md (Planejamento Ativo)]]**

## Ações Imediatas Recomendadas

Abaixo estão as próximas ações operacionais mapeadas para a retomada do projeto:

### 1. Concluir a organização da Wiki
- [x] Inicializar a estrutura de subdiretórios
- [x] Criar arquivos de Dashboard e Projeto
- [x] Criar arquivos de Contexto e Agentes
- [x] Criar arquivos de Skills e Sistema
- [x] Validar todos os links operacionais no Obsidian com `npm run validate:obsidian-links`

### 2. M39 - UX de Produtos concluído e validado
- [x] Atalhos operacionais do catálogo: Todos, Sem Estoque, Sem Categoria e Inativos.
- [x] Seleção em lote e ações massivas: Ativar, Desativar e Excluir.
- [x] Edição rápida por linha e painel lateral de produto com controles do UI kit.
- [x] Cobertura Cypress em `catalog.cy.ts` e suite admin completa validada em stack real.

### 3. Próxima frente funcional: M33 / Storefront staging
- [x] M33 Inteligência: comparativos, alertas e relatório executivo JSON/CSV validados em runtime local.
- [x] Storefront staging: smoke navegável de produto, carrinho e checkout validado com API real.
- [x] M33 Notificações: envio Web Push real implementado com `web-push`, VAPID configurável e testes unitários.
- [x] Storefront visual responsivo: smoke local/staging com mocks validado em mobile, tablet e desktop.
- [x] Storefront staging: smoke real e mobile rerodados em 05/06.
- [x] Storefront rotas secundárias: smoke visual local/staging validado para `/promocoes`, `/adega`, `/receitas` e detalhe de receita.
- [x] M33 Notificações: manifesto PWA, cache correto de service worker/manifesto e preflight externo de Web Push adicionados.
- [x] Storefront rotas secundárias com API real: `/promocoes`, `/adega` e `/receitas` validadas contra staging `4000/4001`.
- [x] Storefront receitas com API real: receita ativa publicada no staging e detalhe `/receitas/picadinho-de-acem-da-casa` validado sem mocks.
- [x] Admin API de receitas/categorias: DTOs corrigidos e smoke real de criação/leitura/limpeza validado contra staging.
- [x] Storefront UI kit: primeira fatia aplicada em receitas com primitives `Button`, `Badge` e `surfaceClasses`.
- [x] Storefront UI kit: expansão aplicada em Mercado/Produto/Carrinho com `Button`, `Badge`, `Input`, `Checkbox` e `surfaceClasses`.
- [x] Storefront UI kit: expansão aplicada em Checkout/Adega com `Button`, `Badge`, `Input`, `Radio` e `surfaceClasses`, incluindo ajuste de slot de entrega em staging.
- [x] Storefront UI kit: Home migrada para `Button`, `buttonVariants`, `Badge` e `surfaceClasses`, com staging visual/real validado.
- [x] Storefront UI kit: Login/Cadastro migrados com `Input`, `Select`, `Button`, `buttonVariants`, `surfaceClasses` e Cypress `auth-ui-kit`.
- [x] Storefront UI kit: Conta/NotFound/Forbidden/ErrorBoundary migrados com `Button`, `Select`, `Badge`, `buttonVariants` e `surfaceClasses`, com Cypress `account-fallback-ui-kit`.
- [x] Storefront UI kit: `DeliveryVerificationModal` e `NotificationBell` migrados com `Button`, `Input`, `surfaceClasses` e smoke visual `mobile-visual-smoke` 20/20.
- [x] Storefront UI kit: Busca/Search e Promoções migrados para primitives/variants, com varredura limpa em `src/components` e `src/pages`.
- [x] Storefront receitas: acervo editorial staging populado com 5 receitas, 4 categorias e produtos reais via seed idempotente.
- [x] Storefront receitas: capas locais e receitas relacionadas adicionadas ao acervo editorial staging.
- [x] Storefront receitas: contrato editorial protegido por `validate:staging-recipes` e Cypress real com imagens/relacionadas.
- [x] Storefront receitas: capas WebP próprias, copy/SEO revisados e gate `validate:staging-recipes` endurecido para `imageUrl` por slug.
- [x] M33 Notificações: comando de prova real `prove:web-push-delivery` criado para disparar Web Push contra subscription registrada.
- [x] M33 Notificações: CTA de inscrição Web Push exposto no sino do storefront e coberto por smoke visual.
- [x] M33 Notificações: comando `inspect:web-push-subscriptions` criado para confirmar subscriptions registradas antes da prova real.
- [x] M33 Notificações: runbook externo `RUNBOOK_WEB_PUSH.md` criado para homologação com VAPID/HTTPS/dispositivo real.
- [x] M33 Notificações: preflight live `validate:web-push-readiness -- --external --live` criado para validar o domínio publicado antes da prova real.
- [x] M33 Notificações: Cypress `web-push-subscribe.cy.ts` criado para validar inscrição Web Push até `/notifications/push-subscribe`.
- [x] M33 Notificações: `prove:web-push-delivery` endurecido com `--tenant`, validação de `--limit` e limpeza explícita de expiradas/incompletas.
- [x] M33 Notificações: `prove:web-push-delivery -- --dry-run` criado para validar alvo/payload antes do envio real.
- [x] M33 Notificações: `generate:web-push-vapid` criado para gerar chaves VAPID em PowerShell/env/JSON.
- [x] M33 Notificações: `.env.staging.example`, `staging-ops.ps1` e `docker-compose.staging.yml` alinhados para aplicar `STAGING_VAPID_*` sem editar YAML.
- [x] M33 Notificações: `prepare:web-push-env` criado para gerar arquivo `.env` completo de homologação Web Push sem sobrescrita acidental.
- [x] M33 Notificações: `homologate:web-push` criado para orquestrar preflight, inspeção, dry-run e envio real somente com `--send`.
- [x] M33 Notificações: `prepare:web-push-env -- --database-url` e `homologate:web-push` validados ate dry-run com subscription temporaria e cleanup confirmado.
- [x] M33 Notificações: `prepare:web-push-env` aceita VAPID existente com `--vapid-public-key`/`--vapid-private-key`, evitando rotação acidental.
- [x] M33 Notificações: `prepare:web-push-env -- --vapid-from-env --env-file` criado para reutilizar VAPID sem expor chave privada em argumento.
- [x] M33 Notificações: `inspect:web-push-subscriptions` e `prove:web-push-delivery` aceitam `--env-file`, validados com fixture temporaria e cleanup.
- [x] M33 Notificações: `prepare:web-push-env -- --merge-existing` criado para atualizar `.env.staging` sem apagar variáveis não-WebPush.
- [x] M33 Notificações: `validate:web-push-tooling` criado para validar geração de env, readiness, `--vapid-from-env` e `--merge-existing` em um gate automatizado.
- [x] M33 Notificações: `--json-output` e `homologate:web-push -- --evidence-dir` criados para guardar evidencias JSON de inspeção, dry-run e envio real.
- [x] M33 Notificações: `validate:web-push-evidence` criado para validar pacote de evidencias, com `--require-send` após envio real.
- [x] M33 Notificações: `report:web-push-homologation` criado para gerar relatório Markdown a partir do pacote de evidencias validado.
- [x] M33 Notificações: `homologate:web-push -- --validate-evidence --report` criado para validar pacote e gerar relatório no mesmo fluxo.
- [x] M33 Notificações: `homologate:web-push -- --require-empty-evidence-dir` criado para evitar sobrescrever evidências finais por acidente.
- [x] M33 Notificações: `homologate:web-push -- --evidence-dir-auto` criado para gerar subpasta única de evidências por execução.
- [x] M33 Notificações: `confirm:web-push-visual` e `--require-visual-confirmation` criados para registrar recebimento visual na mesma pasta de evidências.
- [x] M33 Notificações: `validate:web-push-readiness -- --json-output` e `--require-readiness` criados para registrar preflight no pacote final.
- [x] M33 Notificações: `finalize:web-push-homologation` criado para validar pacote final com readiness, envio real e confirmação visual, gerando o relatório em um comando.
- [x] M33 Notificações: `validate:web-push-evidence` endurecido para exigir readiness externo/live e origem consistente no pacote final.
- [x] M33 Notificações: `inspect:web-push-subscriptions` agora grava origem no pacote e o relatório final exibe essa origem.
- [x] M33 Notificações: `validate:web-push-readiness` e `homologate:web-push` agora aceitam `--origin` para sobrescrever a origem sem editar `.env`.
- [x] M33 Notificações: `validate:web-push-evidence` agora valida cronologia do pacote final e `report:web-push-homologation` exibe a sequência temporal.
- [x] M33 Notificações: `validate:web-push-evidence` agora valida consistência de alvo entre inspeção, dry-run e envio real.
- [x] M33 Notificações: `finalize:web-push-homologation` agora gera manifesto final `web-push-evidence-manifest.json` com hashes SHA-256 dos artefatos.
- [x] M33 Notificações: `verify:web-push-evidence-manifest` criado para recalcular hashes/tamanho e detectar alteração pós-finalização.
- [x] M33 Notificações: `finalize:web-push-homologation` agora executa a verificação do manifesto automaticamente.
- [x] M33 Notificações: `confirm:web-push-visual -- --finalize` criado para registrar recebimento visual e fechar o pacote final no mesmo comando.
- [x] M33 Notificações: `.env.staging` persistente criado com VAPID alinhado entre backend/storefront; `api_staging` e `storefront_staging` reconstruidos e readiness live local aprovado.
- [x] M33 Notificações: preflight externo local endurecido para falhar de forma limpa, sem assertion do Node, indicando somente a exigencia de HTTPS e origem nao-local.
- [x] M33 Notificações: fluxo real aberto no navegador interno e banco inspecionado; a permissao estava bloqueada e o staging permaneceu com `0` subscriptions completas.
- [x] M33 Notificações: origem HTTPS externa publicada via Tailscale Funnel, preflight externo/live aprovado e subscription real registrada (`total=1 complete=1`).
- [x] M33 Notificações: homologação externa executada com envio real em `artifacts/web-push-homologation/20260606T080939Z`, retornando `sent=1 failed=0`.
- [x] M33 Notificações: `NotificationBell` corrigido para nao exibir estado ativo apenas por permissao de navegador concedida.
- [x] M33 Notificações: helper `register:web-push-cdp-chrome` criado e validado para registrar subscription real via Chrome/CDP.
- [x] M33 Notificações: pacote candidato `20260606T085300Z-final` gerado com subscription Chrome/CDP, `total=6 complete=6` e envio real `sent=1 failed=0`.
- [x] M33 Notificações: confirmação visual registrada por histórico de notificações do Windows e pacote `20260606T085300Z-final` finalizado com manifesto verificado.
- [x] CMS/ERP: fluxo Solidcom -> taxonomia CMS documentado em `CMS_MANUAL.md`.
- [x] M11 Pesaveis: fallback 100g removido quando `fractionStep` esta ausente; backend, carrinho e constraint Postgres agora bloqueiam fracionado sem passo valido.
- [x] M11 Pesaveis: runtime Docker local/staging revalidado; Cypress `product-pricing.cy.ts` passou 5/5 em `3000` e 5/5 em `4000`, com `/mercado` renderizando cards nos dois ambientes.
- [x] M33 Notificações: confirmar visualmente o recebimento do Web Push no navegador/dispositivo e registrar `web-push-visual-confirmation.json`.
- [x] Proxima frente de produto: finalizar o pacote `20260606T085300Z-final` com confirmação visual, relatório final e manifesto verificado.
- [x] Categorias: validação HTTP da árvore em staging local e staging HTTPS publicada com `validate:category-tree`, evidenciando 65 categorias CMS, 72 categorias comerciais, 45 raízes e 20 filhos.
- [ ] Produção final: repetir `validate:category-tree` contra `pedidos.antenorefilhos.com.br`/API final quando DNS/deploy estiver ativo.

Para acompanhar a lista detalhada de tarefas pendentes, consulte [[Pendências]].
