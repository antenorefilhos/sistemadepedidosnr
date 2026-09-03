-- Push de funcionario: a inscricao passa a poder pertencer a um Admin
-- (separador/entregador) em vez de um Customer.
--
-- customerId vira opcional porque uma inscricao de funcionario nao tem
-- cliente. As linhas existentes sao todas de cliente e continuam validas.
ALTER TABLE "push_subscriptions" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "push_subscriptions" ADD COLUMN "adminId" TEXT;

CREATE INDEX "push_subscriptions_tenantId_adminId_idx"
  ON "push_subscriptions" ("tenantId", "adminId");

-- Uma inscricao pertence a exatamente um dono. Sem isso, um bug de codigo
-- criaria linha orfa (nenhum dono) que nunca recebe nada, ou linha com dois
-- donos que dispara em duplicidade -- os dois falham calados.
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_um_dono"
  CHECK (("customerId" IS NOT NULL) <> ("adminId" IS NOT NULL));
