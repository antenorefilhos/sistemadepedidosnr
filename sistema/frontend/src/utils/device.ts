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
