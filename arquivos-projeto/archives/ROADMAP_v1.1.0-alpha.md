# 🚀 Roadmap v1.1.0-alpha - CMS Dinâmico & UI Premium

**Status:** 🔄 Em desenvolvimento  
**Data Início:** 18 de Abril de 2026  
**Versão Alvo:** 1.1.0-alpha

---

## 🎯 Objetivo

Transformar a vitrine estática em um ecossistema totalmente gerenciável, elevando a experiência visual para o padrão "Empório de Elite" (Antenor & Filhos).

---

## 📋 Tasks

### Task 1: UI/UX Premium (Concluído)
- [x] Rebranding global para "Antenor & Filhos"
- [x] Implementação de Glassmorphism (efeitos vítreos)
- [x] Layout de 2 colunas para mobile
- [x] Seletor de quantidade `[ - 1 + ]` interativo
- [x] Otimização de fontes (xs/sm) para legibilidade mobile
- [x] Adega: Foto 1:1 com informações abaixo (Layout Vertical Premium)
- [x] Adega: Seleção de Origem (Bandeira/Emoji) configurável por produto

### Task 2: Backend — Infraestrutura CMS (Concluído)
- [x] Criar modelo Prisma `Category` (visualTitle, bannerPath, active)
- [x] Criar modelo Prisma `HeroSlide` (title, tag, imagePath, active)
- [x] Configurar `@nestjs/platform-express` para uploads via Multer
- [x] Configurar `@nestjs/serve-static` para servir a pasta `/uploads`

### Task 3: Admin — Gestão de Vitrine (Concluído)
- [x] Nova aba de "Layout do Site" no Dashboard
- [x] Form para upload de banners e edição de textos das seções
- [x] Gerenciamento do Slider do Topo (Hero Slider)

### Task 4: Storefront — Consumo de CMS (Concluído)
- [x] Refatorar `Home.tsx` para carregar seções dinamicamente do banco
- [x] Implementar máscaras de gradiente dinâmicas por cima das fotos enviadas pelo Admin

---

## 🏁 Critérios de conclusão (v1.1.0)
- [x] Admin consegue trocar a foto do banner de "Churrasco" sem mexer no código.
- [x] Admin consegue desativar/ativar seções na Home.
- [x] Home carrega imagens via API (uploads/) em vez de public/banners/.
