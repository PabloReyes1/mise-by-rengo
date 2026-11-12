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
| Idempotencia | Toda operación que crea o cambia estado operativo acepta `Idempotency-Key` (obligatoria para dispositivos de servicio). Repetir la misma clave devuelve la misma respuesta |
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
| 409 | `STALE_VERSION`, `TABLE_OCCUPIED`, `SHIFT_ALREADY_OPEN`, `BILL_PAID`, `ITEM_ALREADY_ASSIGNED`, `PRODUCT_SOLD_OUT`, `CONFLICT_REGISTERED`, `REOPEN_NOT_ALLOWED`, `SPLIT_NOT_ALLOWED` |
| 423 | `ACCOUNT_LOCKED` |
| 426 | `UPGRADE_REQUIRED` |
| 429 | `RATE_LIMITED`, `AI_QUOTA_EXCEEDED` |

### Autorización 🔑 en la misma petición
Si la acción requiere un permiso que el usuario no tiene, el servidor responde `403 AUTHORIZATION_REQUIRED` con el permiso necesario. El frontend pide el PIN de otro usuario y repite la petición con:
```json
{ "authorization": { "userId": "01J...", "pin": "4821" } }
```
(El PIN viaja solo por HTTPS, nunca se guarda en logs.)

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
| POST | `/api/auth/refresh` | Rota el refresh token | — |
| POST | `/api/auth/logout` | Revoca la sesión | Autenticado |
| GET | `/api/auth/pin-cache` | Hashes de PIN de usuarios de la sucursal con permisos de autorización (para validar 🔑 offline; ver doc 09) | Dispositivo de caja/gerente |
| DELETE | `/api/devices/:id` | Revoca dispositivo | `config.devices` |

### 2.3 Configuración
| Método | Ruta | Permiso |
|---|---|---|
| GET/PUT | `/api/config/settings` | `config.restaurant` |
| POST | `/api/config/logo` (multipart) | `config.restaurant` |
| GET/POST/PUT | `/api/branches`, `/api/branches/:id` | `config.restaurant` |
| GET/PUT | `/api/branches/:id/ticket-templates/:docType` | `config.restaurant` |
| GET/POST/PUT | `/api/service-periods` | `config.restaurant` |
| GET/POST/PUT | `/api/reasons?type=` | `config.payments` |
| GET/POST/PUT | `/api/payment-methods` | `config.payments` |
| GET/POST/PUT | `/api/users`, `/api/users/:id`, `POST /api/users/:id/pin` | `config.users` |
| GET/POST/PUT | `/api/roles`, `/api/roles/:id` | `config.roles` |
| GET | `/api/permissions` (catálogo) | `config.roles` |
| GET/POST/PUT | `/api/devices`, `/api/printers`, `/api/devices/:id/printer-routes` | `config.devices` |
| GET | `/api/license` | `config.restaurant` |
| GET | `/api/bootstrap?since=<settingsVersion>` | Paquete para offline: configuración, menú (sin imágenes), mesas, roles, métodos, motivos, plantillas | Autenticado |

### 2.4 Menú
| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| GET | `/api/menu` | Categorías + productos + grupos de modificadores + combos (sin imágenes; con `imageUrl` versionada) | Autenticado |
| POST/PUT | `/api/categories[/:id]` | | `config.menu` |
| POST/PUT | `/api/products[/:id]` | | `config.menu` |
| PATCH | `/api/products/:id/status` | `{ status: "SOLD_OUT" }` | `menu.toggle_soldout` |
| POST | `/api/products/:id/image` (multipart) | Sube y redimensiona | `config.menu` |
| GET | `/api/products/:id/image?v=<updatedAt>` | Imagen WebP, `Cache-Control: public, max-age=31536000, immutable`, `ETag` | Público |
| POST/PUT | `/api/modifier-groups[/:id]`, `/api/modifiers[/:id]` | | `config.menu` |
| POST/PUT | `/api/products/:id/combo-groups` | | `config.menu` |
| POST | `/api/menu/import` (CSV/XLSX) · GET `/api/menu/export` | F2 | `config.menu` |

### 2.5 Mesas y ocupaciones
| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| GET | `/api/floor` | Zonas, mesas con estado derivado y resumen de ocupación (sin ítems) | Autenticado |
| POST/PUT | `/api/zones[/:id]`, `/api/tables[/:id]` | | `config.tables` |
| POST | `/api/occupancies` | `{ id, tableId?, orderTypeCode, guests, waiterId?, customerName?, customerPhone? }` → crea ocupación + Cuenta 1 | `table.open` |
| GET | `/api/occupancies?status=ABIERTA` | Ocupaciones abiertas de la sucursal | Autenticado |
| GET | `/api/occupancies/:id` | Detalle con pedidos, ítems, cuentas y pagos | Mesero dueño o `table.view_all` |
| POST | `/api/occupancies/:id/merge` | `{ sourceOccupancyId }` — une mesas | `table.merge` |
| POST | `/api/occupancies/:id/move` | `{ targetTableId }` | `table.move` |
| POST | `/api/occupancies/:id/transfer` | `{ waiterId }` | `table.transfer_waiter` |
| PATCH | `/api/occupancies/:id` | `{ guests, version }` | Mesero dueño |

### 2.6 Pedidos y KDS
| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| POST | `/api/orders` | Envía ronda: `{ id, occupancyId, tempFolio?, clientSentAt, items:[{ id, billId, productId, quantity, modifiers:[...], components:[...], note }] }` → `{ id, folio, roundNumber, items }` | `order.create` |
| GET | `/api/kds/orders?status=ENVIADO,EN_PREPARACION,LISTO` | Cola FIFO de la estación | `kds.operate` |
| POST | `/api/orders/:id/accept` | Marca `accepted_at` (idempotente: conserva la primera) | `kds.operate` |
| POST | `/api/orders/:id/ready` | Pedido completo listo | `kds.operate` |
| POST | `/api/order-items/:id/ready` | Ítem listo | `kds.operate` |
| POST | `/api/orders/:id/recall` | Listo → En preparación | `kds.recall` |
| POST | `/api/orders/:id/deliver` | Marca entregado | `order.deliver` |
| POST | `/api/order-items/:id/cancel` | `{ reasonId, note?, authorization? }` | `order.cancel_sent` |
| POST | `/api/orders/:id/printed` | Confirma impresión de comanda `{ deviceId, printerId }` | Dispositivo |
| POST | `/api/orders/:id/reprint` | Delegar reimpresión al hub | `bill.reprint` |

### 2.7 Cuentas, descuentos y pagos
| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| POST | `/api/occupancies/:id/bills` | `{ id, name }` crea cuenta | `bill.split` |
| PATCH | `/api/bills/:id` | `{ name, customerNit, customerTaxName, version }` | `bill.split` |
| POST | `/api/bills/move-items` | `{ itemIds:[], targetBillId, versions }` | `bill.split` |
| POST | `/api/order-items/:id/split` | `{ newItemId, quantity, targetBillId?, version }` — separa `quantity` unidades en un ítem nuevo (RF-104) y, si se indica, lo pasa a otra cuenta. `409` si el ítem tiene descuento de ítem o está en una cuenta pagada | `bill.split` |
| POST | `/api/bills/:id/precheck` | Registra impresión de pre-cuenta, devuelve datos del impreso | `bill.print_precheck` |
| POST | `/api/bills/:id/discounts` | `{ id, target: "BILL"|"ITEM", itemId?, kind, value, reasonId, authorization? }` | `discount.apply` |
| DELETE | `/api/discounts/:id` | Quita descuento (registrado en bitácora) | `discount.apply` |
| POST | `/api/bills/:id/pay` | `{ tipAmount, payments:[{ id, methodId, amount, tendered?, reference? }], cashRegisterId, version }` → cuenta pagada, cambio, datos del recibo | `payment.register` |
| POST | `/api/bills/:id/reopen` | `{ reasonId, note, authorization?, version }` — **solo en línea**. Rechaza con `409 REOPEN_NOT_ALLOWED` si algún pago no fue en efectivo (PA-051) o si el cobro es de otro día de negocio. Se puede reabrir desde otro turno (S-28) y sin importar si la mesa está ocupada (S-29); requiere un turno **abierto** en la caja que reabre, donde se registra el movimiento `REVERSO_REAPERTURA` (RF-069). No existe `/void` (PA-012) | `bill.reopen` |
| GET | `/api/bills/:id/receipt` | Datos para reimprimir recibo | `bill.reprint` |

### 2.8 Caja
| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| GET | `/api/cash-registers` | Cajas de la sucursal y turno abierto | Autenticado |
| POST | `/api/shifts` | `{ id, cashRegisterId, openingFloat, counts? }` — **solo en línea** (PA-042); no se acepta por `sync/push` | `cash.open_shift` |
| GET | `/api/shifts/:id` | Resumen (el esperado solo con `cash.view_expected`) | `cash.open_shift` |
| POST | `/api/shifts/:id/movements` | `{ id, type, amount, reasonId, note, authorization? }` | `cash.movement` |
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
