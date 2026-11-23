# 08 — Especificación de API REST y eventos en tiempo real

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio**. Registra cada cambio en el [Control de cambios](README.md#control-de-cambios).

## 1. Convenciones generales

| Aspecto | Regla |
|---|---|
| Base | `https://<dominio-del-cliente>/api` — el frontend usa **URL relativa** `/api/...` |
| Formato | JSON, `camelCase`. Montos como **string decimal** (`"203.50"`) para evitar errores de coma flotante |
| Fechas | ISO 8601 en UTC (`2026-11-11T18:04:00Z`); el frontend convierte a la zona de la sucursal |
| Autenticación | `Authorization: Bearer <accessToken>` + cabecera `X-Device-Id` |
| Sucursal | `X-Branch-Id` (validada contra las sucursales del usuario) |
| Idempotencia | Toda operación que crea o cambia estado operativo acepta `Idempotency-Key` (obligatoria para dispositivos de servicio). Repetir la misma clave devuelve la misma respuesta (mismo código y cuerpo, con la cabecera `Idempotent-Replay: true`). **Implementado en H1** (módulo `sync`): aplica a peticiones con sesión; la clave tiene de 16 a 64 caracteres `[0-9A-Za-z_-]` (`400 VALIDATION_ERROR` si no); se guardan las respuestas `2xx` (`APLICADA`) y `400/403/404/409/423` (`RECHAZADA`); no se guardan `401`, `402`, `426`, `429` ni `5xx`, que el dispositivo reintenta con la misma clave. Una clave usada por otro dispositivo o en otra ruta → `400 VALIDATION_ERROR` (SC-35) |
| Concurrencia | Recursos con `version`; las modificaciones envían `If-Match: <version>` o `version` en el cuerpo → `409 STALE_VERSION` si cambió |
| Validación | Zod en cada ruta; error `400 VALIDATION_ERROR` con `details[]` |
| Paginación | `?limit=50&cursor=<id>`; máximo 200 |
| Listas | **Nunca** incluyen columnas pesadas (imágenes, archivos, textos largos) |
| Versión | `X-App-Version` del frontend; si es menor a la mínima soportada → `426 UPGRADE_REQUIRED` |

### Formato de error
```json
{ "error": { "code": "TABLE_OCCUPIED", "message": "La mesa 5 ya fue abierta por Luis", "details": {} } }
```

| HTTP | Códigos |
|---|---|
| 400 | `VALIDATION_ERROR`, `MODIFIER_RULES`, `PAYMENT_INSUFFICIENT`, `CHANGE_NOT_ALLOWED` |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `PIN_INVALID` |
| 402 | `LICENSE_SUSPENDED`, `LICENSE_READ_ONLY` |
| 403 | `FORBIDDEN`, `AUTHORIZATION_REQUIRED` (pide 🔑), `MODULE_DISABLED`, `BRANCH_FORBIDDEN`, `DEVICE_REVOKED` |
| 404 | `NOT_FOUND` |
| 409 | `STALE_VERSION`, `TABLE_OCCUPIED`, `SHIFT_ALREADY_OPEN`, `BILL_PAID`, `ITEM_ALREADY_ASSIGNED`, `PRODUCT_SOLD_OUT`, `CONFLICT_REGISTERED`, `REOPEN_NOT_ALLOWED`, `SPLIT_NOT_ALLOWED`, `USERNAME_TAKEN`, `LAST_ADMIN`, `ROLE_NAME_TAKEN`, `ROLE_IN_USE` (no puede quedar sin nadie activo que administre usuarios) |
| 423 | `ACCOUNT_LOCKED` |
| 426 | `UPGRADE_REQUIRED` |
| 429 | `RATE_LIMITED`, `AI_QUOTA_EXCEEDED` |
| 500 | `INTERNAL_ERROR` (error inesperado; el mensaje es genérico y el detalle solo va al log) |

### Autorización 🔑 en la misma petición
Si la acción requiere un permiso que el usuario no tiene, el servidor responde `403 AUTHORIZATION_REQUIRED` con el permiso necesario. El frontend pide el PIN de otro usuario y repite la petición con:
```json
{ "authorization": { "userId": "01J...", "pin": "4821" } }
```
(El PIN viaja solo por HTTPS, nunca se guarda en logs.) Las rutas de mesas, pedidos y cuentas aceptan `authorization` también cuando el usuario tiene el permiso de la ruta pero la mesa es de otro mesero: la 🔑 se valida contra `table.view_all` (SC-33).

## 2. Endpoints

### 2.1 Sistema
| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| GET | `/api/health` | `{ "status": "ok", "uptime": 12345 }`. `status = "degraded"` si la base no responde en 2 s | Público |
| GET | `/api/config/public` | Nombre, logo (URL), colores, textos, regionales, módulos activos, `settingsVersion`, versión mínima del frontend | Público |
| GET | `/api/time` | Hora del servidor (para corregir el reloj del dispositivo) | Público |

### 2.2 Autenticación y dispositivos
| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| POST | `/api/devices/pairing-codes` | Genera código de emparejamiento (6 dígitos, 10 min) | `config.devices` |
| POST | `/api/devices/pair` | `{ code, name, type }` → `{ deviceId, deviceToken, offlinePrefix }` | Código válido |
| POST | `/api/auth/login` | `{ username, password }` → `{ accessToken, refreshToken, user, permissions, branches }` | Dispositivo |
| POST | `/api/auth/pin` | `{ userId, pin }` en dispositivo registrado | Dispositivo |
| GET | `/api/auth/device-users` | Usuarios activos con PIN de la sucursal del dispositivo `[{ id, fullName }]`, para elegir antes del PIN (SC-07). Con `?permission=<código>` solo quienes tienen ese permiso: la ventana 🔑 lista así a quienes pueden autorizar (SC-40) | Dispositivo |
| POST | `/api/auth/refresh` | Rota el refresh token | — |
| POST | `/api/auth/logout` | Revoca la sesión | Autenticado |
| GET | `/api/auth/pin-cache` | Hashes de PIN de usuarios de la sucursal con permisos de autorización (para validar 🔑 offline; ver doc 09) | Dispositivo de caja/gerente |
| DELETE | `/api/devices/:id` | Revoca dispositivo | `config.devices` |

**"Dispositivo"** = cabeceras `X-Device-Id` + `X-Device-Token` (el `deviceToken` que entregó `/api/devices/pair`, SC-01). El primer dispositivo de un cliente se empareja con un código generado en el servidor: `pnpm --filter @mise/backend pairing-code` (SC-14). `POST /api/devices/pair`, login, PIN y refresh tienen límite de intentos por IP (SC-09).

### 2.3 Configuración
| Método | Ruta | Permiso |
|---|---|---|
| GET/PUT | `/api/config/settings` | `config.restaurant` |
| POST | `/api/config/logo` (multipart) | `config.restaurant` |
| GET/POST/PUT | `/api/branches`, `/api/branches/:id` | `config.restaurant` |
| GET | `/api/branches/:id/ticket-templates` | Las 5 plantillas de la sucursal `[{ docType, header, footer, showLogo, paperWidth }]`: cualquier sesión, porque el mesero y la caja imprimen con ellas (H3 #21, SC-66) | Sesión |
| PUT | `/api/branches/:id/ticket-templates/:docType` | Editar una plantilla | `config.restaurant` |
| GET/POST/PUT | `/api/service-periods` | `config.restaurant` |
| GET | `/api/reasons?type=` | Motivos activos `[{ id, type, name, sort }]` para elegir al cancelar un ítem, reabrir, etc. (2026-11-23) | Sesión |
| GET | `/api/reasons?all=true[&type=]` | Todos los motivos, también los inactivos (`active`), para administrarlos (H3 #21) | `config.payments`; con solo `config.discounts`, solo los de `DISCOUNT` |
| POST/PUT | `/api/reasons[/:id]` | Crear y editar motivos (SC-63) | `config.payments`; los de `DISCOUNT` también `config.discounts` |
| GET | `/api/payment-methods` | Métodos activos para cobrar (cualquier sesión); con `?all=true`, todos con `active` y `sort` | Sesión; `?all=true` pide `config.payments` |
| POST/PUT | `/api/payment-methods[/:id]` | Crear y editar métodos de pago (SC-63) | `config.payments` |
| GET/POST/PUT | `/api/users`, `/api/users/:id`, `POST /api/users/:id/pin` | `config.users` |
| GET/POST/PUT/DELETE | `/api/roles`, `/api/roles/:id` | `config.roles` (`GET` también con `config.users` o `config.discounts`) |
| PUT | `/api/roles/:id/discount-limits` | `config.discounts` (S-05) |
| GET | `/api/permissions` (catálogo) | `config.roles`, `config.users` o `config.discounts` |
| GET | `/api/devices` | Dispositivos de la sucursal del que pregunta `[{ id, name, type, platform, appVersion, lastSeenAt, createdAt, revokedAt, current }]` (H3 #21) | `config.devices` |
| PUT | `/api/devices/:id` | Cambiar el nombre `{ name }` (auditoría `device.rename`) | `config.devices` |
| DELETE | `/api/devices/:id` | Revocar: cierra sus sesiones y ya no entra; no se revoca el dispositivo que hace la petición (400, SC-65) | `config.devices` |
| ~~GET/POST/PUT~~ | ~~`/api/printers`, `/api/devices/:id/printer-routes`~~ | **No se hacen:** con ADR-003 actualizado (2026-11-23) se imprime con el diálogo del sistema y no se configuran impresoras en Mise | — |
| GET | `/api/license` | `config.restaurant` |
| GET | `/api/config/logo?v=<settingsVersion>` | Público; WebP con caché de un año (SC-19) |
| GET | `/api/bootstrap?since=<settingsVersion>` | Paquete para offline: configuración, menú (sin imágenes), mesas, roles, métodos, motivos, plantillas | Autenticado |

**Usuarios (H3 #21, 2026-11-23, SC-61):**
- `GET /api/users` → `[{ id, fullName, username, email, active, hasPin, locked, roleIds, branchIds, lastLoginAt }]` (activos e inactivos). Nunca trae contraseña ni PIN.
- `POST /api/users` `{ id, fullName, username, email?, password, pin?, roleIds, branchIds }` → 201 (200 si el `id` ya existía: idempotente). `username` se guarda en minúsculas (3–40 letras, números, `.`, `_`, `-`); contraseña ≥ 10; PIN de 4 a 6 dígitos. Usuario repetido → 409 `USERNAME_TAKEN`.
- `PUT /api/users/:id` `{ fullName, email?, active, roleIds, branchIds, password?, unlock? }`: sin `password` no se cambia; cambiar la contraseña o `unlock: true` quita el bloqueo por intentos. Desactivar o cambiar la contraseña cierra sus sesiones. No puedes desactivarte a ti mismo (400). Si nadie activo quedaría con `config.users` → 409 `LAST_ADMIN`.
- `POST /api/users/:id/pin` `{ pin }` pone o cambia el PIN; `{ pin: null }` lo quita.
- `GET /api/roles` → `[{ id, name, description, isSystem, permissions, maxDiscountPct, maxDiscountAmount, userCount }]`.
- Todo cambio queda en auditoría (`user.create`, `user.update`, `user.pin_set`, `user.pin_removed`) sin secretos.
- Nadie da ni toca permisos que no tiene: asignar un rol con permisos que tú no tienes, o editar o poner PIN a un usuario con permisos que tú no tienes → 403 `FORBIDDEN` con `details.missing` (SC-61). Con 🔑 cuentan también los permisos de quien autoriza.

**Métodos de pago y motivos (H3 #21, 2026-11-23, SC-63):**
- `POST /api/payment-methods` `{ id, name, kind, givesChange?, requiresReference?, sort? }` → 201 (200 si el `id` ya existía). `PUT /api/payment-methods/:id` `{ name, givesChange, requiresReference, active, sort }`: el `kind` no cambia. Solo `CASH` puede dar cambio (en otro tipo `givesChange` queda en `false`). Nombre repetido → 400. No se desactiva el último método activo (400).
- `POST /api/reasons` `{ id, type, name, sort? }` → 201 (al final de su tipo si no trae `sort`). `PUT /api/reasons/:id` `{ name, active, sort }`: el `type` no cambia; nombre repetido dentro del tipo → 400; no se desactiva el último motivo activo de un tipo (400).
- Auditoría: `config.payment_method.create/update`, `config.reason.create/update` (solo los campos que cambiaron).

**Roles y permisos (H3 #21, 2026-11-23, SC-62):**
- `GET /api/permissions` → `[{ code, description }]`: el catálogo del producto (Docs/03 §3), el mismo de `templates/seed/permissions.json` (en código: `PERMISSIONS` de `shared/contracts/auth`).
- `POST /api/roles` `{ id, name, description?, permissions }` → 201 (200 si el `id` ya existía). `PUT /api/roles/:id` `{ name, description?, permissions }` reemplaza los permisos. Nombre repetido (sin importar mayúsculas) → 409 `ROLE_NAME_TAKEN`; código fuera del catálogo → 400. El rol de sistema (Administrador) no se renombra. Si nadie activo quedaría con `config.users` o `config.roles` → 409 `LAST_ADMIN` (`details.permission`).
- `DELETE /api/roles/:id` → 204. No se borra el rol de sistema (400) ni uno que tenga usuarios (409 `ROLE_IN_USE`).
- `PUT /api/roles/:id/discount-limits` `{ maxDiscountPct, maxDiscountAmount }` (`config.discounts`, S-05): porcentaje de 0 a 100; `null` = sin tope en esa medida.
- Los permisos van en el token de acceso: un cambio de rol se aplica cuando la sesión se renueva (≤ 15 min) o al volver a entrar.
- Auditoría: `role.create`, `role.update`, `role.delete`, `role.discount_limits`.

### 2.4 Menú
| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| GET | `/api/menu` | Categorías + productos + grupos de modificadores + combos (sin imágenes; con `imageUrl` versionada) | Autenticado |
| POST/PUT | `/api/categories[/:id]` | | `config.menu` |
| POST/PUT | `/api/products[/:id]` | | `config.menu` |
| PATCH | `/api/products/:id/status` | `{ status: "SOLD_OUT" }` | `menu.toggle_soldout` |
| POST | `/api/products/:id/image` (multipart) | Sube y redimensiona | `config.menu` |
| GET | `/api/products/:id/image?v=<updatedAt>` | Imagen WebP, `Cache-Control: public, max-age=31536000, immutable`, `ETag` | Público |
| POST/PUT | `/api/modifier-groups[/:id]`, `/api/modifiers[/:id]` | El grupo lleva `categoryIds` (una o más categorías donde se usa); `GET /api/menu` lo devuelve en cada grupo. Un producto con un grupo que no está en su categoría → `400 VALIDATION_ERROR` | `config.menu` |
| POST/PUT | `/api/products/:id/combo-groups` | | `config.menu` |
| POST | `/api/menu/import` (CSV/XLSX) · GET `/api/menu/export` | F2 | `config.menu` |

### 2.5 Mesas y ocupaciones
| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| GET | `/api/floor` | Zonas activas con sus mesas activas y el resumen de la ocupación abierta (sin ítems). Una mesa `UNIDA` trae `joinedTo` ("Unida a 5") y la ocupación de la mesa principal. Cada mesa ocupada trae `service`: `LISTA` (pedido listo para entregar), `EN_COCINA` (pedidos en cocina) o `PRECUENTA` (pre-cuenta impresa), en ese orden de prioridad (hecho 2026-11-23). `kitchenDisplay`: la sucursal tiene un dispositivo de Cocina activo; sin él, el mesero entrega desde la cola (SC-60) | Autenticado |
| GET | `/api/zones` | Todas las zonas de la sucursal, también las inactivas | `config.tables` |
| POST/PUT | `/api/zones[/:id]` | `{ name, sort?, active? }` | `config.tables` |
| POST | `/api/tables` | `{ zoneId, name, capacity, shape?, posX?, posY?, width?, height? }` | `config.tables` |
| PUT | `/api/tables/:id` | Mismos campos opcionales + `blocked?` (bloquear/desbloquear), `active?` (dar de baja) y `version` → `409 STALE_VERSION` si cambió (SC-31) | `config.tables` |
| POST | `/api/occupancies` | `{ id, billId?, tableId?, orderTypeCode, guests, waiterId?, customerName?, customerPhone?, authorization? }` → crea ocupación + Cuenta 1 (`201`). Reenviar el mismo `id` responde `200` con la misma ocupación (SC-28, SC-29). Contrato v1: `shared/contracts/floor` | `table.open` |
| GET | `/api/occupancies?status=ABIERTA` | Ocupaciones abiertas de la sucursal | Autenticado |
| GET | `/api/occupancies/:id` | Detalle con pedidos, ítems, cuentas y pagos (en H1 solo cuentas; pedidos en H2, pagos en H3) | Mesero dueño o `table.view_all` |
| POST | `/api/occupancies/:id/merge` | `{ sourceOccupancyId, authorization? }` — une la mesa de `sourceOccupancyId` a la de `:id`: sus cuentas pasan a `:id` ("Cuenta 1 · Mesa 6"), se suman los comensales, la origen queda `FUSIONADA` y su mesa `UNIDA` (SC-34) | `table.merge` |
| POST | `/api/occupancies/:id/move` | `{ targetTableId, authorization? }` — a una mesa `LIBRE`; la anterior queda `LIBRE` y la bitácora guarda las dos (`409 TABLE_OCCUPIED` si no está libre) | `table.move` |
| POST | `/api/occupancies/:id/transfer` | `{ waiterId, authorization? }` — el mesero debe estar activo en la sucursal; queda en la bitácora | `table.transfer_waiter` |
| PATCH | `/api/occupancies/:id` | `{ guests, version, authorization? }` — con 🔑 de quien tenga `table.view_all`, cambia la mesa de otro mesero (SC-33) | Mesero dueño, `table.view_all` o 🔑 |

### 2.6 Pedidos y KDS
| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| POST | `/api/orders` | Envía ronda: `{ id, occupancyId, tempFolio?, clientSentAt, items:[{ id, billId, productId, quantity, unitPrice, modifiers:[{ modifierId, priceDelta }], components:[{ comboGroupId, productId, priceDelta, modifiers }], note }] }` → `{ id, folio, roundNumber, items }`. `unitPrice` y `priceDelta` son el precio que vio el mesero al vender; el servidor los respeta (doc 09 §6.3). Contrato v1: `shared/contracts/orders` | `order.create` |
| GET | `/api/occupancies/:id/orders` | Rondas de la ocupación con sus ítems, en orden de ronda (pantalla de la mesa; SC-47) | Mesero de la mesa o `table.view_all` |
| GET | `/api/kds/orders?status=ENVIADO,EN_PREPARACION,LISTO` | Cola FIFO de la sucursal: cada pedido con `table` ("5 · Salón" o null), `orderTypeCode`, `customerName`, `waiterId`, `waiterName`, `guests` (contrato `shared/contracts/kitchen`). Hecho 2026-11-23 | `kds.operate` |
| POST | `/api/orders/:id/accept` | Marca `accepted_at` (idempotente: conserva la primera) | `kds.operate` |
| POST | `/api/orders/:id/ready` | Pedido completo listo | `kds.operate` |
| POST | `/api/order-items/:id/ready` | Ítem listo | `kds.operate` |
| POST | `/api/orders/:id/recall` | Listo → En preparación | `kds.recall` |
| POST | `/api/orders/:id/deliver` | Marca entregado. Desde `LISTO`; si la sucursal no tiene pantalla de cocina, también desde `ENVIADO` o `EN_PREPARACION` (SC-60) | `order.deliver` |
| POST | `/api/order-items/:id/cancel` | `{ reasonId, note?, authorization? }` | `order.cancel_sent` |
| POST | `/api/orders/:id/printed` | Confirma impresión de comanda `{ deviceId, printerId }` | Dispositivo |
| POST | `/api/orders/:id/reprint` | Delegar reimpresión al hub | `bill.reprint` |

### 2.7 Cuentas, descuentos y pagos
| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| GET | `/api/occupancies/:id/bills` | Cuentas de la ocupación (sin las `ELIMINADA`) con sus totales (SC-50) | Mesero de la mesa o `table.view_all` |
| POST | `/api/occupancies/:id/bills` | `{ id, name }` crea cuenta | `bill.split` |
| PATCH | `/api/bills/:id` | `{ name, customerNit, customerTaxName, version }` | `bill.split` |
| POST | `/api/bills/move-items` | `{ itemIds:[], targetBillId, versions }` — `versions` es `{ itemId: version }` de cada ítem que se mueve (así lo implementa el servidor; corregido el 2026-11-23); `409 STALE_VERSION` si alguno cambió (SC-50) → `{ bills }` | `bill.split` |
| POST | `/api/order-items/:id/split` | `{ newItemId, quantity, targetBillId?, version }` — separa `quantity` unidades en un ítem nuevo (RF-104) y, si se indica, lo pasa a otra cuenta. `409` si el ítem tiene descuento de ítem o está en una cuenta pagada | `bill.split` |
| POST | `/api/bills/:id/precheck` | Pasa la cuenta a PRECUENTA, entrega los pedidos listos de esa cuenta (S-09) y devuelve `{ bill, items, tipPct, tipAmount, totalWithTip, reprint }` para imprimir. Reimprimir pide `bill.reprint` o 🔑 (hecho 2026-11-23, SC-55) | `bill.print_precheck` |
| GET/POST | `/api/bills/:id/discounts` | POST `{ id, target: "BILL"|"ITEM", itemId?, kind, value, reasonId, authorization? }` → `{ bill, discounts }`. Por encima del tope del rol pide `discount.apply_unlimited` o 🔑 (hecho 2026-11-23, SC-58) | `discount.apply` |
| DELETE | `/api/discounts/:id` | Quita descuento (registrado en bitácora) | `discount.apply` |
| POST | `/api/bills/:id/pay` | `{ tipAmount, payments:[{ id, methodId, amount, tendered?, reference? }], cashRegisterId, version }` → cuenta pagada, cambio, datos del recibo | `payment.register` |
| POST | `/api/bills/:id/reopen` | `{ reasonId, note, authorization?, version }` — **solo en línea**. Rechaza con `409 REOPEN_NOT_ALLOWED` si algún pago no fue en efectivo (PA-051) o si el cobro es de otro día de negocio. Se puede reabrir desde otro turno (S-28) y sin importar si la mesa está ocupada (S-29); requiere un turno **abierto** en la caja que reabre, donde se registra el movimiento `REVERSO_REAPERTURA` (RF-069). No existe `/void` (PA-012) | `bill.reopen` |
| GET | `/api/bills/:id/receipt` | Datos para reimprimir recibo | `bill.reprint` |

### 2.8 Caja
| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| GET | `/api/cash-registers` | Cajas activas de la sucursal y turno abierto (con `countByDenomination`). Con `?all=true`, también las inactivas | Autenticado; `?all=true` pide `config.restaurant` |
| POST | `/api/cash-registers` | Crear caja en la sucursal del dispositivo `{ id, name, openingFloatMode, openingFloatAmount, countByDenomination, isMain }` → 201 (200 si el `id` ya existía). La primera de la sucursal es la principal (SC-64) | `config.restaurant` |
| PUT | `/api/cash-registers/:id` | Editar `{ name, openingFloatMode, openingFloatAmount, countByDenomination, isMain, active }`. Marcar `isMain` se la quita a la otra; la principal no se desmarca ni se desactiva; no se desactiva con turno abierto (400). Auditoría `cash.register.create/update` | `config.restaurant` |
| POST | `/api/shifts` | `{ id, cashRegisterId, openingFloat, counts? }` — **solo en línea** (PA-042); no se acepta por `sync/push` | `cash.open_shift` |
| GET | `/api/shifts/:id` | Resumen (el esperado solo con `cash.view_expected`) | `cash.open_shift` |
| POST | `/api/shifts/:id/movements` | `{ id, type, amount, reasonId, note, authorization? }` → el turno con sus movimientos; cada uno trae `userName` y `authorizedByName` (quien dio la 🔑) para el comprobante (doc 11 §4.5) | `cash.movement` |
| POST | `/api/shifts/:id/start-close` | Pasa a `EN_CORTE`; rechaza si hay operaciones de esa caja sin sincronizar | `cash.close_shift` |
| POST | `/api/shifts/:id/close` | `{ countedCash, counts?, comment?, provisional?: { expectedCash, closedAt } }` → reporte de corte. Si llega por `sync/push` con `provisional` (corte hecho sin conexión), el servidor recalcula el esperado con todas las operaciones, cierra el turno y, si difiere, crea el conflicto `CORTE_DIFERENTE` | `cash.close_shift` |
| POST | `/api/cash-registers/:id/open-drawer` | Registro de apertura sin venta | `cash.open_drawer` |

### 2.9 Recetas y costeo
| Método | Ruta | Permiso |
|---|---|---|
| GET/POST/PUT | `/api/units`, `/api/ingredients[/:id]` | `config.recipes` |
| POST | `/api/ingredients/:id/cost` → devuelve productos afectados | `config.recipes` |
| GET/PUT | `/api/recipes/:id`, `/api/products/:id/recipe`, `/api/modifiers/:id/recipe` | `config.recipes` |
| GET/PUT | `/api/cost-targets` | `config.recipes` |
| GET | `/api/costing/products?belowTarget=true` | Costo, precio sugerido, precio asignado, margen real, alerta | `config.recipes` |

### 2.10 Dashboard y reportes
| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| GET | `/api/dashboard/today?branchId=` | Indicadores del día + comparación | `dashboard.view_own` / `view_all` |
| GET | `/api/reports` | Catálogo de reportes disponibles para el usuario | `reports.view` |
| GET | `/api/reports/:code?from&to&branchId&groupBy&...` | Ejecuta el reporte (ver doc 12) | `reports.view` (+ `reports.financial` si aplica) |
| GET | `/api/reports/:code/export?format=csv|xlsx|pdf` | Archivo descargable (streaming) | `reports.export` |
| GET | `/api/audit-log?entity&entityId&userId&from&to` | Bitácora | `reports.audit` |

### 2.11 Sincronización (modo sin internet)
| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| POST | `/api/sync/push` | Lote ordenado de operaciones de la outbox (ver doc 09 §5) → resultado por operación | Dispositivo |
| GET | `/api/sync/pull?sinceSeq=` | Cambios desde el último `seq` (ocupaciones, pedidos, cuentas, estado de menú) | Dispositivo |
| POST | `/api/sync/connectivity-logs` | Registro de cortes de conexión | Dispositivo |
| GET | `/api/sync/conflicts?status=ABIERTO` | Conflictos | `sync.resolve_conflicts` |
| POST | `/api/sync/conflicts/:id/resolve` | `{ resolution, note }` | `sync.resolve_conflicts` |

### 2.12 Chatbot de IA
| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| POST | `/api/ai/chat` | `{ message, context: [{role, content}] (máx. 6, solo de la sesión; el servidor no guarda la conversación, PA-032), branchId? }` → `429 AI_QUOTA_EXCEEDED` al llegar a 100 preguntas al mes; si no, `{ answer, table?, chart?, query, reportLink }` | `ai.chat` + módulo `ai` |
| GET | `/api/ai/usage` | Preguntas usadas / límite del mes y costo | `ai.chat` (solo conteo) · `config.restaurant` (costo) |
| GET | `/api/ai/queries` | Consultas recientes del usuario (pregunta + consulta interpretada, sin respuestas) | `ai.chat` |
| POST | `/api/ai/queries/:id/run` | Vuelve a ejecutar la consulta guardada con datos actuales, sin LLM | `ai.chat` |

### 2.13 Extensión FEL
No hay endpoints de FEL en el MVP (PA-002, PA-003). Se reserva el prefijo `/api/fel/` para cuando se implemente.

## 3. Tiempo real (Socket.IO)

> **Hecho (2026-11-23):** servidor (`backend/src/modules/realtime`, `app.realtime.publish` y `announce`) y cliente (`frontend/src/core/realtime`). Todos los eventos llegan por el canal `event` con el sobre de abajo. Ya se emiten `occupancy.*`, `order.sent`, `order.delivered`, `order.item_cancelled` y `bill.updated`; los de cocina llegan con `kitchen`. Contrato en `shared/contracts/realtime`.

**Conexión:** `io("/", { path: "/socket.io", auth: { token, deviceId, lastSeq } })`. El servidor une el socket a las salas según usuario, rol, sucursal y dispositivo.

| Sala | Miembros |
|---|---|
| `branch:<id>` | Todos los dispositivos de la sucursal |
| `branch:<id>:kds` | KDS (y en el futuro `station:<id>`) |
| `branch:<id>:cash` | Cajas |
| `user:<id>` | Dispositivos del usuario (avisos al mesero) |
| `device:<id>` | Un dispositivo (impresión delegada, revocación) |

**Sobre de evento:** `{ "seq": 10452, "event": "order.sent", "at": "...", "branchId": "...", "data": { ... } }`

### 3.1 Eventos servidor → cliente
| Evento | Sala | Datos | Efecto en el cliente |
|---|---|---|---|
| `order.sent` | `:kds`, `branch` | pedido completo con ítems | KDS: sonido + tarjeta al final; sala: estado de mesa |
| `order.accepted` | `branch`, `user:<mesero>` | id, acceptedAt | Estado "En preparación" |
| `order.item_ready` | `:kds`, `user:<mesero>` | itemId | Tachado en KDS |
| `order.ready` | `user:<mesero>`, `:cash`, `branch` | id, mesa, folio | **Sonido + vibración** al mesero, banner |
| `order.recalled` | `user:<mesero>`, `branch` | id | Quita banner |
| `order.delivered` | `branch` | id | |
| `order.item_cancelled` | `:kds`, `branch` | itemId, reason | KDS: ítem tachado "CANCELADO" |
| `occupancy.opened` / `.updated` / `.closed` / `.merged` / `.moved` / `.transferred` | `branch` | resumen | Actualiza mapa de mesas |
| `bill.updated` / `bill.paid` / `bill.reopened` | `branch` | resumen | Totales y estado |
| `menu.product_status` | `branch` | productId, status | Agotado/disponible |
| `menu.changed` / `config.changed` | `branch` | settingsVersion | Recargar `/api/bootstrap` |
| `print.request` | `device:<hub>` | docType, payload | El hub imprime (transporte delegado) |
| `shift.opened` / `shift.closed` | `:cash` | | |
| `sync.conflict_created` | `user:<gerentes>` | conflicto | Aviso al gerente |
| `device.revoked` | `device:<id>` | | Cierra sesión |
| `resync.required` | `device:<id>` | | Recarga estado completo (cuando `lastSeq` es muy viejo) |

### 3.2 Eventos cliente → servidor
| Evento | Uso |
|---|---|
| `presence.ping` | Latido de la app (además del ping de Socket.IO) con `pendingOps` y `appVersion` |
| `kds.ack` | El KDS confirma que mostró el pedido (para medir latencia RNF-020) |

Las **acciones** (aceptar, listo, pagar...) van siempre por REST (idempotentes y auditables), no por socket.

### 3.3 Reconexión
1. Socket.IO reconecta con espera exponencial 1 s → 30 s con variación aleatoria.
2. Al reconectar, envía `lastSeq`. Si `lastSeq` está dentro de la retención (24 h y < 5 000 eventos), el servidor reenvía los eventos perdidos; si no, emite `resync.required`.
3. Tras reconectar, el cliente vacía la outbox (`/api/sync/push`) **antes** de aplicar los eventos del servidor.
