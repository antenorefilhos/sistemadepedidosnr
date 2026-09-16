import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AlertRuleService } from './alert-rule.service';
import { ExecutiveReportService } from './executive-report.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AlertRuleService, ExecutiveReportService],
  exports: [AnalyticsService, AlertRuleService, ExecutiveReportService],
})
export class AnalyticsModule {}
