import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

export type IntegrationModuleKey =
  | 'solidcom'
  | 'hubspot'
  | 'rdstation'
  | 'meta-pixel'
  | 'nfe'
  | 'payments'

export type IntegrationModuleDescriptor = {
  key: IntegrationModuleKey
  name: string
  enabled: boolean
  removable: boolean
  notes?: string
}

@Injectable()
export class IntegrationModulesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly moduleDefaults: Record<IntegrationModuleKey, Omit<IntegrationModuleDescriptor, 'enabled'>> = {
    solidcom: {
      key: 'solidcom',
      name: 'Solidcom ERP',
      removable: true,
      notes: 'Sincroniza catalogo e pedidos com ERP legado.',
    },
    hubspot: {
      key: 'hubspot',
      name: 'HubSpot CRM',
      removable: true,
      notes: 'Conector CRM plugavel.',
    },
    rdstation: {
      key: 'rdstation',
      name: 'RD Station',
      removable: true,
      notes: 'Automacao de marketing plugavel.',
    },
    'meta-pixel': {
      key: 'meta-pixel',
      name: 'Meta Pixel',
      removable: true,
      notes: 'Telemetria de conversao plugavel.',
    },
    nfe: {
      key: 'nfe',
      name: 'Conector Fiscal NF-e',
      removable: true,
      notes: 'Emissao fiscal desacoplada do dominio.',
    },
    payments: {
      key: 'payments',
      name: 'Conector de Pagamentos',
      removable: true,
      notes: 'Gateway de pagamento opcional (pagamento operacional pode continuar por fora).',
    },
  }

  private readonly envFlagNames: Record<IntegrationModuleKey, string> = {
    solidcom: 'INTEGRATION_SOLIDCOM_ENABLED',
    hubspot: 'INTEGRATION_HUBSPOT_ENABLED',
    rdstation: 'INTEGRATION_RDSTATION_ENABLED',
    'meta-pixel': 'INTEGRATION_META_PIXEL_ENABLED',
    nfe: 'INTEGRATION_NFE_ENABLED',
    payments: 'INTEGRATION_PAYMENTS_ENABLED',
  }

  private readonly envDefaultValues: Record<IntegrationModuleKey, boolean> = {
    solidcom: true,
    hubspot: false,
    rdstation: false,
    'meta-pixel': false,
    nfe: false,
    payments: false,
  }

  private getSupportedKeys(): IntegrationModuleKey[] {
    return Object.keys(this.moduleDefaults) as IntegrationModuleKey[]
  }

  private ensureSupportedKey(key: IntegrationModuleKey) {
    if (!this.moduleDefaults[key]) {
      throw new BadRequestException(`Modulo de integracao nao suportado: ${key}`)
    }
  }

  async list(): Promise<IntegrationModuleDescriptor[]> {
    const keys = this.getSupportedKeys()
    const persisted = await this.prisma.integrationModuleConfig.findMany({
      where: { key: { in: keys } },
    })

    const persistedMap = new Map<IntegrationModuleKey, boolean>()
    for (const item of persisted) {
      const key = item.key as IntegrationModuleKey
      if (this.moduleDefaults[key]) {
        persistedMap.set(key, item.enabled)
      }
    }

    return keys.map((key) => {
      const defaults = this.moduleDefaults[key]
      const enabled = persistedMap.has(key)
        ? Boolean(persistedMap.get(key))
        : this.getFlag(this.envFlagNames[key], this.envDefaultValues[key])

      return {
        ...defaults,
        enabled,
      }
    })
  }

  async isEnabled(key: IntegrationModuleKey): Promise<boolean> {
    this.ensureSupportedKey(key)

    const persisted = await this.prisma.integrationModuleConfig.findUnique({
      where: { key },
      select: { enabled: true },
    })

    if (persisted) return persisted.enabled

    return this.getFlag(this.envFlagNames[key], this.envDefaultValues[key])
  }

  async setEnabled(key: IntegrationModuleKey, enabled: boolean): Promise<IntegrationModuleDescriptor> {
    this.ensureSupportedKey(key)

    await this.prisma.integrationModuleConfig.upsert({
      where: { key },
      update: { enabled },
      create: { key, enabled },
    })

    const defaults = this.moduleDefaults[key]
    return {
      ...defaults,
      enabled,
    }
  }

  private getFlag(name: string, defaultValue: boolean) {
    const raw = String(process.env[name] ?? '').trim().toLowerCase()
    if (!raw) return defaultValue
    if (raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on') return true
    if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') return false
    return defaultValue
  }
}
