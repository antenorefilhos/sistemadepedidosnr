/**
 * GPS so faz sentido no aparelho que o cliente carrega consigo -- desktop
 * resolve geolocalizacao por Wi-Fi/IP e erra por quilometros mesmo "com
 * sucesso" (documentado em GPS_ACCURACY_THRESHOLD_M), e o numero da casa
 * nunca vem de GPS de qualquer forma, so decide rua/bairro/CEP. Testa
 * userAgent + touch, no padrao ja usado pra iOS em useNotifications.ts
 * (iPad em modo desktop se identifica como Mac no userAgent).
 */
export const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

const DEVICE_ID_KEY = 'antenor_device_id';

export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    // Check if crypto.randomUUID is available
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      deviceId = crypto.randomUUID();
    } else {
      // Fallback manual generator
      const screenInfo = `${window.screen.width}x${window.screen.height}`;
      const randomPart = Math.random().toString(36).substring(2, 10);
      deviceId = `dev_${screenInfo}_${Date.now()}_${randomPart}`;
    }
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
};
