const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('notificador', {
  // Painel de pedidos
  getOrders: () => ipcRenderer.invoke('get-orders'),
  checkNow: () => ipcRenderer.invoke('check-now'),
  onOrdersUpdated: (callback) => ipcRenderer.on('orders-updated', (_event, orders) => callback(orders)),

  // Notificacao propria (substitui o toast nativo do Windows)
  onToast: (callback) => ipcRenderer.on('toast-show', (_event, data) => callback(data)),
  onToastHide: (callback) => ipcRenderer.on('toast-hide', () => callback()),
  toastClicked: () => ipcRenderer.send('toast-clicked'),
})
