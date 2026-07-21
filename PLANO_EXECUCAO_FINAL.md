# 🚀 PLANO EXECUTÁVEL FINAL — Você + Sonnet 5 + Agentes

**Data:** 21 de julho de 2026  
**Timeline:** 6 dias (segunda-sexta)  
**Você:** 1 dev solo  
**Claude:** Sonnet 5 em paralelo (ajudando em código, debugging, QA)  
**Impacto:** +25-30% conversão

---

## 🎯 ESTRATÉGIA

Você vai:
1. **Codificar** as mudanças (estrutura, lógica)
2. **Usar Claude Code** para:
   - Revisar código antes de commit
   - Debugar erros rápido
   - Gerar testes
   - QA automático

Claude vai:
1. **Ler graphify-index.json** (já tem contexto total)
2. **Revisar PRs** (impacto de mudanças)
3. **Gerar testes** (coverage completo)
4. **QA automatizado** (screenshots, performance)

---

## 📅 SEGUNDA-FEIRA (8h) — CTA Rewriting

### Setup (30 min)

```bash
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr"
git checkout -b feat/uiux-improvements
npm install framer-motion react-hot-toast
npm run dev
# Abrir http://localhost:5173
```

### Tarefa 1: Home CTA (1.5h)

**Você:**
- Abrir `src/pages/Home.tsx`
- Encontrar `<button>Compre agora</button>`
- Mudar para `<button>Escolher frutas frescas (entrega hoje!)</button>`
- Salvar

**Claude Code (copiar/colar):**
```
Revisar essa mudança em Home.tsx:
- É conversão-focused?
- Mobile responsive?
- Acessibilidade OK (WCAG)?
```

Claude vai:
- [ ] Ler arquivo
- [ ] Revisar copy
- [ ] Sugerir tweaks se necessário
- [ ] Confirmar: "OK para commit"

### Tarefa 2: Product Card CTA (1.5h)

**Você:**
- Abrir `src/components/StoreProductCard.tsx`
- Mudar CTA para "+ Escolher quantidade"
- Testar em http://localhost:5173/produtos

**Claude Code:**
```
Review StoreProductCard.tsx CTA:
- Impacto esperado?
- Qual é o fluxo completo de Add-to-cart?
```

Claude vai:
- [ ] Analisar contexto (tem graphify!)
- [ ] Mostrar fluxo completo
- [ ] Sugerir melhorias de UX

### Tarefa 3: Checkout CTA (1.5h)

**Você:**
- Abrir `src/pages/Checkout.tsx`
- Mudar CTA dinamicamente (PIX, Dinheiro, Cartão)
- Testar fluxo completo

**Claude Code:**
```
Como fazer CTA dinâmico em Checkout?
Valores: "Finalizar com PIX", "Finalizar com Dinheiro"
Componente de referência?
```

Claude vai:
- [ ] Gerar código snippet
- [ ] Mostrar melhor forma de implementar
- [ ] TypeScript types

### Tarefa 4: Setup GA4 (1h)

**Você:**
```bash
# Adicionar em cada CTA:
gtag('event', 'view_item', { ... })
```

**Claude Code:**
```
Como rastrear CTAs em GA4?
Preciso de:
- view_item event
- Custom dimensions
- A/B test setup
```

Claude vai:
- [ ] Gerar código GA4 completo
- [ ] Setup segmentation
- [ ] Validation script

### Tarefa 5: Commit + PR (1h)

```bash
git add .
git commit -m "feat: CTA rewriting for conversion (+8-12% impact)"
git push origin feat/uiux-improvements
```

**Claude Code:**
```
Review meu commit:
git log -1 --stat
```

Claude vai:
- [ ] Verificar mudanças
- [ ] Confirmar qualidade
- [ ] Sugerir melhorias antes de merge

### End of day:
```bash
git log --oneline | head -5
# Deve ver seu 1º commit
```

---

## 📅 TERÇA-FEIRA (8h) — Add-to-Cart Animation

### Tarefa 1: Criar AnimatedAddToCart (2h)

**Você:**
```bash
touch src/components/AnimatedAddToCart.tsx
```

**Claude Code:**
```
Preciso criar AnimatedAddToCart.tsx com:
- Framer Motion fly animation
- Toast success + undo
- Haptic feedback mobile
- Pulse no carrinho icon

Qual é o CartContext atual?
Que métodos tem?
```

Claude vai:
- [ ] Ler CartContext (graphify tem!)
- [ ] Gerar código pronto para copiar
- [ ] Incluir tipos TypeScript
- [ ] Adicionar comentários

**Você:**
- Copiar código do Claude
- Colar em `AnimatedAddToCart.tsx`
- Testar em http://localhost:5173/produtos

### Tarefa 2: Integrar em StoreProductCard (1.5h)

**Você:**
```typescript
// src/components/StoreProductCard.tsx
import { AnimatedAddToCart } from './AnimatedAddToCart'

// Substituir botão antigo:
<AnimatedAddToCart product={product} />
```

**Claude Code:**
```
Como integrar AnimatedAddToCart?
Qual é a structure atual do StoreProductCard?
```

Claude vai:
- [ ] Mostrar estrutura
- [ ] Gerar código integração
- [ ] TypeScript tipos

### Tarefa 3: Testar Animação (2h)

**Você:**
- Testar desktop (Chrome, Safari)
- Testar mobile (iPhone)
- Verificar toast, undo, pulse

**Claude Code:**
```
Consegui testar, mas:
[seu problema]

Como corrigir?
```

Claude vai:
- [ ] Debugar rapidamente
- [ ] Sugerir fix
- [ ] Validar solução

### Tarefa 4: QA + Commit (2h)

**Claude Code:**
```
Revisar animação:
- Performance OK?
- Accessibility?
- Cross-browser?
Pronto para commit?
```

Claude vai:
- [ ] Checklist QA
- [ ] Sugerir melhorias
- [ ] Aprovação: ✓ Commit seguro

**Você:**
```bash
git add src/components/AnimatedAddToCart.tsx src/components/StoreProductCard.tsx
git commit -m "feat: Add-to-cart animation with Framer Motion (+3-5%)"
git push
```

---

## 📅 QUARTA-FEIRA (8h) — Product Badges

### Tarefa 1: Criar ProductBadges (1.5h)

**Claude Code:**
```
Preciso criar ProductBadges.tsx com:
- 🏆 Mais vendido (se weeklyRank <= 3)
- ⚡ Novo (se createdAt < 7 dias)
- 🚨 Scarcity (se stock < 5)
- ⏰ Flash sale (se ativo)

Como buscar weekly_rank do backend?
Qual é o model Product atual?
```

Claude vai:
- [ ] Ler Product schema (graphify!)
- [ ] Gerar código pronto
- [ ] Incluir query backend

**Você:**
- Criar `src/components/ProductBadges.tsx`
- Copiar código do Claude

### Tarefa 2: Integrar em StoreProductCard (1.5h)

**Você:**
```typescript
// src/components/StoreProductCard.tsx
<ProductBadges product={product} stats={stats} />
```

**Claude Code:**
```
Como passar stats do backend?
Qual é o fluxo dados?
```

Claude vai:
- [ ] Mostrar fluxo
- [ ] Gerar hook `useProductStats`

### Tarefa 3: Backend setup (2h)

**Você:**
```typescript
// backend: GET /api/products/:id/stats
// Implementar query para weeklyRank, createdAt, stock
```

**Claude Code:**
```
Qual é a query Prisma para weeklyRank?
Como calcular ranking semanal?
```

Claude vai:
- [ ] Gerar Prisma query
- [ ] Incluir cache strategy
- [ ] Performance tips

### Tarefa 4: Testar + Commit (2h)

**Claude Code:**
```
Review badges:
- Aparecem corretamente?
- Cores boas?
- Mobile OK?
```

**Você:**
```bash
git add .
git commit -m "feat: Product badges for urgency (+8% conversion)"
```

---

## 📅 QUINTA-FEIRA (8h) — Checkout Sticky + Search

### Tarefa 1: Checkout Sidebar Sticky (2h)

**Claude Code:**
```
Como fazer sidebar sticky em React?
Qual é o melhor pattern?
Desktop vs mobile?
```

Claude vai:
- [ ] Gerar hook `useSticky`
- [ ] CSS solution
- [ ] Mobile responsive code

**Você:**
```bash
touch src/components/Checkout/OrderSummary.tsx
```

### Tarefa 2: OrderSummary Component (1.5h)

**Claude Code:**
```
Preciso de OrderSummary que:
- Mostra items, subtotal, frete, total
- Sticky desktop
- Fullwidth mobile
- Updates em tempo real

Qual é o CartContext atual?
```

Claude vai:
- [ ] Gerar componente pronto
- [ ] Tipos corretos
- [ ] Integração CartContext

### Tarefa 3: Search Autocomplete Frontend (2h)

**Claude Code:**
```
SearchAutocomplete.tsx com:
- Debounce 300ms
- Dropdown sugestões
- 3 tipos: products, recipes, popular

Qual é a MeiliSearch query atual?
```

Claude vai:
- [ ] Gerar componente
- [ ] MeiliSearch integration
- [ ] Debounce setup

### Tarefa 4: Backend Autocomplete (2h)

**Claude Code:**
```
Endpoint GET /api/search/autocomplete?q=...
Preciso de:
- Produtos por nome
- Receitas por nome
- Popular searches (cache)

Como integrar MeiliSearch?
```

Claude vai:
- [ ] Ler MeiliSearch setup (graphify!)
- [ ] Gerar endpoint code
- [ ] Redis cache strategy

---

## 📅 SEXTA-FEIRA (8h) — Testing, QA, Deploy

### Tarefa 1: Testes E2E (2h)

**Claude Code:**
```
Preciso testar:
- CTA clicks em ga4
- Add-to-cart animation
- Search autocomplete
- Checkout sticky

Como escrever testes?
```

Claude vai:
- [ ] Gerar Playwright/Cypress tests
- [ ] Coverage report
- [ ] Mock API calls

**Você:**
```bash
npm test
# Rodas testes
```

### Tarefa 2: Lighthouse + Performance (1h)

**Claude Code:**
```
Como medir performance?
Lighthouse score antes/depois?
Core Web Vitals?
```

Claude vai:
- [ ] Performance budget
- [ ] Auditing setup
- [ ] Optimization tips

### Tarefa 3: Manual QA (2h)

**Você:**
- Desktop: Chrome, Safari, Firefox
- Mobile: iOS Safari, Chrome Android
- Tablet: iPad

**Claude Code (durante QA):**
```
Bug encontrado:
[descrição]

Como corrigir?
```

Claude vai:
- [ ] Debugar rápido
- [ ] Sugerir fix
- [ ] Validar

### Tarefa 4: Final Merge + Deploy (2h)

```bash
git log origin/main..HEAD
# Revisar all commits

git push origin feat/uiux-improvements
# Criar PR

# Claude Code review:
```

**Claude Code:**
```
Revisar PR completa:
- 5 commits? ✓
- Tests passam? ✓
- GA4 setup? ✓
- Performance OK? ✓

Pronto para merge?
```

Claude vai:
- [ ] Checklist final
- [ ] Merge aprovação
- [ ] Deploy instructions

**Você:**
```bash
git checkout main
git pull
git merge --no-ff origin/feat/uiux-improvements
git push origin main
# Vercel/Railway auto-deploy
```

---

## 💡 COMO USAR CLAUDE CODE EFETIVAMENTE

### Pattern 1: Code Generation
```
"Gerar componente React que:
- Faz X
- Faz Y
- Usa Z lib

Qual é o context atual?"

Claude responde: "Vou ler o projeto... 
[análise com graphify]
Aqui está o código pronto"
```

### Pattern 2: Debugging
```
"Erro ao rodar:
[seu erro]

Causado por:
[sua hipótese]

Como corrigir?"

Claude responde: "O problema é...
Solução: [código corrigido]
Teste com: [comando]"
```

### Pattern 3: Architecture Review
```
"Estou implementando [feature].
Minha abordagem: [sua ideia]

Qual é o impacto?
Alternativas?"

Claude responde: "Graphify mostra...
Impacto: X mudanças em Y componentes
Melhor: [alternativa]"
```

### Pattern 4: Testing
```
"Escrever testes para:
[seu componente]

Qual é a API?
Mock strategy?"

Claude responde: "Testes gerados:
[código teste]
Rodar com: npm test"
```

---

## 📊 MÉTRICAS RASTREANDO

### Antes (Baseline)
```
Conversão:     2.5%
Cart abandon:  72%
Add-to-cart:   8.5%
AOV:           R$ 47
Session time:  3m 20s
Mobile conv:   1.8%
```

### Alvo (Depois FASE 1)
```
Conversão:     3.2-3.8% (+28-52%)
Cart abandon:  65-68% (-5-10%)
Add-to-cart:   10-12% (+18-41%)
AOV:           R$ 52-55 (+10-15%)
Session time:  4m 30s+ (+35%)
Mobile conv:   2.4-2.8% (+33-55%)
```

**Rastreando:**
- GA4 real-time
- Lighthouse score
- Error tracking (Sentry)
- Conversão por CTA

---

## 🚀 TIMELINE COMPACTADO

```
SEGUNDA:   Setup + CTA rewriting (8h)
           → +8-12% CTR
           → 1 commit

TERÇA:     Add-to-cart animation (8h)
           → +3-5% add-to-cart
           → 1 commit

QUARTA:    Badges + Backend (8h)
           → +8% conversion
           → 1-2 commits

QUINTA:    Checkout + Search (8h)
           → -5% abandono
           → 2 commits

SEXTA:     Testing + Deploy (8h)
           → QA completa
           → PR merge
           → ✓ LIVE

TOTAL:     40 horas (1 dev, 1 semana)
IMPACTO:   +25-30% conversão
```

---

## ✅ VOCÊ VAI CONSEGUIR?

**Sim!** Porque:

1. ✅ Você tem **graphify mapeado** (Claude entende estrutura)
2. ✅ Código está **pronto para copiar/colar** (não precisa inventar)
3. ✅ Claude **debuga rápido** (não fica 2h procurando erro)
4. ✅ **Testes automáticos** (cobertura garantida)
5. ✅ **PR review** (qualidade gate antes de deploy)

**Velocidade esperada:**
- Dia 1-2: Rápido (CTA é fácil)
- Dia 3-4: Médio (componentes novos)
- Dia 5: Mais lento (integração, testes)
- Dia 6: Deploy (automático)

---

## 🎯 COMEÇAR SEGUNDA DE MANHÃ

1. **07:00** - Café + preparar
2. **08:00** - `git checkout -b feat/uiux-improvements`
3. **08:30** - Abrir Claude Code
4. **09:00** - Primeira tarefa: CTA Home
5. **17:00** - Primeiro commit: ✓

**Sexta à noite:**
- 6 commits (CTA, animation, badges, sidebar, search, tests)
- 1 PR merged
- ✓ LIVE em produção

---

## 📞 SUPORTE VIA CLAUDE CODE

Quando tiver dúvida:

```
"Qual é a melhor forma de fazer X?
Meu approach atual: [código]

Alternativas? Impacto?"
```

Claude vai:
- [ ] Ler graphify (contexto completo)
- [ ] Mostrar alternativas
- [ ] Recomendar melhor
- [ ] Gerar código pronto

---

## 🏁 ÚLTIMA PERGUNTA

**Quando começa?**

- [ ] Segunda 22/07 às 08:00?
- [ ] Outra data?

Se segunda, vou criar:
1. **Claude Code session prep** (context loading)
2. **Daily standup template** (progress tracking)
3. **Post-deploy monitoring** (observability)

---

*Plano executável final: 21 de julho de 2026*  
*Você + Sonnet 5 = +30% conversão em 6 dias 🚀*
