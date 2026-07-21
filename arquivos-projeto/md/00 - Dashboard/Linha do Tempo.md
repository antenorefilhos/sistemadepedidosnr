---
tipo: dashboard
status: ativo
area: memory-wiki
prioridade: media
criado: 2026-05-24
atualizado: 2026-05-24
tags:
  - dashboard
  - historico
  - cronograma
---

# Linha do Tempo

Histórico cronológico detalhado por versão e entregas passadas está documentado em:

👉 **[[../01 - Projeto/STATUS.md|STATUS.md (Histórico de Versões)]]**

## Linha do Tempo Recente

### YYYY-MM-DD (24/05/2026) · v1.23.0-alpha
- **Organização da Memory-Wiki:** Implementação da estrutura de pastas Obsidian Wiki recomendada pela skill.
- **Saneamento do Repositório:** Remoção de logs temporários e pasta `.opencode/` da raiz, realocação de dados de ERP para `arquivos-projeto/`, ajuste do volume mount Docker Compose, e verificação final dos 34 testes E2E Cypress aprovados.

### 21/05/2026 · v1.22.0-alpha
- **Melhorias no StoreProductCard:** Remoção do box de preço (desencaixotado), remoção de gap vertical excessivo e toggle Unidade/Peso alterando diretamente o marcador de step de quantidade do produto.

### 19/05/2026 · v1.21.0-alpha
- **Categorias no Admin e Storefront:** Substituição da listagem plana por visualização estilo árvore Explorer (Dnd funcional para reordenação entre categorias irmãs), exclusão de categorias fora da taxonomia oficial (redução de 87 para 74 e posteriormente restauração do baseline de 45 raízes N1), e importação do handoff.

### 18/05/2026 · v1.20.0-alpha
- **M33 Inteligência e Analytics:** Funil de vendas com comparativo de período (7 dias) e regras de alertas automáticos persistidas em banco de dados (`AlertRule` / `AlertTriggered`).
- **Staging (decisão superada):** Houve uma fase de simplificação sem staging, mas a decisão foi revertida no M20; hoje o staging local em `4000/4001/4002` voltou a ser obrigatório como homologação isolada antes de produção.
