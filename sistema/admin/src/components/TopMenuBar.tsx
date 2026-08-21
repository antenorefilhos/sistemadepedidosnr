import { useCallback, useEffect, useRef, useState } from 'react'
import type { Section } from '../pages/Dashboard'
import {
  BarChart3, Package, ShoppingCart, ClipboardCheck, Users, Briefcase,
  Tag, ChefHat, Sparkles, Image, Palette, Truck, Clock3, TrendingUp,
  Bot, Workflow, ShieldAlert, BellRing, CreditCard,
  LogOut, Menu, X, ChevronDown, ChevronRight,
} from 'lucide-react'

type MenuItem = {
  key: Section
  label: string
  icon: React.ElementType
}

type MenuGroup = {
  label: string
  items: MenuItem[]
}

const DASHBOARD_ITEM: MenuItem = { key: 'dashboard', label: 'Dashboard', icon: BarChart3 }

const MENU_GROUPS: MenuGroup[] = [
  {
    label: 'Operações',
    items: [
      { key: 'orders', label: 'Pedidos', icon: ShoppingCart },
      { key: 'picking', label: 'Separação', icon: ClipboardCheck },
      { key: 'staff', label: 'Equipe', icon: Users },
      { key: 'teamPerformance', label: 'Desempenho', icon: TrendingUp },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { key: 'products', label: 'Produtos', icon: Package },
      { key: 'categories', label: 'Categorias', icon: Tag },
      { key: 'recipes', label: 'Receitas', icon: ChefHat },
    ],
  },
  {
    label: 'Clientes',
    items: [
      { key: 'customers', label: 'Clientes', icon: Users },
      { key: 'businessAccounts', label: 'Contas B2B', icon: Briefcase },
      { key: 'payments', label: 'Pagamentos', icon: CreditCard },
    ],
  },
  {
    label: 'Loja',
    items: [
      { key: 'layout', label: 'Layout do Site', icon: Sparkles },
      { key: 'storeBanners', label: 'Banners', icon: Image },
      { key: 'brandIdentity', label: 'Identidade Visual', icon: Palette },
      { key: 'deliveryZones', label: 'Taxas de Entrega', icon: Truck },
      { key: 'businessHours', label: 'Horários', icon: Clock3 },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { key: 'intelligence', label: 'Inteligência IA', icon: Bot },
      { key: 'integrations', label: 'Integrações', icon: Workflow },
      { key: 'notifications', label: 'Notificações', icon: BellRing },
      { key: 'fraudAudit', label: 'Anti-fraude', icon: ShieldAlert },
    ],
  },
]

const SECTION_LABELS: Record<Section, string> = Object.fromEntries(
  [DASHBOARD_ITEM, ...MENU_GROUPS.flatMap((g) => g.items)].map((i) => [i.key, i.label])
) as Record<Section, string>

export { SECTION_LABELS }

type Props = {
  activeSection: Section
  onSectionChange: (section: Section) => void
  adminName?: string
  onLogout: () => void
}

export function TopMenuBar({ activeSection, onSectionChange, adminName, onLogout }: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null)
  const menuBarRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>()

  const activeGroup = MENU_GROUPS.find((g) => g.items.some((i) => i.key === activeSection))

  const handleSelect = useCallback(
    (section: Section) => {
      onSectionChange(section)
      setOpenMenu(null)
      setMobileOpen(false)
    },
    [onSectionChange]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null)
        setMobileOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleMenuEnter = (label: string) => {
    clearTimeout(closeTimer.current)
    setOpenMenu(label)
  }

  const handleMenuLeave = () => {
    closeTimer.current = setTimeout(() => setOpenMenu(null), 150)
  }

  return (
    <header className="bg-[#4a0622] text-white shadow-lg relative z-50">
      {/* Top bar: logo + user */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-[#5d082a]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 rounded hover:bg-[#5d082a] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Abrir menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <img
            src="/branding/logo-horizontal-branco.png"
            alt="Antenor & Filhos"
            className="h-8 w-auto max-w-[160px] object-contain"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-[#e8c0cf] hidden sm:inline">{adminName}</span>
          <div className="w-8 h-8 bg-[#6f1737] rounded-full flex items-center justify-center text-xs font-semibold ring-1 ring-[#8a2048]">
            AF
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="p-2 rounded hover:bg-red-700/40 transition-colors text-[#e8c0cf] hover:text-white"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Desktop menu bar */}
      <nav
        ref={menuBarRef}
        className="hidden lg:flex items-center h-10 px-2 gap-1 bg-[#3d0519] border-b border-[#2d0412]"
        role="menubar"
        aria-label="Menu principal"
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => handleSelect(DASHBOARD_ITEM.key)}
          className={`flex items-center gap-1.5 px-3 h-10 text-[13px] font-medium tracking-wide transition-colors
            ${activeSection === DASHBOARD_ITEM.key ? 'text-white bg-[#5d082a]' : 'text-[#dbb0c4] hover:text-white hover:bg-[#5d082a]/60'}
          `}
        >
          <DASHBOARD_ITEM.icon size={14} />
          {DASHBOARD_ITEM.label}
        </button>
        <div className="mx-1 h-5 w-px bg-[#5d082a]" aria-hidden="true" />
        {MENU_GROUPS.map((group) => {
          const isActive = group === activeGroup
          const isOpen = openMenu === group.label

          return (
            <div
              key={group.label}
              className="relative"
              onMouseEnter={() => handleMenuEnter(group.label)}
              onMouseLeave={handleMenuLeave}
            >
              <button
                type="button"
                role="menuitem"
                aria-haspopup="true"
                aria-expanded={isOpen}
                onClick={() => setOpenMenu(isOpen ? null : group.label)}
                className={`flex items-center gap-1.5 px-3 h-10 text-[13px] font-medium tracking-wide transition-colors rounded-none
                  ${isActive ? 'text-white bg-[#5d082a]' : 'text-[#dbb0c4] hover:text-white hover:bg-[#5d082a]/60'}
                  ${isOpen && !isActive ? 'bg-[#5d082a]/60 text-white' : ''}
                `}
              >
                {group.label}
                <ChevronDown size={13} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div
                  className="absolute left-0 top-full mt-0 min-w-[220px] bg-white rounded-b-lg shadow-xl border border-gray-200 py-1 z-50"
                  role="menu"
                  onMouseEnter={() => handleMenuEnter(group.label)}
                  onMouseLeave={handleMenuLeave}
                >
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isCurrent = activeSection === item.key

                    return (
                      <button
                        key={item.key}
                        type="button"
                        role="menuitem"
                        onClick={() => handleSelect(item.key)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                          ${isCurrent
                            ? 'bg-[#fdf0f4] text-[#4a0622] font-semibold'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-[#4a0622]'
                          }
                        `}
                      >
                        <Icon size={16} className={isCurrent ? 'text-[#5d082a]' : 'text-gray-400'} />
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <nav
            className="fixed top-0 left-0 w-72 h-full bg-[#4a0622] z-50 lg:hidden overflow-y-auto shadow-2xl"
            role="navigation"
            aria-label="Menu principal"
          >
            <div className="flex items-center justify-between p-4 border-b border-[#5d082a]">
              <img
                src="/branding/logo-horizontal-branco.png"
                alt="Antenor & Filhos"
                className="h-8 w-auto"
              />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded hover:bg-[#5d082a] text-[#e8c0cf]"
                aria-label="Fechar menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className="py-2">
              <button
                type="button"
                onClick={() => handleSelect(DASHBOARD_ITEM.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors
                  ${activeSection === DASHBOARD_ITEM.key
                    ? 'bg-[#5d082a] text-white border-l-3 border-[#d2bb8a]'
                    : 'text-[#e8c0cf] hover:bg-[#5d082a] hover:text-white'
                  }
                `}
              >
                <DASHBOARD_ITEM.icon size={16} />
                {DASHBOARD_ITEM.label}
              </button>
              {MENU_GROUPS.map((group) => {
                const isExpanded = mobileExpanded === group.label

                return (
                  <div key={group.label}>
                    <button
                      type="button"
                      onClick={() => setMobileExpanded(isExpanded ? null : group.label)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-[#e8c0cf] hover:bg-[#5d082a] transition-colors"
                      aria-expanded={isExpanded}
                    >
                      {group.label}
                      <ChevronRight
                        size={16}
                        className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </button>

                    {isExpanded && (
                      <div className="bg-[#3d0519]">
                        {group.items.map((item) => {
                          const Icon = item.icon
                          const isCurrent = activeSection === item.key

                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => handleSelect(item.key)}
                              className={`w-full flex items-center gap-3 px-6 py-3 text-sm transition-colors
                                ${isCurrent
                                  ? 'bg-[#5d082a] text-white font-semibold border-l-3 border-[#d2bb8a]'
                                  : 'text-[#dbb0c4] hover:bg-[#5d082a]/60 hover:text-white'
                                }
                              `}
                            >
                              <Icon size={16} />
                              {item.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="p-4 border-t border-[#5d082a] mt-2">
              <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-8 h-8 bg-[#6f1737] rounded-full flex items-center justify-center text-xs font-semibold ring-1 ring-[#8a2048]">
                  AF
                </div>
                <span className="text-sm text-[#e8c0cf]">{adminName}</span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2.5 rounded transition-colors"
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </nav>
        </>
      )}
    </header>
  )
}
