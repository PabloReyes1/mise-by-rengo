-- Unir mesas (RF-105, HU-029). Agregado a mano: Prisma no maneja CHECK.
-- Una mesa UNIDA también apunta a una ocupación: la suya, ya FUSIONADA, cuyo merged_into_id
-- lleva a la ocupación de la mesa principal. Así current_occupancy_id sigue siendo único.
ALTER TABLE "dining_tables" DROP CONSTRAINT "dining_tables_current_occupancy_check";
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_current_occupancy_check"
  CHECK (("status" IN ('OCUPADA', 'UNIDA')) = ("current_occupancy_id" IS NOT NULL));
