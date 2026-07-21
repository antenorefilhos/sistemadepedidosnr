import { Injectable, Logger } from '@nestjs/common'

interface WhatsAppMessage {
  to: string
  body: string
}

export interface WhatsAppDispatchResult {
  channel: 'whatsapp_web'
  to: string
  body: string
  url: string
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name)

  /**
   * Envia mensagem de confirmação de pedido
   */
  async sendOrderConfirmation(
    whatsappNumber: string,
    orderData: { 
      id: string; 
      total: number; 
      items: number; 
      paymentMethod?: string;
      notes?: string;
      changeAmount?: string;
    },
  ): Promise<WhatsAppDispatchResult | null> {
    const methodLabels: Record<string, string> = {
      CASH: '💵 Dinheiro',
      PIX: '📱 PIX',
      CARD: '💳 Cartão na Entrega',
    }

    const paymentLabel = methodLabels[orderData.paymentMethod || 'CASH'] || orderData.paymentMethod
    
    let message = `
🎉 *Pedido Confirmado!*

🆔 ID: #${orderData.id}
📦 Itens: ${orderData.items}
💰 *Total: R$ ${orderData.total.toFixed(2)}*
💳 Pagamento: ${paymentLabel}
`.trim()

    // Evita duplicação: só mostra troco separado se não estiver já nas notes
    const hasChangeInNotes = orderData.notes?.includes('Troco para:')
    if (orderData.changeAmount && !hasChangeInNotes) {
      message += `\n💵 *Troco para:* ${orderData.changeAmount}`
    }

    if (orderData.notes) {
      message += `\n📝 *Obs:* ${orderData.notes}`
    }

    message += `\n\nSeu pedido foi recebido e está em processamento.`

    if (orderData.paymentMethod === 'PIX') {
      message += `\n\n🔑 *Chave PIX:* \`11.222.333/0001-99\` (Antenor & Filhos)\n_Por favor, envie o comprovante após o pagamento._`
    }

    message += `\n\nObrigado por comprar no *Antenor & Filhos*! 🏬`

    return this.sendMessage(whatsappNumber, message.trim())
  }

  /**
   * Notificação de Carrinho Abandonado (Phase 17)
   */
  async sendAbandonedCartNotification(
    whatsappNumber: string,
    customerName: string,
    cartItems: { name: string; quantity: number; price: number }[],
  ): Promise<WhatsAppDispatchResult | null> {
    const firstName = customerName.split(' ')[0]
    const itemsList = cartItems
      .slice(0, 3)
      .map((i) => `• ${i.name} (x${i.quantity}) — R$ ${(i.price * i.quantity).toFixed(2)}`)
      .join('\n')
    const total = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const hasMore = cartItems.length > 3 ? `\n_...e mais ${cartItems.length - 3} item(s)_` : ''

    const message = `
🛒 *Olá, ${firstName}!*

Você deixou alguns produtos no carrinho do *Antenor & Filhos*:

${itemsList}${hasMore}

💰 *Total estimado: R$ ${total.toFixed(2)}*

Seu carrinho está te esperando! Finalize seu pedido agora e receba em casa com a qualidade que você conhece. 🏬

👇 Acesse: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/cart
    `.trim()

    return this.sendMessage(whatsappNumber, message)
  }

  /**
   * Envia notificação de mudança de status
   */
  async sendStatusUpdate(
    whatsappNumber: string,
    orderId: string,
    status: string,
  ): Promise<WhatsAppDispatchResult | null> {
    const messages: Record<string, string> = {
      PENDING: `⏳ Seu pedido ${orderId} foi recebido!`,
      CONFIRMED: `✅ Seu pedido ${orderId} foi confirmado e entrou em preparo!`,
      COMPLETED: `🎉 Seu pedido ${orderId} foi concluido com sucesso!`,
      DELIVERED: `✅ Seu pedido ${orderId} foi entregue! Obrigado! 🏬`,
      CANCELLED: `⚠️ Seu pedido ${orderId} foi cancelado. Se precisar, fale conosco no WhatsApp.`,
    }

    const message = messages[status] || `Status atualizado: ${status}`
    return this.sendMessage(whatsappNumber, message)
  }

  /**
   * Gera link compatível com WhatsApp Web/Desktop e registra o envio no backend.
   */
  private async sendMessage(to: string, body: string): Promise<WhatsAppDispatchResult | null> {
    const normalized = this.normalizeWhatsappNumber(to)
    if (!normalized) {
      this.logger.warn('WhatsApp inválido - link não gerado')
      return null
    }

    try {
      const payload: WhatsAppDispatchResult = {
        channel: 'whatsapp_web',
        to: normalized,
        body,
        url: `https://wa.me/${normalized}?text=${encodeURIComponent(body)}`,
      }

      this.logger.log(`WhatsApp Web pronto para ${normalized}: ${payload.url}`)
      return payload
    } catch (error) {
      this.logger.error('Erro ao enviar WhatsApp:', error)
      return null
    }
  }

  private normalizeWhatsappNumber(value: string): string {
    const digits = value.replace(/\D/g, '')
    if (!digits) return ''
    return digits.startsWith('55') ? digits : `55${digits}`
  }
}
