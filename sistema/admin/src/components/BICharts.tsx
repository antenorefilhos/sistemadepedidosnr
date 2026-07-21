import Chart from 'react-apexcharts';
import { SalesAnalyticsPoint, StatusAnalyticsResponse, TopProductAnalyticsItem } from '../services/api';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Preparando',
  READY: 'Pronto',
  DELIVERING: 'Em Rota',
  DELIVERED: 'Entregue',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#EAB308',
  CONFIRMED: '#3B82F6',
  PREPARING: '#8B5CF6',
  READY: '#EC4899',
  DELIVERING: '#06B6D4',
  DELIVERED: '#10B981',
  COMPLETED: '#D2BB8A',
  CANCELLED: '#EF4444',
};

export function SalesChart({ salesData, period }: { salesData: SalesAnalyticsPoint[], period: string }) {
  const options: ApexCharts.ApexOptions = {
    chart: {
      id: 'sales-chart',
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: 'Outfit, sans-serif',
    },
    colors: ['#D2BB8A'],
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [20, 100],
      },
    },
    xaxis: {
      categories: salesData.map(d => {
        const date = new Date(d.date + 'T12:00:00');
        return period === 'day'
          ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      }),
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { formatter: (val) => `R$ ${val.toFixed(0)}` },
    },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (val) => `R$ ${val.toFixed(2)}` } },
    grid: { borderColor: '#f1f1f1', strokeDashArray: 4 },
  };

  const series = [{ name: 'Vendas', data: salesData.map(d => d.total) }];

  return (
    <Chart options={options} series={series} type="area" height={300} />
  );
}

export function StatusDonutChart({ statusData }: { statusData: StatusAnalyticsResponse | null }) {
  if (!statusData) return null;

  const options: ApexCharts.ApexOptions = {
    chart: { fontFamily: 'Outfit, sans-serif' },
    labels: statusData.data.map(d => STATUS_LABELS[d.status] || d.status),
    colors: statusData.data.map(d => STATUS_COLORS[d.status] || '#CBD5E1'),
    legend: { position: 'bottom' },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total',
              formatter: () => String(statusData.total),
            },
          },
        },
      },
    },
    dataLabels: { enabled: false },
  };

  const series = statusData.data.map(d => d.count);

  return (
    <Chart options={options} series={series} type="donut" height={300} />
  );
}

export function TopProductsChart({ topProducts }: { topProducts: TopProductAnalyticsItem[] }) {
  const options: ApexCharts.ApexOptions = {
    chart: { toolbar: { show: false }, fontFamily: 'Outfit, sans-serif' },
    plotOptions: {
      bar: { borderRadius: 4, horizontal: true, distributed: true, barHeight: '60%' },
    },
    colors: ['#D2BB8A', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B'],
    xaxis: {
      categories: topProducts.map(p => p.name.length > 20 ? p.name.substring(0, 17) + '...' : p.name),
    },
    legend: { show: false },
    dataLabels: {
      enabled: true,
      textAnchor: 'start',
      style: { colors: ['#fff'] },
      formatter: (val, opt) => {
        const labels = opt?.w?.globals?.labels;
        const index = opt?.dataPointIndex;
        if (labels && index !== undefined) return `${labels[index]}: ${val}`;
        return String(val);
      },
      offsetX: 0,
    },
  };

  const series = [{ name: 'Quantidade', data: topProducts.map(p => p.quantity) }];

  return (
    <Chart options={options} series={series} type="bar" height={300} />
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHASE 17 — Analytics Pro Charts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ConversionFunnelData {
  views: number;
  addedToCart: number;
  checkoutStarted: number;
  purchased: number;
}

export function ConversionFunnelChart({ data }: { data: ConversionFunnelData }) {
  const stages = [
    { label: 'Visualizações', value: data.views, color: '#3B82F6' },
    { label: 'Adicionou ao Carrinho', value: data.addedToCart, color: '#8B5CF6' },
    { label: 'Iniciou Checkout', value: data.checkoutStarted, color: '#F59E0B' },
    { label: 'Finalizou Compra', value: data.purchased, color: '#D2BB8A' },
  ];

  const maxValue = Math.max(data.views, data.addedToCart, data.checkoutStarted, data.purchased, 1);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <h3 className="text-lg font-bold text-gray-800 mb-2">Funil de Conversão</h3>
      <p className="text-xs text-gray-400 mb-6">Jornada do cliente do produto à compra</p>
      <div className="space-y-3">
        {stages.map((stage, i) => {
          const pct = maxValue > 0 ? ((stage.value / maxValue) * 100).toFixed(1) : '0.0';
          const previousValue = i > 0 ? stages[i - 1].value : null;
          const changePct = previousValue !== null && previousValue > 0
            ? Number((((stage.value - previousValue) / previousValue) * 100).toFixed(0))
            : null;
          const changeLabel = changePct === null
            ? null
            : `${changePct > 0 ? '+' : ''}${changePct}%`;
          const changeClassName = changePct !== null && changePct > 0
            ? 'text-emerald-500'
            : 'text-red-400';

          return (
            <div key={stage.label}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600 font-medium">{stage.label}</span>
                <div className="flex items-center gap-3">
                  {changeLabel && (
                    <span className={`text-xs font-medium ${changeClassName}`}>{changeLabel}</span>
                  )}
                  <span className="text-sm font-bold text-gray-800">{stage.value.toLocaleString('pt-BR')}</span>
                  <span className="text-xs text-gray-400 w-12 text-right">{pct}%</span>
                </div>
              </div>
              <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                <div
                  className="h-full rounded-lg transition-all duration-700 flex items-center justify-end pr-2"
                  style={{ width: `${pct}%`, backgroundColor: stage.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface CategoryRevenueData {
  category: string;
  revenue: number;
  orders: number;
}

export function CategoryRevenueChart({ data }: { data: CategoryRevenueData[] }) {
  if (!data.length) return null;

  const CATEGORY_LABELS: Record<string, string> = {
    CHURRASCO: '🔥 Churrasco',
    BEBIDAS: '🍺 Bebidas',
    PADARIA: '🥖 Padaria',
    CARNES_DIA_A_DIA: '🥩 Carnes',
    GULOSEIMAS: '🍪 Guloseimas',
    CONSUMO_RAPIDO: '🍔 Rápidos',
    GERAL: '📦 Geral',
  };

  const options: ApexCharts.ApexOptions = {
    chart: { toolbar: { show: false }, fontFamily: 'Outfit, sans-serif' },
    colors: ['#5D082A', '#D2BB8A', '#4a0622', '#3B82F6', '#8B5CF6', '#F59E0B', '#06B6D4'],
    labels: data.map(d => CATEGORY_LABELS[d.category] || d.category),
    legend: { position: 'bottom', fontSize: '12px' },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => `${val.toFixed(0)}%`,
    },
    tooltip: {
      y: {
        formatter: (value: number) => {
          return `R$ ${value.toFixed(2)}`;
        },
      },
    },
  };

  const series = data.map(d => d.revenue);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <h3 className="text-lg font-bold text-gray-800 mb-1">Receita por Categoria</h3>
      <p className="text-xs text-gray-400 mb-4">Participação de cada departamento no faturamento</p>
      <Chart options={options} series={series} type="pie" height={320} />
    </div>
  );
}

export interface CustomerOriginData {
  origin: string;
  count: number;
}

export function CustomerOriginChart({ data }: { data: CustomerOriginData[] }) {
  if (!data.length) return null;

  const ORIGIN_LABELS: Record<string, string> = {
    instagram: '📸 Instagram',
    whatsapp: '💬 WhatsApp',
    google: '🔍 Google',
    friend: '👥 Indicação',
    store: '🏬 Na Loja',
    other: '📌 Outros',
  };

  const options: ApexCharts.ApexOptions = {
    chart: { toolbar: { show: false }, fontFamily: 'Outfit, sans-serif' },
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: '55%',
        distributed: true,
      },
    },
    colors: ['#5D082A', '#D2BB8A', '#4a0622', '#3B82F6', '#8B5CF6', '#F59E0B'],
    xaxis: {
      categories: data.map(d => ORIGIN_LABELS[d.origin] || d.origin),
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { formatter: (val) => String(Math.round(val)) } },
    legend: { show: false },
    dataLabels: {
      enabled: true,
      style: { colors: ['#fff'], fontWeight: '700' },
    },
    tooltip: { y: { formatter: (val) => `${val} clientes` } },
    grid: { borderColor: '#f5f5f5', strokeDashArray: 4 },
  };

  const series = [{ name: 'Clientes', data: data.map(d => d.count) }];

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <h3 className="text-lg font-bold text-gray-800 mb-1">Canal de Aquisição</h3>
      <p className="text-xs text-gray-400 mb-4">Como os clientes chegaram até nós</p>
      <Chart options={options} series={series} type="bar" height={280} />
    </div>
  );
}

export interface RevenueHeatmapData {
  dayOfWeek: number;       // 0=Dom … 6=Sab
  hourOfDay: number;       // 0‒23
  total: number;
}

export function RevenueHeatmap({ data }: { data: RevenueHeatmapData[] }) {
  const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}h`);

  // Build series: one series per day label, 24 data points (hours)
  const series = DAYS.map((day, dayIndex) => ({
    name: day,
    data: HOURS.map((_, hour) => {
      const found = data.find(d => d.dayOfWeek === dayIndex && d.hourOfDay === hour);
      return { x: HOURS[hour], y: found ? Math.round(found.total) : 0 };
    }),
  }));

  const options: ApexCharts.ApexOptions = {
    chart: { toolbar: { show: false }, fontFamily: 'Outfit, sans-serif' },
    dataLabels: { enabled: false },
    colors: ['#5D082A'],
    xaxis: {
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { fontSize: '10px' } },
    },
    yaxis: { labels: { style: { fontSize: '11px' } } },
    tooltip: { y: { formatter: (val) => `R$ ${val.toFixed(2)}` } },
    plotOptions: {
      heatmap: {
        radius: 4,
        colorScale: {
          ranges: [
            { from: 0, to: 0, color: '#F3F4F6', name: 'Nenhum' },
            { from: 1, to: 500, color: '#FCA5A5', name: 'Baixo' },
            { from: 501, to: 2000, color: '#F87171', name: 'Médio' },
            { from: 2001, to: 999999, color: '#5D082A', name: 'Alto' },
          ],
        },
      },
    },
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <h3 className="text-lg font-bold text-gray-800 mb-1">Mapa de Calor — Vendas por Hora</h3>
      <p className="text-xs text-gray-400 mb-4">Quando seus clientes mais compram</p>
      <Chart options={options} series={series} type="heatmap" height={250} />
    </div>
  );
}
