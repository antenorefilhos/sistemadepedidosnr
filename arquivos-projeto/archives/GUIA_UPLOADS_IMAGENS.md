# GUIA_UPLOADS_IMAGENS.md

Data: 23 de abril de 2026
Versao de referencia: 1.6.0-alpha

## Visao geral

Fluxo de imagens do catalogo:

1. origem de fotos (pastas externas ou upload admin)
2. processamento/conversao para WebP
3. destino em `sistema/backend/uploads/products/{ean}.webp`
4. entrega publica no storefront em `http://localhost:3000/uploads/products/{ean}.webp`

Observacao:
- o Nginx do storefront faz proxy de `/uploads/` para `api:3001/uploads/`
- quando a imagem nao existe, retorna `placeholder-product.svg`

## Upload manual via Admin

- endpoint: `POST /uploads`
- uso principal: imagens pontuais no painel
- destino: pasta `uploads/` do backend

## Importacao em lote por pasta

Script:

- `sistema/backend/scripts/import-images.js`

O que o script faz:

- varre pastas recursivamente por extensoes `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`
- tenta match direto por EAN no nome do arquivo
- tenta match por similaridade de nome (tokenizacao)
- converte para WebP otimizado
- grava em `uploads/products/{ean}.webp`
- gera resumo de vinculadas, duplicadas, sem match e falhas

## Comando recomendado (PowerShell)

```powershell
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema"
docker compose run --rm \
  -v "F:/VC.VERSE/PROJETOS/antenor e filhos/PRODUTOS/DA CASA:/imports/da-casa:ro" \
  -v "F:/VC.VERSE/PROJETOS/antenor e filhos/PRODUTOS/SUBIDOS:/imports/subidos:ro" \
  api node /app/scripts/import-images.js "/imports/da-casa" "/imports/subidos" --min-score=0.64
```

## Parametros

- `--min-score=<0..1>`: limiar de similaridade do match por nome
- `--overwrite`: sobrescreve imagem existente de um EAN

## Validacao de entrega

```powershell
curl.exe -s -o NUL -w "img100 %{http_code} %{content_type}`n" "http://localhost:3000/uploads/products/100.webp"
curl.exe -s -o NUL -w "img300 %{http_code} %{content_type}`n" "http://localhost:3000/uploads/products/300.webp"
curl.exe -s -o NUL -w "img404 %{http_code} %{content_type}`n" "http://localhost:3000/uploads/products/nao-existe.webp"
```

## Troubleshooting rapido

- erro `no configuration file provided: not found`:
  - execute o comando dentro de `sistema/`
- `curl` com erro no PowerShell:
  - use `curl.exe`, nao `curl`
- imagem 404 para um EAN:
  - verificar se existe arquivo em `sistema/backend/uploads/products/{ean}.webp`
  - se nao existir, reexecutar importacao com `--min-score` adequado
- erro ORB/CORS ao carregar imagem:
  - validar se o frontend esta usando `/uploads/...` em vez de `http://localhost:3001/uploads/...`
