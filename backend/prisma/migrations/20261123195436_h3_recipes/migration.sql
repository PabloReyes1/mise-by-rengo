-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_conversions" (
    "from_unit_id" UUID NOT NULL,
    "to_unit_id" UUID NOT NULL,
    "factor" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "unit_conversions_pkey" PRIMARY KEY ("from_unit_id","to_unit_id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "base_unit_id" UUID NOT NULL,
    "current_unit_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_costs" (
    "id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "unit_cost" DECIMAL(12,4) NOT NULL,
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "set_by" UUID NOT NULL,

    CONSTRAINT "ingredient_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL,
    "product_id" UUID,
    "modifier_id" UUID,
    "is_subrecipe" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "yield_qty" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "yield_unit_id" UUID,
    "computed_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "computed_at" TIMESTAMPTZ(6),

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_lines" (
    "id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "ingredient_id" UUID,
    "subrecipe_id" UUID,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit_id" UUID NOT NULL,
    "waste_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "recipe_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_targets" (
    "id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "category_id" UUID,
    "product_id" UUID,
    "target_food_cost_pct" DECIMAL(5,2) NOT NULL,
    "rounding_step" DECIMAL(12,2) NOT NULL DEFAULT 1.00,
    "rounding_mode" TEXT NOT NULL DEFAULT 'UP',

    CONSTRAINT "cost_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "units_code_key" ON "units"("code");

-- CreateIndex
CREATE INDEX "ingredient_costs_ingredient_id_valid_from_idx" ON "ingredient_costs"("ingredient_id", "valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_product_id_key" ON "recipes"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_modifier_id_key" ON "recipes"("modifier_id");

-- CreateIndex
CREATE INDEX "recipe_lines_recipe_id_idx" ON "recipe_lines"("recipe_id");

-- CreateIndex
CREATE INDEX "recipe_lines_ingredient_id_idx" ON "recipe_lines"("ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "cost_targets_scope_category_id_product_id_key" ON "cost_targets"("scope", "category_id", "product_id");

-- AddForeignKey
ALTER TABLE "ingredient_costs" ADD CONSTRAINT "ingredient_costs_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Unidades del producto (templates/seed/units.json) para las bases que ya existían.
-- En un cliente nuevo las carga el seed (sin duplicar, por code).
INSERT INTO "units" ("id", "code", "name", "dimension") VALUES
    (gen_random_uuid(), 'kg', 'Kilogramo', 'MASS'),
    (gen_random_uuid(), 'g', 'Gramo', 'MASS'),
    (gen_random_uuid(), 'l', 'Litro', 'VOLUME'),
    (gen_random_uuid(), 'ml', 'Mililitro', 'VOLUME'),
    (gen_random_uuid(), 'u', 'Unidad', 'COUNT'),
    (gen_random_uuid(), 'oz', 'Onza', 'MASS')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "unit_conversions" ("from_unit_id", "to_unit_id", "factor")
SELECT f."id", t."id", c."factor"
FROM (VALUES ('kg', 'g', 1000::numeric), ('l', 'ml', 1000), ('oz', 'g', 28.349523)) AS c("from", "to", "factor")
JOIN "units" f ON f."code" = c."from"
JOIN "units" t ON t."code" = c."to"
ON CONFLICT DO NOTHING;
