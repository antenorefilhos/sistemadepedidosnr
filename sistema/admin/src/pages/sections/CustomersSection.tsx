import { Columns, Eye, LayoutList, RefreshCw, Search, X, Filter } from 'lucide-react'
import { useState, useEffect, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AdminCustomer } from '../../services/api'
import { SectionEmptyState, SectionMetric, SectionPanel, SectionToolbar } from './SectionChrome'

type Props = {
  customersSearch: string
  onCustomersSearchChange: (value: string) => void
  customersEmailFilter: 'all' | 'with' | 'without'
  onCustomersEmailFilterChange: (value: 'all' | 'with' | 'without') => void
  customersAddressFilter: 'all' | 'with' | 'without'
  onCustomersAddressFilterChange: (value: 'all' | 'with' | 'without') => void
  customersOrderFilter: 'all' | 'with-orders' | 'without-orders'
  onCustomersOrderFilterChange: (value: 'all' | 'with-orders' | 'without-orders') => void
  customersDateFilter: 'all' | '7d' | '30d' | '90d'
  onCustomersDateFilterChange: (value: 'all' | '7d' | '30d' | '90d') => void
  customersViewMode: 'list' | 'kanban'
  onCustomersViewModeChange: (value: 'list' | 'kanban') => void
  onReloadCustomers: () => void
  customersLoading: boolean
  filteredCustomers: AdminCustomer[]
  customerOrderCountMap: Record<string, number>
  onOpenCustomerDetails: (customer: AdminCustomer) => void
  selectedCustomer: AdminCustomer | null
  onSelectCustomer: (customer: AdminCustomer | null) => void
  renderWhatsAppBadge: (phone?: string, compact?: boolean) => ReactNode
}

export default function CustomersSection({
  customersSearch,
  onCustomersSearchChange,
  customersEmailFilter,
  onCustomersEmailFilterChange,
  customersAddressFilter,
  onCustomersAddressFilterChange,
  customersOrderFilter,
  onCustomersOrderFilterChange,
  customersDateFilter,
  onCustomersDateFilterChange,
  customersViewMode,
  onCustomersViewModeChange,
  onReloadCustomers,
  customersLoading,
  filteredCustomers,
  customerOrderCountMap,
  onOpenCustomerDetails,
  selectedCustomer,
  onSelectCustomer,
  renderWhatsAppBadge,
}: Props) {
  const [showFilterBar, setShowFilterBar] = useState(false)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSelectCustomer(null)
    }
    if (selectedCustomer) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [selectedCustomer, onSelectCustomer])

  // Calculations for KPIs
  const withOrdersCount = filteredCustomers.filter((customer) => (customerOrderCountMap[customer.id] || 0) > 0).length
  const newCustomersCount = filteredCustomers.filter((c) => {
    if (!c.createdAt) return false
    const diffTime = Date.now() - new Date(c.createdAt).getTime()
    return diffTime <= 30 * 24 * 60 * 60 * 1000
  }).length

  const activeFilterCount = [
    customersEmailFilter !== 'all' ? customersEmailFilter : '',
    customersAddressFilter !== 'all' ? customersAddressFilter : '',
    customersOrderFilter !== 'all' ? customersOrderFilter : '',
    customersDateFilter !== 'all' ? customersDateFilter : '',
  ].filter(Boolean).length

  return (
    <>
      <div className="space-y-6">
      {/* KPI Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SectionMetric label="Clientes filtrados" value={filteredCustomers.length} tone="brand" />
        <SectionMetric label="Com pedidos" value={withOrdersCount} tone="success" />
        <SectionMetric label="Novos (30 dias)" value={newCustomersCount} tone="neutral" />
      </div>

      {/* Toolbar */}
      <SectionToolbar>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center flex-1">
              <div className="relative min-w-[260px] flex-1 max-w-md">
                <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar por nome, CPF, WhatsApp ou email..."
                  value={customersSearch}
                  onChange={(e) => onCustomersSearchChange(e.target.value)}
                  className="h-11 rounded-xl border-[#ead7df] bg-white pl-10 pr-4 text-sm text-gray-700 shadow-none focus-visible:ring-[#5d082a]/20"
                />
              </div>

              {/* Botão de Filtrar */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFilterBar(!showFilterBar)}
                className={`min-h-11 rounded-xl px-4 text-sm ${
                  showFilterBar || activeFilterCount > 0
                    ? 'border-[#5d082a] bg-[#fff7fa] text-[#5d082a]'
                    : 'border-[#ead7df] bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter size={16} />
                <span>Filtrar</span>
                {activeFilterCount > 0 && (
                  <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#5d082a] text-[10px] font-black text-white">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              {/* Modo de visualização */}
              <div className="flex overflow-hidden rounded-xl border border-[#ead7df] bg-white p-1">
                <Button
                  type="button"
                  onClick={() => onCustomersViewModeChange('list')}
                  variant={customersViewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  className={`min-h-[36px] rounded-lg px-3 text-xs ${
                    customersViewMode === 'list' ? 'bg-[#5d082a] text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <LayoutList size={14} />
                  Lista
                </Button>
                <Button
                  type="button"
                  onClick={() => onCustomersViewModeChange('kanban')}
                  variant={customersViewMode === 'kanban' ? 'default' : 'ghost'}
                  size="sm"
                  className={`min-h-[36px] rounded-lg px-3 text-xs ${
                    customersViewMode === 'kanban' ? 'bg-[#5d082a] text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Columns size={14} />
                  Colunas
                </Button>
              </div>

              {/* Ações */}
              <Button type="button" onClick={onReloadCustomers} variant="outline" className="min-h-11 rounded-xl border-[#ead7df] bg-white px-4 text-sm text-gray-700 hover:bg-gray-50">
                <RefreshCw size={14} />
                <span>Atualizar</span>
              </Button>
            </div>
          </div>

          {/* Active Filter Chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-[#f1dbe3]/60">
              {customersEmailFilter !== 'all' && (
                <Badge variant="outline" className="rounded-lg border-[#f1dbe3] bg-[#fff7fa] px-2.5 py-1 text-xs font-semibold text-[#5d082a]">
                  Email: {customersEmailFilter === 'with' ? 'Com email' : 'Sem email'}
                  <Button type="button" variant="ghost" size="icon" onClick={() => onCustomersEmailFilterChange('all')} className="h-4 w-4 rounded-full p-0 text-[#5d082a] hover:bg-[#5d082a]/10 hover:text-[#3d041a]" aria-label="Limpar filtro de email"><X size={12} /></Button>
                </Badge>
              )}
              {customersAddressFilter !== 'all' && (
                <Badge variant="outline" className="rounded-lg border-[#f1dbe3] bg-[#fff7fa] px-2.5 py-1 text-xs font-semibold text-[#5d082a]">
                  Endereço: {customersAddressFilter === 'with' ? 'Com endereço' : 'Sem endereço'}
                  <Button type="button" variant="ghost" size="icon" onClick={() => onCustomersAddressFilterChange('all')} className="h-4 w-4 rounded-full p-0 text-[#5d082a] hover:bg-[#5d082a]/10 hover:text-[#3d041a]" aria-label="Limpar filtro de endereço"><X size={12} /></Button>
                </Badge>
              )}
              {customersOrderFilter !== 'all' && (
                <Badge variant="outline" className="rounded-lg border-[#f1dbe3] bg-[#fff7fa] px-2.5 py-1 text-xs font-semibold text-[#5d082a]">
                  Pedidos: {customersOrderFilter === 'with-orders' ? 'Com pedidos' : 'Sem pedidos'}
                  <Button type="button" variant="ghost" size="icon" onClick={() => onCustomersOrderFilterChange('all')} className="h-4 w-4 rounded-full p-0 text-[#5d082a] hover:bg-[#5d082a]/10 hover:text-[#3d041a]" aria-label="Limpar filtro de pedidos"><X size={12} /></Button>
                </Badge>
              )}
              {customersDateFilter !== 'all' && (
                <Badge variant="outline" className="rounded-lg border-[#f1dbe3] bg-[#fff7fa] px-2.5 py-1 text-xs font-semibold text-[#5d082a]">
                  Cadastro: {customersDateFilter === '7d' ? '7 dias' : customersDateFilter === '30d' ? '30 dias' : '90 dias'}
                  <Button type="button" variant="ghost" size="icon" onClick={() => onCustomersDateFilterChange('all')} className="h-4 w-4 rounded-full p-0 text-[#5d082a] hover:bg-[#5d082a]/10 hover:text-[#3d041a]" aria-label="Limpar filtro de cadastro"><X size={12} /></Button>
                </Badge>
              )}
            </div>
          )}

          {/* Collapsible Advanced Filters Drawer */}
          {showFilterBar && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 border-t border-[#f1dbe3] pt-4 mt-4 animate-in fade-in duration-200">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#9e7080]">Filtro de Email</label>
                <Select value={customersEmailFilter} onChange={(e) => onCustomersEmailFilterChange(e.target.value as 'all' | 'with' | 'without')} className="h-11 rounded-xl border-[#ead7df] bg-white px-3 text-sm text-gray-700 shadow-none focus-visible:ring-[#5d082a]/20">
                  <option value="all">Email: todos</option>
                  <option value="with">Com email</option>
                  <option value="without">Sem email</option>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#9e7080]">Filtro de Endereço</label>
                <Select value={customersAddressFilter} onChange={(e) => onCustomersAddressFilterChange(e.target.value as 'all' | 'with' | 'without')} className="h-11 rounded-xl border-[#ead7df] bg-white px-3 text-sm text-gray-700 shadow-none focus-visible:ring-[#5d082a]/20">
                  <option value="all">Endereço: todos</option>
                  <option value="with">Com endereço</option>
                  <option value="without">Sem endereço</option>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#9e7080]">Filtro de Pedidos</label>
                <Select value={customersOrderFilter} onChange={(e) => onCustomersOrderFilterChange(e.target.value as 'all' | 'with-orders' | 'without-orders')} className="h-11 rounded-xl border-[#ead7df] bg-white px-3 text-sm text-gray-700 shadow-none focus-visible:ring-[#5d082a]/20">
                  <option value="all">Pedidos: todos</option>
                  <option value="with-orders">Com pedidos</option>
                  <option value="without-orders">Sem pedidos</option>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#9e7080]">Data de Cadastro</label>
                <Select value={customersDateFilter} onChange={(e) => onCustomersDateFilterChange(e.target.value as 'all' | '7d' | '30d' | '90d')} className="h-11 rounded-xl border-[#ead7df] bg-white px-3 text-sm text-gray-700 shadow-none focus-visible:ring-[#5d082a]/20">
                  <option value="all">Qualquer data</option>
                  <option value="7d">Últimos 7 dias</option>
                  <option value="30d">Últimos 30 dias</option>
                  <option value="90d">Últimos 90 dias</option>
                </Select>
              </div>
            </div>
          )}
        </div>
      </SectionToolbar>

      {/* Content View Mode */}
      {customersViewMode === 'list' ? (
        <SectionPanel>
          {customersLoading ? (
            <div className="p-6 text-gray-500">Carregando clientes...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-6">
              <SectionEmptyState title="Nenhum cliente encontrado" description="Ajuste a busca e os filtros para localizar perfis específicos." />
            </div>
          ) : (
            <Table className="min-w-full text-sm">
              <TableHeader className="border-b border-[#f1dbe3] bg-[#fff7fa] text-gray-600">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6 py-4 text-[#9e7080]">Nome</TableHead>
                  <TableHead className="px-6 py-4 text-[#9e7080]">CPF</TableHead>
                  <TableHead className="px-6 py-4 text-[#9e7080]">WhatsApp</TableHead>
                  <TableHead className="px-6 py-4 text-[#9e7080]">Email</TableHead>
                  <TableHead className="px-6 py-4 text-[#9e7080]">Pedidos</TableHead>
                  <TableHead className="px-6 py-4 text-right text-[#9e7080]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-[#f3e4ea]">
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className="group border-[#f3e4ea] transition-colors duration-150 hover:bg-[#fff8fb]">
                    <TableCell className="px-6 py-4 font-semibold text-gray-800">{customer.name}</TableCell>
                    <TableCell className="px-6 py-4">
                      {customer.cpf ? (
                        <Badge variant="outline" className="rounded-md border-gray-200 bg-gray-50 px-2 py-1 font-mono text-xs font-medium text-gray-600">
                          {customer.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4">{renderWhatsAppBadge(customer.whatsapp)}</TableCell>
                    <TableCell className="px-6 py-4 text-gray-500">{customer.email ?? '—'}</TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge variant="secondary" className="rounded-full bg-[#fdf0f4] px-2.5 py-0.5 text-xs font-bold text-[#4a0622]">
                        {customerOrderCountMap[customer.id] || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <Button
                        type="button"
                        onClick={() => onOpenCustomerDetails(customer)}
                        variant="outline"
                        size="icon"
                        className="rounded-xl border-[#ead7df] text-gray-400 transition hover:border-[#5d082a] hover:bg-[#fff7fa] hover:text-[#5d082a]"
                        title="Ver detalhes"
                      >
                        <Eye size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionPanel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[
            { key: 'new', title: 'Novos (30 dias)', filter: (c: AdminCustomer) => c.createdAt && (Date.now() - new Date(c.createdAt).getTime()) <= 30 * 24 * 60 * 60 * 1000 },
            { key: 'active', title: 'Com Pedidos', filter: (c: AdminCustomer) => (customerOrderCountMap[c.id] || 0) > 0 },
            { key: 'inactive', title: 'Sem Pedidos', filter: (c: AdminCustomer) => (customerOrderCountMap[c.id] || 0) === 0 },
          ].map((column) => {
            const columnCustomers = filteredCustomers.filter(column.filter)
            return (
              <div key={column.key} className="min-h-[320px] rounded-[16px] border border-[#ead7df] bg-[linear-gradient(180deg,#fffafc_0%,#fff 100%)] p-3 shadow-[0_18px_32px_rgba(93,8,42,0.08)] flex flex-col">
                <div className="flex items-center justify-between mb-3 border-b border-[#f1dbe3] pb-2">
                  <h3 className="text-sm font-bold text-gray-700">{column.title}</h3>
                  <Badge variant="secondary" className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">{columnCustomers.length}</Badge>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto pr-0.5">
                  {columnCustomers.map((customer) => (
                    <div key={customer.id} className="rounded-xl border border-[#f1dbe3] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-800 truncate">{customer.name}</p>
                          <p className="text-xs text-gray-400 font-medium mt-0.5">Pedidos: {customerOrderCountMap[customer.id] || 0}</p>
                        </div>
                        <Button type="button" onClick={() => onOpenCustomerDetails(customer)} variant="outline" size="icon" className="h-8 w-8 shrink-0 rounded-lg border-[#ead7df] text-gray-400 hover:border-[#5d082a] hover:bg-[#fff7fa] hover:text-[#5d082a]">
                          <Eye size={12} />
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {customer.whatsapp && renderWhatsAppBadge(customer.whatsapp, true)}
                        {customer.email && (
                          <Badge variant="outline" className="max-w-[180px] truncate rounded-md border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            {customer.email}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {columnCustomers.length === 0 && <p className="text-xs text-gray-400 text-center py-6">Sem clientes nesta coluna</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      </div>

      {/* Slide-Over de Detalhes do Cliente */}
      {selectedCustomer && (
        <>
          {/* Overlay */}
          <div
            onClick={() => onSelectCustomer(null)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[6px] transition-opacity duration-300 opacity-100 pointer-events-auto"
          />

          {/* Centered Premium Modal Panel */}
          <div
            className="fixed left-1/2 top-1/2 z-50 flex w-[92vw] max-w-3xl h-[85vh] max-h-[680px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white shadow-[0_24px_60px_rgba(93,8,42,0.18)] border border-[#f1dbe3]/65 transition-all duration-300 ease-out scale-100 opacity-100 pointer-events-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#f1dbe3] bg-[linear-gradient(135deg,#fff7fa_0%,#fff_100%)] px-6 py-5 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedCustomer.name}</h2>
                <p className="mt-0.5 text-xs text-gray-400">Perfil do Cliente</p>
              </div>
              <Button
                type="button"
                onClick={() => onSelectCustomer(null)}
                variant="outline"
                size="icon"
                className="rounded-xl border-[#ead7df] text-gray-400 transition hover:border-[#5d082a] hover:bg-[#fff7fa] hover:text-[#5d082a]"
              >
                <X size={18} />
              </Button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Coluna Esquerda: Dados do Perfil */}
                <div className="bg-white border border-[#ead7df] rounded-2xl p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#f1dbe3]/60">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#5d082a]">Dados do Perfil</span>
                  </div>
                  
                  <div className="space-y-3.5 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">CPF</p>
                      {selectedCustomer.cpf ? (
                        <p className="font-mono text-gray-700 mt-0.5">
                          {selectedCustomer.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                        </p>
                      ) : (
                        <p className="text-gray-400 mt-0.5">—</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">WhatsApp</p>
                      <div className="mt-1">
                        {renderWhatsAppBadge(selectedCustomer.whatsapp)}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Email</p>
                      <p className="text-gray-700 mt-0.5 truncate" title={selectedCustomer.email || undefined}>
                        {selectedCustomer.email ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Data de Cadastro</p>
                      <p className="text-gray-700 mt-0.5">
                        {selectedCustomer.createdAt ? new Date(selectedCustomer.createdAt).toLocaleDateString('pt-BR') : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total de Pedidos</p>
                      <p className="text-gray-900 mt-0.5 font-bold text-base">
                        {customerOrderCountMap[selectedCustomer.id] || 0}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Coluna Direita: Endereços de Entrega */}
                <div className="bg-white border border-[#ead7df] rounded-2xl p-5 space-y-4 shadow-sm flex flex-col h-full max-h-[500px]">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#f1dbe3]/60">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#5d082a]">Endereços de Entrega</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {selectedCustomer.addresses && selectedCustomer.addresses.length > 0 ? (
                      selectedCustomer.addresses.map((addr) => (
                        <div key={addr.id} className="text-sm border border-slate-100 bg-slate-50/50 rounded-xl p-4 space-y-1 hover:border-[#f1dbe3] transition">
                          <p className="font-semibold text-gray-800">
                            {addr.street}, {addr.number}
                            {addr.complement ? ` — ${addr.complement}` : ''}
                          </p>
                          <p className="text-xs text-gray-500">
                            {addr.neighborhood}, {addr.city} - {addr.state}
                          </p>
                          <p className="text-xs text-gray-450 font-mono mt-1">CEP {addr.zipCode}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        Nenhum endereço cadastrado
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-[#f1dbe3] bg-white px-6 py-4 flex justify-end rounded-b-2xl">
              <Button
                type="button"
                onClick={() => onSelectCustomer(null)}
                variant="outline"
                className="min-h-11 rounded-xl border-[#ead7df] px-6 text-sm text-gray-600 hover:bg-gray-50"
              >
                Fechar
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
