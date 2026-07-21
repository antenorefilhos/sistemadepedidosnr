import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { FiscalDocumentContract } from './dto/fiscal-document.dto'

export interface NfePushResult {
  ref: string
  status: string
  chaveNfe?: string
  numeroNfe?: string
  message?: string
}

@Injectable()
export class NfeService {
  private readonly logger = new Logger(NfeService.name)

  private get providerUrl(): string {
    return (process.env.NFE_PROVIDER_URL || '').replace(/\/$/, '')
  }

  private get apiKey(): string {
    return process.env.NFE_API_KEY || ''
  }

  private get cnpjEmitente(): string {
    return process.env.NFE_CNPJ_EMITENTE || ''
  }

  isConfigured(): boolean {
    return !!(this.providerUrl && this.apiKey && this.cnpjEmitente)
  }

  async emitirDocumento(contract: FiscalDocumentContract): Promise<NfePushResult> {
    if (!this.isConfigured()) {
      throw new Error('Conector NF-e não configurado: verifique NFE_PROVIDER_URL, NFE_API_KEY e NFE_CNPJ_EMITENTE.')
    }

    const ref = `order-${contract.orderId.slice(-12)}`
    const payload = this.buildFocusNfePayload(contract, ref)

    const url = `${this.providerUrl}/v2/nfe?ref=${encodeURIComponent(ref)}`

    const response = await axios.post(url, payload, {
      auth: { username: this.apiKey, password: '' },
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    })

    const data = response.data as Record<string, unknown>
    return {
      ref,
      status: String(data.status || 'autorizado'),
      chaveNfe: data.chave_nfe as string | undefined,
      numeroNfe: data.numero as string | undefined,
      message: data.mensagem_sefaz as string | undefined,
    }
  }

  private buildFocusNfePayload(contract: FiscalDocumentContract, ref: string): Record<string, unknown> {
    const dataEmissao = contract.dataEmissao.slice(0, 19)

    return {
      natureza_operacao: contract.naturezaOperacao,
      data_emissao: dataEmissao,
      data_entrada_saida: dataEmissao,
      tipo_documento: 1,
      finalidade_emissao: 1,
      cnpj_emitente: this.cnpjEmitente.replace(/\D/g, ''),
      nome_destinatario: contract.destinatarioNome || 'CONSUMIDOR FINAL',
      cpf_destinatario: contract.destinatarioCpf ? contract.destinatarioCpf.replace(/\D/g, '') : undefined,
      informacoes_adicionais_contribuinte: contract.observacoes || `Pedido ref: ${ref}`,
      valor_subtotal_tributavel: contract.valorSubtotal.toFixed(2),
      valor_total_nota: contract.valorTotal.toFixed(2),
      valor_desconto: contract.valorDesconto > 0 ? contract.valorDesconto.toFixed(2) : undefined,
      valor_frete: contract.valorFrete > 0 ? contract.valorFrete.toFixed(2) : undefined,
      items: contract.itens.map((item, idx) => ({
        numero_item: idx + 1,
        codigo_produto: item.ean || item.productId.slice(-8),
        descricao: item.descricao,
        codigo_ncm: item.ncm || '22021000',
        cfop: item.cfop || '5102',
        unidade_comercial: item.unidade || 'UN',
        quantidade_comercial: item.quantidade,
        valor_unitario_comercial: item.valorUnitario.toFixed(4),
        valor_bruto: item.valorTotal.toFixed(2),
        icms_situacao_tributaria: item.cst || '400',
        icms_origem: 0,
        pis_situacao_tributaria: '07',
        cofins_situacao_tributaria: '07',
      })),
    }
  }
}
