export interface SolidcomPedidoClienteDto {
  cpf: number
  nome: string
}

export interface SolidcomPedidoItemDto {
  numero: number
  ean: number
  cdProduto: number
  inCodigoInterno: boolean
  nmProduto: string
  quantidade: number
  quantidadeAtendida: number
  valorUnitario: number
  valorDesconto: number
}

export interface SolidcomPedidoDto {
  cnpj: number
  numero: number
  data: string
  codEcom: number
  dav: number
  valorFrete: number
  valorDesconto: number
  retiraNaLoja: boolean
  ecommerceSolidcon: boolean
  ecommerceSolidconStatus: number
  referencia: string
  itens: SolidcomPedidoItemDto[]
  cliente: SolidcomPedidoClienteDto
}