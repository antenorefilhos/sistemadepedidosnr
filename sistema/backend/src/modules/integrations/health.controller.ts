import { Controller, Get } from '@nestjs/common'
import axios from 'axios'
import { promises as fs } from 'fs'
import net from 'net'
import { join } from 'path'
import { PrismaService } from '../../common/prisma.service'

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

@Controller('health/detail')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthReport> {
    const [database, redis, meilisearch, solidcom, paymentsGateway, queue, storage] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkMeilisearch(),
      this.checkSolidcom(),
      this.checkPaymentsGateway(),
      this.checkQueue(),
      this.checkStorage(),
    ])

    const resolve = (result: PromiseSettledResult<ServiceStatus>): ServiceStatus =>
      result.status === 'fulfilled'
        ? result.value
        : { status: 'down', detail: String((result as PromiseRejectedResult).reason) }

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

  private async checkSolidcom(): Promise<ServiceStatus> {
    const start = Date.now()
    const url = process.env.SOLIDCOM_API_URL || process.env.ERP_API_URL || 'http://45.239.193.56:5000'
    try {
      await axios.get(`${url}/api/Produto/GetProdutos?ativo=true&limit=1`, { timeout: 5000 })
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
      return { status: 'ok', latencyMs: Date.now() - start, detail: uploadPath }
    } catch {
      return { status: 'down', latencyMs: Date.now() - start, detail: `storage unavailable: ${uploadPath}` }
    }
  }
}
