-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "bill_id" UUID NOT NULL,
    "method_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "tendered" DECIMAL(12,2),
    "change_given" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "shift_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'APLICADO',
    "received_by" UUID NOT NULL,
    "created_device_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applied_discounts" (
    "id" UUID NOT NULL,
    "bill_id" UUID,
    "order_item_id" UUID,
    "kind" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason_id" UUID NOT NULL,
    "applied_by" UUID NOT NULL,
    "authorized_by" UUID,
    "created_device_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applied_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "gives_change" BOOLEAN NOT NULL DEFAULT false,
    "requires_reference" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_bill_id_idx" ON "payments"("bill_id");

-- CreateIndex
CREATE INDEX "payments_shift_id_idx" ON "payments"("shift_id");

-- CreateIndex
CREATE INDEX "applied_discounts_bill_id_idx" ON "applied_discounts"("bill_id");

-- CreateIndex
CREATE INDEX "applied_discounts_order_item_id_idx" ON "applied_discounts"("order_item_id");

-- Valores válidos (Docs/07 §4.5)
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_kind_check" CHECK ("kind" IN ('CASH', 'CARD', 'TRANSFER', 'OTHER'));
ALTER TABLE "payments" ADD CONSTRAINT "payments_status_check" CHECK ("status" IN ('APLICADO', 'REVERTIDO', 'EN_CONFLICTO'));
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check" CHECK ("amount" > 0);
ALTER TABLE "applied_discounts" ADD CONSTRAINT "applied_discounts_kind_check" CHECK ("kind" IN ('PCT', 'AMOUNT'));
ALTER TABLE "applied_discounts" ADD CONSTRAINT "applied_discounts_target_check" CHECK (("bill_id" IS NULL) <> ("order_item_id" IS NULL));
