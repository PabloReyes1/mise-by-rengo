-- CreateTable
CREATE TABLE "category_modifier_groups" (
    "category_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,

    CONSTRAINT "category_modifier_groups_pkey" PRIMARY KEY ("category_id","group_id")
);

-- CreateIndex
CREATE INDEX "category_modifier_groups_group_id_idx" ON "category_modifier_groups"("group_id");

-- AddForeignKey
ALTER TABLE "category_modifier_groups" ADD CONSTRAINT "category_modifier_groups_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_modifier_groups" ADD CONSTRAINT "category_modifier_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grupos que ya existían: quedan disponibles en las categorías de los productos que los usan
INSERT INTO "category_modifier_groups" ("category_id", "group_id")
SELECT DISTINCT p."category_id", pmg."group_id"
FROM "product_modifier_groups" pmg
JOIN "products" p ON p."id" = pmg."product_id"
ON CONFLICT DO NOTHING;
