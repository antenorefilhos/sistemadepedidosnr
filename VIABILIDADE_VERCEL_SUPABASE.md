# 🔍 Viabilidade: Vercel + Supabase Free Tier

**Data:** 21 de julho de 2026  
**Versão:** 1.24.150-alpha  
**Conclusão:** ⚠️ **NÃO RECOMENDADO — Limitações críticas impedem uso em produção**

---

## 1. RESPOSTA DIRETA

### ❌ NÃO, não é viável para este sistema em produção.

**Razão síntese:**
1. **Redis é obrigatório** — Supabase free não oferece Redis
2. **MeiliSearch precisa de host próprio** — Supabase não suporta
3. **NestJS backend precisa de persistência** — Vercel Functions tem timeout de 10s
4. **Webhook de integrações** — Requer background jobs (não suportado em free tier)
5. **Limite de requisições** — Supabase free: 50k/mês (este projeto precisa de mais)

---

## 2. ANÁLISE DETALHADA POR COMPONENTE

### 2.1 BACKEND (NestJS)

| Requisito | Vercel Free | Viável? | Motivo |
|-----------|-------------|--------|--------|
| **Node.js Runtime** | ✅ Sim | ✅ | Suporta Node 18+ |
| **Timeout de função** | 🔴 10s | ❌ | OMS/checkout levam 2-5s; jobs background não rodam |
| **Environment vars** | ✅ Sim | ✅ | Suporta (limitado) |
| **Cold start** | 🟡 ~1s | 🟡 | Aceitável, mas impacta UX em pickup|

**Problema crítico:** Vercel Functions é serverless com timeout de 10 segundos. Seu backend tem:
- Sincronização Solidcom (pode levar 30-60s em pico)
- Processamento de imagens com Sharp (pode levar 5-10s)
- Relatórios BI (queries pesadas 15-30s)
- **Background jobs são IMPOSSÍVEIS** (web-push, email, reconciliação de pagamento)

**Solução alternativa (não free):** Render.com, Railway, Heroku (pago).

---

### 2.2 BANCO DE DADOS (PostgreSQL)

| Requisito | Supabase Free | Viável? | Motivo |
|-----------|---|--|--|
| **PostgreSQL 15** | ✅ Sim | ✅ | Suporta versão atual |
| **Storage** | 🟢 500MB | ❌ | Catálogo 2.633 produtos + dados transacionais > 500MB em 2-3 meses |
| **Conexões simultâneas** | 🟡 20 | ❌ | Sistema precisa de 50+; 20 é muito pouco para staging |
| **Backup automático** | ✅ Sim | ✅ | Diário |
| **SSL/TLS** | ✅ Sim | ✅ | Obrigatório |

**Cálculo de crescimento:**
```
Base inicial: 2.633 produtos × 10KB/produto = 26MB
+ Pedidos (10 pedidos/dia × 1KB) = 10KB/dia
+ Logs/auditoria = 500KB/dia
+ Imagens em DB (se armazenadas) = 50MB/mês

30 dias: 26MB + 15MB + 50MB = ~91MB ✅ (cabe)
90 dias: 26MB + 45MB + 150MB = ~221MB ✅ (cabe)
180 dias: 26MB + 90MB + 300MB = ~416MB ✅ (cabe)
360 dias: 26MB + 180MB + 600MB = ~806MB ❌ (ultrapassa!)
```

**Problema:** Ultrapassa 500MB em ~10 meses com uso realista.

---

### 2.3 REDIS (Cache & Sessions)

| Requisito | Supabase Free | Vercel Free | Viável? |
|-----------|---|---|--|
| **Redis managed** | ❌ Não oferece | ❌ Não oferece | ❌ NÃO EXISTE EM FREE TIER |
| **Session store** | ❌ Alternativa? | ❌ Memory (perdido em redeploy) | ❌ CRÍTICO |
| **Cart cache** | ❌ Não funciona | ❌ Memory (volátil) | ❌ CRÍTICO |
| **Rate-limit counter** | ❌ Não possível | ❌ Memory | ❌ CRÍTICO |

**Por que Redis é obrigatório neste projeto:**
```typescript
// CartContext em storefront persiste em:
- localStorage (cliente)
- Redis (servidor, para sincronização)

// Sem Redis:
- Trocar de aba = carrinho não sincroniza
- Reload = carrinho pode ser perdido (se localStorage limpo)
- Rate-limit falha (contador em memory, perdido em redeploy)
- Session TTL não funciona
```

**Alternativas de Redis gratuitas:**
- Upstash (free: 10k comandos/dia) — PODE FUNCIONAR com racionamento
- Redis Cloud (free: 30MB) — TOO SMALL

---

### 2.4 MEILISEARCH (Busca full-text)

| Requisito | Supabase Free | Vercel Free | Viável? |
|-----------|---|---|--|
| **MeiliSearch managed** | ❌ Não | ❌ Não | ❌ NÃO OFERECIDO |
| **Self-hosted MeiliSearch** | ❌ (custa) | ❌ (custa) | ❌ IMPOSSÍVEL |
| **Fallback a PostgreSQL full-text** | ✅ Sim | ✅ Sim | 🟡 DEGRADADO |

**Impacto sem MeiliSearch:**
```
Hoje (com MeiliSearch):
- Busca: "banana prata 500g" → < 100ms
- Filtro categoria + preço → < 200ms
- Relevância: pontuação + sorting

Sem MeiliSearch (fallback PostgreSQL):
- Query: LIKE '%banana%' → 500-1000ms (primeiro acesso)
- Sem filtro dinâmico (apenas SQL)
- Sem relevância inteligente
- Sem autocomplete

Resultado: UX degrada 5-10x
```

**Alternativas gratuitas:**
- Algolia (free: 10k registros) — NÃO SUFICIENTE (precisa 2.633)
- Typesense Cloud (free tier pequeno) — POSSÍVEL, mas limitado
- Elasticsearch (self-hosted) — CUSTA HOSTING

---

### 2.5 STOREFRONT (React + Vite)

| Requisito | Vercel Free | Viável? | Motivo |
|-----------|---|--|--|
| **Deploiar build React** | ✅ Sim | ✅ | Otimizado para static export |
| **Build time** | 🟡 < 10min | ✅ | Vite é rápido (~3min) |
| **Bandwidth** | 🟢 Unlimited | ✅ | Sem limite em free |
| **Bandwidth edge** | 🟢 Unlimited | ✅ | Mesmo em free tier |

**✅ Storefront em Vercel free é viável.**

---

### 2.6 ADMIN (React + Vite)

Mesmo análise que Storefront.

**✅ Admin em Vercel free é viável.**

---

### 2.7 INTEGRAÇÕES (Solidcom, WhatsApp, Web Push)

| Integração | Requisito | Vercel Free | Viável? |
|---|---|---|--|
| **Solidcom ERP sync** | Background job 5min | ❌ Impossível | Precisa de cron job (não free) |
| **WhatsApp webhook** | Receber + processar | 🟡 Via API | ✅ Possível (timeout de 10s) |
| **Web Push** | Background send | ❌ Impossível | 10s timeout; envio de 1k notif leva 30s |

**Solução:** Upstash Queueing (free tier pequeno) — PODE FUNCIONAR com racionamento.

---

## 3. TABELA RESUMIDA — COMPONENTES VIÁVEIS × INVIÁVEIS

| Componente | Vercel Free | Supabase Free | Status |
|---|---|---|---|
| **Frontend (Storefront)** | ✅ | N/A | ✅ VIÁVEL |
| **Admin Dashboard** | ✅ | N/A | ✅ VIÁVEL |
| **Backend API (NestJS)** | 🟡 Funções | ✅ Sim | 🟡 LIMITADO (timeout) |
| **PostgreSQL** | N/A | ✅ 500MB | 🟡 FUNCIONA 10 MESES |
| **Redis** | ❌ | ❌ | ❌ CRÍTICO — NÃO EXISTE |
| **MeiliSearch** | ❌ | ❌ | ❌ CRÍTICO — NÃO EXISTE |
| **Background Jobs** | ❌ | ❌ | ❌ IMPOSSÍVEL |
| **Integrações (Solidcom)** | ❌ | N/A | ❌ IMPOSSÍVEL |
| **Web Push** | ❌ | N/A | ❌ IMPOSSÍVEL |

---

## 4. ARQUITETURA DEGRADADA (POSSÍVEL MAS RUIM)

Se forçar Vercel + Supabase free tier, ficaria assim:

```
Storefront (React) → Vercel ✅
Admin (React) → Vercel ✅
    ↓
Backend (NestJS) → Vercel Functions 🟡
    ├─ Timeout 10s (RIP Solidcom sync)
    ├─ Sem background jobs (RIP pagamentos/notificações)
    └─ Sem persistência confiável (cartão cai se redeploy)
    ↓
PostgreSQL → Supabase 🟡
    ├─ 500MB (ultrapassa em 10 meses)
    └─ 20 conexões (OK por enquanto)
    ↓
❌ Sem Redis → CartContext quebrado, session quebrada
❌ Sem MeiliSearch → Busca lenta, sem relevância
❌ Sem Solidcom sync → Estoque desatualizado
❌ Sem background jobs → Pedidos não processam
```

**Resultado:** Sistema meio-funcional, mas quebrado em casos críticos.

---

## 5. ESTIMATIVA DE CUSTOS REAIS (Free → Pago)

Se quiser viabilizar Vercel + Supabase:

| Serviço | Free | Recomendado | Custo/mês |
|---|---|---|---|
| **Vercel** | Unlimited | Pro (deploy avançado) | $20 |
| **Supabase PostgreSQL** | 500MB | Paid (1GB+) | $25 |
| **Redis** | Não tem | Upstash + Vercel KV | $10-50 |
| **MeiliSearch** | Não tem | Meilisearch Cloud | $14.99 |
| **Background Jobs** | Não tem | Trigger.dev ou Inngest | $25-50 |
| **Domain + SSL** | Não tem | Route53 + AWS | $5-10 |
| **CDN/Storage (imagens)** | Não tem | Cloudinary ou S3 | $10-20 |
| **TOTAL** | $0 | **~$110-180/mês** | 💸 |

**Vs. VPS (Render/Railway/Heroku pago):**
- Render.com: $7/mês (starter) → $50+
- Railway: $5/mês (pay-as-you-go) → $40+
- Heroku: $7/mês (dyno) → $50+
- **AWS/DigitalOcean:** $5-10/mês (VPS base)

**Conclusão:** Pagar por tier pago é mais barato que montar Vercel + Supabase + add-ons.

---

## 6. ALTERNATIVAS RECOMENDADAS

### 🟢 OPÇÃO A: VPS SIMPLE (MELHOR CUSTO)
```
Render.com + PostgreSQL add-on
├─ Backend: $7/mês (starter, escalável)
├─ DB: $15/mês (managed PostgreSQL)
├─ Redis: $15/mês (Render Redis)
├─ Frontend: Vercel FREE ✅
├─ Admin: Vercel FREE ✅
└─ TOTAL: ~$40-50/mês
```

**Recomendação:** Start aqui. Simples, escalável, preço justo.

### 🟢 OPÇÃO B: AWS LIGHTSAIL
```
AWS Lightsail ($5/mês)
├─ T2.micro com Docker Compose
├─ 40GB storage
├─ 1TB/mês tráfego
├─ PostgreSQL no mesmo host
├─ Redis no mesmo host
├─ MeiliSearch no mesmo host
└─ TOTAL: ~$5-10/mês
```

**Recomendação:** Ultra-barato, pero precisa de DevOps mais hands-on.

### 🟢 OPÇÃO C: RAILWAY (PAY-AS-YOU-GO)
```
Railway.app
├─ Backend (Node): $5-10/mês
├─ PostgreSQL: $5-10/mês
├─ Redis: $1-5/mês
├─ Frontend: Vercel FREE ✅
└─ TOTAL: ~$15-30/mês (escalável)
```

**Recomendação:** Flexível, pay-what-you-use.

### 🔴 OPÇÃO D: Vercel + Supabase Free (EVITAR)
**Motivo:** Não funciona. Períodos:
- Semanas 1-4: Funciona com bricolagem
- Semanas 5-12: Começa a quebrar (Redis, MeiliSearch, jobs)
- Semana 24: PostgreSQL ultrapassa limite
- Produção: **NÃO RECOMENDADO**

---

## 7. CHECKLIST: O QUE QUEBRA EM FREE TIER

### ❌ Sem Redis
```
Será impossível:
[ ] Checkout simultâneo de 2+ usuários (race condition)
[ ] Rate-limit (spam na API)
[ ] Session (logout em redeploy)
[ ] CartContext sincronizado (muda de aba = perde carrinho)
[ ] Web Push (sem contador de tentativas)
```

### ❌ Sem MeiliSearch
```
Será lento:
[ ] Busca por produto: 500-1000ms (vs 100ms)
[ ] Filtro de categoria: sem dinâmica
[ ] Sem autocomplete
[ ] Sem relevância inteligente
[ ] UX: 5-10x mais lenta
```

### ❌ Vercel Functions (10s timeout)
```
Será impossível:
[ ] Sincronização Solidcom (30-60s)
[ ] Relatórios BI pesados (15-30s)
[ ] Processamento de imagens (5-10s)
[ ] Background jobs
```

### ❌ Sem integração Solidcom
```
Sistema não funciona:
[ ] Estoque sempre desatualizado
[ ] Novos produtos não aparecem
[ ] Preços não sincronizam
```

---

## 8. RECOMENDAÇÃO EXECUTIVA

### ✅ O QUE FUNCIONA EM FREE TIER

**Vercel Free (RECOMENDADO para frontend):**
- ✅ Storefront (React)
- ✅ Admin (React)
- ✅ Zerodowntime deploy
- ✅ Analytics básico
- ✅ Bandwidth ilimitado

### ❌ O QUE NÃO FUNCIONA

**Supabase Free + Vercel Functions:**
- ❌ Backend (precisa de 30-60s timeout)
- ❌ Redis (não oferecido)
- ❌ MeiliSearch (não oferecido)
- ❌ Background jobs (não suportado)
- ❌ Integrações resilientes (precisa de retry)

### 🎯 RECOMENDAÇÃO FINAL

**Para MVP (com limite de funcionalidade):**
```
Vercel Free → Frontend (Storefront + Admin)
+ Render.com Starter ($7) → Backend (NestJS)
+ Render PostgreSQL ($15) → Database
+ Render Redis ($15) → Cache + session
+ Upstash ($10) → Jobs + rate-limit
= ~$47/mês
```

**Para produção real:**
```
Vercel Free → Frontend (Storefront + Admin)
+ Railway.app ($15-30) → Backend + DB + Redis
+ MeiliSearch Cloud ($15) → Busca
+ Trigger.dev ($25) → Background jobs
= ~$60-80/mês (escalável)
```

### 🏆 MELHOR CUSTO-BENEFÍCIO

```
✅ RECOMENDADO: Railway.app ($15-30/mês)
   ├─ Backend rodando 24/7 (não serverless)
   ├─ Timeout infinito
   ├─ Background jobs nativos
   ├─ PostgreSQL + Redis + MeiliSearch no mesmo host
   └─ Pay-as-you-go (cresce com uso)

+ Vercel Free (storefront + admin)
= ~$30-50/mês total
```

---

## 9. CONCLUSÃO

### ❌ **Vercel Free + Supabase Free = NÃO VIÁVEL**

**Razões críticas:**
1. Sem Redis → CartContext quebrado
2. Sem MeiliSearch → Busca 10x mais lenta
3. Timeout 10s → Integrações não rodam
4. Sem background jobs → Notificações/pagamentos falham
5. PostgreSQL 500MB → Ultrapassa em 10 meses

### ✅ **Alternativa viável: Railway + Vercel Free (~$30-50/mês)**

- Backend rodando 24/7 com timeout infinito
- Redis + PostgreSQL + MeiliSearch inclusos
- Background jobs funcionando
- Vercel Free para frontend (ilimitado)
- Escalável e confiável

---

*Análise técnica finalizada em 21 de julho de 2026*  
*Conclusão: Free tier não suporta este projeto. Mínimo recomendado: $30-50/mês.*
