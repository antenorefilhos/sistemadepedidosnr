export interface SolidcomPedidoEnderecoDto {
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  cep: string
  estado: string
}

export interface SolidcomPedidoClienteDto {
  cpf: number
  nome: string
  /** Nunca omitir: GravaPedido do ERP faz .Length nesses campos sem checar
   *  nulo e estoura NullReferenceException. String vazia e aceita. */
  endereco: SolidcomPedidoEnderecoDto
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
  /** Idem endereco: nunca pode ser null, o ERP quebra. */
  obs: string
  referencia: string
  itens: SolidcomPedidoItemDto[]
  cliente: SolidcomPedidoClienteDto
}