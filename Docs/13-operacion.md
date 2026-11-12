# 13 — Operación de la plataforma

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio**. Registra cada cambio en el [Control de cambios](README.md#control-de-cambios).

> Los scripts se **describen** aquí (pasos, entradas, salidas y validaciones). Se implementarán en `app/scripts/` cuando se apruebe la documentación.

## 1. Preparación del servidor (una vez)

| Paso | Detalle |
|---|---|
| VPS | Hetzner Cloud, Ubuntu LTS. Ubicación: **EE. UU.** (PA-022, resuelta) por latencia a Guatemala; se recomienda Ashburn (costa este, más cerca de Guatemala que Hillsboro). Tamaño inicial: lo **define RENGO** (S-16); referencia 4 vCPU / 8 GB RAM / 160 GB disco |
| Usuarios | `mise` (servicio, sin login por contraseña) y usuarios de operadores con llave SSH; `PasswordAuthentication no`, `PermitRootLogin no` |
| Firewall | `ufw`: permitir 22, 80, 443; denegar el resto. `fail2ban` para SSH |
| Paquetes | Node.js LTS (vía repositorio oficial), pm2 (global), pnpm (con Corepack, versión fijada en `packageManager`; doc 19 §7), PostgreSQL 18 (repositorio oficial PGDG), Caddy (repositorio oficial), `cron`, `jq`, `curl` |
| Actualizaciones | `unattended-upgrades` solo de seguridad |
| PostgreSQL | `listen_addresses = 'localhost'`; `max_connections` según §6.2; `shared_buffers` ≈ 25 % de RAM; autenticación `scram-sha-256` |
| pm2 | `pm2 startup systemd -u mise`; `pm2-logrotate` (10 MB, 14 archivos, comprimidos) |
| Caddy | `/etc/caddy/Caddyfile` con `import /etc/caddy/clients/*.caddy` |
| Directorios | `/opt/mise/{app,clients,backups}` propiedad de `mise`; `monitor.env` con permisos 600 |
| Respaldo externo | Hetzner Storage Box (o almacenamiento S3) montado/configurado para copiar `backups/` |

## 2. Alta de un cliente nuevo — `nuevo-cliente.sh <Nombre> <puerto> <dominio>`

Ejemplo: `nuevo-cliente.sh LaFonda 3005 pos.lafonda.com`

**Validaciones previas:**
1. `<Nombre>`: solo letras y números (`^[A-Za-z][A-Za-z0-9]{1,30}$`); no existe `clients/<Nombre>/`.
2. `<puerto>`: rango 3001–3999, libre (no está en `registry.csv` ni escuchando).
3. `<dominio>`: resuelve por DNS a la IP del servidor (si no, aborta con instrucciones para crear el registro A/AAAA). Puede ser un **subdominio de RENGO** o un **dominio propio del cliente**, según lo que quiera el cliente (PA-023); el script funciona igual con los dos. Con dominio propio, el cliente (o RENGO por él) crea el registro DNS antes del alta.
4. Plantilla de configuración: `--plantilla <restaurante-basico|cafeteria|...>` (default `restaurante-basico`).

**Pasos:**
| # | Acción | Resultado |
|---|---|---|
| 1 | Generar contraseñas aleatorias para `mise_<nombre>_app` y `mise_<nombre>_ro`, y `JWT_SECRET` (64 bytes aleatorios) | Secretos en memoria |
| 2 | Crear roles y base `mise_<nombre>` (dueño `_app`); `REVOKE ALL ON DATABASE ... FROM PUBLIC` | Base vacía aislada |
| 3 | Crear `clients/<Nombre>/.env` (ver §2.1) con permisos 600 | Configuración del cliente |
| 4 | Aplicar el esquema: `prisma migrate deploy` con el `DATABASE_URL` del cliente | Tablas |
| 5 | Crear esquema `semantic` y vistas; `GRANT` de solo lectura a `_ro` | Capa semántica |
| 6 | Seed: catálogo de unidades, tipos de orden, permisos, plantilla elegida (roles por defecto, métodos de pago, motivos, plantillas de ticket, sucursal inicial, estación por defecto, menú de ejemplo opcional), `client_settings` con el nombre, `license` con plan y módulos | Datos iniciales |
| 7 | Crear usuario administrador inicial con contraseña temporal (se imprime una sola vez; obligatorio cambiarla al primer ingreso) | Acceso inicial |
| 7b | Generar el código del primer dispositivo: `pnpm --filter @mise/backend pairing-code` desde la carpeta del cliente (10 min, un solo uso, SC-14). Los demás dispositivos se emparejan desde Administración › Dispositivos | Primer dispositivo |
| 8 | Agregar la app al `ecosystem.config.cjs` y `pm2 start` del cliente; `pm2 save` | Proceso `mise-<nombre>` |
| 9 | Crear `/etc/caddy/clients/<nombre>.caddy` (ver §2.2); `caddy validate` y `systemctl reload caddy` | HTTPS y ruteo |
| 10 | Esperar y verificar `https://<dominio>/api/health` → `status: ok` (reintentos hasta 60 s) | Verificación |
| 11 | Agregar fila a `clients/registry.csv`: `nombre,puerto,dominio,base,estado=ACTIVO,plan,modulos,fecha_alta` | Registro |
| 12 | Primer respaldo `pg_dump` | Respaldo inicial |
| 13 | Notificar por Telegram "Cliente LaFonda dado de alta" | Aviso |

Si un paso falla, el script revierte los pasos anteriores (borra proceso pm2, bloque Caddy, base y directorio) y termina con error.

### 2.1 `.env` del cliente (claves)
| Clave | Ejemplo / descripción |
|---|---|
| `CLIENT_NAME` | `LaFonda` (solo para logs; el nombre comercial vive en la base) |
| `PORT` | `3005` |
| `DATABASE_URL` | `postgresql://mise_lafonda_app:***@localhost:5432/mise_lafonda?connection_limit=5` |
| `DATABASE_URL_RO` | Rol de solo lectura (chatbot) `?connection_limit=2` |
| `JWT_SECRET` | 64 bytes aleatorios, distinto por cliente |
| `LOG_LEVEL` | `warn` |
| `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `AI_MAX_TOKENS` | Chatbot (opcional). La llave es **de RENGO** (PA-030), la misma o una por cliente según decida RENGO; `AI_MODEL` lo define RENGO (PA-031) |
| `PUBLIC_DOMAIN` | `pos.lafonda.com` (CORS/orígenes permitidos de Socket.IO) |
| `MIN_FRONTEND_VERSION` | Versión mínima aceptada |

El backend valida el `.env` con Zod al arrancar y **no inicia** si falta una clave obligatoria.

### 2.2 Bloque de Caddy por cliente (especificación)
- Sitio: `<dominio>`.
- `encode zstd gzip`.
- `handle /api/*` y `handle /socket.io/*` → `reverse_proxy 127.0.0.1:<puerto>` (con `flush_interval -1` para WebSocket/streaming).
- `handle` resto → `root /opt/mise/app/frontend/dist`, `try_files {path} /index.html`, `file_server`.
- Cabeceras: `Cache-Control` según §3.1 de [06](06-arquitectura-adr.md#31-caddy); `Strict-Transport-Security`, `X-Content-Type-Options nosniff`, `Referrer-Policy strict-origin-when-cross-origin`, CSP.
- `request_body max_size 10MB`.
- Logs de acceso en `/var/log/caddy/<nombre>.log` (rotados).

### 2.3 pm2 (especificación de cada app)
| Opción | Valor |
|---|---|
| `name` | `mise-<nombre>` |
| `script` | `/opt/mise/app/backend/dist/server.js` (el mismo para todos) |
| `cwd` | `/opt/mise/clients/<Nombre>` (el backend lee `.env` de aquí) |
| `instances` | 1 (fork) |
| `max_memory_restart` | `400M` |
| `node_args` | `--max-old-space-size=256` |
| `kill_timeout` | 10000 (cierre ordenado: deja de aceptar, termina peticiones, cierra sockets y Prisma) |
| `exp_backoff_restart_delay` | 200 |
| `out_file` / `error_file` | `/opt/mise/clients/<Nombre>/logs/` |

## 3. Otros scripts de plataforma

| Script | Función |
|---|---|
| `suspender-cliente.sh <Nombre>` | Pone `license.status = SUSPENDIDA` en la base; la API responde `402` salvo `/api/health` y exportación. Actualiza `registry.csv` |
| `reactivar-cliente.sh <Nombre>` | Revierte la suspensión |
| `respaldo-cliente.sh <Nombre>` | `pg_dump -Fc` a `backups/<Nombre>/<fecha>.dump` + verificación `pg_restore --list` |
| `restaurar-cliente.sh <Nombre> <archivo> [--a-base-temporal]` | Ver §5 |
| `baja-cliente.sh <Nombre>` | Respaldo final, exportación, detiene pm2, quita Caddy; **no** borra la base hasta 90 días después (`--purgar` explícito) |
| `licencia.sh <Nombre> --plan X --modulos ai,recipes --hasta 2027-12-31` | Actualiza la tabla `license` |
| `listar-clientes.sh` | Muestra `registry.csv` + estado pm2 + health de cada uno |
| `verificar-migracion.sh` | Revisa que las migraciones nuevas solo agreguen (rechaza `DROP`, `RENAME`, `ALTER COLUMN ... TYPE`, `SET NOT NULL` sin `DEFAULT`) |

## 4. Despliegue de una versión nueva — `desplegar.sh`

Orden **obligatorio**:

```mermaid
flowchart TD
    A[git pull en app/] --> B[verificar-migracion.sh]
    B --> C[pg_dump de CADA base]
    C --> D[prisma migrate deploy en CADA base]
    D --> E[prisma generate]
    E --> F[Compilar UNA vez<br/>backend y frontend]
    F --> G[pm2 restart all]
    G --> H[Verificar /api/health de cada cliente]
    H --> I[Aviso Telegram: versión X desplegada]
```

| # | Paso | Si falla |
|---|---|---|
| 1 | `git pull` (rama/etiqueta de la versión) | Abortar |
| 2 | `verificar-migracion.sh` | Abortar (migración no aditiva) |
| 3 | `pg_dump -Fc` de cada base en `backups/<Cliente>/predeploy_<version>_<fecha>.dump` | Abortar |
| 4 | `prisma migrate deploy` en cada base (recorriendo `registry.csv`, cargando el `DATABASE_URL` de cada `.env`) | Detener el despliegue; las bases ya migradas quedan con columnas nuevas que el código viejo ignora (por eso las migraciones solo agregan). Corregir y reintentar |
| 5 | Recrear vistas `semantic` (`CREATE OR REPLACE VIEW`, solo agregando columnas) | Igual |
| 6 | `prisma generate` | Abortar (nada reiniciado aún) |
| 7 | `pnpm install --frozen-lockfile` + `pnpm build` (compila `shared`, genera Prisma, compila el backend y el frontend con `vite build`) **una vez**, en un directorio temporal; luego cambio atómico de `dist` (renombrar) | Abortar; se mantiene el `dist` anterior |
| 8 | `pm2 restart all` (o `pm2 reload` escalonado por cliente) | Revisar logs; `rollback` = volver al `dist` anterior y `pm2 restart all` (el esquema nuevo es compatible) |
| 9 | Verificar `GET /api/health` de cada dominio | Alerta Telegram |
| 10 | Registrar versión, fecha y operador en `/opt/mise/deploys.log` | — |

**Ventana recomendada:** fuera del horario de servicio (ej. 04:00–10:00 hora de Guatemala). El frontend muestra "Nueva versión disponible" y se actualiza cuando no hay operaciones pendientes.

## 5. Respaldos y restauración

| Tipo | Cuándo | Dónde | Retención |
|---|---|---|---|
| Diario | cron 03:00 (hora del servidor) — `respaldo.sh` recorre todas las bases | `backups/<Cliente>/daily/` | 14 días |
| Semanal | Domingo (copia del diario) | `backups/<Cliente>/weekly/` | 8 semanas |
| Mensual | Día 1 | `backups/<Cliente>/monthly/` | 12 meses |
| Pre-despliegue | Cada despliegue | `backups/<Cliente>/predeploy/` | Últimos 5 |
| Copia externa | Después de cada diario (`rsync` a Storage Box) | Fuera del servidor | Igual que local |

- Formato: `pg_dump -Fc` (comprimido). Cada respaldo se verifica con `pg_restore --list` y se registra tamaño y duración. Si falla → alerta Telegram.
- **Prueba de restauración mensual** (cron, día 15): restaurar el último diario de un cliente (rotando) en una base temporal `mise_restore_test`, contar filas de tablas clave, comparar contra producción, borrar la base temporal y reportar por Telegram.

**Restauración (`restaurar-cliente.sh`):**
1. Por defecto restaura en una base **temporal** para revisar.
2. Restauración real: `pm2 stop mise-<nombre>` → respaldo de seguridad del estado actual → `DROP`/`CREATE` de la base → `pg_restore` → `prisma migrate deploy` (por si el respaldo es de una versión anterior) → `pm2 start` → verificar health.
3. Avisar al cliente: los dispositivos con operaciones en outbox posteriores al respaldo las reenviarán; se revisan conflictos.

## 6. Monitoreo — `monitor.sh` (cron cada minuto)

Lee `monitor.env` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, umbrales, `REPEAT_MINUTES`).

| Verificación | Cómo | Umbral por defecto |
|---|---|---|
| Proceso caído | `pm2 jlist` → estado ≠ `online` | Inmediato |
| Proceso reiniciado | `restart_time` aumentó desde la última ejecución | Cualquier reinicio |
| Memoria alta por proceso | `monit.memory` de pm2 | > 300 MB |
| `/api/health` sin respuesta | `curl -m 5 https://<dominio>/api/health` (a través de Caddy) | 2 fallos seguidos |
| Health `degraded` | Base no responde | 2 seguidos |
| RAM libre del servidor | `/proc/meminfo` `MemAvailable` | < 15 % |
| Disco | `df` en `/` y en el directorio de PostgreSQL | > 80 % usado |
| Carga | `/proc/loadavg` (1 min) / nº CPU | > 1.5 durante 5 min |
| Conexiones PostgreSQL | `SELECT count(*) FROM pg_stat_activity` | > 80 % de `max_connections` |
| Certificados | Días para vencer (Caddy renueva solo) | < 14 días |
| Respaldo diario | Existe el archivo del día | 06:00 sin archivo |

**Política de avisos (sin spam):**
1. Cada alerta tiene una clave (`<verificación>:<cliente>`); su estado se guarda en `/opt/mise/monitor-state/`.
2. Primera detección → mensaje "🔴 [ALERTA] mise-lafonda: /api/health sin respuesta (2 intentos)".
3. Mientras siga, repite cada `REPEAT_MINUTES` (default 15) "🔴 [SIGUE] ... desde hace 30 min".
4. Al normalizarse → "✅ [RESUELTO] ... duración 34 min".

**Logs del backend:** pino en JSON, nivel `warn` en producción (configurable por `.env`). Etiquetas fáciles de buscar al inicio del mensaje: `[AUTH]`, `[SYNC]`, `[PRINT]`, `[KDS]`, `[PAY]`, `[CASH]`, `[DB]`, `[AI]`, `[RT]` (tiempo real), `[BOOT]`. Cada log incluye `client`, `branchId`, `deviceId`, `userId`, `reqId` cuando aplique; **nunca** contraseñas, PIN, tokens ni datos de tarjeta. Ejemplo de búsqueda: `grep '\[SYNC\]' clients/LaFonda/logs/*.log`.

## 7. Límites y crecimiento

### 7.1 RAM
| Componente | Consumo estimado (medir en F1) |
|---|---|
| Sistema + Caddy + pm2 | ~400 MB |
| PostgreSQL | `shared_buffers` 25 % de RAM + ~5–10 MB por conexión activa |
| Backend por cliente | **150 MB en reposo, 300 MB en pico** (reinicio a 400 MB) |

**Capacidad aproximada** (servidor de 8 GB): 8 GB − 0.4 (sistema) − 2 (shared_buffers) − 0.8 (conexiones) − 0.8 (margen y caché del SO) ≈ 4 GB → **~15 clientes** a 250 MB promedio. Con 16 GB ≈ 35 clientes.

### 7.2 Conexiones a PostgreSQL
| Por cliente | Conexiones |
|---|---|
| Prisma (`connection_limit`) | 5 |
| Chatbot solo lectura | 2 |
| Scripts (respaldo/migración, puntuales) | 1 |
| **Total por cliente** | **8** |

`max_connections = (clientes × 8) + 20 reservadas`. Ej.: 20 clientes → 180 → configurar 200. Si se supera ~300, usar **PgBouncer** en modo *transaction* (compatible con Prisma configurando `pgbouncer=true`).

### 7.3 Disco
| Elemento | Estimación por cliente |
|---|---|
| Base de datos (1 sucursal, ~150 cuentas/día) | ~0.5–1 GB/año (incluye imágenes y bitácora) |
| Respaldos (14 + 8 + 12 + 5 copias comprimidas) | ~10× el tamaño comprimido de la base |
| Logs | < 200 MB (rotados) |

Alerta al 80 %. Purga programada de `realtime_events` (> 24 h) y de `sync_operations` (> 90 días).

### 7.4 Plan de crecimiento
```mermaid
flowchart LR
    A[Etapa 1<br/>1 VPS: Caddy + pm2 + PostgreSQL<br/>hasta ~15 clientes] --> B[Etapa 2<br/>Más RAM y CPU<br/>mismo VPS, hasta ~35]
    B --> C[Etapa 3<br/>PostgreSQL en su propia máquina<br/>red privada Hetzner]
    C --> D[Etapa 4<br/>Repartir clientes entre varios<br/>servidores de aplicación]
```
| Etapa | Disparador | Acción |
|---|---|---|
| 2 | RAM disponible < 25 % sostenida o carga > 1 por CPU en horas pico | Escalar el VPS (Hetzner permite cambiar de tipo con reinicio) |
| 3 | PostgreSQL usa > 40 % de RAM/CPU o IO alto | Mover PostgreSQL a un servidor dedicado en red privada; cambiar `DATABASE_URL` en cada `.env`; `pg_hba` solo red privada |
| 4 | > 35–40 clientes o riesgo de concentración | Segundo servidor de aplicación con su propio Caddy y pm2; el DNS de cada cliente apunta a su servidor; `registry.csv` agrega columna `servidor`. Mover un cliente = respaldo + restauración + cambio de DNS |

## 8. Procedimientos de soporte
| Situación | Procedimiento |
|---|---|
| Cliente reporta "no carga" | `listar-clientes.sh`; revisar health, pm2 y logs `[BOOT]`/`[DB]` |
| Proceso reinicia por memoria | Revisar logs, `pm2 monit`; abrir incidencia; temporalmente subir `max_memory_restart` |
| Dispositivo perdido o robado | Admin del cliente revoca el dispositivo (o RENGO por script) |
| Cambio de dominio de un cliente | Nuevo bloque Caddy, actualizar `PUBLIC_DOMAIN` y `registry.csv`; los dispositivos deben reinstalar la PWA en el dominio nuevo |
