const axios = require('axios');
const Prisma = require('@prisma/client');

const prisma = new Prisma.PrismaClient();
const SOLIDCOM_API_URL = process.env.SOLIDCOM_API_URL || 'http://45.239.193.56:5000';

async function resolveCommercialPrices(row) {
  const currentPrice = parseFloat(row.vl_produto) || NaN;
  const normalPrice = parseFloat(row.vl_produto_normal) || NaN;
  const clubPrice = parseFloat(row.preco_fidelidade_promocao) || NaN;

  let resolvedPrice = currentPrice;
  let resolvedPromotionalPrice = NaN;

  // Se preço normal > preço atual = PROMOÇÃO ATIVA
  if (!Number.isNaN(normalPrice) && !Number.isNaN(currentPrice) && normalPrice > currentPrice) {
    resolvedPrice = normalPrice;
    resolvedPromotionalPrice = currentPrice;
  } 
  // Se preço clube > 0 e < preço atual = PROMOÇÃO FIDELIDADE
  else if (!Number.isNaN(clubPrice) && !Number.isNaN(currentPrice) && clubPrice > 0 && clubPrice < currentPrice) {
    resolvedPrice = currentPrice;
    resolvedPromotionalPrice = clubPrice;
  } 
  // Se não há preço normal mas há preço normal, use normal como preço base
  else if (Number.isNaN(resolvedPrice) && !Number.isNaN(normalPrice)) {
    resolvedPrice = normalPrice;
  }

  return {
    price: resolvedPrice,
    promotionalPrice: resolvedPromotionalPrice,
  };
}

async function syncProducts() {
  try {
    console.log('Buscando produtos do ERP Solidcom...');

    // 1. Busca bulk (todos os produtos, mas sem preços promocionais)
    const bulkResponse = await axios.get(`${SOLIDCOM_API_URL}/api/Produto/GetProdutos?ativo=true`, { timeout: 60000 });
    const bulkItems = Array.isArray(bulkResponse.data) ? bulkResponse.data : bulkResponse.data.products || bulkResponse.data.data || [];
    console.log(`Bulk: ${bulkItems.length} produtos`);

    // 2. Busca alterados (retorna vl_produto_normal correto para promoções ativas)
    const altResponse = await axios.get(`${SOLIDCOM_API_URL}/api/Produto/GetProdutosAlterados?data=2020-01-01T00:00:00`, { timeout: 60000 });
    const altItems = Array.isArray(altResponse.data) ? altResponse.data : [];
    console.log(`Alterados: ${altItems.length} produtos`);

    // Monta índice dos alterados por EAN para sobrescrever preços do bulk
    const altByEan = new Map();
    for (const a of altItems) {
      const ean = String(a.codigo_ean || '').trim();
      if (ean) altByEan.set(ean, a);
    }

    // Merge: usa dados do bulk mas sobrescreve vl_produto/vl_produto_normal com alterados quando disponível
    const items = bulkItems.map(item => {
      const ean = String(item.codigo_ean || '').trim();
      const alt = altByEan.get(ean);
      if (alt) {
        return { ...item, vl_produto: alt.vl_produto, vl_produto_normal: alt.vl_produto_normal, preco_fidelidade_promocao: alt.preco_fidelidade_promocao };
      }
      return item;
    });

    console.log(`Merge: ${items.length} produtos (${altByEan.size} com preços atualizados)`);

    let synced = 0;
    let errors = 0;

    for (const item of items) {
      try {
        const ean = String(item.codigo_ean || item.ean || '').trim();
        const name = String(item.produto || item.nome || '').trim();
        const commercialPrices = await resolveCommercialPrices(item);

        if (!ean || !name || Number.isNaN(commercialPrices.price)) {
          continue;
        }

        const emb = String(item.emb || item.unidade || '').trim();
        const fracionamento = parseFloat(item.fracionamento) || NaN;
        // isFractional APENAS quando o campo fracionado é explicitamente true
        // fracionamento:1 significa "unidade inteira" em produtos normais — não é pesável
        const isFractional = item.fracionado === true || item.fracionado === 'true' || item.fracionado === 1;
        // fractionStep só faz sentido quando isFractional e < 1 (frações de kg/g/ml)
        const validFractionStep = isFractional && !Number.isNaN(fracionamento) && fracionamento > 0 && fracionamento !== 1 ? fracionamento : null;
        
        const promoPrice = !Number.isNaN(commercialPrices.promotionalPrice) ? commercialPrices.promotionalPrice : null;
        
        const product = await prisma.product.upsert({
          where: { ean },
          create: {
            ean,
            name: name.substring(0, 100),
            price: commercialPrices.price,
            promotionalPrice: promoPrice,
            stock: parseInt(item.qtd_produto) || 0,
            isFractional,
            fractionStep: validFractionStep,
            unit: emb || 'un',
            active: true,
          },
          update: {
            name: name.substring(0, 100),
            price: commercialPrices.price,
            promotionalPrice: promoPrice,
            stock: parseInt(item.qtd_produto) || 0,
            isFractional,
            fractionStep: validFractionStep,
            unit: emb || 'un',
            active: true,
          },
        });

        synced++;
        if (synced % 100 === 0) {
          console.log(`Sincronizados ${synced} produtos...`);
        }
      } catch (err) {
        console.error(`Erro ao sincronizar EAN ${item.codigo_ean}:`, err.message);
        errors++;
      }
    }

    console.log(`\n✅ Sincronização concluída: ${synced} produtos sincronizados, ${errors} erros`);
    process.exit(0);
  } catch (error) {
    console.error('Erro na sincronização:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

syncProducts();
