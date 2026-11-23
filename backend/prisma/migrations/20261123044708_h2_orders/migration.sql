-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "occupancy_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "station_id" UUID,
    "round_number" SMALLINT NOT NULL,
    "folio" TEXT,
    "temp_folio" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ENVIADO',
    "sent_by" UUID NOT NULL,
    "sent_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "accepted_by" UUID,
    "ready_at" TIMESTAMPTZ(6),
    "ready_by" UUID,
    "delivered_at" TIMESTAMPTZ(6),
    "delivered_by" UUID,
    "delivered_auto" BOOLEAN NOT NULL DEFAULT false,
    "synced_late" BOOLEAN NOT NULL DEFAULT false,
    "printed_at" TIMESTAMPTZ(6),
    "print_device_id" UUID,
    "created_device_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "bill_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name_snapshot" TEXT NOT NULL,
    "quantity" DECIMAL(8,2) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "modifiers_total" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,
    "unit_cost_snapshot" DECIMAL(12,4),
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ENVIADO',
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by" UUID,
    "authorized_by" UUID,
    "cancel_reason_id" UUID,
    "cancel_after_ready" BOOLEAN NOT NULL DEFAULT false,
    "split_from_id" UUID,
    "ready_at" TIMESTAMPTZ(6),
    "created_device_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_modifiers" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "modifier_id" UUID NOT NULL,
    "name_snapshot" TEXT NOT NULL,
    "price_delta" DECIMAL(12,2) NOT NULL,
    "cost_snapshot" DECIMAL(12,4),

    CONSTRAINT "order_item_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_components" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "combo_group_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "name_snapshot" TEXT NOT NULL,
    "price_delta" DECIMAL(12,2) NOT NULL,
    "cost_snapshot" DECIMAL(12,4),
    "modifiers" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "order_item_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folio_sequences" (
    "branch_id" UUID NOT NULL,
    "doc_type" TEXT NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "folio_sequences_pkey" PRIMARY KEY ("branch_id","doc_type")
);

-- CreateIndex
CREATE INDEX "orders_occupancy_id_idx" ON "orders"("occupancy_id");

-- CreateIndex
CREATE INDEX "orders_branch_id_status_sent_at_idx" ON "orders"("branch_id", "status", "sent_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_bill_id_idx" ON "order_items"("bill_id");

-- CreateIndex
CREATE INDEX "order_item_modifiers_order_item_id_idx" ON "order_item_modifiers"("order_item_id");

-- CreateIndex
CREATE INDEX "order_item_components_order_item_id_idx" ON "order_item_components"("order_item_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_occupancy_id_fkey" FOREIGN KEY ("occupancy_id") REFERENCES "occupancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_split_from_id_fkey" FOREIGN KEY ("split_from_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "order_item_modifiers_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_components" ADD CONSTRAINT "order_item_components_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Agregado a mano (Prisma no genera CHECK ni índices parciales). Docs/07 §4.4, Docs/05 §5.3 y §5.4.
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check"
  CHECK ("status" IN ('ENVIADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'CANCELADO'));
ALTER TABLE "orders" ADD CONSTRAINT "orders_round_number_check" CHECK ("round_number" >= 1);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_status_check"
  CHECK ("status" IN ('ENVIADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'CANCELADO'));
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_cancelled_check"
  CHECK (("status" = 'CANCELADO') = ("cancelled_at" IS NOT NULL));
ALTER TABLE "folio_sequences" ADD CONSTRAINT "folio_sequences_doc_type_check"
  CHECK ("doc_type" IN ('ORDER', 'BILL'));

-- El folio definitivo no se repite en la sucursal
CREATE UNIQUE INDEX "orders_branch_folio_key" ON "orders" ("branch_id", "folio") WHERE "folio" IS NOT NULL;
