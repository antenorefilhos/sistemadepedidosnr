import axios from 'axios';
import { getDeviceId } from './device';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export type AnalyticsEventType = 
  | 'VIEW_PRODUCT'
  | 'VIEW_CATEGORY'
  | 'ADD_TO_CART'
  | 'SEARCH'
  | 'INITIATE_CHECKOUT';

export const trackEvent = async (type: AnalyticsEventType, entity?: string, entityId?: string, metadata?: any) => {
  try {
    const userJson = localStorage.getItem('user');
    const customerId = userJson ? JSON.parse(userJson).id : null;
    const deviceId = getDeviceId();

    // Envio "fire and forget" para não travar a UI
    axios.post(`${API_URL}/analytics/track`, {
      type,
      entity,
      entityId,
      customerId,
      deviceId,
      metadata
    }).catch(() => {
      // Analytics failures do not impact user experience
    });
  } catch (error) {
    // Analytics nunca deve quebrar a experiência do usuário
  }
};
