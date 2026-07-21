type ApiErrorLike = {
  userMessage?: string
  message?: string
  response?: {
    data?: {
      message?: string | string[]
    }
  }
}

export function getApiErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado'): string {
  const candidate = (error || {}) as ApiErrorLike

  if (typeof candidate.userMessage === 'string' && candidate.userMessage.trim()) {
    return candidate.userMessage
  }

  const data = candidate.response?.data
  const msg = data?.message

  if (Array.isArray(msg)) {
    return msg.join('\n')
  }

  if (typeof msg === 'string' && msg.trim()) {
    return msg
  }

  if (typeof candidate.message === 'string' && candidate.message.trim()) {
    return candidate.message
  }

  return fallback
}
