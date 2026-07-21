# 🎯 Claude Code Briefing — Começar AGORA

**Data:** 21 de julho de 2026  
**Hora:** Começando agora  
**Modelo:** Sonnet 5  
**Projeto:** Antenor e Filhos — UI/UX Improvements FASE 1  
**Impacto:** +25-30% conversão em 6 dias

---

## 🎬 COMECE COM ISTO

Copie e cole em Claude Code:

```
Vou implementar melhorias UI/UX em "Antenor e Filhos" 
para aumentar conversão de 2.5% → 3.5%+ (+40-50%).

FASE 1: 6 dias, 5 mudanças críticas

1. CTA Rewriting (microcopy estratégica)
2. Add-to-cart Animation (Framer Motion)
3. Product Badges (urgência + social proof)
4. Checkout Sidebar Sticky (orientação)
5. Search Autocomplete (descoberta)

Projeto já tem:
✅ Graphify mapeado (30.470 nós, 60.132 edges)
✅ React 18 + Vite + Tailwind
✅ NestJS backend + Prisma 5.22.0
✅ CartContext global state
✅ productPricing.ts centralizado

Preciso de ajuda com:
1. Revisar meu código antes de cada commit
2. Debugar erros rápido
3. Gerar testes (React Testing Library)
4. QA checklist

Documentação pronta:
- PLANO_EXECUCAO_FINAL.md (roadmap dia-a-dia)
- EXECUTAR_CHECKLIST.md (tarefas específicas)
- graphify-knowledge.json (contexto projeto)

Começando AGORA. Tarefa 1:

CTA Rewriting em Home.tsx
Mudar "Compre agora" → "Escolher frutas frescas (entrega hoje!)"

Qual é o padrão atual de CTAs?
Como fazer mais conversão-focused?
```

---

## 📂 ARQUIVOS PRINCIPAIS

Todas as documentações estão em:
```
F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\
├─ PLANO_EXECUCAO_FINAL.md (roadmap principal)
├─ EXECUTAR_CHECKLIST.md (dia-a-dia)
├─ MELHORIAS_UIUX_TOPBENCHMARK.md (análise detalhada)
├─ PLANO_IMPLEMENTACAO_UIUX.md (código + exemplos)
├─ UIUX_QUICK_START.md (referência 5 min)
├─ graphify-knowledge.json (mapa projeto)
└─ CLAUDE_CODE_BRIEFING.md (este arquivo)
```

---

## 🎯 TAREFA 1: CTA Home (Começar AGORA)

### Contexto
Home page tem CTA genérico: "Compre agora"
Precisa ser: "Escolher frutas frescas (entrega hoje!)"

### Código atual (find)
```typescript
// src/pages/Home.tsx
<button className="bg-gold text-burgundy px-8 py-3 text-lg font-bold">
  Compre agora
</button>
```

### Objetivo
```typescript
// DEPOIS
<button className="bg-gold text-burgundy px-8 py-3 text-lg font-bold">
  Escolher frutas frescas (entrega hoje!)
</button>
```

### Perguntas para Claude
```
1. Qual é a estrutura atual de Home.tsx?
2. Onde estão todos os CTAs?
3. Como fazer copy mais conversão-focused?
4. Mobile-responsive OK?
5. Pronto para commit?
```

---

## 🚀 WORKFLOW COM CLAUDE

### Padrão: Code + Review

**Você:**
```bash
# 1. Faz a mudança
# 2. Testa localmente
# 3. Cola em Claude Code:

"Review minha mudança em Home.tsx:
- Impacto conversão?
- Mobile OK?
- Accessibility?
Pronto para commit?"
```

**Claude:**
```
✅ Revisei...
✓ Conversão-focused
✓ Mobile OK
✓ Accessibility WCAG AA
→ Pronto para commit!
```

**Você:**
```bash
git add src/pages/Home.tsx
git commit -m "feat: CTA Home rewritten for conversion"
git push origin feat/uiux-improvements
```

---

## 💻 SETUP (Se ainda não fez)

```bash
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr"

# 1. Dependências
npm install framer-motion react-hot-toast

# 2. Dev server
npm run dev
# Deve estar em http://localhost:5173

# 3. Git branch
git checkout -b feat/uiux-improvements

# 4. Começar!
# Abrir http://localhost:5173
# Fazer primeira mudança em Home.tsx
```

---

## 📋 HOJE: Tarefas (8 horas)

### 09:00 - Setup (30 min)
- [ ] `npm install` dependências
- [ ] `npm run dev` rodando
- [ ] Git branch criada
- [ ] Home.tsx aberto

### 09:30 - CTA Home (1.5h)
- [ ] Encontrar `<button>Compre agora</button>`
- [ ] Mudar para `<button>Escolher frutas frescas (entrega hoje!)</button>`
- [ ] Testar em http://localhost:5173
- [ ] Review Claude
- [ ] Commit

### 11:00 - CTA Product (1.5h)
- [ ] Abrir `src/components/StoreProductCard.tsx`
- [ ] Mudar `"Adicionar ao carrinho"` → `"+ Escolher quantidade"`
- [ ] Testar em http://localhost:5173/produtos
- [ ] Review Claude
- [ ] Commit

### 12:30 - LUNCH (1h)

### 13:30 - CTA Checkout (1.5h)
- [ ] Abrir `src/pages/Checkout.tsx`
- [ ] Fazer CTA dinâmico (PIX, Dinheiro, etc)
- [ ] Testar fluxo completo
- [ ] Review Claude
- [ ] Commit

### 15:00 - GA4 Setup (2h)
- [ ] Adicionar `gtag()` em cada CTA
- [ ] Verificar em GA4 real-time
- [ ] Setup segmentação A/B
- [ ] Commit

### 17:00 - Review + Cleanup (1h)
- [ ] Todas as mudanças commitadas?
- [ ] Push para origin?
- [ ] Claude final review?

---

## 🔄 DAILY PATTERN

Cada tarefa segue este fluxo:

```
1. FAZER (você codifica)
   └─ Editar arquivo
   └─ Testar localmente
   └─ npm run dev verifica

2. REVISAR (Claude valida)
   └─ Colar código/mudança em Claude
   └─ Claude avalia impacto
   └─ Claude aprova ou sugere tweaks

3. COMMIT (você salva)
   └─ git add
   └─ git commit
   └─ git push

4. PRÓXIMO (repeat)
```

---

## ⚡ FRASES PARA USAR COM CLAUDE

### Pedir revisão
```
"Review minha mudança:
[código/descrição]

Impacto? Mobile OK? Pronto para commit?"
```

### Pedir geração
```
"Preciso de componente que:
- Faz X
- Faz Y
- Usa Z

Qual é o melhor approach?"
```

### Debugar
```
"Erro quando rodo:
[erro]

Como corrigir?"
```

### Testar
```
"Como escrever testes para:
[seu componente]

Mock strategy? Tipos?"
```

---

## 📊 MÉTRICAS HOJE

Rastrear enquanto faz:

```bash
# Commits feitos
git log --oneline | head -5

# Arquivos mudados
git diff --stat origin/main

# Tests passando
npm test -- --passWithNoTests
```

Esperado no fim do dia:
- [ ] 3+ commits (CTA Home, Product, Checkout)
- [ ] GA4 events configurados
- [ ] 0 console errors
- [ ] Ready para review final

---

## 🎯 CHECKLIST: ANTES DE COMEÇAR

- [ ] Leu PLANO_EXECUCAO_FINAL.md? (sim/não)
- [ ] npm run dev funcionando? (sim/não)
- [ ] Git branch criada? (sim/não)
- [ ] Entendeu o padrão: Fazer → Revisar → Commit? (sim/não)
- [ ] Pronto para chamar Claude quando tiver dúvida? (sim/não)

Se tudo SIM → **Começa agora!** 🚀

---

## 🆘 SE TRAVAR

Claude pode ajudar rapidinho com:

```
"Estou preso em:
[descrição]

Tenho 30 min para resolver.
Qual é a quickfix?"
```

Claude vai:
- [ ] Ler contexto (graphify tem!)
- [ ] Diagnosticar problema
- [ ] Sugerir solução rápida
- [ ] Validar com você

---

## 🎬 COMEÇAR: AGORA

### 1. Trocar para Sonnet 5 em Claude Code

### 2. Colar este briefing

```
Vou fazer melhorias UI/UX em "Antenor e Filhos".
FASE 1: 6 dias, 5 mudanças.

Documentação: PLANO_EXECUCAO_FINAL.md
Projeto: F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr

Tarefa 1: CTA Rewriting em Home.tsx
Mudar "Compre agora" → "Escolher frutas frescas (entrega hoje!)"

Como fazer? Qual é o padrão atual?
```

### 3. Começar primeira tarefa

Claude vai:
- [ ] Ler projeto (graphify!)
- [ ] Entender estrutura
- [ ] Guiar primeira mudança
- [ ] Revisar antes de commit

---

## 🎉 GO LIVE TIMELINE

```
HOJE (21/07):     CTA rewriting → 3 commits
AMANHÃ (22/07):   Add-to-cart animation → 1 commit
QUARTA (23/07):   Product badges → 2 commits
QUINTA (24/07):   Checkout + Search → 3 commits
SEXTA (25/07):    Testing + Deploy → PR merge + ✓ LIVE

Total: 10 commits, 1 PR, +25-30% conversão
```

---

*Briefing pronto: 21 de julho de 2026*  
*Status: PRONTO PARA COMEÇAR*  
*Boa sorte! 🚀*
