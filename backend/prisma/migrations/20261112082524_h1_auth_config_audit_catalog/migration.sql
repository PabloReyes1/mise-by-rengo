-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "client_at" TIMESTAMPTZ(6),
    "branch_id" UUID,
    "user_id" UUID,
    "authorized_by" UUID,
    "device_id" UUID,
    "ip" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason_id" UUID,
    "note" TEXT,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "pin_hash" TEXT,
    "pin_set_at" TIMESTAMPTZ(6),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "max_discount_pct" DECIMAL(5,2),
    "max_discount_amount" DECIMAL(12,2),
    "is_system" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_code" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_code")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "user_branches" (
    "user_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,

    CONSTRAINT "user_branches_pkey" PRIMARY KEY ("user_id","branch_id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "device_token_hash" TEXT NOT NULL,
    "offline_prefix" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT '',
    "last_seen_at" TIMESTAMPTZ(6),
    "app_version" TEXT,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_sessions" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pairing_codes" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pairing_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_stations" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "kitchen_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" UUID,
    "color" TEXT,
    "icon" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "station_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "short_description" TEXT,
    "sku" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "is_combo" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "image_media_id" UUID,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "cost_target_override" DECIMAL(5,2),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_groups" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "min_select" INTEGER NOT NULL DEFAULT 0,
    "max_select" INTEGER NOT NULL DEFAULT 1,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "modifier_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifiers" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price_delta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_modifier_groups" (
    "product_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_modifier_groups_pkey" PRIMARY KEY ("product_id","group_id")
);

-- CreateTable
CREATE TABLE "combo_groups" (
    "id" UUID NOT NULL,
    "combo_product_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "min_select" INTEGER NOT NULL DEFAULT 1,
    "max_select" INTEGER NOT NULL DEFAULT 1,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "combo_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "combo_group_options" (
    "id" UUID NOT NULL,
    "combo_group_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "price_delta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "combo_group_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_settings" (
    "id" UUID NOT NULL,
    "legal_name" TEXT NOT NULL DEFAULT '',
    "trade_name" TEXT NOT NULL,
    "nit" TEXT NOT NULL DEFAULT '',
    "logo_media_id" UUID,
    "currency_code" TEXT NOT NULL DEFAULT 'GTQ',
    "currency_symbol" TEXT NOT NULL DEFAULT 'Q',
    "decimals" SMALLINT NOT NULL DEFAULT 2,
    "locale" TEXT NOT NULL DEFAULT 'es-GT',
    "timezone" TEXT NOT NULL DEFAULT 'America/Guatemala',
    "business_day_cutoff" TEXT NOT NULL DEFAULT '04:00',
    "tips_enabled" BOOLEAN NOT NULL DEFAULT false,
    "tip_suggested_pct" DECIMAL(5,2),
    "tip_editable" BOOLEAN NOT NULL DEFAULT true,
    "tip_applies_takeaway" BOOLEAN NOT NULL DEFAULT false,
    "tip_base" TEXT NOT NULL DEFAULT 'AFTER_DISCOUNT',
    "tip_distribution" TEXT NOT NULL DEFAULT 'WAITER',
    "discounts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "soldout_on_send" TEXT NOT NULL DEFAULT 'ANY_USER_CONFIRMS',
    "table_cleaning_state" BOOLEAN NOT NULL DEFAULT false,
    "kitchen_ticket_order" TEXT NOT NULL DEFAULT 'CART',
    "theme_id" TEXT NOT NULL DEFAULT 'botanical-graphite',
    "color_primary_override" TEXT,
    "kds_thresholds" JSONB NOT NULL DEFAULT '{"warnMin": 10, "lateMin": 20, "from": "SENT"}',
    "kds_sound" JSONB NOT NULL DEFAULT '{"tone": "bell", "volume": 0.8, "repeatSec": 30}',
    "cash_diff_threshold" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "auto_print_receipt" BOOLEAN NOT NULL DEFAULT false,
    "offline_policy" JSONB NOT NULL DEFAULT '{}',
    "ui_texts" JSONB NOT NULL DEFAULT '{}',
    "settings_version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "client_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license" (
    "id" UUID NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVA',
    "modules" JSONB NOT NULL DEFAULT '{}',
    "limits" JSONB NOT NULL DEFAULT '{}',
    "valid_until" DATE,
    "grace_days" INTEGER NOT NULL DEFAULT 0,
    "updated_by_platform_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "nit_override" TEXT,
    "timezone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "folio_prefix" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_periods" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,

    CONSTRAINT "service_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_templates" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "doc_type" TEXT NOT NULL,
    "header" TEXT NOT NULL DEFAULT '',
    "footer" TEXT NOT NULL DEFAULT '',
    "show_logo" BOOLEAN NOT NULL DEFAULT true,
    "paper_width" SMALLINT NOT NULL DEFAULT 80,
    "options" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ticket_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requires_table" BOOLEAN NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "order_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reasons" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "reasons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_at_idx" ON "audit_log"("at");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "devices_device_token_hash_key" ON "devices"("device_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "devices_offline_prefix_key" ON "devices"("offline_prefix");

-- CreateIndex
CREATE INDEX "devices_branch_id_idx" ON "devices"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_sessions_refresh_token_hash_key" ON "device_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "device_sessions_device_id_idx" ON "device_sessions"("device_id");

-- CreateIndex
CREATE INDEX "device_sessions_user_id_idx" ON "device_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "pairing_codes_code_hash_key" ON "pairing_codes"("code_hash");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "modifiers_group_id_idx" ON "modifiers"("group_id");

-- CreateIndex
CREATE INDEX "combo_groups_combo_product_id_idx" ON "combo_groups"("combo_product_id");

-- CreateIndex
CREATE INDEX "combo_group_options_combo_group_id_idx" ON "combo_group_options"("combo_group_id");

-- CreateIndex
CREATE INDEX "service_periods_branch_id_idx" ON "service_periods"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_templates_branch_id_doc_type_key" ON "ticket_templates"("branch_id", "doc_type");

-- CreateIndex
CREATE UNIQUE INDEX "order_types_code_key" ON "order_types"("code");

-- CreateIndex
CREATE INDEX "reasons_type_idx" ON "reasons"("type");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairing_codes" ADD CONSTRAINT "pairing_codes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_stations" ADD CONSTRAINT "kitchen_stations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "kitchen_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_image_media_id_fkey" FOREIGN KEY ("image_media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "modifier_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "product_modifier_groups_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "product_modifier_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "modifier_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_groups" ADD CONSTRAINT "combo_groups_combo_product_id_fkey" FOREIGN KEY ("combo_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_group_options" ADD CONSTRAINT "combo_group_options_combo_group_id_fkey" FOREIGN KEY ("combo_group_id") REFERENCES "combo_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_group_options" ADD CONSTRAINT "combo_group_options_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_periods" ADD CONSTRAINT "service_periods_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_templates" ADD CONSTRAINT "ticket_templates_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Reglas que Prisma no genera (Docs/07: estados como texto con CHECK, no enum,
-- para poder agregar valores con migraciones aditivas).
-- ============================================================================
ALTER TABLE "license" ADD CONSTRAINT "license_status_check"
  CHECK ("status" IN ('ACTIVA', 'GRACIA', 'SOLO_LECTURA', 'SUSPENDIDA'));
ALTER TABLE "client_settings" ADD CONSTRAINT "client_settings_tip_base_check"
  CHECK ("tip_base" IN ('AFTER_DISCOUNT', 'BEFORE_DISCOUNT'));
ALTER TABLE "client_settings" ADD CONSTRAINT "client_settings_tip_distribution_check"
  CHECK ("tip_distribution" IN ('WAITER', 'POOL', 'HOUSE'));
ALTER TABLE "client_settings" ADD CONSTRAINT "client_settings_soldout_on_send_check"
  CHECK ("soldout_on_send" IN ('ANY_USER_CONFIRMS', 'MANAGER_AUTH', 'BLOCK'));
ALTER TABLE "client_settings" ADD CONSTRAINT "client_settings_kitchen_ticket_order_check"
  CHECK ("kitchen_ticket_order" IN ('CART', 'CATEGORY'));
ALTER TABLE "ticket_templates" ADD CONSTRAINT "ticket_templates_doc_type_check"
  CHECK ("doc_type" IN ('COMANDA', 'PRECUENTA', 'RECIBO', 'CORTE', 'MOVIMIENTO'));
ALTER TABLE "ticket_templates" ADD CONSTRAINT "ticket_templates_paper_width_check"
  CHECK ("paper_width" IN (58, 80));
ALTER TABLE "reasons" ADD CONSTRAINT "reasons_type_check"
  CHECK ("type" IN ('CANCEL_ITEM', 'REOPEN_BILL', 'DISCOUNT', 'CASH_WITHDRAWAL', 'CASH_DEPOSIT', 'CONFLICT'));
ALTER TABLE "devices" ADD CONSTRAINT "devices_type_check"
  CHECK ("type" IN ('WAITER', 'CASH', 'KDS', 'ADMIN'));
ALTER TABLE "products" ADD CONSTRAINT "products_status_check"
  CHECK ("status" IN ('ACTIVE', 'SOLD_OUT', 'INACTIVE'));
ALTER TABLE "products" ADD CONSTRAINT "products_price_check" CHECK ("price" >= 0);
ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_status_check"
  CHECK ("status" IN ('ACTIVE', 'SOLD_OUT', 'INACTIVE'));
ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_price_delta_check" CHECK ("price_delta" >= 0);
ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_select_check"
  CHECK ("min_select" >= 0 AND "min_select" <= "max_select");
ALTER TABLE "combo_groups" ADD CONSTRAINT "combo_groups_select_check"
  CHECK ("min_select" >= 0 AND "min_select" <= "max_select");

-- ============================================================================
-- Bitácora de solo INSERT (RF-255): ni la app ni nadie puede editarla o borrarla.
-- ============================================================================
CREATE FUNCTION "audit_log_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es de solo INSERT: no se puede modificar ni borrar';
END;
$$;

CREATE TRIGGER "audit_log_no_update_delete"
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_append_only"();

CREATE TRIGGER "audit_log_no_truncate"
  BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_log_append_only"();
