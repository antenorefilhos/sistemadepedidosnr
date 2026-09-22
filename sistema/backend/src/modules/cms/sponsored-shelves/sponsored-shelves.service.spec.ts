import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SponsoredShelvesService } from './sponsored-shelves.service';

function produto(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    ean: `789000000${id}`,
    name: `Produto ${id}`,
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
    ...overrides,
  };
}

describe('SponsoredShelvesService', () => {
  function buildService() {
    const prisma = {
      sponsoredShelf: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      sponsoredShelfItem: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
    };
    const service = new SponsoredShelvesService(prisma as never);
    return { service, prisma };
  }

  it('recusa criar sem titulo', async () => {
    const { service } = buildService();
    await expect(service.create(undefined, { title: '  ' })).rejects.toThrow(BadRequestException);
  });

  it('cria vitrine com os produtos na ordem enviada', async () => {
    const { service, prisma } = buildService();
    prisma.sponsoredShelf.create.mockResolvedValue({ id: 'shelf-1' });

    await service.create(undefined, { title: 'Semana Nestle', sponsorName: 'Nestle', productIds: ['p1', 'p2', 'p3'] });

    const dataArg = prisma.sponsoredShelf.create.mock.calls[0][0].data;
    expect(dataArg.title).toBe('Semana Nestle');
    expect(dataArg.items.create).toEqual([
      { productId: 'p1', order: 0 },
      { productId: 'p2', order: 1 },
      { productId: 'p3', order: 2 },
    ]);
  });

  it('recusa atualizar vitrine inexistente', async () => {
    const { service, prisma } = buildService();
    prisma.sponsoredShelf.findUnique.mockResolvedValue(null);
    await expect(service.update('nao-existe', { title: 'X' })).rejects.toThrow(NotFoundException);
  });

  it('substitui a lista de produtos por inteiro quando productIds e enviado', async () => {
    const { service, prisma } = buildService();
    prisma.sponsoredShelf.findUnique.mockResolvedValue({ id: 'shelf-1' });

    await service.update('shelf-1', { productIds: ['pA', 'pB'] });

    expect(prisma.sponsoredShelfItem.deleteMany).toHaveBeenCalledWith({ where: { shelfId: 'shelf-1' } });
    expect(prisma.sponsoredShelfItem.createMany).toHaveBeenCalledWith({
      data: [
        { shelfId: 'shelf-1', productId: 'pA', order: 0 },
        { shelfId: 'shelf-1', productId: 'pB', order: 1 },
      ],
    });
  });

  it('nao mexe nos itens quando productIds nao e enviado (so troca titulo/status)', async () => {
    const { service, prisma } = buildService();
    prisma.sponsoredShelf.findUnique.mockResolvedValue({ id: 'shelf-1' });

    await service.update('shelf-1', { active: false });

    expect(prisma.sponsoredShelfItem.deleteMany).not.toHaveBeenCalled();
  });

  // JON-204: publico so mostra vitrine ativa e produto vendavel -- mesma
  // regra do resto do storefront (isProductSellable).
  it('listPublic filtra produto NUNCA/sem estoque e remove vitrine que fica sem nenhum produto vendavel', async () => {
    const { service, prisma } = buildService();
    prisma.sponsoredShelf.findMany.mockResolvedValue([
      {
        id: 'shelf-1',
        title: 'Semana Nestle',
        sponsorName: 'Nestle',
        items: [
          { product: produto('p1', { syncOption: 'SEMPRE' }) },
          { product: produto('p2', { syncOption: 'NUNCA' }) },
          { product: produto('p3', { syncOption: 'ESTOQUE', stock: 0 }) },
        ],
      },
      {
        id: 'shelf-2',
        title: 'Vitrine vazia',
        sponsorName: null,
        items: [{ product: produto('p4', { syncOption: 'NUNCA' }) }],
      },
    ]);

    const resultado = await service.listPublic();

    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe('shelf-1');
    expect(resultado[0].products.map((p: { id: string }) => p.id)).toEqual(['p1']);
  });

  it('apaga vitrine existente', async () => {
    const { service, prisma } = buildService();
    prisma.sponsoredShelf.findUnique.mockResolvedValue({ id: 'shelf-1' });

    const resultado = await service.remove('shelf-1');

    expect(resultado).toEqual({ success: true });
    expect(prisma.sponsoredShelf.delete).toHaveBeenCalledWith({ where: { id: 'shelf-1' } });
  });
});
