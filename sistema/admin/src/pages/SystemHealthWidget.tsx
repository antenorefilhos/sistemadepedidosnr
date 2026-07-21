import { useEffect, useRef, useState } from 'react'
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react'
import { integrationsAPI, type SystemHealthResponse, type SystemServiceStatus } from '../services/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const SERVICE_LABELS: Record<string, string> = {
  database: 'Banco de dados',
  redis: 'Cache (Redis)',
  meilisearch: 'Busca (Meili)',
  solidcom: 'ERP (Solidcom)',
}

function StatusIcon({ status }: { status: SystemServiceStatus['status'] }) {
  if (status === 'ok') return <CheckCircle2 size={14} className="text-green-600 shrink-0" />
  if (status === 'degraded') return <AlertTriangle size={14} className="text-amber-500 shrink-0" />
  return <XCircle size={14} className="text-red-500 shrink-0" />
}

function statusBg(status: SystemServiceStatus['status']) {
  if (status === 'ok') return 'bg-green-50 border-green-100'
  if (status === 'degraded') return 'bg-amber-50 border-amber-100'
  return 'bg-red-50 border-red-100'
}

function overallBadge(status: SystemHealthResponse['status']) {
  if (status === 'ok') return { className: 'bg-green-100 text-green-800', label: 'Sistema operacional' }
  if (status === 'degraded') return { className: 'bg-amber-100 text-amber-800', label: 'Degradado' }
  return { className: 'bg-red-100 text-red-800', label: 'Problemas detectados' }
}

const POLL_INTERVAL_MS = 60_000

export function SystemHealthWidget() {
  const [data, setData] = useState<SystemHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch = async (manual = false) => {
    if (manual) setLoading(true)
    try {
      const res = await integrationsAPI.getSystemHealth()
      setData(res.data)
      setError(null)
      setLastChecked(new Date())
    } catch {
      setError('Não foi possível consultar o status do sistema')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch()
    intervalRef.current = setInterval(() => fetch(), POLL_INTERVAL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const badge = data ? overallBadge(data.status) : null

  return (
    <div className="overflow-hidden rounded-[16px] border border-[#ead7df] bg-white shadow-[0_18px_40px_rgba(93,8,42,0.08)]">
      <div className="border-b border-[#f1dbe3] bg-[linear-gradient(180deg,#fffafc_0%,#fff_100%)] px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-[#5d082a]" />
          <h3 className="text-lg font-semibold text-[#231F20]">Status dos Serviços</h3>
          {badge && (
            <Badge variant="secondary" className={`rounded-full border-transparent text-[10px] font-bold ${badge.className}`}>
              {badge.label}
            </Badge>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fetch(true)}
          disabled={loading}
          className="h-8 w-8 text-gray-500 hover:bg-gray-100/80"
          title="Atualizar agora"
          aria-label="Atualizar status"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-gray-400' : 'text-gray-500'} />
        </Button>
      </div>

      <div className="p-6 space-y-4">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-[10px] px-3 py-2">{error}</p>
        )}

        {loading && !data && (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-2.5 px-4 py-3 rounded-[12px] border border-gray-100 bg-gray-50/50">
                <div className="h-3.5 w-3.5 rounded-full bg-gray-200" />
                <div className="h-3 w-20 rounded bg-gray-200" />
                <div className="ml-auto h-3 w-8 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        )}

        {data && (
          <div className="grid grid-cols-2 gap-3">
            {(Object.entries(data.services) as [string, SystemServiceStatus][]).map(([key, svc]) => (
              <div
                key={key}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-[12px] border text-xs transition-all duration-200 hover:shadow-sm ${statusBg(svc.status)}`}
              >
                <StatusIcon status={svc.status} />
                <span className="font-semibold text-[#231F20]">{SERVICE_LABELS[key] ?? key}</span>
                {svc.latencyMs !== undefined && (
                  <span className="ml-auto text-gray-400 tabular-nums font-mono">{svc.latencyMs}ms</span>
                )}
              </div>
            ))}
          </div>
        )}

        {lastChecked && (
          <div className="flex justify-between items-center text-[11px] text-gray-400 border-t border-gray-100 pt-3">
            <span>Verificado em {lastChecked.toLocaleTimeString('pt-BR')}</span>
            <span>Atualiza a cada 60s{data?.version && ` · v${data.version}`}</span>
          </div>
        )}
      </div>
    </div>
  )
}
