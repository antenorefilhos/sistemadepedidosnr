import { useEffect, useState } from 'react'
import {
  formatDeliveryAddressLabel,
  readDeliveryAddress,
  subscribeDeliveryAddress,
  type DeliveryAddressSnapshot,
} from '../utils/deliveryAddress'

type UseDeliveryAddressResult = {
  deliveryAddress: DeliveryAddressSnapshot | null
  deliveryAddressLabel: string | null
}

export function useDeliveryAddress(): UseDeliveryAddressResult {
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddressSnapshot | null>(() => readDeliveryAddress())

  useEffect(() => {
    setDeliveryAddress(readDeliveryAddress())
    return subscribeDeliveryAddress(() => {
      setDeliveryAddress(readDeliveryAddress())
    })
  }, [])

  return {
    deliveryAddress,
    deliveryAddressLabel: deliveryAddress ? formatDeliveryAddressLabel(deliveryAddress) : null,
  }
}