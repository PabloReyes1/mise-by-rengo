# 17 — Plan de trabajo para 2 personas

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio**. Registra cada cambio en el [Control de cambios](README.md#control-de-cambios).

> Estado: ✅ **Aprobado** por RENGO (2026-11-12). Las semanas siguen el Gantt de [15-roadmap.md](15-roadmap.md) (duraciones confirmadas, S-22). Las carpetas están en [19-estructura-del-proyecto.md](19-estructura-del-proyecto.md).

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

**De los dos (los construye Deniscito en la Semana 0; después son de los dos y se cambian solo avisando):** `frontend/src/app/`, `frontend/src/styles/`, `frontend/src/core/api/`, `core/ui/`, `core/format/`, `shared/domain/orders`, `shared/domain/ids`, `backend/src/core/`. En `core/print/documents/` cada uno hace los impresos de su módulo: comanda (Persona 2); pre-cuenta, recibo, corte y movimientos (Persona 1).

**Asignación (PA-047, resuelta 2026-11-12):** Persona 1 (P1, Sala y caja) = **Pablito** · Persona 2 (P2, Cocina y gestión) = **Deniscito**.

### 1.1 Dónde se tocan los dos módulos

| Punto de contacto | Quién lo hace | Cómo no se estorban |
|---|---|---|
| El mesero **envía** un pedido; cocina lo **acepta** y lo marca **listo** | `orders` (P1) crea pedidos e ítems; `kitchen` (P2) cambia `accepted_at`, `ready_at` y el estado | Las transiciones de estado se definen una vez en `shared/domain/orders`; la tabla `orders` está en `orders.prisma` (P1) y P2 pide los cambios |
| La cocina avisa "listo" al mesero | P2 emite `order.ready` en `realtime`; P1 lo muestra en `mesero` | El evento está definido en `shared/contracts/realtime` |
| El mesero necesita el menú y el login | P2 (`catalog`, `auth`) | P2 los entrega primero (H1, semanas 1–2). Mientras, P1 usa el menú de `templates/restaurante-basico` y un usuario de desarrollo |
| La comanda se imprime desde el celular del mesero (también sin internet) | P2 hace `core/print` y el documento comanda; P1 lo llama al enviar | P1 usa la función de impresión que expone `core/print`, sin cambiarla |
| Sin internet, el KDS no recibe pedidos | P1 (`sync`, `core/offline`) | P2 solo muestra el banner y la etiqueta "LLEGÓ TARDE" en el KDS |

## 2. Semana 0 (cimientos)

5–8 días hábiles `[SUPUESTO]` (S-43), al aprobar la documentación. **Los cimientos los hace Deniscito (P2)** (RENGO, 2026-11-12): son lo que tiene que existir antes de que Pablito tome sus módulos. Pablito revisa cada entregable y avanza en lo suyo que no depende de los cimientos.

> **Avance (2026-11-12):** Semana 0 de Deniscito completa (entregables 1 a 5 y 7, y los contratos v1 de `auth`, `catalog` y `config` del entregable 6; el de `orders` es de Pablito). **H1 de Deniscito adelantado:** `auth`, `audit`, `config` + `admin` (restaurante, dispositivos) y `catalog` + `admin` (menú), con pantallas, y los temas que pasan el validador (PA-057 para los otros 3). Pendiente de H1 para Deniscito: `core/print` (después de la prueba con la impresora, R-01). Supuestos asumidos por Claude en doc 16 §2b, a revisar al cerrar H1.

> **Avance (2026-11-18), Pablito:** contrato v1 de `orders` (Semana 0). H1: `scripts/nuevo-cliente.sh` y plantillas de Caddy y pm2 (falta probarlos en el VPS de staging); **`floor` backend, primera parte**: zonas, mesas (crear, editar, bloquear, dar de baja), mapa `GET /api/floor`, abrir mesa y para llevar con la Cuenta 1, consultar y cambiar comensales, con 21 pruebas contra PostgreSQL. Después, **unir, trasladar y transferir** (27 pruebas en `floor`): el backend de `floor` de H1 está completo. Después, **`core/offline`** (outbox en IndexedDB con reintentos e `Idempotency-Key`), **idempotencia en el servidor** (`sync_operations`) y **pantallas de `mesero`** (mapa por zonas, abrir mesa y para llevar, detalle con comensales y cuentas, trasladar, unir y transferir), probadas en pantalla a 360 px con y sin conexión. Pendiente de H1 para Pablito: servidor de staging (espera a RENGO). **Esperando a Deniscito:** pantalla de administración de zonas y mesas, ventana de 🔑 (PIN del gerente), tiempo real (H2) y zonas/mesas de ejemplo en las plantillas.

> **Avance (2026-11-22), Deniscito:** lo que esperaba Pablito para cerrar H1, en `dev-denis`: **Configuración › Mesas** (`/admin/mesas`: zonas, mesas, bloquear, dar de baja), **ventana 🔑** en `core/session` (`AuthorizationDialog`, `useAuthorizationPrompt`, `authorizationRequired`) con `GET /api/auth/device-users?permission=`, y **zonas y mesas de ejemplo** (`templates/restaurante-basico/tables.json`, seed con `--with-tables`). **Le toca a Pablito:** usar la ventana 🔑 en `mesero` (hoy muestra el aviso de SC-38) agregando `authorization` al cuerpo de unir, trasladar y transferir. Después, **`core/print`** sin la impresora: documento de impresión independiente del transporte, ESC/POS, XML ePOS, transportes `epos-lan` y `webusb`, 2 reintentos y **página de prueba** en Configuración › Impresoras (`/admin/impresoras`). Probado de punta a punta en el navegador contra un simulador de impresora ePOS (imprime y avisa "sin papel" tras los reintentos). **Pendiente de H1 para Deniscito:** probar con la impresora Epson real desde Android e iPhone (R-01, SC-44).

> **Avance (2026-11-22), Pablito:** ventana 🔑 en `mesero` (abrir mesa, para llevar, comensales, trasladar, unir, transferir) con `useAuthorizedAction`; la acción se repite por la outbox con `authorization`. `PATCH` comensales acepta 🔑 para la mesa de otro mesero. Probado en el navegador (PIN incorrecto y correcto). **H1 de Pablito completo salvo el servidor de staging** (espera a RENGO). Siguiente: `orders` (H2), que necesita la decisión de PA-055.

> **Avance (2026-11-22), Pablito, H2:** **`orders` backend** (migración `h2_orders`: enviar ronda con folio, número de ronda, modificadores, combos e idempotencia; listar rondas; entregar; cancelar ítem con motivo y 🔑; 19 pruebas) y **`billing` parte de sala** (listar, crear y renombrar cuentas, mover ítems, separar unidades; totales calculados por el servidor; 7 pruebas). Unir mesas también mueve los pedidos. **`mesero`**: tomar pedido (menú por categoría, modificadores con sus reglas, cantidad, nota, borrador guardado en el celular, revisar y enviar por la outbox), rondas con su estado en la mesa y "Marcar entregado"; probado en el navegador a 360 px. **Esperando a Deniscito:** `id` de los grupos de combo en `GET /api/menu` (SC-51), lectura de motivos `CANCEL_ITEM` para el mesero (para la pantalla de cancelar ítem), tiempo real (aviso "listo" con vibración), cocina y comandas. **Pendiente de RENGO:** PA-058 (entregar sin KDS). Falta en `mesero`: pantallas de cuentas (crear, mover, separar; el backend ya está) y cancelar ítem.

| # | Entregable | Quién |
|---|---|---|
| 1 | Archivos de configuración de la raíz: `package.json` y `pnpm-workspace.yaml` (pnpm, doc 19 §7), `tsconfig`, lint, formato, Vitest, reglas entre módulos con dependency-cruiser (doc 19 §8), `.gitignore`, `.env.example` | P2 |
| 2 | CI: typecheck, lint, reglas entre módulos (`pnpm check:boundaries`) y pruebas | P2 |
| 3 | `backend/src/core`: `.env` con Zod, Prisma, Fastify en `127.0.0.1`, `GET /api/health`, errores, logger, verificación de JWT y permisos | P2 |
| 4 | `frontend/src/app`, `styles` (tokens de doc 18 y sistema de temas), `core/api`, `core/ui` con los componentes base, `core/format` | P2; P1 revisa |
| 5 | `shared/contracts/errors`, `shared/domain/orders` (estados) y `shared/domain/ids` | P2; P1 revisa los estados de `orders` |
| 6 | Contratos v1 de `auth`, `catalog` y `orders`, que son los que conectan los dos módulos | Cada uno los suyos; el otro los revisa |
| 7 | `templates/seed` y `templates/restaurante-basico` con un menú de prueba | P2 |

**Mientras tanto, Pablito (P1):** revisa los entregables 1 a 5 (sobre todo los estados de `shared/domain/orders`, que son de su módulo), escribe el contrato v1 de `orders` (entregable 6), prepara el servidor de staging y las plantillas de Caddy y pm2, empieza `scripts/nuevo-cliente.sh` y termina los bocetos de mesero y caja. Sus módulos (`floor`, outbox, `orders`…) empiezan en H1, cuando los cimientos estén terminados.

## 3. Reglas para trabajar por separado e integrar después

1. **Cada uno edita sus carpetas** (§1). Para tocar algo del otro, se le avisa. **Si una tarea del otro es del mismo hito, se puede avanzar** para no quedar bloqueado: se anota en §3.1 y en el Control de cambios (2026-11-23).
2. **El contrato va primero.** Un endpoint, campo o evento nuevo se agrega primero a [08](08-api.md) o [07](07-modelo-de-datos.md), después a `shared/contracts/<modulo>`, y el dueño del otro lado lo revisa.
3. **Esquema Prisma por módulo** (`backend/prisma/schema/<modulo>.prisma`): cada uno edita solo los archivos de sus módulos.
4. **Migraciones:** cada uno genera las suyas, solo aditivas. Al integrar, quien integra en segundo lugar vuelve a generar su migración encima de la del otro.
5. **No se crean carpetas fuera de [19](19-estructura-del-proyecto.md)** sin agregarlas primero al documento.
6. **Control de cambios del README:** cada quien agrega sus filas al final; si hay conflicto al integrar, se conservan las dos.
7. **Se trabaja en `main`** (desde 2026-11-23; antes, una rama por persona). `git pull` antes de empezar; un commit corto por cada cambio, a nombre de quien trabaja aunque lo prepare Claude.
8. **Cada hito termina con una integración y una demo conjunta** con las pruebas indicadas de [14](14-plan-de-pruebas.md). No se empieza el siguiente hito hasta que la demo pase.

### 3.1 Tareas reasignadas

Tareas que hizo la otra persona para no quedar bloqueada (regla 1). El dueño del módulo no cambia.

| Fecha | Tarea | Hito | Dueño | La hizo | Motivo |
|---|---|---|---|---|---|
| 2026-11-23 | Estados derivados de la mesa en el mapa (`service` en `GET /api/floor`: lista, con pedido en cocina, pre-cuenta) con los colores de doc 18 §5.1 | H2 | Pablito (`floor`, `mesero`) | Deniscito | Cerrar H2 |
| 2026-11-23 | #17 Cuentas en el mesero (crear, renombrar, mover ítems, separar unidades) y pre-cuenta: endpoint `POST /api/bills/:id/precheck` (PRECUENTA, propina sugerida, entrega automática S-09, reimpresión con 🔑) e impreso de pre-cuenta | H2 | Pablito (`billing`, `mesero`, impresos) | Deniscito | Seguir el orden del plan |
| 2026-11-23 | #16 Aviso "listo" al mesero: sonido + vibración + aviso fijo sobre todas sus pantallas hasta entregar (se guarda en el dispositivo; llega también al reconectar); `MeseroLayout` escucha el tiempo real una sola vez | H2 | Pablito (`mesero`) | Deniscito | Seguir el orden del plan |
| 2026-11-23 | Imprimir la comanda desde el mesero (al enviar, reimprimir por ronda, cancelación) | H2 | Pablito (`mesero`) | Deniscito | Conectar la comanda (#14) con la toma de pedido |
| 2026-11-23 | Publicar eventos de tiempo real desde `floor`, `orders` y `billing`; el mesero vuelve a leer al recibirlos (`mesero/api/realtime-sync.ts`) | H2 | Pablito | Deniscito | Conectar el tiempo real (#13) con la sala |
| 2026-11-23 | Cancelar ítem enviado desde el mesero: motivo obligatorio (`GET /api/reasons`), nota opcional, 🔑 si falta `order.cancel_sent`; los motivos se descargan con el mapa | H2 | Pablito (`mesero`) | Deniscito | Seguir el orden del plan |
| 2026-11-23 | Vender combos en el mesero: elegir cada grupo del combo y los modificadores de cada componente; se ven en el pedido (SC-51) | H2 | Pablito (`mesero`) | Deniscito | Seguir el orden del plan sin esperar |
| 2026-11-23 | Abrir mesa y enviar pedidos sin conexión: mesa local en el caché (`mesero/api/local-occupancy.ts`), `runOperation` responde "guardado" si espera detrás de otra acción, el menú se descarga desde el mapa | H1 | Pablito (`mesero`, `core/offline`) | Deniscito | Error encontrado en la prueba: sin conexión la mesa no se abría y "Enviar a cocina" se quedaba girando |
| 2026-11-23 | Comensales con − y + en el detalle de la mesa (sin ventana "Cambiar"), número editable, se guarda solo | H1 | Pablito (`mesero`) | Deniscito | Pedido de RENGO en la prueba |

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
| 2 | Cimientos compartidos (`shared/domain/ids`, `contracts/errors`) | ULID, formato de errores | 🧱 | — | P2 | S0 |
| 3 | Cimientos del frontend (`app`, `styles`, `core/api`, `core/ui`) | Rutas, sistema de temas con Botanical Graphite como único tema y validador de contraste (doc 18 §8, +2–3 días), componentes base, cliente `/api` relativo, PWA instalable | 🧱 | 1 | P2 | S0 |
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

**Integración H1:** en staging, emparejar el celular, iniciar sesión, configurar el menú real y abrir mesas. PR-023, PR-024, PR-100, PR-303, PR-400, PR-402, PR-403, PR-500. **Al cerrar H1:** revisar los supuestos SC con "Revisar en H1" (doc 16 §2b).

### H2 — Servicio (4 semanas)

| Persona 1 (Pablito) | Persona 2 (Deniscito) |
|---|---|
| `orders`: toma de pedido (modificadores, combos, notas, borrador), envío con folio e idempotencia, cancelar ítem, entregar | `kitchen` + `cocina`: cola FIFO, aceptar, listo (pedido e ítem), recall, sonido, colores por tiempo |
| `billing` (parte de sala): crear cuentas y mover ítems | `realtime`: Socket.IO, salas, `seq`, reconexión con `lastSeq` |
| `mesero`: aviso "listo" con vibración, marcar entregado | `print/documents`: comanda normal, ADICIONAL y de cancelación |

**Integración H2:** servicio completo con conexión, de abrir la mesa a entregar. PR-002 a PR-009, PR-013, PR-015, PR-101, PR-103, PR-104, PR-108. **Al cerrar H2:** revisar los supuestos SC con "Revisar en H2" (doc 16 §2b).

> **Demo de H2 (2026-11-23, Deniscito):** aprobada salvo los arreglos de abajo, que se hacen **antes** de seguir con H3. Deniscito autorizó empezar H3 sin esperar más y avanzar también las tareas de Pablito de H3 (regla 8 y §3.1).
>
> **Arreglos pendientes de la demo de H2 (en este orden):**
> 1. **Pedido sin conexión invisible en la mesa:** al enviar un pedido sin conexión, la pantalla de la mesa no lo muestra. Debe aparecer en "Pedidos" con su estado "Sin enviar" (copia local en el caché de , como la mesa local de ), y reemplazarse por el del servidor al sincronizar.
> 2. **No se ve el contador de "pendientes":** revisar  (cuenta de la outbox junto al indicador de conexión): en la prueba de Deniscito no aparecía. Que se vea siempre que haya acciones sin enviar, también en celular.
> 3. **No se pueden subir imágenes** (ni pegando ni eligiendo archivo) en productos ni en el logo. Revisar cómo lo hace el proyecto **DENGO-POS** (carpeta , una arriba de este repo) en productos y corregir , , la subida ( con FormData) y  y . Probarlo en el navegador.
> 4. **Sonido del KDS:** hoy suena cada 30 s mientras haya pedidos sin aceptar y molesta. Cambiar a: (a) **pedido nuevo → suena una vez**; (b) **recordatorio configurable** (cada cuánto, desde administración; por defecto más espaciado, ej. 2 min) que suena **una sola vez** por recordatorio y con el sonido del **estado más crítico** que haya; (c) **un sonido distinto por estado** (nuevo, por vencer, atrasado). Va con la configuración de umbrales y sonido del KDS en admin (SC-54,  y ).
>
> Confirmado en la demo: el aviso "Listo para entregar" se queda hasta marcar entregado (Docs/05 paso 8), aunque se toque para ir a la mesa.

### H3 — Cobro y caja (3 semanas)

| Persona 1 (Pablito) | Persona 2 (Deniscito) |
|---|---|
| `billing` + `caja`: descuentos configurables y 🔑, propina sugerida con reparto, pagos mixtos, cambio, cobro del mesero, reapertura de cuentas en efectivo | `admin`: usuarios, roles, dispositivos, impresoras y rutas de impresión, métodos de pago, motivos, tickets |
| `cash` + `caja`: turnos (abrir solo en línea), retiros/depósitos, corte (a ciegas; provisional sin conexión) | `recipes` + `admin`: insumos, unidades, recetas, costeo, productos afectados |
| Impresos: pre-cuenta, recibo, corte, movimientos; cajón | `print`: transporte `qz` si la caja es Windows |
| NIT/CF en la cuenta y el recibo (sin FEL, PA-002) | |

**Integración H3:** PR-001 completo, PR-010 a PR-012, PR-014, PR-016 a PR-019, PR-102, PR-107. **Al cerrar H3:** revisar los supuestos SC con "Revisar en H3" (doc 16 §2b).

### H4 — Sin internet y reportes (4 semanas)

| Persona 1 (Pablito) | Persona 2 (Deniscito) |
|---|---|
| `sync` + `core/offline`: `sync/push` y `sync/pull`, folios temporales, regla "a cargo", conflictos y su pantalla en `admin` (P2 da el lugar en el menú), QR de pre-cuenta, registro de cortes | `reports` + `reportes`: vistas `semantic`, métricas, dashboard, reportes del MVP, CSV/XLSX |
| `scripts/`: `desplegar.sh`, `respaldo.sh`, `restaurar-cliente.sh`, `monitor.sh` | KDS sin conexión: banner, "LLEGÓ TARDE", impresión local de la comanda desde el celular |

**Integración H4:** PR-200 a PR-220 con 2–3 dispositivos reales, PR-020 a PR-022, PR-026, PR-302, PR-502 a PR-506. **Al cerrar H4:** revisar los supuestos SC con "Revisar en H4" (doc 16 §2b).

### H5 — Staging, pruebas y UAT (3 semanas, juntos)
Antes de UAT se revisan los supuestos SC que sigan ⏳ (doc 16 §2b). P1: E2E de sala y caja, pruebas sin internet. P2: E2E de cocina y admin, carga (k6), seguridad, impresión en 58 y 80 mm. Juntos: instalación en el restaurante, capacitación y operación en paralelo con papel (doc 14 §9).

## 6. Riesgos del reparto

| Riesgo | Mitigación |
|---|---|
| Toda la Semana 0 depende de una sola persona (P2) | Orden fijo de los entregables (1 → 5); P1 revisa cada uno al terminarlo para no frenar; si P2 se atrasa, P1 toma el CI (entregable 2) |
| P1 depende del login y el menú de P2 al inicio | P2 los hace primero; P1 empieza con el menú de `templates/restaurante-basico` y un usuario de desarrollo |
| P1 tiene la parte más difícil (sin internet) | Diseño conjunto de 1 día al iniciar H4; si P1 se atrasa, P2 toma `scripts/` |
| Las dos personas editan la tabla `orders` | Dueño único (P1); P2 pide los campos de cocina por contrato (§3 regla 2) |
| Conflictos de migraciones al integrar | Regla 4 de §3 |
| Una persona no está disponible | Cada hito deja la documentación de sus módulos al día |
