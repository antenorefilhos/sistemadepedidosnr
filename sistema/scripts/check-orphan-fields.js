#!/usr/bin/env node
/**
 * Acha campo que o banco guarda e nenhum app mostra.
 *
 * Existe por uma familia de bug que apareceu SEIS vezes nesta base ate
 * 02/09/2026, sempre igual: o dado existe de um lado da fronteira e nada
 * consome do outro. Nada quebra, nenhum teste fica vermelho, o sistema parece
 * saudavel -- e alguem trabalha com menos informacao do que o sistema tem.
 *
 * Casos reais que este script teria pegado:
 * - `StoreBanner.slot='category'`, `pages`, `mobileImageUrl` — salvos no admin,
 *   nenhum componente do storefront lia.
 * - `DeliveryArea` e o CRUD de rotas — API completa, nenhuma tela chamava.
 * - `OrderItem.substitutionPolicy` — o cliente escolhia no carrinho, a logica
 *   do backend respeitava, e o separador nao via. Achado so por comparacao
 *   manual de prints entre um pedido nosso e um do app da Solidcom.
 *
 * Uso:
 *   node sistema/scripts/check-orphan-fields.js
 *
 * Sai com codigo 1 quando acha suspeito fora da lista de excecoes.
 *
 * IMPORTANTE: e lista de SUSPEITOS, nao veredito. Campo interno legitimo
 * (antifraude, snapshot, controle de fila) aparece aqui e deve ir pra
 * EXCECOES **com o motivo escrito** -- sem isso vira relatorio que ninguem le.
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const base = path.resolve(__dirname, '..')

/**
 * Modelos cujo dado um HUMANO precisa ver ou agir. Nao vale varrer o schema
 * inteiro: metade dele e infraestrutura (fila, auditoria, outbox) que nunca
 * deveria aparecer em tela, e o ruido afogaria o sinal.
 */
const MODELOS_COM_PUBLICO = [
  'Order',
  'OrderItem',
  'Customer',
  'Product',
  'StoreBanner',
  'DeliveryZone',
  'FulfillmentSlot',
  'DeliveryRoute',
  'DeliveryStop',
  'Driver',
  'Notification',
]

/** Onde um humano veria o dado. */
const APPS = ['frontend/src', 'admin/src', 'picking-app/src', 'delivery-app/src']

/** Ruido tecnico: nunca e conteudo de tela. */
const TECNICOS = new Set(['id', 'createdAt', 'updatedAt', 'tenantId', 'storeId'])

/**
 * Campos que sao internos DE PROPOSITO. Cada um com o motivo -- a proxima
 * pessoa precisa saber se pode confiar na isencao ou se ela envelheceu.
 */
const EXCECOES = {
  'Order.clientIp': 'antifraude e auditoria; expor IP de cliente em tela nao tem uso e piora privacidade',
  'Order.deviceId': 'antifraude; mesma razao do clientIp',
  'Order.customerSnapshot': 'copia historica pro caso de o cadastro mudar depois; a tela le o cadastro atual',
  'Order.deliverySnapshot': 'idem -- congelamento de frete/zona no momento do pedido',
  'Order.priceSnapshot': 'idem -- base da trava PRICE_DIVERGED do checkout, nao e conteudo de tela',
  'Order.addressSnapshot': 'idem -- endereco congelado; a tela usa os campos ja extraidos dele',
  'Order.fulfillmentSlotItemCount': 'controle de capacidade da janela, decisao do backend',
  'Order.deliveryStops': 'relacao, nao campo',
  'Order.deliveryAreaId': 'guarda id de DeliveryZone apesar do nome; uso interno do calculo de frete (ver CLAUDE.md)',
  'Customer.resetTokenHash': 'segredo de recuperacao de senha; expor em tela seria falha de seguranca',
  'Customer.resetTokenExpiresAt': 'idem -- validade do token, decisao do backend',
  'Product.erpProductId': 'id do Solidcom usado pra agrupar EANs no sync; o operador identifica produto por nome/EAN',
  'Product.secondaryEans': 'o backend JA resolve no scan do separador (picker.controller: secondaryEans has term) -- bipar codigo secundario funciona sem a tela saber',
  'Product.aiNotifiedAt': 'cooldown de 20h do ciclo de notificacao por IA, controle interno',
  'Driver.adminId': 'vinculo perfil<->conta de acesso, preenchido por ensureDriverProfile; o app usa o perfil ja resolvido',
  // Decisao consciente, nao esquecimento: o STATUS de aprovacao B2B aparece no
  // admin (BusinessAccountsSection); autor e data nao. E trilha de auditoria
  // faltando, nao fluxo quebrado -- anotado em docs/roadmap.md pra decidir se
  // vale tela. Se for descartado de vez, apagar estas tres linhas.
  'Order.businessApprovedBy': 'pendencia conhecida -- ver roadmap (auditoria de aprovacao B2B)',
  'Order.businessApprovedAt': 'pendencia conhecida -- ver roadmap (auditoria de aprovacao B2B)',
  'Order.businessInvoiceSnapshot': 'pendencia conhecida -- ver roadmap (faturamento B2B nao implementado)',
}

const schema = fs.readFileSync(path.join(base, 'backend/prisma/schema.prisma'), 'utf-8')

const ESCALARES = new Set([
  'String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Decimal', 'BigInt', 'Bytes',
])

const camposDoModelo = (modelo) => {
  const bloco = new RegExp(`model ${modelo} \\{(.*?)\\n\\}`, 's').exec(schema)
  if (!bloco) return null
  const campos = []
  for (const linha of bloco[1].split('\n')) {
    const l = linha.trim()
    if (!l || l.startsWith('//') || l.startsWith('@@') || l.startsWith('///')) continue
    const [nome, tipo] = l.split(/\s+/)
    if (!nome || !tipo || !/^[a-z]/.test(nome)) continue
    // Relacao (tipo e outro model) nao e dado exibivel por si -- o que importa
    // sao os campos do outro lado, checados quando aquele model for varrido.
    if (!ESCALARES.has(tipo.replace(/[?[\]]/g, ''))) continue
    campos.push(nome)
  }
  return campos
}

const usadoEmAlgumApp = (campo) => {
  try {
    execFileSync('grep', ['-rlq', '--', campo, ...APPS], { cwd: base, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const suspeitos = []
const ignorados = []
const modelosAusentes = []

for (const modelo of MODELOS_COM_PUBLICO) {
  const campos = camposDoModelo(modelo)
  if (!campos) {
    modelosAusentes.push(modelo)
    continue
  }
  for (const campo of campos) {
    if (TECNICOS.has(campo)) continue
    if (usadoEmAlgumApp(campo)) continue
    const chave = `${modelo}.${campo}`
    if (EXCECOES[chave]) ignorados.push(chave)
    else suspeitos.push(chave)
  }
}

if (modelosAusentes.length) {
  console.log(`aviso: modelo(s) nao encontrado(s) no schema (renomeado ou removido?): ${modelosAusentes.join(', ')}\n`)
}

if (suspeitos.length === 0) {
  console.log(`ok: nenhum campo orfao (${ignorados.length} excecao(oes) conhecida(s) ignorada(s)).`)
  process.exit(modelosAusentes.length ? 1 : 0)
}

console.log('CAMPOS GRAVADOS NO BANCO E NAO LIDOS POR NENHUM APP:\n')
for (const s of suspeitos) console.log('  ' + s)
console.log(`\n${suspeitos.length} suspeito(s). ${ignorados.length} excecao(oes) conhecida(s) ignorada(s).`)
console.log('\nPra cada um, decida: alguem deveria ver isso e falta a tela, ou e')
console.log('interno de proposito? Se for interno, adicione em EXCECOES aqui')
console.log('COM O MOTIVO -- isencao sem motivo vira lixo que ninguem revisa.')
process.exit(1)
