import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fraudAPI, type FraudLog } from '../services/api'
import { ShieldAlert, Smartphone, Phone, Wifi, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const VECTOR_META: Record<string, { label: string; icon: ReactNode; color: string }> = {
  WHATSAPP: { label: 'WhatsApp', icon: <Phone size={14} />, color: 'border-green-200 bg-green-50 text-green-700' },
  DEVICE:   { label: 'Dispositivo', icon: <Smartphone size={14} />, color: 'border-blue-200 bg-blue-50 text-blue-700' },
  IP:       { label: 'IP', icon: <Wifi size={14} />, color: 'border-orange-200 bg-orange-50 text-orange-700' },
}

function fmt(dateStr: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateStr))
}

export default function FraudAudit() {
  const [filter, setFilter] = useState<string>('')

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['fraud-logs', filter],
    queryFn: async () => {
      const res = await fraudAPI.listLogs({ limit: 200, vector: filter || undefined })
      return res.data
    },
  })

  // Agrupar por valor para detectar reincidência
  const countByValue = logs.reduce<Record<string, number>>((acc, log) => {
    acc[log.value] = (acc[log.value] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <ShieldAlert className="text-[#5D082A]" size={24} />
        <h1 className="text-2xl font-bold text-gray-800">Auditoria de Anti-fraude</h1>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="ml-auto text-gray-500 hover:text-[#5D082A]"
        >
          <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {['', 'WHATSAPP', 'DEVICE', 'IP'].map((v) => (
          <Button
            key={v}
            type="button"
            variant={filter === v ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(v)}
            className={filter === v ? '' : 'text-gray-600 hover:border-[#D2BB8A]'}
          >
            {v === '' ? 'Todos' : VECTOR_META[v]?.label ?? v}
          </Button>
        ))}
        <span className="ml-auto text-xs text-gray-400 self-center">{logs.length} registros</span>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <ShieldAlert size={44} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm font-medium">Nenhuma ocorrência registrada.</p>
          <p className="text-xs mt-1">Tentativas bloqueadas de fraude em frete grátis aparecerão aqui.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead>Vetor</TableHead>
                <TableHead>Valor detectado</TableHead>
                <TableHead>Cliente ID</TableHead>
                <TableHead>Reincidência</TableHead>
                <TableHead>Data/Hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: FraudLog) => {
                const meta = VECTOR_META[log.vector] ?? { label: log.vector, icon: null, color: 'border-gray-200 bg-gray-50 text-gray-600' }
                const count = countByValue[log.value] ?? 1
                return (
                  <TableRow key={log.id} className={count > 1 ? 'bg-red-50/40' : ''}>
                    <TableCell>
                      <Badge variant="outline" className={`gap-1.5 ${meta.color}`}>
                        {meta.icon}
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-mono text-xs text-gray-700" title={log.value}>
                      {log.value}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-500">
                      {log.customerId ? log.customerId.slice(0, 12) + '…' : '—'}
                    </TableCell>
                    <TableCell>
                      {count > 1 ? (
                        <Badge variant="secondary" className="bg-red-100 font-bold text-red-600">
                          {count}× bloqueado
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-400">1ª ocorrência</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-gray-500">{fmt(log.createdAt)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
        <p className="font-semibold mb-1">Como interpretar</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>WhatsApp:</strong> cliente tentou frete grátis com número que já fez pedido.</li>
          <li><strong>Dispositivo:</strong> mesmo aparelho (fingerprint) já usou frete grátis em outra conta.</li>
          <li><strong>IP:</strong> mesmo endereço de rede usou frete grátis nas últimas 24h.</li>
          <li>O cliente não vê este log — recebe apenas "não elegível" de forma silenciosa.</li>
        </ul>
      </div>
    </div>
  )
}
