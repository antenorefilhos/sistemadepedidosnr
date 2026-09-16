import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiBearerAuth } from '@nestjs/swagger'
import axios from 'axios'
import { promises as fs } from 'fs'
import net from 'net'
import { join } from 'path'
import { PrismaService } from '../../common/prisma.service'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'
import { requireEnv } from '../../common/require-env'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { IntegrationModulesService } from './integration-modules.service'

interface ServiceStatus {
  status: 'ok' | 'degraded' | 'down'
  latencyMs?: number
  detail?: string
}

interface HealthReport {
  status: 'ok' | 'degraded' | 'down'
  timestamp: string
  version: string
  services: {
    database: ServiceStatus
    redis: ServiceStatus
    meilisearch: ServiceStatus
    solidcom: ServiceStatus
    paymentsGateway: ServiceStatus
    queue: ServiceStatus
    storage: ServiceStatus
  }
}

// JON-111 (Auditoria 360, Medium): endpoint sem auth disparava probe real de
// banco/rede/ERP a CADA chamada, sob o bucket default (600/min) -- visitante
// anonimo amplificava consulta pesada ao Solidcom (GetProdutos, ~10s) e via
// path de armazenamento/mensagens de erro internas na resposta. Agora exige
// admin e cacheia o resultado por CACHE_TTL_MS (single-flight: chamadas
// concorrentes dentro da janela reaproveitam a mesma promise em voo).
const CACHE_TTL_MS = 10_000

@RelaxedThrottle()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('health/detail')
export class HealthController {
  private cached: { at: number; report: HealthReport } | null = null
  private inFlight: Promise<HealthReport> | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationModules: IntegrationModulesService,
  ) {}

  @Get()
  @ApiBearerAuth()
  async check(): Promise<HealthReport> {
    if (this.cached && Date.now() - this.cached.at < CACHE_TTL_MS) {
      return this.cached.report
    }
    if (this.inFlight) return this.inFlight

    this.inFlight = this.runChecks().finally(() => {
      this.inFlight = null
    })
    const report = await this.inFlight
    this.cached = { at: Date.now(), report }
    return report
  }

  private async runChecks(): Promise<HealthReport> {
    const [database, redis, meilisearch, solidcom, paymentsGateway, queue, storage] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkMeilisearch(),
      this.checkSolidcom(),
      this.checkPaymentsGateway(),
      this.checkQueue(),
      this.checkStorage(),
    ])

    // JON-111: reason de uma promise rejeitada pode carregar stack/mensagem
    // interna (path, connection string) -- generico em vez de String(reason).
    const resolve = (result: PromiseSettledResult<ServiceStatus>): ServiceStatus =>
      result.status === 'fulfilled' ? result.value : { status: 'down', detail: 'falha inesperada na checagem' }

    const services = {
      database: resolve(database),
      redis: resolve(redis),
      meilisearch: resolve(meilisearch),
      solidcom: resolve(solidcom),
      paymentsGateway: resolve(paymentsGateway),
      queue: resolve(queue),
      storage: resolve(storage),
    }

    const statuses = Object.values(services).map((s) => s.status)
    const overallStatus: HealthReport['status'] = statuses.includes('down')
      ? 'down'
      : statuses.includes('degraded')
      ? 'degraded'
      : 'ok'

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.17.0-alpha',
      services,
    }
  }

  private async checkDatabase(): Promise<ServiceStatus> {
    const start = Date.now()
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return { status: 'ok', latencyMs: Date.now() - start }
    } catch {
      return { status: 'down', latencyMs: Date.now() - start, detail: 'PostgreSQL unreachable' }
    }
  }

  private async checkRedis(): Promise<ServiceStatus> {
    const start = Date.now()
    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379'
    const url = new URL(redisUrl)
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection(Number(url.port || 6379), url.hostname)
        socket.setTimeout(2000)
        socket.once('connect', () => {
          socket.end()
          resolve()
        })
        socket.once('timeout', () => {
          socket.destroy()
          reject(new Error('Redis timeout'))
        })
        socket.once('error', reject)
      })
      return { status: 'ok', latencyMs: Date.now() - start }
    } catch {
      return { status: 'down', latencyMs: Date.now() - start, detail: 'Redis unreachable' }
    }
  }

  private async checkMeilisearch(): Promise<ServiceStatus> {
    const start = Date.now()
    const host = process.env.MEILI_HOST || 'http://meili:7700'
    try {
      const res = await axios.get(`${host}/health`, { timeout: 3000 })
      const ok = res.data?.status === 'available'
      return { status: ok ? 'ok' : 'degraded', latencyMs: Date.now() - start }
    } catch {
      return { status: 'down', latencyMs: Date.now() - start, detail: 'MeiliSearch unreachable' }
    }
  }

  // JON-110 (Auditoria 360, Medium): catalogo prioriza AntenorApi quando
  // habilitada (products.service.ts, resolveCatalogSource) mas este check
  // sempre consultava SOLIDCOM_API_URL/GetProdutos -- painel podia mostrar
  // ERP saudavel com o provedor ATIVO fora do ar (nunca consultado), ou
  // marcar down por um legado que nao influencia mais o catalogo.
  private async resolveActiveErpProvider(): Promise<'antenorapi' | 'solidcom' | null> {
    if (await this.integrationModules.isEnabled('antenorapi')) return 'antenorapi'
    if (await this.integrationModules.isEnabled('solidcom')) return 'solidcom'
    return null
  }

  private async checkSolidcom(): Promise<ServiceStatus> {
    const start = Date.now()
    const provider = await this.resolveActiveErpProvider()
    if (!provider) {
      return { status: 'ok', latencyMs: Date.now() - start, detail: 'nenhum conector de ERP habilitado' }
    }
    if (provider === 'antenorapi') return this.checkAntenorApi(start)
    return this.checkSolidcomLegacy(start)
  }

  private async checkAntenorApi(start: number): Promise<ServiceStatus> {
    const url = requireEnv('ANTENOR_API_URL')
    try {
      await axios.get(`${url}/health`, { timeout: 5000 })
      return { status: 'ok', latencyMs: Date.now() - start }
    } catch (err) {
      const latencyMs = Date.now() - start
      if (axios.isAxiosError(err) && err.response) {
        return { status: 'degraded', latencyMs, detail: `HTTP ${err.response.status}` }
      }
      return { status: 'down', latencyMs, detail: 'AntenorApi unreachable' }
    }
  }

  private async checkSolidcomLegacy(start: number): Promise<ServiceStatus> {
    // requireEnv aqui dentro (nao no boot): faltando a config, o health check
    // reporta o Solidcom como indisponivel em vez de derrubar a API inteira.
    const url = requireEnv('SOLIDCOM_API_URL', process.env.ERP_API_URL)
    try {
      // GetProdutos e um endpoint pesado do Solidcom (ver docs/solidcom-api.md) --
      // mesmo com limit=1 respondeu ~9.7s a partir da VPS de producao. 5s
      // marcava "down" um ERP que na verdade estava respondendo normal; o sync
      // de verdade (solidcom-erp.service.ts) ja usa 15-30s pros mesmos endpoints.
      await axios.get(`${url}/api/Produto/GetProdutos?ativo=true&limit=1`, { timeout: 15000 })
      return { status: 'ok', latencyMs: Date.now() - start }
    } catch (err) {
      const latencyMs = Date.now() - start
      if (axios.isAxiosError(err) && err.response) {
        return { status: 'degraded', latencyMs, detail: `HTTP ${err.response.status}` }
      }
      return { status: 'down', latencyMs, detail: 'Solidcom unreachable' }
    }
  }

  private async checkPaymentsGateway(): Promise<ServiceStatus> {
    const start = Date.now()
    const enabled = String(process.env.ENABLE_PAYMENTS_INTEGRATION || process.env.INTEGRATION_PAYMENTS_ENABLED || '').toLowerCase() === 'true'
    const url = process.env.PAYMENTS_PROVIDER_URL
    if (!enabled) return { status: 'ok', latencyMs: Date.now() - start, detail: 'payments gateway disabled' }
    if (!url) return { status: 'down', latencyMs: Date.now() - start, detail: 'PAYMENTS_PROVIDER_URL missing' }

    try {
      await axios.get(url, { timeout: 3000 })
      return { status: 'ok', latencyMs: Date.now() - start }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        return { status: 'degraded', latencyMs: Date.now() - start, detail: `HTTP ${err.response.status}` }
      }
      return { status: 'down', latencyMs: Date.now() - start, detail: 'payments gateway unreachable' }
    }
  }

  private async checkQueue(): Promise<ServiceStatus> {
    const start = Date.now()
    const pending = await this.prisma.outboxEvent.count({ where: { status: { in: ['PENDING', 'FAILED'] } } })
    const deadLetters = await this.prisma.integrationDeadLetter.count({ where: { resolvedAt: null } })
    const status: ServiceStatus['status'] = deadLetters > 0 ? 'degraded' : 'ok'
    return { status, latencyMs: Date.now() - start, detail: `pending=${pending}; deadLetters=${deadLetters}` }
  }

  private async checkStorage(): Promise<ServiceStatus> {
    const start = Date.now()
    const uploadPath = process.env.UPLOADS_DIR || join(process.cwd(), 'uploads')
    try {
      await fs.mkdir(uploadPath, { recursive: true })
      await fs.access(uploadPath)
      return { status: 'ok', latencyMs: Date.now() - start }
    } catch {
      // JON-111: nao devolver o path real do filesystem interno.
      return { status: 'down', latencyMs: Date.now() - start, detail: 'storage unavailable' }
    }
  }
}
