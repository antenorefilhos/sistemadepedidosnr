# ESPECIFICAÇÃO TÉCNICA — SPRINT ADMIN SEARCH, BANNERS UNIFICADOS & ENCARTES SOLIDCOM

---

## 🎯 OBJETIVOS DA SPRINT

1. **Tarefa 1 — Busca de Produtos no Admin (`findAllAdmin`)**:
   - Eliminar a busca rígida por substring contígua.
   - Implementar tokenização de busca (`"abacaxi kg"` -> `name ILIKE '%abacaxi%' AND (name ILIKE '%kg%' OR unit ILIKE '%kg%')`).
   - Implementar ordenação inteligente por relevância (produtos ativos com estoque primeiro, casamento por início do nome, seguido por ordem alfabética).

2. **Tarefa 2 — Unificação dos Gerenciadores de Banner (`storeBanners`)**:
   - Unificar as 3 entidades fragmentadas (`HeroSlide`, `PromoBanner`, `StoreBanner`) em um único módulo profissional de gestão de espaços publicitários (`StoreBanner`).
   - Suporte a slots: `hero`, `intercalado`, `categoria`, `tarja`, `popup`.
   - Upload de imagens separadas para Desktop e Mobile, agendamento por período (`startDate` / `endDate`), links configuráveis (URL, categoria, produto, busca), máscara de cor e métricas de cliques.
   - Painel Admin com abas por slot, status de agendamento e preview responsivo.
   - Compatibilidade retroativa no storefront.

3. **Tarefa 3 — Integração de Encartes/Promoções do Solidcom**:
   - Estrutura para ingestão e gestão de Encartes e Campanhas Promocionais do ERP (ex.: *"SEGUNDA DA CARNE NV"*, código 375, 18 itens, filial Nova Real com flag e-commerce).
   - Criação do modelo `PromotionCampaign` / `PromotionCampaignItem` com vigência automática.
   - Vitrines temáticas automáticas no Storefront e aplicação segura do `promotionalPrice` (com limpeza na expiração, prevenindo ofertas fantasmas).

---

## 🛠️ DETALHAMENTO TÉCNICO

### 1. BUSCA DE PRODUTOS NO ADMIN (`products.service.ts`)

#### Arquivo: `sistema/backend/src/modules/products/products.service.ts`
- **Problema Atual**:
  - `contains: search` busca a frase inteira sem tokenização.
  - `orderBy: { createdAt: 'desc' }` empurra itens relevantes antigos para páginas distantes.
- **Implementação**:
  1. Quebrar `search` em tokens limpos:
     ```typescript
     const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
     ```
  2. Gerar cláusulas `AND` para todos os tokens:
     ```typescript
     const tokenFilters: Prisma.ProductWhereInput[] = tokens.map((token) => ({
       OR: [
         { name: { contains: token, mode: 'insensitive' } },
         { alternativeDescription: { contains: token, mode: 'insensitive' } },
         { ean: { contains: token, mode: 'insensitive' } },
         { secondaryEans: { has: token } },
         { sku: { contains: token, mode: 'insensitive' } },
         { unit: { contains: token, mode: 'insensitive' } },
       ],
     }))
     andFilters.push(...tokenFilters)
     ```
  3. Ajustar ordenação quando houver busca ativa:
     - Priorizar produtos com `active: true` e `stock > 0`.
     - Ordenar por `name: 'asc'` em vez de `createdAt: 'desc'`.

---

### 2. UNIFICAÇÃO DOS BANNERS (`StoreBanner`)

#### Schema Prisma: `sistema/backend/prisma/schema.prisma`
Evoluir o modelo `StoreBanner`:
```prisma
model StoreBanner {
  id             String    @id @default(cuid())
  tenantId       String    @default("tenant_default")
  storeId        String    @default("store_default")
  name           String    // Nome interno / identificador da campanha
  slot           String    @default("hero") // hero | intercalado | category | tarja | popup
  targetCategory String?   // Código da categoria quando slot == "category"
  
  // Imagens responsivas
  desktopImageUrl String
  mobileImageUrl  String?
  
  // Conteúdo e Overlays
  title          String?
  description    String?
  badgeText      String?
  ctaLabel       String?
  overlayColor   String?   // Ex.: rgba(0,0,0,0.4) ou hex
  
  // Ações de Link
  linkType       String    @default("url") // url | category | product | search
  linkValue      String?   // URL destino, ID do produto, código da categoria ou termo
  linkTarget     String    @default("_self") // _self | _blank
  
  // Gestão Comercial & Agendamento
  sponsorName    String?   // Ex.: Ambev, Seara, Friboi
  startDate      DateTime? // Início da exibição
  endDate        DateTime? // Fim da exibição
  active         Boolean   @default(true)
  order          Int       @default(0)
  
  // Métricas
  impressionsCount Int     @default(0)
  clicksCount      Int     @default(0)
  
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([tenantId, storeId, slot, active, order])
  @@map("store_banners_cms")
}
```

#### Endpoints Backend:
- `GET /cms/store-banners/active` (Filtros: `slot`, `page`, `category`). Filtra automaticamente por `active: true` e `startDate <= now <= endDate`.
- `POST /cms/store-banners/:id/click` (Incrementa métrica de clique de forma assíncrona).
- CRUD Admin em `AdminStoreBannersController`.

#### Frontend Admin (`sistema/admin`):
- Interface consolidada de Banners com tabs:
  - *Todos*, *Carrossel Hero*, *Banners Intercalados*, *Categorias*, *Tarjas Informativas*.
- Modal de criação/edição com upload Desktop e Mobile, agendamento de datas e preview em tempo real.

---

### 3. INTEGRAÇÃO DE ENCARTES E PROMOÇÕES SOLIDCOM

#### Schema Prisma: `sistema/backend/prisma/schema.prisma`
```prisma
model PromotionCampaign {
  id              String    @id @default(cuid())
  tenantId        String    @default("tenant_default")
  storeId         String    @default("store_default")
  erpCampaignId   Int?      @unique // Ex.: 375
  name            String    // Ex.: "SEGUNDA DA CARNE NV"
  slug            String    // Ex.: "segunda-da-carne"
  type            String    @default("encarte") // encarte | tabloide | relampago
  bannerUrl       String?
  startDate       DateTime
  endDate         DateTime
  active          Boolean   @default(true)
  highlightInHome Boolean   @default(false)
  
  items           PromotionCampaignItem[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([tenantId, storeId, active, startDate, endDate])
  @@map("promotion_campaigns")
}

model PromotionCampaignItem {
  id               String            @id @default(cuid())
  campaignId       String
  campaign         PromotionCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  productId        String
  product          Product           @relation(fields: [productId], references: [id], onDelete: Cascade)
  ean              String
  regularPrice     Decimal           @db.Decimal(10, 2)
  promotionalPrice Decimal           @db.Decimal(10, 2)
  discountPercent  Decimal?          @db.Decimal(5, 2)
  order            Int               @default(0)

  @@unique([campaignId, productId])
  @@index([campaignId, order])
  @@map("promotion_campaign_items")
}
```

#### Sincronização & Regras:
- O serviço de integração consulta as campanhas do Solidcom vinculadas à filial Nova Real com flag `ecommerce = true`.
- Ao sincronizar o encarte:
  1. Cria/atualiza a campanha `PromotionCampaign` e vincula os itens correspondentes aos produtos do catálogo.
  2. Atualiza o `promotionalPrice` dos produtos no catálogo durante a vigência.
  3. No encerramento da vigência, o job limpa os `promotionalPrice` expirados do catálogo automaticamente.
- No Storefront: Vitrine de ofertas dinâmicas alimentada diretamente pelos itens da campanha ativa.

---

## 📋 CHECKLIST DE VALIDAÇÃO E ENTREGA
1. [ ] Testes unitários e de integração no backend (`npm test`).
2. [ ] Validação da busca no Admin: `"abacaxi kg"` encontra os produtos corretos na 1ª página.
3. [ ] Criação, edição, agendamento e exibição de banners no Admin e Storefront.
4. [ ] Ingestão de encartes/promoções e validação de preços promocionais.
5. [ ] Builds limpos de backend, frontend e admin.
6. [ ] Deploy na VPS e execução do `/salvar` no terminal de documentação.
