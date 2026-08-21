import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface BrandConfigDto {
  storeName?: string;
  logoDesktopUrl?: string | null;
  logoMobileUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  contactWhatsapp?: string | null;
  freeShippingThreshold?: number | null;
  businessHours?: string | null;
  openMessage?: string | null;
  closedMessage?: string | null;
  countdownLabel?: string | null;
}

const SINGLETON_ID = 'singleton';

const DEFAULTS: BrandConfigDto = {
  storeName: 'Antenor & Filhos',
  primaryColor: '#5D082A',
  secondaryColor: '#D2BB8A',
  logoDesktopUrl: null,
  logoMobileUrl: null,
  contactWhatsapp: null,
  freeShippingThreshold: null,
  businessHours: null,
  openMessage: null,
  closedMessage: null,
  countdownLabel: null,
};

@Injectable()
export class BrandService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const record = await this.prisma.brandConfig.findUnique({
      where: { id: SINGLETON_ID },
    });
    const base = record ?? { id: SINGLETON_ID, ...DEFAULTS, createdAt: new Date(), updatedAt: new Date() };
    // CNPJ emitente ja e configuracao real usada para emissao de NF-e (ver
    // integrations.service.ts) -- reaproveitado aqui so pra exibicao no
    // rodape, sem duplicar a fonte de verdade.
    const cnpj = process.env.NFE_CNPJ_EMITENTE || process.env.SOLIDCOM_CNPJ || null;
    return { ...base, cnpj };
  }

  async upsert(dto: BrandConfigDto) {
    return this.prisma.brandConfig.upsert({
      where: { id: SINGLETON_ID },
      update: dto,
      create: { id: SINGLETON_ID, ...DEFAULTS, ...dto },
    });
  }
}
