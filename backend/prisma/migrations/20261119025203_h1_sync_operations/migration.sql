-- CreateTable
CREATE TABLE "sync_operations" (
    "idempotency_key" TEXT NOT NULL,
    "device_id" UUID NOT NULL,
    "op_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "client_created_at" TIMESTAMPTZ(6),
    "client_seq" INTEGER,
    "status" TEXT NOT NULL,
    "result" JSONB NOT NULL,

    CONSTRAINT "sync_operations_pkey" PRIMARY KEY ("idempotency_key")
);

-- CreateIndex
CREATE INDEX "sync_operations_device_id_received_at_idx" ON "sync_operations"("device_id", "received_at");

-- Agregado a mano (Docs/07 §4.7, Docs/09 §4.1)
ALTER TABLE "sync_operations" ADD CONSTRAINT "sync_operations_status_check"
  CHECK ("status" IN ('APLICADA', 'DUPLICADA', 'CONFLICTO', 'RECHAZADA'));
