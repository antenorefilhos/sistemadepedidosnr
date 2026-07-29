-- Insert admin user
-- ATENCAO: nao versione hash de senha real aqui. Prefira o seed do Prisma, que
-- le a senha de ADMIN_PASSWORD (.env, nao versionado):
--   cd sistema/backend && npm run prisma:seed
-- Se precisar usar este SQL, gere o hash localmente e substitua o placeholder
-- abaixo SEM commitar o valor:
--   node -e "console.log(require('bcrypt').hashSync(process.env.ADMIN_PASSWORD,10))"
INSERT INTO admins (id, email, password, name, active, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'admin@antenor.com.br',
  '<BCRYPT_HASH_AQUI>',
  'Administrador',
  true,
  NOW(),
  NOW()
);
