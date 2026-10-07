import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Bell, BellRing, Check, X } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'
import { Button } from './ui/button'
import { surfaceClasses } from './ui/surface'
import { cn } from '../lib/cn'
import { pushStatusMessage } from '../utils/pushMessage'

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    isClearing,
    requestPushPermission,
    pushPermission,
    pushStatus,
    isSubscribingToPush,
  } = useNotifications()
  const [open, setOpen] = useState(false)
  // O sino nao fica sempre no canto (na conta, o "Sair" vem depois dele):
  // alinhar o painel a direita do sino cortava a esquerda no celular. Mede ao
  // abrir e posiciona o painel dentro da tela, com 12px de margem.
  const [panelBox, setPanelBox] = useState<{ left: number; width: number } | null>(null)
  const toggle = () => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!open && rect) {
      const vw = document.documentElement.clientWidth
      const width = Math.min(320, vw - 24)
      const left = Math.min(Math.max(12, rect.right - width), vw - width - 12)
      setPanelBox({ left: left - rect.left, width })
    }
    setOpen(!open)
  }
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [open])

  const pushEnabled = pushStatus === 'enabled'
  const pushDenied = pushStatus === 'denied' || pushPermission === 'denied'
  const pushMessage = pushStatusMessage(pushStatus, pushPermission)

  return (
    <div className="relative" ref={containerRef}>
      {/* data-bell-trigger existe pra quem envolve este componente conseguir
          recolorir SO o sino, sem atingir os botoes do painel. Quem usava
          `[&_button]` (descendente) pintava tambem o "Ativar notificacoes", que
          vive num painel branco: dava texto branco em fundo branco no hover --
          o botao sumia e continuava clicavel. Ver Home/Promocoes/WinePage. */}
      <Button
        onClick={toggle}
        variant="ghost"
        size="icon"
        className="relative"
        aria-label="Notificações"
        data-bell-trigger
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          className={surfaceClasses({ className: 'absolute top-12 z-50 flex max-h-[min(28rem,calc(100dvh-5rem))] flex-col overflow-hidden shadow-lg' })}
          style={panelBox ?? { right: 0, width: 320 }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-800">Notificações</h3>
            <Button
              onClick={() => setOpen(false)}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-gray-600"
              aria-label="Fechar notificações"
            >
              <X size={16} />
            </Button>
          </div>

          <div className="border-b border-gray-100 px-4 py-3 bg-white">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 rounded-md p-1.5 ${pushEnabled ? 'bg-emerald-50 text-emerald-700' : pushDenied ? 'bg-red-50 text-red-700' : 'bg-[#F8F0DC] text-[#5D082A]'}`}>
                {pushEnabled ? <Check size={15} /> : pushDenied ? <AlertCircle size={15} /> : <BellRing size={15} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#231F20]">Avisos no navegador</p>
                <p className={cn(
                  'mt-0.5 text-xs',
                  pushDenied || pushStatus === 'error' || pushStatus === 'unsupported' || pushStatus === 'ios-outdated' || pushStatus === 'insecure-context'
                    ? 'font-semibold text-red-600'
                    : pushStatus === 'ios-needs-install'
                      ? 'text-gray-600'
                      : 'text-gray-500',
                )}>
                  {pushMessage}
                </p>
                {!pushEnabled && !pushDenied && (
                  <Button
                    onClick={() => requestPushPermission()}
                    disabled={isSubscribingToPush}
                    size="sm"
                    className="mt-2 h-8 px-3 text-xs"
                  >
                    <Bell size={13} />
                    {isSubscribingToPush ? 'Ativando...' : 'Ativar notificações'}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {notifications.length > 0 && (
            <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-2 text-xs">
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={isClearing || unreadCount === 0}
                className="font-semibold text-[#5D082A] disabled:font-normal disabled:text-gray-400"
              >
                Marcar todas como lidas
              </button>
              <button type="button" onClick={clearAll} disabled={isClearing} className="text-gray-500 hover:text-gray-800 disabled:opacity-40">
                Limpar
              </button>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                Nenhuma notificação
              </div>
            ) : (
              <ul className="divide-y">
                {notifications.map((notif) => (
                  <li
                    key={notif.id}
                    className={cn(
                      'px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors',
                      notif.read ? 'opacity-70' : 'bg-blue-50',
                    )}
                    onClick={() => {
                      if (!notif.read) markAsRead(notif.id)
                    }}
                  >
                    <div className="font-semibold text-sm text-gray-800">{notif.title}</div>
                    <div className="text-xs text-gray-600 mt-1">{notif.body}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(notif.createdAt).toLocaleString('pt-BR')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
