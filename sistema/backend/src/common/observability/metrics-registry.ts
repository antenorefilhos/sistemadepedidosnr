type HttpMetric = {
  method: string
  route: string
  status: number
  durationMs: number
  timestamp: number
}

export class MetricsRegistry {
  private static httpMetrics: HttpMetric[] = []
  private static readonly maxSamples = 10000

  static observeHttp(metric: HttpMetric) {
    this.httpMetrics.push(metric)
    if (this.httpMetrics.length > this.maxSamples) {
      this.httpMetrics.splice(0, this.httpMetrics.length - this.maxSamples)
    }
  }

  static httpSummary(windowMs = 15 * 60 * 1000) {
    const since = Date.now() - windowMs
    const rows = this.httpMetrics.filter((metric) => metric.timestamp >= since)
    const byEndpoint = new Map<string, HttpMetric[]>()

    for (const row of rows) {
      const key = `${row.method} ${row.route}`
      const current = byEndpoint.get(key) || []
      current.push(row)
      byEndpoint.set(key, current)
    }

    const endpoints = [...byEndpoint.entries()].map(([endpoint, values]) => {
      const durations = values.map((value) => value.durationMs).sort((a, b) => a - b)
      const p95Index = Math.max(0, Math.ceil(durations.length * 0.95) - 1)
      const errors5xx = values.filter((value) => value.status >= 500).length
      const critical4xx = values.filter((value) => [400, 401, 403, 409, 422, 429].includes(value.status)).length
      return {
        endpoint,
        count: values.length,
        p95Ms: durations[p95Index] || 0,
        error5xxRate: values.length > 0 ? Number((errors5xx / values.length).toFixed(4)) : 0,
        critical4xxRate: values.length > 0 ? Number((critical4xx / values.length).toFixed(4)) : 0,
      }
    })

    return {
      windowMs,
      totalRequests: rows.length,
      endpoints: endpoints.sort((a, b) => b.count - a.count),
    }
  }

  static prometheus(windowMs = 15 * 60 * 1000) {
    const summary = this.httpSummary(windowMs)
    const lines = [
      '# HELP antenor_http_requests_total Total HTTP requests observed in process memory',
      '# TYPE antenor_http_requests_total counter',
      `antenor_http_requests_total ${summary.totalRequests}`,
      '# HELP antenor_http_endpoint_p95_ms HTTP endpoint p95 latency in milliseconds',
      '# TYPE antenor_http_endpoint_p95_ms gauge',
      '# HELP antenor_http_endpoint_error5xx_rate HTTP endpoint 5xx error rate',
      '# TYPE antenor_http_endpoint_error5xx_rate gauge',
      '# HELP antenor_http_endpoint_critical4xx_rate HTTP endpoint critical 4xx rate',
      '# TYPE antenor_http_endpoint_critical4xx_rate gauge',
    ]

    for (const endpoint of summary.endpoints) {
      const label = endpoint.endpoint.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      lines.push(`antenor_http_endpoint_p95_ms{endpoint="${label}"} ${endpoint.p95Ms}`)
      lines.push(`antenor_http_endpoint_error5xx_rate{endpoint="${label}"} ${endpoint.error5xxRate}`)
      lines.push(`antenor_http_endpoint_critical4xx_rate{endpoint="${label}"} ${endpoint.critical4xxRate}`)
    }

    return `${lines.join('\n')}\n`
  }

  static resetForTests() {
    this.httpMetrics = []
  }
}
