import { HomeVitrinesService } from './home-vitrines.service';

function produtoLocal(erpProductId: number, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: `p-${erpProductId}`,
    ean: `78900000000${erpProductId}`,
    name: `Produto ${erpProductId}`,
    alternativeDescription: null,
    price: 10,
    promotionalPrice: null,
    stock: 5,
    isFractional: false,
    fractionStep: null,
    unit: 'un',
    badges: null,
    titleMask: null,
    titleMaskShort: null,
    syncOption: 'ESTOQUE',
    category: 'GERAL',
    origin: null,
    active: true,
    erpProductId,
    ...overrides,
  };
}

function carrosselRemoto(id: string, erpIds: number[]) {
  return {
    id,
    titulo: id,
    subtitulo: '',
    produtos: erpIds.map((erpId) => ({ id: erpId, sku: String(erpId), syncOption: 'ESTOQUE' as const })),
  };
}

describe('HomeVitrinesService', () => {
  function buildService(remota: unknown, produtosLocais: unknown[]) {
    const antenorApi = { getVitrines: jest.fn().mockResolvedValue(remota) };
    const prisma = { product: { findMany: jest.fn().mockResolvedValue(produtosLocais) } };
    const service = new HomeVitrinesService(prisma as never, antenorApi as never);
    return { service, antenorApi, prisma };
  }

  it('resolve produtos remotos pro nosso catalogo via erpProductId e preserva a ordem', async () => {
    const remota = {
      contexto: { perfil: 'bairro', momento: 'semana', mes: 9 },
      personalidadeAtiva: { titulo: 't', subtitulo: 's', bannerPrincipal: { headline: '', subheadline: '', ctaTexto: '', tagFoco: '' } },
      carrosseis: [carrosselRemoto('churrasco', [1, 2, 3, 4])],
    };
    const locais = [1, 2, 3, 4].map((id) => produtoLocal(id));
    const { service } = buildService(remota, locais);

    const resultado = await service.getHomeVitrines({});

    expect(resultado.carrosseis).toHaveLength(1);
    expect(resultado.carrosseis[0].produtos.map((p) => p.erpProductId)).toEqual([1, 2, 3, 4]);
  });

  it('descarta produto remoto que ainda nao existe no nosso catalogo (nao sincronizado)', async () => {
    const remota = {
      contexto: { perfil: 'bairro', momento: 'semana', mes: 9 },
      personalidadeAtiva: { titulo: 't', subtitulo: 's', bannerPrincipal: { headline: '', subheadline: '', ctaTexto: '', tagFoco: '' } },
      carrosseis: [carrosselRemoto('churrasco', [1, 2, 3, 4, 999])],
    };
    // 999 nunca aparece na resposta local (findMany so devolve o que existe)
    const locais = [1, 2, 3, 4].map((id) => produtoLocal(id));
    const { service } = buildService(remota, locais);

    const resultado = await service.getHomeVitrines({});

    expect(resultado.carrosseis[0].produtos).toHaveLength(4);
  });

  it('filtra produto nao vendavel (ESTOQUE com saldo zero)', async () => {
    const remota = {
      contexto: { perfil: 'bairro', momento: 'semana', mes: 9 },
      personalidadeAtiva: { titulo: 't', subtitulo: 's', bannerPrincipal: { headline: '', subheadline: '', ctaTexto: '', tagFoco: '' } },
      carrosseis: [carrosselRemoto('churrasco', [1, 2, 3, 4, 5])],
    };
    const locais = [1, 2, 3, 4].map((id) => produtoLocal(id)).concat(produtoLocal(5, { stock: 0 }));
    const { service } = buildService(remota, locais);

    const resultado = await service.getHomeVitrines({});

    expect(resultado.carrosseis[0].produtos.map((p) => p.erpProductId)).toEqual([1, 2, 3, 4]);
  });

  it('mantem produto SEMPRE disponivel mesmo com estoque zerado/negativo', async () => {
    const remota = {
      contexto: { perfil: 'bairro', momento: 'semana', mes: 9 },
      personalidadeAtiva: { titulo: 't', subtitulo: 's', bannerPrincipal: { headline: '', subheadline: '', ctaTexto: '', tagFoco: '' } },
      carrosseis: [carrosselRemoto('churrasco', [1, 2, 3, 4])],
    };
    const locais = [1, 2, 3].map((id) => produtoLocal(id)).concat(
      produtoLocal(4, { syncOption: 'SEMPRE', stock: -3 }),
    );
    const { service } = buildService(remota, locais);

    const resultado = await service.getHomeVitrines({});

    expect(resultado.carrosseis[0].produtos.map((p) => p.erpProductId)).toEqual([1, 2, 3, 4]);
  });

  it('descarta carrossel inteiro que fica abaixo do minimo apos resolver contra o catalogo local', async () => {
    const remota = {
      contexto: { perfil: 'bairro', momento: 'semana', mes: 9 },
      personalidadeAtiva: { titulo: 't', subtitulo: 's', bannerPrincipal: { headline: '', subheadline: '', ctaTexto: '', tagFoco: '' } },
      carrosseis: [carrosselRemoto('churrasco', [1, 2, 998, 999]), carrosselRemoto('hortifruti', [10, 11, 12, 13])],
    };
    // churrasco: so 1 e 2 existem localmente (2 < MIN_SHELF_ITEMS=4) -- carrossel inteiro cai.
    const locais = [1, 2].map((id) => produtoLocal(id)).concat([10, 11, 12, 13].map((id) => produtoLocal(id)));
    const { service } = buildService(remota, locais);

    const resultado = await service.getHomeVitrines({});

    expect(resultado.carrosseis.map((c) => c.id)).toEqual(['hortifruti']);
  });

  it('nunca repete o mesmo produto local entre dois carrosseis remotos distintos', async () => {
    const remota = {
      contexto: { perfil: 'bairro', momento: 'semana', mes: 9 },
      personalidadeAtiva: { titulo: 't', subtitulo: 's', bannerPrincipal: { headline: '', subheadline: '', ctaTexto: '', tagFoco: '' } },
      // erpProductId 2 aparece nos dois carrosseis remotos (dedup deles pode falhar,
      // ou dois erpProductId diferentes podem mapear pro mesmo Product.id local).
      carrosseis: [carrosselRemoto('a', [1, 2, 3, 4]), carrosselRemoto('b', [2, 5, 6, 7])],
    };
    const locais = [1, 2, 3, 4, 5, 6, 7].map((id) => produtoLocal(id));
    const { service } = buildService(remota, locais);

    const resultado = await service.getHomeVitrines({});

    const todosOsIds = resultado.carrosseis.flatMap((c) => c.produtos.map((p) => p.id));
    expect(new Set(todosOsIds).size).toBe(todosOsIds.length);
  });
});
