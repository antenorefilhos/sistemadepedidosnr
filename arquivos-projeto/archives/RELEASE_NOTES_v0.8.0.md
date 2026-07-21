# 🚀 Release Notes v0.8.0

**Data:** 18 de Abril de 2026  
**Versão:** 0.8.0 (Frontend Customer E2E)  
**Status:** ✅ Validado pelo usuário

---

## O que foi feito

### Checkout — Fluxo corrigido e simplificado ✅
- Checkout agora usa `user.id` do cliente autenticado via JWT em vez de criar um novo cliente a cada pedido (bug crítico corrigido).
- Step "Dados Pessoais" removido — era redundante pois o usuário já está logado.
- Fluxo reduzido de 3 steps para 2: **Endereço → Pagamento → Confirmação**.
- Indicador de progresso (barra verde) atualizado para refletir os 2 steps.
- Card do perfil do usuário exibido no topo do checkout.
- Botão "Voltar" corrigido (referência ao step `customer` removida).
- Loading state corrigido (removida referência a `createCustomer.isPending`).
- Import `formatWhatsApp` removido (não mais utilizado).

### Checkout — Preenchimento automático de CEP ✅
- Campo CEP com evento `onBlur` que chama `GET /addresses/search/:cep` (ViaCEP).
- Preenchimento automático de: rua, bairro, cidade e estado.
- Spinner de loading enquanto busca o CEP.
- Falha silenciosa — usuário preenche manualmente se CEP não encontrado.

### Home — Melhorias de UX ✅
- Link `/account` trocado de `<a href>` para `<Link to>` (React Router), eliminando reload de página.
- Nome do primeiro nome do usuário logado exibido no header.
- Ícone `User` adicionado ao botão de conta.

### Correção de bug — Arquivos compilados (.js) ✅
- Arquivos `.js` compilados pelo TypeScript existiam dentro de `admin/src/` e `frontend/src/`, fazendo o Vite servir código desatualizado em vez dos arquivos `.tsx`.
- Arquivos removidos em ambos os projetos.
- `"noEmit": true` adicionado em `admin/tsconfig.json` e `frontend/tsconfig.json` para evitar recorrência.

---

## Fluxo E2E do cliente (completo)

```
/register  →  login automático  →  /  (listagem de produtos)
    ↓
adicionar ao carrinho (localStorage)
    ↓
/cart  →  revisar itens e quantidades
    ↓
/checkout  →  1. Endereço (CEP auto-fill)  →  2. Pagamento  →  Confirmação
    ↓
/account  →  histórico de pedidos + endereços + perfil
```

---

## Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `frontend/src/pages/Checkout.tsx` | Reescrita do fluxo (sem step customer, CEP auto-fill) |
| `frontend/src/pages/Home.tsx` | Link account + nome usuário no header |
| `frontend/tsconfig.json` | `noEmit: true` |
| `admin/tsconfig.json` | `noEmit: true` |
