# Frontend Storefront - Antenor & Filhos

## Stack

- React 18
- Vite 4
- React Query
- Tailwind CSS

## Execucao com Docker

```bash
cd ../
docker compose up -d storefront
```

## Execucao local

```bash
npm install
npm run dev
```

## Configuracao

- `VITE_API_URL=http://localhost:3001`

## Funcionalidades principais

- busca dedicada com sugestoes
- filtros visuais de categoria e preco
- cards de produto com fallback de imagem
- imagens em `/uploads/products/{ean}.webp`
- vitrines da Home com composicao dinamica via CMS (`/cms/categories`):
	- ordem das secoes por `priority`
	- quantidade de cards por secao via `limit`
	- exibicao por secao controlada por `active`
