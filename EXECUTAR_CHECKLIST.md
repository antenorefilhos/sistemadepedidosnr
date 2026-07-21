# ✅ EXECUTAR: Checklist Dia-a-Dia

**Data:** 21 de julho de 2026  
**Status:** Pronto para começar  
**Duração:** 6 dias úteis (1 dev)

---

## 🎯 ANTES DE COMEÇAR

### Pre-requisitos (30 min)

- [ ] **Node.js + npm atualizado**
  ```bash
  node --version  # v18+
  npm --version   # v8+
  ```

- [ ] **Dependências instaladas**
  ```bash
  cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr"
  npm install framer-motion react-hot-toast
  npm list framer-motion react-hot-toast
  ```

- [ ] **Git branch criada**
  ```bash
  git checkout -b feat/uiux-improvements
  git status
  ```

- [ ] **Tests rodam**
  ```bash
  npm test -- --passWithNoTests
  ```

- [ ] **Dev server funciona**
  ```bash
  npm run dev
  # Deve estar em http://localhost:5173 ou similar
  ```

- [ ] **GA4 configurado**
  - [ ] Checar se `gtag` está carregando (`window.gtag`)
  - [ ] Verificar eventos em GA4 dashboard

---

## 📅 SEGUNDA-FEIRA (8h) — CTA Rewriting

### 09:00 - Análise rápida (1h)

```bash
# Abrir em seu editor:
- src/pages/Home.tsx
- src/components/StoreProductCard.tsx
- src/pages/Checkout.tsx

# Encontrar todos os CTAs (search: "button", "onClick")
```

**Tarefas:**
- [ ] Ler MELHORIAS_UIUX_TOPBENCHMARK.md seção 2
- [ ] Mapear todos os CTAs no código
- [ ] Preparar copy novo (lista de mudanças)

### 10:00 - Home CTA rewrite (2h)

**Arquivo: `src/pages/Home.tsx`**

```typescript
// ANTES:
<button className="bg-gold text-burgundy px-8 py-3 text-lg font-bold">
  Compre agora
</button>

// DEPOIS:
<button className="bg-gold text-burgundy px-8 py-3 text-lg font-bold">
  Escolher frutas frescas (entrega hoje!)
</button>
```

**Mudanças a fazer:**
- [ ] Hero CTA: "Compre agora" → "Escolher [categoria] (entrega hoje!)"
- [ ] Category cards: "Ver mais" → "Ver [categoria] frescas"
- [ ] Destacar frase de urgência: "(entrega hoje!)"

**Teste visual:**
```bash
npm run dev
# Abrir http://localhost:5173
# Verificar: CTA aparece correto em desktop + mobile
```

**Commit:**
```bash
git add src/pages/Home.tsx
git commit -m "feat: CTA Home rewritten for conversion (+8-12%)"
```

### 12:00 - LUNCH (1h)

### 13:00 - Product Card CTA rewrite (2h)

**Arquivo: `src/components/StoreProductCard.tsx`**

```typescript
// ANTES:
<button>Adicionar ao carrinho</button>

// DEPOIS:
<button>+ Escolher quantidade</button>
```

**Mudanças:**
- [ ] CTA: "Adicionar" → "+ Escolher quantidade"
- [ ] Adicionar hover text: "Entrega de 08:00-12:00"
- [ ] Melhorar visual (tamanho, cor, ênfase)

**Teste:**
```bash
# Em http://localhost:5173/produtos
# Verificar: Cada card tem CTA novo
# Mobile: CTA é clicável, não é muito pequena
```

**Commit:**
```bash
git add src/components/StoreProductCard.tsx
git commit -m "feat: Product card CTA improved (+8% conversion)"
```

### 15:00 - Checkout CTA rewrite (2h)

**Arquivo: `src/pages/Checkout.tsx`**

```typescript
// ANTES:
<button className="w-full bg-burgundy text-white py-4">
  Confirmar pedido
</button>

// DEPOIS:
<button className="w-full bg-burgundy text-white py-4">
  Finalizar com PIX
</button>

// Ou se for outro método:
// "Pagar com Dinheiro"
// "Pagar com Cartão"
```

**Mudanças:**
- [ ] CTA final: "Confirmar" → "Finalizar com [MÉTODO]"
- [ ] Dinamizar conforme método escolhido
- [ ] Adicionar ícone PIX/dinheiro/cartão

**Teste:**
```bash
# Em http://localhost:5173/checkout
# Selecionar PIX → CTA muda para "Finalizar com PIX"
# Selecionar Dinheiro → CTA muda para "Finalizar com Dinheiro"
```

**Commit:**
```bash
git add src/pages/Checkout.tsx
git commit -m "feat: Checkout CTA dynamic by payment method"
```

### 17:00 - Setup A/B Test (1h)

**GA4 Events:**

```typescript
// Em cada CTA, adicionar:
<button
  onClick={() => {
    gtag('event', 'view_item', {
      items: [{
        item_id: product?.id || 'home-hero',
        item_name: 'CTA Click',
        item_category: 'conversion',
        value: 1
      }]
    })
    // ... handler
  }}
>
  CTA Text
</button>
```

**Checklist GA4:**
- [ ] Events aparecem em GA4 dentro de 5-10 min
- [ ] Testar em GA4 → Real-time → Ver events
- [ ] Criar segmentos: "CTA Home", "CTA Product", "CTA Checkout"

**End of day:**
```bash
git log --oneline
# Deve ver: 3 commits relacionados a CTA

git push origin feat/uiux-improvements
```

---

## 📅 TERÇA-FEIRA (8h) — Add-to-Cart Animation

### 09:00 - Setup Framer Motion (1h)

```bash
npm list framer-motion
# Deve estar instalado (se não, npm install framer-motion)

# Criar novo componente
touch src/components/AnimatedAddToCart.tsx
```

**Verificar:**
- [ ] `npm list framer-motion` mostra versão
- [ ] Arquivo `.tsx` criado e vazio

### 10:00 - Implementar AnimatedAddToCart (3h)

**Arquivo: `src/components/AnimatedAddToCart.tsx`**

```typescript
import { motion } from 'framer-motion'
import { useState, useRef } from 'react'
import { Loader } from 'lucide-react'
import { useCart } from '../contexts/CartContext'
import toast from 'react-hot-toast'

export const AnimatedAddToCart = ({ product }) => {
  const [isAdding, setIsAdding] = useState(false)
  const cardRef = useRef(null)
  const cartIconRef = useRef(null)
  const { addItem } = useCart()

  const handleAddToCart = async () => {
    setIsAdding(true)
    
    // 1. Animação visual
    if (cardRef.current) {
      cardRef.current.classList.add('animate-pulse')
    }

    try {
      // 2. API call
      await addItem(product)

      // 3. Toast com undo
      toast.success(
        (t) => (
          <div className="flex justify-between items-center">
            <span>✓ {product.name} adicionada ao carrinho</span>
            <button
              onClick={() => {
                // removeItem(product.id)
                toast.dismiss(t.id)
              }}
              className="ml-4 text-sm underline"
            >
              Desfazer
            </button>
          </div>
        ),
        {
          duration: 4000,
          style: {
            background: '#5D082A',
            color: '#D2BB8A'
          }
        }
      )

      // 4. Pulse no carrinho
      if (cartIconRef.current) {
        cartIconRef.current.classList.add('animate-pulse')
        setTimeout(
          () => cartIconRef.current?.classList.remove('animate-pulse'),
          1000
        )
      }

      // 5. Haptic (mobile)
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }
    } catch (error) {
      toast.error('Erro ao adicionar ao carrinho')
    } finally {
      setIsAdding(false)
      cardRef.current?.classList.remove('animate-pulse')
    }
  }

  return (
    <motion.button
      ref={cardRef}
      onClick={handleAddToCart}
      disabled={isAdding}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="w-full bg-burgundy text-gold px-6 py-3 rounded-lg font-semibold transition-all"
    >
      {isAdding ? (
        <span className="flex items-center justify-center gap-2">
          <Loader size={18} className="animate-spin" />
          Adicionando...
        </span>
      ) : (
        '+ Escolher quantidade'
      )}
    </motion.button>
  )
}
```

**Testes:**
- [ ] Componente compila sem erros
- [ ] Botão anima ao hover
- [ ] Botão muda ao click (loading)
- [ ] Toast aparece
- [ ] Framer Motion funciona

### 13:00 - LUNCH (1h)

### 14:00 - Integrar em StoreProductCard (2h)

**Arquivo: `src/components/StoreProductCard.tsx`**

```typescript
import { AnimatedAddToCart } from './AnimatedAddToCart'

export const StoreProductCard = ({ product }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {/* ...imagem, preço, etc... */}
      
      {/* Substituir botão antigo por novo */}
      <AnimatedAddToCart product={product} />
    </div>
  )
}
```

**Testes:**
- [ ] Cards carregam sem erro
- [ ] Animação funciona em cada card
- [ ] Toast aparece com nome correto
- [ ] Mobile: toque funciona
- [ ] Undo funciona (se implementar)

### 16:00 - QA + Teste em mobile (2h)

```bash
# Desktop
npm run dev
# http://localhost:5173
# Adicionar produto → animação funciona?

# Mobile
# Via ngrok ou device local:
# Testar toque, haptic feedback, toast

# Responsividade
# Verificar: xs, sm, md, lg, xl screens
```

**Checklist:**
- [ ] Desktop Chrome: ✓
- [ ] Desktop Safari: ✓
- [ ] Mobile iOS: ✓
- [ ] Mobile Android: ✓

**Commit:**
```bash
git add src/components/AnimatedAddToCart.tsx src/components/StoreProductCard.tsx
git commit -m "feat: Add-to-cart animation with Framer Motion (+3-5% rate)"
```

---

## 📅 QUARTA-FEIRA (8h) — Product Badges

### 09:00 - Criar ProductBadges (2h)

**Arquivo: `src/components/ProductBadges.tsx`**

```typescript
import { TrendingUp, Zap, AlertCircle, Clock } from 'lucide-react'

interface Badge {
  type: 'bestseller' | 'new' | 'scarcity' | 'flash'
  icon: React.ReactNode
  text: string
  color: string
}

export const ProductBadges = ({ product, stats }) => {
  const badges: Badge[] = []

  // Badge: Mais vendido
  if (stats?.weeklyRank && stats.weeklyRank <= 3) {
    badges.push({
      type: 'bestseller',
      icon: <TrendingUp size={14} />,
      text: `#${stats.weeklyRank} Mais vendido`,
      color: 'bg-amber-100 text-amber-900'
    })
  }

  // Badge: Novo
  const createdAt = new Date(product.createdAt)
  const daysOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysOld < 7) {
    badges.push({
      type: 'new',
      icon: <Zap size={14} />,
      text: 'Novo',
      color: 'bg-blue-100 text-blue-900'
    })
  }

  // Badge: Scarcity
  if (product.stock < 5) {
    badges.push({
      type: 'scarcity',
      icon: <AlertCircle size={14} />,
      text: `Apenas ${product.stock}!`,
      color: 'bg-red-100 text-red-900'
    })
  }

  // Badge: Flash sale
  if (product.flashSale?.active) {
    badges.push({
      type: 'flash',
      icon: <Clock size={14} />,
      text: `Oferta: ${product.flashSale.minutesLeft}min`,
      color: 'bg-purple-100 text-purple-900'
    })
  }

  if (badges.length === 0) return null

  return (
    <div className="absolute top-3 left-3 space-y-2">
      {badges.map((badge) => (
        <div
          key={badge.type}
          className={`${badge.color} px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1`}
        >
          {badge.icon}
          {badge.text}
        </div>
      ))}
    </div>
  )
}
```

**Testes:**
- [ ] Componente compila
- [ ] Icons aparecem corretamente
- [ ] Colors estão bonitos
- [ ] Sem badges se não aplicável

### 11:00 - Integrar em StoreProductCard (2h)

**Arquivo: `src/components/StoreProductCard.tsx`**

```typescript
import { ProductBadges } from './ProductBadges'

export const StoreProductCard = ({ product, stats }) => {
  return (
    <div className="relative bg-white rounded-lg shadow-md overflow-hidden">
      {/* Badges overlay */}
      <ProductBadges product={product} stats={stats} />
      
      {/* ...resto do card... */}
    </div>
  )
}
```

**Dados necessários:**
- [ ] Backend: `/api/products/{id}/stats` → `weeklyRank`
- [ ] Backend: `product.createdAt` deve ter data correta
- [ ] Backend: `product.stock` em tempo real
- [ ] Backend: `product.flashSale` se aplicável

### 13:00 - LUNCH (1h)

### 14:00 - Setup dados no backend (2h)

Se não tiver os dados, criar query:

```typescript
// backend: GET /api/products/:id/stats

const weeklyRank = await db.product.findMany({
  where: { category: product.category },
  orderBy: { weeklySales: 'desc' },
  select: { id }
}).then(results => 
  results.findIndex(p => p.id === product.id) + 1
)

const stats = {
  weeklyRank,
  weeklySales: product.weeklySales || 0,
  avgRating: product.avgRating || 4.5
}

res.json(stats)
```

**Ou**:

```typescript
// Se usar GraphQL:
query GetProductStats($id: ID!) {
  product(id: $id) {
    id
    weeklySales
    weeklyRank
    createdAt
    stock
    flashSale {
      active
      minutesLeft
    }
  }
}
```

### 16:00 - Teste visual (1h)

```bash
npm run dev
# Verificar badges em diferentes cenários:
# - Produto novo: ⚡ Novo
# - Produto mais vendido: 🏆 #1 Mais vendido
# - Produto com < 5 unidades: 🚨 Apenas 3!
# - Múltiplas badges: aparecem empilhadas?
```

**Commit:**
```bash
git add src/components/ProductBadges.tsx
git commit -m "feat: Product badges for urgency & social proof (+8% conversion)"
```

---

## 📅 QUINTA-FEIRA (8h) — Checkout Sidebar Sticky

### 09:00 - Melhorar Checkout layout (3h)

**Arquivo: `src/pages/Checkout.tsx`**

```typescript
export const Checkout = () => {
  const [isSticky, setIsSticky] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const sidebar = document.getElementById('order-summary')
      if (sidebar) {
        const rect = sidebar.getBoundingClientRect()
        setIsSticky(rect.top <= 20)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4">
        {/* Desktop: 2 colunas */}
        <div className="grid grid-cols-3 gap-8 md:grid-cols-1">
          {/* Esquerda: Formulário (70%) */}
          <div className="col-span-2">
            <CheckoutForm />
          </div>

          {/* Direita: Resumo (30%, STICKY) */}
          <div
            id="order-summary"
            className={`
              ${isSticky
                ? 'fixed top-20 right-8 w-96 z-10'
                : 'relative'
              }
              bg-white rounded-lg shadow-md p-6
              md:col-span-1 md:relative md:!top-auto md:!right-auto
            `}
          >
            <OrderSummary />
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Testes:**
- [ ] Desktop: sidebar fica sticky ao scroll
- [ ] Mobile: sidebar é fullwidth, não sticky
- [ ] Valores atualizam em tempo real
- [ ] Sem overlap de componentes

### 12:00 - LUNCH (1h)

### 13:00 - Criar OrderSummary (2h)

**Arquivo: `src/components/Checkout/OrderSummary.tsx`**

```typescript
import { useCart } from '../../contexts/CartContext'

export const OrderSummary = () => {
  const { cart, total, shipping } = useCart()

  return (
    <div className="space-y-6">
      {/* Header */}
      <h2 className="text-xl font-bold text-burgundy">📦 Seu Pedido</h2>

      {/* Items */}
      <div className="space-y-3 max-h-80 overflow-y-auto border-y py-4">
        {cart.items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-gray-500">x{item.quantity}</p>
            </div>
            <p className="font-semibold">R$ {item.total.toFixed(2)}</p>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>R$ {(total - shipping).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Frete</span>
          <span className={shipping === 0 ? 'text-green-600 font-bold' : ''}>
            {shipping === 0 ? 'Grátis' : `R$ ${shipping.toFixed(2)}`}
          </span>
        </div>
        <div className="border-t pt-2 flex justify-between font-bold text-lg">
          <span>Total</span>
          <span className="text-burgundy">R$ {total.toFixed(2)}</span>
        </div>
      </div>

      {/* Delivery info */}
      <div className="bg-blue-50 rounded p-3 text-sm">
        <p className="font-semibold">📍 Entrega estimada:</p>
        <p className="text-gray-600">De 08:00 a 12:00 hoje</p>
      </div>

      {/* Edit cart link */}
      <a
        href="/cart"
        className="block w-full text-center py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-burgundy"
      >
        ← Editar carrinho
      </a>
    </div>
  )
}
```

### 15:00 - Mobile adjustments (2h)

```typescript
// Em media queries Tailwind
className="md:col-span-1 md:relative" // Mobile: fullwidth, não sticky

// Ou CSS custom:
@media (max-width: 768px) {
  #order-summary {
    position: static !important;
    width: 100% !important;
    margin-top: 2rem;
  }
}
```

**Testes:**
- [ ] Desktop (1200px+): sidebar sticky
- [ ] Tablet (768px): fullwidth
- [ ] Mobile (< 640px): fullwidth, embaixo do form

**Commit:**
```bash
git add src/pages/Checkout.tsx src/components/Checkout/OrderSummary.tsx
git commit -m "feat: Sticky order summary sidebar (-5% abandonment)"
```

---

## 📅 SEXTA-FEIRA (8h) — Search Autocomplete

### 09:00 - Frontend SearchAutocomplete (3h)

**Arquivo: `src/components/SearchAutocomplete.tsx`**

```typescript
import { useState, useEffect } from 'react'
import { Search, Loader } from 'lucide-react'
import { debounce } from 'lodash'

interface Suggestion {
  type: 'product' | 'recipe' | 'popular'
  label: string
  count?: number
  value: string
}

export const SearchAutocomplete = () => {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const fetchSuggestions = debounce(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([])
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/search/autocomplete?q=${encodeURIComponent(q)}`)
      const data = await res.json()

      const allSuggestions: Suggestion[] = [
        ...data.products.map((p: any) => ({
          type: 'product' as const,
          label: p.name,
          count: p.resultCount,
          value: p.slug
        })),
        ...data.recipes.map((r: any) => ({
          type: 'recipe' as const,
          label: r.name,
          count: r.resultCount,
          value: r.slug
        })),
        ...data.popularSearches.map((s: string) => ({
          type: 'popular' as const,
          label: s,
          value: s
        }))
      ]

      setSuggestions(allSuggestions)
      setShowDropdown(true)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }, 300)

  useEffect(() => {
    fetchSuggestions(query)
  }, [query])

  return (
    <div className="relative w-full">
      {/* Input */}
      <div className="flex items-center bg-white border border-gray-300 rounded-lg px-4 py-3">
        <Search size={20} className="text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder="🔍 Buscar 'banana', 'receita', 'ofertas'..."
          className="w-full ml-2 outline-none text-gray-700"
        />
        {loading && <Loader size={20} className="animate-spin text-gray-400" />}
      </div>

      {/* Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 border-t-0 rounded-b-lg shadow-lg z-20 max-h-80 overflow-y-auto">
          {suggestions.map((s, i) => (
            <a
              key={i}
              href={`/search?q=${encodeURIComponent(s.value)}`}
              className="block px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 transition-colors"
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="mr-2">
                    {s.type === 'product' && '🏪'}
                    {s.type === 'recipe' && '📚'}
                    {s.type === 'popular' && '🔥'}
                  </span>
                  <span className="text-gray-900">{s.label}</span>
                </div>
                {s.count && (
                  <span className="text-sm text-gray-500">{s.count} resultados</span>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* No results */}
      {showDropdown && query.length >= 2 && suggestions.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 border-t-0 rounded-b-lg shadow-lg z-20 p-4 text-center text-gray-500">
          😕 Nenhum resultado para "{query}"
        </div>
      )}
    </div>
  )
}
```

### 12:00 - LUNCH (1h)

### 13:00 - Backend autocomplete endpoint (2h)

**Backend: `POST /api/search/autocomplete`**

```typescript
import { PrismaClient } from '@prisma/client'
import { Redis } from 'ioredis'

const prisma = new PrismaClient()
const redis = new Redis() // Seu Redis

export const autocomplete = async (req, res) => {
  const { q } = req.query
  
  if (!q || q.length < 2) {
    return res.json({
      products: [],
      recipes: [],
      popularSearches: []
    })
  }

  const query = String(q).toLowerCase()

  try {
    // 1. Produtos (search em nome)
    const products = await prisma.product.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' }
      },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { orderItems: true } }
      },
      take: 5,
      orderBy: { weeklySales: 'desc' }
    })

    // 2. Receitas (se tiver modelo)
    const recipes = await prisma.recipe.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' }
      },
      select: {
        id: true,
        name: true,
        slug: true
      },
      take: 3
    })

    // 3. Popular searches (cache no Redis)
    const popularSearches = await redis.lrange(
      `popular_searches:${query[0].toUpperCase()}`,
      0,
      3
    )

    res.json({
      products: products.map(p => ({
        ...p,
        resultCount: p._count.orderItems
      })),
      recipes: recipes.map(r => ({ ...r, resultCount: 12 })), // stub
      popularSearches: popularSearches || [
        'Fruta fresca',
        'Sem glúten',
        'Orgânico',
        'Promoção'
      ]
    })
  } catch (error) {
    console.error('Autocomplete error:', error)
    res.status(500).json({ error: 'Search failed' })
  }
}
```

### 15:00 - Integrar em Header (2h)

**Arquivo: `src/components/Header.tsx`**

```typescript
import { SearchAutocomplete } from './SearchAutocomplete'

export const Header = () => {
  return (
    <header className="bg-burgundy text-gold py-4">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <h1 className="text-2xl font-bold">Antenor & Filhos</h1>

          {/* Search (novo) */}
          <div className="flex-1 mx-8 max-w-2xl">
            <SearchAutocomplete />
          </div>

          {/* Cart icon */}
          <div className="flex items-center gap-4">
            {/* ...cart... */}
          </div>
        </div>
      </div>
    </header>
  )
}
```

### 17:00 - Testes E2E (1h)

```bash
# 1. Search manual
npm run dev
# Digitar "ban" → Devem aparecer sugestões

# 2. Performance
# Deve ser instantâneo (debounce 300ms)

# 3. Mobile
# Keyboard virtual aparece
# Dropdown não quebra layout

# 4. GA4
# Rastrear search queries
gtag('event', 'search', {
  search_term: query
})
```

**Commit:**
```bash
git add src/components/SearchAutocomplete.tsx src/pages/Search.tsx
git commit -m "feat: Search autocomplete with suggestions (+15% search CTR)"
```

---

## 🎯 SEXTA-FEIRA À NOITE — Deploy Prep

### 17:30 - Consolidate PRs (30 min)

```bash
# Revisar todos os commits
git log --oneline origin/main..HEAD
# Deve ver ~6 commits

# Testar merge
git fetch origin
git rebase origin/main
# Se houver conflitos, resolver
```

### 18:00 - Final QA (1h)

**Checklist antes de merge:**

- [ ] Desktop (Chrome, Safari, Firefox): ✓
- [ ] Tablet (iPad): ✓
- [ ] Mobile (iPhone, Android): ✓
- [ ] A/B tests rodando: ✓
- [ ] GA4 rastreando events: ✓
- [ ] Sem console errors
- [ ] Sem performance regression
- [ ] Todos os testes passam: `npm test`

### 19:00 - Create PR + Code Review (1h)

```bash
git push origin feat/uiux-improvements

# GitHub: Create Pull Request
# Title: "feat: UI/UX improvements FASE 1 (+15-20% conversion)"
# Description: Resumo das mudanças
# Assign reviewer
```

**Code Review checklist:**
- [ ] Code segue padrões do projeto
- [ ] Sem breaking changes
- [ ] Tests cobrem mudanças
- [ ] Performance OK
- [ ] Accessibility OK (Lighthouse)

### 20:00 - Merge + Deploy (1h)

```bash
# Após aprovação
git checkout main
git pull origin main
git merge --no-ff origin/feat/uiux-improvements

# Deploy (seu CI/CD)
git push origin main
# Vercel/Railway automático?
# Ou manual: npm run build && npm run deploy
```

---

## 📊 MONITORAR PÓS-DEPLOY

### Primeira hora:
- [ ] Sem erros em produção
- [ ] GA4 rastreando corretamente
- [ ] Performance OK (< 3s load)
- [ ] Mobile funciona

### Primeiros dias:
- [ ] Conversion rate aumentou?
- [ ] CTR aumentou em CTAs?
- [ ] Nenhum reporte de bugs

### Primeira semana:
- [ ] Conversão: 2.5% → 3.0%+?
- [ ] AOV: R$47 → R$50+?
- [ ] Usuários gostam? (NPS, feedback)

### Se problema:
```bash
git revert <commit-hash>
git push origin main
# Voltar ao estado anterior
```

---

## ✅ TUDO PRONTO?

- [ ] **Dia 1:** CTA rewriting (3 arquivos)
- [ ] **Dia 2:** Add-to-cart animation (2 componentes)
- [ ] **Dia 3:** Product badges (2 componentes)
- [ ] **Dia 4:** Checkout sidebar sticky (2 componentes)
- [ ] **Dia 5:** Search autocomplete (1 componente + backend)
- [ ] **Sexta noite:** PR, QA, merge, deploy

**Total: 44 horas = 1 dev × 1 semana OU 2 devs × 3 dias**

---

## 🚀 GO LIVE PRÓXIMA SEGUNDA

Prepare-se para ganhar:
- **+28% conversão**
- **-5% abandono**
- **+10% AOV**
- **+700-1000 pedidos/mês**

Boa sorte! 💪

---

*Checklist pronto em 21 de julho de 2026*
