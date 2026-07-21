---
tipo: projeto
status: ativo
area: projeto
prioridade: media
criado: 2026-05-24
atualizado: 2026-05-24
tags:
  - projeto
  - documentacao
---

# Visão Geral

Para a descrição completa do projeto e regras técnicas fundamentais de arquitetura, acesse:

👉 **[[INICIO_AQUI|INICIO_AQUI.md (Entry Point Principal)]]**
👉 **[[REFERENCIA_TECNICA|REFERENCIA_TECNICA.md (Arquitetura e Stack)]]**

## O que é o Projeto?

Supermercado premium focado em entrega online, composto por três aplicações principais:
1. **Storefront (Cliente):** Interface pública de compras e catálogo (`http://localhost:3000`).
2. **Admin (Gestão):** Painel de controle administrativo, inteligência e CMS (`http://localhost:3002`).
3. **Backend (API):** Servidor centralizado NestJS (`http://localhost:3001`).

Tudo roda localmente gerenciado por Docker Compose.

## Estrutura de Pastas

```
raiz/
  arquivos-projeto/md/              ← documentação canônica e wiki Obsidian
  sistema/
    backend/                        ← API NestJS + Prisma
    frontend/                       ← Storefront React + Vite
    admin/                          ← Admin React + Vite
```
