# Component Inventory — shadcn/ui Migration

> Inventário completo de componentes para migração do frontend para shadcn/ui.
> Projeto: Mercado Antenor & Filhos — Stack: Vite + React 18 + TypeScript + Tailwind CSS 3.3

---

## 1. Componentes shadcn/ui Disponíveis no Admin

Componentes já instalados em `sistema/admin/src/components/ui/`:

```
button.tsx    — CVA: default, destructive, outline, secondary, ghost, link | sizes: default, sm, lg, icon
badge.tsx     — CVA: default, secondary, destructive, outline, success
card.tsx      — Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
input.tsx     — Input estilizado com design tokens
label.tsx     — Label com @radix-ui/react-label
select.tsx    — Select com native <select> + styling shadcn
checkbox.tsx  — Checkbox com @radix-ui/react-checkbox
table.tsx     — Table, TableHeader, TableBody, TableRow, TableHead, TableCell
textarea.tsx  — Textarea estilizado
```

**Infraestrutura:**
- `lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `components.json` — shadcn config (new-york style, lucide icons)
- `tailwind.config.js` — CSS variables, tailwindcss-animate, brand colors

---

## 2. Dependências Necessárias no Frontend

### Já instaladas
- `clsx` (v2.1.1)
- `tailwind-merge` (v3.5.0)
- `lucide-react`

### A instalar
```bash
cd sistema/frontend
npm install class-variance-authority @radix-ui/react-slot @radix-ui/react-label
npm install -D tailwindcss-animate
```

---

## 3. Componentes a Criar no Frontend

Copiar do admin e adaptar aliases (`@/` → `@/` com `tsconfig.json` paths):

| Componente | Origem | Adaptações |
|------------|--------|------------|
| `components/ui/button.tsx` | `admin/src/components/ui/button.tsx` | Nenhuma — idêntico |
| `components/ui/input.tsx` | `admin/src/components/ui/input.tsx` | Nenhuma |
| `components/ui/label.tsx` | `admin/src/components/ui/label.tsx` | Nenhuma |
| `components/ui/select.tsx` | `admin/src/components/ui/select.tsx` | Nenhuma |
| `components/ui/card.tsx` | `admin/src/components/ui/card.tsx` | Nenhuma |
| `components/ui/badge.tsx` | `admin/src/components/ui/badge.tsx` | Nenhuma |
| `components/ui/dialog.tsx` | `npx shadcn@latest add dialog` | Novo — para modais |
| `components/ui/alert-dialog.tsx` | `npx shadcn@latest add alert-dialog` | Novo — confirmações |
| `components/ui/skeleton.tsx` | `npx shadcn@latest add skeleton` | Novo — loading states |

---

## 4. Configuração do Frontend

### 4.1 `tailwind.config.js` — Atualizar

```js
const animate = require('tailwindcss-animate')

module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: '0.5rem',
        '2xl': '0.625rem',
        '3xl': '0.75rem',
      },
    },
  },
  plugins: [animate],
}
```

### 4.2 `src/index.css` — Adicionar CSS Variables

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 20 14.3% 4.1%;
    --card: 0 0% 100%;
    --card-foreground: 20 14.3% 4.1%;
    --popover: 0 0% 100%;
    --popover-foreground: 20 14.3% 4.1%;
    --primary: 346 72% 20%;
    --primary-foreground: 60 9.1% 97.8%;
    --secondary: 60 4.7% 90%;
    --secondary-foreground: 24 9.8% 10%;
    --muted: 60 4.8% 95.9%;
    --muted-foreground: 25 5.3% 44.7%;
    --accent: 60 4.8% 95.9%;
    --accent-foreground: 24 9.8% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 60 9.1% 97.8%;
    --border: 20 5.9% 90%;
    --input: 20 5.9% 90%;
    --ring: 346 72% 20%;
    --radius: 0.5rem;
  }
}
```

### 4.3 `src/lib/utils.ts` — Criar

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 5. Migração por Página (Prioridade)

### Fase 1 — Críticas (Checkout, Login, Register)
| Arquivo | De | Para |
|---------|-----|------|
| `Checkout.tsx` | 6 `<button>`, 14 `<input>` | `<Button>`, `<Input>`, `<Label>`, `<Card>` |
| `Login.tsx` | 1 `<button>`, 2 `<input>` | `<Button>`, `<Input>`, `<Label>`, `<Card>` |
| `Register.tsx` | 1 `<button>`, 6 `<input>`, 1 `<select>` | `<Button>`, `<Input>`, `<Select>`, `<Label>` |

### Fase 2 — Navegação e Busca
| Arquivo | De | Para |
|---------|-----|------|
| `Search.tsx` | 12 `<button>`, 1 `<input>`, 4 `<select>` | `<Button>`, `<Input>`, `<Select>`, `<Badge>` |
| `Account.tsx` | 6 `<button>`, 1 `<select>` | `<Button>`, `<Select>`, `<Card>` |
| `Cart.tsx` | 6 `<button>`, 2 `<input>` | `<Button>`, `<Input>`, `<Card>`, `<AlertDialog>` |

### Fase 3 — Produtos e Catálogo
| Arquivo | De | Para |
|---------|-----|------|
| `StoreProductCard.tsx` | 5 `<button>` | `<Button>`, `<Card>`, `<Badge>` |
| `ProductDetail.tsx` | 4 `<button>` | `<Button>`, `<Card>`, `<Badge>` |
| `WinePage.tsx` | 4 `<button>` | `<Button>`, `<Card>`, `<Badge>` |
| `Home.tsx` | 3 `<button>` | `<Button>`, `<Card>` |

### Fase 4 — Receitas e Componentes
| Arquivo | De | Para |
|---------|-----|------|
| `RecipeDetail.tsx` | 5 `<button>` | `<Button>`, `<Card>` |
| `RecipeList.tsx` | 2 `<button>` | `<Button>`, `<Card>` |
| `NotificationBell.tsx` | 2 `<button>` | `<Button>` |
| `DeliveryVerificationModal.tsx` | 7 `<button>`, 6 `<input>` | `<Button>`, `<Input>`, `<Dialog>` |
| `LoadingButton.tsx` | Substituir | `<Button>` + `Loader2` icon |
| `ErrorBoundary.tsx` | 1 `<button>` | `<Button>` |

---

## 6. Comando de Instalação shadcn/ui (Frontend)

```bash
cd sistema/frontend
npx shadcn@latest init
# Style: new-york
# Base color: neutral
# CSS variables: yes

# Instalar componentes:
npx shadcn@latest add button input label select card badge dialog alert-dialog skeleton
```

---

## 7. Pendências no Admin (17 alert())

| Arquivo | Linhas | Substituir por |
|---------|--------|---------------|
| `CategoriesManager.tsx` | 225, 285 | `toast.error()` |
| `Dashboard.tsx` | 620, 633, 846, 859, 870, 881, 892, 902, 906, 914, 925, 934 | `toast.error()` / `toast.success()` |
| `ProductsSection.tsx` | 253, 263, 274 | `toast.error()` |
