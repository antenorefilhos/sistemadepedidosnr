# Design Spec — Mercado Antenor & Filhos

> Plataforma de pedidos/e-commerce. Stack: **Vite + React 18 + TypeScript + Tailwind CSS 3.3**.
> UI Kit: **shadcn/ui** (estilo `new-york`, base color `neutral`).

---

## 1. Design Tokens

### 1.1 Cores da Marca

| Token | Hex | Uso |
|-------|-----|-----|
| `--brand-burgundy` | `#5D082A` | Cor primária, botões CTA, sidebar, títulos |
| `--brand-gold` | `#D2BB8A` | Acentos, badges premium, destaques |
| `--brand-onyx` | `#231F20` | Texto principal, fundo escuro |
| `--brand-cream` | `#F5F5F0` | Fundo claro, cards |

### 1.2 Tokens shadcn/ui (CSS Variables em HSL)

| Token | Valor Light | Uso |
|-------|-------------|-----|
| `--background` | `0 0% 100%` | Fundo da página |
| `--foreground` | `20 14.3% 4.1%` | Texto principal |
| `--card` | `0 0% 100%` | Fundo de cards |
| `--card-foreground` | `20 14.3% 4.1%` | Texto em cards |
| `--primary` | `346 72% 20%` | Cor primária (burgundy) |
| `--primary-foreground` | `60 9.1% 97.8%` | Texto sobre primária |
| `--secondary` | `60 4.7% 90%` | Fundo secundário |
| `--secondary-foreground` | `24 9.8% 10%` | Texto secundário |
| `--muted` | `60 4.8% 95.9%` | Fundo muted |
| `--muted-foreground` | `25 5.3% 44.7%` | Texto muted |
| `--accent` | `60 4.8% 95.9%` | Fundo accent |
| `--accent-foreground` | `24 9.8% 10%` | Texto accent |
| `--destructive` | `0 84.2% 60.2%` | Erro, ações destrutivas |
| `--destructive-foreground` | `60 9.1% 97.8%` | Texto sobre destructive |
| `--border` | `20 5.9% 90%` | Bordas |
| `--input` | `20 5.9% 90%` | Bordas de input |
| `--ring` | `346 72% 20%` | Focus ring (burgundy) |
| `--radius` | `0.5rem` | Border radius base |

### 1.3 Tipografia

| Nível | Tamanho | Peso | Uso |
|-------|---------|------|-----|
| `h1` | `text-2xl` (24px) | `font-bold` | Títulos de página |
| `h2` | `text-xl` (20px) | `font-semibold` | Seções |
| `h3` | `text-lg` (18px) | `font-semibold` | Subseções |
| `body` | `text-sm` (14px) | `font-normal` | Texto corpo |
| `caption` | `text-xs` (12px) | `font-normal` | Legendas, metadados |
| `button` | `text-sm` (14px) | `font-semibold` | Botões |

Fonte: **Google Sans Flex** / **Roboto** (fallback).

### 1.4 Espaçamento

Base: **4px** (`0.25rem`). Escala: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.

| Contexto | Valor |
|----------|-------|
| Gap entre elementos de formulário | `space-y-4` (16px) |
| Padding de card | `p-6` (24px) |
| Padding de seção | `p-4` a `p-6` (16-24px) |
| Gap de grid de produtos | `gap-4` a `gap-6` (16-24px) |

---

## 2. Componentes shadcn/ui — Mapeamento

### 2.1 Admin (já instalados — 9 componentes)

| Componente | Arquivo | Status |
|------------|---------|--------|
| Button | `admin/src/components/ui/button.tsx` | Pronto |
| Badge | `admin/src/components/ui/badge.tsx` | Pronto |
| Card | `admin/src/components/ui/card.tsx` | Pronto |
| Input | `admin/src/components/ui/input.tsx` | Pronto |
| Label | `admin/src/components/ui/label.tsx` | Pronto |
| Select | `admin/src/components/ui/select.tsx` | Pronto |
| Checkbox | `admin/src/components/ui/checkbox.tsx` | Pronto |
| Table | `admin/src/components/ui/table.tsx` | Pronto |
| Textarea | `admin/src/components/ui/textarea.tsx` | Pronto |

### 2.2 Frontend (a instalar — componentes mínimos)

| shadcn/ui | Substitui | Páginas |
|-----------|-----------|---------|
| Button | `<button>` (66 ocorrências) | Todas |
| Input | `<input>` (31 ocorrências) | Checkout, Cart, Login, Register, Search |
| Label | `<label>` inline | Checkout, Login, Register |
| Select | `<select>` (6 ocorrências) | Search, Account, Register |
| Card | Containers inline com Tailwind | ProductDetail, Home, Cart |
| Badge | Badges manuais | ProductCard, Search |
| Dialog | `window.confirm` / modais customizados | Cart, Account |

### 2.3 Componentes Adicionais Recomendados

| Componente | Uso |
|------------|-----|
| AlertDialog | Confirmações destrutivas (remover item do carrinho) |
| Sheet | Menu lateral mobile, filtros de busca |
| Skeleton | Estados de loading (substituir `Skeleton.tsx` customizado) |
| Toast | Notificações (substituir `react-hot-toast` por shadcn toast) |
| Separator | Divisórias entre seções |

---

## 3. Páginas do Frontend — Inventário

| Página | Elementos nativos | Componentes shadcn necessários |
|--------|-------------------|-------------------------------|
| Checkout.tsx | 20 (6 button, 14 input) | Button, Input, Label, Card |
| Search.tsx | 17 (12 button, 1 input, 4 select) | Button, Input, Select, Badge |
| DeliveryVerificationModal.tsx | 13 (7 button, 6 input) | Button, Input, Dialog |
| Cart.tsx | 8 (6 button, 2 input) | Button, Input, Card, AlertDialog |
| Register.tsx | 8 (1 button, 6 input, 1 select) | Button, Input, Select, Label |
| Account.tsx | 7 (6 button, 1 select) | Button, Select, Card |
| StoreProductCard.tsx | 5 (5 button) | Button, Card, Badge |
| RecipeDetail.tsx | 5 (5 button) | Button, Card |
| ProductDetail.tsx | 4 (4 button) | Button, Card, Badge |
| WinePage.tsx | 4 (4 button) | Button, Card, Badge |
| Home.tsx | 3 (3 button) | Button, Card |
| Login.tsx | 3 (1 button, 2 input) | Button, Input, Label, Card |
| NotificationBell.tsx | 2 (2 button) | Button |
| RecipeList.tsx | 2 (2 button) | Button, Card |
| LoadingButton.tsx | 1 (1 button) | Substituir por Button + Loader2 |
| ErrorBoundary.tsx | 1 (1 button) | Button |

---

## 4. Responsividade

| Breakpoint | Largura | Comportamento |
|------------|---------|---------------|
| Mobile | `< 640px` | Layout coluna, sidebar fechada, cards stacked |
| Tablet | `640px - 1024px` | 2 colunas grid produtos, sidebar overlay |
| Desktop | `> 1024px` | 3-4 colunas grid, sidebar fixa |

---

## 5. Acessibilidade

- Todas as cores devem ter contraste mínimo **WCAG AA** (4.5:1 para texto normal)
- Focus rings visíveis (`ring-2 ring-ring ring-offset-2`)
- Labels associados a inputs via `htmlFor`
- `aria-label` em botões sem texto (ícones)
- Suporte a `prefers-reduced-motion`
- Navegação por teclado em todos os componentes interativos

---

## 6. Dark Mode

Preparado (CSS variables prontas no admin), mas **não implementado** no frontend.
O admin já tem `darkMode: ["class"]` no tailwind config.
O frontend precisará adicionar `darkMode: ["class"]` e as variáveis CSS dark.
