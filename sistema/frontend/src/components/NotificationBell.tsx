import { useEffect, useRef, useState } from 'react'
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

  // Instrucao de desbloqueio muda de lugar entre desktop e Android; mandar o
  // cliente procurar um "cadeado" no celular e mandar procurar o que nao existe.
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
  const pushEnabled = pushStatus === 'enabled'
  const pushGranted = pushPermission === 'granted'
  const pushDenied = pushStatus === 'denied' || pushPermission === 'denied'

  const pushMessage = (() => {
    if (pushEnabled) return 'Notificações ativas neste navegador.'
    if (pushGranted) return 'Permissão concedida; conclua a ativação.'
    if (pushDenied) return isAndroid
      ? 'Permissão bloqueada neste navegador. Para reativar: toque no ícone à esquerda do endereço do site, depois em Permissões e mude "Notificações" para Permitir.'
      : 'Permissão bloqueada no navegador. Para reativar: clique no cadeado/ícone ao lado do endereço do site e mude "Notificações" para Permitir.'
    // Dispensou sem escolher -- da pra perguntar de novo, nao precisa mexer em
    // configuracao nenhuma. No Android o aviso costuma vir como um sininho
    // discreto na barra de endereco, entao vale dizer onde olhar.
    if (pushStatus === 'dismissed') return isAndroid
      ? 'O aviso foi fechado sem resposta. Toque em Ativar de novo e escolha Permitir — no Android, a pergunta pode aparecer como um sininho na barra de endereço.'
      : 'O aviso foi fechado sem resposta. Toque em Ativar notificações de novo e escolha Permitir.'
    if (pushStatus === 'ios-needs-install') return 'No iPhone/iPad, toque em Compartilhar e depois em "Adicionar à Tela de Início" para poder ativar notificações — o Safari não permite isso numa aba comum.'
    if (pushStatus === 'ios-outdated') return 'Atualize o iOS para a versão 16.4 ou mais recente para ativar notificações.'
    if (pushStatus === 'insecure-context') return 'Notificações só funcionam em conexão segura (https). Acesse o site pelo endereço oficial para ativar.'
    if (pushStatus === 'unsupported') return 'Este navegador não tem suporte a notificações push. Tente pelo Chrome, Edge ou Firefox atualizados.'
    if (pushStatus === 'missing-key') return 'Notificações push estão temporariamente desativadas neste site (configuração pendente). Não é um problema do seu navegador — tente novamente mais tarde.'
    if (pushStatus === 'error') return 'Não foi possível ativar agora.'
    return 'Receba avisos de pedido e campanhas.'
  })()

  return (
    <div className="relative" ref={containerRef}>
      {/* data-bell-trigger existe pra quem envolve este componente conseguir
          recolorir SO o sino, sem atingir os botoes do painel. Quem usava
          `[&_button]` (descendente) pintava tambem o "Ativar notificacoes", que
          vive num painel branco: dava texto branco em fundo branco no hover --
          o botao sumia e continuava clicavel. Ver Home/Promocoes/WinePage. */}
      <Button
        onClick={() => setOpen(!open)}
        variant="ghost"
        size="icon"
        className="relative"
        aria-label="Notificações"
        data-bell-trigger
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
