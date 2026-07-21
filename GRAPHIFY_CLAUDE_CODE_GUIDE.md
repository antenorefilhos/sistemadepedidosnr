# 🚀 Usando Graphify em Claude Code

**Data:** 21 de julho de 2026  
**Status:** ✅ graphify-knowledge.json gerado com sucesso

---

## ✅ O QUE VOCÊ JÁ TEM

```
F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\
├─ graphify-knowledge.json/
│  ├─ graphify-out/
│  │  ├─ graph.json (30.470 nós, 60.132 edges)
│  │  └─ .graphify_analysis.json
│  └─ (estrutura gerada)
└─ (seu projeto)
```

---

## 🎯 COMO USAR EM CLAUDE CODE

### Opção 1: Perguntar sobre o grafo (RECOMENDADO)

Em qualquer chat no Claude Code, você pode fazer perguntas sobre a estrutura:

```
"Qual é o impacto de mudar CartContext?"

"Quais componentes dependem de productPricing.ts?"

"Mostre o fluxo crítico de Checkout"

"Qual é a arquitetura de Auth?"

"Que serviços o OMS (Order Management System) chama?"
```

Claude entende a estrutura porque:
1. ✅ Graphify mapeou tudo
2. ✅ Você tem contexto completo do projeto
3. ✅ A análise está disponível localmente

### Opção 2: Usar o GRAPH_REPORT.md (quando criado)

Rode em PowerShell:

```powershell
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr"
graphify cluster-only "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\graphify-knowledge.json"
```

Isso cria:
- `GRAPH_REPORT.md` — Relatório legível com comunidades nomeadas
- `COMMUNITIES.json` — Mapeamento de grupos

Depois cole o conteúdo de `GRAPH_REPORT.md` em um chat do Claude Code.

### Opção 3: Análise visual + textual

Combine:
1. **Canvas Obsidian** → Visual (grafo interativo)
2. **graphify-knowledge.json** → Textual (dependências exatas)
3. **Claude Code** → Análise (impacto de mudanças)

---

## 💡 EXEMPLOS DE PERGUNTAS

### Sobre Dependências
```
"Mapeie todas as dependências de CartContext"
"Qual seria o impacto de remover Redis?"
"Que componentes quebram se Stock Service cair?"
```

### Sobre Arquitetura
```
"Qual é o fluxo completo de um pedido (M06-OMS)?"
"Como funciona a autenticação (M00-Security)?"
"Qual é a estrutura de pricing (M04)?"
```

### Sobre Mudanças
```
"Se eu mudar productPricing.ts, o que quebra?"
"Posso remover este módulo de forma segura?"
"Qual é o caminho crítico do checkout?"
```

### Sobre Performance
```
"Qual módulo tem mais dependências (hot spot)?"
"Existem ciclos de dependência?"
"Como otimizar o tempo de load?"
```

---

## 📊 ESTRUTURA DO graph.json

Se quiser explorar diretamente:

```json
{
  "nodes": [
    {
      "id": "CartContext",
      "type": "React Context",
      "imports": ["useState", "useContext"],
      "exports": ["CartContext", "CartProvider"],
      "file": "src/contexts/CartContext.tsx"
    },
    // ... 30.470 nós assim
  ],
  "edges": [
    {
      "from": "CartContext",
      "to": "productPricing",
      "type": "import"
    },
    // ... 60.132 conexões assim
  ],
  "communities": [
    {
      "id": 1,
      "nodes": ["CartContext", "useCart", "CartProvider"],
      "name": "Shopping Cart System"
    },
    // ... 1.090 comunidades assim
  ]
}
```

---

## 🎯 WORKFLOW RECOMENDADO

### SEGUNDA (Começar semana)
```
1. Abrir Claude Code
2. Fazer pergunta sobre estrutura do projeto
3. Claude responde com contexto completo
4. Planejar mudanças
```

### TERÇA-SEXTA (Desenvolvimento)
```
1. Fazer perguntas sobre impacto de mudanças
2. Claude propõe testes baseado em grafo
3. Implementar com confiança
```

### SEXTA (Review)
```
1. Rodar `graphify cluster-only` novamente
2. Comparar com semana anterior
3. Identificar evolução da arquitetura
```

---

## ⚙️ PRÓXIMOS PASSOS OPCIONAIS

### Gerar GRAPH_REPORT.md
```powershell
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr"
graphify cluster-only "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\graphify-knowledge.json"
```

### Atualizar grafo (quando código mudar)
```powershell
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr"
graphify . --code-only --output ./graphify-knowledge.json
```

### Instalar suporte SQL (opcional)
```powershell
pip install "graphifyy[sql]"
graphify . --code-only --output ./graphify-knowledge.json
```

---

## 🎉 RESUMO

✅ **graphify-knowledge.json** criado com sucesso  
✅ **30.470 nós** mapeados (funções, classes, módulos)  
✅ **60.132 edges** mapeados (dependências)  
✅ **1.090 comunidades** identificadas  

**Agora você pode:**

1. **Fazer perguntas em Claude Code** sobre qualquer parte da arquitetura
2. **Gerar GRAPH_REPORT.md** para ter um mapa visual
3. **Analisar impacto** de mudanças com confiança
4. **Identificar gargalos** e oportunidades de refatoração

---

## 🚀 COMECE AGORA

Abra Claude Code e pergunte:

```
"Qual é a estrutura completa de autenticação 
e quais componentes dependem dela?"
```

Claude vai responder com análise detalhada baseada no grafo.

---

*Guia criado em 21 de julho de 2026*  
*Graphify mapeamento completo ✅*
