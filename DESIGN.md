---
name: Mercado Antenor & Filhos
description: E-commerce e gestão de pedidos do supermercado premium Antenor & Filhos
colors:
  burgundy: "#5D082A"
  burgundy-deep: "#4A0621"
  gold: "#D2BB8A"
  gold-deep: "#C1A978"
  sand: "#E8D7B0"
  cream: "#F5F5F0"
  cream-light: "#F8F4EA"
  onyx: "#231F20"
  bark: "#5D4F33"
  tobacco: "#8A6A3A"
typography:
  display:
    fontFamily: "Source Sans 3, Segoe UI, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Source Sans 3, Segoe UI, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "Source Sans 3, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Source Sans 3, Segoe UI, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Source Sans 3, Segoe UI, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.35
  label:
    fontFamily: "Source Sans 3, Segoe UI, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 600
    letterSpacing: "0.04em"
rounded:
  md: "6px"
  lg: "8px"
  xl: "8px"
  2xl: "10px"
  3xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.burgundy}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.burgundy-deep}"
  button-secondary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.onyx}"
    rounded: "{rounded.md}"
    height: "40px"
  button-outline:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.burgundy}"
    rounded: "{rounded.md}"
    height: "40px"
  button-subtle:
    backgroundColor: "{colors.cream-light}"
    textColor: "{colors.burgundy}"
    rounded: "{rounded.md}"
    height: "40px"
  input:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.onyx}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
  card:
    backgroundColor: "#FFFFFF"
    rounded: "{rounded.lg}"
---

# Design System: Mercado Antenor & Filhos

## 1. Overview

**Creative North Star: "O Armazém de Tradição Premium"**

O sistema combina a confiança de um empório de bairro com a velocidade que a compra da semana exige. A tradição familiar é o pano de fundo — bordo, dourado e creme, materiais quentes —, mas ela nunca cobra pedágio da tarefa: o cliente veio resolver a compra, não admirar a interface. Quando o aconchego e a eficiência entram em conflito, a eficiência vence nas superfícies de tarefa (Mercado, Produto, Carrinho, Checkout) e o aconchego lidera nas superfícies de desejo (Home, Adega).

A paleta é **Restrained**: neutros quentes cobrem quase toda a tela e o bordo aparece com parcimônia, reservado a ação primária, preço e seleção. O dourado não é decoração espalhada — é selo, borda e acento de curadoria. O produto (a foto, o preço, o peso) é o elemento mais chamativo de qualquer tela; a interface recua.

Este sistema rejeita explicitamente o visual de painel SaaS genérico, o encarte promocional barulhento e a estética de ferramenta técnica. Nenhum desses vende comida.

**Key Characteristics:**
- Neutros quentes dominantes, bordo escasso e intencional
- Densidade confortável: alvos generosos, mas sem desperdício de tela no mobile
- Preço como elemento tipográfico mais pesado do card
- Contornos finos no lugar de sombras pesadas
- Uma única família tipográfica em múltiplos pesos

## 2. Colors

Uma paleta de empório: bordo profundo como voz de marca, dourado como curadoria e uma família de neutros quentes que evita o cinza corporativo.

### Primary
- **Bordo Tradicional** (`#5D082A`): a voz da marca. Botão de ação primária, preço, seleção ativa, header da loja e ícones de estado. Nunca usado como fundo de área extensa nas telas de tarefa.
- **Bordo Profundo** (`#4A0621`): exclusivamente o estado hover/active do bordo. Não usar como cor de superfície.

### Secondary
- **Dourado Premium** (`#D2BB8A`): curadoria e limite. Bordas de card e campo, selos, botão secundário e anel de foco. É o que dá a assinatura de "empório" sem gritar.
- **Dourado Profundo** (`#C1A978`): hover do botão secundário.
- **Areia** (`#E8D7B0`): a borda de trabalho do sistema, quase sempre com transparência (`/40`–`/70`). Divisórias e contornos de card.

### Neutral
- **Ônix** (`#231F20`): texto principal e superfície escura (header da Adega, cards `dark`). Preto quente, nunca `#000`.
- **Creme** (`#F5F5F0`): fundo neutro de áreas de conteúdo.
- **Creme Claro** (`#F8F4EA`): estado hover de botões fantasma e superfícies sutis. O tom que substitui o "cinza claro" de sistemas genéricos.
- **Casca** (`#5D4F33`): texto secundário sobre fundos quentes. Substitui o cinza para não lavar sobre creme.
- **Tabaco** (`#8A6A3A`): rótulos pequenos, eyebrow de vitrine e placeholder de campo.

### Named Rules

**The Burgundy Rule.** O bordo é o tom de voz principal e nunca é diluído em variações pastel desbotadas. Se uma tela tem mais de três elementos em bordo, dois estão errados.

**The No-Gray Rule.** Texto secundário sobre fundo quente usa Casca (`#5D4F33`) ou Tabaco (`#8A6A3A`), nunca um cinza neutro. Cinza sobre creme lava e é o tell nº 1 de interface genérica.

## 3. Typography

**Display Font:** Source Sans 3 (com fallback Segoe UI, system-ui, sans-serif)
**Body Font:** Source Sans 3 (mesma família, pesos distintos)

**Character:** uma única sans humanista carrega tudo — títulos, rótulos, preço e dados. Produto não precisa de par tipográfico; precisa de hierarquia previsível. O peso, não a família, faz o trabalho de contraste. A Source Sans 3 foi escolhida por sustentar bem os 10–13px onde vivem rótulos e nomes de produto, e por ter numerais lining fortes — o preço é o elemento mais pesado de cada card.

Carregada como **fonte variável** (`wght@400..900`), então `font-semibold` (600) e `font-black` (900) têm peso real, sem negrito sintetizado pelo navegador.

### Hierarchy
- **Display** (700, 30px / 1.875rem, 1.2, -0.02em): título de página e preço em destaque na PDP.
- **Headline** (700, 20px / 1.25rem, 1.3): título de vitrine no desktop.
- **Title** (600, 16px / 1rem, 1.4): título de vitrine no mobile e cabeçalho de card.
- **Body** (400, 14px / 0.875rem, 1.5): texto padrão, nome de produto e dados. Prosa longa limitada a 65–75ch.
- **Caption** (400, 12px / 0.75rem, 1.35): metadados, texto de apoio e preço de referência. É o degrau mais usado da interface.
- **Label** (600, 10px / 0.625rem, 0.04em, caixa alta): eyebrow de vitrine e selos.

Os seis degraus vivem em `tailwind.config.js` como `text-label` … `text-display`, todos em `rem`. Razão ~1.2 na ponta pequena (10-12-14-16), ~1.25–1.5 no topo.

### Named Rules

**The Price-Is-Loudest Rule.** Em qualquer card de produto, o preço é o elemento tipográfico mais pesado (≈29px, peso 700). Nome do produto e rótulos jamais competem com ele.

**The Tight-Tracking Rule.** Rótulo em caixa alta nunca passa de `0.04em` de tracking. Acima disso a palavra esparrama e quebra em duas linhas — foi exatamente o defeito corrigido em "PORÇÃO MÍNIMA DE 800 G".

## 4. Elevation

Profundidade vem de **tom e contorno**, não de sombra. Superfícies se distinguem por camadas de neutro quente (branco sobre creme, creme sobre branco) e por bordas finas em Areia ou Dourado. A sombra é reservada a elementos que realmente flutuam acima do documento — modais e overlays — e a respostas de estado passageiras.

> **Estado real do código:** os componentes ainda carregam `shadow-sm` em repouso (`surface.ts`, cards) e sobem para `shadow-md` no hover, e os tokens `--shadow-sm/md/lg` existem em `:root`. A doutrina acima é a direção decidida; a migração para camadas tonais ainda não foi feita. Tratar como dívida visual conhecida, não como estado atual.

### Shadow Vocabulary
- **Sombra de repouso** (`0 1px 2px rgba(0,0,0,0.05)`): quase imperceptível; em migração para borda tonal.
- **Sombra de estado** (`0 4px 6px rgba(0,0,0,0.06)`): resposta a hover em superfícies interativas.
- **Sombra de marca** (`0 10px 20px rgba(93,8,42,0.08)`): tingida de bordo, não de preto. Reservada a cards em destaque e modais.

### Named Rules

**The Tonal-First Rule.** Antes de alcançar uma sombra, tente uma camada de tom ou uma borda de 1px. Sombra que não responde a um estado é decoração e está proibida.

**The Warm-Shadow Rule.** Quando houver sombra ampla, ela é tingida de bordo (`rgba(93,8,42,…)`), nunca preto puro. Preto sobre creme suja.

## 5. Components

Os componentes são **refinados e discretos**: contorno fino, contraste contido, presença mínima. O produto é o protagonista; a interface recua para o segundo plano.

### Buttons
- **Shape:** cantos suavemente arredondados (6px, `rounded-md`); pílula (`rounded-full`) apenas no par Unidade/Peso do card.
- **Primary:** fundo Bordo com texto branco, altura 40px (`md`), padding lateral 16px.
- **Hover / Focus:** hover escurece para Bordo Profundo; foco usa anel de 2px com offset de 2px. Toque responde com `active:scale(0.98)`.
- **Secondary / Outline / Ghost / Subtle:** Secondary é Dourado sobre Ônix; Outline é branco com borda Dourada e texto Bordo; Ghost é só texto Bordo com hover Creme Claro; Subtle é fundo Creme Claro com texto Bordo.
- **Sizes:** `sm` 32px, `md` 40px (padrão), `lg` 48px, `icon` 36×36.

### Cards / Containers
- **Corner Style:** 8px (`rounded-lg`).
- **Background:** branco puro; Ônix na variante escura (Adega).
- **Shadow Strategy:** ver Elevation — alvo é borda tonal, não sombra.
- **Border:** 1px em Areia com transparência (`/70` padrão, `/40` em divisórias).
- **Internal Padding:** 12px no card de produto, 16–24px em painéis.

### Inputs / Fields
- **Style:** altura 40px, cantos 6px, borda Dourada a 70%, fundo branco, texto 14px em Ônix.
- **Focus:** anel de 2px em Dourado, sem outline nativo.
- **Placeholder:** Tabaco a 60% — nunca cinza claro.
- **Mobile:** `font-size: 16px !important` em todo input, select e textarea. É deliberado: abaixo de 16px o iOS dá zoom automático ao focar o campo e quebra o checkout.

### Product Card (componente-assinatura)
Imagem quadrada no topo, botão "+" flutuante no canto inferior direito, nome logo abaixo da imagem e preço ancorado no rodapé. A folga sobra **entre** nome e preço, nunca em volta do nome. Cards de uma mesma linha têm altura idêntica por `align-items: stretch` — nunca por `min-height` fixo em cada bloco interno.

### Product Shelf (componente-assinatura)
Vitrine com eyebrow, título com ícone e link "ver mais". Dois layouts: `carousel` (rolagem horizontal com auto-scroll, mobile) e `grid` (duas colunas, desktop). Não renderiza nada quando a lista está vazia.

## 6. Do's and Don'ts

### Do:
- **Do** usar Bordo (`#5D082A`) em ação primária, preço e seleção — e em mais nada.
- **Do** manter contraste mínimo de 4.5:1 em texto corpo e 3:1 em texto grande (meta WCAG 2.1 AA do PRODUCT.md).
- **Do** ancorar o preço no rodapé do card com `mt-auto` e deixar a folga cair entre nome e preço.
- **Do** usar Casca ou Tabaco para texto secundário sobre fundos quentes.
- **Do** manter `font-size: 16px` em campos de formulário no mobile, para não disparar zoom no iOS.
- **Do** deixar o card esticar por `align-items: stretch` para igualar alturas.

### Don't:
- **Don't** usar bordas coloridas espessas em apenas um dos lados dos cards (side-stripes).
- **Don't** aplicar gradientes sobrepostos em textos ou títulos Display.
- **Don't** utilizar sombras exageradas ou cores neon descontextualizadas da paleta tradicional da marca.
- **Don't** produzir layouts genéricos de SaaS — cinzas claros desbotados, sombras exageradas ou gradientes artificiais no texto.
- **Don't** produzir telas de encarte promocional poluídas, cheias e barulhentas.
- **Don't** deixar a interface parecer painel de controle de backend ou banco de dados cru.
- **Don't** usar `min-height` fixo em blocos internos do card para forçar alinhamento: isso cria vazio no meio e foi a causa do "texto boiando" corrigido no ProductCard.
- **Don't** aplicar `h-full` num item de flex/grid esperando alturas iguais — um `height` explícito desativa o `stretch` e produz cards irregulares.
- **Don't** declarar famílias tipográficas que não são carregadas, nem aplicar classes de fonte inexistentes. Foi o caso de *Google Sans Flex* (declarada mas nunca importada) e de `font-outfit` (aplicada em 7 arquivos sem existir no theme) — ambos removidos.
- **Don't** escrever tamanho de fonte literal (`text-[11px]`, `text-[1.82rem]`). Use os degraus `text-label` … `text-display`. Literais em `px` ignoram a preferência de tamanho de fonte do usuário e embolam a hierarquia.
