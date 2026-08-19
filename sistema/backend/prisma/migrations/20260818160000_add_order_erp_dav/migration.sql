-- DAV gerado pelo Solidcom no envio do pedido. E o numero que o separador
-- digita no PDV pra puxar o pedido (o id interno tem letra, o PDV recusa).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "erpDav" TEXT;
