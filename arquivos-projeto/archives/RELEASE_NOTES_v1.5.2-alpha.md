# Release Notes v1.5.2-alpha

Data: 21 de abril de 2026

## Destaques

- Remocao da barreira de login obrigatorio na Home e no Carrinho do storefront.
- Implementacao de checkout convidado com controle por feature flags no frontend e backend.
- Correcao de navegacao para usuario anonimo com direcionamento consistente para `/login`.
- Correcao de carregamento de imagens com proxy same-origin em `/uploads/` no Nginx do storefront.
- Fallback visual para imagem ausente com `placeholder-product.svg`.

## Melhorias tecnicas

- Novo endpoint `POST /auth/customer/guest-checkout` no backend para criacao/autenticacao de cliente convidado.
- Ajuste de tipagem no Checkout para prevenir erro TS2322 com `customerId` indefinido.
- Ajuste operacional no banco para restaurar consulta de produtos com coluna `products.fractionStep`.
- Atualizacao completa da documentacao canonica em `arquivos-projeto/md`.

## Observacoes operacionais

- O storefront deve usar imagens via caminho relativo `/uploads/...`.
- Em caso de 404 de imagem no backend, o Nginx da loja responde com placeholder SVG.
- Ainda e recomendada migration Prisma formal para `products.fractionStep` para blindar ambientes novos.

## Compatibilidade

- Backend: NestJS 10 + Prisma 5.22.0
- Frontend/Admin: React 18 + Vite 4
- Banco: PostgreSQL 15
- Cache: Redis 7
- Busca: MeiliSearch 1.x
