# ESPECIFICAÇÃO TÉCNICA — SPRINT CORREÇÕES CRÍTICAS DE EXPERIÊNCIA, ADMIN E INTEGRAÇÃO ERP

---

## 🎯 OBJETIVOS DA SPRINT

1. **Tarefa 1 — Eliminação do Vácuo no Rodapé (Footer) Mobile e Desktop**:
   - Ajustar o padding inferior de `Footer.tsx` para `pb-14 pt-4 md:pb-6 md:pt-8`.
   - No copyright, reduzir o padding para `mt-4 pt-3 text-center text-xs`.
   - Garantir que no mobile o texto de copyright fique perfeitamente posicionado a **~12px acima da barra de navegação** (`MobileBottomNav`), sem área morta bege ou vácuo vertical.
   - Proteger a `Home.tsx` e páginas do storefront para que o layout nunca colapse quando prateleiras estiverem carregando.

2. **Tarefa 2 — Sincronização Solidcom no Admin sem Timeout / Travamento**:
   - Transformar a rota de sincronização do Solidcom (`/products/admin/sync`) em execução assíncrona em background.
   - Adicionar controle de status (`GET /products/admin/sync/status`) informando se o job está em execução e os dados do último sync.
   - No Admin (`Dashboard.tsx` / `ProductsSection.tsx`), ao clicar em "Sincronizar Solidcom", disparar o job e dar feedback imediato com polling/toast: *"Sincronização iniciada em segundo plano"*, atualizando o catálogo assim que terminar, sem travar o navegador nem sofrer timeout 504.

3. **Tarefa 3 — Distribuição Intercalada Real dos Banners no Storefront**:
   - Na `Home.tsx` (Desktop e Mobile), eliminar o amontoado de banners no topo da página.
   - Distribuir os banners do slot `intercalado` de forma equilibrada entre as prateleiras de produtos:
     - Vitrine 1 (ex: *Mais Pedidos* ou *Recompra*)
     - **Par de Banners 1** (2 banners lado a lado no desktop, empilhados no mobile)
     - Vitrine 2 (ex: *Ofertas do Dia*)
     - **Par de Banners 2**
     - Vitrine 3 (ex: *Padaria* ou *Carnes*)
     - **Par de Banners 3**
     - Demais vitrines do catálogo.

4. **Tarefa 4 — Simplificação Radical do Gerenciador de Banners (`StoreBannersManager.tsx`)**:
   - Reestruturar o modal de criação e edição de banners em **2 camadas claras**:
     - **Camada 1 — Configuração Básica (Visual e Intuitiva para leigos)**:
       - *Onde vai aparecer?*: Cards visuais grandes com ícones:
         - [Topo Principal (Hero Carousel)]
         - [Entre as Prateleiras (Intercalado)]
         - [Topo de Categoria]
         - [Tarja de Aviso / Regras]
       - *Upload das Fotos*: Upload com drag & drop, preview instantâneo e dimensões recomendadas (Desktop 1920x720 / Mobile 1080x1350 para Hero; 850x520 para Intercalado).
       - *O que acontece ao clicar?*: 3 opções diretas em rádio/botões:
         - [Abrir Produto] (com autocomplete de busca de produto)
         - [Abrir Categoria] (com dropdown das categorias oficiais)
         - [Link Externo / URL] (campo simples de link)
       - *Status*: Switch simples Liga/Desliga (Ativo / Inativo).
     - **Camada 2 — Opções Avançadas (Recolhidas em Acordeão / Opcionais)**:
       - Patrocinador / Anunciante (ex: Ambev, Seara, Friboi).
       - Agendamento de datas (Início / Fim) ou Vínculo com código de Encarte Solidcom.
       - Textos sobre a imagem (Título, Selo, Botão de Ação CTA).

5. **Tarefa 5 — Produtos Inativos no Solidcom Desativados no Catálogo (`active = false`)**:
   - **Correção no Backend (`products.service.ts:1355`)**:
     - Substituir o `active: true` hardcoded no método `applyErpProducts` por `active: item.active !== false`.
   - **Correção no Integrador (`solidcom-erp.service.ts`)**:
     - Mapear corretamente `ativo = false`, `ativo = 0`, `ativo = 'N'` para `active: false`.
   - **Rotina de Inativação**:
     - Produtos desativados no ERP Solidcom devem ter `active: false` gravado no PostgreSQL e ser excluídos do índice de busca do MeiliSearch (não aparecendo nem como "Indisponível" na vitrine da loja).
   - **Banco de Dados da VPS**:
     - Executar query para inativar o **Toddy 400g (Cód. 1466 / EAN `7894321711263`)** e outros itens desativados no ERP.

---

## 📋 CHECKLIST DE VALIDAÇÃO E ENTREGA
1. [ ] Build e testes limpos no backend (`npm test`).
2. [ ] Validação do job assíncrono de sync do Solidcom sem timeout de Nginx.
3. [ ] Validação da desativação de produtos inativos no catálogo (Toddy 400g inativo).
4. [ ] Build limpo do Admin com novo modal em 2 camadas para banners.
5. [ ] Build limpo do Storefront com banners distribuídos entre vitrines e footer sem vácuo.
6. [ ] Deploy completo na VPS Hostinger e validação visual mobile/desktop.
