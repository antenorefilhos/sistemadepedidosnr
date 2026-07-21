const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

interface SolidcomProduct {
  codigo_ean?: string | number;
  ean?: string | number;
  produto?: string;
  descricaoecommerce?: string;
  vl_produto?: number;
  preco_clube_promocao?: number | null;
  qtd_produto?: number;
  unid_medida?: string;
  importado?: boolean;
  ativo?: boolean;
  fracionado?: boolean;
  classificacao01?: string;
  classificacao02?: string;
  classificacao03?: string;
  classificacao04?: string;
}

interface SyncProductInput {
  ean: string;
  name: string;
  price: number;
  promotionalPrice: number | null;
  stock: number;
  unit: string;
  origin: string;
  active: boolean;
  isFractional: boolean;
  classification01: string | null;
  classification02: string | null;
  classification03: string | null;
  classification04: string | null;
}

async function run() {
  console.log('Baixando 15000+ produtos...');
  const response = await axios.get('http://45.239.193.56:5000/api/Produto/GetProdutos?ativo=true');
  const records = (response.data || []) as SolidcomProduct[];
  const items: SyncProductInput[] = records.map((r: SolidcomProduct) => ({
    ean: (r.codigo_ean || r.ean || '').toString().trim(),
    name: (r.produto || r.descricaoecommerce || '').toString().trim().substring(0, 100),
    price: r.vl_produto || 0,
    promotionalPrice: r.preco_clube_promocao || null,
    stock: r.qtd_produto || 0,
    unit: r.unid_medida || 'un',
    origin: r.importado ? 'Importado' : 'Nacional',
    active: r.ativo !== false,
    isFractional: r.fracionado === true,
    classification01: r.classificacao01 ? r.classificacao01.toString().trim() : null,
    classification02: r.classificacao02 ? r.classificacao02.toString().trim() : null,
    classification03: r.classificacao03 ? r.classificacao03.toString().trim() : null,
    classification04: r.classificacao04 ? r.classificacao04.toString().trim() : null
  })).filter((i: SyncProductInput) => i.ean && i.name);
  
  console.log('Inserindo/atualizando no banco: ' + items.length);
  // Batch processing
  for (let i = 0; i < items.length; i += 500) {
    const chunk = items.slice(i, i + 500);
    // Upsert em lote para manter idempotência no sync
    await prisma.$transaction(
      chunk.map((p: SyncProductInput) => prisma.product.upsert({
        where: { ean: p.ean },
        update: p,
        create: p
      }))
    );
    console.log('Progresso:', i + chunk.length);
  }
  console.log('Concluido!');
}
run();
