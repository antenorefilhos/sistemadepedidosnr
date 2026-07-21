# Sincronização Original vs Staging — 18/05/2026

## Estado Final do Ambiente Original (localhost:3000/3001/3002)

**Data:** 18 de maio de 2026, 12:38 UTC-3  
**Stack:** Ativa e operacional (health: ok)

### Métricas de Cobertura
- **Mapeados:** 13.674 produtos (88.3%)
- **Pendentes:** 3.276 produtos (21.1%)
- **Total de produtos ativos:** 15.495
- **Técnicos unmapped:** 0 (100% de cobertura técnica)

### Composição de Pendências
- **Origem handoff:** 3.253 itens (não publicáveis por política: REVISAR_NUNCA, NAO_PUBLICAR_INTERNO)
- **Gap técnico resolvido:** 23 itens (produtos sem categoria inicial, agora em PENDING para revisão)

### Pipeline Executado
1. ✅ **Handoff-apply:** 12.218 mappings + 3.253 pendings originais do arquivo externo
   - Arquivo: `handoff_ecommerce_v3_n1_n2.csv`
   - Resultado: 2 N1 criadas, 7 N2 criadas, 32 não encontradas no DB
2. ✅ **Gap técnico:** 23 produtos sem qualquer mapeamento foram convertidos para PENDING
   - Estes aguardam revisão manual ou auto-reject por política
3. ✅ **Validação:** stats /api/categories/stats/mapping confirma **unmapped = 0**

### Categoria Hierárquica
- **N1 (raiz):** 45 categorias
- **N2 (subcategoria):** 20 categorias
- Estrutura estável e consistente com handoff aplicado

---

## Estado do Ambiente Staging (localhost:4000/4001/4002)

**Data:** 18 de maio de 2026  
**Status:** Em sincronização (dados defasados vs original)

### Estado Atual Registrado
- **Mapeados:** 12.219 (valores antigos pré-handoff full)
- **Pendentes:** 0 (rejeições antigas foram limpas)
- **Unmapped:** 3.253 (bloqueados por política)

### Divergência Conhecida
Staging foi criado como isolado para testes em 14/05. Operação final no original (18/05) incluiu:
- Reapplicação de handoff no original (fez upsert idempotente)
- Criação de 23 pendências para gaps técnicos

Staging não recebeu essas alterações. **Próximo passo:** resincronizar staging com mirror do original ou rebuild+redeploy completo.

---

## Decisões Operacionais

### 1. Handoff como Fonte Primária
- ✅ Confirmado: arquivo `handoff_ecommerce_v3_n1_n2.csv` é autoridade
- Itens com `sugestao_publicacao` em NON_PUBLISHABLE set → PENDING, não MAPPED
- Rastreabilidade via `notes` preservando razão da rejeição

### 2. Cobertura Técnica 100%
- ✅ Original: **unmapped = 0**
- Todos os 15.495 produtos têm mapeamento (mapped) OU pending (em revisão)
- Nenhum produto cai fora do sistema

### 3. Sincronização Original–Staging
- Status: **Parcial**
- Original está fresco e validado
- Staging em standby para resincronização
- Proposta: usar `docker compose -f docker-compose.staging.yml down && docker compose -f docker-compose.staging.yml up -d` + seed novo, ou pg_dump+restore completo

---

## Itens de Ação Recomendados

1. **Staging:** Resincronizar banco com original (pg_dump restore ou redeploy)
2. **Smoke tests:** Rodar Cypress completo em staging pós-sincronização
3. **Admin UI:** Validar funcionalidades de mapeamento em staging (já corrigido em 18/05)
4. **Documentação:** Atualizar STATUS.md com novos números de cobertura

---

**Assinado em:** 18 de maio de 2026, 12:38 UTC-3  
**Próxima revisão:** Pós-sincronização staging
