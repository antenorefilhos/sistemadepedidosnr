// M33.2 Alert Rules Types
export interface AlertRule {
  id: string
  metric: 'conversionRate' | 'cartAbandonRate' | 'revenue' | 'orders' | 'noResultRate'
  comparisonType: 'absolute' | 'percentChange'
  threshold: number
  operator: 'below' | 'above' | 'equals'
  enabled: boolean
  description?: string
  createdAt: string
  updatedAt: string
}

export interface AlertTriggered {
  id: string
  ruleId: string
  rule: AlertRule
  severity: 'warning' | 'critical'
  value: number
  periodDays: number
  triggeredAt: string
  adminSeenAt: string | null
  notes?: string
  createdAt: string
}

export interface DeltaMetric {
  current: number
  previous: number
  delta: number
  deltaPercent: number
}
