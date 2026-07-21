import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, PlugZap, RefreshCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  integrationsAPI,
  getApiErrorMessage,
  type IntegrationModuleDescriptor,
  type SolidcomStatusResponse,
} from '../services/api'

const PAYMENTS_UI_ENABLED = (import.meta.env.VITE_PAYMENTS_UI_ENABLED ?? 'false') === 'true'

type IntegrationKey = IntegrationModuleDescriptor['key']

type IntegrationMeta = {
  role: string
  summary: string
  contractSummary: string
  triggerSummary: string
  observabilitySummary: string
  nextDeliverable: string
}

const INTEGRATION_META: Record<IntegrationKey, IntegrationMeta> = {
  solidcom: {
    role: 'Sincronização de catálogo e pedidos',
    summary: 'Módulo de integração com ERP legado para sincronização de produtos e gestão de pedidos descentralizada.',
    contractSummary: 'Contrato interno normalizado com campos comerciais, pedidos e sincronização.',
    triggerSummary: 'Disparo automático na criação/cancelamento de pedido e sync manual de catálogo.',
    observabilitySummary: 'Trilha de falhas, reprocesso manual e reconciliação por período.',
    nextDeliverable: 'Toggle operacional em runtime já disponível por extensão.',
  },
  hubspot: {
    role: 'Relacionamento e automações',
    summary: 'Pipeline para sincronização de clientes, segmentações e campanhas.',
    contractSummary: 'Contrato interno de cliente, segmento e eventos de jornada.',
    triggerSummary: 'Disparo por cadastro, recompra e abandono de carrinho.',
    observabilitySummary: 'Fila de eventos, status por lote e auditoria por contato.',
    nextDeliverable: 'Conector plugável com replay por snapshot.',
  },
  rdstation: {
    role: 'Marketing automation',
    summary: 'Módulo opcional para campanhas e automações de marketing.',
    contractSummary: 'Contrato interno de lead/evento desacoplado do domínio principal.',
    triggerSummary: 'Disparo por eventos comerciais (cadastro, compra, abandono).',
    observabilitySummary: 'Snapshots e trilha de replay para eventos enviados.',
    nextDeliverable: 'Implementar adaptador plugável com toggle de ativação.',
  },
  'meta-pixel': {
    role: 'Medição e conversão',
    summary: 'Módulo opcional para telemetria de conversão e funil.',
    contractSummary: 'Contrato interno de evento analítico desacoplado da aplicação core.',
    triggerSummary: 'Disparo por eventos de vitrine, carrinho e checkout.',
    observabilitySummary: 'Fila de eventos com auditoria de entrega por lote.',
    nextDeliverable: 'Implementar adaptador plugável e removível por configuração.',
  },
  nfe: {
    role: 'Emissão fiscal',
    summary: 'Módulo opcional para emissão de notas fiscais.',
    contractSummary: 'Contrato interno de documento fiscal normalizado.',
    triggerSummary: 'Disparo automático ao confirmar pedido.',
    observabilitySummary: 'Trilha de emissão e replay de documentos.',
    nextDeliverable: 'Adaptador plugável com provider configurável.',
  },
  payments: {
    role: 'Gateway de pagamento',
    summary: 'Módulo opcional para gateway de pagamentos.',
    contractSummary: 'Contrato interno de cobrança e webhook independente.',
    triggerSummary: 'Disparo por confirmação de pedido quando habilitado.',
    observabilitySummary: 'Fila de cobrança, webhook e eventos de pagamento.',
    nextDeliverable: 'Conector plugável com provider configurável.',
  },
}

export default function Integrations() {
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationKey>('solidcom')
  const [showModulesModal, setShowModulesModal] = useState(false)
  const [modulesLoading, setModulesLoading] = useState(false)
  const [togglingKey, setTogglingKey] = useState<IntegrationKey | null>(null)
  const [modules, setModules] = useState<IntegrationModuleDescriptor[]>([])
  const [status, setStatus] = useState<SolidcomStatusResponse | null>(null)

  const loadModules = useCallback(async () => {
    try {
      setModulesLoading(true)
      const response = await integrationsAPI.getModules()
      setModules(response.data.items)
    } catch (err) {
      console.error('Erro ao carregar módulos:', getApiErrorMessage(err))
    } finally {
      setModulesLoading(false)
    }
  }, [])

  const loadSolidcomStatus = useCallback(async () => {
    try {
      const response = await integrationsAPI.getSolidcomStatus()
      setStatus(response.data)
    } catch (err) {
      console.error('Erro ao carregar status Solidcom:', getApiErrorMessage(err))
    }
  }, [])

  const toggleModule = useCallback(async (key: IntegrationKey, enabled: boolean) => {
    try {
      setTogglingKey(key)
      await integrationsAPI.setModuleEnabled(key, enabled)
      await loadModules()
      if (key === 'solidcom') {
        await loadSolidcomStatus()
      }
    } catch (err) {
      console.error('Erro ao atualizar módulo:', getApiErrorMessage(err))
    } finally {
      setTogglingKey(null)
    }
  }, [loadModules, loadSolidcomStatus])

  useEffect(() => {
    loadModules()
    loadSolidcomStatus()
  }, [loadModules, loadSolidcomStatus])

  useEffect(() => {
    if (selectedIntegration === 'solidcom') {
      loadSolidcomStatus()
    }
  }, [selectedIntegration, loadSolidcomStatus])

  const visibleModules = useMemo(() => {
    return modules.filter((item) => (PAYMENTS_UI_ENABLED ? true : item.key !== 'payments'))
  }, [modules])

  const selectedModule = useMemo(() => {
    return visibleModules.find((item) => item.key === selectedIntegration) || visibleModules[0] || null
  }, [visibleModules, selectedIntegration])

  const selectedIntegrationMeta = useMemo(() => {
    if (!selectedModule) return null
    return INTEGRATION_META[selectedModule.key]
  }, [selectedModule])

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <section className="bg-gradient-to-r from-[#4a0622] via-[#5D082A] to-[#7b1240] text-white rounded-lg p-5 shadow-[0_18px_55px_rgba(74,6,34,0.25)]">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#f4d8e4] font-semibold">Painel de Conectores</p>
            <h2 className="text-2xl md:text-3xl font-black leading-tight">Integrações do ecossistema</h2>
            <p className="text-sm text-[#fdebf2] max-w-2xl">
              Base operacional para múltiplos conectores do sistema, com saúde do conector, trilhas de falha e ações de reprocesso.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs font-semibold">
            <PlugZap size={14} />
            {visibleModules.filter((item) => item.enabled).length} ativa(s)
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Módulos Plugáveis</p>
          <p className="text-xs text-gray-600">Ative ou desative conectores sem remover dados locais</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowModulesModal(!showModulesModal)}
          className="border-[#5D082A] bg-[#fff5f8] text-[#5D082A] hover:bg-[#ffe5ed] whitespace-nowrap"
        >
          <PlugZap size={16} />
          {showModulesModal ? 'Ocultar' : 'Mostrar'} Módulos
        </Button>
      </div>

      {showModulesModal && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-6 bg-gradient-to-b from-[#fafafa] to-white border border-gray-200 rounded-lg">
          {modulesLoading && (
            <div className="col-span-full flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="animate-spin mr-2" size={16} /> Carregando módulos...
            </div>
          )}

          {!modulesLoading && visibleModules.map((integration) => {
            const isSelected = selectedModule?.key === integration.key
            const meta = INTEGRATION_META[integration.key]
            return (
              <div
                key={integration.key}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedIntegration(integration.key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedIntegration(integration.key)
                  }
                }}
                className={`text-left rounded-lg border p-4 min-h-[136px] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5D082A] ${
                  isSelected
                    ? 'border-[#5D082A] bg-[#fff5f8] shadow-[0_10px_25px_rgba(93,8,42,0.12)]'
                    : 'border-gray-200 bg-white hover:border-[#b65982] hover:shadow-sm'
                }`}
                aria-pressed={isSelected}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="font-bold text-gray-800 text-sm">{integration.name}</p>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] font-bold uppercase tracking-wide ${
                      integration.enabled
                        ? 'bg-emerald-50 text-emerald-700 border-transparent'
                        : 'bg-slate-100 text-slate-600 border-transparent'
                    }`}
                  >
                    {integration.enabled ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>
                <p className="text-xs text-[#6d123a] font-semibold mb-2">{meta.role}</p>
                <p className="text-xs text-gray-600 leading-relaxed">{meta.summary}</p>

                <div className="mt-3 pt-3 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleModule(integration.key, !integration.enabled)
                    }}
                    disabled={togglingKey === integration.key}
                    className={`min-h-9 text-xs ${
                      integration.enabled
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    } disabled:opacity-60`}
                  >
                    {togglingKey === integration.key
                      ? 'Atualizando...'
                      : integration.enabled
                        ? 'Desativar extensão'
                        : 'Ativar extensão'}
                  </Button>
                </div>
              </div>
            )
          })}
        </section>
      )}

      {selectedModule && selectedIntegrationMeta && (
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-lg border border-[#5D082A]/15 bg-[#fff7fa] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#8b4d67] font-semibold mb-2">Contrato interno</p>
          <p className="text-sm font-semibold text-gray-800 leading-relaxed">{selectedIntegrationMeta.contractSummary}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-semibold mb-2">Trigger principal</p>
          <p className="text-sm font-semibold text-gray-800 leading-relaxed">{selectedIntegrationMeta.triggerSummary}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-semibold mb-2">Observabilidade</p>
          <p className="text-sm font-semibold text-gray-800 leading-relaxed">{selectedIntegrationMeta.observabilitySummary}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-semibold mb-2">Próxima entrega</p>
          <p className="text-sm font-semibold text-gray-800 leading-relaxed">{selectedIntegrationMeta.nextDeliverable}</p>
        </div>
      </section>
      )}

      {selectedModule?.key === 'solidcom' && status && (
        <section className="bg-white border border-gray-100 rounded-lg shadow-sm p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800">Status Solidcom</h3>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={loadSolidcomStatus}
              className="text-gray-600 hover:bg-gray-100"
              aria-label="Atualizar"
            >
              <RefreshCcw size={16} />
            </Button>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
            <p className="text-gray-500 text-xs mb-1">Estado da extensão</p>
            <p className={`font-semibold ${status.enabled ? 'text-emerald-700' : 'text-slate-600'}`}>
              {status.enabled ? 'Ativa' : 'Desativada'}
            </p>
            {status.note && <p className="text-xs text-gray-600 mt-1">{status.note}</p>}
          </div>

          {status.lastSync ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-gray-500 text-xs">Última sincronização</p>
                <p className="font-semibold text-gray-800">{new Date(status.lastSync.at).toLocaleString('pt-BR')}</p>
                <p className="text-xs text-gray-600 mt-1">{status.lastSync.synced} sincronizados, {status.lastSync.errors} erros</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-gray-500 text-xs">Total de produtos</p>
                <p className="font-semibold text-gray-800">{status.productsCount?.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-600">
              <Loader2 className="animate-spin mx-auto mb-2" size={20} />
              Carregando status...
            </div>
          )}
        </section>
      )}
    </div>
  )
}
