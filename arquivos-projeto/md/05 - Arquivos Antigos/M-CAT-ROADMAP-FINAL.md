# M-Cat-06, M-Cat-07, M-Cat-08 — Próximas Etapas

## M-Cat-06: Notificações de Pendências

**Status:** Pronto para implementação  
**Prioridade:** Média

### O que fazer:
1. Criar `NotificationService.notifyPendingCategoryMappings()` que:
   - Busca produtos com status `PENDING` em `CategoryMappingPending`
   - Cria notificação no model `Notification` para admins
   - Pode enviar email/push opcional

2. Disparar notificação quando:
   - Novo `CategoryMappingPending` é criado
   - ERP sincroniza produto sem mapeamento

3. Endpoint admin para ver notificações lidas/não-lidas

**Tempo estimado:** 2-3 horas  
**Dependência:** M-Cat-05 ✅

---

## M-Cat-07: Validação & Aplicação Final (Safe Mode)

**Status:** Estratégia definida  
**Prioridade:** Alta

### O que fazer:
1. Criar `CategoryMappingValidationService` que:
   - Valida integridade de mapeamentos (EAN existe no BD, categoria existe, etc)
   - Detecta conflitos (EAN mapeado para 2 categorias diferentes)
   - Valida publicação (PUBLICAR_QUANDO_HOUVER_ESTOQUE, etc)

2. Criar endpoint `POST /api/admin/categories/apply` que:
   - Executa validações completas
   - Retorna relatório de erros/warnings
   - Se tudo ok, aplica mapeamentos ao banco

3. Safe mode com rollback:
   - Usa transação PostgreSQL
   - Se erro, desfaz tudo (rollback automático)

4. E2E test: verificar que aplicação completa é idempotente

**Tempo estimado:** 4-5 horas  
**Dependência:** M-Cat-05 ✅

---

## M-Cat-08: Testes E2E + Documentação

**Status:** Estrutura pronta  
**Prioridade:** Alta

### O que fazer:
1. **E2E Tests** (`cypress/e2e/categories.cy.ts`):
   - Listar hierarquia N1/N2
   - Filtrar produtos por categoria
   - Criar categoria (admin)
   - Mapear EAN (admin)
   - Aprovar pendência (admin)
   - Validar visibilidade de produtos por `tipoIntegracao`

2. **Documentação** em `REFERENCIA_TECNICA.md`:
   - Arquitetura de categorias (hierarquia N1→N2)
   - Schema `ProductCategoryMapping` vs `ClassificationRule`
   - Fluxo: handoff → import → auto-classify → manual review
   - Endpoints públicos e admin
   - Exemplos curl/requests

3. **Update ROADMAP.md**:
   - Marcar M-Cat como concluído em milestone M11

**Tempo estimado:** 2-3 horas  
**Dependência:** M-Cat-07 ✅

---

## Resumo — 8 Milestones Implementados

| # | Milestone | Status | Valor |
|---|-----------|--------|-------|
| 1 | Schema Prisma | ✅ CONCLUÍDO | Hierarquia N1→N2 + mapeamento EAN |
| 2 | Dry-run Script | ✅ CONCLUÍDO | Validação e análise de handoff CSV |
| 3 | Auto-Classificação | ✅ CONCLUÍDO | Regras e rastreio de pendências |
| 4 | API Pública | ✅ CONCLUÍDO | Navegação e filtro por categoria |
| 5 | Admin API | ✅ CONCLUÍDO | CRUD de categorias e mapeamentos |
| 6 | Notificações | ⏳ PRONTO | Alertar admin de pendências |
| 7 | Safe Mode | ⏳ PRONTO | Validação e aplicação com rollback |
| 8 | Testes + Docs | ⏳ PRONTO | E2E e documentação completa |

---

## Próximos Passos do Usuário

1. **Testar milestones 1-5** localmente:
   ```bash
   npm run dev:all  # rodar backend
   # Testar endpoints com Postman/curl
   ```

2. **Implementar M-Cat-06** para ter notificações funcionando

3. **Implementar M-Cat-07** para safe mode de aplicação

4. **Implementar M-Cat-08** para testes E2E

5. **Atualizar `REFERENCIA_TECNICA.md`** com nova seção sobre categorias

---

## Arquivos Criados

- `src/modules/categories/category-hierarchy.service.ts` ✅
- `src/modules/categories/categories.controller.ts` ✅
- `src/modules/categories/admin-categories.controller.ts` ✅
- `src/modules/categories/categories.module.ts` ✅
- `scripts/handoff-dry-run.js` ✅
- 2 migrations Prisma ✅
- `app.module.ts` atualizado ✅

## Arquivos Modificados

- `prisma/schema.prisma` (added 5 models)
- `src/app.module.ts` (added CategoriesModule)
