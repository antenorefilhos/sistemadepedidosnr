# Pipeline de fotos V2 — Browser Harness + Obscura

Última validação: 2026-09-21.

## Decisão de arquitetura

- **Browser Harness + Chrome real**: descoberta de rotas, bootstrap de loja/CEP e fallback para sites com proteção ou JavaScript pesado.
- **API HTTP descoberta pelo navegador**: execução em lote. É a rota preferida porque evita um clique por produto.
- **Obscura**: executor paralelo para páginas e APIs que passaram no teste de compatibilidade. Não substitui o Chrome em Carrefour/VTEX protegidos.
- **ComfyUI**: só entra depois da identidade do SKU estar confirmada. Serve para recorte, remoção/reparo de fundo e eventual upscale; nunca decide qual é o produto.

## Fontes já liberadas

| Fonte | Identidade | Imagem original comprovada | Uso |
|---|---|---:|---|
| Carrefour | EAN exato | 1200×1200 | automático |
| Savegnago | EAN exato | 1200×1200 | automático |
| Bistek | EAN exato | 1200×1200 | automático |
| Bernardão | EAN exato | 1000×1000 | automático |
| Supermarket Delivery | EAN via API Instabuy | 1200×1200 | automático |
| Super Muffato | nome + EAN no arquivo VTEX | 1200×1200 | automático com validação de unidade |
| Bigbox | nome via API Instabuy | 1200×1200 | fila de confiança nominal |

O estado das 40 fontes está em `scripts/photo-pipeline-v2/validated-sources.json`.

## Regras obrigatórias antes de publicar

1. EAN exato tem prioridade absoluta.
2. Busca nominal precisa conferir marca, variante, peso/volume e tipo de embalagem.
3. Produto unitário rejeita `pack`, `kit`, `fardo`, `c/6`, `6 un` e imagens com várias unidades, salvo quando o cadastro também for multipack.
4. A imagem de origem deve ter pelo menos 800×800. Miniatura não pode ser ampliada e publicada como se fosse original.
5. A saída é quadrada, no mínimo 800×800, produto centralizado e com cerca de 20 px de respiro.
6. O nome final é `EAN NOME DO PRODUTO.webp`.
7. Resultado fuzzy, página de categoria, pessoa, mapa, banner ou embalagem incompatível é rejeitado.

## Evidências da rodada

- `artifacts/photo-pipeline-v2/probes/adapter-candidates-chrome.json`: rodada inicial dos 40 sites.
- `artifacts/photo-pipeline-v2/probes/adapter-recheck-v3-chrome.json`: rechecagem conservadora dos casos ambíguos.
- `artifacts/photo-pipeline-v2/probes/instabuy-api-v2-chrome.json`: API Instabuy, incluindo imagem large de 1200×1200.
- `artifacts/photo-pipeline-v2/probes/markets-obscura.json`: compatibilidade inicial do Obscura.

## Próxima execução

O lote deve começar pelas fontes `production_ean`, depois `production_catalog` e só então `production_name_review`. As demais fontes ficam como fallback. A publicação deve ser incremental, mas somente depois de todas as travas acima passarem.

Na fila, grandes marcas e produtos com maior presença na web vêm antes dos itens locais/obscuros. Medidas encontradas pelo OCR não reprovam a imagem sozinhas, pois podem ser porções da tabela nutricional; peso e volume são confirmados pelo título da página associado ao EAN.
