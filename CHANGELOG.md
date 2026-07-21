# Changelog

Todas as mudancas relevantes deste projeto devem ser registradas aqui antes de qualquer release.

## 1.24.148-alpha - 2026-06-06

### Removido
- Removida por decisao de produto toda a frente operacional de imagens de produto criada nesta rodada.
- Excluidos `import-images.js`, `import-images.ts`, `audit-product-images.js`, `summarize-product-image-audit.js` e os scripts npm `product-images:audit`/`product-images:summarize`.
- Excluidos os artefatos de auditoria/sumarizacao em `artifacts/product-image-audit*`.

### Mantido
- As imagens ja existentes em `uploads/products` e `uploads_staging/products` foram preservadas.

### Proxima direcao
- Nao investir em tooling de fotos agora. Quando essa frente voltar, redesenhar uma solucao melhor, menos manual e mais integrada ao fluxo de fornecedor/ERP/CMS.

## 1.24.147-alpha - 2026-06-06

### Removido
- Removida a frente manual de curadoria de imagens por busca/kit/aprovacao local, por nao servir ao fluxo desejado do projeto.
- Excluidos os scripts `product-images:search-queue`, `product-images:apply-approved` e `product-images:prepare-approval-kit`.
- Excluidos os artefatos gerados em `artifacts/product-image-approval-kits`, `artifacts/product-image-approvals` e a fila HTML/CSV P1 top 300.

### Observacao
- Esta entrada foi mantida apenas para registrar a remocao da tentativa manual anterior; a frente restante foi removida em `1.24.148-alpha`.

## 1.24.140-alpha - 2026-06-06

### Corrigido
- `CARD` agora e tratado como pagamento offline/cartao na entrega no checkout e na autorizacao de pedidos, alinhado ao fluxo manual PIX/Dinheiro/Cartao.
- Admin de pedidos passou a reconhecer aliases de pagamento manual (`CARD_ON_DELIVERY`, `CARTAO`, `CARTAO_ENTREGA`, `DINHEIRO`, `MONEY`) nos labels e icones.

### Validado
- `npm test -- --runTestsByPath src/modules/checkout/checkout.service.spec.ts src/modules/orders/orders.service.spec.ts` em `sistema/backend`: OK, 2 suites / 28 testes.
- `npx cypress run --spec cypress/e2e/checkout.cy.ts --config baseUrl=http://localhost:3000` em `sistema/frontend`: OK, 5/5 cobrindo PIX, Dinheiro com troco e Cartao na entrega.
- `npm run build` em `sistema/backend`: OK.
- `npm run build` em `sistema/admin`: OK.
- `npx cypress run --spec cypress/e2e/orders.cy.ts` em `sistema/admin`: OK, 5/5 na tela de pedidos.

## 1.24.139-alpha - 2026-06-06

### Adicionado
- `validate:category-tree` para validar por HTTP o carregamento e a ordenacao da arvore de categorias em ambiente publicado ou API direta.
- O validador cobre `health`, `cms/categories`, `cms/categories/commercial`, `api/categories/hierarchy` e `products/mercadological-tree`, gravando evidencia JSON opcional em `artifacts/category-tree-validation/*`.
- `go-live-ops.ps1 preflight` agora executa `validate:category-tree` e inclui o resultado no relatório de release.

### Validado
- `npm run validate:category-tree -- --api-url http://localhost:4001 --evidence-dir artifacts/category-tree-validation/20260606T0905-staging-local`: OK.
- `npm run validate:category-tree -- --api-url https://jonathan.tailf56692.ts.net/api --evidence-dir artifacts/category-tree-validation/20260606T0905-staging-https`: OK.
- Resultado dos dois ambientes: `CMS categories=65`, `commercialCategories=72`, `hierarchy roots=45`, `hierarchy children=20`.
- `.\\go-live-ops.ps1 preflight -CategoryTreeApiUrl http://localhost:4001`: OK; relatório mais recente `artifacts/release/go-live-preflight-20260606-061403.json`.

### Pendente ambiental
- `pedidos.antenorefilhos.com.br` ainda nao resolve DNS neste host; tentativa registrada em `sistema/artifacts/category-tree-validation/20260606T0927-production-dns-diagnostic/category-tree-validation.json` com `getaddrinfo ENOTFOUND pedidos.antenorefilhos.com.br`. O mesmo artefato confirma que o dominio raiz `antenorefilhos.com.br` resolve, entao o bloqueio esta no subdominio/ponte DNS da aplicacao.
- `products/mercadological-tree` retornou `0` raizes no staging, registrado como aviso porque os produtos de staging podem nao ter `classification01..04` preenchidos.

## 1.24.138-alpha - 2026-06-06

### Finalizado
- Homologacao externa Web Push fechada com pacote final em `sistema/artifacts/web-push-homologation/20260606T085300Z-final`.
- `confirm:web-push-visual -- --finalize` registrou a confirmação visual a partir do histórico de notificações do Windows e executou validação final, relatório, manifesto e verificação de integridade.

### Alterado
- `finalize:web-push-homologation` agora inclui `web-push-windows-notification-history.json` no manifesto final quando esse artefato suplementar existir.

### Evidencias finais
- Preflight externo/live: `origin=https://jonathan.tailf56692.ts.net`, `live=true`.
- Inspeção: `total=6 complete=6`.
- Dry-run: `targets=1 failed=0`.
- Envio real: `sent=1 failed=0`.
- Confirmação visual: histórico de notificações do Windows contém toast do Chrome com título `Antenor Filhos`, corpo `Prova Web Push visual final`, atribuição `jonathan.tailf56692.ts.net` e `displayTimestamp=2026-06-06T08:29:47Z`.
- Manifesto final: `web-push-evidence-manifest.json` com 7 artefatos, incluindo `windows-notification-history`.

### Validado
- `validate:web-push-evidence -- --evidence-dir artifacts/web-push-homologation/20260606T085300Z-final --require-readiness --require-send --require-visual-confirmation`: OK.
- `verify:web-push-evidence-manifest -- --evidence-dir artifacts/web-push-homologation/20260606T085300Z-final`: OK.

## 1.24.137-alpha - 2026-06-06

### Adicionado
- `register:web-push-cdp-chrome` para abrir Chrome por CDP, conceder permissao de notificacoes, autenticar o cliente QA, registrar service worker, gerar subscription real via `PushManager` e salvar a subscription na API.

### Operacional
- Helper CDP validado com Chrome real e perfil persistente: subscription registrada para `qa.cliente@antenor.com.br`, endpoint FCM completo, `auth=true`, `p256dh=true`, `saveStatus=201`.
- Novo pacote de homologacao externa criado em `sistema/artifacts/web-push-homologation/20260606T085300Z-final`.
- `homologate:web-push -- --external --live --env-file .env.staging --origin https://jonathan.tailf56692.ts.net --evidence-dir-auto --evidence-run-id 20260606T085300Z-final --require-empty-evidence-dir --send --validate-evidence --report`: OK.
- Inspecao do pacote final candidato: `total=6 complete=6 incomplete=0`; dry-run apontou para a subscription CDP mais recente; envio real retornou `sent=1 failed=0`.
- Capturas de desktop foram geradas em `sistema/artifacts/web-push-visual-captures/20260606T085300Z-final`, mas nenhuma exibiu toast ou central de notificacoes com o recebimento. A confirmacao visual continua pendente por limitacao do ambiente desktop/Chrome, nao por falha do envio Web Push.

### Validado
- `node --check scripts/register-web-push-cdp-chrome.js`: OK.
- `validate:web-push-evidence -- --evidence-dir artifacts/web-push-homologation/20260606T084200Z-final --require-readiness --require-send`: OK.

## 1.24.136-alpha - 2026-06-06

### Corrigido
- `NotificationBell` deixou de tratar `Notification.permission === 'granted'` como prova de subscription ativa. Agora permissao concedida sem subscription mostra a acao de ativacao, evitando falso positivo visual.

### Operacional
- Storefront staging exposto temporariamente via Tailscale Funnel em `https://jonathan.tailf56692.ts.net`.
- `.env.staging` atualizado para origem HTTPS externa sem rotacionar VAPID; hash publico mantido: `731b17e98595efdc448c045fdc67f34f13405500f982cdd90f3f0308565b54e0`.
- `validate:web-push-readiness -- --external --live --env-file .env.staging`: OK contra a origem HTTPS externa.
- Chrome/Cypress registrou subscription real no staging: `inspect:web-push-subscriptions -- --origin https://jonathan.tailf56692.ts.net --require-ready` retornou `total=1 complete=1 incomplete=0`.
- Pacote de evidencias criado em `sistema/artifacts/web-push-homologation/20260606T080939Z` com readiness externo/live, inspeção, dry-run e envio real.
- `homologate:web-push -- --external --live --env-file .env.staging --origin https://jonathan.tailf56692.ts.net --evidence-dir-auto --send --validate-evidence --report`: OK com `sent=1 failed=0`.
- Tentativas de captura visual automatizada ainda nao produziram confirmacao visual rastreavel; o pacote final permanece pendente de `web-push-visual-confirmation.json` e finalizacao com manifesto.

### Validado
- `npm run build` em `sistema/frontend`: OK.
- `npx cypress run --spec cypress/e2e/web-push-subscribe.cy.ts --config baseUrl=https://jonathan.tailf56692.ts.net --env apiUrl=https://jonathan.tailf56692.ts.net/api`: OK, 1/1.
- `validate:web-push-evidence -- --evidence-dir artifacts/web-push-homologation/20260606T080939Z --require-readiness --require-send`: OK.

## 1.24.135-alpha - 2026-06-06

### Corrigido
- `validate-web-push-readiness.js` nao executa checks HTTP live quando a validação estática já encontrou falhas.
- Falhas esperadas do preflight agora usam `process.exitCode`, evitando assertion do runtime Node no Windows.

### Alterado
- `validate-web-push-tooling.js` passou a cobrir preflight externo inválido com saída limpa, sem `Assertion failed`.

### Operacional
- `.env.staging` local criado com VAPID persistente, conexão com banco staging e paridade entre `STAGING_VAPID_PUBLIC_KEY` e `VITE_VAPID_PUBLIC_KEY`.
- Hash público VAPID do staging local: `731b17e98595efdc448c045fdc67f34f13405500f982cdd90f3f0308565b54e0`.
- `api_staging` e `storefront_staging` reconstruídos com o novo ambiente, preservando banco/volumes.
- `validate:web-push-readiness -- --live --env-file .env.staging`: OK.
- API staging health `ok`; storefront staging HTTP 200.
- Banco staging: `0` subscriptions Web Push completas ou incompletas.
- Storefront aberto com `qa.cliente@antenor.com.br`; navegador integrado reportou permissão de notificações bloqueada.
- Preflight externo reprova corretamente apenas por origem `http://localhost:4000` não ser HTTPS nem não-local.

### Validado
- `node --check` em `validate-web-push-readiness.js` e `validate-web-push-tooling.js`: OK.
- `npm run validate:web-push-tooling`: OK, incluindo falha externa esperada sem assertion.

## 1.24.134-alpha - 2026-06-06

### Alterado
- `confirm-web-push-visual.js` passou a aceitar `--finalize` para registrar a confirmação visual e chamar `finalize-web-push-homologation.js` no mesmo comando.
- `validate-web-push-tooling.js` passou a cobrir `confirm-web-push-visual -- --finalize`, exigindo confirmação visual, relatório, manifesto e verificação de integridade.

### Validado
- `node --check` em `confirm-web-push-visual.js`, `finalize-web-push-homologation.js`, `verify-web-push-evidence-manifest.js` e `validate-web-push-tooling.js`: OK.
- `npm run validate:web-push-tooling`: OK, incluindo finalização a partir da confirmação visual.

## 1.24.133-alpha - 2026-06-06

### Alterado
- `finalize-web-push-homologation.js` agora executa `verify-web-push-evidence-manifest.js` automaticamente depois de gerar `web-push-evidence-manifest.json`.
- `validate-web-push-tooling.js` passou a exigir que o output do finalizador confirme `Web Push evidence manifest verified.`.

### Validado
- `node --check` em `finalize-web-push-homologation.js`, `verify-web-push-evidence-manifest.js` e `validate-web-push-tooling.js`: OK.
- `npm run validate:web-push-tooling`: OK, incluindo verificação automática do manifesto no finalizador.

## 1.24.132-alpha - 2026-06-06

### Adicionado
- Script `sistema/scripts/verify-web-push-evidence-manifest.js` para verificar integridade do manifesto final de evidências Web Push.
- Comando `npm run verify:web-push-evidence-manifest` em `sistema/package.json`.

### Alterado
- `validate-web-push-tooling.js` passou a validar o manifesto gerado pelo finalizador e cobrir fixture negativa quando um artefato é alterado após a finalização.

### Validado
- `node --check` em `finalize-web-push-homologation.js`, `verify-web-push-evidence-manifest.js` e `validate-web-push-tooling.js`: OK.
- `npm run validate:web-push-tooling`: OK, incluindo verificação positiva e negativa do manifesto.

## 1.24.131-alpha - 2026-06-06

### Adicionado
- `finalize-web-push-homologation.js` agora gera `web-push-evidence-manifest.json` junto do relatório final.
- O manifesto registra `generatedAt`, comando, pasta de evidências, relatório, flags obrigatórias e SHA-256/tamanho dos artefatos finais sem incluir segredos.

### Alterado
- `validate-web-push-tooling.js` passou a validar a criação do manifesto, presença dos artefatos críticos e formato dos hashes.

### Validado
- `node --check` em `finalize-web-push-homologation.js` e `validate-web-push-tooling.js`: OK.
- `npm run validate:web-push-tooling`: OK, incluindo manifesto final de evidências.

## 1.24.130-alpha - 2026-06-06

### Alterado
- `validate-web-push-evidence.js` agora valida consistencia de alvo entre inspeção, dry-run e envio real.
- O pacote final passa a falhar quando um alvo enviado nao apareceu no dry-run ou quando um alvo do dry-run nao apareceu como subscription completa na inspeção.
- `validate-web-push-tooling.js` passou a cobrir fixture negativa com `web-push-send.json` vindo de alvo diferente.

### Validado
- `node --check` em `validate-web-push-evidence.js` e `validate-web-push-tooling.js`: OK.
- `npm run validate:web-push-tooling`: OK, incluindo fixture negativa de alvo divergente.

## 1.24.129-alpha - 2026-06-06

### Alterado
- `validate-web-push-evidence.js` agora exige timestamps validos nos artefatos finais de Web Push.
- `validate-web-push-evidence.js` agora valida a ordem cronologica: readiness, inspeção, dry-run, envio real e confirmação visual.
- `validate-web-push-tooling.js` passou a cobrir falha esperada quando a confirmação visual tem `confirmedAt` anterior ao envio real.
- `generate-web-push-homologation-report.js` passou a incluir a seção "Cronologia".

### Validado
- `node --check` em `validate-web-push-evidence.js` e `validate-web-push-tooling.js`: OK.
- `npm run validate:web-push-tooling`: OK, incluindo fixture negativa de cronologia inválida.

## 1.24.128-alpha - 2026-06-06

### Alterado
- `validate-web-push-readiness.js` passou a aceitar `--origin`, sobrescrevendo `WEB_PUSH_ORIGIN`/`FRONTEND_URL` depois de carregar `--env-file`.
- `homologate-web-push.js` passou a aceitar `--origin`, aplicando a mesma origem ao readiness, inspeção, dry-run e envio.
- `validate-web-push-tooling.js` passou a validar `homologate:web-push -- --origin ... --readiness-only` e conferir a origem gravada em `web-push-readiness.json`.

### Validado
- `node --check` em `validate-web-push-readiness.js`, `homologate-web-push.js`, `validate-web-push-tooling.js`, `inspect-web-push-subscriptions.js` e `validate-web-push-evidence.js`: OK.
- `npm run validate:web-push-tooling`: OK, incluindo override explícito de origem no orquestrador.

## 1.24.127-alpha - 2026-06-06

### Alterado
- `inspect-web-push-subscriptions.js` agora registra `origin` no JSON de evidencias a partir de `--origin`, `WEB_PUSH_ORIGIN` ou `FRONTEND_URL`.
- `validate-web-push-evidence.js` agora exige `origin` em `web-push-inspect.json` quando `--require-readiness` é usado.
- `validate-web-push-evidence.js` agora compara tambem a origem da inspeção com readiness, dry-run, envio real e confirmação visual.
- `generate-web-push-homologation-report.js` passou a exibir a origem da inspeção no relatório.

### Validado
- `node --check` em `inspect-web-push-subscriptions.js`, `validate-web-push-evidence.js`, `validate-web-push-tooling.js`, `finalize-web-push-homologation.js` e `generate-web-push-homologation-report.js`: OK.
- `npm run validate:web-push-tooling`: OK, incluindo pacote final com origem de inspeção consistente.

## 1.24.126-alpha - 2026-06-06

### Alterado
- `validate-web-push-evidence.js` agora exige `modes.external=true` e `modes.live=true` quando `--require-readiness` é usado.
- `validate-web-push-evidence.js` agora valida consistencia de origem entre `web-push-readiness.json`, `web-push-dry-run.json`, `web-push-send.json` e `web-push-visual-confirmation.json`.
- `validate-web-push-tooling.js` passou a cobrir falha esperada quando a confirmacao visual aponta para origem diferente da prova.

### Validado
- `node --check` em `validate-web-push-evidence.js`, `validate-web-push-tooling.js` e `finalize-web-push-homologation.js`: OK.
- `npm run validate:web-push-tooling`: OK, incluindo fixture negativa de origem inconsistente.

## 1.24.125-alpha - 2026-06-06

### Adicionado
- Script `sistema/scripts/finalize-web-push-homologation.js` para validar o pacote final de Web Push exigindo readiness, envio real e confirmacao visual, e gerar o relatorio no mesmo comando.
- Comando `npm run finalize:web-push-homologation` em `sistema/package.json`.
- `validate-web-push-tooling.js` passou a cobrir o finalizador usando fixture completa de evidencias.

### Validado
- `node --check` em `finalize-web-push-homologation.js` e `validate-web-push-tooling.js`: OK.
- `npm run validate:web-push-tooling`: OK, incluindo finalizacao do pacote com readiness, envio e confirmacao visual.

## 1.24.124-alpha - 2026-06-06

### Adicionado
- `validate-web-push-readiness.js` passou a aceitar `--json-output`, gravando `web-push-readiness.json` sem segredos.
- `homologate-web-push.js` agora grava `web-push-readiness.json` no pacote quando `--evidence-dir`/`--evidence-dir-auto` é usado.
- `validate-web-push-evidence.js` passou a aceitar `--require-readiness`, exigindo preflight registrado e VAPID publico pareado com o build do storefront.
- `generate-web-push-homologation-report.js` passou a incluir a secao "Preflight" e listar `web-push-readiness.json`.
- `validate-web-push-tooling.js` passou a validar a escrita real de readiness JSON e a fixture final com `--require-readiness`.

### Validado
- `node --check` em `validate-web-push-readiness.js`, `validate-web-push-tooling.js`, `validate-web-push-evidence.js`, `generate-web-push-homologation-report.js` e `homologate-web-push.js`: OK.
- `npm run validate:web-push-tooling`: OK, incluindo readiness JSON, fixture de evidencia final e relatorio.

## 1.24.123-alpha - 2026-06-06

### Adicionado
- Script `sistema/scripts/confirm-web-push-visual.js` para registrar `web-push-visual-confirmation.json` na pasta de evidencias da homologacao Web Push.
- Comando `npm run confirm:web-push-visual` em `sistema/package.json`.
- `validate-web-push-evidence.js` passou a aceitar `--require-visual-confirmation`, exigindo confirmacao visual rastreavel depois do envio real.
- `generate-web-push-homologation-report.js` passou a incluir a secao "Confirmacao Visual" e a evidenciar `web-push-visual-confirmation.json` quando presente.
- `homologate-web-push.js` passou a repassar `--require-visual-confirmation` para validacao/relatorio quando a pasta de evidencias ja tiver essa confirmacao.
- `validate-web-push-tooling.js` agora cobre fixture de confirmacao visual, validacao final e relatorio.

### Validado
- `node --check` em `confirm-web-push-visual.js`, `validate-web-push-evidence.js`, `generate-web-push-homologation-report.js`, `homologate-web-push.js` e `validate-web-push-tooling.js`: OK.
- Fixture temporaria sem `web-push-visual-confirmation.json` + `--require-visual-confirmation`: falha esperada.
- `npm run confirm:web-push-visual` criou `web-push-visual-confirmation.json`: OK.
- `npm run validate:web-push-evidence -- --require-send --require-visual-confirmation` com fixture completa: OK.
- `npm run report:web-push-homologation -- --require-send --require-visual-confirmation` gerou relatorio com confirmacao visual: OK.
- `npm run validate:web-push-tooling`: OK, incluindo validacao/relatorio de confirmacao visual.

## 1.24.122-alpha - 2026-06-06

### Alterado
- `productPricing.ts` nao cria mais porcao default de 100g para produto fracionado sem `fractionStep` persistido.
- `productCard.ts` marca fracionado sem `fractionStep` positivo como indisponivel para venda e exibe pendencia de fracionamento.
- `CartContext` ignora adicao local de fracionado sem `fractionStep` valido.
- `CartService` rejeita item fracionado sem `fractionStep` positivo antes de aceitar quantidade no carrinho.
- Migration `20260606003000_require_fraction_step_for_fractional_products` adicionou constraint Postgres para impedir `isFractional=true` sem `fractionStep > 0`.

### Validado
- `npm run test:unit -- --run src/utils/productPricing.test.ts src/contexts/CartContext.test.tsx`: 64/64 OK.
- `npm test -- --runTestsByPath src/modules/products/products.service.spec.ts src/modules/checkout/checkout.service.spec.ts`: 42/42 OK.
- `npm run build` em `sistema/backend`: OK.
- `npm run build` em `sistema/frontend`: OK.
- `npx prisma validate` e `npx prisma migrate deploy` em local e staging: OK.
- Auditoria DB local: 1460 fracionados, 0 sem `fractionStep`.
- Auditoria DB staging: 0 fracionados, 0 sem `fractionStep`.
- Constraint `products_fraction_step_required_for_fractional` confirmada em local e staging.
- Docker local/staging: `api`, `storefront`, `api_staging` e `storefront_staging` rebuildados/recriados; `/health` e homes responderam 200.
- Cypress `product-pricing.cy.ts` contra storefront Docker local `http://127.0.0.1:3000`: 5/5 OK.
- Cypress `product-pricing.cy.ts` contra storefront Docker staging `http://127.0.0.1:4000`: 5/5 OK.
- Browser em `/mercado`: local renderizou 24 cards/2553 produtos; staging renderizou 24 cards/29 produtos.

## 1.24.121-alpha - 2026-06-06

### Documentado
- `CMS_MANUAL.md` recebeu o fluxo operacional Solidcom -> catalogo -> taxonomia CMS.
- O manual agora explicita a precedencia: mapeamento EAN confirmado, fila de pendencias, fallback por `classification01..04` e categoria generica somente em ultimo caso.
- A pendencia de documentar a integracao Solidcom/taxonomia foi marcada como concluida em `Pendências.md`.

### Validado
- Fonte técnica conferida em `solidcom-erp.service.ts`, `handoff-apply.js`, endpoints admin de categorias e `REFERENCIA_TECNICA.md`.

## 1.24.120-alpha - 2026-06-05

### Alterado
- `homologate-web-push.js` passou a aceitar `--evidence-dir-auto` para criar uma subpasta timestampada de evidencias automaticamente.
- `homologate-web-push.js` passou a aceitar `--evidence-run-id` para nomear explicitamente a subpasta automática.
- Quando `--evidence-dir-auto` é usado sem `--evidence-dir`, a base padrão é `artifacts/web-push-homologation`.
- Quando `--evidence-dir-auto` é usado com `--evidence-dir`, o valor informado vira a pasta base.

### Validado
- `node --check scripts/homologate-web-push.js`: OK.
- `--evidence-dir-auto --evidence-run-id codex-auto-dir-test --require-empty-evidence-dir --readiness-only`: criou subpasta automática e passou com env temporario valido.
- `--evidence-run-id bad/id`: falhou corretamente por caractere inválido.
- Homologacao seca em staging local com subscription temporaria `codex-auto-evidence-flow`, `--evidence-dir-auto`, `--validate-evidence` e `--report`: OK.
- Cleanup confirmado: subscription temporaria removida com `remaining=0`; env/evidence temporarios removidos.
- `npm run validate:web-push-tooling`: OK.

## 1.24.119-alpha - 2026-06-05

### Alterado
- `homologate-web-push.js` passou a aceitar `--require-empty-evidence-dir` para bloquear sobrescrita acidental de evidências existentes.
- `homologate-web-push.js` passou a aceitar `--force-evidence-overwrite` para permitir reaproveitamento consciente da pasta de evidências.

### Validado
- `node --check scripts/homologate-web-push.js`: OK.
- Pasta temporaria de evidencias com arquivo existente + `--require-empty-evidence-dir`: falha correta antes do preflight.
- Mesma pasta com `--force-evidence-overwrite` e env temporario valido: passou em `--readiness-only`.
- `npm run validate:web-push-tooling`: OK.
- Temporarios removidos.

## 1.24.118-alpha - 2026-06-05

### Alterado
- `homologate-web-push.js` passou a aceitar `--validate-evidence` para validar o pacote gerado em `--evidence-dir`.
- `homologate-web-push.js` passou a aceitar `--report` para gerar `web-push-homologation-report.md` ao final da homologação.
- Quando usado com `--send`, o orquestrador passa `--require-send` para validação/relatório; sem `--send`, valida o pacote parcial de dry-run.
- `--validate-evidence` e `--report` agora exigem `--evidence-dir`.

### Validado
- `node --check scripts/homologate-web-push.js`: OK.
- Subscription temporaria `codex-integrated-homologate` criada no staging local.
- `npm run homologate:web-push -- --env-file .tmp-web-push-integrated.env --endpoint-contains codex-integrated-homologate --limit 1 --evidence-dir .tmp-web-push-integrated-evidence --validate-evidence --report`: OK ate dry-run, validou evidencias e gerou relatório no mesmo comando.
- `npm run homologate:web-push -- ... --report` sem `--evidence-dir`: falhou corretamente com `--report exige --evidence-dir`.
- Cleanup confirmado: subscription temporaria removida com `remaining=0`; env/evidence temporarios removidos.
- `npm run validate:web-push-tooling`: OK.

## 1.24.117-alpha - 2026-06-05

### Adicionado
- `sistema/scripts/generate-web-push-homologation-report.js` criado para gerar relatório Markdown a partir do pacote de evidências Web Push.
- Comando `npm run report:web-push-homologation` adicionado em `sistema/package.json`.
- O gerador valida o pacote com `validate-web-push-evidence` antes de escrever o relatório e aceita `--evidence-dir`, `--output` e `--require-send`.

### Validado
- `node --check scripts/generate-web-push-homologation-report.js`: OK.
- Fixture temporaria sem envio real gerou `web-push-homologation-report.md`: OK.
- Relatório com `--require-send` falhou corretamente quando `web-push-send.json` estava ausente.
- Subscription temporaria `codex-report-fixture` criada no staging local.
- `npm run homologate:web-push -- --env-file .tmp-web-push-report.env --endpoint-contains codex-report-fixture --limit 1 --evidence-dir .tmp-web-push-report-evidence`: OK ate dry-run.
- `npm run validate:web-push-evidence -- --evidence-dir .tmp-web-push-report-evidence`: OK.
- `npm run report:web-push-homologation -- --evidence-dir .tmp-web-push-report-evidence`: OK.
- Cleanup confirmado: subscription temporaria removida com `remaining=0`; env/evidence temporarios removidos.
- `npm run validate:web-push-tooling`: OK.

## 1.24.116-alpha - 2026-06-05

### Adicionado
- `sistema/scripts/validate-web-push-evidence.js` criado para validar pacote de evidencias de homologacao Web Push.
- Comando `npm run validate:web-push-evidence` adicionado em `sistema/package.json`.
- O validador aceita `--evidence-dir` e `--require-send`, conferindo inspeção, dry-run e envio real quando exigido.

### Validado
- `node --check scripts/validate-web-push-evidence.js`: OK.
- Fixture temporaria de evidencias validada sem envio real: OK.
- `--require-send` falhou corretamente quando `web-push-send.json` estava ausente.
- Fixture temporaria com `web-push-send.json` validada com `--require-send`: OK.
- Subscription temporaria `codex-evidence-validator` criada no staging local.
- `npm run homologate:web-push -- --env-file .tmp-web-push-evidence-validator.env --endpoint-contains codex-evidence-validator --limit 1 --evidence-dir .tmp-web-push-evidence-validator-real`: OK ate dry-run.
- `npm run validate:web-push-evidence -- --evidence-dir .tmp-web-push-evidence-validator-real`: OK.
- Cleanup confirmado: subscription temporaria removida com `remaining=0`; env/evidence temporarios removidos.
- `npm run validate:web-push-tooling`: OK.

## 1.24.115-alpha - 2026-06-05

### Adicionado
- `inspect-web-push-subscriptions.js` passou a aceitar `--json-output` para registrar evidência de total/completas/incompletas, filtros, providers, clientes e endpoints mascarados.
- `prove-web-push-delivery.js` passou a aceitar `--json-output` para registrar evidência de dry-run/envio, filtros, payload, resultados, falhas e alvos com endpoint mascarado.
- `homologate-web-push.js` passou a aceitar `--evidence-dir`, gravando `web-push-inspect.json`, `web-push-dry-run.json` e, quando usado com `--send`, `web-push-send.json`.

### Validado
- `node --check` em `inspect-web-push-subscriptions.js`, `prove-web-push-delivery.js`, `homologate-web-push.js` e `validate-web-push-tooling.js`: OK.
- Subscription temporaria `codex-json-evidence` criada no staging local.
- `npm run homologate:web-push -- --env-file .tmp-web-push-json-evidence.env --endpoint-contains codex-json-evidence --limit 1 --evidence-dir .tmp-web-push-evidence`: OK ate dry-run, `targets=1 failed=0`.
- Evidencias JSON parseadas e validadas: `web-push-inspect.json` com `total=1 complete=1 ready=true`; `web-push-dry-run.json` com `dryRunTargets=1 failed=0`.
- Cleanup confirmado: subscription temporaria removida com `remaining=0`; env/evidence temporarios removidos.
- `npm run validate:web-push-tooling`: OK.

## 1.24.114-alpha - 2026-06-05

### Adicionado
- `sistema/scripts/validate-web-push-tooling.js` criado como gate automatizado da tooling operacional de Web Push.
- Comando `npm run validate:web-push-tooling` adicionado em `sistema/package.json`.

### Validado
- `node --check scripts/validate-web-push-tooling.js`: OK.
- `npm run validate:web-push-tooling`: OK.
- O gate confirmou geração de env staging, preflight de readiness, reutilização de VAPID por `--vapid-from-env` sem imprimir segredos e merge de env preservando `NODE_ENV`/`CUSTOM_KEEP`.
- Arquivos temporarios criados pelo gate foram removidos automaticamente.

## 1.24.113-alpha - 2026-06-05

### Alterado
- `prepare-web-push-env.js` passou a aceitar `--merge-existing` para atualizar um `.env` existente preservando comentários e variáveis não geradas pelo comando.
- Quando o destino existe, a mensagem de erro agora recomenda `--force` para substituir tudo ou `--merge-existing` para preservar chaves existentes.
- A saída informa `Write mode: merge-existing` ou `Write mode: replace`.

### Validado
- `node --check scripts/prepare-web-push-env.js`: OK.
- `.tmp-web-push-merge.env` criado com `NODE_ENV`, `CUSTOM_KEEP`, `DATABASE_URL` antigo e VAPID antigo.
- `npm run prepare:web-push-env -- --output .tmp-web-push-merge.env --merge-existing ...`: OK sem `--force`.
- Merge preservou `NODE_ENV=staging` e `CUSTOM_KEEP=nao-apagar`, atualizou/adicionou variáveis Web Push e manteve `DATABASE_URL`.
- `npm run validate:web-push-readiness -- --env-file .tmp-web-push-merge.env`: OK.
- Arquivo temporario removido.

## 1.24.112-alpha - 2026-06-05

### Alterado
- `inspect-web-push-subscriptions.js` passou a aceitar `--env-file` com override de `.env`, `.env.local` e `.env.staging`.
- `prove-web-push-delivery.js` passou a aceitar `--env-file` com override para `DATABASE_URL` e VAPID.

### Validado
- `node --check scripts/inspect-web-push-subscriptions.js`: OK.
- `node --check scripts/prove-web-push-delivery.js`: OK.
- Env temporario `.tmp-web-push-direct.env` gerado com `DATABASE_URL` staging local.
- Subscription temporaria `codex-direct-env-file` criada no staging.
- `npm run inspect:web-push-subscriptions -- --env-file .tmp-web-push-direct.env --endpoint-contains codex-direct-env-file --limit 1 --require-ready`: OK, `total=1 complete=1 incomplete=0`.
- `npm run prove:web-push-delivery -- --env-file .tmp-web-push-direct.env --dry-run --endpoint-contains codex-direct-env-file --limit 1`: OK, `targets=1 failed=0`.
- Subscription temporaria removida: `deleted=1 remaining=0`; env temporario removido.

## 1.24.111-alpha - 2026-06-05

### Alterado
- `prepare-web-push-env.js` passou a carregar `.env`, `.env.local`, `.env.staging` e `--env-file`.
- Adicionado `--vapid-from-env` para reutilizar `STAGING_VAPID_*`/`VAPID_*` sem passar chave privada na linha de comando.
- O preparador bloqueia o uso simultaneo de `--vapid-from-env` com `--vapid-public-key`/`--vapid-private-key`.

### Validado
- `node --check scripts/prepare-web-push-env.js`: OK.
- Env fonte temporario gerado com VAPID novo: OK.
- Env derivado gerado com `--vapid-from-env --env-file .tmp-web-push-source.env`: OK, `VAPID: provided (env)`.
- `npm run validate:web-push-readiness -- --env-file` aceitou env fonte e derivado.
- Hashes SHA-256 das chaves fonte/derivada confirmaram `publicSame=True privateSame=True`, sem imprimir segredo.
- Uso combinado de `--vapid-from-env` e chaves por argumento falhou corretamente.
- Arquivos temporarios de validação removidos.

## 1.24.110-alpha - 2026-06-05

### Alterado
- `prepare-web-push-env.js` passou a aceitar `--vapid-public-key` e `--vapid-private-key` para montar env com um par VAPID ja existente, sem rotacionar chaves.
- O preparador valida par completo, tamanho base64url da chave publica/privada e aceita o par via `web-push.setVapidDetails` antes de gravar o arquivo.
- A saída informa se o VAPID foi `generated` ou `provided`.

### Validado
- `node --check scripts/prepare-web-push-env.js`: OK.
- `npm run prepare:web-push-env` com geração automática: OK, `VAPID: generated`.
- `npm run prepare:web-push-env` com `--vapid-public-key` e `--vapid-private-key`: OK, `VAPID: provided`.
- `npm run validate:web-push-readiness -- --env-file` aceitou os envs temporários gerado e fornecido.
- Par incompleto falhou corretamente exigindo `--vapid-public-key` e `--vapid-private-key` juntos.
- Arquivos temporários de validação removidos.

## 1.24.109-alpha - 2026-06-05

### Alterado
- `prepare-web-push-env.js` passou a aceitar `--database-url` e gravar `DATABASE_URL` no arquivo `.env` gerado.

### Validado
- `node --check scripts/prepare-web-push-env.js`: OK.
- `npm run prepare:web-push-env -- --output .tmp-web-push-db.env --staging --origin http://localhost:4000 --admin-origin http://localhost:4002 --subject mailto:qa@antenor.com.br --database-url ... --force`: OK.
- Subscription temporaria `codex-homologate-dry-run` criada no staging local.
- `npm run homologate:web-push -- --env-file .tmp-web-push-db.env --endpoint-contains codex-homologate-dry-run --limit 1`: OK ate dry-run, `targets=1 failed=0`, sem envio real.
- Subscription temporaria removida e confirmada com `remaining=0`; arquivo `.tmp-web-push-db.env` removido.
- `npm run inspect:web-push-subscriptions -- --endpoint-contains codex-homologate-dry-run --limit 1`: OK, `total=0 complete=0 incomplete=0`.

## 1.24.108-alpha - 2026-06-05

### Adicionado
- Script `homologate-web-push.js` para orquestrar a homologacao Web Push na ordem: preflight, inspeção de subscriptions, dry-run e envio real opcional.
- Comando `npm run homologate:web-push` em `sistema/`.
- Modo seguro padrão: o comando executa preflight, inspeção e dry-run, mas só envia notificação real quando `--send` for informado.
- Suporte a `--env-file`, `--external`, `--live`, `--readiness-only`, filtros de subscription e payload da prova.

### Validado
- `node --check scripts/homologate-web-push.js`: OK.
- `npm run homologate:web-push -- --external --env-file .tmp-web-push.env --readiness-only`: OK com arquivo HTTPS temporario.
- `npm run homologate:web-push -- --external --env-file .tmp-web-push.env`: falha esperada na inspeção por `DATABASE_URL` ausente no arquivo temporario.
- Arquivo temporario `.tmp-web-push.env` removido apos validacao.

## 1.24.107-alpha - 2026-06-05

### Adicionado
- Script `prepare-web-push-env.js` para gerar um arquivo `.env` de homologacao Web Push com chaves VAPID novas, origem storefront, origem admin, CORS e `VITE_VAPID_PUBLIC_KEY`.
- Comando `npm run prepare:web-push-env` em `sistema/`.
- Suporte a `--staging`, `--output`, `--origin`, `--admin-origin`, `--subject` e `--force`.

### Validado
- `node --check scripts/prepare-web-push-env.js`: OK.
- `npm run prepare:web-push-env -- --output .tmp-web-push.env --staging --origin https://loja.example.com --admin-origin https://admin.example.com --subject mailto:qa@antenor.com.br --force`: OK.
- Arquivo temporario HTTPS gerado alimentou `npm run validate:web-push-readiness -- --external --env-file .tmp-web-push.env`: OK.
- Protecao contra sobrescrita sem `--force`: falha esperada.
- `--subject invalid-subject`: falha esperada sem stack trace.
- Arquivos temporarios `.tmp-web-push.env` e `.tmp-web-push-local.env` removidos apos validacao.

## 1.24.106-alpha - 2026-06-05

### Alterado
- `docker-compose.staging.yml` passou a aceitar `STAGING_CORS_ORIGIN`, `STAGING_FRONTEND_URL` e `STAGING_ADMIN_URL`, preservando defaults locais em `localhost:4000/4001/4002`.
- `staging-ops.ps1` agora carrega `.env.staging` automaticamente quando o arquivo existir, permitindo que `STAGING_VAPID_*` alimente backend e build do storefront.
- `.env.staging.example` passou a documentar `STAGING_VAPID_*`, `WEB_PUSH_ORIGIN` e URLs staging usadas pela prova Web Push.
- `.env.production.example` passou a documentar `WEB_PUSH_ORIGIN` e `VAPID_*`.

### Validado
- Sintaxe PowerShell de `staging-ops.ps1`: OK.
- `docker compose -f docker-compose.staging.yml config --quiet`: OK.
- Varredura de variáveis Web Push/staging nos exemplos e compose: OK.

## 1.24.105-alpha - 2026-06-05

### Adicionado
- Script `generate-web-push-vapid.js` para gerar chaves VAPID com o pacote `web-push` do backend.
- Comando `npm run generate:web-push-vapid` em `sistema/`.
- Saídas suportadas: PowerShell padrão, `.env` com `--env`, JSON com `--json` e variáveis `STAGING_` com `--staging`.

### Validado
- `node --check scripts/generate-web-push-vapid.js`: OK.
- `npm run generate:web-push-vapid -- --subject mailto:qa@antenor.com.br`: OK.
- `npm run generate:web-push-vapid -- --staging --env --subject https://antenor.com.br`: OK.
- `npm run generate:web-push-vapid -- --subject invalid-subject`: falha esperada sem stack trace, exigindo `mailto:` ou `https://`.
- Chaves geradas via `--json` alimentaram `npm run validate:web-push-readiness -- --external`: OK.

## 1.24.104-alpha - 2026-06-05

### Adicionado
- Modo `--dry-run` em `prove-web-push-delivery.js` para validar filtros, payload e subscriptions alvo sem enviar Web Push nem executar limpezas.

### Validado
- `node --check scripts/prove-web-push-delivery.js`: OK.
- Subscription temporária `codex-dry-run` criada no staging, usada em `npm run prove:web-push-delivery -- --dry-run --endpoint-contains codex-dry-run --limit 1` e removida no `finally`: OK, `targets=1 failed=0`.
- `npm run inspect:web-push-subscriptions` após limpeza: OK, `total=0 complete=0 incomplete=0`.
- `npm run prove:web-push-delivery -- --dry-run --endpoint-contains codex-dry-run --limit 1` após limpeza: falha esperada por nenhuma subscription encontrada.

## 1.24.103-alpha - 2026-06-05

### Alterado
- `prove-web-push-delivery.js` passou a validar `--limit` como inteiro de 1 a 100.
- O script de prova passou a aceitar filtro `--tenant`.
- O resultado passou a reportar `expiredRemoved` e `incompleteRemoved`.

### Adicionado
- Flags operacionais `--cleanup-expired` e `--cleanup-incomplete` para remover subscriptions expiradas ou incompletas apenas quando solicitado explicitamente.

### Validado
- `node --check scripts/prove-web-push-delivery.js`: OK.
- `npm run prove:web-push-delivery` contra staging com VAPID temporário: falha esperada por ausência de subscription real.
- `npm run inspect:web-push-subscriptions` contra staging: OK, `total=0 complete=0 incomplete=0`.
- `npm run prove:web-push-delivery -- --limit 0`: falha esperada com validação de limite.

## 1.24.102-alpha - 2026-06-05

### Adicionado
- Cypress `web-push-subscribe.cy.ts` para provar o fluxo de inscrição Web Push no storefront.
- A spec simula `Notification`, `serviceWorker.ready`, `PushManager.getSubscription`, `PushManager.subscribe` e valida o POST para `/notifications/push-subscribe`.

### Validado
- Cypress local `web-push-subscribe.cy.ts` contra Vite em `http://127.0.0.1:5174` com VAPID público temporário: 1/1 OK.
- Frontend `npm run build` com `VITE_VAPID_PUBLIC_KEY` temporária: OK.
- `npm run validate:obsidian-links`: OK.
- `npm run validate:web-push-readiness -- --live` contra staging local `127.0.0.1:4000`: OK.

## 1.24.101-alpha - 2026-06-05

### Adicionado
- Script raiz `scripts/validate-obsidian-links.js` para validar wikilinks e links Markdown locais da wiki operacional.
- Comando `npm run validate:obsidian-links`.
- Páginas `Agente Designer`, `Agente Programador`, `Agente Revisão` e `UI UX Pro Max` para fechar wikilinks pendentes.

### Alterado
- Links relativos quebrados da wiki foram corrigidos após a reorganização em subpastas.
- Links para arquivo legado ausente `memories/repo/docker-startup-complete.md` foram convertidos em referência textual.
- O validador ignora `06 - Sessões` por padrão para preservar transcrições históricas brutas; `--include-sessions` mantém auditoria rígida opcional.

### Validado
- `node --check scripts/validate-obsidian-links.js`: OK.
- `npm run validate:obsidian-links`: OK, 42 arquivos operacionais escaneados, 3 sessões históricas ignoradas e 0 links quebrados.
- `node scripts/validate-obsidian-links.js --include-sessions`: falha esperada com 5 links quebrados apenas em transcrições históricas preservadas.

## 1.24.100-alpha - 2026-06-05

### Alterado
- `validate-web-push-readiness.js` passou a carregar `.env.staging`, aceitar `--env-file` e validar a origem publicada com `--live`.
- O modo `--live` consulta `WEB_PUSH_ORIGIN`, validando HTML, `/manifest.webmanifest`, `/service-worker.js`, Content-Type, cache do service worker e handlers mínimos de Web Push.
- `RUNBOOK_WEB_PUSH.md` passou a orientar a homologação externa com `npm run validate:web-push-readiness -- --external --live`.

### Validado
- `node --check scripts/validate-web-push-readiness.js`: OK.
- `npm run validate:web-push-readiness -- --live` contra `http://127.0.0.1:4000` com VAPID temporário: OK.
- `npm run validate:web-push-readiness -- --external` com origem HTTPS/VAPID temporários: OK.
- `npm run inspect:web-push-subscriptions` contra staging: OK, `total=0 complete=0 incomplete=0`.
- `npm run inspect:web-push-subscriptions -- --require-ready` contra staging: falha esperada enquanto não existe subscription real.
- `npm run prove:web-push-delivery` contra staging com VAPID temporário: falha esperada por nenhuma subscription registrada.

## 1.24.99-alpha - 2026-06-05

### Adicionado
- Capas editoriais WebP próprias para as 5 receitas publicadas em `sistema/frontend/public/recipes/`.
- Assets gerados com a skill `imagegen` e convertidos para WebP com `ffmpeg`, mantendo os originais em `C:\Users\eojon\.codex\generated_images\019e63db-307e-7a81-801a-27810f3c2dd0`.

### Alterado
- `seed-staging-recipes.js` passou a usar `/recipes/*.webp` por slug em vez de banners genéricos.
- Copy editorial de categorias, títulos, descrições, SEO descriptions, ingredientes e passos foi revisada para português de produção.
- `validate-staging-recipes.js` passou a validar também o `imageUrl` esperado de cada receita, além da existência do arquivo em `frontend/public`.

### Validado
- `node --check scripts/seed-staging-recipes.js`: OK.
- `node --check scripts/validate-staging-recipes.js`: OK.
- `npm run seed:staging-recipes` contra staging com `DATABASE_URL` explícita: OK, 5 receitas publicadas.
- `npm run validate:staging-recipes` contra staging com `DATABASE_URL` explícita: OK.
- Frontend `npm run build`: OK.
- Docker staging: `storefront_staging` rebuildado/recriado; `api_staging` recriado pela composicao.
- API staging `/health`: OK.
- Assets `/recipes/*.webp` em `http://127.0.0.1:4000`: 5/5 HTTP 200, `image/webp`.
- Cypress staging `staging-secondary-routes-real.cy.ts` + `secondary-routes-visual.cy.ts`: 20/20 OK.
- Cypress staging `staging-smoke.cy.ts`: 1/1 OK.
- Cypress staging `staging-secondary-routes-real.cy.ts` apos revisão de copy: 4/4 OK.

## 1.24.98-alpha - 2026-06-05

### Alterado
- `Search`/`Mercado` migrou busca, limpar busca, sugestoes, chips de categoria, subcategorias, botao de filtros, painel de filtros, filtros de preco, selects mercadologicos, limpar filtros, sugestoes rapidas, CTA de estado vazio e barra movel de carrinho para primitives do UI kit.
- `Promocoes` removeu `btn-gold` legado e passou a usar `buttonVariants`.
- Primitive `Input` passou a aceitar `ref` via `forwardRef`, mantendo compatibilidade com foco/blur programatico da busca.

### Validado
- Varredura `rg` em `sistema/frontend/src/components` e `sistema/frontend/src/pages`: controles nativos diretos restantes apenas nos wrappers `components/ui/*` e no compat layer `LoadingButton`.
- Frontend `npm run build`: OK.
- Cypress local `mobile-visual-smoke.cy.ts` + `secondary-routes-visual.cy.ts` contra `http://127.0.0.1:5173`: 36/36 OK.
- Docker staging: `storefront_staging` rebuildado/recriado; `api_staging` recriado pela composicao.
- API staging `/health`: OK.
- Storefront staging `http://127.0.0.1:4000`: HTTP 200.
- Cypress staging `mobile-visual-smoke.cy.ts` + `secondary-routes-visual.cy.ts` + `staging-smoke.cy.ts` contra `http://127.0.0.1:4000`: 37/37 OK.

## 1.24.97-alpha - 2026-06-05

### Adicionado
- Cypress `mobile-visual-smoke.cy.ts` passou a cobrir o modal de verificacao de entrega em mobile, incluindo fallback de geolocalizacao, busca de CEP, calculo de entrega e checagem de overflow.

### Alterado
- `DeliveryVerificationModal` migrou controles para UI kit: `Button`, `Input`, `surfaceClasses` e `cn`, preservando fluxo de GPS, CEP, validacao de entrega e cache local.
- `DeliveryVerificationModal` ganhou `role="dialog"`, `aria-modal` e `aria-labelledby`.
- `NotificationBell` migrou gatilho, fechamento e superficie do dropdown para `Button` e `surfaceClasses`, mantendo CTA de Web Push e lista de notificacoes.

### Validado
- Frontend `npm run build`: OK.
- Cypress local `mobile-visual-smoke.cy.ts` contra `http://127.0.0.1:5173`: 20/20 OK.
- Docker staging: `storefront_staging` rebuildado/recriado; `api_staging` recriado pela composicao.
- API staging `/health`: OK.
- Storefront staging `http://127.0.0.1:4000`: HTTP 200.
- Cypress staging `mobile-visual-smoke.cy.ts` contra `http://127.0.0.1:4000`: 20/20 OK.
- Cypress staging real `staging-smoke.cy.ts` contra `4000/4001`: 1/1 OK.

## 1.24.96-alpha - 2026-06-05

### Adicionado
- Cypress `account-fallback-ui-kit.cy.ts` cobrindo Conta autenticada, tabs, filtro de pagamento e fallbacks 403/404 em mobile e desktop.

### Alterado
- `Account` migrou os principais controles para UI kit: tabs com `Button`, logout, CTA de estado vazio, repetir pedido, WhatsApp, filtro de pagamento com `Select`, badges de perfil/endereco e superficies com `surfaceClasses`.
- `NotFound`, `Forbidden` e `ErrorBoundary` passaram a usar `surfaceClasses`, `Button` e `buttonVariants`.

### Validado
- Frontend `npm run build`: OK.
- Cypress local `account-fallback-ui-kit.cy.ts` contra `http://127.0.0.1:5173`: 4/4 OK.
- Cypress local `auth-ui-kit.cy.ts` contra `http://127.0.0.1:5173`: 4/4 OK.
- Docker staging: `storefront_staging` rebuildado/recriado; `api_staging` recriado pela composicao.
- API staging `/health`: OK.
- Cypress staging `account-fallback-ui-kit.cy.ts` contra `http://127.0.0.1:4000`: 4/4 OK.
- Cypress staging `auth-ui-kit.cy.ts` contra `http://127.0.0.1:4000`: 4/4 OK.
- Cypress staging real `staging-smoke.cy.ts` contra `4000/4001`: 1/1 OK.

## 1.24.95-alpha - 2026-06-05

### Adicionado
- Primitive `Select` no UI kit do storefront em `sistema/frontend/src/components/ui/select.tsx`.
- Cypress `auth-ui-kit.cy.ts` cobrindo Login e Cadastro em mobile e desktop, com checagem de campos, CTAs e overflow horizontal.

### Alterado
- `Login` e `Register` migrados para primitives do UI kit do storefront: `Input`, `Select`, `Button`, `buttonVariants` e `surfaceClasses`.
- `LoadingButton` passou a reutilizar `buttonVariants`, preservando `isLoading`, `loadingText` e compatibilidade com Checkout/Login/Register.
- Link "Voltar à loja" do Cadastro deixou de sobrepor o card no mobile; fica estático em telas pequenas e fixo a partir de `sm`.

### Validado
- Frontend `npm run build`: OK.
- Browser interno em `http://127.0.0.1:5173`: Login e Cadastro renderizados em desktop/mobile sem erros de console; Cadastro mobile sem overflow e com 16px de respiro entre link e card.
- Cypress local `auth-ui-kit.cy.ts` contra `http://127.0.0.1:5173`: 4/4 OK.
- Docker staging: `storefront_staging` rebuildado/recriado; `api_staging` recriado pela composicao.
- API staging `/health`: OK.
- Cypress staging `auth-ui-kit.cy.ts` contra `http://127.0.0.1:4000`: 4/4 OK.
- Cypress staging real `staging-smoke.cy.ts` contra `4000/4001`: 1/1 OK.

## 1.24.94-alpha - 2026-06-05

### Adicionado
- Runbook `arquivos-projeto/md/02 - Contexto/RUNBOOK_WEB_PUSH.md` para homologacao externa de Web Push.
- O runbook cobre variaveis, preflight externo, ativacao no storefront, inspeção de subscription, prova real, filtros uteis, diagnostico e criterio de aceite.

### Alterado
- `Índice de Arquivos.md` passou a listar o runbook Web Push na area de contexto.

### Observacao
- A homologacao final continua ambiental: dominio HTTPS nao-local, VAPID final e subscription real registrada.

## 1.24.93-alpha - 2026-06-05

### Adicionado
- Script operacional `npm run inspect:web-push-subscriptions` em `sistema/` para listar subscriptions Web Push registradas no banco.
- O script aceita filtros por `--customer-id`, `--customer-email`, `--endpoint-contains`, `--tenant`, `--limit` e modo de gate `--require-ready`.

### Validado
- `node --check scripts/inspect-web-push-subscriptions.js`: OK.
- `npm run inspect:web-push-subscriptions` contra staging: OK, retornando `total=0 complete=0 incomplete=0` e o proximo passo operacional.
- `npm run inspect:web-push-subscriptions -- --require-ready` contra staging: falha esperada enquanto nao existir subscription real completa.

### Observacao
- A prova externa continua dependendo de VAPID real, origem HTTPS nao-local e subscription registrada; agora existe um comando separado para confirmar se o banco ja esta pronto antes do envio.

## 1.24.92-alpha - 2026-06-05

### Alterado
- `NotificationBell` passou a expor o controle "Avisos no navegador" para cliente logado.
- `useNotifications` passou a retornar estado de suporte/permissao Web Push, feedback de inscricao e `requestPushPermission()` com retorno booleano.
- Smoke visual principal passou a validar o caminho de ativacao/estado Web Push para cliente logado em tablet e desktop.

### Validado
- Frontend `npm run build`: OK.
- Docker staging: `storefront_staging` rebuildado/recriado com sucesso; `api_staging` tambem foi recriado pela composicao.
- Cypress staging visual responsivo: `mobile-visual-smoke.cy.ts` OK, 18/18, contra `http://127.0.0.1:4000`.
- Cypress staging real rotas secundarias: `staging-secondary-routes-real.cy.ts` OK, 4/4.
- API staging `/health`: OK.
- `npm run validate:staging-recipes` contra staging: OK.

### Observacao
- A prova Web Push externa ainda depende de VAPID real, origem HTTPS nao-local e subscription registrada; a UI agora oferece o ponto de entrada para essa subscription.

## 1.24.91-alpha - 2026-06-05

### Adicionado
- Script `validate:staging-recipes` no backend para validar o contrato editorial do staging.
- O validador confere 4 categorias, 5 receitas, `publishedAt`, categoria correta, `imageUrl` com arquivo local existente, contagem de ingredientes/passos/produtos e 2 receitas relacionadas por receita.

### Alterado
- Cypress real `staging-secondary-routes-real.cy.ts` passou a exigir imagem visível na listagem quando `imageUrl` existir.
- Cypress real passou a validar a seção "Receitas relacionadas" no detalhe quando a API retornar relações.

### Validado
- `node --check scripts/validate-staging-recipes.js`: OK.
- `node --check scripts/seed-staging-recipes.js`: OK.
- `npm run validate:staging-recipes` contra staging: OK.
- Cypress staging real rotas secundarias: `staging-secondary-routes-real.cy.ts` OK, 4/4.
- Backend `npm run build`: OK.
- Frontend `npm run build`: OK.

## 1.24.90-alpha - 2026-06-05

### Alterado
- Seed editorial de receitas passou a preencher `imageUrl` com banners locais servidos pelo storefront.
- Seed editorial passou a criar relações entre receitas, habilitando a seção "Receitas relacionadas" com dados reais.
- Cypress real de rotas secundárias passou a validar `og:image` com imagem real da receita quando existir, mantendo fallback `/og-image.png` apenas para receita sem imagem.

### Validado
- `node --check scripts/seed-staging-recipes.js`: OK.
- `npm run seed:staging-recipes` contra staging: OK.
- API staging `GET /recipes/:slug`: 5/5 receitas com `imageUrl`, 2 relações, ingredientes e produtos vinculados.
- Cypress staging real rotas secundarias: `staging-secondary-routes-real.cy.ts` OK, 4/4.
- Backend `npm run build`: OK.
- Frontend `npm run build`: OK.

## 1.24.89-alpha - 2026-06-05

### Adicionado
- Script operacional `npm run prove:web-push-delivery` em `sistema/` para disparar uma prova Web Push real contra subscriptions registradas no banco.
- O script aceita filtros por `--customer-id`, `--customer-email`, `--endpoint-contains`, `--limit`, `--title`, `--body`, `--icon` e `--url`.

### Validado
- `node --check scripts/prove-web-push-delivery.js`: OK.
- `node --check scripts/validate-web-push-readiness.js`: OK.
- `npm run validate:web-push-readiness -- --external` com VAPID temporario e origem HTTPS nao-local: OK.
- `npm run prove:web-push-delivery` contra staging com VAPID temporario e `DATABASE_URL` de staging: falhou corretamente por nao existir push subscription real registrada.

### Observacao
- A entrega externa ainda depende de abrir a loja em HTTPS, instalar/abrir o PWA, aceitar notificacoes e registrar uma subscription real antes de executar `npm run prove:web-push-delivery`.

## 1.24.88-alpha - 2026-06-05

### Adicionado
- Script idempotente `seed:staging-recipes` no backend para popular o staging com acervo editorial real de receitas.
- Staging de receitas ampliado para 4 categorias publicadas: `jantar-pratico`, `churrasco-completo`, `lanches-e-praticos` e `adega-e-harmonizacao`.
- Staging de receitas ampliado para 5 receitas publicadas: `picadinho-de-acem-da-casa`, `churrasco-de-familia-antenor`, `noite-de-pizza-crocante`, `lanche-quente-da-padaria` e `tabua-de-vinhos-e-snacks`.

### Alterado
- `staging-secondary-routes-real.cy.ts` passou a validar o total dinamico de produtos adicionados ao carrinho em detalhe de receita, em vez de assumir 1 item fixo.

### Validado
- Seed staging de receitas executado duas vezes com sucesso para provar idempotencia.
- API staging `GET /recipes?active=true&limit=100`: OK, retornando 5 receitas e 4 categorias.
- API staging `GET /recipes/:slug`: OK para as 5 receitas, com ingredientes, passos e produtos vinculados.
- Backend `npm run build`: OK.
- Docker staging: `api_staging` rebuildado/recriado com sucesso.
- Cypress staging real rotas secundarias: `staging-secondary-routes-real.cy.ts` OK, 4/4, contra `4000/4001`.

## 1.24.87-alpha - 2026-06-05

### Alterado
- `Home` migrada para os primitives do UI kit do storefront: `Button`, `buttonVariants`, `Badge` e `surfaceClasses`.
- Header mobile/desktop, seletor de endereco, dots do hero, CTAs do hero, banners promocionais e destaque comercial passaram a usar os primitives.
- Com esta fatia, o UI kit do storefront cobre receitas, Mercado, detalhe de produto, carrinho, checkout, Adega e Home.

### Validado
- Frontend `npm run build`: OK.
- Varredura em `Home.tsx`: sem `<button`/`<input` nativos e sem classes legadas `btn-burgundy`/`btn-outline-burgundy`/`btn-gold`.
- Docker staging: `storefront_staging` rebuildado/recriado com sucesso.
- Cypress staging visual responsivo: `mobile-visual-smoke.cy.ts` OK, 16/16, contra `http://127.0.0.1:4000`.
- Cypress staging real produto/carrinho/checkout: `staging-smoke.cy.ts` OK, 1/1, contra `4000/4001`.
- Cypress staging real rotas secundarias: `staging-secondary-routes-real.cy.ts` OK, 4/4, contra `4000/4001`.
- Cypress staging visual de rotas secundarias: `secondary-routes-visual.cy.ts` OK, 16/16, contra `http://127.0.0.1:4000`.
- Browser interno em `http://127.0.0.1:4000/`: H1 presente, links de carrinho/Mercado renderizados, sem overflow horizontal e sem erros de console.

## 1.24.86-alpha - 2026-06-05

### Adicionado
- Primitive `Radio` no UI kit do storefront.

### Alterado
- `Checkout` migrado para `Button`, `Input`, `Radio` e `surfaceClasses`, cobrindo dados de convidado, CEP/endereco, pagamento, troco, recado e CTAs de navegacao.
- `WinePage`/Adega migrada para `Button`, `Badge` e `surfaceClasses` nos cards, badges e acoes de carrinho.
- Selecao de janela de entrega no checkout passou a ignorar slots prestes a expirar, reduzindo quote invalido por cutoff durante o fluxo.
- Smoke real de staging passou a criar janela de entrega com folga operacional, em vez de aceitar slot quase vencido.

### Validado
- Frontend `npm run build`: OK.
- Varredura em `Checkout.tsx` e `WinePage.tsx`: sem `<button`/`<input` nativos e sem classes legadas `btn-burgundy`/`btn-outline-burgundy`/`btn-gold`.
- Docker staging: `storefront_staging` rebuildado/recriado com sucesso.
- Cypress staging real produto/carrinho/checkout: `staging-smoke.cy.ts` OK, 1/1, contra `4000/4001`.
- Cypress staging real rotas secundarias: `staging-secondary-routes-real.cy.ts` OK, 4/4, contra `4000/4001`.
- Cypress staging visual responsivo: `mobile-visual-smoke.cy.ts` OK, 16/16, contra `http://127.0.0.1:4000`.
- Cypress staging visual de rotas secundarias: `secondary-routes-visual.cy.ts` OK, 16/16, contra `http://127.0.0.1:4000`.

## 1.24.85-alpha - 2026-06-05

### Adicionado
- Primitives `Input` e `Checkbox` no UI kit do storefront.

### Alterado
- `StoreProductCard` migrado para `Button`, `Badge` e `surfaceClasses`, cobrindo cards do Mercado, vitrines e recomendações.
- `Cart` migrado para UI kit em superfícies de item/resumo, ações de quantidade/remover/limpar, cupom, checkbox de substituição e CTAs fixos.
- `ProductDetail` migrado para UI kit em navegação, superfícies, thumbnails, badge de detalhe e links de ação.

### Validado
- Frontend `npm run build`: OK.
- Varredura em `StoreProductCard.tsx`, `Cart.tsx` e `ProductDetail.tsx`: sem `<button` nativo e sem classes legadas `btn-burgundy`/`btn-outline-burgundy`/`btn-gold`.
- Docker staging: `storefront_staging` rebuildado/recriado com sucesso.
- Cypress staging visual responsivo: `mobile-visual-smoke.cy.ts` OK, 16/16, contra `http://127.0.0.1:4000`.
- Cypress staging real produto/carrinho/checkout: `staging-smoke.cy.ts` OK, 1/1, contra `4000/4001`.
- Cypress staging real rotas secundarias: `staging-secondary-routes-real.cy.ts` OK, 4/4, contra `4000/4001`.

## 1.24.84-alpha - 2026-06-05

### Adicionado
- Primeira fatia de UI kit no storefront em `sistema/frontend/src/components/ui/`.
- Primitives `Button`, `Badge`, `surfaceClasses` e utilitario `cn`, usando `clsx` + `tailwind-merge` ja presentes no projeto.

### Alterado
- `RecipeList` passou a usar `Button`, `Badge`, `surfaceClasses` e `buttonVariants` para filtros, cards, skeletons e links de acao.
- `RecipeDetail` passou a usar o UI kit em categoria, botoes de adicionar produto, botao de adicionar todos, carrinho, painel lateral e acoes mobile.
- Removidos botoes nativos/classes antigas de botao nas paginas de receitas.

### Validado
- Frontend `npm run build`: OK.
- Varredura em `RecipeList.tsx` e `RecipeDetail.tsx`: sem `<button` nativo e sem `btn-burgundy`/`btn-outline-burgundy`/`btn-gold`.
- Docker staging: `storefront_staging` rebuildado/recriado com sucesso.
- Cypress staging real: `staging-secondary-routes-real.cy.ts` OK, 4/4, contra storefront `http://127.0.0.1:4000` e API `http://127.0.0.1:4001`.

## 1.24.83-alpha - 2026-06-05

### Adicionado
- Receita real ativa no staging: `picadinho-de-acem-da-casa`, com categoria `jantar-pratico`, ingredientes, passos e produto real vinculado (`Acém em Cubos (kg)`).
- Cobertura real de detalhe de receita em `sistema/frontend/cypress/e2e/staging-secondary-routes-real.cy.ts`.

### Corrigido
- DTOs de receitas e categorias agora usam `class-validator`/`class-transformer`, permitindo criar/editar categorias e receitas pela API admin com `ValidationPipe` em modo `whitelist` + `forbidNonWhitelisted`.
- DTOs de update passaram a usar `PartialType`, preservando os metadados de validação do create.

### Validado
- API staging: `GET /recipes?active=true&limit=100` retornou 1 receita ativa.
- API staging: `GET /recipes/picadinho-de-acem-da-casa` retornou ingredientes, modo de preparo e produto vinculado.
- Smoke administrativo real: login admin, criação de categoria temporária, criação de receita temporária com produto real, leitura pública e limpeza dos temporários OK.
- Backend `npm run build`: OK.
- Docker staging: `api_staging` rebuildado/recriado com sucesso.
- Cypress staging real: `staging-secondary-routes-real.cy.ts` OK, 4/4, contra storefront `http://127.0.0.1:4000` e API `http://127.0.0.1:4001`.
- Frontend `npm run build`: OK.

## 1.24.82-alpha - 2026-06-05

### Adicionado
- Cypress real de staging para rotas secundarias em `sistema/frontend/cypress/e2e/staging-secondary-routes-real.cy.ts`.
- Cobertura sem mocks para `/promocoes`, `/adega` e `/receitas`, usando API real `4001`.

### Validado
- Cypress staging real: `staging-secondary-routes-real.cy.ts` OK, 3/3, contra storefront `http://127.0.0.1:4000` e API `http://127.0.0.1:4001`.
- Frontend `npm run build`: OK.
- API staging atual: `/products?limit=100` retornou 29 produtos; `/products?limit=100&category=Adega` retornou 5 produtos; `/recipes?active=true&limit=100` retornou 0 receitas.
- A rota `/receitas` foi validada com empty state real, canonical e meta description dinamica.
- A rota `/promocoes` foi validada com dados reais e empty state honesto quando nao houver promocao ativa.
- A rota `/adega` foi validada com produto real de staging.

### Observado
- Staging ainda nao tem receitas publicadas. A validacao real de detalhe de receita deve ficar condicionada a publicar ou seedar ao menos uma receita ativa com ingredientes/produtos vinculados no ambiente `4001`.

## 1.24.81-alpha - 2026-06-05

### Adicionado
- Manifesto PWA em `sistema/frontend/public/manifest.webmanifest`, linkado no `index.html`, com modo `standalone`, tema Antenor e icones 192/512.
- Preflight operacional `npm run validate:web-push-readiness` em `sistema/`, com modo `--external` para validar VAPID, origem HTTPS, chave do build do storefront, manifesto, service worker e cache do Nginx.

### Alterado
- Nginx local/staging agora serve `service-worker.js` e `manifest.webmanifest` com `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`.
- `manifest.webmanifest` agora sai com `Content-Type: application/manifest+json` em local e staging.

### Validado
- Preflight externo com chaves VAPID temporarias geradas via `web-push`: `npm run validate:web-push-readiness -- --external` OK.
- Backend focused tests: `push-notification.service.spec.ts` e `notifications.service.spec.ts` OK, 5/5.
- Frontend `npm run build`: OK.
- Docker local/staging: `storefront` e `storefront_staging` rebuildados/recriados.
- Runtime local/staging: `/manifest.webmanifest` e `/service-worker.js` responderam 200 em `3000` e `4000`, com cache no-store e MIME correto para o manifesto.

### Observado
- A entrega real em dispositivo ainda depende de aplicar chaves VAPID finais, publicar a loja em origem HTTPS nao-local, instalar o PWA no navegador/dispositivo e disparar uma notificacao real para uma subscription desse ambiente.

## 1.24.80-alpha - 2026-06-05

### Adicionado
- Cypress visual responsivo para rotas secundarias em `sistema/frontend/cypress/e2e/secondary-routes-visual.cy.ts`.
- Cobertura de `/promocoes`, `/adega`, `/receitas` e detalhe de receita em quatro viewports: 375x667, 414x896, 768x1024 e 1280x900.

### Alterado
- `SEO` do storefront agora aceita `image: null` e usa fallback seguro em `/og-image.png`, evitando quebra em receitas ou conteudos editoriais sem imagem.

### Validado
- Cypress local com mocks: `secondary-routes-visual.cy.ts` OK, 16/16, contra `http://127.0.0.1:3000`.
- Cypress staging com mocks visuais: `secondary-routes-visual.cy.ts` OK, 16/16, contra `http://127.0.0.1:4000`.
- Cypress staging visual primario: `mobile-visual-smoke.cy.ts` OK, 16/16, contra `http://127.0.0.1:4000`.
- Cypress staging real: `staging-smoke.cy.ts` OK, 1/1, contra storefront `http://127.0.0.1:4000` e API `http://127.0.0.1:4001`.
- Frontend `npm run build`: OK.
- Docker storefront local/staging rebuildado e recriado apos o fallback de SEO.

## 1.24.79-alpha - 2026-06-05

### Alterado
- `mobile-visual-smoke.cy.ts` foi ampliado para uma matriz responsiva completa: mobile, tablet e desktop.
- A spec agora cobre viewports 375x667, 414x896, 768x1024 e 1280x900.
- Foram adicionadas validações tablet/desktop para header desktop, ausência de bottom nav mobile, Mercado sem CTA mobile em `md+`, detalhe de produto em grid responsivo e carrinho/checkout com comportamento distinto entre tablet e desktop.

### Validado
- Cypress local com mocks: `mobile-visual-smoke.cy.ts` OK, 16/16, contra `http://127.0.0.1:3000`.
- Cypress staging com mocks visuais: `mobile-visual-smoke.cy.ts` OK, 16/16, contra `http://127.0.0.1:4000`.
- Frontend `npm run build`: OK.

## 1.24.78-alpha - 2026-06-05

### Adicionado
- Cypress mobile visual smoke em `sistema/frontend/cypress/e2e/mobile-visual-smoke.cy.ts`.
- Cobertura responsiva para Home, Mercado, detalhe de produto, Carrinho e Checkout em dois viewports mobile: 375x667 e 414x896.
- Assertions de ausencia de overflow horizontal e de CTAs fixos dentro da viewport para bottom nav, CTA de carrinho, CTA de fechar pedido e barra de acao do checkout.

### Validado
- Cypress local com mocks: `mobile-visual-smoke.cy.ts` OK, 8/8, contra `http://127.0.0.1:3000`.
- Cypress staging com mocks visuais: `mobile-visual-smoke.cy.ts` OK, 8/8, contra `http://127.0.0.1:4000`.
- Cypress staging real: `staging-smoke.cy.ts` OK, 1/1, contra storefront `http://127.0.0.1:4000` e API `http://127.0.0.1:4001`.
- Frontend `npm run build`: OK.

### Observado
- Docker Desktop ficou indisponivel no inicio da rodada em 05/06/2026 (`dockerDesktopLinuxEngine` ausente), mas voltou durante a validacao; staging real foi rerodado e passou.
- `localhost:3000` recusou conexao via resolucao local no dev server, mas `127.0.0.1:3000` respondeu corretamente.

## 1.24.77-alpha - 2026-06-02

### Alterado
- Web Push deixou de ser apenas base tecnica e passou a ter envio real via pacote `web-push` no backend quando `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` estiverem configuradas.
- `PushNotificationService` agora configura VAPID, envia payload para subscriptions ativas, remove subscriptions expiradas em 404/410 e retorna contagem de `sent`, `failed` e `skipped`.
- `NotificationsService.create` dispara push para notificacoes com `customerId`, mantendo a notificacao in-app como registro principal.
- `POST /notifications/push-subscribe` passou a aceitar tanto o formato interno quanto o `PushSubscriptionJSON` real do navegador (`keys.auth`/`keys.p256dh`).
- Storefront passou a converter corretamente a chave publica VAPID base64url antes de chamar `pushManager.subscribe`.
- `service-worker.js` passou a usar `title`, `body`, `icon` e `url` do payload e abrir a URL da notificacao no clique.
- Docker Compose local/staging e Dockerfile do storefront receberam variaveis VAPID para backend e build do frontend.

### Validado
- Backend focused tests: `push-notification.service.spec.ts` e `notifications.service.spec.ts` OK, 5/5.
- Backend `npm run build`: OK.
- Frontend `npm run build`: OK.
- `docker compose config --quiet`: OK.
- `docker compose -f docker-compose.staging.yml config --quiet`: OK.
- Docker local: `api` e `storefront` rebuildados/recriados; `/health` e home responderam 200.
- Docker staging: `api_staging` e `storefront_staging` rebuildados/recriados; `/health` e home responderam 200.

### Observado
- A entrega externa em navegador/PWA ainda depende de chaves VAPID reais e origem segura no ambiente final. Sem as chaves, o backend ignora o envio push com log operacional e o frontend nao registra subscription Web Push.

## 1.24.76-alpha - 2026-06-02

### Alterado
- Checkout do storefront passou a carregar janelas publicas em `/delivery/slots?type=DELIVERY` e enviar um `slotId` real no quote/confirm, em vez de sempre enviar o fallback `ASAP`.
- Adicionado `deliveryAPI.slots` e tipo `FulfillmentSlot` no frontend.
- Adicionado smoke real de staging em `sistema/frontend/cypress/e2e/staging-smoke.cy.ts`, cobrindo produto, mercado, carrinho e checkout como convidado com PIX.

### Validado
- Frontend `npm run build`: OK.
- Staging storefront rebuildado e recriado com `docker compose -f docker-compose.staging.yml build storefront_staging` + `up -d --force-recreate storefront_staging`.
- Cypress staging real: `staging-smoke.cy.ts` OK, 1/1, contra `localhost:4000` e API `localhost:4001`.
- Cypress checkout mockado: `checkout.cy.ts` OK, 5/5.

### Observado
- O smoke real revelou que o checkout ficava preso na etapa de entrega quando a API tinha zona valida, mas nao havia `FulfillmentSlot` compativel com o `slotId` enviado pelo frontend.
- O spec prepara dados QA idempotentes no staging local: zona CEP `QA Staging Smoke CEP` e uma janela `DELIVERY` ativa quando nao houver slot utilizavel.

## 1.24.75-alpha - 2026-06-02

### Validado
- M33 Inteligencia revalidado em stack local online: `GET /analytics/report-executive?week=2026-05-25&format=json` respondeu 200 com receita 665.15, 35 pedidos e 5 categorias.
- Download CSV do relatorio executivo respondeu HTTP 200 com 847 bytes.
- Endpoints de comparativo/insights responderam em runtime local e regras de alerta retornaram 1 regra cadastrada.
- M39 foi reconciliado como concluido: atalhos operacionais, selecao em lote, acoes massivas, edicao inline e painel lateral ja estavam implementados e cobertos por `catalog.cy.ts`.

### Documentado
- `Pendencias`, `Proximas Acoes`, `ROADMAP`, `STATUS`, `Status Atual` e `Onde Parei` foram atualizados para remover M39 da fila aberta e apontar a proxima frente real: smoke ampliado do storefront/staging e Web Push real com VAPID/provider.

## 1.24.74-alpha - 2026-06-02

### Validado
- Docker Desktop reativado e stack local/staging voltou a responder.
- `docker compose build api admin` OK.
- `docker compose up -d --force-recreate api admin` OK.
- Prisma local: `npx prisma migrate deploy` OK, sem migrations pendentes.
- Prisma staging: `npx prisma migrate status` OK, schema em dia.
- Seed QA local: `npm run seed:qa` OK, criando/atualizando `qa.admin@antenor.com.br`, `qa.cliente@antenor.com.br`, `QA-M20-0001` e `QA-M20-0002`.
- Cypress critico real: `critical-flows.cy.ts` OK, 3/3 contra API real em `localhost:3001`.
- Cypress admin completo: 25 specs, 88/88 testes OK em `localhost:3002`, incluindo specs mockados e `critical-flows.cy.ts`.
- Staging API: `GET http://localhost:4001/products?limit=5` OK, 29 produtos totais.
- Staging admin: `POST http://localhost:4001/auth/login` OK com `admin@antenor.com.br` / `admin2026`.
- Staging storefront: `/mercado` em `localhost:4000` renderiza produto real vindo de `/api/products`.

### Observado
- A senha correta documentada e validada e `admin2026` em minusculo. `Admin2026` falha porque o login e case-sensitive.
- `/health/detail` local fica `down` por Solidcom externo indisponivel, mas banco, Redis, Meili, fila e storage responderam OK; os fluxos criticos Solidcom cobertos por contrato interno passaram.

## 1.24.73-alpha - 2026-06-02

### Alterado
- Auditoria final do UI kit no admin concluida.
- `QueryClient` passou a ser criado por montagem do `App`, evitando cache de React Query entre specs Cypress no mesmo navegador.
- `getSystemHealth` recebeu cache-busting por timestamp.
- Cypress recebeu fallback global de API somente para specs mockados, preservando `critical-flows.cy.ts` para API real.
- Specs `business-accounts`, `store-banners`, `delivery-zones`, `system-health`, `categories` e `ui-kit` foram endurecidos contra rotas com/sem `/api`, estado herdado e requests penduradas.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress admin mock completo sem `critical-flows.cy.ts`: 24 specs, 85/85 testes OK.
- Varredura global do admin: nenhum `button/input/select/textarea` nativo direto fora de `sistema/admin/src/components/ui/*`.
- Varredura global do admin: nenhum `alert()`, `prompt()`, `confirm()`, `window.alert`, `window.prompt` ou `window.confirm` em `sistema/admin/src`.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.72-alpha - 2026-06-02

### Alterado
- Picking finalizado na fatia de pop-ups nativos residuais.
- `PickingSection` deixou de usar `prompt()` em atribuir separador, enviar para conferencia, registrar conferencia e finalizar embalagem.
- Acoes de tarefa agora usam dialog controlado com `Input` e `Button` do ui-kit.
- Feedback de erro da separacao recebeu `role="alert"`.
- Cypress Picking endurecido para rotas com ou sem prefixo `/api`.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Picking: `npx cypress run --spec cypress/e2e/picking.cy.ts --config baseUrl=http://localhost:3002` OK, 3/3.
- Varredura global do admin: nenhum `alert()`, `prompt()`, `confirm()`, `window.alert`, `window.prompt` ou `window.confirm` em `sistema/admin/src`.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.71-alpha - 2026-06-02

### Alterado
- Pedidos finalizado na fatia de alertas residuais.
- `Dashboard.tsx` deixou de usar `alert()` nos fluxos de atualizar status e atualizar dados do pedido.
- `OrdersSection` passou a receber `orderFeedback` e renderizar erro controlado com `role="alert"` na lista ou dentro do modal de detalhes.
- Cancelamento de pedido deixou de usar `prompt()` e agora usa campo de motivo controlado dentro do modal.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Pedidos: `npx cypress run --spec cypress/e2e/orders.cy.ts --config baseUrl=http://localhost:3002` OK, 5/5.
- Varredura global do admin: sem `alert()` no codigo real; pop-ups nativos restantes concentrados em quatro `prompt()` de `PickingSection.tsx`.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.70-alpha - 2026-06-02

### Alterado
- Catalogo de Produtos finalizado na fatia de alertas residuais.
- `Dashboard.tsx` deixou de usar `alert()` nos fluxos de salvar, remover, atualizar em lote, excluir em lote, editar campo inline, sincronizar Solidcom e gerar taxonomia de produtos.
- `ProductsSection` passou a renderizar feedback controlado com `role="alert"` para erros/sucessos do catalogo.
- Validacoes inline de preco, preco promocional e estoque agora exibem erro na UI, sem `window.alert`.
- Falhas em acoes confirmadas permanecem no modal e mostram erro inline no dialogo.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Catalogo: `npx cypress run --spec cypress/e2e/catalog.cy.ts --config baseUrl=http://localhost:3002` OK, 8/8.
- Varredura da fatia: sem `alert()`, `window.alert`, `window.confirm` ou `confirm()` em `ProductsSection.tsx` e `catalog.cy.ts`; em `Dashboard.tsx` restam apenas dois `alert()` de pedidos.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.69-alpha - 2026-06-02

### Alterado
- `CategoriesManager` finalizado na fatia de alertas residuais.
- Erros de exclusao de categoria e reordenacao por drag-and-drop deixam de usar `alert()`.
- Feedback de erro agora aparece como alerta controlado na UI com `role="alert"` e acao de dispensar.
- Modal de exclusao recebeu `role="dialog"`, `aria-modal` e erro inline quando a exclusao falha.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Categorias: `npx cypress run --spec cypress/e2e/categories.cy.ts --config baseUrl=http://localhost:3002` OK, 6/6.
- Varredura da fatia: sem `alert()`, `window.alert`, `window.confirm` ou `confirm()` em `CategoriesManager.tsx` e `categories.cy.ts`.
- Varredura global do admin: alertas restantes agora concentrados em `Dashboard.tsx` e `ProductsSection.tsx`.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.68-alpha - 2026-06-02

### Alterado
- `CategoriesManager` finalizado na fatia de inputs especiais do UI kit.
- Upload escondido de banner de categoria agora usa `Input type="file"` do ui-kit.
- Fluxo preserva `accept`, `handleBannerUpload`, `uploadsAPI.upload`, atualizacao de `bannerUrl` via CMS e estado `uploading`.
- Acessibilidade do upload reforcada com `aria-label` por categoria.
- Cypress `categories.cy.ts` endurecido para URLs com ou sem `/api`.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Categorias: `npx cypress run --spec cypress/e2e/categories.cy.ts --config baseUrl=http://localhost:3002` OK, 5/5.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `CategoriesManager.tsx` e `categories.cy.ts`.
- Varredura global do admin: sem controles nativos diretos fora dos componentes `ui/*`.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.67-alpha - 2026-06-02

### Alterado
- `ProductSlideOver` finalizado na fatia de inputs especiais do UI kit.
- Uploads escondidos de Foto 1 e Foto 2 agora usam `Input type="file"` do ui-kit.
- Fluxo preserva `accept`, `disabled`, reset do campo, `productsAPI.uploadImage`, slots `1`/`2`, estados `uploading`/`uploading2` e mensagens de erro.
- Acessibilidade dos uploads reforcada com `aria-label`.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Catalogo: `npx cypress run --spec cypress/e2e/catalog.cy.ts --config baseUrl=http://localhost:3002` OK, 6/6.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `ProductSlideOver.tsx` e `catalog.cy.ts`.
- Varredura global do admin: resta apenas o upload nativo de banner em `CategoriesManager` fora dos componentes `ui/*`.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.66-alpha - 2026-06-02

### Alterado
- `PaymentEventsSection` finalizado na fatia de abas do UI kit.
- Abas `Transacoes` e `Webhooks` agora usam `Button` do ui-kit com `variant="ghost"`.
- Estado ativo das abas preserva o visual anterior e agora expõe `aria-pressed` para acessibilidade e testes.

### Adicionado
- Cypress dedicado `payment-events.cy.ts` cobrindo painel de pagamentos, saude da integracao, transacoes, expansao de eventos/reembolsos, filtro por status e troca para webhooks.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Pagamentos: `npx cypress run --spec cypress/e2e/payment-events.cy.ts --config baseUrl=http://localhost:3002` OK, 2/2.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `PaymentEventsSection.tsx` e `payment-events.cy.ts`.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.65-alpha - 2026-06-02

### Alterado
- `StoreBannersManager` finalizado na fatia de inputs especiais do UI kit.
- Uploads escondidos de imagem desktop e mobile agora usam `Input type="file"` do ui-kit.
- Fluxo preserva refs, `accept`, reset do campo, `handleUpload`, estados `uploadingDesktop`/`uploadingMobile` e validacoes existentes.
- Acessibilidade dos uploads reforcada com `aria-label`.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Banners da Loja: `npx cypress run --spec cypress/e2e/store-banners.cy.ts --config baseUrl=http://localhost:3002` OK, 3/3.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `StoreBannersManager.tsx` e `store-banners.cy.ts`.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.64-alpha - 2026-06-02

### Adicionado
- `PaymentEventsSection` criado no admin: painel dedicado para transacoes, webhooks e eventos do gateway de pagamento.
- Aba "Transacoes" com tabela expandivel mostrando eventos por transacao e reembolsos associados.
- Aba "Webhooks" com timeline de eventos recebidos do provider de pagamento.
- Widget de saude da integracao de pagamentos com checklist de configuracao (provider, URL, webhook, PIX).
- Metricas resumidas: pagos, pendentes, falhos, reembolsados.
- Navegacao "Pagamentos" na sidebar do admin (secao "Ferramentas").
- Status de pagamento exibido na tela de confirmacao do checkout do storefront (Pago, Autorizado, Pendente, Falhou, Aguardando pagamento).

### Alterado
- `Dashboard.tsx` com nova secao `payments`, import lazy e rota para `PaymentEventsSection`.
- `Checkout.tsx` com indicador visual de `paymentStatus` apos o badge de forma de pagamento.

### Validado
- Admin: `tsc --noEmit` OK.
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK (chunk `PaymentEventsSection-CWJ-vJ7L.js` gerado).
- Frontend: `tsc --noEmit` OK.
- Frontend: `npm run lint` OK.
- Frontend: `npm run build` OK.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando.

## 1.24.63-alpha - 2026-06-02

### Alterado
- `BrandIdentity` finalizado na fatia de inputs especiais do UI kit.
- Upload escondido de logo agora usa `Input type="file"` do ui-kit, mantendo `ref`, `accept`, reset do campo e fluxo `uploadsAPI.upload`.
- Color pickers de cor primaria/secundaria agora usam `Input type="color"` do ui-kit, preservando os campos hex textuais e preview.
- Acessibilidade dos controles especiais reforcada com `aria-label`.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Identidade Visual: `npx cypress run --spec cypress/e2e/brand-identity.cy.ts --config baseUrl=http://localhost:3002` OK, 2/2.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `BrandIdentity.tsx` e `brand-identity.cy.ts`.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.62-alpha - 2026-06-02

### Alterado
- `PromoBannersManager` finalizado na fatia de inputs especiais do UI kit.
- Inputs escondidos de upload em cards e modal de banner promocional agora usam `Input type="file"` do ui-kit.
- Upload preserva validacao de tipo/tamanho, `uploadsAPI.upload`, atualizacao de CMS, handlers existentes e mensagens de feedback.
- Acessibilidade dos uploads de banner promocional reforcada com `aria-label` nos inputs escondidos.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Layout: `npx cypress run --spec cypress/e2e/layout.cy.ts --config baseUrl=http://localhost:3002` OK, 8/8.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `PromoBannersManager.tsx` e `layout.cy.ts`.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.61-alpha - 2026-06-02

### Alterado
- `LayoutManager.tsx` finalizado na fatia de inputs especiais do UI kit.
- Inputs escondidos de upload de imagem de categoria e slide agora usam `Input type="file"` do ui-kit, mantendo `accept`, `aria-label` e handlers de upload.
- Cypress `layout.cy.ts` endurecido para URLs com ou sem `/api`, e o `beforeEach` agora aguarda dados CMS antes da assercao visual da secao.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Layout: `npx cypress run --spec cypress/e2e/layout.cy.ts --config baseUrl=http://localhost:3002` OK, 8/8.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `LayoutManager.tsx` e `layout.cy.ts`.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.60-alpha - 2026-06-02

### Alterado
- Wrappers legados `AccessibleInput`, `AccessibleSelect` e `AccessibleButton` em `FormElements.tsx` migrados para shadcn/ui.
- `AccessibleInput` agora usa `Input` + `Label`, mantendo `label`, `error`, `helperText`, `required`, `aria-label` e `aria-describedby`.
- `AccessibleSelect` agora usa `Select` + `Label`, mantendo lista `options`, erro acessivel e props nativas do select.
- `AccessibleButton` agora usa `Button` e `Loader2`, preservando `variant`, `size`, `isLoading`, `icon`, `children` e `disabled`.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `FormElements.tsx`.
- Nao havia uso ativo de `AccessibleInput`, `AccessibleSelect` ou `AccessibleButton` em `src/` ou `cypress/`; por isso a fatia foi validada por tipo/build/lint/varredura.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.59-alpha - 2026-06-02

### Alterado
- Tela `Login.tsx` migrada para shadcn/ui.
- Campos de email/senha agora usam `Input` com `Label` associado por `htmlFor`.
- Botao de envio agora usa `Button`, preservando loading com `Loader2`, autenticacao e mensagens de erro.
- Cypress `smoke.cy.ts` passou a mockar `POST /auth/login` no teste de sucesso, validando payload e mantendo a spec independente da API local.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Smoke: `npx cypress run --spec cypress/e2e/smoke.cy.ts --config baseUrl=http://localhost:3002` OK, 3/3.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `Login.tsx` e `smoke.cy.ts`.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.58-alpha - 2026-06-02

### Alterado
- `ErrorBoundary` migrado para shadcn/ui na acao de recuperacao.
- Botao nativo de recarregar pagina agora usa `Button`, preservando `window.location.reload()`.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `ErrorBoundary.tsx`.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.57-alpha - 2026-06-02

### Alterado
- Shell principal `Dashboard.tsx` migrado para shadcn/ui na fatia de navegacao.
- Botoes nativos da sidebar principal, ferramentas, logout e menu mobile agora usam `Button`.
- Navegacao preserva `aria-current`, `aria-label`, fechamento da sidebar mobile e fluxo de logout.
- Cypress `admin/cypress/e2e/dashboard.cy.ts` ampliado para validar navegacao por shell, sidebar mobile e limpeza de sessao no logout.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Dashboard: `npx cypress run --spec cypress/e2e/dashboard.cy.ts --config baseUrl=http://localhost:3002` OK, 7/7.
- Varredura da fatia: sem `button` nativo nem `confirm/prompt` em `Dashboard.tsx` e `dashboard.cy.ts`.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.56-alpha - 2026-06-02

### Alterado
- `ProductsSection`, acoes de catalogo e barra flutuante de lote, finalizado nesta fatia do UI kit.
- Botoes nativos de metricas, chips, cards e acoes em lote agora usam `Button`.
- `window.confirm()` removido do fluxo de produtos: confirmacao individual, ativacao/inativacao em lote e exclusao em lote agora usam dialog controlado na UI.
- `Dashboard.tsx` deixou de executar confirmacoes nativas para produtos e passou a apenas acionar as chamadas de API apos a confirmacao visual.
- Cypress `admin/cypress/e2e/catalog.cy.ts` foi endurecido com mocks locais e ampliado para validar cancelamento/confirmacao controlada.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Catalogo: `npx cypress run --spec cypress/e2e/catalog.cy.ts --config baseUrl=http://localhost:3002` OK, 5/5.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `ProductsSection.tsx` e `catalog.cy.ts`; sem `window.confirm()` no fluxo `Dashboard.tsx` + `ProductsSection.tsx`.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.55-alpha - 2026-06-02

### Alterado
- `OrdersSection`, chips de filtros ativos, finalizado no UI kit.
- Botoes de limpar filtros de status, data, pagamento e troco agora usam `Button` icon-only com `aria-label` especifico.
- Cypress `admin/cypress/e2e/orders.cy.ts` ampliado para validar criacao e limpeza dos quatro chips.
- Mocks do Cypress de Pedidos foram endurecidos para URLs com ou sem `/api` e `/health/detail`, mantendo a spec independente da API local.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Pedidos: `npx cypress run --spec cypress/e2e/orders.cy.ts --config baseUrl=http://localhost:3002` OK, 2/2.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `OrdersSection.tsx` e `orders.cy.ts`.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.54-alpha - 2026-06-02

### Alterado
- `CustomersSection`, chips de filtros ativos, finalizado no UI kit.
- Botoes de limpar filtros de email, endereco, pedidos e cadastro agora usam `Button` icon-only com `aria-label` especifico.
- Cypress `admin/cypress/e2e/customers.cy.ts` ampliado para validar criacao e limpeza dos quatro chips.
- Mocks do Cypress de Clientes foram endurecidos para URLs com ou sem `/api` e `/health/detail`, mantendo a spec independente da API local.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Clientes: `npx cypress run --spec cypress/e2e/customers.cy.ts --config baseUrl=http://localhost:3002` OK, 2/2.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `CustomersSection.tsx` e `customers.cy.ts`.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.53-alpha - 2026-06-02

### Alterado
- `DashboardSection`, bloco `Performance de Vendas`, migrado para shadcn/ui.
- Select de periodo de vendas agora usa `Select` do UI kit, preservando `salesPeriod` e recarga de `/orders/analytics/sales`.
- Cobertura Cypress em `admin/cypress/e2e/dashboard.cy.ts` ajustada para validar a troca para `period=month`.
- Mocks do dashboard no Cypress foram endurecidos para cobrir URLs com ou sem `/api` e o widget `/health/detail`, evitando Network Error quando a API local esta desligada.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Dashboard: `npx cypress run --spec cypress/e2e/dashboard.cy.ts --config baseUrl=http://localhost:3002` OK, 5/5.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `DashboardSection.tsx` e `dashboard.cy.ts`.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.52-alpha - 2026-06-02

### Alterado
- `AlertRulesManager`, bloco `Regras de Alerta` dentro de Inteligencia, concluiu a remocao de `window.confirm()`.
- Exclusao de regra agora usa confirmacao controlada na propria UI, com `Button` do UI kit para cancelar ou confirmar.
- Ao iniciar nova regra, qualquer confirmacao de exclusao pendente e limpa para evitar estados concorrentes na tela.
- Cobertura Cypress criada em `admin/cypress/e2e/alert-rules.cy.ts`, validando cancelamento sem DELETE e exclusao apenas apos confirmacao controlada.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Regras de Alerta: `npx cypress run --spec cypress/e2e/alert-rules.cy.ts --config baseUrl=http://localhost:3002` OK, 2/2.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `AlertRulesManager.tsx` e `alert-rules.cy.ts`.
- Docker/admin completo segue bloqueado neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

## 1.24.51-alpha - 2026-06-02

### Alterado
- Cabecalho de `Intelligence`, area `Inteligencia (IA)`, migrado para shadcn/ui.
- Selects de periodo da saude da busca e quantidade de termos agora usam `Select`.
- Indicadores `Live Data` e `Atualizando busca...` agora usam `Badge`.
- Acao `Atualizar agora` agora usa `Button`, preservando refresh manual de `/analytics/admin/search-insights`.
- Cobertura Cypress ampliada em `admin/cypress/e2e/search-insights.cy.ts`, validando alteracao de periodo/top termos e refresh manual com `days`/`limit` corretos.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Saude da Busca: `npx cypress run --spec cypress/e2e/search-insights.cy.ts --config baseUrl=http://localhost:3002` OK, 4/4.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `Intelligence.tsx`, `IntelligenceSearchInsightsPanel.tsx` e `search-insights.cy.ts`.
- Docker/admin completo e seed QA seguem bloqueados neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.

## 1.24.50-alpha - 2026-06-02

### Alterado
- `IntelligenceSearchInsightsPanel`, bloco `Saude da Busca` dentro de Inteligencia, migrado para shadcn/ui.
- Presets operacional/balanceado/comercial, restauracao de padrao, expandir/recolher tudo e toggles por secao agora usam `Button`, preservando `aria-pressed`, estados disabled e persistencia via URL/cache da tela.
- Indicadores de modo, contagem de secoes recolhidas, estado de atualizacao e tier de Ads agora usam `Badge`.
- Cobertura Cypress criada em `admin/cypress/e2e/search-insights.cy.ts`, validando metricas, gaps, correcoes, ranking de Ads, conversoes, presets e expandir/recolher secoes.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Saude da Busca: `npx cypress run --spec cypress/e2e/search-insights.cy.ts --config baseUrl=http://localhost:3002` OK, 3/3.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `IntelligenceSearchInsightsPanel.tsx` e `search-insights.cy.ts`.
- Docker/admin completo e seed QA seguem bloqueados neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.

## 1.24.49-alpha - 2026-06-02

### Alterado
- `IntelligenceAutoInsightsPanel`, bloco `Insights Automaticos` dentro de Inteligencia, migrado para shadcn/ui.
- Controle Compacto/Detalhado e acao de atualizar insights agora usam `Button`, preservando `aria-pressed`, refresh manual e cache dos insights automaticos.
- Acao de refresh ganhou `aria-label` especifico para evitar ambiguidade com outros botoes Atualizar da tela.
- Corrigida exibicao duplicada de percentual no abandono de carrinho (`75%%` -> `75%`).
- Cobertura Cypress criada em `admin/cypress/e2e/auto-insights.cy.ts`, validando modo detalhado, modo compacto, ranking de produtos desejados e refresh de `/analytics/admin/insights`.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Insights Automaticos: `npx cypress run --spec cypress/e2e/auto-insights.cy.ts --config baseUrl=http://localhost:3002` OK, 3/3.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `IntelligenceAutoInsightsPanel.tsx` e `auto-insights.cy.ts`.
- Docker/admin completo e seed QA seguem bloqueados neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.

## 1.24.48-alpha - 2026-06-02

### Alterado
- `Integrations`, area `Integracoes`, migrado para shadcn/ui.
- Acao de mostrar/ocultar modulos, toggle de extensao, badges de status e refresh do status Solidcom agora usam componentes `ui/*` (`Button` e `Badge`).
- Cards de modulos deixaram de ser `button` nativo com botao aninhado e passaram para wrapper acessivel com `role="button"`, teclado Enter/Espaco e `aria-pressed`.
- Cobertura Cypress criada em `admin/cypress/e2e/integrations.cy.ts`, validando resumo de modulos, selecao de conector CRM, toggle de HubSpot e refresh do status Solidcom.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Integracoes: `npx cypress run --spec cypress/e2e/integrations.cy.ts --config baseUrl=http://localhost:3002` OK, 3/3.
- Varredura da fatia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `Integrations.tsx` e `integrations.cy.ts`.
- Docker/admin completo e seed QA seguem bloqueados neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.

## 1.24.47-alpha - 2026-06-02

### Alterado
- `ExecutiveReport`, bloco `Relatorio Executivo Semanal` dentro de Inteligencia, migrado para shadcn/ui.
- Campo de semana, acoes de gerar relatorio/CSV, tabelas de categorias e termos de busca, e indicador de busca sem resultado agora usam componentes `ui/*` (`Input`, `Label`, `Button`, `Table` e `Badge`).
- Titulo externo do bloco foi ajustado para remover emoji e manter a mesma linguagem visual operacional do admin.
- Cobertura Cypress criada em `admin/cypress/e2e/executive-report.cy.ts`, validando geracao de relatorio semanal, headers/query, resumo, tabelas, gaps, recomendacoes e download CSV.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Relatorio Executivo: `npx cypress run --spec cypress/e2e/executive-report.cy.ts --config baseUrl=http://localhost:3002` OK, 2/2.
- Docker/admin completo e seed QA seguem bloqueados neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.

## 1.24.46-alpha - 2026-06-02

### Alterado
- `SystemHealthWidget`, bloco `Status dos Serviços` no dashboard admin, migrado para shadcn/ui.
- Badge geral de saude e acao manual de atualizar agora usam componentes `ui/*` (`Badge` e `Button`), preservando polling automatico e contrato `/health/detail`.
- Cobertura Cypress criada em `admin/cypress/e2e/system-health.cy.ts`, validando status degradado, latencias por servico, refresh manual para status OK e erro de API.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Status dos Servicos: `npx cypress run --spec cypress/e2e/system-health.cy.ts --config baseUrl=http://localhost:3002` OK, 3/3.
- Docker/admin completo e seed QA seguem bloqueados neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.

## 1.24.45-alpha - 2026-06-01

### Alterado
- `FraudAudit`, area `Anti-fraude`, migrado para shadcn/ui.
- Acao de atualizar, filtros por vetor, badges de vetor/reincidencia e tabela de logs agora usam componentes `ui/*` (`Button`, `Badge` e `Table`).
- Cobertura Cypress criada em `admin/cypress/e2e/fraud-audit.cy.ts`, validando renderizacao de registros, reincidencia, filtro por dispositivo e empty state.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Anti-fraude: `npx cypress run --spec cypress/e2e/fraud-audit.cy.ts --config baseUrl=http://localhost:3002` OK, 3/3.
- Docker/admin completo e seed QA seguem bloqueados neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.

## 1.24.44-alpha - 2026-06-01

### Alterado
- `NotificationsBroadcast`, area `Notificacoes`, migrado para shadcn/ui.
- Select de tipo, campos de titulo/mensagem/customer ID, botao de envio e feedback de sucesso/erro agora usam componentes `ui/*` (`Button`, `Input`, `Label`, `Select` e `Textarea`).
- Feedback de erro ganhou estado visual proprio sem alterar o contrato de `notificationsAdminAPI.broadcast`.
- Cobertura Cypress criada em `admin/cypress/e2e/notifications-broadcast.cy.ts`, validando formulario, envio para cliente especifico, broadcast geral e erro da API.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Notificacoes: `npx cypress run --spec cypress/e2e/notifications-broadcast.cy.ts --config baseUrl=http://localhost:3002` OK, 4/4.
- Docker/admin completo e seed QA seguem bloqueados neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.

## 1.24.43-alpha - 2026-06-01

### Alterado
- `DeliveryZones`, area `Taxas de Entrega`, migrado para shadcn/ui.
- Botoes principais, regra global de frete gratis, formulario de zona, selects, checkbox ativo, badges, acoes de ativar/editar/remover e confirmacoes agora usam componentes `ui/*` (`Button`, `Input`, `Label`, `Select`, `Checkbox` e `Badge`).
- Criacao de janela de fulfillment deixou de usar `window.prompt()` e passou para modal controlado com tipo, inicio/fim, capacidade e cutoff.
- Confirmacao de remocao de zona deixou de usar `window.confirm()` e passou para modal controlado.
- Cobertura Cypress criada em `admin/cypress/e2e/delivery-zones.cy.ts`, validando resumo de janelas, frete gratis global, criacao de janela, criacao de zona CEP, toggle, edicao e exclusao.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Taxas de Entrega: `npx cypress run --spec cypress/e2e/delivery-zones.cy.ts --config baseUrl=http://localhost:3002` OK, 4/4.
- Docker/admin completo e seed QA seguem bloqueados neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.

## 1.24.42-alpha - 2026-06-01

### Alterado
- `Recipes`, area `Receitas`, migrado para shadcn/ui.
- Botao de nova receita, formulario, inputs, textarea, selects, checkbox ativo, tabela, badges de status, acoes de ativar/editar/excluir, paginacao e confirmacao de exclusao agora usam componentes `ui/*` (`Button`, `Input`, `Label`, `Select`, `Textarea`, `Checkbox`, `Badge` e `Table`).
- Confirmacao de exclusao deixou de usar `window.confirm()` e passou para modal controlado.
- Cobertura Cypress criada em `admin/cypress/e2e/recipes.cy.ts`, validando listagem, criacao com slug automatico, selects, toggle, edicao e exclusao pelo modal.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Receitas: `npx cypress run --spec cypress/e2e/recipes.cy.ts --config baseUrl=http://localhost:3002` OK, 3/3.
- Docker/admin completo e seed QA seguem bloqueados neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.

## 1.24.41-alpha - 2026-06-01

### Alterado
- `BusinessHours`, area `Horarios de Funcionamento`, migrado para shadcn/ui.
- Toggle de dia aberto, inputs de horario, acao de adicionar/remover janela, mensagens personalizadas, botao salvar e restauracao de padrao agora usam componentes `ui/*` (`Button`, `Input`, `Label` e `Checkbox`).
- Cobertura Cypress criada em `admin/cypress/e2e/business-hours.cy.ts`, validando renderizacao de dias/janelas/mensagens e salvamento do payload `businessHours` em `brandAPI.update`.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Horarios de Funcionamento: `npx cypress run --spec cypress/e2e/business-hours.cy.ts --config baseUrl=http://localhost:3002` OK, 2/2.
- Docker/admin completo e seed QA seguem bloqueados neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.

## 1.24.40-alpha - 2026-06-01

### Alterado
- `BrandIdentity`, area `Identidade Visual`, migrado para shadcn/ui.
- Campos de nome da loja, hex de cores, area clicavel de upload, remocao de logo e acao de salvar agora usam componentes `ui/*` (`Button`, `Input` e `Label`), preservando apenas `input[type=file]` escondido e `input[type=color]` como controles nativos adequados.
- Cobertura Cypress criada em `admin/cypress/e2e/brand-identity.cy.ts`, validando renderizacao de logos/cores/preview e salvamento de nome, cores e remocao de logo mobile.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Identidade Visual: `npx cypress run --spec cypress/e2e/brand-identity.cy.ts --config baseUrl=http://localhost:3002` OK, 2/2.
- Docker/admin completo e seed QA seguem bloqueados neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.

## 1.24.39-alpha - 2026-06-01

### Alterado
- `StoreBannersManager`, area `Banners da Loja`, migrado para shadcn/ui.
- Cabecalho, empty state, cards/lista, badges de tipo/mobile, modal de edicao, selects de tipo/pagina, toggle ativo, link target, upload visual, agendamento e confirmacao de exclusao agora usam componentes `ui/*` (`Button`, `Input`, `Label`, `Select`, `Checkbox` e `Badge`).
- Cobertura Cypress criada em `admin/cypress/e2e/store-banners.cy.ts`, com mocks isolados para renderizacao, toggle, edicao com selects/link target/agendamento e exclusao.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress Banners da Loja: `npx cypress run --spec cypress/e2e/store-banners.cy.ts --config baseUrl=http://localhost:3002` OK, 3/3.
- Docker/admin e seed QA ficaram bloqueados neste ambiente: Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel) e o banco local `localhost:5432` nao estava acessivel.
- Cypress admin completo foi tentado em Vite local, mas nao substitui a validacao Docker: specs antigas dependem de backend/API local ou mocks no formato do container; a nova spec `store-banners.cy.ts` passou isolada.

## 1.24.38-alpha - 2026-06-01

### Alterado
- `PromoBannersManager`, dentro de Layout do Site, migrado para shadcn/ui.
- Avisos, botao Novo Banner, badges de ordem/alinhamento, acoes de ativar/editar/reordenar/trocar imagem/excluir, modal de banner, busca/selecao de produto exaltado, select de alinhamento, visibilidade, upload visual e confirmacao de exclusao agora usam componentes `ui/*` (`Button`, `Input`, `Label`, `Select`, `Textarea`, `Badge`).
- Cobertura Cypress de `admin/cypress/e2e/layout.cy.ts` ampliada para validar banners promocionais, produto exaltado, edicao, alinhamento, toggle e exclusao.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Docker: `docker compose build admin` e `docker compose up -d --force-recreate admin` OK.
- Cypress Layout: `npx cypress run --spec cypress/e2e/layout.cy.ts --config baseUrl=http://localhost:3002` OK, 8/8.
- Cypress admin completo: `npx cypress run --config baseUrl=http://localhost:3002` OK, 36/36.
- Backend QA seed recomposto apos a suite: `npm run seed:qa` OK com `QA-M20-0001` e `QA-M20-0002`.

## 1.24.37-alpha - 2026-06-01

### Alterado
- Layout do Site no admin completou a migracao do `LayoutManager` para shadcn/ui.
- Tabela de categorias, toggle de status, campos de prioridade/limite, curadoria manual, modal de slide, controle de visibilidade, upload visual e confirmacao de exclusao agora usam componentes `ui/*` (`Button`, `Input`, `Label`, `Table`, `Textarea`, `Badge`).
- Componente compartilhado `Textarea` adicionado em `admin/src/components/ui/textarea.tsx`.
- Cobertura Cypress de `admin/cypress/e2e/layout.cy.ts` ampliada para validar prioridade, limite, curadoria manual e exclusao de slide.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Docker: `docker compose build admin` e `docker compose up -d --force-recreate admin` OK.
- Cypress Layout: `npx cypress run --spec cypress/e2e/layout.cy.ts --config baseUrl=http://localhost:3002` OK, 5/5.
- Cypress admin completo: `npx cypress run --config baseUrl=http://localhost:3002` OK, 33/33.
- Backend QA seed recomposto apos a suite: `npm run seed:qa` OK com `QA-M20-0001` e `QA-M20-0002`.

## 1.24.36-alpha - 2026-06-01

### Alterado
- Layout do Site no admin iniciou migracao para shadcn/ui.
- Primeira fatia migrada: controles do `Slider de Destaque`, badges de status/tag/CTA, acoes de editar/excluir/ativar/reordenar slide, aviso flutuante e busca/filtros de categorias agora usam componentes `ui/*` (`Button`, `Input`, `Badge`).
- Cobertura Cypress criada em `admin/cypress/e2e/layout.cy.ts`, validando renderizacao dos dados CMS, busca/filtro de categorias, toggle de slide, abertura do modal de novo slide e toggle de categoria.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Docker: `docker compose build admin` e `docker compose up -d --force-recreate admin` OK.
- Cypress Layout: `npx cypress run --spec cypress/e2e/layout.cy.ts --config baseUrl=http://localhost:3002` OK, 3/3.
- Cypress admin completo: `npx cypress run --config baseUrl=http://localhost:3002` OK, 31/31.
- Backend QA seed recomposto apos a suite: `npm run seed:qa` OK com `QA-M20-0001` e `QA-M20-0002`.

## 1.24.35-alpha - 2026-06-01

### Alterado
- Categorias no admin completou a migracao do fluxo guiado para shadcn/ui.
- Abas `Sugestões automáticas` e `Revisão final`, acoes de gerar sugestoes, dry-run, aplicacao real, aprovacao/rejeicao de pendencias, badges de contagem e chips de categoria agora usam componentes `ui/*` (`Button`, `Badge`).
- Navegacao do fluxo guiado e botoes de proxima/voltar tambem foram migrados para `Button`.
- Cobertura Cypress de `admin/cypress/e2e/categories.cy.ts` ampliada para validar dry-run das sugestoes automaticas, aprovacao e rejeicao de pendencias.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Docker: `docker compose build admin` e `docker compose up -d --force-recreate admin` OK.
- Cypress Categorias: `npx cypress run --spec cypress/e2e/categories.cy.ts --config baseUrl=http://localhost:3002` OK, 4/4.
- Cypress admin completo: `npx cypress run --config baseUrl=http://localhost:3002` OK, 28/28.
- Backend QA seed recomposto apos a suite: `npm run seed:qa` OK com `QA-M20-0001` e `QA-M20-0002`.

## 1.24.34-alpha - 2026-06-01

### Alterado
- Categorias no admin iniciou migracao para shadcn/ui na etapa `Estrutura da loja`.
- Acoes Atualizar/Nova Categoria, formulario de criacao, edicao inline de nome, toggle de visibilidade, campo de limite, tabela da arvore e modal de exclusao agora usam componentes `ui/*` (`Button`, `Input`, `Table`).
- Cobertura Cypress focada criada em `admin/cypress/e2e/categories.cy.ts`, com dados mockados para validar listagem, criacao, renomeacao, alternancia de visibilidade e confirmacao de exclusao.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Docker: `docker compose build admin` e `docker compose up -d --force-recreate admin` OK.
- Cypress Categorias: `npx cypress run --spec cypress/e2e/categories.cy.ts --config baseUrl=http://localhost:3002` OK, 2/2.
- Cypress admin completo: `npx cypress run --config baseUrl=http://localhost:3002` OK, 26/26.
- Backend QA seed recomposto apos a suite: `npm run seed:qa` OK com `QA-M20-0001` e `QA-M20-0002`.

## 1.24.33-alpha - 2026-06-01

### Alterado
- Separacao/Picking no admin iniciou migracao para shadcn/ui.
- Criacao de tarefa, filtro de status, acao Atualizar, botoes de fluxo, badges de status/setor/EAN e formularios inline de separar/falta/substituicao agora usam componentes `ui/*` (`Button`, `Input`, `Select`, `Checkbox`, `Badge`).
- Cobertura Cypress focada criada em `admin/cypress/e2e/picking.cy.ts`, com dados mockados para validar metricas, fila, criacao de tarefa, filtro, separacao e ruptura sem depender do banco local.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Docker: `docker compose build admin` e `docker compose up -d --force-recreate admin` OK.
- Cypress Picking: `npx cypress run --spec cypress/e2e/picking.cy.ts --config baseUrl=http://localhost:3002` OK, 2/2.
- Cypress admin completo: `npx cypress run --config baseUrl=http://localhost:3002` OK, 24/24.
- Backend QA seed recomposto apos a suite: `npm run seed:qa` OK com `QA-M20-0001` e `QA-M20-0002`.

## 1.24.32-alpha - 2026-06-01

### Alterado
- Contas B2B no admin iniciou migracao para shadcn/ui.
- Carteira de empresas, busca, cards selecionaveis, formularios de conta/usuarios/preco/lista, acoes de recorrencia/faturamento, badges e tabela de aprovacoes agora usam componentes `ui/*` (`Button`, `Input`, `Select`, `Badge`, `Table`).
- Cobertura Cypress focada criada em `admin/cypress/e2e/business-accounts.cy.ts`, com dados mockados para validar filtros, resumo financeiro, lista corporativa, busca de cliente, formularios B2B e fila de aprovacao.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Docker: `docker compose build admin` e `docker compose up -d --force-recreate admin` OK.
- Cypress Contas B2B: `npx cypress run --spec cypress/e2e/business-accounts.cy.ts --config baseUrl=http://localhost:3002` OK, 2/2.
- Cypress admin completo: `npx cypress run --config baseUrl=http://localhost:3002` OK, 22/22.
- Backend QA seed recomposto apos a suite: `npm run seed:qa` OK com `QA-M20-0001` e `QA-M20-0002`.

## 1.24.31-alpha - 2026-06-01

### Alterado
- Clientes no admin iniciou migracao para shadcn/ui.
- Toolbar de busca, filtros avancados, alternancia Lista/Colunas, acao Atualizar, chips de filtro, tabela de clientes, badges de CPF/pedidos, cards em colunas e modal de perfil agora usam componentes `ui/*` (`Button`, `Input`, `Select`, `Badge`, `Table`).
- Cobertura Cypress focada criada em `admin/cypress/e2e/customers.cy.ts`, com dados mockados para validar filtros, lista, colunas e perfil do cliente sem depender da base local.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Docker: `docker compose build admin` e `docker compose up -d --force-recreate admin` OK.
- Cypress Clientes: `npx cypress run --spec cypress/e2e/customers.cy.ts --config baseUrl=http://localhost:3002` OK, 2/2.
- Cypress admin completo: `npx cypress run --config baseUrl=http://localhost:3002` OK, 20/20.
- Backend QA seed recomposto apos a suite: `npm run seed:qa` OK com `QA-M20-0001` e `QA-M20-0002`.

## 1.24.30-alpha - 2026-06-01

### Alterado
- Pedidos no admin iniciou migracao para shadcn/ui.
- Toolbar de busca, filtro avancado, alternancia Lista/Kanban, acoes Atualizar/CSV, chips de filtro, tabela de pedidos, badges de SLA/identificacao, selects de status e controles do modal de detalhes agora usam componentes `ui/*` (`Button`, `Input`, `Select`, `Badge`, `Table`).
- Cobertura Cypress focada criada em `admin/cypress/e2e/orders.cy.ts`, com dados mockados para validar filtros, lista, kanban e modal de detalhes sem depender de pedidos reais no banco.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Docker: `docker compose build admin` e `docker compose up -d --force-recreate admin` OK.
- Cypress Pedidos: `npx cypress run --spec cypress/e2e/orders.cy.ts --config baseUrl=http://localhost:3002` OK, 2/2.
- Cypress admin completo: `npx cypress run --config baseUrl=http://localhost:3002` OK, 18/18.
- Backend QA seed recomposto apos a suite: `npm run seed:qa` OK com `QA-M20-0001` e `QA-M20-0002`.

## 1.24.29-alpha - 2026-06-01

### Alterado
- `ProductSlideOver` do Catalogo de Produtos migrado para componentes do UI kit (`Button`, `Input`, `Select` e `Badge`), incluindo campos do formulario, seletores CMS N1/N2, acoes de salvar/cancelar e indicadores de categoria/status.
- Seed QA do backend reforcado para criar dois produtos M20 idempotentes com `stock_positions` reais, saldo alto e disponibilidade recomposta, evitando quebra dos fluxos criticos por estoque residual de execucoes anteriores.
- Cypress admin passou a usar uma task `adminAuth` com JWT local para specs autenticadas, reduzindo chamadas repetidas ao `/auth/login` e preservando o teste smoke de login real.
- Specs `catalog`, `dashboard`, `smoke` e `critical-flows` ajustadas para a nova estrategia de autenticacao e para cobrir o formulario lateral de produto com UI kit.

### Validado
- Backend: `npm run build` OK.
- Backend: `npm run seed:qa` OK com `DATABASE_URL` local, criando `QA-M20-0001` e `QA-M20-0002`.
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Cypress critico: `npx cypress run --spec cypress/e2e/critical-flows.cy.ts --config baseUrl=http://localhost:3002` OK, 3/3.
- Cypress admin completo: `npx cypress run --config baseUrl=http://localhost:3002` OK, 16/16.

## 1.24.28-alpha - 2026-06-01

### Alterado
- Catalogo de Produtos no admin iniciou migracao para shadcn/ui.
- Toolbar de busca, alternancia tabela/cards, acoes Solidcom/taxonomia, criacao de produto, filtros mercadologicos, tabela principal, campos inline de preco/estoque, badges de status, paginacao e tabela de historico Solidcom agora usam componentes `ui/*` (`Button`, `Input`, `Select`, `Badge`, `Table`).

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Admin: `npm audit --audit-level=moderate` com 0 vulnerabilidades.
- Docker: `docker compose build admin` e `docker compose up -d --force-recreate admin` OK.
- Cypress catalogo: `npx cypress run --spec cypress/e2e/catalog.cy.ts --config baseUrl=http://localhost:3002` OK, 3/3.
- Cypress admin completo: `npx cypress run --config baseUrl=http://localhost:3002` OK, 15/15.

## 1.24.27-alpha - 2026-06-01

### Adicionado
- Base shadcn/ui no admin com `components.json`, aliases `@/*`, tokens Tailwind HSL, `tailwindcss-animate`, utilitario `cn` e componentes `Button`, `Input`, `Label`, `Select`, `Checkbox`, `Badge`, `Card` e `Table`.
- Cypress `admin/cypress/e2e/ui-kit.cy.ts` cobrindo a primeira superficie migrada para shadcn/ui.

### Alterado
- `AlertRulesManager` migrado para os componentes do novo UI kit na area de Inteligencia.
- `Intelligence` passa `adminToken` para Regras de Alerta e Relatorio Executivo, corrigindo chamadas autenticadas que antes recebiam token vazio.

### Validado
- Admin: `npm run lint` OK.
- Admin: `npm run build` OK.
- Admin: `npm audit --audit-level=moderate` com 0 vulnerabilidades.
- Docker: `docker compose build admin` e `docker compose up -d --force-recreate admin` OK.
- Cypress admin UI kit: `npx cypress run --spec cypress/e2e/ui-kit.cy.ts --config baseUrl=http://localhost:3002` OK, 1/1.
- Cypress admin completo: `npx cypress run --config baseUrl=http://localhost:3002` OK, 15/15.

## 1.24.26-alpha - 2026-06-01

### Alterado
- Frontend e admin atualizados para Vite `7.3.3` e `@vitejs/plugin-react` `5.2.0`, removendo a cadeia moderada Vite/esbuild.
- Seed tecnico do staging ajustado para usar `admin@antenor.com.br / admin2026` e publicar mapeamentos minimos do catalogo de demonstracao no storefront.

### Validado
- Frontend/admin: `npm audit --audit-level=moderate` com 0 vulnerabilidades.
- Frontend/admin: lint OK e build de producao OK.
- Frontend: unitarios Vitest 60/60.
- Docker: `docker compose build storefront admin` e recreate de `storefront`/`admin` OK.
- Release smoke: `.\release-ops.ps1 smoke` OK, relatorio `artifacts/release/smoke-20260601-060841.json`.
- Cypress storefront completo 34/34 OK.
- Cypress admin completo 14/14 OK, incluindo `critical-flows.cy.ts`.
- Staging local: `docker compose -f docker-compose.staging.yml up -d --build`, migrations, seeds e smoke em `4000/4001/4002` OK.
- Staging utilitario: login admin smoke 3/3 OK em `4002` e storefront smoke 4/4 OK em `4000` apos o novo seed.
- Release preflight renovado: `.\release-ops.ps1 preflight` OK, relatorio `artifacts/release/smoke-20260601-061537.json`.
- Backup/restore renovado: dump `artifacts/backups/antenor-db-20260601-061544.dump` restaurado com 109 tabelas publicas.

## 1.24.25-alpha - 2026-06-01

### Alterado
- Backend atualizado para NestJS 11 (`@nestjs/common/core/platform-express/swagger/serve-static/throttler/config/jwt/passport/testing/cli/schematics`).
- `bcrypt` atualizado para `6.0.0`, removendo a cadeia vulnerável `@mapbox/node-pre-gyp` -> `tar`.
- ESLint atualizado para `8.57.1` e `@typescript-eslint/*` para `7.18.0` em backend, frontend e admin.
- Rota de upload de produto ajustada para Nest 11: `@Post(['product/:ean', 'product/:ean/:slot'])`, preservando os contratos com e sem slot.

### Validado
- Backend: lint OK, build OK, testes 34 suites / 206 testes OK.
- Backend: `npm audit --audit-level=moderate` com 0 vulnerabilidades.
- Frontend/admin: `npm audit --audit-level=high` sem vulnerabilidades altas; permanecem moderadas de Vite/esbuild.
- Prisma validate e migrate status OK.
- Docker API rebuild/recreate OK; `release-ops.ps1 smoke` OK.
- Cypress admin completo 14/14 OK contra API reconstruida.

## 1.24.24-alpha - 2026-06-01

### Adicionado
- Runbook M20 de release e seguranca com gates, plano de upgrade major, matriz de ambientes, rollback, smoke pos-deploy, backup e restore testado.
- Operador `sistema/release-ops.ps1` com comandos `preflight`, `smoke`, `backup` e `restore-test`.
- Templates de variaveis por ambiente em `sistema/.env.example`, `sistema/.env.staging.example` e `sistema/.env.production.example`.

### Validado
- `.\release-ops.ps1 preflight` validou compose local/staging e smoke local autenticado.
- `.\release-ops.ps1 backup` gerou dump PostgreSQL custom.
- `.\release-ops.ps1 restore-test` restaurou o dump em PostgreSQL temporario e confirmou 109 tabelas publicas.

### Pendente
- Executar janela separada para Vite/esbuild em frontend/admin.

## 1.24.23-alpha - 2026-05-31

### Adicionado
- E2E critico M20 em `sistema/admin/cypress/e2e/critical-flows.cy.ts`.

### Validado
- Cypress admin completo 14/14.
- Fluxos cobertos: picking, substituicao, pagamento webhook, integracao ERP, cancelamento parcial e reembolso.
