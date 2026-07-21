# 📢 Release Notes v1.1.0-alpha - Dynamic CMS & Premium UI
**Data:** 18 de Abril de 2026  
**Foco:** Gestão Visual, Upload de Mídia e Redesign de Luxo.

---

## 🌟 O que há de novo?

### 🧱 Motor de CMS (Conteúdo Gerenciável)
Introduzimos a capacidade de gerir toda a identidade visual da loja sem tocar em uma única linha de código.
- **Categorias Dinâmicas:** Banners de fundo por seção controlados via Admin.
- **Hero Slider:** Crie e edite os banners rotativos do topo com títulos, tags e links.
- **Upload de Mídia:** Sistema integrado de upload que salva arquivos diretamente no servidor (`/uploads`).

### 🍷 Adega Antenor v2 (Premium)
Refatoração completa para elevar a experiência de compra de vinhos.
- **Layout Vertical:** Fotos em proporção **1:1 (Quadradas)** no topo com informações detalhadas na parte inferior, seguindo o padrão de e-commerce de luxo.
- **Campo Origem:** Suporte nativo para bandeiras e países de origem, configuráveis por produto.

### 🎨 UI/UX Evolution
- **Glassmorphism:** Interface com efeitos de vidro fosco em todo o sistema.
- **Mobile First:** Grade de 2 colunas para melhor aproveitamento de tela em dispositivos móveis.
- **Seletor de Quantidade:** Botões interativos `[ - 1 + ]` direto no card para agilizar a compra.

---

## 🔧 Correções e Melhorias Técnicas

- **Backend:** Adicionado suporte ao `ServeStaticModule` para servir imagens enviadas.
- **Segurança:** Uploads protegidos por JWT e validação de tamanho de arquivo (5MB).
- **Estabilidade:** Implementados fallbacks automáticos na Home. Se o administrador não cadastrar banners, o sistema volta para as imagens padrão da marca.
- **Prisma:** Migração do banco para incluir tabelas de `Category` e `HeroSlide`.

---

## 🚀 Como começar?

1. Execute `npx prisma migrate dev` no backend.
2. Acesse o Admin em [localhost:3002](http://localhost:3002).
3. Vá em **Layout do Site** e comece a personalizar sua vitrine!

---
*Antenor & Filhos - Tradição e Elegância Digital.*
