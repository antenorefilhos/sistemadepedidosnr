const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function run() {
  console.log('Baixando 15000+ produtos...');

  const response = await axios.get('http://45.239.193.56:5000/api/Produto/GetProdutos?ativo=true');
  const records = Array.isArray(response.data) ? response.data : [];

  const items = records
    .map((r) => ({
      ean: (r.codigo_ean || r.ean || '').toString().trim(),
      name: (r.produto || r.descricaoecommerce || '').toString().trim().substring(0, 100),
      price: Number(r.vl_produto || 0),
      promotionalPrice: r.preco_clube_promocao != null ? Number(r.preco_clube_promocao) : null,
      stock: Number(r.qtd_produto || 0),
      unit: (r.unid_medida || 'un').toString().trim() || 'un',
      origin: r.importado ? 'Importado' : 'Nacional',
      active: r.ativo !== false,
      isFractional: r.fracionado === true,
      classification01: r.classificacao01 ? r.classificacao01.toString().trim() : null,
      classification02: r.classificacao02 ? r.classificacao02.toString().trim() : null,
      classification03: r.classificacao03 ? r.classificacao03.toString().trim() : null,
      classification04: r.classificacao04 ? r.classificacao04.toString().trim() : null,
    }))
    .filter((i) => i.ean && i.name);

  console.log('Inserindo/atualizando no banco: ' + items.length);

  for (let i = 0; i < items.length; i += 500) {
    const chunk = items.slice(i, i + 500);
    await prisma.$transaction(
      chunk.map((p) =>
        prisma.product.upsert({
          where: { ean: p.ean },
          update: p,
          create: p,
        }),
      ),
    );
    console.log('Progresso:', i + chunk.length);
  }

  console.log('Concluido!');
}

run()
  .catch((error) => {
    console.error('Erro no sync:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
