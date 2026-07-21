---
name: Mercado Antenor & Filhos
description: E-commerce e Gestão de Pedidos do Supermercado Premium Antenor & Filhos
colors:
  primary: "#5D082A"
  secondary: "#D2BB8A"
  neutral-fg: "#231F20"
  neutral-bg: "#F5F5F0"
typography:
  display:
    fontFamily: "Google Sans Flex, Roboto, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Google Sans Flex, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "8px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 20px"
---

# Design System: Mercado Antenor & Filhos

## 1. Overview

**Creative North Star: "O Armazém de Tradição Premium"**

O Mercado Antenor & Filhos combina a sensação acolhedora e confiável de uma feira ou empório tradicional com a sofisticação e conveniência de um e-commerce premium. A interface evita a frieza dos painéis SaaS corporativos, buscando cores ricas e tipografia convidativa.

**Key Characteristics:**
- Acolhimento familiar e foco no frescor.
- Uso de tons quentes e ricos (Burgundy e Gold).
- Layout limpo, legível e livre de poluição visual.

## 2. Colors

O esquema de cores é centrado no Burgundy tradicional e no Gold premium para transmitir sofisticação e tradição familiar.

### Primary
- **Burgundy Tradicional** (#5D082A): Utilizado para botões de CTA, links principais e destaques que exigem foco e autoridade de marca.

### Secondary
- **Gold Premium** (#D2BB8A): Utilizado em selos especiais, categorias destacadas e badges de curadoria.

### Neutral
- **Onyx Principal** (#231F20): A cor de texto primária para legibilidade excelente.
- **Cream Suave** (#F5F5F0): Fundo de cards e áreas de conteúdo claro para criar calor visual.

**The Burgundy Rule.** A cor primária (#5D082A) é o tom de voz principal; não a dilua com variações pastel desbotadas.

## 3. Typography

**Display Font:** Google Sans Flex (com fallback para Roboto)
**Body Font:** Google Sans Flex (com fallback para Roboto)

A tipografia prioriza legibilidade clara e uma escala bem definida para facilitar as compras e a conferência de itens no painel.

### Hierarchy
- **Display** (700, clamp(2rem, 5vw, 3rem), 1.2): Utilizado em títulos grandes de páginas e banners principais.
- **Headline** (600, 20px, 1.3): Títulos de seções de produtos ou categorias.
- **Title** (600, 18px, 1.4): Títulos de cards e modais.
- **Body** (400, 14px, 1.5): Texto padrão para descrições, preços e informações detalhadas.
- **Label** (600, 12px, normal, uppercase): Utilizado em badges e cabeçalhos de tabela.

## 4. Elevation

O sistema utiliza sombras sutis e camadas tonais para criar profundidade física nos elementos, imitando o empilhamento de caixas ou produtos.

### Shadow Vocabulary
- **Card Shadow** (0 2px 8px rgba(35,31,32,0.05)): Utilizado em cartões de produto para separá-los do fundo neutro.
- **Modal Shadow** (0 10px 25px rgba(35,31,32,0.15)): Utilizado em modais de checkout e diálogos importantes.

## 5. Components

### Buttons
- **Shape:** Arredondado suave (8px / md).
- **Primary:** Burgundy (#5D082A) com texto branco.
- **Hover:** Transição suave para um tom ligeiramente mais escuro.

### Cards / Containers
- **Corner Style:** 8px (md) de raio de borda.
- **Background:** Cream Suave (#F5F5F0) ou Branco puro (#ffffff).

### Inputs / Fields
- **Style:** Bordas de 1px (#e5e5e0), fundo branco, cantos com 8px.
- **Focus:** Contorno Burgundy suave.

## 6. Do's and Don'ts

### Do:
- **Do** usar a cor Burgundy em botões de ação principal para direcionar a jornada do usuário.
- **Do** manter o contraste mínimo de 4.5:1 em todos os textos para garantir total legibilidade no mobile.

### Don't:
- **Don't** utilizar bordas coloridas espessas em apenas um dos lados dos cards (side-stripes).
- **Don't** aplicar gradientes sobrepostos em textos ou títulos Display.
- **Don't** utilizar sombras exageradas ou cores neon descontextualizadas da paleta tradicional da marca.
