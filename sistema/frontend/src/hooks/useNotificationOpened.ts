import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../services/api'

/**
 * Clique no aviso (push): a URL chega com ?n=<id>. Registra a abertura para
 * medir o resultado dos avisos (29/09/2026) e tira o parametro da barra.
 */
export function useNotificationOpened() {
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const id = params.get('n')
    if (!id) return
    api.post(`/notifications/${encodeURIComponent(id)}/opened`).catch(() => undefined)
    params.delete('n')
    const search = params.toString()
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '', hash: location.hash }, { replace: true })
  }, [location.search, location.pathname, location.hash, navigate])
}
