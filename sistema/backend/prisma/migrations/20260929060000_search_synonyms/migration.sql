-- Sinonimos da busca criados pelo admin (29/09/2026).
CREATE TABLE "search_synonyms" (
  "id" TEXT NOT NULL,
  "term" TEXT NOT NULL,
  "equivalents" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "search_synonyms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "search_synonyms_term_key" ON "search_synonyms"("term");
