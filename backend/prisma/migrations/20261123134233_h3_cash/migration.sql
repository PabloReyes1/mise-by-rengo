-- CreateTable
CREATE TABLE "cash_registers" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "device_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "opening_float_mode" TEXT NOT NULL DEFAULT 'VARIABLE',
    "opening_float_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "count_by_denomination" TEXT NOT NULL DEFAULT 'OPCIONAL',
    "is_main" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "cash_register_id" UUID NOT NULL,
    "opened_by" UUID NOT NULL,
    "opened_at" TIMESTAMPTZ(6) NOT NULL,
    "opening_float" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABIERTO',
    "closed_by" UUID,
    "closed_at" TIMESTAMPTZ(6),
    "closed_offline" BOOLEAN NOT NULL DEFAULT false,
    "provisional_expected_cash" DECIMAL(12,2),
    "expected_cash" DECIMAL(12,2),
    "counted_cash" DECIMAL(12,2),
    "difference" DECIMAL(12,2),
    "comment" TEXT,
    "report_snapshot" JSONB,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "bill_id" UUID,
    "payment_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason_id" UUID,
    "note" TEXT,
    "user_id" UUID NOT NULL,
    "authorized_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_counts" (
    "shift_id" UUID NOT NULL,
    "denomination" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "shift_counts_pkey" PRIMARY KEY ("shift_id","denomination")
);

-- CreateIndex
CREATE INDEX "cash_registers_branch_id_idx" ON "cash_registers"("branch_id");

-- CreateIndex
CREATE INDEX "shifts_cash_register_id_idx" ON "shifts"("cash_register_id");

-- CreateIndex
CREATE INDEX "cash_movements_shift_id_idx" ON "cash_movements"("shift_id");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_cash_register_id_fkey" FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_counts" ADD CONSTRAINT "shift_counts_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Estados y tipos válidos (Docs/07 §4.5)
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_float_mode_check" CHECK ("opening_float_mode" IN ('FIJO', 'VARIABLE'));
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_count_check" CHECK ("count_by_denomination" IN ('OPCIONAL', 'OBLIGATORIO'));
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_status_check" CHECK ("status" IN ('ABIERTO', 'EN_CORTE', 'CERRADO_PROVISIONAL', 'CERRADO'));
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_type_check" CHECK ("type" IN ('DEPOSITO', 'RETIRO', 'REVERSO_REAPERTURA'));
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_amount_check" CHECK ("amount" > 0);
-- Un solo turno abierto por caja (Docs/05 paso 1)
CREATE UNIQUE INDEX "shifts_one_open_per_register" ON "shifts" ("cash_register_id") WHERE "status" = 'ABIERTO';
-- Una sola caja principal por sucursal (PA-052)
CREATE UNIQUE INDEX "cash_registers_one_main_per_branch" ON "cash_registers" ("branch_id") WHERE "is_main";
