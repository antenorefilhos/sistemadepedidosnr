import { useState } from 'react'
import { AlertCircle, Bell, BellRing, Check, X } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'
import { Button } from './ui/button'
import { surfaceClasses } from './ui/surface'
import { cn } from '../lib/cn'

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    requestPushPermission,
    pushPermission,
    pushStatus,
    isSubscribingToPush,
  } = useNotifications()
  const [open, setOpen] = useState(false)

  const pushEnabled = pushStatus === 'enabled'
  const pushGranted = pushPermission === 'granted'
  const pushDenied = pushStatus === 'denied' || pushPermission === 'denied'

  const pushMessage = (() => {
    if (pushEnabled) return 'Notificações ativas neste navegador.'
    if (pushGranted) return 'Permissão concedida; conclua a ativação.'
    if (pushDenied) return 'Permissão bloqueada no navegador.'
    if (pushStatus === 'unsupported') return 'Navegador sem suporte a push.'
    if (pushStatus === 'missing-key') return 'Notificações indisponíveis neste ambiente.'
    if (pushStatus === 'error') return 'Não foi possível ativar agora.'
    return 'Receba avisos de pedido e campanhas.'
  })()

  return (
    <div className="relative">
      <Button
        onClick={() => setOpen(!open)}
        variant="ghost"
        size="icon"
        className="relative"
        aria-label="Notificações"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {Math.min(unreadCount, 9)}
          </span>
        )}
      </Button>

      {open && (
        <div className={surfaceClasses({ className: 'absolute right-0 top-12 z-50 w-80 max-h-96 overflow-hidden shadow-lg' })}>
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
                <p className="mt-0.5 text-xs text-gray-500">{pushMessage}</p>
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

          <div className="overflow-y-auto max-h-80">
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
