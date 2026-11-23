-- CreateTable
CREATE TABLE "realtime_events" (
    "seq" BIGSERIAL NOT NULL,
    "branch_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "rooms" TEXT[],
    "payload" JSONB NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "realtime_events_pkey" PRIMARY KEY ("seq")
);

-- CreateIndex
CREATE INDEX "realtime_events_branch_id_seq_idx" ON "realtime_events"("branch_id", "seq");

-- CreateIndex
CREATE INDEX "realtime_events_at_idx" ON "realtime_events"("at");
