import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'

/**
 * E-mail transacional via Resend (REST simples, sem SMTP). So usado hoje pra
 * recuperacao de senha do admin -- se RESEND_API_KEY nao estiver setada, loga
 * e retorna false em vez de quebrar o fluxo que chamou.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly apiKey = process.env.RESEND_API_KEY
  private readonly from = process.env.RESEND_FROM_EMAIL || 'Antenor & Filhos <onboarding@resend.dev>'

  async send(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn(`RESEND_API_KEY nao configurada -- e-mail para ${to} nao enviado.`)
      return false
    }
    try {
      await axios.post(
        'https://api.resend.com/emails',
        { from: this.from, to, subject, html },
        { headers: { Authorization: `Bearer ${this.apiKey}` }, timeout: 10000 },
      )
      return true
    } catch (error) {
      this.logger.error(`Falha ao enviar e-mail para ${to}:`, error instanceof Error ? error.message : String(error))
      return false
    }
  }

  async sendPasswordReset(to: string, name: string, resetUrl: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #5D082A;">Redefinir senha</h2>
        <p>Olá, ${name}.</p>
        <p>Recebemos um pedido de redefinição de senha para a sua conta no Antenor & Filhos. Se não foi você, ignore este e-mail.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#5D082A;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Redefinir senha</a></p>
        <p style="color:#888;font-size:13px;">Esse link expira em 1 hora. Se você não pediu isso, ignore este e-mail.</p>
      </div>
    `
    return this.send(to, 'Redefinir sua senha - Antenor & Filhos', html)
  }
}
