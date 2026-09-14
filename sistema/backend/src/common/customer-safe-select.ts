// JON-71 (Auditoria 360, High): respostas operacionais (pedidos, picking,
// entrega, API publica, exportacao LGPD) incluiam o Customer sem projecao e
// vazavam password/resetTokenHash/resetTokenExpiresAt. Prisma nesta versao
// nao tem a preview `omitApi` habilitada, entao a projecao e feita por
// `select` explicito (todo escalar do model, exceto os 3 segredos) em vez de
// `omit`. auth.service.ts fica de fora de proposito: precisa desses campos
// pra login/reset e nunca os devolve na resposta HTTP.
export const CUSTOMER_SAFE_SELECT = {
  id: true,
  tenantId: true,
  name: true,
  cpf: true,
  whatsapp: true,
  email: true,
  origin: true,
  blocked: true,
  blockedReason: true,
  createdAt: true,
  updatedAt: true,
} as const
