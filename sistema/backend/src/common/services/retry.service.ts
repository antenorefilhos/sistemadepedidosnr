import { Injectable, Logger } from '@nestjs/common'

interface RetryOptions {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  factor?: number
  shouldRetry?: (error: unknown) => boolean
}

@Injectable()
export class RetryService {
  private readonly logger = new Logger(RetryService.name)

  async execute<T>(
    fn: () => Promise<T>,
    context: string,
    options: RetryOptions = {},
  ): Promise<T> {
    const {
      maxAttempts = 3,
      baseDelayMs = 500,
      maxDelayMs = 10000,
      factor = 2,
      shouldRetry = () => true,
    } = options

    let attempt = 0
    let lastError: unknown

    while (attempt < maxAttempts) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        attempt++

        if (attempt >= maxAttempts || !shouldRetry(error)) {
          this.logger.warn(`[${context}] Falha definitiva após ${attempt} tentativa(s)`)
          throw error
        }

        const delay = Math.min(baseDelayMs * Math.pow(factor, attempt - 1), maxDelayMs)
        const jitter = Math.floor(Math.random() * 200)
        this.logger.warn(`[${context}] Tentativa ${attempt}/${maxAttempts} falhou. Retry em ${delay + jitter}ms`)
        await this.sleep(delay + jitter)
      }
    }

    throw lastError
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
