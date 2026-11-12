# 17 — Plan de trabajo para 2 personas

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio**. Registra cada cambio en el [Control de cambios](README.md#control-de-cambios).

> Estado: **Propuesta** — pendiente de aprobación por RENGO. Las semanas siguen el Gantt de [15-roadmap.md](15-roadmap.md) (duraciones `[SUPUESTO]`, S-22). Las carpetas están en [19-estructura-del-proyecto.md](19-estructura-del-proyecto.md).

## 1. Cómo se reparte: por módulos

Cada persona es dueña de **módulos completos**: su pantalla, su API, sus tablas y sus contratos. Así cada una puede probar su módulo de punta a punta sin esperar a la otra.

| | **Persona 1 (Pablito) — Sala y caja** | **Persona 2 (Deniscito) — Cocina y gestión** |
|---|---|---|
| Frontend `frontend/src/modules/` | `mesero/`, `caja/` | `cocina/`, `auth/`, `admin/`, `reportes/` |
| Frontend `frontend/src/core/` | `offline/` | `realtime/`, `print/` (transportes y comanda), `session/`, `config/` |
| Backend `backend/src/modules/` | `floor/`, `orders/`, `billing/`, `cash/`, `sync/` | `kitchen/`, `auth/`, `config/`, `catalog/`, `realtime/`, `recipes/`, `reports/`, `ai/`, `audit/`, `system/` |
| `shared/` | `contracts/` de sus módulos, `domain/billing`, `domain/folios` | `contracts/` de sus módulos, `contracts/errors` |
| Otros | `scripts/`, `templates/caddy`, `templates/pm2` | `templates/seed`, `templates/restaurante-basico`, `backend/sql/semantic` |
| Documentos que mantiene | 05 (pasos 1–4 y 9–14), 09, RPT de caja en 12, 13 | 05 (pasos 5–8), 10, 11, 12, 18 |
| Pruebas | PR-001, PR-008 a PR-017, PR-100–102, PR-104–107, PR-200–220, PR-500–506 | PR-002 a PR-007, PR-018 a PR-026, PR-103, PR-108, PR-300–304, PR-400–408 |

**De los dos (se hacen juntos en la Semana 0 y después se cambian solo avisando):** `frontend/src/app/`, `frontend/src/styles/`, `frontend/src/core/api/`, `core/ui/`, `core/format/`, `shared/domain/orders`, `shared/domain/ids`, `backend/src/core/`. En `core/print/documents/` cada uno hace los impresos de su módulo: comanda (Persona 2); pre-cuenta, recibo, corte y movimientos (Persona 1).

**Asignación (PA-047, resuelta 2026-11-12):** Persona 1 (P1, Sala y caja) = **Pablito** · Persona 2 (P2, Cocina y gestión) = **Deniscito**.

### 1.1 Dónde se tocan los dos módulos

| Punto de contacto | Quién lo hace | Cómo no se estorban |
|---|---|---|
| El mesero **envía** un pedido; cocina lo **acepta** y lo marca **listo** | `orders` (P1) crea pedidos e ítems; `kitchen` (P2) cambia `accepted_at`, `ready_at` y el estado | Las transiciones de estado se definen una vez en `shared/domain/orders`; la tabla `orders` está en `orders.prisma` (P1) y P2 pide los cambios |
| La cocina avisa "listo" al mesero | P2 emite `order.ready` en `realtime`; P1 lo muestra en `mesero` | El evento está definido en `shared/contracts/realtime` |
| El mesero necesita el menú y el login | P2 (`catalog`, `auth`) | P2 los entrega primero (H1, semanas 1–2). Mientras, P1 usa el menú de `templates/restaurante-basico` y un usuario de desarrollo |
| La comanda se imprime desde el celular del mesero (también sin internet) | P2 hace `core/print` y el documento comanda; P1 lo llama al enviar | P1 usa la función de impresión que expone `core/print`, sin cambiarla |
| Sin internet, el KDS no recibe pedidos | P1 (`sync`, `core/offline`) | P2 solo muestra el banner y la etiqueta "LLEGÓ TARDE" en el KDS |

## 2. Semana 0 (juntos)

3–5 días, al aprobar la documentación. Es lo único que bloquea a ambos.

| # | Entregable | Quién |
|---|---|---|
| 1 | Archivos de configuración de la raíz: `package.json` con workspaces, `tsconfig`, lint, formato, Vitest, `.gitignore`, `.env.example` | P1 |
| 2 | CI: typecheck, lint y pruebas | P1 |
| 3 | `backend/src/core`: `.env` con Zod, Prisma, Fastify en `127.0.0.1`, `GET /api/health`, errores, logger, verificación de JWT y permisos | P2 |
| 4 | `frontend/src/app`, `styles` (tokens de doc 18), `core/api`, `core/ui` con los componentes base | Juntos |
| 5 | `shared/contracts/errors`, `shared/domain/orders` (estados) y `shared/domain/ids` | Juntos |
| 6 | Contratos v1 de `auth`, `catalog` y `orders`, que son los que conectan los dos módulos | Cada uno los suyos; el otro los revisa |
| 7 | `templates/seed` y `templates/restaurante-basico` con un menú de prueba | P2 |

## 3. Reglas para trabajar por separado e integrar después

1. **Cada uno edita solo sus carpetas** (§1). Para tocar algo del otro, se le pide o se le avisa antes.
2. **El contrato va primero.** Un endpoint, campo o evento nuevo se agrega primero a [08](08-api.md) o [07](07-modelo-de-datos.md), después a `shared/contracts/<modulo>`, y el dueño del otro lado lo revisa.
3. **Esquema Prisma por módulo** (`backend/prisma/schema/<modulo>.prisma`): cada uno edita solo los archivos de sus módulos.
4. **Migraciones:** cada uno genera las suyas, solo aditivas. Al integrar, quien integra en segundo lugar vuelve a generar su migración encima de la del otro.
5. **No se crean carpetas fuera de [19](19-estructura-del-proyecto.md)** sin agregarlas primero al documento.
6. **Control de cambios del README:** cada quien agrega sus filas al final; si hay conflicto al integrar, se conservan las dos.
7. **Ramas** (los commits los hace cada persona): una por persona y por hito, ej. `p1/h2-servicio`, `p2/h2-servicio`.
8. **Cada hito termina con una integración y una demo conjunta** con las pruebas indicadas de [14](14-plan-de-pruebas.md). No se empieza el siguiente hito hasta que la demo pase.

## 4. Orden en que se construyen los módulos

### 4.1 Criterios
1. **No negociables primero.** Son de tres tipos:
   - 🔒 **Seguridad y acceso**: sin esto nada se puede probar con usuarios reales.
   - 🧱 **Cimientos caros de agregar después**: si un módulo se construye sin ellos, hay que rehacerlo.
   - 🚀 **Requisitos para salir a producción**: no se instala en el restaurante sin ellos.
2. **Después, el orden del flujo operativo** ([05 §2](05-flujos-y-estados.md#2-pasos-del-flujo-operativo)): menú → mesa → pedido → cocina → entrega → cuenta → cobro → corte.
3. **Al final, lo que no detiene el servicio**: recetas, reportes, chatbot.

### 4.2 Orden

| # | Módulo | Qué incluye | Tipo | Depende de | Persona | Hito |
|:-:|---|---|:-:|---|:-:|:-:|
| 1 | Cimientos del backend (`backend/src/core`, `system`) | `.env` validado, escucha en `127.0.0.1`, `GET /api/health`, errores, logs con etiquetas, montos en `numeric` | 🧱 | — | P2 | S0 |
| 2 | Cimientos compartidos (`shared/domain/ids`, `contracts/errors`) | ULID, formato de errores | 🧱 | — | Juntos | S0 |
| 3 | Cimientos del frontend (`app`, `styles`, `core/api`, `core/ui`) | Rutas, sistema de temas con Botanical Graphite como único tema y validador de contraste (doc 18 §8, +2–3 días `[SUPUESTO]`), componentes base, cliente `/api` relativo, PWA instalable | 🧱 | 1 | Juntos | S0 |
| 4 | **Login y permisos** (`auth`) | Emparejar dispositivo, login, PIN, JWT por cliente (15 min, se refresca; vence a las 12 h sin actividad), permisos en el backend, 🔑, bloqueo por intentos | 🔒 | 1, 2 | P2 | H1 (sem. 1–2) |
| 5 | **Bitácora** (`audit`) | Registro de solo `INSERT`; cada módulo la usa desde su primera acción sensible | 🧱 | 4 | P2 | H1 |
| 6 | **Configuración y licencia** (`config`, `core/config`) | Datos del restaurante, sucursal, regionales, módulos activos (`403 MODULE_DISABLED`), `config/public` | 🔒🧱 | 4 | P2 | H1 |
| 7 | **Outbox e idempotencia** (`core/offline` base + `Idempotency-Key` en el backend) | Toda acción operativa pasa por la outbox desde el día 1, aunque todavía no haya modo sin internet (doc 09 §4.2) | 🧱 | 3 | P1 | H1 |
| 8 | Menú (`catalog`) | Categorías, productos, modificadores, combos, agotados, imágenes cacheables | Flujo | 4, 6 | P2 | H1 |
| 9 | Mesas y ocupaciones (`floor` + `mesero`) | Zonas, mesas, abrir mesa, para llevar, unir, trasladar, transferir | Flujo (paso 2) | 4, 7 | P1 | H1 |
| 10 | Alta de cliente y staging (`scripts/nuevo-cliente.sh`) | Para integrar en un servidor igual a producción desde el primer hito | 🚀 | 1 | P1 | H1 |
| 11 | Impresión base (`core/print`) | Transportes `epos-lan` y `webusb`, página de prueba | 🧱 | 3 | P2 | H1 |
| 12 | Toma y envío de pedidos (`orders` + `mesero`) | Carrito, modificadores, borrador persistente, rondas, folio, cancelar ítem | Flujo (pasos 3–4) | 8, 9 | P1 | H2 |
| 13 | Tiempo real (`realtime`) | Socket.IO, salas, `seq`, reconexión | 🧱 | 4 | P2 | H2 |
| 14 | Comanda impresa (`print/documents`) | Normal, ADICIONAL, cancelación | Flujo (paso 4) | 11, 12 | P2 | H2 |
| 15 | Cocina (`kitchen` + `cocina`) | Cola FIFO, aceptar, listo, recall, sonido, colores | Flujo (pasos 5–8) | 12, 13 | P2 | H2 |
| 16 | Entrega y aviso al mesero (`orders` + `mesero`) | Aviso "listo" con vibración, marcar entregado, tres tiempos | Flujo (paso 9) | 15 | P1 | H2 |
| 17 | Cuentas (`billing`, parte de sala) | Crear cuentas, mover ítems, separar unidades de una línea, pre-cuenta | Flujo (paso 10) | 12 | P1 | H2 |
| 18 | Turno de caja (`cash`) | Abrir turno con fondo fijo o variable, retiros, depósitos | Flujo (paso 1)¹ | 4 | P1 | H3 |
| 19 | Cobro (`billing` + `caja`) | Descuentos (el gerente los activa y fija los límites) con 🔑, propina sugerida y su reparto configurable, pagos mixtos, cambio, recibo, liberar mesa, NIT/CF; cobro también desde el celular del mesero | Flujo (pasos 11–12) | 17, 18 | P1 | H3 |
| 20 | Corte y reapertura (`cash`, `billing`) | Corte a ciegas, conteo por denominación configurable, diferencia, reporte impreso, corte provisional sin conexión; reabrir cuenta pagada en efectivo desde cualquier turno del día con `REVERSO_REAPERTURA` (no hay anulaciones) | Flujo (pasos 13–14) | 19 | P1 | H3 |
| 21 | Administración completa (`admin`) | Usuarios, roles, dispositivos, impresoras y rutas, métodos de pago, motivos, tickets | Configuración | 4, 6, 11 | P2 | H3 |
| 22 | Recetas y costeo (`recipes`) | Insumos, recetas, costo teórico, precio sugerido, margen | Gestión | 8 | P2 | H3 |
| 23 | **Sin internet completo** (`sync` + `core/offline`) | Folios temporales, regla "a cargo", `sync/push`/`pull`, conflictos, impresión local, QR de pre-cuenta | 🚀 | 7, 12–20 | P1 | H4 |
| 24 | Dashboard y reportes (`reports` + `reportes`) | Vistas `semantic`, métricas, dashboard del día, reportes del MVP, CSV/XLSX | Gestión | 19, 22 | P2 | H4 |
| 25 | **Operación** (`scripts/`) | `desplegar.sh`, respaldos diarios + copia externa, restauración probada, `monitor.sh` + Telegram | 🚀 | 10 | P1 | H4 |
| 26 | Chatbot (`ai`) | Fase 2 | F2 | 24 | P2 | F2 |

¹ El turno es el paso 1 del flujo, pero se construye aquí: se pueden abrir mesas y mandar pedidos sin turno, y solo hace falta para cobrar en efectivo (doc 05 paso 1).

### 4.3 Lista corta de no negociables
**Antes de cualquier pantalla de negocio:** 1 Cimientos del backend · 2 Cimientos compartidos · 3 Cimientos del frontend · 4 Login y permisos · 5 Bitácora · 6 Configuración y licencia · 7 Outbox e idempotencia.
**Antes de instalar en el restaurante:** 10 Staging · 23 Sin internet · 25 Respaldos y monitoreo, además de HTTPS, firewall y un secreto JWT por cliente (RNF-003 a RNF-007).

## 5. Trabajo por hito

### Ahora — Fase 0 (sin código de producto)

| Persona 1 (Pablito) | Persona 2 (Deniscito) |
|---|---|
| Revisar con RENGO el kit de hardware (PA-021, doc 06 §7) | Comprar o conseguir prestada una impresora Epson con ePOS LAN y hacer la **prueba de impresión** desde Android e iPhone |
| Crear el VPS en EE. UU. (PA-022 resuelta) | Confirmar en la Semana 0 el esquema Prisma en varios archivos (ADR-012 aprobado) |
| Bocetos de mesero y caja | Bocetos de KDS y admin (PA-048 a PA-050 resueltas: solo cambia `primary`, sin modo oscuro); 5 temas aprobados (doc 18 §8.4) |

### H1 — Base (4 semanas)

| Persona 1 (Pablito) | Persona 2 (Deniscito) |
|---|---|
| `floor`: zonas, mesas, ocupaciones (índice único), unir, trasladar, transferir | `auth`: emparejamiento, login, PIN, JWT, permisos, 🔑 (**semanas 1–2, lo necesita P1**) |
| `mesero`: mapa/lista de mesas, abrir mesa, para llevar | `catalog` + `admin`: menú, modificadores, combos, imágenes |
| `core/offline`: Dexie, outbox (toda acción pasa por ella desde el primer día) | `config` + `admin`: restaurante, sucursal, licencia y módulos, mesas y zonas (pantalla de configuración) |
| `scripts/nuevo-cliente.sh`, plantillas de Caddy y pm2, servidor de staging | `core/print`: transportes `epos-lan` y `webusb`, página de prueba; `audit` |

**Integración H1:** en staging, emparejar el celular, iniciar sesión, configurar el menú real y abrir mesas. PR-023, PR-024, PR-100, PR-303, PR-400, PR-402, PR-403, PR-500.

### H2 — Servicio (4 semanas)

| Persona 1 (Pablito) | Persona 2 (Deniscito) |
|---|---|
| `orders`: toma de pedido (modificadores, combos, notas, borrador), envío con folio e idempotencia, cancelar ítem, entregar | `kitchen` + `cocina`: cola FIFO, aceptar, listo (pedido e ítem), recall, sonido, colores por tiempo |
| `billing` (parte de sala): crear cuentas y mover ítems | `realtime`: Socket.IO, salas, `seq`, reconexión con `lastSeq` |
| `mesero`: aviso "listo" con vibración, marcar entregado | `print/documents`: comanda normal, ADICIONAL y de cancelación |

**Integración H2:** servicio completo con conexión, de abrir la mesa a entregar. PR-002 a PR-009, PR-013, PR-015, PR-101, PR-103, PR-104, PR-108.

### H3 — Cobro y caja (3 semanas)

| Persona 1 (Pablito) | Persona 2 (Deniscito) |
|---|---|
| `billing` + `caja`: descuentos configurables y 🔑, propina sugerida con reparto, pagos mixtos, cambio, cobro del mesero, reapertura de cuentas en efectivo | `admin`: usuarios, roles, dispositivos, impresoras y rutas de impresión, métodos de pago, motivos, tickets |
| `cash` + `caja`: turnos (abrir solo en línea), retiros/depósitos, corte (a ciegas; provisional sin conexión) | `recipes` + `admin`: insumos, unidades, recetas, costeo, productos afectados |
| Impresos: pre-cuenta, recibo, corte, movimientos; cajón | `print`: transporte `qz` si la caja es Windows |
| NIT/CF en la cuenta y el recibo (sin FEL, PA-002) | |

**Integración H3:** PR-001 completo, PR-010 a PR-012, PR-014, PR-016 a PR-019, PR-102, PR-107.

### H4 — Sin internet y reportes (4 semanas)

| Persona 1 (Pablito) | Persona 2 (Deniscito) |
|---|---|
| `sync` + `core/offline`: `sync/push` y `sync/pull`, folios temporales, regla "a cargo", conflictos y su pantalla en `admin` (P2 da el lugar en el menú), QR de pre-cuenta, registro de cortes | `reports` + `reportes`: vistas `semantic`, métricas, dashboard, reportes del MVP, CSV/XLSX |
| `scripts/`: `desplegar.sh`, `respaldo.sh`, `restaurar-cliente.sh`, `monitor.sh` | KDS sin conexión: banner, "LLEGÓ TARDE", impresión local de la comanda desde el celular |

**Integración H4:** PR-200 a PR-220 con 2–3 dispositivos reales, PR-020 a PR-022, PR-026, PR-302, PR-502 a PR-506.

### H5 — Staging, pruebas y UAT (3 semanas, juntos)
P1: E2E de sala y caja, pruebas sin internet. P2: E2E de cocina y admin, carga (k6), seguridad, impresión en 58 y 80 mm. Juntos: instalación en el restaurante, capacitación y operación en paralelo con papel (doc 14 §9).

## 6. Riesgos del reparto

| Riesgo | Mitigación |
|---|---|
| P1 depende del login y el menú de P2 al inicio | P2 los hace primero; P1 empieza con el menú de `templates/restaurante-basico` y un usuario de desarrollo |
| P1 tiene la parte más difícil (sin internet) | Diseño conjunto de 1 día al iniciar H4; si P1 se atrasa, P2 toma `scripts/` |
| Las dos personas editan la tabla `orders` | Dueño único (P1); P2 pide los campos de cocina por contrato (§3 regla 2) |
| Conflictos de migraciones al integrar | Regla 4 de §3 |
| Una persona no está disponible | Cada hito deja la documentación de sus módulos al día |
