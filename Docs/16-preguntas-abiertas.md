# 16 — Preguntas abiertas y supuestos

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio**. Registra cada cambio en el [Control de cambios](README.md#control-de-cambios).

Prioridad: 🔴 bloquea el inicio del desarrollo · 🟡 debe resolverse durante la Fase 1 · 🟢 puede esperar.

Al resolver una pregunta: muévela a la sección 3 con la respuesta y la fecha, actualiza los documentos donde aparece y registra el cambio en el [Control de cambios](README.md#control-de-cambios).

## 1. Preguntas abiertas (`[PENDIENTE DE DEFINIR]`)

> RENGO decidió (2026-11-12) que las preguntas que siguen abiertas se resuelven **durante el avance** del proyecto. Mientras tanto se trabaja con la recomendación de cada una. Ninguna bloquea el inicio del desarrollo.

| ID | Pregunta | Prioridad | Dónde aparece | Opciones / recomendación |
|---|---|:-:|---|---|
| PA-021 | Modelos de impresoras, router y (si se usan) tablets del primer cliente | 🟡 | ADR-003, doc 06 §7, doc 14 §7 | **Propuesta de trabajo** (2026-11-12): kit de doc 06 §7, pensado para meseros con su propio celular (impresoras Epson con ePOS LAN, KDS opcional, router dual WAN con 4G). RENGO elige los equipos finales; ya no bloquea el inicio |
| PA-056 | Logo e ícono de la app de Mise by Rengo (marca de RENGO) | 🟢 | `frontend/public/icons/` | Mientras tanto se usa un ícono **provisional** (una "M" blanca sobre `primary`). RENGO entrega el logo en SVG y se regeneran los PNG de la PWA |
| PA-057 | Tres temas aprobados no cumplen dos combinaciones de doc 18 §4.1 que no se habían calculado: **Piedra y rosa** (texto `primary` sobre `accent` 2.93 y sobre `warning` 2.78), **Carbón y oro** (`primary` sobre `accent` 3.69) y **Cielo de medianoche** (`primary` sobre `accent` 2.30 y sobre `warning` 2.80). Mínimo: 4.5 | 🟡 | doc 18 §8.4, `shared/domain/theme/themes.ts` | **Recomendación:** tonos derivados ◆ como en PA-054 (un `accent` más claro y, donde falla, un `warning` más claro). Mientras tanto esos 3 temas **no se pueden elegir**; sí se pueden Botanical Graphite, Violeta medianoche y Uva y porcelana |
| PA-058 | Sin pantalla de cocina (el KDS es opcional, doc 06), ¿cómo se entrega un pedido? Hoy `deliver` solo funciona desde `LISTO`, y sin KDS nadie lo marca listo | 🟡 | doc 05 §5.3, `shared/domain/orders`, `POST /api/orders/:id/deliver` | **Recomendación:** si la sucursal no usa KDS, permitir `ENVIADO → ENTREGADO` (y desde `EN_PREPARACION`) al marcar entregado, guardando `delivered_auto = false` y sin tiempos de cocina. Mientras tanto, el botón "Marcar entregado" aparece solo en pedidos `LISTO` |

## 2. Supuestos

RENGO confirmó los supuestos el 2026-11-11 (los que corrigió) y el 2026-11-12 (todos los demás). Se dejan aquí para no perder el número. La marca `[SUPUESTO]` ya se quitó de los documentos. **Siguen abiertos S-43 (duración de la Semana 0), S-44 (contenido de la plantilla) y S-45 (zonas y mesas de ejemplo).**

| ID | Supuesto | Documento |
|---|---|---|
| S-01 | **Confirmado:** Metas del MVP (60 s por pedido, 2 s al KDS, 99.5 % de disponibilidad) | 01 §1.7 |
| S-02 | **Confirmado:** 30 dispositivos simultáneos por sucursal y 3 sucursales por cliente como máximo de diseño | RNF-021 |
| S-03 | **Confirmado:** `connection_limit` = 5 por cliente (+2 de solo lectura) | RNF-025, 13 §7.2 |
| S-04 | **Confirmado:** sin bloqueo por inactividad. Token de acceso corto (15 min) que se refresca mientras se usa; la sesión vence a las 12 h sin actividad | 03 §6, RF-032, RNF-002, ADR-008 |
| S-05 | **Confirmado:** el gerente decide si se permiten descuentos y el límite de cada rol. En la plantilla los descuentos vienen **desactivados** | 03 §4, §5, 07 `client_settings` |
| S-06 | **Confirmado:** en la plantilla el mesero **sí cobra** y el pago se registra al momento; la caja también cobra. Configurable por rol. Turno del efectivo: PA-052 | 03 §4, 05 paso 11 |
| S-07 | **Confirmado:** Excedente en métodos no efectivo se rechaza (no se da cambio sobre tarjeta) | HU-041 |
| S-08 | **Confirmado:** En el corte, las cuentas abiertas pasan al siguiente turno | HU-012 |
| S-09 | **Confirmado:** Pedido no marcado como entregado se marca automáticamente al imprimir la pre-cuenta y se excluye del promedio | 05 paso 9 |
| S-10 | **Confirmado:** la propina siempre es **sugerida**. Se calcula después de descuentos | 05 §4, RF-025 |
| S-11 | **Confirmado:** Imágenes públicas por URL versionada (sin autenticación) | 08 §2.4 |
| S-12 | **Confirmado:** Semana inicia el lunes | 10 §3.2 |
| S-13 | **Confirmado:** 100 preguntas al mes por cliente; al llegar al límite se bloquea y pide contactar a RENGO para aumentarlo | 10 §7, 07 `license` |
| S-14 | **Confirmado:** Consumo de datos < 300 MB/día por sucursal | 06 §7 |
| S-15 | **Confirmado:** Hardware y costos de referencia | 06 §7, 09 §2 |
| S-16 | **Confirmado:** el tamaño del VPS y cuántos clientes por servidor los define RENGO (referencia: 4 vCPU / 8 GB / 160 GB; ~15 clientes) | 13 §1, §7 |
| S-17 | **Confirmado:** Consumo de RAM por proceso 150–300 MB | 13 §7.1 |
| S-18 | **Confirmado:** Tamaño de base ~0.5–1 GB/año por cliente de 1 sucursal | 13 §7.3 |
| S-19 | **Confirmado:** Umbrales del monitor | 13 §6 |
| S-20 | **Confirmado:** Herramientas de prueba (Vitest, Playwright, k6, toxiproxy) | 14 §1 |
| S-21 | **Confirmado:** Operación en paralelo con papel 3 días en UAT | 14 §9 |
| S-22 | **Confirmado:** Duraciones de las fases con 2 desarrolladores | 15 §1 |
| S-23 | **Confirmado:** Primer cliente: 1 sucursal, ≤ 15 mesas, ≤ 6 meseros, ~150 cuentas/día | 15 §3 |
| S-24 | **Confirmado:** Una orden se cuenta en el día de negocio de su última cuenta pagada | 12 §1 |
| S-25 | **Confirmado:** Conversiones de unidad por insumo (ej. 1 huevo = 50 g) | 07 §4.6 |
| S-26 | **Confirmado:** Reportes > 92 días en segundo plano | RF-175 |
| S-27 | **Confirmado (2026-11-12):** PostgreSQL 18 (no la 17) | 06 §3.3, 13 §1 |
| S-28 | **Confirmado:** una cuenta pagada en efectivo se puede reabrir **desde otro turno** (por si hay cambio de turno mientras se resuelve). El reverso va al turno abierto donde se reabre | RF-069, 05 paso 14 |
| S-29 | **Confirmado:** se reabre sin importar si la mesa está ocupada o libre; la ocupación y la mesa no cambian | RF-069, 05 paso 14 |
| S-30 | **Confirmado:** No se puede separar un ítem que tiene descuento de ítem aplicado (hay que quitarlo primero) | RF-104 |
| S-31 | **Confirmado:** Con fondo variable, se sugiere lo que quedó en el corte anterior | RF-050, 05 paso 1 |
| S-32 | **Confirmado:** la licencia avisa 15 días antes de vencer y **repite el aviso cada día** desde el primero | RF-256 |
| S-33 | **Confirmado:** VPS en Ashburn (dentro de EE. UU.) | 13 §1 |
| S-34 | **Confirmado:** La reapertura solo se permite dentro del **mismo día de negocio** del cobro | RF-069, 08, 12 §4 |
| S-35 | **Confirmado:** En el reparto `POOL`, las propinas del día de negocio se reparten en partes iguales entre los meseros que trabajaron ese día | RF-025, 07, RPT-033 |
| S-36 | **Confirmado:** Corte provisional: si el esperado recalculado difiere, el turno se cierra con el del servidor y se crea `CORTE_DIFERENTE` | 05 paso 13, 09 §4.3 |
| S-37 | **Confirmado:** Las consultas guardadas del chatbot se pueden repetir sin LLM y sin gastar cuota; se guardan 12 meses; el mes de la cuota es el calendario del cliente | 10 §7, §8 |
| S-38 | **Confirmado:** Sistema de temas: 2–3 días extra en la Semana 0; medio día por tema nuevo | 18 §8 |
| S-39 | **Confirmado:** Tokens máximos por respuesta del chatbot: 800 | 10 §7 |
| S-40 | **Confirmado:** Los temas adicionales usan los colores funcionales de Botanical Graphite, salvo el dorado de los temas 2 y 4, que reemplaza a `warning` | 18 §8.4 |
| S-41 | **Confirmado:** Los 5 temas adicionales se cargan en H1, medio día cada uno | 18 §8.5 |
| S-42 | **Confirmado:** Kit de hardware de trabajo (TM-m30III / TM-T20III Ethernet, TP-Link ER605 + router 4G) mientras RENGO elige | 06 §7 |
| S-43 | La Semana 0 dura 5–8 días hábiles con una sola persona (Deniscito) haciendo los cimientos | 17 §2 |
| S-44 | Contenido de la plantilla `restaurante-basico`: métodos de pago (Efectivo, Tarjeta y Transferencia; tarjeta y transferencia piden referencia), nombres de los motivos, pies de los tickets ("Esta no es una factura.", "Gracias por su visita."), papel de 80 mm, sucursal "Principal", estación "Cocina", la onza como unidad de masa, y el menú de ejemplo. Todo lo edita el cliente | `templates/restaurante-basico`, `templates/seed` |
| S-45 | Zonas y mesas de ejemplo de `restaurante-basico` (`tables.json`): Salón (mesas 1 a 8), Terraza (T1 a T4) y Barra (Barra 1 a 3), 15 mesas en total como el primer cliente (§3 del doc 15). Solo se cargan con `--with-tables` (desarrollo y demos); un cliente real configura las suyas en Configuración › Mesas | `templates/restaurante-basico/tables.json`, `seed-cli.ts` |

## 2b. Supuestos de implementación (asumidos por Claude)

Detalles sencillos que los documentos no definían y que Claude asumió al programar, por indicación de Deniscito (2026-11-12): "asume las cosas sencillas, déjalas anotadas y evalúalas al final de cada hito". **Cada uno se revisa en la integración del hito indicado** (doc 17 §5): se confirma, se cambia (y se corrige el código) o se pasa a RENGO.

Estado: ⏳ por revisar · ✅ confirmado · 🔁 cambiado

| ID | Supuesto | Dónde | Revisar en | Estado |
|---|---|---|---|:-:|
| SC-01 | El dispositivo se identifica con las cabeceras `X-Device-Id` + `X-Device-Token` en login, PIN y lista de usuarios (el doc 08 decía "Dispositivo" sin la cabecera) | `shared/contracts/auth`, módulo auth | H1 | ⏳ |
| SC-02 | Tabla nueva `pairing_codes` para los códigos de emparejamiento (se guarda el hash del código, un solo uso, 10 min) | doc 07 §4.2, `auth.prisma` | H1 | ⏳ |
| SC-03 | argon2id con la librería `@node-rs/argon2` (binarios ya compilados; no necesita compilador en Windows ni en el servidor) | `backend/src/core/secrets.ts` | H1 | ⏳ |
| SC-04 | Licencia inicial del seed: plan `MVP`, sin fecha de vencimiento, módulos `recipes` y `advancedReports` activos, límites 1 sucursal / 15 dispositivos / 100 preguntas de IA (valores de ejemplo del doc 07) | `backend/src/core/seed.ts` | H1 | ⏳ |
| SC-05 | Carpeta `shared/contracts/common` para tipos comunes (ID, monto, color) | doc 19 §5 | H1 | ⏳ |
| SC-06 | El administrador inicial se llama "Administrador", su contraseña temporal tiene 14 caracteres y el seed no carga el menú de ejemplo salvo con `--with-menu` | `seed-cli.ts` | H1 | ⏳ |
| SC-07 | Endpoint nuevo `GET /api/auth/device-users`: usuarios activos con PIN de la sucursal del dispositivo, para elegir el nombre antes del PIN | doc 08 §2.2 | H1 | ⏳ |
| SC-08 | Código de emparejamiento inválido, usado o vencido → `400 VALIDATION_ERROR` (no hay un código de error propio) | módulo auth | H1 | ⏳ |
| SC-09 | Límite de intentos por IP: emparejar 10 por minuto; login, PIN y refresh 30 por minuto → `429 RATE_LIMITED` | `core/app.ts` | H1 | ⏳ |
| SC-10 | Prefijo de folios sin conexión: letra por tipo (M mesero, C caja, K cocina, A admin) + número consecutivo, ej. `M3` | módulo auth | H4 (con Pablito, `sync`) | ⏳ |
| SC-11 | Bloqueo por intentos: 5 fallos seguidos (contraseña o PIN, se suman) bloquean la cuenta 15 minutos → `423 ACCOUNT_LOCKED` | módulo auth | H1 | ⏳ |
| SC-12 | `GET /api/auth/pin-cache` (PIN para 🔑 sin conexión) se hace en H4 junto con el modo sin internet | doc 08 §2.2 | H4 | ⏳ |
| SC-13 | La sesión del dispositivo (tokens) se guarda en `localStorage` del navegador | frontend `core/session` | H1 | ⏳ |
| SC-14 | El primer dispositivo se empareja con un código generado en el servidor: `pnpm --filter @mise/backend pairing-code` (lo usa el operador de RENGO al dar de alta el cliente) | `pairing-code-cli.ts`, doc 13 §2 | H1 | ⏳ |
| SC-15 | Los días de la licencia se cuentan por fecha UTC (no por la zona horaria del cliente) | módulo config | H1 | ⏳ |
| SC-16 | SKU repetido → `400 VALIDATION_ERROR` con el nombre del producto que ya lo usa | módulo catalog | H1 | ⏳ |
| SC-17 | `GET /api/menu` trae todo (también lo inactivo y agotado); cada pantalla filtra lo que muestra | módulo catalog | H2 (con Pablito, `orders`) | ⏳ |
| SC-18 | El aviso de "agotado" a los demás dispositivos en ≤ 2 s (RF-011) llega con `realtime` en H2; por ahora se ve al recargar el menú | módulo catalog | H2 | ⏳ |
| SC-19 | Endpoint nuevo `GET /api/config/logo?v=` (público y con caché, igual que las fotos de productos) para mostrar el logo | doc 08 §2.3 | H1 | ⏳ |
| SC-20 | Crear una sucursal le copia las plantillas de ticket de la primera y le crea su estación "Cocina". No se valida aún el límite de sucursales de la licencia | módulo config | H1 | ⏳ |
| SC-21 | Los temas viven en `shared/domain/theme/themes.ts` (no en `frontend/src/styles/themes/`) porque el backend valida contra ellos el `primary` del cliente | doc 18 §8.1, doc 19 §5 | H1 | ⏳ |
| SC-22 | Pantalla de entrar: en caja y cocina (compartidos) se elige el nombre y se escribe el PIN; en mesero y administración, usuario y contraseña. Siempre se puede cambiar de modo | frontend `modules/auth` | H1 | ⏳ |
| SC-23 | El nombre del dispositivo ("Caja 1") se guarda solo en ese equipo; en el servidor queda el que se escribió al emparejar | frontend `core/session` | H1 | ⏳ |
| SC-24 | En administración (H1) solo se generan códigos para emparejar; la lista de dispositivos y revocarlos desde la app llegan en H3 (la API ya existe: `DELETE /api/devices/:id`) | frontend `modules/admin` | H3 | ⏳ |
| SC-25 | Los editores de producto y de modificadores se abren en la misma página (no en una ventana modal); "Se agotó" / "Hay de nuevo" cambia el estado con un toque | frontend `modules/admin` | H1 | ⏳ |
| SC-26 | Formas de mesa en el mapa: `SQUARE` (default), `ROUND`, `RECTANGLE`. Posición y tamaño en unidades de una cuadrícula, opcionales hasta el editor visual (RF-021, F2) | doc 07 §4.4, `shared/contracts/floor` | H1 | ⏳ |
| SC-27 | `dining_tables` tiene columna `active` (el doc 07 no la tenía): una mesa no se borra porque las ocupaciones viejas la referencian; se da de baja y desaparece del mapa | doc 07 §4.4, `floor.prisma` | H1 | ⏳ |
| SC-28 | `POST /api/occupancies` acepta `billId` (opcional): el ULID de la Cuenta 1 lo genera el dispositivo, igual que el de la ocupación, para poder asignarle ítems sin conexión (Docs/09). Si no viene, lo genera el servidor | doc 08 §2.5, módulo floor | H4 (con `sync`) | ⏳ |
| SC-29 | Mesa bloqueada al abrir → `409 TABLE_OCCUPIED` con `details.status = "BLOQUEADA"` (no hay un código propio). Reenviar el mismo `id` de ocupación responde `200` con la ocupación existente; la primera vez, `201` | módulo floor | H1 | ⏳ |
| SC-30 | El nombre de la mesa no se repite entre las mesas activas de la sucursal (sin importar la zona ni mayúsculas): el mesero dice "la 5", no "la 5 de Terraza" | módulo floor | H1 | ⏳ |
| SC-31 | Bloquear/desbloquear una mesa se hace con `PUT /api/tables/:id` `{ blocked, version }` (el doc 08 no tenía ruta para eso). No se bloquea, da de baja ni desactiva la zona de una mesa ocupada o unida | doc 08 §2.5, módulo floor | H1 | ⏳ |
| SC-32 | Abrir a nombre de otro mesero (`waiterId`) solo pide `table.open`; el mesero debe estar activo y asignado a la sucursal. La sucursal de la petición es la de `X-Branch-Id` o, si no viene, la del dispositivo | módulo floor | H1 | ⏳ |
| SC-33 | Operar la mesa de otro mesero exige `table.view_all`, salvo que la acción llegue con la 🔑 de quien sí puede: esa autorización vale también para la mesa ajena | módulo floor | H1 | ⏳ |
| SC-34 | Unir mesas: solo mesas (no para llevar); las cuentas de la mesa unida se renombran "Cuenta 1 · Mesa 6"; los comensales se suman (máximo 99); si a la mesa unida ya le habían unido otras, pasan a la principal (un solo nivel). No hay "separar mesas" en el MVP | módulo floor | H1 | ⏳ |
| SC-35 | Idempotencia en H1: la respuesta se guarda en `sync_operations` **después** de la acción (no en la misma transacción, regla 5 del doc 09 §4.2). Si dos envíos con la misma clave llegan a la vez, los protege la regla de negocio (ids del dispositivo, `version`, índice único de mesa abierta). La misma transacción llega con `sync/push` en H4. Una clave usada por otro dispositivo u otra ruta → `400 VALIDATION_ERROR` | doc 08 §1, módulo sync | H4 | ⏳ |
| SC-36 | Transferir mesa: la lista de meseros sale de `GET /api/auth/device-users` (usuarios activos de la sucursal **con PIN**). Cuando exista la administración de usuarios (H3, Deniscito) se puede cambiar a una lista propia | frontend `modules/mesero` | H3 | ⏳ |
| SC-37 | Mesa bloqueada en el mapa: fondo `surface`, texto `primary` e ícono de candado. El doc 18 §5.1 proponía texto `accent`, que no llega al contraste AA sobre `surface` | doc 18 §5.1, `TableCard` | H1 | ⏳ |
| SC-38 | ~~Aviso "necesita la autorización de un gerente" mientras no existía la ventana 🔑~~ **Reemplazado (2026-11-22):** abrir mesa, para llevar, comensales, trasladar, unir y transferir abren la ventana 🔑 de `core/session` (SC-40) con `useAuthorizedAction` y repiten la acción por la outbox con `authorization` (SC-42). El botón Transferir se ve siempre: sin `table.transfer_waiter` el servidor pide la 🔑. El aviso queda solo para acciones rechazadas después de guardarse sin conexión | frontend `modules/mesero` | H1 | ⏳ |
| SC-39 | Mientras no haya tiempo real (H2), el mapa, las mesas abiertas y el detalle se vuelven a leer cada 10 s. Las mutaciones que encolan usan `networkMode: 'always'`: sin conexión TanStack Query las pausaría y la acción nunca llegaría a la outbox | frontend `modules/mesero`, `core/offline` | H2 | ⏳ |
| SC-40 | Ventana 🔑: está en `core/session` (no en `modules/auth`) porque la usan varios módulos y un módulo del frontend no importa otro (doc 19 §8). Lista solo a quienes tienen el permiso que falta (`GET /api/auth/device-users?permission=`); si hay una sola persona, va directo a su PIN. Si el PIN falla, el mensaje queda en la ventana y se puede reintentar; el bloqueo por intentos es el del login | `core/session/AuthorizationDialog.tsx`, doc 08 §2.2 | H1 | ⏳ |
| SC-41 | Configuración › Mesas muestra las mesas activas de las zonas activas (lee `GET /api/floor`; el doc 08 no tiene una lista de mesas para administración). Una mesa dada de baja no se reactiva: se crea otra con el mismo nombre. Las mesas de una zona inactiva se ven al activarla | `modules/admin` (`TablesPage`) | H1 | ⏳ |
| SC-42 | Con 🔑, la acción se repite **por la outbox** con `{ authorization }` en el cuerpo: el PIN queda en IndexedDB solo mientras la operación está pendiente y el servidor lo valida al aplicarla (sin conexión, la validación local con `pin_cache` llega en H4, doc 09 §7) | `core/session`, `core/offline` | H4 | ⏳ |
| SC-43 | Hasta la administración de impresoras y rutas (H3: `/api/printers`, `/api/devices/:id/printer-routes`), cada dispositivo guarda sus impresoras en `localStorage` con los mismos campos de `printers` (doc 07) y las configura en Configuración › Impresoras. En H3 se pasan al servidor | `core/print/printers.ts`, `/admin/impresoras` | H3 | ⏳ |
| SC-44 | Detalles de impresión a validar con la impresora real (R-01): en ePOS el corte siempre es `<cut type="feed"/>` (total o parcial lo decide la impresora); el zumbador es `ESC B 2 1` en ESC/POS y `<sound pattern="pattern_a"/>` en ePOS; el servicio ePOS se llama con `devid=local_printer`; los acentos en ePOS los convierte la impresora. Los textos se acomodan en `core/print/layout.ts` y no con las tablas de la librería, para que ESC/POS, ePOS y la vista previa salgan iguales | `core/print` | H1 | ⏳ |
| SC-45 | Outbox y 🔑: (1) `401 PIN_INVALID` es rechazo de negocio, no se reintenta (los demás `401` sí: sesión vencida); si se reintentara, un PIN mal escrito trabaría la cola con el PIN guardado. (2) Una acción que el servidor rechaza **mientras la pantalla espera la respuesta** sale de la cola, porque la pantalla ya muestra el error; si quedara RECHAZADA, el reintento con 🔑 (misma entidad) se rechazaría como dependiente. Solo las rechazadas después de quedar guardadas sin conexión siguen en la lista del mapa. (3) `POST /api/occupancies` y `PATCH /api/occupancies/:id` aceptan `authorization` (antes el contrato la quitaba del cuerpo) | `core/offline`, doc 08 §2.5, módulo floor | H1 | ⏳ |
| SC-46 | Las tablas de `orders` no tienen relación de Prisma con catálogo, usuarios, sucursal ni estación (son de otros módulos): el servicio valida que existan y que sean de la sucursal. Solo `orders → occupancies` y `order_items → bills` tienen llave foránea | `backend/prisma/schema/orders.prisma`, doc 07 | H2 | ⏳ |
| SC-47 | `GET /api/occupancies/:id/orders` (no estaba en el doc 08): la pantalla de la mesa necesita sus rondas con estado. Mismo acceso que la ocupación: el mesero de la mesa o `table.view_all` | doc 08 §2.6, módulo orders | H2 | ⏳ |
| SC-48 | `modifiers_total` (por unidad) = Σ `price_delta` de los modificadores + Σ `price_delta` de los componentes del combo + Σ modificadores de cada componente. `line_total = (unit_price + modifiers_total) × quantity`. El servidor recalcula los totales de las cuentas afectadas en la misma transacción | `orders.service.ts`, `billing/totals.ts`, `shared/domain/billing` | H2 | ⏳ |
| SC-49 | Al unir mesas, los pedidos de la ocupación que se fusiona pasan a la ocupación principal (igual que sus cuentas); la ronda conserva su número original | `floor.service.ts` (merge) | H2 | ⏳ |
| SC-50 | `GET /api/occupancies/:id/bills` (no estaba en el doc 08) devuelve las cuentas con totales calculados por el servidor. En `POST /api/bills/move-items`, `versions` es un mapa `{ billId: version }` de las cuentas origen y destino; si alguna cambió, `409 STALE_VERSION` | doc 08 §2.7, módulo billing | H2 | ⏳ |
| SC-51 | `GET /api/menu` no trae el `id` de los grupos del combo (contrato de catalog, Deniscito), así que el mesero aún no puede vender combos: se ven como "Combo: disponible pronto". El servidor ya acepta combos en `POST /api/orders` | `modules/mesero` (`OrderPage`), `shared/contracts/catalog` | H2 | ⏳ |
| SC-52 | Pedido en el mesero: (1) el borrador se guarda en IndexedDB (`drafts`, Dexie v2) por ocupación y sobrevive a recargar o perder la conexión; (2) toda la ronda va a **una** cuenta, elegida al revisar si hay más de una abierta (repartir ítems es con mover/separar); (3) el pedido va a la estación por defecto de la sucursal o, si no hay, a la de la categoría del primer producto (separar por estación queda para el KDS); (4) los permisos de pedidos y cuentas usan la misma 🔑 de mesas ajenas (`tableAuthorization`, SC-33) | `modules/mesero`, `core/offline/db.ts`, módulos orders y billing | H2 | ⏳ |

## 3. Resueltas

| ID | Pregunta | Respuesta | Fecha | Documentos actualizados |
|---|---|---|---|---|
| PA-055 | Si se cancelan **todos** los ítems de un pedido en `LISTO` (merma), ¿el pedido pasa a `CANCELADO`? | **Sí.** Se agrega `LISTO → CANCELADO` (motivo + 🔑, los ítems quedan como merma). `ENTREGADO` sigue siendo final: los ítems cancelados después de entregar son merma y el pedido queda entregado. Decidió Pablito (dueño de `orders`) | 2026-11-22 | 05 §5.3; `shared/domain/orders` |
| PA-001 | ¿Una línea con cantidad > 1 se puede separar en unidades entre cuentas? | **Sí.** La línea se divide en dos ítems (ej. 2 + 1) y cada uno va a su cuenta | 2026-11-11 | 02 (RF-104), 04 (HU-028), 07 (`split_from_id`), 08 (`/order-items/:id/split`), 09, 14, 17 |
| PA-002 | ¿Cómo se desglosará el IVA? | **No se maneja IVA ni FEL por ahora.** En el MVP solo se captura NIT/CF por cuenta | 2026-11-11 | 01, 02 (RF-271, RF-272, RF-274 → F3), 05, 07 §4.8, 11, 15, 17, 19 |
| PA-003 | ¿Cómo accede el RPA de FEL? | **No se trabaja el RPA ni su API por ahora**; se decide cuando se implemente FEL | 2026-11-11 | 03, 08 §2.13, 15 |
| PA-010 | ¿El mesero puede cobrar en mesa? | **Configurable** por rol (`payment.register`); en la plantilla, **sí** (corregido con S-06) | 2026-11-11 | 03 §4 |
| PA-011 | ¿"Órdenes" cuenta cuentas u ocupaciones? | **Ocupaciones:** una mesa dividida en 3 cuentas = 1 orden | 2026-11-11 | 07 §5, 10, 11, 12, 14 |
| PA-012 | ¿En qué día se refleja una anulación? | **No habrá anulaciones de cuentas.** Las correcciones se hacen reabriendo la cuenta (PA-013) | 2026-11-11 | 01, 02 (RF-068 retirado), 03, 04, 05, 07, 08, 09, 11, 12, 14, 15, 17 |
| PA-013 | ¿Se permite reabrir una cuenta pagada? | **Sí, siempre que se haya pagado en efectivo.** Pasa al MVP (RF-069). Otros métodos: PA-051 | 2026-11-11 | Igual que PA-012 |
| PA-015 | Política de vencimiento de licencia | **Solo lectura** al vencer (después de los días de gracia configurados, que pueden ser 0) | 2026-11-11 | 02 (RF-256) |
| PA-020 | Versiones de Node y Prisma | **Aprobadas:** Node.js 24 LTS, Prisma 7, Fastify 5, Vite 8, React 19 (ADR-012) | 2026-11-11 | 06 (ADR-002, ADR-012), 17 |
| PA-022 | Ubicación del VPS | **EE. UU.** | 2026-11-11 | 09 §2, 13 §1, 15 (R-05) |
| PA-023 | ¿Subdominio de RENGO o dominio propio? | **Lo decide cada cliente**; se soportan los dos | 2026-11-11 | 13 §2 |
| PA-024 | ¿Cómo se define el fondo inicial? | **Configurable por caja:** fijo (el mismo monto diario) o variable (lo escribe el cajero) | 2026-11-11 | 02 (RF-050), 04 (HU-010), 05 paso 1, 07 (`cash_registers`), 14 |
| PA-025 | ¿Conteo obligatorio por denominación en el corte? | **Configurable por caja**; por defecto opcional | 2026-11-11 | 02 (RF-065), 05 paso 13, 07 (`cash_registers`), 14 |
| PA-030 | ¿De quién es la llave del LLM? | **De RENGO** | 2026-11-11 | 10 §2.1, 13 |
| PA-031 | Proveedor y modelo del LLM | El proveedor queda **listo y desacoplado**; **el modelo lo indica RENGO después** (`AI_MODEL` sin valor por defecto) | 2026-11-11 | 10 §2.1, 13 |
| PA-032 | Historial del chatbot | **No se guarda el historial.** Se guardan la pregunta y la consulta interpretada para repetirla; el contexto es un texto mínimo que vive solo durante la sesión | 2026-11-11 | 02 (RF-205), 07 (`ai_queries`), 08, 10 |
| PA-040 | Estado "Por limpiar" | **Configurable**; por defecto no | 2026-11-11 | 04 (HU-044), 07 |
| PA-041 | Producto agotado en un borrador al enviarlo | **Configurable** (bloquear / autorización de gerente / cualquiera confirma); por defecto **cualquiera** puede confirmar | 2026-11-11 | 04 (HU-003), 07, 14 |
| PA-042 | ¿Turno de caja sin conexión? | **No se puede abrir sin conexión; sí se puede cerrar** (corte provisional que se confirma al sincronizar) | 2026-11-11 | 02 (RF-050, RF-065, RF-228), 04 (HU-012), 05, 07, 08, 09, 11, 14, 17 |
| PA-043 | Orden de la comanda | **Configurable**; por defecto el orden del carrito | 2026-11-11 | 07, 11 |
| PA-044 | QR de pre-cuenta en el MVP | **Sí**, simplifica el cobro durante cortes | 2026-11-11 | 09 §6.2 |
| PA-045 | Redondeo del precio sugerido | **Configurable**; por defecto Q 1.00 hacia arriba | 2026-11-11 | 02 (RF-135), 07 |
| PA-046 | Propinas | **Configurable:** el restaurante decide si se registran y a quién le tocan (mesero que atendió, todos los meseros o el establecimiento) | 2026-11-11 | 02 (RF-025), 05, 07, 12 (RPT-033), 14 |
| PA-048 | ¿El cliente puede cambiar los colores? | **Solo `primary`**, con validación de contraste. RENGO quiere varios temas: propuesta en doc 18 §8 (PA-053) | 2026-11-11 | 07, 17, 18, 19 |
| PA-049 | Botones destructivos y blanco | (a) Texto grande en negrita, sin color nuevo; (b) se acepta el blanco | 2026-11-11 | 18 |
| PA-050 | Modo oscuro del KDS | **Sin modo oscuro** | 2026-11-11 | 02 (RNF-061), 18 |
| PA-051 | ¿Cómo se corrige una cuenta pagada con tarjeta u otro método? | **No se corrige en el sistema.** Sin anulaciones y con reapertura solo para cuentas pagadas en efectivo | 2026-11-11 | 02 (RF-069), 04 (HU-043), 05, 08, 14 |
| PA-047 | ¿Quién es la Persona 1 y quién la Persona 2? | **Persona 1 (Sala y caja) = Pablito · Persona 2 (Cocina y gestión) = Deniscito.** Con la asignación se dan por aprobados el reparto por módulos y la estructura de carpetas | 2026-11-12 | 17, CLAUDE.md |
| PA-052 | ¿A qué turno va el efectivo que cobra el mesero? | **Al turno abierto de la caja principal** de la sucursal; el mesero entrega el efectivo al cajero y RPT-034 muestra cuánto entrega cada uno. Sin turno abierto en la caja principal, el mesero no cobra en efectivo | 2026-11-12 | 03, 05, 07 (`cash_registers.is_main`, `payments.received_by`), 09, 12 (RPT-034), 14, 15 |
| PA-053 | ¿Qué temas además de Botanical Graphite? | **5 temas** entregados por RENGO; asignación de tokens y contraste en doc 18 §8.4. Tonos derivados: PA-054 | 2026-11-12 | 18, 17 |
| PA-054 | ¿Se aprueban los tonos derivados de los temas adicionales? | **Aprobados:** Tema 1 `secondary` `#A3245C`, Tema 2 `background` `#F7F6EE`, Tema 4 `primary` `#3F4270` y `surface` `#ECECF4`, Tema 5 `surface` `#E4ECF6` | 2026-11-12 | 18 §2, §8.4, 17 |
| PA-014 | Planes comerciales y módulos por plan (precios, límites de dispositivos, IA incluida) | **Aprobado sin valores:** RENGO define los planes después; la tabla `license` ya permite cualquier combinación y no bloquea el desarrollo | 2026-11-12 | 07 `license`, 16 |
| PA-031b | Modelo del LLM (`AI_MODEL`) | **Aprobado sin valor:** el proveedor queda desacoplado y RENGO indica el modelo antes de la Fase 2 (sin valor por defecto) | 2026-11-12 | 10 §2.1 |
