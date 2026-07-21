export interface FiscalDocumentItemContract {
  productId: string
  ean: string
  descricao: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  ncm: string
  cfop: string
  cst: string
  unidade: string
}

export interface FiscalDocumentContract {
  orderId: string
  naturezaOperacao: string
  dataEmissao: string
  emitenteCnpj: string
  destinatarioNome: string
  destinatarioCpf: string
  valorSubtotal: number
  valorDesconto: number
  valorFrete: number
  valorTotal: number
  observacoes: string | null
  itens: FiscalDocumentItemContract[]
}

export interface FiscalDocumentPreviewResponse {
  found: boolean
  orderId: string
  source?: 'live'
  contract?: FiscalDocumentContract
}
