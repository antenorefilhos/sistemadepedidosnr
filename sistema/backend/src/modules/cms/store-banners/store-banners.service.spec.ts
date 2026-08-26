import { Test, TestingModule } from '@nestjs/testing';
import { StoreBannersService } from './store-banners.service';
import { PrismaService } from '../../../common/prisma.service';

describe('StoreBannersService', () => {
  let service: StoreBannersService;
  let prisma: {
    storeBanner: { findMany: jest.Mock };
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
      storeBanner: { findMany: jest.fn() },
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
});
