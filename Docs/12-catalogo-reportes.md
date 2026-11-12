# 12 — Catálogo de reportes

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio**. Registra cada cambio en el [Control de cambios](README.md#control-de-cambios).

## 1. Definiciones base (aplican a todos los reportes, al dashboard y al chatbot)

Las fórmulas se implementan **una sola vez** (módulo `reports/metrics`) y se reutilizan en dashboard, reportes, exportaciones y chatbot.

| Término | Definición |
|---|---|
| Día de negocio | Fecha local de la sucursal con hora de corte `business_day_cutoff` (ej. una venta a las 01:30 del día 12 con corte 04:00 pertenece al día 11) |
| Cuenta válida | `bills.status = 'PAGADA'` (excluye `ABIERTA`, `PRECUENTA`, `ELIMINADA`; no existen cuentas anuladas). La fecha de una cuenta es la de su `paid_at` (si se reabrió y volvió a cobrar, la del último cobro) |
| Ítem vendido | Ítem no `CANCELADO` de una cuenta válida |
| Venta bruta (ítems) | Σ `line_total` de ítems vendidos |
| Descuentos | Σ `applied_discounts.amount` de cuentas válidas (de ítem y de cuenta) |
| **Ventas netas** | Venta bruta − descuentos = Σ (`bills.total − bills.tip_amount`) de cuentas válidas. **No** incluye propina. Incluye impuestos (los precios los incluyen) |
| Propinas | Σ `bills.tip_amount` de cuentas válidas |
| Total cobrado | Ventas netas + propinas = Σ `payments.amount` con estado `APLICADO` de cuentas válidas |
| Órdenes | Nº de **ocupaciones** distintas con al menos una cuenta válida (PA-011): una mesa dividida en 3 cuentas = 1 orden; una orden para llevar = 1 orden. Se cuenta en el día de negocio de su última cuenta pagada `[SUPUESTO]` |
| Cuentas pagadas | Nº de cuentas válidas (se sigue mostrando en el corte de caja y en RPT-012) |
| Ticket promedio | Ventas netas / órdenes (es decir, por mesa o pedido para llevar, no por cuenta) |
| Comensales | Σ `occupancies.guests` de ocupaciones con al menos una cuenta válida (para llevar cuenta 1 por defecto o lo que se capture) |
| Venta por comensal | Ventas netas / comensales |
| Tiempo de espera | `accepted_at − sent_at` |
| Tiempo de preparación | `ready_at − accepted_at` |
| Tiempo de entrega | `delivered_at − ready_at` (excluye `delivered_auto = true`) |
| Costo teórico de un ítem | `quantity × unit_cost_snapshot` + Σ costos de modificadores/componentes |
| Margen bruto teórico | (Ventas netas del ítem − costo teórico) / ventas netas del ítem |
| % de costo | Costo teórico / ventas netas |
| Atribución del descuento de cuenta a ítems | Prorrateo por `line_total` (para reportes por producto/categoría) |

**Filtros comunes:** `periodo` (hoy, ayer, esta semana, semana pasada, este mes, mes pasado, últimos 7/30/90 días, este año, personalizado, histórico), `sucursal`, `turno de operación` (service_periods), `turno de caja`, `mesero`, `tipo de orden`, `método de pago`, `categoría`, `producto`. Cada reporte declara cuáles aplican.

**Exportación:** CSV (UTF-8 con BOM, separador configurable), Excel `.xlsx` (montos como número con formato de moneda, fechas en zona local) y PDF (con logo, filtros aplicados, fecha de generación y usuario).

**Permisos:** `reports.view` para todos; `reports.financial` para los marcados 💰; `reports.audit` para los marcados 🔒.

## 2. Dashboard del día (pantalla de inicio)

| Indicador | Fórmula | Comparación |
|---|---|---|
| Ventas del día | Ventas netas del día de negocio actual hasta ahora | Mismo día de la semana anterior hasta la misma hora: `(hoy − anterior) / anterior` |
| Órdenes | Nº de ocupaciones con cuenta válida | Igual |
| Ticket promedio | Ventas netas / órdenes | Igual |
| Comensales | Σ comensales | Igual |
| Ventas por método de pago | Σ pagos aplicados agrupados por método | — |
| Mesas abiertas | Nº ocupaciones `ABIERTA` con mesa | — (tiempo real) |
| Para llevar abiertas | Nº ocupaciones `ABIERTA` sin mesa | — |
| Órdenes en cocina | Nº pedidos `ENVIADO` + `EN_PREPARACION` | — (tiempo real) |
| Tiempo promedio de preparación | Promedio del día | Semana anterior |
| Tiempo promedio de entrega | Promedio del día | Semana anterior |
| Top 5 productos del día | Por unidades (y monto) | — |
| Cancelaciones del día | Nº y monto de ítems cancelados | Semana anterior |
| Reaperturas del día | Nº de cuentas reabiertas | — |
| Descuentos del día | Nº y monto | Semana anterior |
| Propinas del día | Σ propinas | — |

## 3. Catálogo

### 3.1 Ventas
| ID | Reporte | Columnas | Filtros | Fórmula / notas |
|---|---|---|---|---|
| RPT-001 | Ventas por periodo | Periodo (día/semana/mes/año), órdenes, comensales, venta bruta, descuentos, ventas netas, propinas, ticket promedio | Periodo, sucursal, tipo de orden, agrupar por día/semana/mes | Definiciones base |
| RPT-002 | Ventas por producto | Producto, categoría, unidades, venta bruta, descuento prorrateado, ventas netas, % del total | Periodo, sucursal, categoría, tipo de orden | Ítems vendidos |
| RPT-003 | Ventas por categoría | Categoría, unidades, ventas netas, % del total | Periodo, sucursal | |
| RPT-004 | Ventas por método de pago | Método, Nº pagos, monto, % | Periodo, sucursal, turno de caja | Σ `payments.amount` `APLICADO` |
| RPT-005 | Ventas por mesero | Mesero, órdenes, comensales, ventas netas, ticket promedio, propinas, descuentos, cancelaciones | Periodo, sucursal | Mesero = `occupancies.waiter_id` al cierre |
| RPT-006 | Ventas por turno de operación | Turno (Almuerzo/Cena), órdenes, ventas netas, ticket promedio | Periodo, sucursal | Por hora de `paid_at` dentro del `service_period` |
| RPT-007 | Ventas por tipo de orden | Mesa / Para llevar: órdenes, ventas netas, ticket promedio | Periodo, sucursal | |
| RPT-008 | Ventas por hora | Hora (0–23), órdenes, ventas netas | Periodo, sucursal, día de semana | Hora local de `paid_at` |
| RPT-009 | Mapa de calor hora × día de semana | Matriz 7 × 24 con ventas netas (o órdenes) | Periodo, sucursal, métrica | F2 |
| RPT-010 | Comparativo de periodos | Métrica actual, anterior, variación absoluta y % | Periodo A, periodo B | |
| RPT-011 | Histórico mensual | Mes, ventas netas, órdenes, ticket promedio, variación vs. mes anterior y vs. mismo mes del año anterior | Sucursal | |
| RPT-012 | Detalle de cuentas | Folio, fecha, mesa/para llevar, mesero, cajero, total, propina, métodos, estado, NIT/CF | Periodo, sucursal, estado, mesero | Para auditoría de cuentas |
| RPT-013 | Modificadores vendidos | Modificador, grupo, veces, monto adicional | Periodo, sucursal | |

### 3.2 Cocina y servicio
| ID | Reporte | Columnas | Filtros | Fórmula |
|---|---|---|---|---|
| RPT-020 | Tiempos de cocina | Periodo, pedidos, espera prom/p90, preparación prom/p90, entrega prom/p90 | Periodo, sucursal, hora, turno, mesero | Definiciones base; p90 = percentil 90 |
| RPT-021 | Tiempos por producto | Producto, pedidos, preparación promedio | Periodo, sucursal | Pedidos de un solo producto o tiempo por ítem si se marcó listo por ítem |
| RPT-022 | Pedidos fuera de tiempo | Folio, mesa, hora, espera, preparación, entrega, umbral superado | Periodo, sucursal, umbral | Umbral = `kds_thresholds.lateMin` |
| RPT-023 | Rotación de mesas | Mesa, ocupaciones, duración promedio de ocupación, venta promedio por ocupación | Periodo, sucursal, zona | `closed_at − opened_at` |

### 3.3 Caja 💰
| ID | Reporte | Columnas | Filtros | Fórmula |
|---|---|---|---|---|
| RPT-030 | Cortes de caja | Turno, caja, cajero, apertura, cierre, fondo, cobros por método, depósitos, retiros, reaperturas, esperado, contado, diferencia, comentario | Periodo, sucursal, caja, cajero | **Esperado = fondo + Σ pagos en efectivo cobrados en el turno (netos de cambio, incluidos los que después se revirtieron) + depósitos − retiros − reversos por reapertura registrados en el turno.** Así un turno cerrado nunca cambia: la reapertura resta en el turno abierto donde se hace. Diferencia = contado − esperado. Los cortes provisionales (sin conexión) se marcan y muestran el esperado provisional y el recalculado |
| RPT-031 | Movimientos de caja | Fecha, turno, tipo, monto, motivo, usuario, autorizador | Periodo, sucursal, tipo, motivo | |
| RPT-032 | Diferencias de caja | Cajero, turnos, Σ diferencias, nº turnos con faltante/sobrante | Periodo, sucursal | |
| RPT-033 | Propinas | Mesero, cuentas, Σ propinas, propina promedio %, por método, **a quién le corresponde** | Periodo, sucursal | Propina % = tip / (total − tip). Reparto según `tip_distribution` (PA-046): `WAITER` → al mesero de la ocupación; `POOL` → Σ propinas del día de negocio / meseros que trabajaron ese día, en partes iguales `[SUPUESTO]`; `HOUSE` → al establecimiento. Si el restaurante no registra propinas, el reporte no aparece |
| RPT-034 | Efectivo cobrado por meseros | Mesero, turno de la caja principal, nº de cobros en efectivo, Σ efectivo (neto de cambio) | Periodo, sucursal, mesero | Sirve para cuadrar lo que cada mesero entrega al cajero (PA-052). Solo pagos `APLICADO` con `received_by` sin rol de caja |

### 3.4 Control 🔒
| ID | Reporte | Columnas | Filtros | Fórmula |
|---|---|---|---|---|
| RPT-040 | Cancelaciones de ítems | Fecha, folio, producto, cantidad, monto, motivo, solicitó, autorizó, después de listo (merma) | Periodo, sucursal, motivo, usuario | Monto = `line_total` del ítem cancelado |
| RPT-041 | Reaperturas de cuentas | Fecha, folio, total original, total nuevo, diferencia, motivo, solicitó, autorizó | Periodo, sucursal, usuario | Desde `audit_log` (`bill.reopen`). No existen anulaciones (PA-012) |
| RPT-042 | Descuentos | Fecha, folio, tipo (ítem/cuenta), %/monto, monto, motivo, aplicó, autorizó | Periodo, sucursal, motivo, usuario | |
| RPT-043 | Bitácora de auditoría | Fecha, usuario, autorizador, dispositivo, IP, acción, entidad, antes/después | Periodo, usuario, acción, entidad | `audit_log` |
| RPT-044 | Reimpresiones | Fecha, documento, folio, usuario, dispositivo | Periodo, sucursal | |
| RPT-045 | Aperturas de cajón sin venta | Fecha, caja, usuario | Periodo | F2 |

### 3.5 Rentabilidad y costeo 💰
| ID | Reporte | Columnas | Filtros | Fórmula |
|---|---|---|---|---|
| RPT-050 | Consumo teórico de insumos | Insumo, unidad, cantidad teórica, costo teórico | Periodo, sucursal, categoría de insumo | Σ (unidades vendidas × cantidad de receta × (1 + merma)), convertido a la unidad base. Incluye modificadores y componentes de combo. Ítems cancelados después de listo cuentan como consumo (merma) |
| RPT-051 | Rentabilidad por platillo | Producto, unidades, ventas netas, costo teórico, margen bruto Q, margen %, % de costo, margen objetivo, alerta | Periodo, sucursal, categoría | Usa `unit_cost_snapshot` |
| RPT-052 | Lista de costeo actual | Producto, costo teórico actual, precio sugerido, precio asignado, margen real, objetivo, alerta | Categoría, solo bajo objetivo | Costos vigentes (no históricos) |
| RPT-053 | Rentabilidad por categoría | Categoría, ventas netas, costo, margen % | Periodo, sucursal | |
| RPT-054 | Productos sin receta | Producto, categoría, unidades vendidas en el periodo | Periodo | Para completar costeo |

### 3.6 Operación del sistema
| ID | Reporte | Columnas | Filtros |
|---|---|---|---|
| RPT-060 | Conflictos de sincronización | Fecha, tipo, mesa/folio, dispositivos, estado, resolución, resolvió | Periodo, estado |
| RPT-061 | Cortes de conexión | Dispositivo, sucursal, inicio, fin, duración, operaciones pendientes máx. | Periodo, sucursal, dispositivo |
| RPT-062 | Capturas de contingencia (papel) | Nº talonario, fecha real, capturó, folio asignado, total | Periodo, sucursal |
| RPT-063 | Uso del chatbot | Usuario, preguntas usadas / límite del mes (100, S-13), tokens, costo estimado, % fuera de alcance | Periodo |

## 4. Reglas de cálculo y consistencia
1. Montos con `numeric`; redondeo *half-up* a 2 decimales solo al presentar.
2. Los reportes leen de las vistas del esquema `semantic` (las mismas del chatbot) para que los números coincidan.
3. Ventas offline sincronizadas tarde se reportan en su **día de negocio real** (`paid_at` corregido con `clockOffsetMs`).
4. No existen anulaciones (PA-012). Una cuenta pagada en efectivo se puede reabrir desde **otro turno** (S-28), dentro del mismo día de negocio `[SUPUESTO]`. Las ventas quedan en el día de negocio del último cobro; el dinero devuelto se registra como `REVERSO_REAPERTURA` en el turno donde se reabrió.
5. Las variaciones % con base 0 se muestran como "—" (no infinito).
6. Rango "histórico" y rangos > 92 días se calculan en segundo plano (F2) y pueden usar tablas resumen diarias (`daily_sales_summary`) materializadas cada noche.
