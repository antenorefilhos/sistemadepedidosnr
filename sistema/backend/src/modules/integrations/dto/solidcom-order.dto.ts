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
  /** Vai pra coluna Telefone do pedido no ERP. Max 12 no schema deles. */
  telefone: string
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
  /** O ERP grava a coluna CEP do pedido a partir DESTE campo, nao do
   *  cliente.endereco.cep. Max 8 no schema deles (so digitos). */
  cep: string
  /** Hora combinada de entrega/retirada. O Dorsal so libera o pedido pra
   *  separacao 15 min antes desse horario -- mandar vazio deixa o pedido
   *  sem previsao na tela deles. */
  hrCombinada: string
  referencia: string
  itens: SolidcomPedidoItemDto[]
  cliente: SolidcomPedidoClienteDto
}