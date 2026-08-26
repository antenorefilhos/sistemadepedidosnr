import { Test, TestingModule } from '@nestjs/testing';
import { StoreBannersService } from './store-banners.service';
import { PrismaService } from '../../../common/prisma.service';

describe('StoreBannersService', () => {
  let service: StoreBannersService;
  let prisma: {
    storeBanner: { findMany: jest.Mock; create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    promotionCampaign: { findMany: jest.Mock };
    product: { findMany: jest.Mock };
  };

  const baseBanner = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'banner-1',
    active: true,
    slot: 'hero',
    targetCategory: null,
    linkType: 'url',
    linkValue: null,
    campaignErpId: null,
    startDate: null,
    endDate: null,
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      storeBanner: {
        findMany: jest.fn(),
        create: jest.fn((args) => Promise.resolve(args.data)),
        findUnique: jest.fn(),
        update: jest.fn((args) => Promise.resolve(args.data)),
      },
      promotionCampaign: { findMany: jest.fn() },
      product: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [StoreBannersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<StoreBannersService>(StoreBannersService);
  });

  it('esconde banner vinculado a encarte sincronizado e fora da vigencia da campanha', async () => {
    prisma.storeBanner.findMany.mockResolvedValue([baseBanner({ campaignErpId: 42 })]);
    prisma.promotionCampaign.findMany.mockResolvedValue([
      { erpCampaignId: 42, name: 'Encarte 42', active: true, startDate: new Date('2020-01-01'), endDate: new Date('2020-01-02') },
    ]);
    prisma.product.findMany.mockResolvedValue([]);

    const visible = await service.findActive();

    expect(visible).toHaveLength(0);
  });

  it('mostra banner vinculado a encarte sincronizado e dentro da vigencia', async () => {
    const now = new Date();
    prisma.storeBanner.findMany.mockResolvedValue([baseBanner({ campaignErpId: 42 })]);
    prisma.promotionCampaign.findMany.mockResolvedValue([
      {
        erpCampaignId: 42,
        name: 'Encarte 42',
        active: true,
        startDate: new Date(now.getTime() - 86400000),
        endDate: new Date(now.getTime() + 86400000),
      },
    ]);
    prisma.product.findMany.mockResolvedValue([]);

    const visible = await service.findActive();

    expect(visible).toHaveLength(1);
  });

  // Encarte configurado mas ainda nao sincronizado: cai no fallback de
  // startDate/endDate proprios do banner (ver comentario em findActive).
  it('usa startDate/endDate do banner como fallback quando o encarte ainda nao sincronizou', async () => {
    const now = new Date();
    prisma.storeBanner.findMany.mockResolvedValue([
      baseBanner({ campaignErpId: 99, endDate: new Date(now.getTime() - 86400000) }),
    ]);
    prisma.promotionCampaign.findMany.mockResolvedValue([]); // encarte 99 nao existe ainda
    prisma.product.findMany.mockResolvedValue([]);

    const visible = await service.findActive();

    expect(visible).toHaveLength(0);
  });

  it('fica visivel quando o encarte nao sincronizou e o banner nao tem vigencia manual', async () => {
    prisma.storeBanner.findMany.mockResolvedValue([baseBanner({ campaignErpId: 99 })]);
    prisma.promotionCampaign.findMany.mockResolvedValue([]);
    prisma.product.findMany.mockResolvedValue([]);

    const visible = await service.findActive();

    expect(visible).toHaveLength(1);
  });

  it('respeita startDate/endDate proprios quando nao ha encarte vinculado', async () => {
    const now = new Date();
    prisma.storeBanner.findMany.mockResolvedValue([
      baseBanner({ startDate: new Date(now.getTime() + 86400000) }), // agendado pro futuro
    ]);
    prisma.promotionCampaign.findMany.mockResolvedValue([]);
    prisma.product.findMany.mockResolvedValue([]);

    const visible = await service.findActive();

    expect(visible).toHaveLength(0);
  });

  const validPayload = () => ({
    name: 'Banner válido',
    desktopImageUrl: '/uploads/banner.jpg',
    slot: 'hero',
    linkType: 'url',
    linkTarget: '_self' as const,
    pages: 'home',
    align: 'left' as const,
  });

  describe('validação de payload (create/update)', () => {
    it('cria normalmente com um payload valido', async () => {
      await expect(service.create(validPayload())).resolves.toBeDefined();
      expect(prisma.storeBanner.create).toHaveBeenCalled();
    });

    it('rejeita slot fora do enum', () => {
      expect(() => service.create({ ...validPayload(), slot: 'banner-gigante' })).toThrow(/slot inválido/i);
    });

    it('rejeita linkType fora do enum', () => {
      expect(() => service.create({ ...validPayload(), linkType: 'whatsapp' })).toThrow(/linkType inválido/i);
    });

    it('exige targetCategory quando slot = category', () => {
      expect(() => service.create({ ...validPayload(), slot: 'category', targetCategory: null })).toThrow(
        /targetCategory é obrigatório/i,
      );
    });

    it('aceita slot = category quando targetCategory esta preenchido', async () => {
      await expect(
        service.create({ ...validPayload(), slot: 'category', targetCategory: 'ACOUGUE' }),
      ).resolves.toBeDefined();
    });

    it('rejeita name vazio na criação', () => {
      expect(() => service.create({ ...validPayload(), name: '   ' })).toThrow(/name é obrigatório/i);
    });

    it('rejeita desktopImageUrl vazio na criação', () => {
      expect(() => service.create({ ...validPayload(), desktopImageUrl: '' })).toThrow(
        /desktopImageUrl é obrigatório/i,
      );
    });

    it('PATCH parcial (so reordenar) nao exige name/desktopImageUrl de novo', async () => {
      prisma.storeBanner.findUnique.mockResolvedValue({ id: 'b1', desktopImageUrl: '/uploads/x.jpg', mobileImageUrl: null });
      await expect(service.update('b1', { order: 3 })).resolves.toBeDefined();
    });

    it('PATCH que troca o slot pra category exige targetCategory mesmo sem tocar outros campos', async () => {
      prisma.storeBanner.findUnique.mockResolvedValue({ id: 'b1', desktopImageUrl: '/uploads/x.jpg', mobileImageUrl: null });
      await expect(service.update('b1', { slot: 'category' })).rejects.toThrow(/targetCategory é obrigatório/i);
    });
  });
});
