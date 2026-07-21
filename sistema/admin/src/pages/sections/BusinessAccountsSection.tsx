import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Briefcase, CheckCircle2, CreditCard, FileText, Plus, RefreshCcw, Search, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  businessAccountsAPI,
  customersAPI,
  getApiErrorMessage,
  type AdminCustomer,
  type AdminOrder,
  type BusinessAccount,
  type BusinessFinancialSummary,
  type BusinessShoppingList,
} from '../../services/api'
import { SectionEmptyState, SectionMetric, SectionPanel, SectionToolbar } from './SectionChrome'

type AccountFormState = {
  name: string
  document: string
  creditLimit: string
  minimumOrder: string
  paymentTerms: string
  billingEmail: string
  recurringFrequency: string
}

type UserFormState = {
  customerId: string
  role: string
}

type PriceFormState = {
  productId: string
  price: string
  cost: string
}

type ListFormState = {
  name: string
  customerId: string
  productId: string
  quantity: string
}

const EMPTY_ACCOUNT_FORM: AccountFormState = {
  name: '',
  document: '',
  creditLimit: '',
  minimumOrder: '',
  paymentTerms: 'FATURADO_15_DIAS',
  billingEmail: '',
  recurringFrequency: 'WEEKLY',
}

const EMPTY_USER_FORM: UserFormState = {
  customerId: '',
  role: 'BUYER',
}

const EMPTY_PRICE_FORM: PriceFormState = {
  productId: '',
  price: '',
  cost: '',
}

const EMPTY_LIST_FORM: ListFormState = {
  name: '',
  customerId: '',
  productId: '',
  quantity: '1',
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function formatCurrency(value?: number | string | null) {
  if (value == null || value === '') return 'Sem limite'
  const numeric = Number(value)
  return Number.isFinite(numeric) ? currencyFormatter.format(numeric) : 'Sem limite'
}

function formatDocument(document: string) {
  const digits = String(document || '').replace(/\D/g, '')
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  return document || '-'
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function businessApprovalLabel(status?: string) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'PENDING') return 'Aguardando aprovacao'
  if (normalized === 'APPROVED') return 'Aprovado'
  if (normalized === 'NOT_REQUIRED') return 'Sem aprovacao'
  return normalized || '-'
}

export default function BusinessAccountsSection() {
  const [accounts, setAccounts] = useState<BusinessAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [financial, setFinancial] = useState<BusinessFinancialSummary | null>(null)
  const [pendingOrders, setPendingOrders] = useState<AdminOrder[]>([])
  const [shoppingLists, setShoppingLists] = useState<BusinessShoppingList[]>([])
  const [customers, setCustomers] = useState<AdminCustomer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [accountSearch, setAccountSearch] = useState('')
  const [accountForm, setAccountForm] = useState<AccountFormState>(EMPTY_ACCOUNT_FORM)
  const [userForm, setUserForm] = useState<UserFormState>(EMPTY_USER_FORM)
  const [priceForm, setPriceForm] = useState<PriceFormState>(EMPTY_PRICE_FORM)
  const [listForm, setListForm] = useState<ListFormState>(EMPTY_LIST_FORM)
  const [loading, setLoading] = useState(true)
  const [savingAccount, setSavingAccount] = useState(false)
  const [savingUser, setSavingUser] = useState(false)
  const [savingPrice, setSavingPrice] = useState(false)
  const [savingList, setSavingList] = useState(false)
  const [runningRecurring, setRunningRecurring] = useState(false)
  const [runningBilling, setRunningBilling] = useState(false)
  const [billingOrderId, setBillingOrderId] = useState('')
  const [approvingOrderId, setApprovingOrderId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) || accounts[0] || null,
    [accounts, selectedAccountId],
  )

  const filteredAccounts = useMemo(() => {
    const query = accountSearch.trim().toLowerCase()
    if (!query) return accounts
    return accounts.filter((account) => `${account.name} ${account.document} ${account.status}`.toLowerCase().includes(query))
  }, [accounts, accountSearch])

  const metrics = useMemo(() => {
    const activeAccounts = accounts.filter((account) => account.status === 'ACTIVE').length
    const users = accounts.reduce((total, account) => total + Number(account._count?.users || 0), 0)
    const priceLists = accounts.reduce((total, account) => total + Number(account._count?.priceLists || 0), 0)
    const lists = accounts.reduce((total, account) => total + Number(account._count?.shoppingLists || 0), 0)
    return { activeAccounts, users, priceLists, lists }
  }, [accounts])

  const loadBusinessData = useCallback(async (accountId?: string) => {
    setError('')
    setLoading(true)
    try {
      const [accountsRes, approvalsRes] = await Promise.all([
        businessAccountsAPI.list(),
        businessAccountsAPI.listPendingApprovals(),
      ])
      const nextAccounts = accountsRes.data
      setAccounts(nextAccounts)
      setPendingOrders(approvalsRes.data)
      const nextSelectedId = accountId || selectedAccountId || nextAccounts[0]?.id || ''
      setSelectedAccountId(nextSelectedId)
      if (nextSelectedId) {
        const [financialRes, listsRes] = await Promise.all([
          businessAccountsAPI.getFinancial(nextSelectedId),
          businessAccountsAPI.listShoppingLists(nextSelectedId),
        ])
        setFinancial(financialRes.data)
        setShoppingLists(listsRes.data)
      } else {
        setFinancial(null)
        setShoppingLists([])
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Nao foi possivel carregar contas comerciais.'))
    } finally {
      setLoading(false)
    }
  }, [selectedAccountId])

  const loadCustomers = useCallback(async () => {
    try {
      const response = await customersAPI.getAll(customerSearch.trim() || undefined)
      setCustomers(response.data.slice(0, 12))
    } catch (err) {
      setError(getApiErrorMessage(err, 'Nao foi possivel buscar clientes.'))
    }
  }, [customerSearch])

  useEffect(() => {
    loadBusinessData()
  }, [loadBusinessData])

  useEffect(() => {
    if (selectedAccount?.id && selectedAccount.id !== selectedAccountId) setSelectedAccountId(selectedAccount.id)
  }, [selectedAccount, selectedAccountId])

  async function handleSelectAccount(accountId: string) {
    setSelectedAccountId(accountId)
    setError('')
    try {
      const response = await businessAccountsAPI.getFinancial(accountId)
      const listsResponse = await businessAccountsAPI.listShoppingLists(accountId)
      setFinancial(response.data)
      setShoppingLists(listsResponse.data)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Nao foi possivel carregar financeiro da conta.'))
    }
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSavingAccount(true)
    try {
      const response = await businessAccountsAPI.create({
        name: accountForm.name.trim(),
        document: accountForm.document.trim(),
        creditLimit: accountForm.creditLimit ? Number(accountForm.creditLimit) : null,
        minimumOrder: accountForm.minimumOrder ? Number(accountForm.minimumOrder) : null,
        paymentTerms: accountForm.paymentTerms.trim(),
        invoiceProfile: accountForm.billingEmail ? { billingEmail: accountForm.billingEmail.trim() } : undefined,
        recurringRules: accountForm.recurringFrequency ? { frequency: accountForm.recurringFrequency, enabled: true } : undefined,
      })
      setAccountForm(EMPTY_ACCOUNT_FORM)
      setSuccess('Conta comercial criada.')
      await loadBusinessData(response.data.id)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Nao foi possivel criar a conta comercial.'))
    } finally {
      setSavingAccount(false)
    }
  }

  async function handleAddUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedAccount) return
    setError('')
    setSuccess('')
    setSavingUser(true)
    try {
      await businessAccountsAPI.addUser(selectedAccount.id, userForm)
      setUserForm(EMPTY_USER_FORM)
      setSuccess('Cliente vinculado a conta comercial.')
      await loadBusinessData(selectedAccount.id)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Nao foi possivel vincular cliente.'))
    } finally {
      setSavingUser(false)
    }
  }

  async function handleCreatePriceList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedAccount) return
    setError('')
    setSuccess('')
    setSavingPrice(true)
    try {
      await businessAccountsAPI.createPriceList(selectedAccount.id, {
        name: `Tabela B2B - ${selectedAccount.name}`,
        channel: 'STOREFRONT',
        items: [{
          productId: priceForm.productId.trim(),
          price: Number(priceForm.price),
          cost: priceForm.cost ? Number(priceForm.cost) : null,
        }],
      })
      setPriceForm(EMPTY_PRICE_FORM)
      setSuccess('Tabela de preco B2B criada.')
      await loadBusinessData(selectedAccount.id)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Nao foi possivel criar a tabela B2B.'))
    } finally {
      setSavingPrice(false)
    }
  }

  async function handleCreateShoppingList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedAccount) return
    setError('')
    setSuccess('')
    setSavingList(true)
    try {
      await businessAccountsAPI.createShoppingList(selectedAccount.id, {
        name: listForm.name.trim(),
        customerId: listForm.customerId.trim() || undefined,
        items: [{ productId: listForm.productId.trim(), quantity: Number(listForm.quantity || 1) }],
      })
      setListForm(EMPTY_LIST_FORM)
      setSuccess('Lista corporativa criada.')
      await loadBusinessData(selectedAccount.id)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Nao foi possivel criar a lista corporativa.'))
    } finally {
      setSavingList(false)
    }
  }

  async function handleCreateRecurringOrder() {
    if (!selectedAccount) return
    setError('')
    setSuccess('')
    setRunningRecurring(true)
    try {
      const response = await businessAccountsAPI.createRecurringOrder(selectedAccount.id, {
        shoppingListId: shoppingLists[0]?.id,
        requiresApproval: true,
        force: true,
      })
      setSuccess(`Pedido recorrente criado: ${response.data?.order?.id || 'gerado'}.`)
      await loadBusinessData(selectedAccount.id)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Nao foi possivel gerar pedido recorrente.'))
    } finally {
      setRunningRecurring(false)
    }
  }

  async function handleRunBillingForAccount() {
    if (!selectedAccount) return
    setError('')
    setSuccess('')
    setRunningBilling(true)
    try {
      const response = await businessAccountsAPI.runBillingForAccount(selectedAccount.id, { limit: 5 })
      setSuccess(`Faturamento processado: ${response.data?.processed ?? 0} pedido(s).`)
      await loadBusinessData(selectedAccount.id)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Nao foi possivel rodar faturamento da conta.'))
    } finally {
      setRunningBilling(false)
    }
  }

  async function handleBillOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setRunningBilling(true)
    try {
      const response = await businessAccountsAPI.billOrder(billingOrderId.trim())
      setSuccess(`Faturamento do pedido processado: fiscal=${response.data?.fiscal?.success ? 'ok' : 'pendente'}, cobranca=${response.data?.charge?.success ? 'ok' : 'pendente'}.`)
      setBillingOrderId('')
      if (selectedAccount) await loadBusinessData(selectedAccount.id)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Nao foi possivel faturar o pedido.'))
    } finally {
      setRunningBilling(false)
    }
  }

  async function handleApproveOrder(orderId: string) {
    setError('')
    setSuccess('')
    setApprovingOrderId(orderId)
    try {
      await businessAccountsAPI.approveOrder(orderId)
      setSuccess('Pedido B2B aprovado.')
      await loadBusinessData(selectedAccount?.id)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Nao foi possivel aprovar o pedido.'))
    } finally {
      setApprovingOrderId(null)
    }
  }

  return (
    <div className="space-y-5">
      <SectionToolbar>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9b3156]">Comercial</p>
            <h3 className="mt-1 text-2xl font-black text-[#2d0b18]">Contas B2B</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">
              Empresas, precos proprios, aprovacao de compra e credito operacional em uma fila unica.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => loadBusinessData(selectedAccount?.id)}
            variant="outline"
            className="h-11 rounded-lg border-[#ead7df] bg-white px-4 text-sm font-bold text-[#5d082a] hover:bg-[#fff7fa]"
          >
            <RefreshCcw size={17} />
            Atualizar
          </Button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          <SectionMetric label="Contas ativas" value={metrics.activeAccounts} tone="brand" />
          <SectionMetric label="Usuarios B2B" value={metrics.users} tone="neutral" />
          <SectionMetric label="Tabelas B2B" value={metrics.priceLists} tone="neutral" />
          <SectionMetric label="Listas" value={metrics.lists} tone="neutral" />
          <SectionMetric label="Aprovacoes" value={pendingOrders.length} tone={pendingOrders.length ? 'default' : 'success'} />
        </div>
      </SectionToolbar>

      {error && <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{success}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(300px,380px)_1fr]">
        <SectionPanel bodyClassName="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9b3156]">Carteira</p>
              <h4 className="text-lg font-black text-[#2d0b18]">Empresas</h4>
            </div>
            <Briefcase className="text-[#5d082a]" size={22} />
          </div>
          <label className="mt-4 flex h-11 items-center gap-2 rounded-lg border border-[#ead7df] bg-white px-3 text-sm text-gray-600">
            <Search size={17} />
            <Input
              value={accountSearch}
              onChange={(event) => setAccountSearch(event.target.value)}
              className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              placeholder="Buscar empresa ou CNPJ"
            />
          </label>
          <div className="mt-4 max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {loading && accounts.length === 0 ? (
              <p className="py-6 text-sm text-gray-500">Carregando contas comerciais...</p>
            ) : filteredAccounts.length === 0 ? (
              <SectionEmptyState title="Nenhuma conta encontrada" description="Crie a primeira conta comercial no formulario ao lado." />
            ) : (
              filteredAccounts.map((account) => (
                <Button
                  key={account.id}
                  type="button"
                  onClick={() => handleSelectAccount(account.id)}
                  variant="outline"
                  className={`h-auto w-full flex-col items-stretch justify-start whitespace-normal rounded-lg border p-4 text-left transition ${
                    selectedAccount?.id === account.id
                      ? 'border-[#5d082a] bg-[#fff7fa] shadow-[inset_3px_0_0_#5d082a]'
                      : 'border-[#ead7df] bg-white hover:border-[#d8b5c3]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#2d0b18]">{account.name}</p>
                      <p className="mt-1 text-xs font-semibold text-gray-500">{formatDocument(account.document)}</p>
                    </div>
                    <Badge variant="success" className="rounded-full px-2 py-1 text-[11px] font-black">{account.status}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-bold text-gray-600">
                    <span className="rounded-md bg-gray-50 px-2 py-2">{account._count?.users || 0} usuarios</span>
                    <span className="rounded-md bg-gray-50 px-2 py-2">{account._count?.orders || 0} pedidos</span>
                    <span className="rounded-md bg-gray-50 px-2 py-2">{account._count?.shoppingLists || 0} listas</span>
                  </div>
                </Button>
              ))
            )}
          </div>
        </SectionPanel>

        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-3">
            <SectionPanel className="lg:col-span-2" bodyClassName="p-4 sm:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9b3156]">Financeiro</p>
                  <h4 className="text-xl font-black text-[#2d0b18]">{financial?.name || selectedAccount?.name || 'Conta comercial'}</h4>
                  <p className="mt-1 text-sm text-gray-500">{formatDocument(financial?.document || selectedAccount?.document || '')}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-right text-xs font-bold text-gray-600">
                  <span className="rounded-lg border border-[#ead7df] px-3 py-2">Usuarios: {financial?.activeUsers ?? selectedAccount?._count?.users ?? 0}</span>
                  <span className="rounded-lg border border-[#ead7df] px-3 py-2">Pedidos: {financial?.orderCount ?? selectedAccount?._count?.orders ?? 0}</span>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SectionMetric label="Limite" value={formatCurrency(financial?.creditLimit ?? selectedAccount?.creditLimit)} tone="brand" />
                <SectionMetric label="Usado" value={formatCurrency(financial?.usedCredit ?? 0)} tone="neutral" />
                <SectionMetric label="Disponivel" value={formatCurrency(financial?.availableCredit)} tone="success" />
                <SectionMetric label="Pedido min." value={formatCurrency(financial?.minimumOrder ?? selectedAccount?.minimumOrder)} tone="neutral" />
                <SectionMetric
                  label="Prazo"
                  value={<span className="block break-words text-base leading-tight">{financial?.paymentTerms || selectedAccount?.paymentTerms || '-'}</span>}
                  tone="neutral"
                />
              </div>
            </SectionPanel>

            <SectionPanel bodyClassName="p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-[#5d082a]" />
                <h4 className="text-lg font-black text-[#2d0b18]">Nova conta</h4>
              </div>
              <form onSubmit={handleCreateAccount} className="mt-4 space-y-3">
                <Input required value={accountForm.name} onChange={(event) => setAccountForm((prev) => ({ ...prev, name: event.target.value }))} className="h-11 rounded-lg border-[#ead7df] text-sm shadow-none focus-visible:ring-[#5d082a]/20" placeholder="Razao social" />
                <Input required value={accountForm.document} onChange={(event) => setAccountForm((prev) => ({ ...prev, document: event.target.value }))} className="h-11 rounded-lg border-[#ead7df] text-sm shadow-none focus-visible:ring-[#5d082a]/20" placeholder="CNPJ/documento" />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={accountForm.creditLimit} onChange={(event) => setAccountForm((prev) => ({ ...prev, creditLimit: event.target.value }))} className="h-11 rounded-lg border-[#ead7df] text-sm shadow-none focus-visible:ring-[#5d082a]/20" placeholder="Limite" type="number" min="0" step="0.01" />
                  <Input value={accountForm.minimumOrder} onChange={(event) => setAccountForm((prev) => ({ ...prev, minimumOrder: event.target.value }))} className="h-11 rounded-lg border-[#ead7df] text-sm shadow-none focus-visible:ring-[#5d082a]/20" placeholder="Pedido min." type="number" min="0" step="0.01" />
                </div>
                <Input value={accountForm.paymentTerms} onChange={(event) => setAccountForm((prev) => ({ ...prev, paymentTerms: event.target.value }))} className="h-11 rounded-lg border-[#ead7df] text-sm shadow-none focus-visible:ring-[#5d082a]/20" placeholder="Prazo" />
                <Input value={accountForm.billingEmail} onChange={(event) => setAccountForm((prev) => ({ ...prev, billingEmail: event.target.value }))} className="h-11 rounded-lg border-[#ead7df] text-sm shadow-none focus-visible:ring-[#5d082a]/20" placeholder="Email financeiro" type="email" />
                <Button disabled={savingAccount} className="h-11 w-full rounded-lg bg-[#5d082a] px-4 text-sm font-black text-white hover:bg-[#7a1038]">
                  <Plus size={17} />
                  {savingAccount ? 'Criando...' : 'Criar conta'}
                </Button>
              </form>
            </SectionPanel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionPanel bodyClassName="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserPlus size={18} className="text-[#5d082a]" />
                  <h4 className="text-lg font-black text-[#2d0b18]">Usuarios da conta</h4>
                </div>
                <Button type="button" onClick={loadCustomers} variant="outline" size="sm" className="rounded-lg border-[#ead7df] text-xs font-bold text-[#5d082a]">Buscar</Button>
              </div>
              <form onSubmit={handleAddUser} className="mt-4 space-y-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} className="h-11 rounded-lg border-[#ead7df] text-sm shadow-none focus-visible:ring-[#5d082a]/20" placeholder="Buscar cliente por nome" />
                  <Select value={userForm.role} onChange={(event) => setUserForm((prev) => ({ ...prev, role: event.target.value }))} className="h-11 rounded-lg border-[#ead7df] text-sm shadow-none focus-visible:ring-[#5d082a]/20">
                    <option value="BUYER">Comprador</option>
                    <option value="APPROVER">Aprovador</option>
                    <option value="FINANCE">Financeiro</option>
                  </Select>
                </div>
                {customers.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {customers.map((customer) => (
                      <Button
                        key={customer.id}
                        type="button"
                        onClick={() => setUserForm((prev) => ({ ...prev, customerId: customer.id }))}
                        variant="outline"
                        className={`h-auto flex-col items-stretch justify-start whitespace-normal rounded-lg border px-3 py-2 text-left text-xs transition ${userForm.customerId === customer.id ? 'border-[#5d082a] bg-[#fff7fa]' : 'border-[#ead7df] bg-white hover:bg-gray-50'}`}
                      >
                        <span className="block truncate font-black text-[#2d0b18]">{customer.name}</span>
                        <span className="block truncate text-gray-500">{customer.email || customer.whatsapp}</span>
                      </Button>
                    ))}
                  </div>
                )}
                <Input required value={userForm.customerId} onChange={(event) => setUserForm((prev) => ({ ...prev, customerId: event.target.value }))} className="h-11 rounded-lg border-[#ead7df] text-sm shadow-none focus-visible:ring-[#5d082a]/20" placeholder="ID do cliente" />
                <Button disabled={!selectedAccount || savingUser} className="h-11 w-full rounded-lg bg-[#5d082a] px-4 text-sm font-black text-white hover:bg-[#7a1038]">
                  <UserPlus size={17} />
                  {savingUser ? 'Vinculando...' : 'Vincular cliente'}
                </Button>
              </form>
            </SectionPanel>

            <SectionPanel bodyClassName="p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-[#5d082a]" />
                <h4 className="text-lg font-black text-[#2d0b18]">Preco por empresa</h4>
              </div>
              <form onSubmit={handleCreatePriceList} className="mt-4 space-y-3">
                <Input required value={priceForm.productId} onChange={(event) => setPriceForm((prev) => ({ ...prev, productId: event.target.value }))} className="h-11 rounded-lg border-[#ead7df] text-sm shadow-none focus-visible:ring-[#5d082a]/20" placeholder="ID do produto" />
                <div className="grid grid-cols-2 gap-2">
                  <Input required value={priceForm.price} onChange={(event) => setPriceForm((prev) => ({ ...prev, price: event.target.value }))} className="h-11 rounded-lg border-[#ead7df] text-sm shadow-none focus-visible:ring-[#5d082a]/20" placeholder="Preco B2B" type="number" min="0.01" step="0.01" />
                  <Input value={priceForm.cost} onChange={(event) => setPriceForm((prev) => ({ ...prev, cost: event.target.value }))} className="h-11 rounded-lg border-[#ead7df] text-sm shadow-none focus-visible:ring-[#5d082a]/20" placeholder="Custo opcional" type="number" min="0" step="0.01" />
                </div>
                <Button disabled={!selectedAccount || savingPrice} className="h-11 w-full rounded-lg bg-[#5d082a] px-4 text-sm font-black text-white hover:bg-[#7a1038]">
                  <FileText size={17} />
                  {savingPrice ? 'Salvando...' : 'Criar tabela B2B'}
                </Button>
              </form>
            </SectionPanel>
          </div>

          <SectionPanel bodyClassName="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9b3156]">Listas</p>
                <h4 className="text-lg font-black text-[#2d0b18]">Lista corporativa</h4>
                <p className="mt-1 text-sm text-gray-500">Itens recorrentes da empresa para recompra B2B.</p>
              </div>
              <form onSubmit={handleCreateShoppingList} className="grid w-full gap-2 lg:max-w-3xl lg:grid-cols-[1.2fr_1fr_1fr_120px_auto]">
                <Input required value={listForm.name} onChange={(event) => setListForm((prev) => ({ ...prev, name: event.target.value }))} className="h-11 rounded-lg border-[#ead7df] text-sm shadow-none focus-visible:ring-[#5d082a]/20" placeholder="Nome da lista" />
                <Input value={listForm.customerId} onChange={(event) => setListForm((prev) => ({ ...prev, customerId: event.target.value }))} className="h-11 rounded-lg border-[#ead7df] text-sm shadow-none focus-visible:ring-[#5d082a]/20" placeholder="Cliente opcional" />
                <Input required value={listForm.productId} onChange={(event) => setListForm((prev) => ({ ...prev, productId: event.target.value }))} className="h-11 rounded-lg border-[#ead7df] text-sm shadow-none focus-visible:ring-[#5d082a]/20" placeholder="ID do produto" />
                <Input required value={listForm.quantity} onChange={(event) => setListForm((prev) => ({ ...prev, quantity: event.target.value }))} className="h-11 rounded-lg border-[#ead7df] text-sm shadow-none focus-visible:ring-[#5d082a]/20" placeholder="Qtd." type="number" min="0.001" step="0.001" />
                <Button disabled={!selectedAccount || savingList} className="h-11 rounded-lg bg-[#5d082a] px-4 text-sm font-black text-white hover:bg-[#7a1038]">
                  <Plus size={17} />
                  {savingList ? 'Salvando...' : 'Criar'}
                </Button>
              </form>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {shoppingLists.length === 0 ? (
                <div className="md:col-span-2 xl:col-span-3">
                  <SectionEmptyState title="Sem listas corporativas" description="Crie listas por empresa para recompra e compras recorrentes." />
                </div>
              ) : (
                shoppingLists.map((list) => (
                  <div key={list.id} className="rounded-lg border border-[#ead7df] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#2d0b18]">{list.name}</p>
                        <p className="mt-1 truncate text-xs font-semibold text-gray-500">{list.customer?.name || list.customerId}</p>
                      </div>
                      <Badge variant="outline" className="rounded-full border-[#f1dbe3] bg-[#fff7fa] px-2 py-1 text-[11px] font-black text-[#5d082a]">{list.items.length} itens</Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {list.items.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 text-xs">
                          <span className="truncate font-semibold text-gray-700">{item.productId}</span>
                          <span className="font-black text-[#2d0b18]">{Number(item.quantity).toLocaleString('pt-BR')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionPanel>

          <SectionPanel bodyClassName="p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9b3156]">Recorrencia</p>
                <h4 className="text-lg font-black text-[#2d0b18]">Pedido recorrente</h4>
                <p className="mt-1 text-sm text-gray-500">Gera um pedido B2B a partir da lista corporativa mais recente da conta.</p>
                <Button
                  type="button"
                  onClick={handleCreateRecurringOrder}
                  disabled={!selectedAccount || shoppingLists.length === 0 || runningRecurring}
                  className="mt-4 h-11 rounded-lg bg-[#5d082a] px-4 text-sm font-black text-white hover:bg-[#7a1038]"
                >
                  <RefreshCcw size={17} />
                  {runningRecurring ? 'Gerando...' : 'Gerar pedido recorrente'}
                </Button>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9b3156]">Faturamento</p>
                <h4 className="text-lg font-black text-[#2d0b18]">Cobranca e nota</h4>
                <p className="mt-1 text-sm text-gray-500">Dispara os contratos fiscais e de cobranca existentes para pedidos B2B aprovados.</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    onClick={handleRunBillingForAccount}
                    disabled={!selectedAccount || runningBilling}
                    variant="outline"
                    className="h-11 rounded-lg border-[#5d082a] bg-white px-4 text-sm font-black text-[#5d082a] hover:bg-[#fff7fa]"
                  >
                    <CreditCard size={17} />
                    {runningBilling ? 'Processando...' : 'Faturar conta'}
                  </Button>
                </div>
                <form onSubmit={handleBillOrder} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input value={billingOrderId} onChange={(event) => setBillingOrderId(event.target.value)} className="h-11 rounded-lg border-[#ead7df] text-sm shadow-none focus-visible:ring-[#5d082a]/20" placeholder="ID do pedido B2B" />
                  <Button disabled={!billingOrderId.trim() || runningBilling} className="h-11 rounded-lg bg-[#5d082a] px-4 text-sm font-black text-white hover:bg-[#7a1038]">
                    <FileText size={17} />
                    Faturar pedido
                  </Button>
                </form>
              </div>
            </div>
          </SectionPanel>

          <SectionPanel bodyClassName="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9b3156]">Fila</p>
                <h4 className="text-lg font-black text-[#2d0b18]">Aprovacoes de compra</h4>
              </div>
              <Badge variant="outline" className="rounded-full border-[#f1dbe3] bg-[#fff7fa] px-3 py-1 text-xs font-black text-[#5d082a]">{pendingOrders.length} pendentes</Badge>
            </div>
            <div className="mt-4 overflow-x-auto">
              {pendingOrders.length === 0 ? (
                <SectionEmptyState title="Sem pedidos aguardando aprovacao" description="Pedidos B2B com aprovacao obrigatoria aparecem aqui antes de seguirem para operacao." />
              ) : (
                <Table className="min-w-full text-sm">
                  <TableHeader className="bg-[#fff7fa] text-left text-xs font-black uppercase tracking-[0.16em] text-[#7a1038]">
                    <TableRow className="border-[#ead7df] hover:bg-transparent">
                      <TableHead className="px-4 py-3 text-[#7a1038]">Pedido</TableHead>
                      <TableHead className="px-4 py-3 text-[#7a1038]">Empresa</TableHead>
                      <TableHead className="px-4 py-3 text-[#7a1038]">Cliente</TableHead>
                      <TableHead className="px-4 py-3 text-right text-[#7a1038]">Total</TableHead>
                      <TableHead className="px-4 py-3 text-[#7a1038]">Status</TableHead>
                      <TableHead className="px-4 py-3 text-right text-[#7a1038]">Acao</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-[#f3e4ea]">
                    {pendingOrders.map((order) => (
                      <TableRow key={order.id} className="border-[#f3e4ea] bg-white">
                        <TableCell className="px-4 py-3">
                          <p className="font-black text-[#2d0b18]">{order.id.slice(-8)}</p>
                          <p className="text-xs text-gray-500">{formatDateTime(order.createdAt)}</p>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-gray-700">{order.businessAccount?.name || order.businessAccountId || '-'}</TableCell>
                        <TableCell className="px-4 py-3 text-gray-700">{order.customer?.name || order.customerId}</TableCell>
                        <TableCell className="px-4 py-3 text-right font-black text-[#2d0b18]">{formatCurrency(order.total)}</TableCell>
                        <TableCell className="px-4 py-3">
                          <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">{businessApprovalLabel(order.businessApprovalStatus)}</Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            onClick={() => handleApproveOrder(order.id)}
                            disabled={approvingOrderId === order.id}
                            className="h-10 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-700"
                          >
                            <CheckCircle2 size={16} />
                            {approvingOrderId === order.id ? 'Aprovando...' : 'Aprovar'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </SectionPanel>
        </div>
      </div>
    </div>
  )
}
