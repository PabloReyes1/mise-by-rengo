#!/usr/bin/env bash
# Alta de un cliente nuevo de Mise by Rengo (Docs/13-operacion.md §2).
#
# Uso:
#   sudo scripts/nuevo-cliente.sh <Nombre> <puerto> <dominio> [opciones]
#
# Opciones:
#   --nombre-comercial <t> Nombre que ve el restaurante (default: <Nombre>). Ej. "La Fonda"
#   --plantilla <nombre>   Plantilla de configuración inicial (default: restaurante-basico)
#   --plan <plan>          Plan comercial para registry.csv y el seed (default: MVP)
#   --modulos <a,b>        Módulos activos para registry.csv (default: vacío)
#   --solo-infra           Omite los pasos 4–7b (esquema, vistas, seed, administrador y código).
#                          Solo para probar el servidor de staging mientras no existan
#                          las migraciones ni el seed. Nunca para un cliente real.
#   -h, --help             Muestra esta ayuda
#
# Ejemplo:
#   sudo scripts/nuevo-cliente.sh LaFonda 3005 pos.lafonda.com
#
# Si un paso falla, se revierten los anteriores (proceso pm2, bloque de Caddy, base,
# roles, directorio y fila del registro) y el script termina con error.

set -Eeuo pipefail

# --- Rutas del servidor (Docs/13 §1) -----------------------------------------
MISE_ROOT="${MISE_ROOT:-/opt/mise}"
APP_DIR="$MISE_ROOT/app"
CLIENTS_DIR="$MISE_ROOT/clients"
REGISTRY="$CLIENTS_DIR/registry.csv"
BACKUPS_DIR="$MISE_ROOT/backups"
ECOSYSTEM="$MISE_ROOT/ecosystem.config.cjs"
MONITOR_ENV="$MISE_ROOT/monitor.env"
CADDY_CLIENTS="/etc/caddy/clients"
CADDY_TEMPLATE="$APP_DIR/templates/caddy/cliente.caddy"
SERVICE_USER="mise"
REGISTRY_HEADER="nombre,puerto,dominio,base,estado,plan,modulos,fecha_alta"

# Comandos del backend compilado (Deniscito, backend/src/seed-cli.ts y pairing-code-cli.ts).
# Leen DATABASE_URL del .env de la carpeta actual, así que se corren desde la carpeta del cliente.
SEED_CMD=(node "$APP_DIR/backend/dist/seed-cli.js")
PAIRING_CMD=(node "$APP_DIR/backend/dist/pairing-code-cli.js")

# --- Mensajes -----------------------------------------------------------------
log()  { printf '[NUEVO-CLIENTE] %s\n' "$*"; }
warn() { printf '[NUEVO-CLIENTE] AVISO: %s\n' "$*" >&2; }
die()  { printf '[NUEVO-CLIENTE] ERROR: %s\n' "$*" >&2; exit 1; }

usage() {
  sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

# --- Argumentos ---------------------------------------------------------------
PLANTILLA="restaurante-basico"
PLAN="MVP"
NOMBRE_COMERCIAL=""
MODULOS=""
SOLO_INFRA=0
POSITIONAL=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --nombre-comercial) NOMBRE_COMERCIAL="${2:?Falta el valor de --nombre-comercial}"; shift 2 ;;
    --plantilla) PLANTILLA="${2:?Falta el valor de --plantilla}"; shift 2 ;;
    --plan)      PLAN="${2:?Falta el valor de --plan}"; shift 2 ;;
    --modulos)   MODULOS="${2:?Falta el valor de --modulos}"; shift 2 ;;
    --solo-infra) SOLO_INFRA=1; shift ;;
    -h|--help)   usage 0 ;;
    -*)          die "Opción desconocida: $1 (usa --help)" ;;
    *)           POSITIONAL+=("$1"); shift ;;
  esac
done

[[ ${#POSITIONAL[@]} -eq 3 ]] || usage 1

NOMBRE="${POSITIONAL[0]}"
PUERTO="${POSITIONAL[1]}"
DOMINIO="${POSITIONAL[2],,}"
NOMBRE_LC="${NOMBRE,,}"
NOMBRE_COMERCIAL="${NOMBRE_COMERCIAL:-$NOMBRE}"
DB_NAME="mise_${NOMBRE_LC}"
ROLE_APP="mise_${NOMBRE_LC}_app"
ROLE_RO="mise_${NOMBRE_LC}_ro"
CLIENT_DIR="$CLIENTS_DIR/$NOMBRE"
PM2_NAME="mise-${NOMBRE_LC}"
CADDY_FILE="$CADDY_CLIENTS/${NOMBRE_LC}.caddy"

# --- Validaciones previas (Docs/13 §2) -----------------------------------------
[[ $EUID -eq 0 ]] || die "Ejecuta el script con sudo (crea bases, toca Caddy y pm2)."

for cmd in psql pg_dump pg_restore pm2 caddy openssl curl ss getent systemctl sed; do
  command -v "$cmd" >/dev/null 2>&1 || die "Falta el comando '$cmd' en el servidor (Docs/13 §1)."
done

# 1. Nombre
[[ "$NOMBRE" =~ ^[A-Za-z][A-Za-z0-9]{1,30}$ ]] \
  || die "Nombre inválido '$NOMBRE': solo letras y números, empieza con letra, 2 a 31 caracteres."
[[ ! -e "$CLIENT_DIR" ]] || die "Ya existe $CLIENT_DIR."
if [[ -f "$REGISTRY" ]] && cut -d, -f1 "$REGISTRY" | tail -n +2 | grep -qix "$NOMBRE"; then
  die "El cliente '$NOMBRE' ya está en $REGISTRY."
fi

# 2. Puerto
[[ "$PUERTO" =~ ^[0-9]+$ ]] && (( PUERTO >= 3001 && PUERTO <= 3999 )) \
  || die "Puerto inválido '$PUERTO': debe estar entre 3001 y 3999."
if [[ -f "$REGISTRY" ]] && cut -d, -f2 "$REGISTRY" | tail -n +2 | grep -qx "$PUERTO"; then
  die "El puerto $PUERTO ya está asignado en $REGISTRY."
fi
if ss -ltnH "( sport = :$PUERTO )" | grep -q .; then
  die "El puerto $PUERTO ya está en uso en el servidor."
fi

# 3. Dominio: formato y DNS apuntando a este servidor
[[ "$DOMINIO" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$ ]] \
  || die "Dominio inválido '$DOMINIO'."
mapfile -t IPS_DOMINIO < <(getent ahosts "$DOMINIO" | awk '{print $1}' | sort -u)
[[ ${#IPS_DOMINIO[@]} -gt 0 ]] || die "El dominio $DOMINIO no resuelve. Crea el registro A/AAAA hacia la IP de este servidor y vuelve a intentar."
mapfile -t IPS_SERVIDOR < <(hostname -I | tr ' ' '\n' | sed '/^$/d')
DNS_OK=0
for ip in "${IPS_DOMINIO[@]}"; do
  for propia in "${IPS_SERVIDOR[@]}"; do
    if [[ "$ip" == "$propia" ]]; then DNS_OK=1; fi
  done
done
[[ $DNS_OK -eq 1 ]] || die "El dominio $DOMINIO resuelve a ${IPS_DOMINIO[*]}, que no es una IP de este servidor (${IPS_SERVIDOR[*]})."

# 4. Plantilla y archivos de la app
[[ -d "$APP_DIR/templates/$PLANTILLA" ]] || die "No existe la plantilla '$PLANTILLA' en $APP_DIR/templates/."
[[ -f "$CADDY_TEMPLATE" ]] || die "Falta la plantilla de Caddy $CADDY_TEMPLATE."
[[ -f "$ECOSYSTEM" ]] || die "Falta $ECOSYSTEM (copiar templates/pm2/ecosystem.config.cjs al preparar el servidor)."
[[ -f "$APP_DIR/backend/dist/server.js" ]] || die "Falta el backend compilado ($APP_DIR/backend/dist/server.js). Corre desplegar.sh primero."

# --- Reversión si algo falla ---------------------------------------------------
UNDO=()
undo_push() { UNDO+=("$1"); }

rollback() {
  local code=$?
  trap - ERR INT TERM
  warn "Falló un paso (código $code). Revirtiendo lo hecho…"
  for (( i=${#UNDO[@]}-1; i>=0; i-- )); do
    bash -c "${UNDO[$i]}" || warn "No se pudo revertir: ${UNDO[$i]}"
  done
  warn "Alta de '$NOMBRE' cancelada."
  exit "$code"
}
trap rollback ERR INT TERM

psql_admin() { sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 "$@"; }
as_service() { sudo -u "$SERVICE_USER" -H "$@"; }

log "Alta de '$NOMBRE' (puerto $PUERTO, dominio $DOMINIO, plantilla $PLANTILLA)."
if [[ $SOLO_INFRA -eq 1 ]]; then
  warn "--solo-infra: se omiten esquema, vistas, seed y administrador (solo staging)."
fi

# --- Paso 1: secretos ----------------------------------------------------------
log "1/13 Generando secretos."
PW_APP="$(openssl rand -hex 32)"
PW_RO="$(openssl rand -hex 32)"
JWT_SECRET="$(openssl rand -base64 64 | tr -d '\n')"

# --- Paso 2: roles y base aislada ----------------------------------------------
log "2/13 Creando roles y base $DB_NAME."
undo_push "sudo -u postgres psql -X -q -c 'DROP DATABASE IF EXISTS \"$DB_NAME\"' -c 'DROP ROLE IF EXISTS \"$ROLE_APP\"' -c 'DROP ROLE IF EXISTS \"$ROLE_RO\"'"
psql_admin -v role_app="$ROLE_APP" -v role_ro="$ROLE_RO" -v pw_app="$PW_APP" -v pw_ro="$PW_RO" <<'SQL'
CREATE ROLE :"role_app" LOGIN PASSWORD :'pw_app';
-- Solo lectura para el chatbot (Docs/10 §3)
CREATE ROLE :"role_ro" LOGIN PASSWORD :'pw_ro' CONNECTION LIMIT 2;
ALTER ROLE :"role_ro" SET default_transaction_read_only = on;
ALTER ROLE :"role_ro" SET statement_timeout = '5s';
SQL
psql_admin -v db="$DB_NAME" -v role_app="$ROLE_APP" -v role_ro="$ROLE_RO" <<'SQL'
CREATE DATABASE :"db" OWNER :"role_app" ENCODING 'UTF8' TEMPLATE template0;
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db" TO :"role_ro";
SQL

# --- Paso 3: directorio y .env -------------------------------------------------
log "3/13 Creando $CLIENT_DIR/.env."
undo_push "rm -rf '$CLIENT_DIR'"
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 750 "$CLIENT_DIR" "$CLIENT_DIR/logs"
DATABASE_URL="postgresql://$ROLE_APP:$PW_APP@localhost:5432/$DB_NAME?connection_limit=5"
DATABASE_URL_RO="postgresql://$ROLE_RO:$PW_RO@localhost:5432/$DB_NAME?connection_limit=2"
(
  umask 077
  cat > "$CLIENT_DIR/.env" <<ENV
# .env de $NOMBRE — generado por nuevo-cliente.sh el $(date -u +%FT%TZ) (Docs/13 §2.1)
CLIENT_NAME=$NOMBRE
PORT=$PUERTO
DATABASE_URL=$DATABASE_URL
DATABASE_URL_RO=$DATABASE_URL_RO
JWT_SECRET=$JWT_SECRET
LOG_LEVEL=warn
PUBLIC_DOMAIN=$DOMINIO
MIN_FRONTEND_VERSION=0.0.0
# Chatbot (opcional, la llave es de RENGO: PA-030, PA-031)
AI_PROVIDER=
AI_MODEL=
AI_API_KEY=
AI_MAX_TOKENS=800
ENV
)
chown "$SERVICE_USER:$SERVICE_USER" "$CLIENT_DIR/.env"
chmod 600 "$CLIENT_DIR/.env"

if [[ $SOLO_INFRA -eq 0 ]]; then
  # --- Paso 4: esquema ---------------------------------------------------------
  log "4/13 Aplicando migraciones (prisma migrate deploy)."
  ( cd "$APP_DIR/backend" && as_service env DATABASE_URL="$DATABASE_URL" pnpm exec prisma migrate deploy )

  # --- Paso 5: capa semántica --------------------------------------------------
  log "5/13 Creando esquema semantic y permisos de solo lectura."
  shopt -s nullglob
  for sql in "$APP_DIR"/backend/sql/semantic/*.sql; do
    PGPASSWORD="$PW_APP" psql -X -q -v ON_ERROR_STOP=1 -h localhost -U "$ROLE_APP" -d "$DB_NAME" -f "$sql"
  done
  shopt -u nullglob
  PGPASSWORD="$PW_APP" psql -X -q -v ON_ERROR_STOP=1 -h localhost -U "$ROLE_APP" -d "$DB_NAME" \
    -v role_ro="$ROLE_RO" <<'SQL'
CREATE SCHEMA IF NOT EXISTS semantic;
GRANT USAGE ON SCHEMA semantic TO :"role_ro";
GRANT SELECT ON ALL TABLES IN SCHEMA semantic TO :"role_ro";
ALTER DEFAULT PRIVILEGES IN SCHEMA semantic GRANT SELECT ON TABLES TO :"role_ro";
SQL

  # --- Pasos 6 y 7: seed y administrador inicial --------------------------------
  # seed-cli hace los dos: carga la plantilla y crea el usuario "admin" con contraseña temporal.
  # Nunca se usan --with-menu ni --dev-user en un cliente real (Docs/19 §6).
  log "6–7/13 Cargando datos iniciales (plantilla $PLANTILLA) y creando el administrador."
  ADMIN_INFO="$(cd "$CLIENT_DIR" && as_service "${SEED_CMD[@]}" \
    --template "$PLANTILLA" --trade-name "$NOMBRE_COMERCIAL" --plan "$PLAN")"

  # --- Paso 7b: código para emparejar el primer dispositivo (SC-14) -------------
  log "7b/13 Generando el código para emparejar el primer dispositivo."
  PAIRING_INFO="$(cd "$CLIENT_DIR" && as_service "${PAIRING_CMD[@]}")"
else
  log "4–7b/13 Omitidos (--solo-infra)."
  ADMIN_INFO="(sin administrador: alta con --solo-infra)"
  PAIRING_INFO="(sin código de emparejamiento: alta con --solo-infra)"
fi

# --- Paso 8: registro (estado ALTA) y proceso pm2 ------------------------------
log "8/13 Registrando y arrancando $PM2_NAME."
if [[ ! -f "$REGISTRY" ]]; then
  install -o "$SERVICE_USER" -g "$SERVICE_USER" -m 640 /dev/null "$REGISTRY"
  echo "$REGISTRY_HEADER" > "$REGISTRY"
fi
undo_push "sed -i '/^$NOMBRE,/d' '$REGISTRY'"
echo "$NOMBRE,$PUERTO,$DOMINIO,$DB_NAME,ALTA,$PLAN,${MODULOS//,/;},$(date +%F)" >> "$REGISTRY"
undo_push "sudo -u $SERVICE_USER -H pm2 delete '$PM2_NAME' >/dev/null 2>&1; sudo -u $SERVICE_USER -H pm2 save >/dev/null 2>&1"
as_service pm2 start "$ECOSYSTEM" --only "$PM2_NAME"
as_service pm2 save >/dev/null

# --- Paso 9: Caddy -------------------------------------------------------------
log "9/13 Configurando Caddy para $DOMINIO."
undo_push "rm -f '$CADDY_FILE'; systemctl reload caddy"
install -d -m 755 "$CADDY_CLIENTS"
sed -e "s|__DOMINIO__|$DOMINIO|g" -e "s|__PUERTO__|$PUERTO|g" -e "s|__NOMBRE__|$NOMBRE_LC|g" \
  "$CADDY_TEMPLATE" > "$CADDY_FILE"
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
systemctl reload caddy

# --- Paso 10: verificación -----------------------------------------------------
log "10/13 Esperando https://$DOMINIO/api/health (hasta 60 s)."
HEALTH_OK=0
for _ in $(seq 1 12); do
  if curl -fsS --max-time 5 "https://$DOMINIO/api/health" | grep -q '"status":"ok"'; then
    HEALTH_OK=1
    break
  fi
  sleep 5
done
[[ $HEALTH_OK -eq 1 ]] || { warn "/api/health no respondió ok en 60 s."; false; }

# --- Paso 11: registro → ACTIVO ------------------------------------------------
log "11/13 Marcando el cliente como ACTIVO en el registro."
sed -i "s|^$NOMBRE,\(.*\),ALTA,|$NOMBRE,\1,ACTIVO,|" "$REGISTRY"

# Desde aquí el cliente ya funciona: un fallo ya no revierte el alta.
trap - ERR INT TERM

# --- Paso 12: primer respaldo --------------------------------------------------
log "12/13 Primer respaldo."
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 750 "$BACKUPS_DIR/$NOMBRE"
DUMP="$BACKUPS_DIR/$NOMBRE/alta_$(date +%Y%m%d_%H%M%S).dump"
if sudo -u postgres pg_dump -Fc "$DB_NAME" > "$DUMP" && pg_restore --list "$DUMP" >/dev/null; then
  chown "$SERVICE_USER:$SERVICE_USER" "$DUMP"
  chmod 640 "$DUMP"
else
  warn "No se pudo hacer el respaldo inicial; hazlo a mano con respaldo-cliente.sh $NOMBRE."
fi

# --- Paso 13: aviso por Telegram -----------------------------------------------
log "13/13 Aviso por Telegram."
if [[ -f "$MONITOR_ENV" ]]; then
  # shellcheck disable=SC1090
  source "$MONITOR_ENV"
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    curl -fsS --max-time 10 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=Cliente $NOMBRE dado de alta ($DOMINIO)" >/dev/null \
      || warn "No se pudo enviar el aviso por Telegram."
  else
    warn "monitor.env no tiene TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID; sin aviso."
  fi
else
  warn "No existe $MONITOR_ENV; sin aviso por Telegram."
fi

log "Listo: https://$DOMINIO"
log "Administrador inicial (se muestra una sola vez):"
printf '%s\n' "$ADMIN_INFO"
log "Primer dispositivo (vence en 10 minutos; si vence, generar otro con pairing-code):"
printf '%s\n' "$PAIRING_INFO"
