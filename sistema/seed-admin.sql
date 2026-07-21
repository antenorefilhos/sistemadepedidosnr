-- Insert admin user
-- Credencial padrão: admin@antenor.com.br / admin2026
-- Hash gerado com bcrypt rounds=10
-- Para alterar a senha: gere um novo hash com `npx bcryptjs <nova_senha>` e substitua abaixo
INSERT INTO admins (id, email, password, name, active, "createdAt", "updatedAt") 
VALUES (
  gen_random_uuid()::text,
  'admin@antenor.com.br',
  '$2b$10$qajhIAI9eRPuA45k10P6MO34FvEmGuUxb1z032VnSRl2VoG/4F302',
  'Administrador',
  true,
  NOW(),
  NOW()
);
