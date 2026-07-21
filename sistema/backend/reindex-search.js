const Prisma = require('@prisma/client');
const MeiliSearch = require('meilisearch');

const prisma = new Prisma.PrismaClient();
const meiliHost = process.env.MEILI_HOST || 'http://meili:7700';
const meiliKey = process.env.MEILI_MASTER_KEY;

async function reindexSearch() {
  try {
    console.log('Reindexando MeiliSearch com dados atualizados...');
    
    const client = new MeiliSearch.default({
      host: meiliHost,
      apiKey: meiliKey,
    });
    
    const indexName = 'products';
    const index = client.index(indexName);
    
    // Buscar todos os produtos
    const products = await prisma.product.findMany({
      where: { active: true },
    });
    
    console.log(`Encontrados ${products.length} produtos ativos`);
    
    // Limpar índice
    await index.deleteAllDocuments();
    console.log('Índice limpo');
    
    // Reindexar com novos dados
    const documents = products.map(p => ({
      id: p.id,
      ean: p.ean,
      name: p.name,
      alternativeDescription: p.alternativeDescription,
      isFractional: p.isFractional,
      fractionStep: p.fractionStep,
      price: p.price,
      promotionalPrice: p.promotionalPrice,
      stock: p.stock,
      unit: p.unit,
      badges: p.badges,
      category: p.category,
      active: p.active,
      origin: p.origin,
      syncOption: p.syncOption,
      popularityScore: 0, // Será calculado depois
    }));
    
    await index.addDocuments(documents);
    console.log(`✅ ${documents.length} documentos indexados no MeiliSearch`);
    
    process.exit(0);
  } catch (error) {
    console.error('Erro na reindexação:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

reindexSearch();
