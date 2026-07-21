import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { AlertRule, AlertTriggered } from '@prisma/client'

export interface CreateAlertRuleDto {
  metric: string // conversionRate, cartAbandonRate, revenue, orders, noResultRate
  comparisonType: string // absolute, percentChange
  threshold: number
  operator: string // below, above, equals
  enabled?: boolean
  description?: string
}

export interface UpdateAlertRuleDto {
  metric?: string
  comparisonType?: string
  threshold?: number
  operator?: string
  enabled?: boolean
  description?: string
}

export interface AlertCheckResult {
  triggered: boolean
  severity: 'warning' | 'critical'
  value: number
  ruleId: string
}

@Injectable()
export class AlertRuleService {
  constructor(private readonly prisma: PrismaService) {}

  async createRule(dto: CreateAlertRuleDto): Promise<AlertRule> {
    return this.prisma.alertRule.create({
      data: {
        metric: dto.metric,
        comparisonType: dto.comparisonType,
        threshold: dto.threshold,
        operator: dto.operator,
        enabled: dto.enabled ?? true,
        description: dto.description,
      },
    })
  }

  async updateRule(ruleId: string, dto: UpdateAlertRuleDto): Promise<AlertRule> {
    return this.prisma.alertRule.update({
      where: { id: ruleId },
      data: dto,
    })
  }

  async deleteRule(ruleId: string): Promise<AlertRule> {
    return this.prisma.alertRule.delete({
      where: { id: ruleId },
    })
  }

  async getRules(): Promise<AlertRule[]> {
    return this.prisma.alertRule.findMany({
      orderBy: { createdAt: 'desc' },
    })
  }

  async getRule(ruleId: string): Promise<AlertRule | null> {
    return this.prisma.alertRule.findUnique({
      where: { id: ruleId },
    })
  }

  /**
   * Verifica se um valor atual vs. anterior viola uma regra de alerta
   * @param rule Regra de alerta
   * @param currentValue Valor do período atual
   * @param previousValue Valor do período anterior (para cálculo de delta)
   * @returns AlertCheckResult com informação de se o alerta foi disparado
   */
  async checkAlertTrigger(
    rule: AlertRule,
    currentValue: number,
    previousValue: number,
  ): Promise<AlertCheckResult> {
    if (!rule.enabled) {
      return {
        triggered: false,
        severity: 'warning',
        value: currentValue,
        ruleId: rule.id,
      }
    }

    let valueToCheck = currentValue

    // Se é comparação por % change, calcula a diferença percentual
    if (rule.comparisonType === 'percentChange' && previousValue !== 0) {
      valueToCheck = ((currentValue - previousValue) / previousValue) * 100
    }

    let triggered = false
    switch (rule.operator) {
      case 'below':
        triggered = valueToCheck < rule.threshold
        break
      case 'above':
        triggered = valueToCheck > rule.threshold
        break
      case 'equals':
        triggered = valueToCheck === rule.threshold
        break
    }

    return {
      triggered,
      severity: Math.abs(valueToCheck - rule.threshold) > 10 ? 'critical' : 'warning',
      value: valueToCheck,
      ruleId: rule.id,
    }
  }

  /**
   * Registra um alerta disparado no banco de dados
   */
  async recordTriggeredAlert(
    ruleId: string,
    severity: 'warning' | 'critical',
    value: number,
    periodDays: number = 7,
  ): Promise<AlertTriggered> {
    return this.prisma.alertTriggered.create({
      data: {
        ruleId,
        severity,
        value,
        periodDays,
      },
      include: {
        rule: true,
      },
    })
  }

  /**
   * Obtém alertas acionados não vistos pelo admin
   */
  async getUnseenAlerts(): Promise<AlertTriggered[]> {
    return this.prisma.alertTriggered.findMany({
      where: {
        adminSeenAt: null,
      },
      include: {
        rule: true,
      },
      orderBy: { triggeredAt: 'desc' },
    })
  }

  /**
   * Marca um alerta como visto
   */
  async markAlertAsSeen(alertId: string, notes?: string): Promise<AlertTriggered> {
    return this.prisma.alertTriggered.update({
      where: { id: alertId },
      data: {
        adminSeenAt: new Date(),
        notes,
      },
      include: {
        rule: true,
      },
    })
  }

  /**
   * Obtém histórico de alertas
   */
  async getAlertHistory(limit: number = 50): Promise<AlertTriggered[]> {
    return this.prisma.alertTriggered.findMany({
      include: {
        rule: true,
      },
      orderBy: { triggeredAt: 'desc' },
      take: limit,
    })
  }
}
