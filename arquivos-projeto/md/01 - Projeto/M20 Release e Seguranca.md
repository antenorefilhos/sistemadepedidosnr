---
tipo: release
status: ativo
area: engenharia
prioridade: alta
criado: 2026-06-01
atualizado: 2026-06-01
tags:
  - m20
  - release
  - seguranca
  - qa
---

# M20 Release e Seguranca

## Estado

M20 esta encerrado e validado: pipeline base, E2E critico, release operacionalizado, staging local homologado e security scan zerado nos tres workspaces. A parte de release fica operacionalizada por este runbook e pelo operador `sistema/release-ops.ps1`.

## Gates Obrigatorios

Antes de promover qualquer release:

1. `npm run lint`, `npm run build` e testes do backend, storefront e admin devem estar verdes.
2. Prisma deve passar em `npx prisma validate` e `npx prisma migrate status`.
3. Cypress storefront e admin devem passar, incluindo `sistema/admin/cypress/e2e/critical-flows.cy.ts`.
4. `npm audit --audit-level=high` deve ser executado em backend, frontend e admin; root so entra se passar a ter lockfile proprio.
5. `sistema/release-ops.ps1 preflight` deve passar no ambiente candidato.
6. Backup deve ser gerado antes de migracao/deploy: `sistema/release-ops.ps1 backup`.
7. Restore deve ser testado com o dump da release: `sistema/release-ops.ps1 restore-test -DumpPath <dump>`.

## Ambientes

| Ambiente | URLs | Fonte |
| --- | --- | --- |
| Local oficial | loja `http://localhost:3000`, API `http://localhost:3001`, admin `http://localhost:3002` | `sistema/docker-compose.yml`, `sistema/.env.example` |
| Staging local isolado | loja `http://localhost:4000`, API `http://localhost:4001`, admin `http://localhost:4002` | `sistema/docker-compose.staging.yml`, `sistema/.env.staging.example` |
| Producao | domínios finais | `sistema/.env.production.example` |

Decisao atual: staging volta a ser obrigatorio como homologacao local isolada antes de producao. A decisao antiga de staging descontinuado fica superada para M20 porque o checklist exige deploy em staging antes de producao.

## Feature Flags

| Flag | Local | Staging | Producao | Observacao |
| --- | --- | --- | --- | --- |
| `ALLOW_GUEST_CHECKOUT` | `true` | `true` | decidido por operacao | Desliga checkout convidado se houver abuso/fraude. |
| `ENABLE_LEGACY_CLASSIFICATION_MAPPINGS` | `false` | `false` | `false` | Manter legado desligado salvo rollback de taxonomia. |
| `ENABLE_PAYMENTS_INTEGRATION` | `false` | `false` | `false` ate gateway real | Gateway real exige `PAYMENTS_WEBHOOK_SECRET`. |
| `INTEGRATION_PAYMENTS_ENABLED` | `false` | `false` | `false` ate gateway real | Alias operacional para integracao de pagamentos. |
| `VITE_GUEST_CHECKOUT_ENABLED` | `true` | `true` | acompanha backend | UI deve refletir backend. |
| `VITE_PAYMENTS_UI_ENABLED` | `false` | `false` | `false` ate gateway real | Evita prometer pagamento online antes do go-live. |

## Changelog

Fonte canonica: `CHANGELOG.md`.

Regra: toda release precisa de entrada com `Adicionado`, `Alterado`, `Corrigido`, `Validado` e `Pendente` quando aplicavel. A entrada deve apontar os comandos de validacao executados.

## Rollback

1. Nao iniciar rollback sem identificar se a falha e codigo, migracao, dados ou dependencia externa.
2. Se a falha for codigo sem migracao destrutiva: voltar imagem/artefato anterior e rodar `sistema/release-ops.ps1 smoke`.
3. Se a falha envolver migracao: preferir forward-fix. Se rollback for inevitavel, restaurar dump validado da release em janela controlada.
4. Se a falha for integracao externa: desligar flag correspondente e registrar incidente.
5. Depois do rollback/forward-fix, anexar relatorio de smoke em `artifacts/release`.

## Smoke Pos-Deploy

Comando local:

```powershell
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\sistema"
.\release-ops.ps1 smoke
```

O smoke valida:

- `/health` da API.
- HTTP 200 do storefront e admin.
- Login admin.
- Listagem admin de produtos.
- Listagem OMS de pedidos.
- Status Solidcom.

## Backup e Restore

Gerar backup:

```powershell
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\sistema"
.\release-ops.ps1 backup
```

Testar restore:

```powershell
.\release-ops.ps1 restore-test -DumpPath "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\artifacts\backups\<arquivo>.dump"
```

Evidencia de 2026-06-01:

- Backup gerado em `artifacts/backups/antenor-db-20260601-054516.dump`.
- Restore testado em PostgreSQL temporario; 109 tabelas no schema `public`.

## Plano de Upgrade Major de Seguranca

Estado inicial de `npm audit --audit-level=high` em 2026-06-01:

| Pacote | High | Total | Principais familias |
| --- | ---: | ---: | --- |
| backend | 17 | 36 | NestJS 10/11, `@nestjs/platform-express`, `@nestjs/serve-static`, `@nestjs/swagger`, `@typescript-eslint`, `multer`, `lodash`, `tar` |
| frontend | 6 | 8 | Vite/esbuild e `@typescript-eslint`/`minimatch` |
| admin | 6 | 8 | Vite/esbuild e `@typescript-eslint`/`minimatch` |

Estado apos execucao em 2026-06-01:

| Pacote | High | Total audit relevante | Observacao |
| --- | ---: | ---: | --- |
| backend | 0 | 0 em `--audit-level=moderate` | NestJS 11 + bcrypt 6 aplicados. |
| frontend | 0 | 0 em `--audit-level=moderate` | Vite 7.3.3 + plugin React 5.2.0 aplicados. |
| admin | 0 | 0 em `--audit-level=moderate` | Vite 7.3.3 + plugin React 5.2.0 aplicados. |

Sequencia recomendada:

1. **Dev tooling sem runtime:** atualizar `@typescript-eslint/*`, ESLint e dependencias relacionadas em backend/frontend/admin. Rodar lint/build/test.
2. **Frontend/admin:** atualizar Vite e `@vitejs/plugin-react` em uma branch isolada. Rodar build, unit tests do storefront, Cypress storefront/admin.
3. **Backend NestJS:** atualizar familia Nest para 11 (`@nestjs/common/core/platform-express/testing/swagger/serve-static/throttler/config/cli/schematics`). Rodar backend lint/build/test, Prisma validate/migrate status e smoke.
4. **Dependencias transitivas restantes:** revisar se `multer`, `lodash`, `tar`, `path-to-regexp`, `qs` e `file-type` foram eliminadas do audit. Aplicar overrides somente se o grafo permitir sem quebra.
5. **Release candidate:** executar gates obrigatorios, backup, restore-test e staging antes de producao.

Nao usar `npm audit fix --force` direto em ambiente principal. Upgrades major devem entrar em janela propria com rollback documentado.

## Execucao do Plano

Executado em 2026-06-01:

- Backend atualizado para NestJS 11 e `bcrypt@6.0.0`.
- Backend audit zerado: `npm audit --audit-level=moderate` retornou 0 vulnerabilidades.
- `@typescript-eslint/*` atualizado para `7.18.0` e ESLint para `8.57.1` em backend/frontend/admin.
- Frontend/admin atualizados para Vite `7.3.3` e `@vitejs/plugin-react` `5.2.0`; `npm audit --audit-level=moderate` retornou 0 vulnerabilidades nos dois pacotes.
- Rota opcional de upload ajustada para sintaxe compatível com Nest 11.
- API Docker rebuild/recreate executado e smoke local autenticado aprovado.
- Storefront/admin Docker rebuild/recreate executado e smoke local autenticado aprovado.
- Cypress storefront completo aprovado: 34/34.
- Cypress admin completo aprovado: 14/14, incluindo `critical-flows.cy.ts`.
- Staging local homologado em `localhost:4000/4001/4002` com migrations, seeds e smoke autenticado aprovado.
- Preflight final aprovado: `artifacts/release/smoke-20260601-061537.json`.
- Backup final gerado em `artifacts/backups/antenor-db-20260601-061544.dump` e restore-test aprovado com 109 tabelas publicas.

Estado final:

- Nenhuma pendencia tecnica restante no bloco de seguranca/release M20 aplicado. Para producao real, repetir staging, backup, restore-test e smoke pos-deploy deste runbook contra o artefato candidato.
