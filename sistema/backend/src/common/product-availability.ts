/**
 * O `syncOption` do Solidcom (coluna "Internet" no cadastro do produto)
 * decide se o produto e VENDAVEL -- nao quanto dele pode ser vendido.
 *
 * Decisao do lojista em 02/09/2026: o numero de estoque do ERP governa a
 * EXIBICAO, e so. Cliente que ve o produto pode pedir a quantidade que quiser,
 * mesmo acima do estoque sincronizado. O motivo e pratico: o dado de estoque
 * do Solidcom erra com frequencia (item de producao propria chega a -2897), a
 * loja repoe durante o dia, e barrar a venda por causa desse numero perdia
 * pedido de item que a loja tinha. Quando falta de verdade, quem resolve e o
 * separador -- ele fala com o cliente e usa a politica de substituicao que o
 * proprio cliente escolheu no carrinho.
 *
 *   SEMPRE  -> vendavel sempre, ignora o numero (producao propria)
 *   ESTOQUE -> vendavel enquanto o estoque for positivo
 *   NUNCA   -> nunca vendavel
 *   ausente -> produto legado/manual, sem opiniao do ERP: vendavel
 *
 * Mesmo criterio do `isStorefrontVisible` da vitrine -- se divergir, o cliente
 * ve na tela algo que o checkout recusa, que foi exatamente o bug de 17/08.
 */
export function isProductSellable(product: {
  active?: boolean | null
  syncOption?: string | null
  stock?: unknown
}): boolean {
  if (product.active === false) return false
  if (product.syncOption === 'NUNCA') return false
  // 'ESTQOUE' e um typo que existe em dados legados do ERP -- tratado junto
  // com o valor correto na vitrine, entao tem que ser tratado aqui tambem.
  if (product.syncOption === 'ESTOQUE' || product.syncOption === 'ESTQOUE') {
    return Number(product.stock || 0) > 0
  }
  return true
}
