import { ArrowUpRight, ArrowDownLeft, Minus } from 'lucide-react';

interface DeltaMetric {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number;
}

interface PeriodComparisonProps {
  metric: DeltaMetric;
  label: string;
  isCurrency?: boolean;
  isPercentage?: boolean;
}

export function PeriodComparison({
  metric,
  label,
  isCurrency = false,
  isPercentage = false,
}: PeriodComparisonProps) {
  const formatValue = (value: number) => {
    if (isCurrency) {
      return `R$ ${value.toFixed(2).replace('.', ',')}`;
    }
    if (isPercentage) {
      return `${value.toFixed(2)}%`;
    }
    return value.toFixed(2);
  };

  const isPositive = metric.delta > 0;
  const isNeutral = metric.delta === 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{label}</span>
        <div className="flex items-center gap-1">
          {!isNeutral && (
            <>
              {isPositive ? (
                <ArrowUpRight className="w-4 h-4 text-green-600" />
              ) : (
                <ArrowDownLeft className="w-4 h-4 text-red-600" />
              )}
              <span
                className={`text-sm font-medium ${
                  isPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {isPositive ? '+' : ''}{metric.deltaPercent.toFixed(1)}%
              </span>
            </>
          )}
          {isNeutral && <Minus className="w-4 h-4 text-gray-400" />}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">
          {formatValue(metric.current)}
        </span>
        <span className="text-xs text-gray-500">
          vs {formatValue(metric.previous)}
        </span>
      </div>
    </div>
  );
}
