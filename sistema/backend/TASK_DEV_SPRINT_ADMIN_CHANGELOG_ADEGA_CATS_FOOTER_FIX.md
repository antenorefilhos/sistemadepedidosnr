# ESPECIFICAÇÃO TÉCNICA — SPRINT ADMIN CHANGELOG, CATEGORIAS DA ADEGA & AJUSTE DO FOOTER

---

## 🎯 OBJETIVOS DA SPRINT

1. **Tarefa 1 — Versão Dinâmica e Changelog Clicável no Admin**:
   - Exibir a versão dinâmica da aplicação no rodapé/dashboard do painel Admin.
   - Tornar o badge/texto de versão clicável, abrindo um modal interativo de Changelog (`ChangelogModal.tsx`).
   - Apresentar o histórico cronológico de atualizações com badges por tipo (`feat`, `fix`, `perf`, `docs`), data e descrição clara das melhorias recentes.

2. **Tarefa 2 — Categorias/Filtros na Página da Adega ([`/adega`](https://mercado.antenorefilhos.com.br/adega))**:
   - Implementar barra de pílulas/subcategorias de vinhos na página da Adega:
     - **Todos** (54 rótulos)
     - **Tintos** (`VINHO TINTO`)
     - **Brancos** (`VINHO BRANCO`)
     - **Rosés** (`VINHO ROSE` / `ROSÉ`)
     - **Suaves** (`SUAVE`)
     - **Espumantes** (`ESPUMANTE` / `PROSECCO`)
     - **Champagne** (`CHAMPAGNE` / `CHAMPANHE`)
   - Visual luxuoso integrado à estética dark/dourada da Adega.
   - Filtro instantâneo em memória com contagem de produtos e estado vazio elegante.

3. **Tarefa 3 — Correção do Vácuo / Espaço Excessivo no Final do Rodapé (Footer)**:
   - Eliminar o espaçamento vazio excessivo no final da página (mobile e desktop).
   - Ajustar o padding inferior de `Footer.tsx` e remover paddings duplicados entre `Footer`, `MobileBottomNav` e as páginas (`Home.tsx`, `Search.tsx`, `WinePage.tsx`).

---

## 🛠️ DETALHAMENTO DE IMPLEMENTAÇÃO

### 1. VERSÃO DINÂMICA & CHANGELOG NO ADMIN

#### A. Componente do Modal: `sistema/admin/src/components/ChangelogModal.tsx`
- Modal responsivo com animação suave, overlay com backdrop-blur e lista de releases estruturada:
```typescript
export interface ChangelogRelease {
  version: string
  date: string
  title: string
  highlights: Array<{
    type: 'feat' | 'fix' | 'perf' | 'docs'
    description: string
  }>
}

export const ADMIN_CHANGELOG: ChangelogRelease[] = [
  {
    version: '1.2.5',
    date: '24/08/2026',
    title: 'Módulo de Mídia, Encartes ERP e Experiência Adega',
    highlights: [
      { type: 'feat', description: 'Unificação total dos gerenciadores em StoreBanners (Hero, Intercalado, Categorias e Tarjas).' },
      { type: 'feat', description: 'Vínculo de campanhas e encartes com o ERP Solidcom com vigência automática.' },
      { type: 'feat', description: 'Filtros por tipo de vinho na Adega (Tintos, Brancos, Rosés, Suaves, Espumantes).' },
      { type: 'fix', description: 'Busca inteligente de produtos no Admin com tokenização e ordenação por relevância.' },
      { type: 'fix', description: 'Ajuste do espaçamento inferior do rodapé no mobile e desktop.' },
    ],
  },
  {
    version: '1.2.4',
    date: '22/08/2026',
    title: 'Deduplicação Multi-EAN & Correções de Catálogo',
    highlights: [
      { type: 'fix', description: 'Fusão de 971 grupos de produtos duplicados no banco (catálogo consolidado sem duplicatas).' },
      { type: 'fix', description: 'Busca e leitor de código de barras aceitam EAN principal e secundários.' },
      { type: 'fix', description: 'Purga de categorias legadas do ERP mantendo estritamente as 17 categorias comerciais oficiais.' },
      { type: 'fix', description: 'Página da Adega carregando 54 rótulos ativos com fotos nítidas sobre fundo champagne.' },
    ],
  },
  {
    version: '1.2.3',
    date: '21/08/2026',
    title: 'Master Sprint: Storefront, Adega & Páginas Legais',
    highlights: [
      { type: 'feat', description: 'Páginas oficiais de Termos de Uso e Política de Privacidade (LGPD).' },
      { type: 'feat', description: 'Rodapé institucional completo com horários de loja e delivery, dados fiscais e métodos de pagamento.' },
      { type: 'feat', description: 'Novo visual da Adega com header glassmorphism e cards dark premium.' },
    ],
  },
]
```

#### B. Integração no Layout/Dashboard: `sistema/admin/src/pages/Dashboard.tsx`
- Inserir no rodapé da Dashboard ou na barra superior um botão/pill estilizado:
  ```tsx
  <button
    type="button"
    onClick={() => setIsChangelogOpen(true)}
    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#D2BB8A]/15 text-[#5D082A] border border-[#D2BB8A]/40 hover:bg-[#D2BB8A]/30 transition-all cursor-pointer"
    title="Ver histórico de versões e novidades"
  >
    <Sparkles size={13} className="text-[#8A6A3A]" />
    <span>v{APP_VERSION} · Novidades</span>
  </button>
  ```

---

### 2. FILTROS DE CATEGORIAS NA PÁGINA DA ADEGA ([`/adega`](https://mercado.antenorefilhos.com.br/adega))

#### Arquivo: `sistema/frontend/src/pages/WinePage.tsx`
- **Subcategorias Suportadas**:
  ```typescript
  type WineSubcategory = 'all' | 'tinto' | 'branco' | 'rose' | 'suave' | 'espumante' | 'champagne'
  
  const WINE_CATEGORIES: Array<{ key: WineSubcategory; label: string; icon?: string }> = [
    { key: 'all', label: 'Todos' },
    { key: 'tinto', label: 'Tintos' },
    { key: 'branco', label: 'Brancos' },
    { key: 'rose', label: 'Rosés' },
    { key: 'suave', label: 'Suaves' },
    { key: 'espumante', label: 'Espumantes' },
    { key: 'champagne', label: 'Champagne' },
  ]
  ```
- **Lógica de Classificação**:
  ```typescript
  const filterWineByCategory = (wine: Product, subcat: WineSubcategory): boolean => {
    if (subcat === 'all') return true
    const normalized = `${wine.name} ${wine.alternativeDescription || ''}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
    
    switch (subcat) {
      case 'tinto':
        return normalized.includes('TINTO')
      case 'branco':
        return normalized.includes('BRANCO') || normalized.includes('CHARDONNAY') || normalized.includes('SAUVIGNON BLANC')
      case 'rose':
        return normalized.includes('ROSE') || normalized.includes('ROSADO')
      case 'suave':
        return normalized.includes('SUAVE')
      case 'espumante':
        return normalized.includes('ESPUMANTE') || normalized.includes('PROSECCO') || normalized.includes('BRUT') || normalized.includes('MOSCATEL')
      case 'champagne':
        return normalized.includes('CHAMPAGNE') || normalized.includes('CHAMPANHE') || normalized.includes('CHANDON')
      default:
        return true
    }
  }
  ```
- **Barra de Pílulas Estilizada**:
  - Carrossel horizontal deslizável com visual dark luxury (`bg-[#1C1917]`, bordas douradas `border-[#D2BB8A]`, texto champagne `text-[#F3E7C9]`).
  - Contador dinâmico de rótulos por subcategoria (ex.: *Tintos (32)*, *Brancos (12)*, *Espumantes (8)*).

---

### 3. CORREÇÃO DO VÁCUO NO FOOTER (`Footer.tsx`)

#### Arquivo: `sistema/frontend/src/components/Footer.tsx`
- **Problema**:
  - `pb-28` no `footer` criava 112px de espaço vazio somado à barra de navegação mobile (`MobileBottomNav` de 64px) e paddings da página, resultando em um vácuo excessivo abaixo do copyright.
- **Ajuste**:
  - Alterar o container principal do `Footer.tsx` para:
    ```tsx
    <footer className="border-t border-[#E8D7B0]/60 bg-[#FBF7F0] pb-20 md:pb-6 text-[#5d4f33]">
    ```
  - Reduzir margens verticais internas desnecessárias (`py-8 md:py-10`, `mt-4 pt-4` no copyright).
  - Garantir que a barra de navegação mobile sobreponha exatamente o safe-area sem deixar lacuna bege vazia.

---

## 📋 CHECKLIST DE VALIDAÇÃO
1. [ ] Build limpo do Admin (`cd sistema/admin && npm run build`).
2. [ ] Validação do botão de versão e abertura do modal de Changelog com histórico legível.
3. [ ] Build limpo do Frontend (`cd sistema/frontend && npm run build`).
4. [ ] Validação da página `/adega`: navegação fluida entre Tintos, Brancos, Rosés, Suaves e Espumantes.
5. [ ] Validação do Footer no mobile e desktop: proporções equilibradas e fim do vácuo visual.
6. [ ] Deploy na VPS e sincronização no Vault Obsidian via `/salvar`.
