# 🚀 Roadmap v0.9.0 - Admin Pedidos & Gestão de Clientes

**Status:** 🔄 Em desenvolvimento  
**Data Início:** 18 de Abril de 2026  
**Versão Alvo:** 0.9.0

---

## 🎯 Objetivo

Completar o painel administrativo com gestão completa de pedidos e clientes, e fechar o ciclo de negócio: operador vê pedido → atualiza status → cliente vê mudança na conta.

---

## 📋 Tasks

### Task 1: Admin — Gestão de Pedidos

**1.1 - Listagem de Pedidos**
- [ ] Seção "Pedidos" no Dashboard (atualmente mostra "em desenvolvimento")
- [ ] `GET /orders` com filtro por status, data, cliente
- [ ] Tabela: ID, cliente, data, total, status, ações
- [ ] Paginação e busca

**1.2 - Detalhe do Pedido**
- [ ] Modal/expansão com itens, endereço, método de pagamento
- [ ] Total discriminado (subtotal + frete + desconto)

**1.3 - Atualizar Status do Pedido**
- [ ] Dropdown para mudar status: PENDING → CONFIRMED → DELIVERED → COMPLETED / CANCELLED
- [ ] `PUT /orders/:id/status`
- [ ] Toast de confirmação + atualização da lista

---

### Task 2: Admin — Gestão de Clientes

**2.1 - Listagem de Clientes**
- [ ] Seção "Clientes" no Dashboard (atualmente mostra "em desenvolvimento")
- [ ] `GET /customers` com busca por nome, CPF ou WhatsApp
- [ ] Tabela: nome, CPF, WhatsApp, email, data de cadastro, qtd pedidos
- [ ] Paginação

**2.2 - Detalhe do Cliente**
- [ ] Modal com dados completos: perfil + endereços + histórico de pedidos
- [ ] Totalizador: valor total gasto, nº de pedidos

---

### Task 3: Frontend Customer — Melhorias pós-checkout

**3.1 - Notificação de Status do Pedido**
- [ ] Na página Account, pedido exibe status atualizado em tempo real (polling ou refresh)
- [ ] Badge de status com cor: Pendente (amarelo), Confirmado (azul), Entregue (verde), Cancelado (vermelho)

**3.2 - Reorder**
- [ ] Botão "Repetir pedido" na lista de pedidos do Account
- [ ] Adiciona todos os itens do pedido ao carrinho

---

### Task 4: Backend — Notificações WhatsApp (base)

**4.1 - Módulo de Notificações**
- [ ] `POST /notifications/whatsapp` — envio de mensagem via API (placeholder ou mock)
- [ ] Trigger automático ao criar pedido: confirmação para cliente
- [ ] Trigger ao mudar status do pedido para CONFIRMED/DELIVERED

---

## 📅 Sequência de implementação

1. Task 1 (Admin Pedidos) — maior impacto operacional
2. Task 2 (Admin Clientes) — completa o painel
3. Task 3 (Frontend melhorias) — fecha ciclo cliente
4. Task 4 (Notificações) — value add

---

## 🏁 Critérios de conclusão

- [ ] Admin: operador consegue ver todos os pedidos e mudar status
- [ ] Admin: operador consegue ver todos os clientes e seus pedidos
- [ ] Frontend: cliente vê status atualizado em Account
- [ ] E2E validado: pedido criado no frontend → status alterado no admin → atualizado no Account
