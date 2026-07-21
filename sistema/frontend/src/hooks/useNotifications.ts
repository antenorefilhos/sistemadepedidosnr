import { useCallback, useMemo, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { notificationsAPI } from '../services/api'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = `${base64String}${padding}`
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

export function useNotifications() {
  const [pushStatus, setPushStatus] = useState<'idle' | 'enabled' | 'denied' | 'unsupported' | 'missing-key' | 'error'>('idle')
  const canUsePush = useMemo(() => (
    typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'Notification' in window
    && 'PushManager' in window
  ), [])

  const { data: notifications = [], refetch, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      try {
        const res = await notificationsAPI.list()
        return res.data
      } catch {
        return []
      }
    },
    enabled: typeof window !== 'undefined', // Client-side only
    refetchInterval: 30000, // Poll every 30s
    staleTime: 10000,
  })

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: async () => {
      try {
        const res = await notificationsAPI.unreadCount()
        return res.data as number
      } catch {
        return 0
      }
    },
    enabled: typeof window !== 'undefined',
    refetchInterval: 30000,
    staleTime: 10000,
  })

  const markAsReadMut = useMutation({
    mutationFn: (id: string) => notificationsAPI.markAsRead(id),
    onSuccess: () => {
      refetch()
    },
  })

  const subscribeToPushMut = useMutation({
    mutationFn: async (subscription: PushSubscriptionJSON) =>
      notificationsAPI.subscribeToPush(subscription as any),
  })

  const requestPushPermission = useCallback(async () => {
    if (!canUsePush) {
      setPushStatus('unsupported')
      return false
    }

    try {
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
      if (!vapidPublicKey) {
        setPushStatus('missing-key')
        return false
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPushStatus('denied')
        return false
      }

      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      if (existing) {
        await subscribeToPushMut.mutateAsync(existing.toJSON())
        setPushStatus('enabled')
        return true
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
      await subscribeToPushMut.mutateAsync(subscription.toJSON())
      setPushStatus('enabled')
      return true
    } catch {
      setPushStatus('error')
      return false
    }
  }, [canUsePush, subscribeToPushMut])

  const permission =
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'default'

  return {
    notifications,
    unreadCount,
    isLoading,
    canUsePush,
    pushPermission: permission,
    pushStatus,
    isSubscribingToPush: subscribeToPushMut.isLoading,
    markAsRead: (id: string) => markAsReadMut.mutate(id),
    subscribeToPush: (sub: PushSubscriptionJSON) => subscribeToPushMut.mutate(sub),
    requestPushPermission,
  }
}
