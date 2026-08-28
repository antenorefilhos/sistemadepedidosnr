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

// Dados oficiais de cadastro da empresa -- fixos, nao mudam com frequencia e
// nao tem tela de admin dedicada (ver TASK_DEV_FOOTER_LEGAL_PAGES_REFINED.md).
// O CNPJ fica aqui de proposito, diferente dos identificadores de integracao
// (SOLIDCOM_CNPJ e SOLIDCOM_BALCAO_CPF), que em 28/08/2026 passaram a ser
// obrigatorios via ambiente e sem valor embutido. A diferenca: estes dados sao
// publicados pela propria loja no rodape e nas paginas legais -- publica-los
// nao vaza nada, e exigir env aqui derrubaria o storefront por uma constante
// de exibicao. Regra de bolso: identificador que autentica ou enderecca uma
// integracao vai pro ambiente; dado que o site ja mostra ao mundo, nao.
// Aqui o CNPJ tem 14 digitos (com o zero a esquerda); o SOLIDCOM_CNPJ usa 13,
// porque o ERP deles espera numero.
const LEGAL_INFO = {
  cnpj: '05147995000131',
  legalName: 'Nova Real Comércio de Produtos Alimentícios LTDA',
  stateRegistration: '77.403.31-0',
  addressNumber: '22.099',
  addressCep: '25750-222',
  phoneFixed: '(24) 2237-7205',
  whatsappSecondary: '5524992935303',
  emailCommercial: 'antenorefilhos@hotmail.com',
  emailDpo: 'marketing@antenorefilhos.com.br',
  // Texto fixo de exibicao no rodape -- separado do JSON de janelas
  // (businessHours) que rege o countdown de abertura/entrega ao vivo, porque
  // aquele inclui o intervalo de almoco e nao e o resumo que se mostra ao
  // cliente.
  storeHoursText: 'Loja: Seg a Sáb das 07h às 21h · Dom das 07h às 14h',
  deliveryHoursText: 'Entregas: Seg a Sáb até 20h50 · Dom até 13h50',
  traditionText:
    'Há 47 anos, a Antenor & Filhos atende todos com honestidade, qualidade e muito carinho. ' +
    'Aqui, você encontra carnes frescas e bem selecionadas, atendimento próximo e um cuidado que ' +
    'vai do balcão até a sua mesa. Somos um mercado com alma de mercearia, onde cada cliente é ' +
    'tratado com respeito e atenção. Trabalhamos com produtos de confiança, preços justos e aquele ' +
    'jeitinho que só quem tem história sabe oferecer. Antenor & Filhos — Tradição, qualidade e bom ' +
    'atendimento há gerações.',
};

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
    return { ...base, ...LEGAL_INFO };
  }

  async upsert(dto: BrandConfigDto) {
    return this.prisma.brandConfig.upsert({
      where: { id: SINGLETON_ID },
      update: dto,
      create: { id: SINGLETON_ID, ...DEFAULTS, ...dto },
    });
  }
}
