# 05 — Flujos del proceso operativo y diagramas de estados

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio**. Registra cada cambio en el [Control de cambios](README.md#control-de-cambios).

## 1. Flujo general del servicio

```mermaid
flowchart TD
    A[Cajero abre turno de caja<br/>con fondo inicial] --> B{Tipo de orden}
    B -->|Mesa| C[Mesero abre mesa<br/>comensales]
    B -->|Para llevar| D[Cajero crea orden<br/>para llevar]
    C --> E[Toma de pedido en celular]
    D --> E
    E --> F[Enviar a cocina]
    F --> G[KDS suena + comanda impresa]
    G --> H[Cocina: Aceptar<br/>inicia preparación]
    H --> I[Cocina: Listo<br/>inicia entrega]
    I --> J[Aviso al mesero]
    J --> K[Mesero: Entregado]
    K --> L{¿Otra ronda?}
    L -->|Sí| E
    L -->|No| M[Dividir cuentas si aplica]
    M --> N[Pre-cuenta impresa]
    N --> O[Cobro: métodos, propina,<br/>descuentos, cambio]
    O --> P[Recibo impreso]
    P --> Q{¿Todas las cuentas<br/>pagadas o anuladas?}
    Q -->|No| N
    Q -->|Sí| R[Mesa liberada]
    R --> S{¿Fin del turno?}
    S -->|No| B
    S -->|Sí| T[Corte de caja<br/>reporte impreso]
```

## 2. Pasos del flujo operativo

### Paso 1 — Apertura de caja / turno
| Aspecto | Detalle |
|---|---|
| Actor | Cajero (o gerente) con `cash.open_shift` |
| Pantalla | Caja › Abrir turno |
| Entradas | Caja (dispositivo), fondo inicial (desglose por denominación opcional), observación |
| Estados | Turno: — → `ABIERTO` |
| Reglas | Un solo turno `ABIERTO` por caja. El fondo puede sugerirse con el monto que quedó en el corte anterior. Se puede operar mesas sin turno, pero **no** cobrar en efectivo. |
| Errores | Turno ya abierto (`409 SHIFT_ALREADY_OPEN`); sin conexión: se permite abrir turno offline `[SUPUESTO]` y se valida al sincronizar (si había otro turno abierto en esa caja → conflicto). |

### Paso 2 — Abrir mesa u orden para llevar
| Aspecto | Detalle |
|---|---|
| Actor | Mesero / cajero con `table.open` |
| Pantalla | Mesas (lista o mapa por zona) · botón "Para llevar" |
| Entradas | Mesa, comensales (1–99), mesero (por defecto, quien abre). Para llevar: nombre y teléfono opcionales |
| Estados | Mesa `LIBRE` → `OCUPADA`; Ocupación → `ABIERTA`; se crea Cuenta 1 `ABIERTA` |
| Reglas | Una mesa solo tiene una ocupación abierta. El tipo de orden sale del catálogo (`MESA`, `PARA_LLEVAR`). No existe delivery. |
| Errores | Mesa ya ocupada (`409 TABLE_OCCUPIED`), mesa bloqueada, comensales fuera de rango. Offline: el dispositivo que abre la mesa queda "a cargo" de ella. |

### Paso 3 — Toma de pedido (mobile first)
| Aspecto | Detalle |
|---|---|
| Actor | Mesero |
| Pantalla | Mesa › Pedido: categorías (chips horizontales), buscador, tarjetas de producto, hoja inferior de modificadores, carrito |
| Entradas | Producto, cantidad, modificadores, nota libre (máx. 140 caracteres), cuenta destino (por defecto la cuenta activa) |
| Estados | Ítem `BORRADOR` (solo en el dispositivo, IndexedDB) |
| Reglas | Validar mínimos/máximos de modificadores. Precio de línea = (precio producto + Σ modificadores) × cantidad. Productos agotados no se pueden agregar. Borrador persistente local. Ítems iguales (mismo producto, mismos modificadores y nota) se agrupan sumando cantidad. |
| Errores | Producto agotado o desactivado mientras se armaba el borrador → aviso al enviar. |

### Paso 4 — Envío a cocina
| Aspecto | Detalle |
|---|---|
| Actor | Mesero |
| Pantalla | Carrito › "Enviar a cocina" |
| Salidas | Pedido (ronda) con folio; evento `order.sent` al KDS (sonido); comanda impresa |
| Estados | Pedido → `ENVIADO`; Ítems `BORRADOR` → `ENVIADO` |
| Reglas | La comanda incluye: folio, mesa o "PARA LLEVAR" + nombre, mesero, hora, ítems, modificadores, notas; "ADICIONAL" si la ocupación ya tenía pedidos. FIFO por `sent_at`. Con varias estaciones (futuro) se divide por estación. La operación usa clave de idempotencia (doble toque no duplica). |
| Errores | Impresora sin respuesta → reintento y aviso "Comanda no impresa" con botón reimprimir; el pedido sí llega al KDS. Sin internet → ver [09-modo-sin-internet.md](09-modo-sin-internet.md): folio temporal + impresión local. |

### Paso 5 — Aceptación en cocina
| Aspecto | Detalle |
|---|---|
| Actor | Cocina (`kds.operate`) |
| Pantalla | KDS: columnas "Nuevos" / "En preparación" / "Listos" |
| Estados | Pedido `ENVIADO` (mostrado como *Recibido*) → `EN_PREPARACION`; `accepted_at = now()` |
| Reglas | **No hay rechazo.** El tiempo de espera corre desde `sent_at` hasta `accepted_at`. El sonido se repite cada N s (configurable) mientras haya pedidos sin aceptar. |
| Errores | Dos pantallas KDS aceptan a la vez → el servidor conserva la primera marca (idempotente). |

### Paso 6 — Preparación en el KDS
| Aspecto | Detalle |
|---|---|
| Actor | Cocina |
| Pantalla | Tarjeta del pedido con temporizador y color |
| Reglas | Color por minutos desde `sent_at` (o desde `accepted_at`, configurable) con umbrales configurables. Se puede marcar cada ítem como listo (tachado) o el pedido completo. Ítems cancelados se muestran tachados en rojo. |

### Paso 7 — Pedido completado (Listo)
| Aspecto | Detalle |
|---|---|
| Actor | Cocina |
| Estados | Pedido `EN_PREPARACION` → `LISTO`; `ready_at = now()` (cuando el último ítem no cancelado está listo) |
| Reglas | Comienza el tiempo de entrega. `kds.recall` permite regresar a `EN_PREPARACION` (se conserva el primer `ready_at` en historial). |

### Paso 8 — Notificación al mesero
| Aspecto | Detalle |
|---|---|
| Actor | Sistema |
| Salidas | Evento `order.ready` a la sala del mesero asignado y a la caja; sonido + `navigator.vibrate` + notificación en la app; banner persistente hasta entregarse |
| Reglas | Si el mesero no está conectado, la notificación queda pendiente y se muestra al reconectar. Web Push queda para F2 (en iOS requiere PWA instalada). |

### Paso 9 — Entrega
| Aspecto | Detalle |
|---|---|
| Actor | Mesero (`order.deliver`) |
| Estados | Pedido `LISTO` → `ENTREGADO`; `delivered_at = now()` |
| Métricas | Espera = `accepted_at − sent_at`; Preparación = `ready_at − accepted_at`; Entrega = `delivered_at − ready_at` |
| Reglas | Si el mesero olvida marcar entregado, el pedido se marca automáticamente al imprimir la pre-cuenta `[SUPUESTO]` y se excluye del promedio de tiempo de entrega (`delivered_auto = true`). |

### Paso 10 — Pre-cuenta
| Aspecto | Detalle |
|---|---|
| Actor | Mesero / cajero (`bill.print_precheck`) |
| Estados | Cuenta `ABIERTA` → `PRECUENTA` (se puede seguir agregando ítems; al agregar vuelve a `ABIERTA`) |
| Reglas | Muestra detalle, descuentos, total, propina sugerida y total con propina. Reimpresión requiere `bill.reprint` y queda registrada. |

### Paso 11 — Pago
| Aspecto | Detalle |
|---|---|
| Actor | Cajero (`payment.register`) |
| Pantalla | Cobro: total, propina (editable), descuentos, lista de pagos, teclado numérico, botones de billetes rápidos (Q 50, Q 100, Q 200), cambio |
| Estados | Cuenta → `PAGADA`; Pagos → `APLICADO` |
| Reglas | Ver [§4 Reglas de cálculo](#4-reglas-de-cálculo-de-cuenta). Solo efectivo genera cambio. Tarjeta y transferencia piden referencia si así se configuró. NIT/CF opcional (punto de extensión FEL). Se imprime el recibo. Pagos en efectivo se asocian al turno abierto de la caja. |
| Errores | Pagos insuficientes; método inactivo; turno cerrado; cuenta modificada por otro dispositivo (`409 STALE_VERSION`). |

### Paso 12 — Cierre y liberación de mesa
| Aspecto | Detalle |
|---|---|
| Actor | Sistema |
| Reglas | Cuando todas las cuentas de la ocupación están `PAGADA` o `ANULADA` y no hay ítems sin cuenta, la ocupación pasa a `CERRADA` y la mesa a `LIBRE`. Las cuentas vacías (sin ítems) se eliminan al cerrar. |

### Paso 13 — Corte de caja
| Aspecto | Detalle |
|---|---|
| Actor | Cajero / gerente (`cash.close_shift`) |
| Fórmula | Efectivo esperado = fondo inicial + Σ pagos en efectivo aplicados (monto aplicado a la cuenta, ya neto del cambio entregado) + depósitos − retiros − reversos de anulaciones en efectivo (ver RPT-030 en [12-catalogo-reportes.md](12-catalogo-reportes.md)) |
| Estados | Turno `ABIERTO` → `EN_CORTE` → `CERRADO` |
| Reglas | Requiere conexión y que no haya operaciones pendientes en la outbox del dispositivo de caja. Corte a ciegas si el usuario no tiene `cash.view_expected`. Comentario obligatorio si la diferencia supera el umbral configurado. Se imprime el reporte. Un turno cerrado es inmutable. |

### Paso 14 — Cancelaciones y anulaciones
| Caso | Permiso | Motivo | Efecto |
|---|---|---|---|
| Ítem en borrador | Ninguno | No | Se elimina; no queda en bitácora |
| Ítem enviado, no listo | `order.cancel_sent` o 🔑 | Obligatorio | Ítem `CANCELADO`; KDS lo tacha; comanda de cancelación; bitácora |
| Ítem listo o entregado | `order.cancel_sent` o 🔑 | Obligatorio | Ítem `CANCELADO` con marca `after_ready = true` (merma); bitácora |
| Pedido completo enviado | `order.cancel_sent` o 🔑 | Obligatorio | Todos sus ítems `CANCELADO`; pedido `CANCELADO` |
| Cuenta pagada | `payment.void` o 🔑 | Obligatorio | Cuenta `ANULADA`; pagos `REVERTIDO`; movimiento negativo en turno vigente; evento FEL `ANULAR` si aplica. **Solo con conexión.** |

## 3. Flujo de pago (detalle)

```mermaid
flowchart TD
    A[Seleccionar cuenta] --> B[Mostrar subtotal y descuentos]
    B --> C{¿Descuento nuevo?}
    C -->|Sí| D{¿Dentro del tope del rol?}
    D -->|No| E[Pedir PIN autorizador] --> F
    D -->|Sí| F[Aplicar descuento + motivo]
    C -->|No| G
    F --> G[Propina sugerida, editable]
    G --> H[Agregar pago: método + monto + referencia]
    H --> I{Σ pagos ≥ total?}
    I -->|No| H
    I -->|Sí| J{¿Excedente sobre<br/>pagos en efectivo?}
    J -->|Sí| K[Cambio = excedente]
    J -->|No, excedente en no-efectivo| L[Rechazar o pedir ajuste]
    L --> H
    K --> M[Confirmar]
    M --> N[Cuenta PAGADA + recibo]
    N --> O{¿Ocupación sin cuentas abiertas?}
    O -->|Sí| P[Liberar mesa]
```

## 4. Reglas de cálculo de cuenta

Todos los precios **incluyen impuestos**. No hay cálculo de impuestos en esta fase.

1. `precio_linea = (precio_unitario_producto + Σ precio_modificadores) × cantidad` (precios congelados al agregar el ítem).
2. `descuento_linea` = porcentaje × `precio_linea` o monto fijo (≤ `precio_linea`).
3. `subtotal_cuenta = Σ (precio_linea − descuento_linea)` de ítems no cancelados.
4. `descuento_cuenta` = porcentaje × `subtotal_cuenta` o monto fijo (≤ `subtotal_cuenta`).
5. `total_consumo = subtotal_cuenta − descuento_cuenta`.
6. `propina = total_consumo × % sugerido` (editable; base de la propina configurable: antes o después de descuentos `[SUPUESTO: después]`).
7. `total_a_pagar = total_consumo + propina`.
8. `cambio = Σ pagos − total_a_pagar`, solo si `cambio ≤ Σ pagos en efectivo`.
9. Redondeo: a 2 decimales con *half-up* en cada línea; el total es la suma de líneas redondeadas. Todos los montos se guardan como `numeric(12,2)` (nunca `float`).

## 5. Diagramas de estados

### 5.1 Mesa
```mermaid
stateDiagram-v2
    [*] --> LIBRE
    LIBRE --> OCUPADA: abrir mesa
    OCUPADA --> UNIDA: unir a otra mesa
    UNIDA --> LIBRE: se libera la mesa principal
    OCUPADA --> LIBRE: todas las cuentas pagadas/anuladas
    OCUPADA --> LIBRE: trasladar ocupación a otra mesa
    LIBRE --> BLOQUEADA: bloquear (mantenimiento/reservada manual)
    BLOQUEADA --> LIBRE: desbloquear
```
Los estados visuales "Con pedido en cocina", "Listo para entregar" y "Pre-cuenta impresa" se **derivan** de los pedidos y cuentas de la ocupación; no son estados guardados de la mesa.

### 5.2 Ocupación
```mermaid
stateDiagram-v2
    [*] --> ABIERTA: abrir mesa / para llevar
    ABIERTA --> FUSIONADA: unida a otra ocupación
    ABIERTA --> CERRADA: todas las cuentas pagadas o anuladas
    ABIERTA --> CANCELADA: sin ítems enviados y se cierra
    FUSIONADA --> [*]
    CERRADA --> [*]
    CANCELADA --> [*]
```

### 5.3 Pedido (ronda)
```mermaid
stateDiagram-v2
    [*] --> ENVIADO: enviar a cocina (KDS: Recibido)
    ENVIADO --> EN_PREPARACION: cocina acepta
    EN_PREPARACION --> LISTO: todos los ítems listos
    LISTO --> EN_PREPARACION: recall (permiso)
    LISTO --> ENTREGADO: mesero entrega
    ENVIADO --> CANCELADO: cancelar todos los ítems
    EN_PREPARACION --> CANCELADO: cancelar todos los ítems
    ENTREGADO --> [*]
    CANCELADO --> [*]
```

### 5.4 Ítem
```mermaid
stateDiagram-v2
    [*] --> BORRADOR: agregar al carrito
    BORRADOR --> [*]: quitar (sin registro)
    BORRADOR --> ENVIADO: enviar a cocina
    ENVIADO --> EN_PREPARACION: cocina acepta el pedido
    EN_PREPARACION --> LISTO: cocina marca ítem/pedido listo
    LISTO --> ENTREGADO: mesero entrega
    ENVIADO --> CANCELADO: cancelar (motivo + permiso)
    EN_PREPARACION --> CANCELADO: cancelar (motivo + permiso)
    LISTO --> CANCELADO: cancelar (merma)
    ENTREGADO --> CANCELADO: cancelar (merma)
```
El estado de cobro del ítem lo da su cuenta (no es un estado del ítem).

### 5.5 Cuenta
```mermaid
stateDiagram-v2
    [*] --> ABIERTA
    ABIERTA --> PRECUENTA: imprimir pre-cuenta
    PRECUENTA --> ABIERTA: agregar/mover ítems
    ABIERTA --> PAGADA: pagos ≥ total
    PRECUENTA --> PAGADA: pagos ≥ total
    PAGADA --> ANULADA: anular (motivo + permiso, en línea)
    ABIERTA --> ELIMINADA: cuenta vacía al cerrar
    PAGADA --> [*]
    ANULADA --> [*]
```
Estado de facturación (independiente, punto de extensión FEL): `NO_REQUERIDA` · `PENDIENTE` · `EN_PROCESO` · `EMITIDA` · `ERROR` · `ANULACION_PENDIENTE` · `ANULADA`.

### 5.6 Pago
```mermaid
stateDiagram-v2
    [*] --> APLICADO: registrar pago
    APLICADO --> REVERTIDO: anular cuenta
    APLICADO --> EN_CONFLICTO: duplicado detectado al sincronizar
    EN_CONFLICTO --> APLICADO: gerente lo mantiene
    EN_CONFLICTO --> REVERTIDO: gerente lo anula
    REVERTIDO --> [*]
```

### 5.7 Turno de caja
```mermaid
stateDiagram-v2
    [*] --> ABIERTO: abrir con fondo
    ABIERTO --> ABIERTO: pagos, retiros, depósitos
    ABIERTO --> EN_CORTE: iniciar corte (en línea, outbox vacía)
    EN_CORTE --> ABIERTO: cancelar corte
    EN_CORTE --> CERRADO: confirmar conteo
    CERRADO --> [*]
```

## 6. Diagrama de secuencia: envío a cocina con conexión

```mermaid
sequenceDiagram
    participant M as Celular mesero (PWA)
    participant API as Backend del cliente
    participant DB as PostgreSQL (base del cliente)
    participant K as KDS
    participant P as Impresora cocina
    M->>M: Guardar en outbox (ULID + idempotency key)
    M->>API: POST /api/orders (Idempotency-Key)
    API->>DB: INSERT order + items (transacción)
    DB-->>API: ok (folio definitivo)
    API-->>M: 201 {id, folio}
    API-)K: socket "order.sent"
    K->>K: Sonido + tarjeta al final de la cola
    Note over M,P: Dispositivo designado como impresor de comandas
    K->>P: ESC/POS comanda (o el mesero/caja según ADR-003)
```
