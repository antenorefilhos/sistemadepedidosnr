import { useCallback, useEffect, useState } from 'react'
import api from '../services/api'

/**
 * Liga o aviso de push no aparelho do funcionario.
 *
 * O app roda no celular de quem trabalha, e ate 03/09/2026 nao avisava nada:
 * so descobria servico novo quem lembrasse de abrir e olhar a lista. Isso
 * significava pedido parado e SLA estourado sem ninguem saber -- com o
 * cliente esperando do outro lado.
 *
 * A permissao e pedida no toque do funcionario, nunca sozinha ao abrir: aviso
 * de permissao disparado sem contexto e negado por reflexo, e negar e quase
 * definitivo (o navegador para de perguntar e so as configuracoes revertem).
 */
type Estado =
  | 'carregando'
  | 'ativo'
  | 'desativado'
  | 'negado'
  | 'dispensado'
  | 'sem-suporte'
  | 'sem-https'
  | 'sem-chave'
  | 'erro'

function base64ParaUint8(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalizado = `${base64}${padding}`.replace(/-/g, '+').replace(/_/g, '/')
  const bruto = window.atob(normalizado)
  const saida = new Uint8Array(bruto.length)
  for (let i = 0; i < bruto.length; i += 1) saida[i] = bruto.charCodeAt(i)
  return saida
}

// iOS so aceita Web Push a partir do 16.4 e SOMENTE com o app instalado via
// "Adicionar a Tela de Inicio" -- numa aba normal nao funciona nem no iOS
// novo. Sem detectar isso, o funcionario de iPhone toca no botao e nada
// acontece, sem explicacao.
function ehIOS() {
  if (typeof navigator === 'undefined') return false
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

function ehInstalado() {
  if (typeof window === 'undefined') return false
  return (
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

const suportado = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'Notification' in window &&
  'PushManager' in window &&
  window.isSecureContext

export function usePushEquipe() {
  const [estado, setEstado] = useState<Estado>('carregando')
  const [ocupado, setOcupado] = useState(false)

  // Descobre o estado real no aparelho, em vez de assumir. Permissao concedida
  // nao significa inscrito: o funcionario pode ter limpado os dados do site,
  // ou a inscricao pode ter sido descartada pelo navegador.
  useEffect(() => {
    let vivo = true
    ;(async () => {
      if (!suportado()) {
        if (ehIOS() && !ehInstalado()) return vivo && setEstado('sem-suporte')
        if (typeof window !== 'undefined' && !window.isSecureContext) return vivo && setEstado('sem-https')
        return vivo && setEstado('sem-suporte')
      }
      if (Notification.permission === 'denied') return vivo && setEstado('negado')
      try {
        const registro = await navigator.serviceWorker.ready
        const inscricao = await registro.pushManager.getSubscription()
        if (vivo) setEstado(inscricao ? 'ativo' : 'desativado')
      } catch {
        if (vivo) setEstado('desativado')
      }
    })()
    return () => {
      vivo = false
    }
  }, [])

  const ativar = useCallback(async () => {
    if (!suportado()) {
      setEstado(ehIOS() && !ehInstalado() ? 'sem-suporte' : 'sem-https')
      return false
    }

    const chave = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
    if (!chave) {
      setEstado('sem-chave')
      return false
    }

    setOcupado(true)
    try {
      const permissao = await Notification.requestPermission()
      // 'default' NAO e 'denied': o Chrome do Android usa aviso silencioso e
      // muita gente nem ve a pergunta. Tratar os dois igual mandaria o
      // funcionario cavar as configuracoes quando bastava tocar de novo.
      if (permissao === 'denied') {
        setEstado('negado')
        return false
      }
      if (permissao !== 'granted') {
        setEstado('dispensado')
        return false
      }

      const registro = await navigator.serviceWorker.ready
      const inscricao =
        (await registro.pushManager.getSubscription()) ||
        (await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ParaUint8(chave),
        }))

      await api.post('/notifications/push-subscribe/staff', inscricao.toJSON())
      setEstado('ativo')
      return true
    } catch {
      setEstado('erro')
      return false
    } finally {
      setOcupado(false)
    }
  }, [])

  return { estado, ocupado, ativar }
}
