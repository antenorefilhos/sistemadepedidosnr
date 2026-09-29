import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AlertRuleService } from './alert-rule.service';
import { ExecutiveReportService } from './executive-report.service';
import { DashboardOverviewService } from './dashboard-overview.service';
import { DashboardOverviewController } from './dashboard-overview.controller';
import { IntelligenceService } from './intelligence.service';
import { IntelligenceController } from './intelligence.controller';

@Module({
  controllers: [AnalyticsController, DashboardOverviewController, IntelligenceController],
  providers: [AnalyticsService, AlertRuleService, ExecutiveReportService, DashboardOverviewService, IntelligenceService],
  exports: [AnalyticsService, AlertRuleService, ExecutiveReportService],
})
export class AnalyticsModule {}
