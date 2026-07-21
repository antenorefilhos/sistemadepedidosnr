import { Controller, Post, Body, Get, UseGuards, Query, Patch, Delete, Param, Res } from '@nestjs/common';
import { Response } from 'express'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AlertRuleService, CreateAlertRuleDto, UpdateAlertRuleDto } from './alert-rule.service';
import { ExecutiveReportService } from './executive-report.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly alertRuleService: AlertRuleService,
    private readonly executiveReportService: ExecutiveReportService,
  ) {}

  @Post('track')
  @ApiOperation({ summary: 'Registra um evento de comportamento do usuário' })
  async track(@Body() data: any) {
    return this.analyticsService.trackEvent(data);
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Lista produtos mais vendidos para vitrine publica' })
  async getTopProducts(@Query('limit') limit?: string) {
    return this.analyticsService.getTopSellingProducts(Number(limit) || 8);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/insights')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtém insights de BI do sistema (Dashboard Admin)' })
  async getInsights() {
    return this.analyticsService.getBiInsights();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('funnel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtém dados do funil de conversão' })
  async getFunnel() {
    return this.analyticsService.getFunnel();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('events')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista eventos de analytics (admin)' })
  async listEvents(@Query('limit') limit?: string) {
    return this.analyticsService.listEvents(Number(limit) || 1000);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/search-insights')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Métricas de busca (termos, sem resultado, uso de sugestão)' })
  async getSearchInsights(@Query('days') days?: string, @Query('limit') limit?: string) {
    return this.analyticsService.getSearchInsights(Number(days) || 14, Number(limit) || 10);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('funnel-compare')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Funil de conversão com comparativo de período' })
  async getFunnelWithComparison(@Query('days') days?: string) {
    return this.analyticsService.getFunnelWithComparison(Number(days) || 7);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('insights-compare')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'KPIs de receita e pedidos com comparativo de período' })
  async getBiInsightsWithComparison(@Query('days') days?: string) {
    return this.analyticsService.getBiInsightsWithComparison(Number(days) || 7);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin/metric-snapshots/generate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gera snapshots de BI operacional por periodo, loja, canal, produto e categoria' })
  async generateMetricSnapshots(
    @Query('tenantId') tenantId?: string,
    @Query('storeId') storeId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('days') days?: string,
  ) {
    return this.analyticsService.generateMetricSnapshots({ tenantId, storeId, from, to, days: Number(days) || 7 });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/operational-dashboard')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dashboards executivo, operacional, catalogo, ruptura, picking, integracoes, CRM e pagamentos' })
  async getOperationalDashboard(
    @Query('tenantId') tenantId?: string,
    @Query('storeId') storeId?: string,
    @Query('dashboard') dashboard?: string,
    @Query('days') days?: string,
  ) {
    return this.analyticsService.getOperationalDashboard({ tenantId, storeId, dashboard, days: Number(days) || 7 });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/drilldown')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Drill-down de metricas por loja, categoria, produto e canal' })
  async drillDownMetric(
    @Query('tenantId') tenantId?: string,
    @Query('storeId') storeId?: string,
    @Query('metric') metric?: string,
    @Query('dashboard') dashboard?: string,
    @Query('dimension') dimension?: string,
    @Query('dimensionValue') dimensionValue?: string,
    @Query('channel') channel?: string,
    @Query('productId') productId?: string,
    @Query('category') category?: string,
    @Query('days') days?: string,
  ) {
    return this.analyticsService.drillDownMetric({
      tenantId,
      storeId,
      metric,
      dashboard,
      dimension,
      dimensionValue,
      channel,
      productId,
      category,
      days: Number(days) || 30,
    });
  }

  // M33.2 — Alert Rules Management
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('alert-rules')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'M33.2: Cria nova regra de alerta automático' })
  async createAlertRule(@Body() dto: CreateAlertRuleDto) {
    return this.alertRuleService.createRule(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('alert-rules')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'M33.2: Lista todas as regras de alerta' })
  async getAlertRules() {
    return this.alertRuleService.getRules();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('alert-rules/:ruleId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'M33.2: Obtém detalhes de uma regra de alerta' })
  async getAlertRule(@Param('ruleId') ruleId: string) {
    return this.alertRuleService.getRule(ruleId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('alert-rules/:ruleId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'M33.2: Atualiza regra de alerta' })
  async updateAlertRule(@Param('ruleId') ruleId: string, @Body() dto: UpdateAlertRuleDto) {
    return this.alertRuleService.updateRule(ruleId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('alert-rules/:ruleId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'M33.2: Deleta regra de alerta' })
  async deleteAlertRule(@Param('ruleId') ruleId: string) {
    return this.alertRuleService.deleteRule(ruleId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('alerts/unseen')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'M33.2: Obtém alertas não vistos pelo admin' })
  async getUnseenAlerts() {
    return this.alertRuleService.getUnseenAlerts();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('alerts/history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'M33.2: Histórico de alertas disparados' })
  async getAlertHistory(@Query('limit') limit?: string) {
    return this.alertRuleService.getAlertHistory(Number(limit) || 50);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('alerts/:alertId/seen')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'M33.2: Marca alerta como visto pelo admin' })
  async markAlertSeen(@Param('alertId') alertId: string, @Body() body?: { notes?: string }) {
    return this.alertRuleService.markAlertAsSeen(alertId, body?.notes);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('alerts/check-and-trigger')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'M33.2: Verifica e dispara alertas baseado em regras ativas' })
  async checkAndTriggerAlerts(@Query('days') days?: string) {
    return this.analyticsService.checkAndTriggerAlerts(Number(days) || 7);
  }

  // M33.3 — Executive Report
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('report-executive')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'M33.3: Gera relatório executivo semanal' })
  async getExecutiveReport(@Query('week') weekDate?: string, @Query('format') format?: string) {
    const weekStart = weekDate ? new Date(weekDate) : undefined
    const report = await this.executiveReportService.generateWeeklyReport(weekStart)
    return format === 'csv' ? this.executiveReportService.formatAsCSV(report) : report
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('report-executive/download')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'M33.3: Download do relatório em CSV' })
  async downloadExecutiveReport(
    @Query('week') weekDate?: string,
    @Res() res?: Response,
  ) {
    const weekStart = weekDate ? new Date(weekDate) : undefined
    const report = await this.executiveReportService.generateWeeklyReport(weekStart)
    const csv = this.executiveReportService.formatAsCSV(report)

    if (res) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename=relatorio-executivo-${report.period.weekStart}.csv`)
      res.send(csv)
    }
    return csv
  }
}
