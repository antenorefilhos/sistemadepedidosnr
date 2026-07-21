import { defineConfig } from "cypress";
import { createHmac } from "crypto";

type AdminAuth = {
  access_token: string;
  admin: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
    storeId: string;
  };
};

let cachedAdminAuth: AdminAuth | null = null;

function base64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function createLocalAdminAuth(): AdminAuth {
  if (cachedAdminAuth) return cachedAdminAuth;

  const secret =
    process.env.CYPRESS_ADMIN_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "antenor_local_stack_jwt_secret_2026_min_32_chars";
  const now = Math.floor(Date.now() / 1000);
  const admin = {
    id: "qa-admin-cypress",
    email: "admin@antenor.com.br",
    name: "Admin Antenor",
    role: "admin",
    tenantId: "tenant_default",
    storeId: "store_default",
  };
  const header = { alg: "HS256", typ: "JWT" };
  const payload = { ...admin, iat: now, exp: now + 60 * 60 };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = createHmac("sha256", secret).update(unsigned).digest("base64url");

  cachedAdminAuth = {
    access_token: `${unsigned}.${signature}`,
    admin,
  };

  return cachedAdminAuth;
}

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3002",
    setupNodeEvents(on, config) {
      on("task", {
        adminAuth() {
          return createLocalAdminAuth();
        },
      });

      return config;
    },
    supportFile: "cypress/support/e2e.ts",
  },
});
