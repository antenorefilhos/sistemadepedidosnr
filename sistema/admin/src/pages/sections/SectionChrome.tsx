import type { ReactNode } from 'react'

type SectionToolbarProps = {
  children: ReactNode
  className?: string
}

type SectionPanelProps = {
  children: ReactNode
  className?: string
  bodyClassName?: string
}

type SectionMetricProps = {
  label: string
  value: ReactNode
  tone?: 'default' | 'brand' | 'success' | 'neutral'
}

type SectionEmptyStateProps = {
  title: string
  description?: string
}

const metricToneClassName: Record<NonNullable<SectionMetricProps['tone']>, string> = {
  default: 'border-[#ead7df] bg-white text-[#5d082a]',
  brand: 'border-[#f1dbe3] bg-[#fff7fa] text-[#5d082a]',
  success: 'border-emerald-100 bg-emerald-50 text-emerald-900',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
}

export function SectionToolbar({ children, className = '' }: SectionToolbarProps) {
  return (
    <div className={`rounded-[16px] border border-[#ead7df] bg-[linear-gradient(180deg,#fffafc_0%,#ffffff_100%)] p-4 shadow-[0_18px_40px_rgba(93,8,42,0.08)] sm:p-6 ${className}`.trim()}>
      {children}
    </div>
  )
}

export function SectionPanel({ children, className = '', bodyClassName = '' }: SectionPanelProps) {
  return (
    <div className={`overflow-hidden rounded-[16px] border border-[#ead7df] bg-white shadow-[0_18px_40px_rgba(93,8,42,0.08)] ${className}`.trim()}>
      <div className={`${bodyClassName}`.trim()}>{children}</div>
    </div>
  )
}

export function SectionMetric({ label, value, tone = 'default' }: SectionMetricProps) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${metricToneClassName[tone]}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-75">{label}</p>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  )
}

export function SectionEmptyState({ title, description }: SectionEmptyStateProps) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[#ead7df] bg-[linear-gradient(180deg,#fffafc_0%,#fff 100%)] px-6 py-10 text-center">
      <p className="text-base font-semibold text-[#5d082a]">{title}</p>
      {description && <p className="mt-2 max-w-md text-sm text-gray-500">{description}</p>}
    </div>
  )
}