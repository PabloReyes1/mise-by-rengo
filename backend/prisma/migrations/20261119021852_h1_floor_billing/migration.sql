-- CreateTable
CREATE TABLE "bills" (
    "id" UUID NOT NULL,
    "occupancy_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABIERTA',
    "folio" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tip_pct" DECIMAL(5,2),
    "tip_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paid_at" TIMESTAMPTZ(6),
    "paid_by" UUID,
    "cash_register_id" UUID,
    "shift_id" UUID,
    "reopen_count" INTEGER NOT NULL DEFAULT 0,
    "precheck_count" INTEGER NOT NULL DEFAULT 0,
    "customer_nit" TEXT,
    "customer_tax_name" TEXT,
    "owner_device_id" UUID NOT NULL,
    "created_device_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dining_tables" (
    "id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" SMALLINT NOT NULL,
    "shape" TEXT NOT NULL DEFAULT 'SQUARE',
    "pos_x" INTEGER,
    "pos_y" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'LIBRE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "current_occupancy_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "dining_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occupancies" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "table_id" UUID,
    "order_type_id" UUID NOT NULL,
    "waiter_id" UUID NOT NULL,
    "guests" SMALLINT NOT NULL,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ABIERTA',
    "merged_into_id" UUID,
    "owner_device_id" UUID NOT NULL,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),
    "business_date" DATE NOT NULL,
    "created_device_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "occupancies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bills_occupancy_id_idx" ON "bills"("occupancy_id");

-- CreateIndex
CREATE UNIQUE INDEX "bills_folio_key" ON "bills"("folio");

-- CreateIndex
CREATE INDEX "zones_branch_id_idx" ON "zones"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "dining_tables_current_occupancy_id_key" ON "dining_tables"("current_occupancy_id");

-- CreateIndex
CREATE INDEX "occupancies_branch_id_status_idx" ON "occupancies"("branch_id", "status");

-- CreateIndex
CREATE INDEX "occupancies_table_id_idx" ON "occupancies"("table_id");

-- CreateIndex
CREATE INDEX "occupancies_business_date_idx" ON "occupancies"("business_date");

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_occupancy_id_fkey" FOREIGN KEY ("occupancy_id") REFERENCES "occupancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_current_occupancy_id_fkey" FOREIGN KEY ("current_occupancy_id") REFERENCES "occupancies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occupancies" ADD CONSTRAINT "occupancies_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occupancies" ADD CONSTRAINT "occupancies_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "dining_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occupancies" ADD CONSTRAINT "occupancies_order_type_id_fkey" FOREIGN KEY ("order_type_id") REFERENCES "order_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occupancies" ADD CONSTRAINT "occupancies_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "occupancies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Agregado a mano (Prisma no genera CHECK ni índices parciales). Docs/07 §4.4, Docs/05 §5.
-- ============================================================================

-- Una mesa solo tiene una ocupación abierta (Docs/07 occupancies). Ante dos meseros abriendo
-- la misma mesa a la vez, el segundo recibe 409 TABLE_OCCUPIED.
CREATE UNIQUE INDEX "occupancies_one_open_per_table"
  ON "occupancies" ("table_id") WHERE "status" = 'ABIERTA';

ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_status_check"
  CHECK ("status" IN ('LIBRE', 'OCUPADA', 'UNIDA', 'BLOQUEADA'));
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_shape_check"
  CHECK ("shape" IN ('SQUARE', 'ROUND', 'RECTANGLE'));
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_capacity_check"
  CHECK ("capacity" BETWEEN 1 AND 99);
-- Ocupada si y solo si tiene ocupación actual
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_current_occupancy_check"
  CHECK (("status" = 'OCUPADA') = ("current_occupancy_id" IS NOT NULL));

ALTER TABLE "occupancies" ADD CONSTRAINT "occupancies_status_check"
  CHECK ("status" IN ('ABIERTA', 'CERRADA', 'FUSIONADA', 'CANCELADA'));
ALTER TABLE "occupancies" ADD CONSTRAINT "occupancies_guests_check"
  CHECK ("guests" BETWEEN 1 AND 99);
ALTER TABLE "occupancies" ADD CONSTRAINT "occupancies_merged_check"
  CHECK (("status" = 'FUSIONADA') = ("merged_into_id" IS NOT NULL));

-- No existe ANULADA (PA-012)
ALTER TABLE "bills" ADD CONSTRAINT "bills_status_check"
  CHECK ("status" IN ('ABIERTA', 'PRECUENTA', 'PAGADA', 'ELIMINADA'));
ALTER TABLE "bills" ADD CONSTRAINT "bills_amounts_check"
  CHECK ("subtotal" >= 0 AND "discount_total" >= 0 AND "tip_amount" >= 0 AND "total" >= 0);
