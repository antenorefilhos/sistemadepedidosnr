const apiBase = 'http://localhost:3001'

type Product = {
  id: string
  name: string
  stock?: number
  active?: boolean
}

type Customer = {
  id: string
  email?: string
}

type OrderItem = {
  id: string
  productId: string
  quantity: number
  status?: string
  substitutesItemId?: string | null
}

type Order = {
  id: string
  customerId: string
  total: number
  status: string
  paymentStatus: string
  items: OrderItem[]
}

type TestContext = {
  token: string
  customer: Customer
  products: Product[]
}

type AvailabilityItem = {
  productId: string
  available: number
}

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
})

const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`

function adminRequest<T>(token: string, options: Partial<Cypress.RequestOptions>): Cypress.Chainable<T> {
  return cy.request<T>({
    failOnStatusCode: true,
    ...options,
    headers: {
      ...authHeaders(token),
      ...(options.headers || {}),
    },
  }).its('body')
}

function bootstrap(): Cypress.Chainable<TestContext> {
  return cy
    .task<{ access_token: string }>('adminAuth')
    .then(({ access_token: token }) => {
      return adminRequest<{ data: Product[] }>(token, {
        method: 'GET',
        url: `${apiBase}/products/admin?limit=20`,
      }).then((productsResponse) => {
        const activeProducts = productsResponse.data.filter((product) => product.active !== false)
        const productIds = activeProducts.map((product) => product.id).join(',')

        return adminRequest<{ items: AvailabilityItem[] }>(token, {
          method: 'GET',
          url: `${apiBase}/availability?productIds=${encodeURIComponent(productIds)}`,
        }).then((availability) => {
          const availableByProduct = new Map(availability.items.map((item) => [item.productId, Number(item.available)]))
          const products = activeProducts
            .filter((product) => Number(availableByProduct.get(product.id) || 0) > 5)
            .sort((a, b) => Number(availableByProduct.get(b.id) || 0) - Number(availableByProduct.get(a.id) || 0))
          expect(products, 'produtos ativos com disponibilidade real').to.have.length.greaterThan(1)

          return adminRequest<Customer[]>(token, {
            method: 'GET',
            url: `${apiBase}/customers`,
          }).then((customers) => {
            const customer = customers.find((entry) => entry.email === 'qa.cliente@antenor.com.br') || customers[0]
            expect(customer?.id, 'cliente para pedido QA').to.be.a('string').and.not.be.empty

            return { token, customer, products }
          })
        })
      })
    })
}

function createPickupOrder(ctx: TestContext, note: string, product = ctx.products[0], quantity = 1): Cypress.Chainable<Order> {
  return adminRequest<{ order: Order }>(ctx.token, {
    method: 'POST',
    url: `${apiBase}/orders`,
    body: {
      customerId: ctx.customer.id,
      items: [{ productId: product.id, quantity }],
      idempotencyKey: uniqueKey('m20-critical-order'),
      paymentMethod: 'PIX',
      fulfillmentType: 'PICKUP',
      delivery: 0,
      discount: 0,
      notes: note,
    },
  }).then(({ order }) => {
    expect(order.id).to.match(/^order_/)
    expect(order.items, 'itens do pedido criado').to.have.length.greaterThan(0)
    return order
  })
}

describe('M20 - fluxos criticos operacionais', () => {
  it('executa picking com ruptura e substituicao operacional', () => {
    bootstrap().then((ctx) => {
      createPickupOrder(ctx, 'QA M20 picking critico', ctx.products[0], 2).then((order) => {
        adminRequest<any>(ctx.token, {
          method: 'POST',
          url: `${apiBase}/admin/picking/tasks/from-order/${order.id}`,
          body: {},
        }).then((task) => {
          expect(task.status).to.eq('PENDING')
          expect(task.items).to.have.length.greaterThan(0)

          adminRequest<any>(ctx.token, {
            method: 'POST',
            url: `${apiBase}/admin/picking/tasks/${task.id}/assign`,
            body: { pickerId: 'qa-picker' },
          }).its('assignedToId').should('eq', 'qa-picker')

          adminRequest<any>(ctx.token, {
            method: 'POST',
            url: `${apiBase}/admin/picking/tasks/${task.id}/start`,
            body: {},
          }).then((started) => {
            expect(started.status).to.eq('IN_PROGRESS')

            const item = started.items[0]
            adminRequest<any>(ctx.token, {
              method: 'POST',
              url: `${apiBase}/admin/picking/tasks/${task.id}/items/${item.id}/pick`,
              body: { quantity: 1, notes: 'QA M20 separou parcialmente' },
            }).its('status').should('eq', 'IN_PROGRESS')

            adminRequest<any>(ctx.token, {
              method: 'POST',
              url: `${apiBase}/admin/picking/tasks/${task.id}/items/${item.id}/missing`,
              body: {
                reason: 'QA M20 ruptura controlada',
                requestSubstitution: true,
                notes: 'Cobertura E2E de ruptura',
              },
            }).then(() => {
              adminRequest<any>(ctx.token, {
                method: 'GET',
                url: `${apiBase}/admin/picking/tasks/${task.id}`,
              }).then((updatedTask) => {
                expect(updatedTask.items.some((entry: any) => entry.status === 'MISSING')).to.eq(true)
              })
            })

            adminRequest<any>(ctx.token, {
              method: 'POST',
              url: `${apiBase}/admin/picking/tasks/${task.id}/items/${item.id}/substitute`,
              body: {
                substituteProductId: ctx.products[1].id,
                quantity: 1,
                reason: 'QA M20 substituto aprovado',
                notes: 'Cobertura E2E de substituicao no picking',
              },
            }).then((substituted) => {
              expect(substituted.status).to.eq('IN_PROGRESS')
              expect(
                substituted.items.some((entry: any) => (
                  entry.substituteProductId === ctx.products[1].id ||
                  entry.productId === ctx.products[1].id
                )),
              ).to.eq(true)
            })
          })
        })
      })
    })
  })

  it('valida substituicao de pedido e cancelamento parcial OMS', () => {
    bootstrap().then((ctx) => {
      createPickupOrder(ctx, 'QA M20 OMS critico').then((order) => {
        const originalItem = order.items[0]

        adminRequest<any>(ctx.token, {
          method: 'POST',
          url: `${apiBase}/admin/orders/${order.id}/items/${originalItem.id}/substitute`,
          body: {
            substituteProductId: ctx.products[1].id,
            quantity: 1,
            reason: 'QA M20 substituicao OMS',
            pickerNotes: 'Cobertura E2E de substituicao OMS',
          },
        }).then((result) => {
          expect(result.sourceItem.status).to.eq('SUBSTITUTED')
          expect(result.substituteItem.productId).to.eq(ctx.products[1].id)

          adminRequest<any>(ctx.token, {
            method: 'POST',
            url: `${apiBase}/admin/orders/${order.id}/items/${result.substituteItem.id}/cancel`,
            body: {
              reason: 'QA M20 corte parcial',
              pickerNotes: 'Cobertura E2E de cancelamento parcial',
            },
          }).then((cancelled) => {
            expect(cancelled.item.status).to.eq('CANCELLED')
            expect(cancelled.order.items.some((entry: OrderItem) => entry.status === 'CANCELLED')).to.eq(true)
          })
        })
      })
    })
  })

  it('valida ERP Solidcom, webhook de pagamento e reembolso', () => {
    bootstrap().then((ctx) => {
      createPickupOrder(ctx, 'QA M20 integracoes criticas').then((order) => {
        adminRequest<any>(ctx.token, {
          method: 'GET',
          url: `${apiBase}/integrations/solidcom/status`,
        }).then((status) => {
          expect(status.integration).to.eq('solidcom')
          expect(status.enabled).to.eq(true)
        })

        adminRequest<any>(ctx.token, {
          method: 'GET',
          url: `${apiBase}/integrations/solidcom/orders/${order.id}/contract`,
        }).then((contract) => {
          expect(contract.found).to.eq(true)
          expect(contract.orderId).to.eq(order.id)
          expect(contract.externalPreview.ecommerceSolidcon).to.eq(true)
        })

        adminRequest<any>(ctx.token, {
          method: 'POST',
          url: `${apiBase}/integrations/payments/orders/${order.id}/transaction`,
          body: {
            provider: 'QA',
            method: 'PIX',
            status: 'PAID',
            amount: order.total,
            providerRef: uniqueKey('qa-payment'),
            idempotencyKey: uniqueKey('qa-payment-tx'),
          },
        }).then((transaction) => {
          expect(transaction.status).to.eq('PAID')

          adminRequest<any>(ctx.token, {
            method: 'POST',
            url: `${apiBase}/integrations/payments/refunds`,
            body: {
              orderId: order.id,
              transactionId: transaction.id,
              amount: 1.23,
              reason: 'QA M20 reembolso parcial',
              providerRef: uniqueKey('qa-refund'),
            },
          }).then((refund) => {
            expect(refund.status).to.eq('SUCCEEDED')
            expect(Number(refund.amount)).to.eq(1.23)
          })
        })

        createPickupOrder(ctx, 'QA M20 webhook pagamento', ctx.products[0], 1).then((webhookOrder) => {
          const chargeId = uniqueKey('qa-charge')
          cy.request({
            method: 'POST',
            url: `${apiBase}/integrations/payments/webhook`,
            headers: { 'x-webhook-signature': 'qa-local-signature' },
            body: {
              eventId: uniqueKey('qa-event'),
              event: 'charge.paid',
              chargeId,
              orderId: webhookOrder.id,
              provider: 'QA',
              method: 'PIX',
              status: 'PAID',
              amount: webhookOrder.total,
            },
          }).then((response) => {
            expect(response.status).to.eq(201)
            expect(response.body.processed).to.eq(true)
            expect(response.body.newPaymentStatus).to.eq('PAID')
          })

          adminRequest<any>(ctx.token, {
            method: 'GET',
            url: `${apiBase}/integrations/payments/webhook/events?limit=10`,
          }).then((events) => {
            expect(events.items.some((entry: any) => entry.chargeId === chargeId)).to.eq(true)
          })
        })
      })
    })
  })
})
