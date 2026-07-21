-- CreateTable
CREATE TABLE "recipe_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "imageUrl" TEXT,
    "prepTime" INTEGER,
    "servings" INTEGER,
    "difficulty" TEXT,
    "categoryId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "unit" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_steps" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,

    CONSTRAINT "recipe_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_products" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "note" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "recipe_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_relations" (
    "recipeId" TEXT NOT NULL,
    "relatedRecipeId" TEXT NOT NULL,

    CONSTRAINT "recipe_relations_pkey" PRIMARY KEY ("recipeId","relatedRecipeId")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "recipe_categories_name_key" ON "recipe_categories"("name");
CREATE UNIQUE INDEX "recipe_categories_slug_key" ON "recipe_categories"("slug");
CREATE UNIQUE INDEX "recipes_slug_key" ON "recipes"("slug");
CREATE UNIQUE INDEX "recipe_products_recipeId_productId_key" ON "recipe_products"("recipeId", "productId");

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "recipe_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_products" ADD CONSTRAINT "recipe_products_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_products" ADD CONSTRAINT "recipe_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_relations" ADD CONSTRAINT "recipe_relations_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_relations" ADD CONSTRAINT "recipe_relations_relatedRecipeId_fkey" FOREIGN KEY ("relatedRecipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
