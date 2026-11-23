-- AlterTable
ALTER TABLE "client_settings" ALTER COLUMN "kds_sound" SET DEFAULT '{"tone": "bell", "volume": 0.8, "repeatSec": 120}';

-- Arreglo 4 de la demo de H2: el recordatorio del KDS pasa de 30 s a 2 min donde seguía el de antes
UPDATE "client_settings"
SET "kds_sound" = jsonb_set("kds_sound", '{repeatSec}', '120')
WHERE ("kds_sound"->>'repeatSec')::int = 30;
