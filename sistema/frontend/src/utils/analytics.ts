import axios from 'axios';
import { getDeviceId } from './device';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export type AnalyticsEventType = 
  | 'VIEW_PRODUCT'
  | 'VIEW_CATEGORY'
  | 'ADD_TO_CART'
  | 'SEARCH'
  | 'INITIATE_CHECKOUT';

// Sessao = visita: expira apos 30 min sem evento (mesmo criterio do GA).
// Sem isso nenhum evento carregava sessionId e nao dava pra medir conversao
// por visita (0 sessoes distintas em analytics_events ate 27/09/2026).
const SESSION_KEY = 'antenor.analyticsSession'
const SESSION_IDLE_MS = 30 * 60 * 1000

export const getSessionId = (): string | undefined => {
  try {
    const now = Date.now()
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as { id: string; lastSeen: number } | null
    const id = saved && now - saved.lastSeen < SESSION_IDLE_MS ? saved.id : `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, lastSeen: now }))
    return id
  } catch {
    return undefined
  }
}

export const trackEvent = async (type: AnalyticsEventType, entity?: string, entityId?: string, metadata?: any) => {
  try {
    const userJson = localStorage.getItem('user');
    const customerId = userJson ? JSON.parse(userJson).id : null;
    const deviceId = getDeviceId();
    const sessionId = getSessionId();

    // Envio "fire and forget" para não travar a UI
    axios.post(`${API_URL}/analytics/track`, {
      type,
      entity,
      entityId,
      customerId,
      deviceId,
      sessionId,
      metadata
    }).catch(() => {
      // Analytics failures do not impact user experience
    });
  } catch (error) {
    // Analytics nunca deve quebrar a experiência do usuário
  }
};
