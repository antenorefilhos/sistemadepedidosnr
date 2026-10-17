import { Injectable } from '@nestjs/common'
import { winstonLogger } from '../../common/logger'

/**
 * Bot do Telegram (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID), ja em producao
 * pelo check-up diario (CheckupService, 28/09/2026). Extraido daqui em
 * 17/10/2026 pra MissingProductsMonitor reaproveitar sem duplicar a chamada
 * — mesmo token, mesmo chat, um lugar so decide como resolver/enviar.
 */
@Injectable()
export class TelegramService {
  private async resolveChatId(token: string): Promise<string | null> {
    if (process.env.TELEGRAM_CHAT_ID) return process.env.TELEGRAM_CHAT_ID
    // Sem chat configurado, usa a ultima conversa que mandou /start ao robo.
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`)
    const body = (await res.json()) as { result?: Array<{ message?: { chat?: { id: number } } }> }
    const last = [...(body.result || [])].reverse().find((u) => u.message?.chat?.id)
    return last?.message?.chat?.id ? String(last.message.chat.id) : null
  }

  async send(text: string): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      winstonLogger.warn('telegram_nao_enviado', { motivo: 'TELEGRAM_BOT_TOKEN vazio' })
      return false
    }
    const chatId = await this.resolveChatId(token)
    if (!chatId) {
      winstonLogger.warn('telegram_nao_enviado', { motivo: 'nenhum chat: mande /start ao robo' })
      return false
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true }),
    })
    return res.ok
  }
}
