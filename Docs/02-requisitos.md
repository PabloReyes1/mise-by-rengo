# 02 — Documento de requisitos

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio**. Registra cada cambio en el [Control de cambios](README.md#control-de-cambios).

**Prioridad:** `MVP` = obligatorio en la primera entrega; `F2` / `F3` = fases siguientes (ver [15-roadmap.md](15-roadmap.md)).

---

## 1. Requisitos funcionales

### 1.1 Configuración del restaurante (RF-001 a RF-049)

| ID | Requisito | Criterio de aceptación | Prioridad |
|---|---|---|---|
| RF-001 | Registrar datos del cliente: razón social, nombre comercial, NIT, teléfono, dirección, logo, colores primario y secundario. | Al cambiar logo o colores, todos los dispositivos los muestran al recargar sin recompilar el frontend. | MVP |
| RF-002 | Registrar sucursales con nombre, dirección, teléfono, zona horaria y horarios de operación. | Una base puede tener N sucursales; cada usuario, mesa, impresora y turno pertenece a una. | MVP |
| RF-003 | Configurar encabezado y pie de cada tipo de ticket (comanda, pre-cuenta, recibo, corte) por sucursal. | El texto configurado aparece en el impreso; admite variables `{sucursal}`, `{telefono}`, `{nit}`, `{fecha}`. | MVP |
| RF-004 | Configuración regional: moneda, símbolo, decimales, zona horaria, idioma y formato de fecha. | Por defecto GTQ / `Q` / 2 decimales / America/Guatemala / es-GT; editable sin código. | MVP |
| RF-005 | Textos configurables de la interfaz (ej. renombrar "Mesa" a "Barra", mensajes del recibo). | Un texto sobrescrito por el cliente reemplaza al texto por defecto en toda la app. | F2 |
| RF-010 | CRUD de categorías del menú con orden, color e ícono, y activación/desactivación. | Una categoría inactiva no aparece en la toma de pedido pero conserva su historial. | MVP |
| RF-011 | CRUD de productos: nombre, descripción corta, categoría, precio (impuestos incluidos), foto, orden, código interno y estado (activo / agotado / inactivo). | Marcar "agotado" se refleja en todos los dispositivos conectados en ≤ 2 s y bloquea agregarlo a pedidos nuevos. | MVP |
| RF-012 | Precio por sucursal opcional (si no hay, se usa el precio base). | Un producto con precio de sucursal muestra ese precio solo en esa sucursal. | F2 |
| RF-013 | Grupos de modificadores: nombre, obligatorio/opcional, mínimo y máximo de selecciones, y modificadores con costo adicional (≥ 0). | No se puede agregar el producto al pedido si no se cumplen mínimo y máximo. | MVP |
| RF-014 | Un grupo de modificadores puede asignarse a varios productos, con orden. | Editar el grupo actualiza todos los productos que lo usan. | MVP |
| RF-015 | Combos: producto compuesto por componentes fijos o elegibles (ej. "elige bebida") con precio propio. | El combo se muestra como una línea con sus componentes debajo, en pantalla y en la comanda. | MVP |
| RF-016 | Fotos del producto se suben, se redimensionan (máx. 800 px) y se sirven por ruta cacheable. | Las listas nunca incluyen la imagen; `GET /api/products/:id/image?v=<updatedAt>` responde con `Cache-Control: public, max-age=31536000, immutable`. | MVP |
| RF-020 | CRUD de zonas y mesas: nombre, capacidad, zona, sucursal, forma y posición en el mapa (opcional). | El mesero ve las mesas por zona, en lista o en mapa, con su estado y color. | MVP |
| RF-021 | Editor visual del mapa de mesas (arrastrar y soltar). | La posición guardada se respeta en todos los dispositivos. | F2 |
| RF-022 | Estaciones de cocina: existe una por defecto; el modelo permite N y asigna categorías a estaciones. | En MVP la UI solo muestra una estación; la tabla y la relación categoría→estación existen. | MVP (modelo) |
| RF-025 | Propina configurable (PA-046): (a) si se registran propinas o no; (b) porcentaje sugerido, si es editable y si aplica a para llevar; (c) **a quién le corresponde**: al mesero que atendió la mesa, repartida entre todos los meseros, o al establecimiento. La propina siempre es **sugerida**: el comensal decide (S-10). | Al cobrar se muestra la propina sugerida y quien cobra puede quitarla o cambiarla. El reporte de propinas (RPT-033) muestra cuánto le toca a cada quien según la regla configurada. | MVP |
| RF-026 | Descuentos: por porcentaje o monto fijo, por ítem o por cuenta, con motivo obligatorio de un catálogo configurable. El **gerente** configura si se permiten descuentos y el límite de cada rol (S-05); en la plantilla vienen desactivados. | Con descuentos desactivados, la opción no aparece. Un descuento mayor al límite del rol pide autorización (PIN de un usuario con permiso). | MVP |
| RF-027 | Métodos de pago configurables: nombre, tipo (efectivo / tarjeta / transferencia / otro), si admite cambio, si pide referencia, activo. | Solo los métodos de tipo efectivo calculan cambio y afectan el efectivo esperado del corte. | MVP |
| RF-028 | Motivos configurables de cancelación, reapertura de cuenta, descuento, retiro y depósito de caja. | Cada catálogo es independiente y se puede desactivar un motivo sin perder el historial. | MVP |
| RF-030 | Usuarios: nombre, usuario, correo opcional, contraseña, PIN de 4–6 dígitos, rol(es), sucursal(es) y estado. | Un usuario inactivo no puede iniciar sesión; su historial se conserva. | MVP |
| RF-031 | Roles configurables con lista de permisos (ver [03-actores-roles-permisos.md](03-actores-roles-permisos.md)). Plantilla con roles por defecto. | Crear un rol "Capitán" con permisos elegidos funciona sin código. | MVP |
| RF-032 | Acceso por PIN en dispositivos compartidos (caja, KDS) tras registrar el dispositivo. **Sin bloqueo por inactividad** (S-04): la sesión sigue abierta mientras se use y vence tras **12 horas sin actividad**. | En un dispositivo registrado, el usuario entra solo con PIN y cambia de usuario con PIN. Tras 12 h sin actividad, la sesión vence y pide PIN o contraseña de nuevo. | MVP |
| RF-033 | Autorización puntual por PIN: cuando una acción requiere un permiso que el usuario no tiene, un usuario con permiso ingresa su PIN para esa sola acción. | La bitácora guarda quién solicitó y quién autorizó. | MVP |
| RF-035 | Registro de dispositivos: nombre, tipo (celular mesero, caja, KDS, admin), sucursal, impresora asignada y prefijo de folio offline. | Un dispositivo revocado no puede sincronizar ni operar. | MVP |
| RF-036 | Registro de impresoras: nombre, conexión (USB, Serial, Bluetooth, LAN/ePOS, agente), ancho (58/80 mm), juego de caracteres y corte automático. | Se puede imprimir una página de prueba desde la configuración. | MVP |
| RF-037 | Asignación de impresora por tipo de documento (comanda, pre-cuenta, recibo, corte) y por estación. | La comanda sale en la impresora de cocina y el recibo en la de caja. | MVP |
| RF-038 | Turnos y horarios de operación por sucursal (ej. "Almuerzo 11:00–16:00", "Cena 18:00–23:00"). | Los reportes pueden filtrar por turno de operación. | MVP |
| RF-040 | Importar y exportar el menú en CSV/Excel. | Importar 100 productos con categorías crea o actualiza sin duplicar por código interno. | F2 |
| RF-041 | Activar o desactivar módulos según la licencia (ej. recetas, chatbot, reportes avanzados). | Un módulo inactivo no aparece en el menú y su API responde `403 MODULE_DISABLED`. | MVP |

### 1.2 Flujo operativo (RF-050 a RF-099)

| ID | Requisito | Criterio de aceptación | Prioridad |
|---|---|---|---|
| RF-050 | Abrir turno de caja con fondo inicial, usuario y dispositivo de caja. **Solo con conexión** (PA-042). El fondo es configurable por caja (PA-024): **fijo** (el mismo monto todos los días, ya escrito) o **variable** (el cajero escribe el monto; se sugiere lo que quedó en el corte anterior). | No se puede cobrar en efectivo sin un turno abierto en esa caja. Solo un turno abierto por caja. | MVP |
| RF-051 | Abrir mesa: elegir mesa libre, mesero (por defecto quien abre) y número de comensales. | La mesa pasa a "Ocupada" en todos los dispositivos en ≤ 2 s. | MVP |
| RF-052 | Crear orden para llevar sin mesa con nombre o teléfono del cliente opcional. | Aparece en la lista "Para llevar" y la comanda dice "PARA LLEVAR" y el nombre. | MVP |
| RF-053 | Tomar pedido en celular: buscar o navegar por categoría, elegir producto, modificadores, cantidad y nota. | El pedido en borrador se guarda localmente; si se cierra la app, se recupera. | MVP |
| RF-054 | Enviar pedido a cocina: los ítems en borrador se convierten en un pedido (ronda) con hora de envío. | Se crea el pedido con folio, se notifica al KDS con sonido y se imprime la comanda. Las rondas 2+ dicen "ADICIONAL". | MVP |
| RF-055 | El KDS muestra pedidos en orden FIFO de envío con número de orden, mesa o "PARA LLEVAR", mesero, hora, ítems, modificadores y notas. | Un pedido enviado a las 12:01 aparece arriba de uno enviado a las 12:02. | MVP |
| RF-056 | Cocina pulsa "Aceptar" en un pedido; registra la hora y empieza el tiempo de preparación. No existe rechazo. | El pedido cambia a "En preparación" y muestra el temporizador de preparación. | MVP |
| RF-057 | Cocina marca el pedido (o ítems) como "Listo"; empieza el tiempo de entrega y se notifica al mesero. | El celular del mesero suena o vibra y muestra "Mesa 5 — pedido listo". | MVP |
| RF-058 | Colores por tiempo de espera en el KDS con umbrales configurables (ej. verde < 10 min, amarillo < 20, rojo ≥ 20). | El color cambia automáticamente al cruzar el umbral. | MVP |
| RF-059 | El mesero marca el pedido como entregado; se cierra el tiempo de entrega. | Se guardan las cuatro marcas: `sent_at`, `accepted_at`, `ready_at`, `delivered_at`. | MVP |
| RF-060 | Imprimir pre-cuenta de una cuenta. | Muestra ítems, descuentos, subtotal, propina sugerida y total; se puede reimprimir y queda registro. | MVP |
| RF-061 | Cobrar una cuenta con uno o varios métodos de pago, calcular cambio, aplicar propina y descuentos. | La cuenta queda "Pagada" solo cuando la suma de pagos ≥ total; el cambio solo se da sobre efectivo. | MVP |
| RF-062 | Imprimir recibo térmico al pagar (automático o a petición según configuración). | El recibo incluye folio, métodos de pago, cambio, propina y pie configurado. | MVP |
| RF-063 | Liberar la mesa cuando todas sus cuentas están pagadas. | Mientras haya una cuenta abierta la mesa no se libera; al liberarse vuelve a "Libre". | MVP |
| RF-064 | Registrar retiros y depósitos de efectivo en el turno con motivo. | Afectan el efectivo esperado del corte. | MVP |
| RF-065 | Corte de caja: conteo por denominación o total contado, esperado contra contado, diferencia y reporte impreso. Si el conteo por denominación es obligatorio u opcional es configurable por caja (PA-025; por defecto opcional). **Se puede hacer sin conexión** (PA-042): queda como corte **provisional** y se confirma al sincronizar (doc 05 paso 13). | El corte queda cerrado e inmutable; no se puede cobrar en efectivo en esa caja hasta abrir otro turno. | MVP |
| RF-066 | Cancelar ítems antes de enviarlos a cocina sin permiso especial (se borran del borrador). | No queda en bitácora como cancelación. | MVP |
| RF-067 | Cancelar ítems ya enviados a cocina con permiso o autorización y motivo obligatorio. | El KDS muestra el ítem tachado con "CANCELADO" y se imprime una comanda de cancelación. | MVP |
| RF-068 | ~~Anular una cuenta pagada.~~ **Retirado** (PA-012, 2026-11-11): el sistema **no** tiene anulación de cuentas. Las correcciones se hacen con RF-069. | — | — |
| RF-069 | Reabrir una cuenta pagada para corregirla, con permiso `bill.reopen` (o 🔑) y motivo obligatorio. Solo si **todos** sus pagos fueron en efectivo (PA-013). Se puede reabrir **desde otro turno** (ej. hubo cambio de turno mientras se resolvía; S-28), dentro del mismo día de negocio. La reapertura no depende de si la mesa está ocupada (S-29). Solo con conexión y con un turno abierto en la caja que reabre. | La cuenta vuelve a "Abierta" y sus pagos pasan a "Revertido". El efectivo devuelto se registra como **reverso por reapertura** en el turno abierto de la caja que reabre; el turno original no cambia (si ya se cerró, sigue igual). Se registra en bitácora y se puede corregir y volver a cobrar. Una cuenta pagada con tarjeta, transferencia u otro método **no se puede reabrir ni corregir en el sistema** (PA-051, decisión de RENGO). | MVP |
| RF-070 | Bitácora de auditoría de toda acción sensible (ver RF-255). | Cada registro incluye usuario, autorizador, dispositivo, IP, fecha, entidad, acción, antes y después. | MVP |
| RF-071 | Abrir el cajón de dinero sin venta con permiso y registro. | Queda en bitácora. | F2 |

### 1.3 Mesas, pedidos y cuentas (RF-100 a RF-129)

| ID | Requisito | Criterio de aceptación | Prioridad |
|---|---|---|---|
| RF-100 | Una ocupación de mesa puede tener varios pedidos (rondas). | Se pueden enviar N rondas; cada una genera su comanda y su tarjeta en el KDS. | MVP |
| RF-101 | Toda ocupación nace con una cuenta "Cuenta 1". Se pueden crear más cuentas (ej. por persona) y nombrarlas. | Crear "Cuenta 2 — Ana" y asignarle ítems. | MVP |
| RF-102 | Asignar y mover ítems entre cuentas de la misma ocupación mientras la cuenta origen y destino no estén pagadas. | Mover recalcula los totales de ambas cuentas. | MVP |
| RF-103 | Un ítem pertenece a un solo pedido y una sola cuenta; no se divide un ítem entre cuentas ni pedidos. | La API rechaza asignar un ítem a dos cuentas (`409 ITEM_ALREADY_ASSIGNED`). | MVP |
| RF-104 | Separar una línea con cantidad > 1 en unidades entre cuentas (PA-001). La línea se **divide** en dos ítems (ej. 3 cervezas → 2 + 1) en el mismo pedido, con el mismo producto, modificadores, nota y precio unitario; después cada ítem se mueve a su cuenta. Así se sigue cumpliendo "un ítem = una cuenta" (RF-103). | Separar 1 de "3 × Cerveza" deja "2 × Cerveza" en la Cuenta 1 y "1 × Cerveza" en la Cuenta 2; el total de la mesa no cambia. No se puede dividir un ítem con descuento de ítem aplicado (hay que quitarlo primero), ni uno de una cuenta pagada. | MVP |
| RF-105 | Unir mesas: la ocupación de la mesa B se fusiona con la de A (pedidos y cuentas se conservan). Requiere permiso. | La mesa B pasa a "Unida a A" y se libera junto con A. | MVP |
| RF-106 | Transferir una ocupación a otra mesa libre. | El historial conserva la mesa original. | MVP |
| RF-107 | Transferir una mesa o cuenta a otro mesero, con permiso. | El nuevo mesero recibe las notificaciones de "Listo". | MVP |
| RF-108 | Cada cuenta se paga por separado. | Pagar la cuenta 1 no afecta la cuenta 2. | MVP |
| RF-109 | Mostrar el estado de cada mesa: Libre, Ocupada, Con pedido en cocina, Lista para entregar, Pre-cuenta impresa, Unida, Bloqueada. | Colores e íconos configurables por estado. | MVP |

### 1.4 Recetas y costeo (RF-130 a RF-149)

| ID | Requisito | Criterio de aceptación | Prioridad |
|---|---|---|---|
| RF-130 | CRUD de insumos: nombre, unidad de medida, costo unitario, categoría de insumo. | El historial de costos se conserva con fecha de vigencia. | MVP |
| RF-131 | Catálogo de unidades con conversiones (kg↔g, l↔ml, unidad). | Una receta en gramos usa un insumo costeado por kg correctamente. | MVP |
| RF-132 | Receta por producto, por modificador y por componente de combo: insumos, cantidad, merma % opcional. | El costo teórico = Σ (cantidad × (1 + merma) × costo unitario convertido). | MVP |
| RF-133 | Sub-recetas (ej. "salsa de la casa" usada en varios platillos). | El costo de la sub-receta se propaga a los platillos. | F2 |
| RF-134 | Margen objetivo o % de costo objetivo por restaurante, sobrescribible por categoría y por producto. | Prioridad: producto > categoría > restaurante. | MVP |
| RF-135 | Precio sugerido = costo teórico / (1 − margen objetivo), redondeado según regla configurable (PA-045: a Q 0.50, Q 1.00 o Q 5.00; por defecto **Q 1.00 hacia arriba**). | Se muestra junto al precio asignado. El precio final siempre lo asigna el usuario. | MVP |
| RF-136 | Mostrar margen real con el precio asignado y aviso si está bajo el objetivo. | Ícono de alerta y color rojo en la lista de productos. | MVP |
| RF-137 | Consumo teórico de insumos según ventas de un periodo. | Reporte RPT-050. | MVP |
| RF-138 | Al cambiar el costo de un insumo, recalcular costos teóricos y marcar productos que quedaron bajo el objetivo. | Lista "Productos afectados" tras guardar. | MVP |
| RF-139 | Congelar el costo teórico de cada ítem al momento de la venta (`unit_cost_snapshot`). | Cambiar costos hoy no altera la rentabilidad reportada de ventas pasadas. | MVP |

### 1.5 Dashboard (RF-150 a RF-169)

| ID | Requisito | Criterio de aceptación | Prioridad |
|---|---|---|---|
| RF-150 | Pantalla de inicio con el reporte del día de la sucursal seleccionada. | Carga en ≤ 2 s y se actualiza en tiempo real o cada 60 s. | MVP |
| RF-151 | Indicadores: ventas, órdenes, ticket promedio, comensales, ventas por método de pago, mesas abiertas, órdenes en cocina, tiempos promedio de preparación y entrega, top productos, cancelaciones y descuentos. | Cada indicador usa la fórmula de [12-catalogo-reportes.md](12-catalogo-reportes.md). | MVP |
| RF-152 | Comparación contra el mismo día de la semana anterior a la misma hora. | Muestra variación % con flecha y color. | MVP |
| RF-153 | El dashboard muestra solo lo que el rol puede ver (ej. un mesero ve solo sus ventas). | Permiso `dashboard.view_all` vs. `dashboard.view_own`. | MVP |

### 1.6 Reportería (RF-170 a RF-199)

| ID | Requisito | Criterio de aceptación | Prioridad |
|---|---|---|---|
| RF-170 | Módulo único de reportes con el catálogo de [12-catalogo-reportes.md](12-catalogo-reportes.md). | Todos los reportes viven en una sola sección con buscador. | MVP |
| RF-171 | Filtros comunes: rango de fechas (hoy, ayer, semana, mes, personalizado, histórico), sucursal, turno, mesero, tipo de orden, método de pago, categoría. | Los filtros no aplicables a un reporte se ocultan. | MVP |
| RF-172 | Exportar cada reporte a CSV, Excel (.xlsx) y PDF. | El archivo respeta filtros, moneda y zona horaria del cliente. | MVP (CSV, Excel) / F2 (PDF) |
| RF-173 | Mapa de calor de ventas por hora y día de la semana. | Celdas con intensidad por monto. | F2 |
| RF-174 | Un usuario solo ve las sucursales que tiene asignadas. | Filtro de sucursal limitado. | MVP |
| RF-175 | Reportes pesados (rango > 92 días) se generan en segundo plano y se avisan al terminar. | — | F2 |

### 1.7 Chatbot de IA para reportes (RF-200 a RF-219)

| ID | Requisito | Criterio de aceptación | Prioridad |
|---|---|---|---|
| RF-200 | Chat dentro de reportería: pregunta en lenguaje natural, respuesta en texto, tabla o gráfica. | "¿Cuánto vendí en efectivo la semana pasada?" responde un monto correcto con el periodo usado. | F2 |
| RF-201 | Proveedor de LLM configurable y desacoplado (interfaz `LlmProvider`). | Cambiar de proveedor solo cambia `.env` / configuración. | F2 |
| RF-202 | Acceso solo de lectura sobre la capa semántica; nunca SQL libre. | Ver [10-chatbot-ia.md](10-chatbot-ia.md). | F2 |
| RF-203 | Respeta permisos y sucursales del usuario. | Un gerente de la sucursal A no obtiene datos de B. | F2 |
| RF-204 | Límite de uso por cliente: **100 preguntas al mes** por defecto (`license.limits`, S-13). | Al llegar al límite el chat se bloquea hasta el mes siguiente y muestra "Alcanzaste el límite de consultas del mes. Contacta a RENGO para aumentarlo." | F2 |
| RF-205 | **No se guarda el historial de conversaciones** (PA-032). Se guarda solo la pregunta y la consulta interpretada, para poder repetirla, con tokens y costo. El contexto de la conversación vive solo durante la sesión y se borra al cerrarla. | El usuario ve sus consultas recientes y las puede volver a ejecutar; el administrador ve el uso y el costo. | F2 |
| RF-206 | Indicar en la interfaz que funciona solo con internet. | Sin conexión el chat se deshabilita con aviso. | F2 |

### 1.8 Modo sin internet (RF-220 a RF-249)

Detalle en [09-modo-sin-internet.md](09-modo-sin-internet.md).

| ID | Requisito | Criterio de aceptación | Prioridad |
|---|---|---|---|
| RF-220 | PWA instalable con service worker; carga sin conexión tras la primera visita. | En modo avión la app abre y muestra el menú. | MVP |
| RF-221 | Guardar en IndexedDB menú, configuración, mesas, ocupaciones y cuentas abiertas de la sucursal. | Sin conexión se ven las mesas abiertas al momento del corte. | MVP |
| RF-222 | Identificadores generados en el dispositivo (ULID). | Ningún registro creado offline choca con otro al sincronizar. | MVP |
| RF-223 | Outbox con clave de idempotencia, orden y reintentos con espera exponencial. | Reenviar la misma operación no la duplica. | MVP |
| RF-224 | Folio temporal por dispositivo (`<prefijo>-<n>`) y definitivo al sincronizar. | Los impresos offline muestran el temporal; la app muestra ambos tras sincronizar. | MVP |
| RF-225 | Impresión local directa de comanda, pre-cuenta y recibo sin servidor. | Sin internet, enviar a cocina imprime la comanda. | MVP |
| RF-226 | Indicador de conexión y número de operaciones pendientes en cada dispositivo. | Visible en la barra superior. | MVP |
| RF-227 | Aviso antes de cerrar la app con operaciones pendientes. | `beforeunload` muestra advertencia. | MVP |
| RF-228 | Bloquear sin conexión: abrir turno de caja (PA-042), reapertura de cuentas pagadas, chatbot, cambios de configuración, unir/transferir mesas de otro dispositivo. | Los botones se deshabilitan con explicación. | MVP |
| RF-229 | Pantalla de revisión de conflictos para el gerente. | Lista conflictos con acción "Aceptar", "Descartar" o "Corregir". | MVP |
| RF-230 | Registro local de fallos de conexión enviado al reconectar. | Reporte de cortes por dispositivo en administración. | MVP |

### 1.9 Administración de la plataforma (RF-250 a RF-269)

| ID | Requisito | Criterio de aceptación | Prioridad |
|---|---|---|---|
| RF-250 | Registro de clientes de la plataforma (dominio, puerto, base, estado, plan, módulos) en `/opt/mise/clients/registry.csv` y en cada base. | `nuevo-cliente.sh` agrega la fila. | MVP |
| RF-251 | Script de alta de cliente nuevo (ver [13-operacion.md](13-operacion.md)). | Un cliente nuevo queda operativo en ≤ 10 min. | MVP |
| RF-252 | Suspender y reactivar un cliente. | Suspendido: la API responde `402 LICENSE_SUSPENDED` excepto `/api/health` y la exportación de datos. | MVP |
| RF-253 | Respaldo manual por cliente. | `respaldo-cliente.sh <Cliente>` genera un `pg_dump` con fecha. | MVP |
| RF-254 | Plantillas de configuración inicial (roles, métodos de pago, motivos, impresos, menú de ejemplo). | El seed aplica la plantilla elegida. | MVP |
| RF-255 | Bitácora de auditoría por cliente: quién, qué, cuándo, desde qué dispositivo. | Consultable y exportable; no se puede editar ni borrar desde la app. | MVP |
| RF-256 | Licencia y módulos activos en la tabla de configuración de la base del cliente, con fecha de vencimiento. | Al vencer la licencia (y los días de gracia configurados en `license.grace_days`, que pueden ser 0) el cliente pasa a **modo solo lectura** (PA-015): puede consultar y exportar, pero no operar. Primer aviso 15 días antes y **un aviso nuevo cada día** desde entonces hasta renovar (S-32). | MVP |

### 1.10 Puntos de extensión (RF-270 a RF-279)

| ID | Requisito | Criterio de aceptación | Prioridad |
|---|---|---|---|
| RF-270 | Cada cuenta guarda NIT y nombre del receptor (o "CF") opcionales. Es el único punto de extensión de FEL en el MVP. | Se capturan al cobrar o antes y salen en el recibo. | MVP |
| RF-271 | Estado de facturación por cuenta. | Se agrega con una migración aditiva cuando se implemente FEL (PA-002, PA-003: sin IVA ni FEL por ahora). | F3 |
| RF-272 | Tabla de eventos de facturación (`invoice_events`) que consumirá el RPA, con errores y reintentos. | Igual que RF-271. | F3 |
| RF-273 | Tipo de orden como catálogo extensible (`MESA`, `PARA_LLEVAR`). | Agregar un tipo nuevo no requiere migración destructiva. | MVP |
| RF-274 | Desglose del IVA incluido. **Fuera de alcance por ahora** (PA-002): no se maneja IVA. | — | F3 |

---

## 2. Requisitos no funcionales

| ID | Categoría | Requisito | Criterio de aceptación |
|---|---|---|---|
| RNF-001 | Seguridad | Autenticación con usuario + contraseña (admin/gerente) y PIN en dispositivos registrados. | Contraseña mínima 10 caracteres; PIN 4–6 dígitos; ambos con hash **argon2id**. |
| RNF-002 | Seguridad | JWT de acceso de corta duración (15 min) que se **refresca solo** mientras se usa la app, con un token de refresco por sesión, rotativo y revocable, que **vence tras 12 horas sin actividad** (S-04). Sin bloqueo de pantalla por inactividad. | Revocar un dispositivo invalida su refresco en la siguiente petición. Una sesión sin uso durante 12 h ya no se puede refrescar. |
| RNF-003 | Seguridad | Un `JWT_SECRET` distinto por cliente, en su `.env`. | Un token del cliente A es rechazado por el backend de B. |
| RNF-004 | Seguridad | Secretos solo en `.env` (permisos `600`, dueño el usuario del servicio); nunca en el repositorio ni en la base. | `git grep` de secretos no encuentra nada; `.env` en `.gitignore`. |
| RNF-005 | Seguridad | HTTPS obligatorio (Caddy, certificados automáticos); HSTS. | HTTP redirige a HTTPS. |
| RNF-006 | Seguridad | El backend escucha solo en `127.0.0.1`. | `ss -tlnp` no muestra puertos de backend en `0.0.0.0`. |
| RNF-007 | Seguridad | Firewall (ufw): solo 22 (con llave, sin contraseña), 80 y 443. PostgreSQL solo local. | Escaneo externo muestra solo esos puertos. |
| RNF-008 | Seguridad | Bloqueo tras 5 intentos fallidos de PIN o contraseña durante 5 min (configurable). Limitación de peticiones en login. | Prueba de fuerza bruta bloqueada. |
| RNF-009 | Seguridad | Usuario de PostgreSQL de solo lectura por cliente para el chatbot, con acceso solo al esquema `semantic`. | `INSERT` con ese usuario falla. |
| RNF-010 | Seguridad | Validación de toda entrada con Zod; consultas parametrizadas (Prisma). | Pruebas de inyección fallan. |
| RNF-011 | Seguridad | Cabeceras de seguridad: CSP, `X-Content-Type-Options`, `Referrer-Policy`. | Verificado en pruebas. |
| RNF-020 | Rendimiento | Enviar pedido → visible en KDS ≤ 2 s (p95) con conexión normal. | Medido en pruebas de carga. |
| RNF-021 | Rendimiento | Soportar 30 dispositivos simultáneos por sucursal y 3 sucursales por cliente. | Prueba de carga sin errores. |
| RNF-022 | Rendimiento | RAM por proceso backend ≤ 300 MB (objetivo 150 MB en reposo). pm2 `max_memory_restart: 400M`. | Monitoreo durante 7 días. |
| RNF-023 | Rendimiento | API p95 ≤ 300 ms en operaciones de servicio (abrir mesa, agregar ítem, pagar). | Medición en logs. |
| RNF-024 | Rendimiento | Las listas nunca devuelven columnas pesadas; paginación con máximo 200 registros. | Revisión de código y pruebas. |
| RNF-025 | Rendimiento | `connection_limit` de Prisma por cliente = 5; `max_connections` de PostgreSQL dimensionado (ver [13-operacion.md](13-operacion.md)). | Sin errores de conexiones agotadas. |
| RNF-030 | Tiempo real | Reconexión automática de WebSocket con espera exponencial (1 s → 30 s) y resincronización del estado al reconectar. | Tras cortar la red 1 min, el KDS se pone al día solo. |
| RNF-031 | Tiempo real | Latido (ping) cada 25 s; un cliente sin respuesta se considera desconectado a los 60 s. | — |
| RNF-040 | Disponibilidad | Disponibilidad mensual ≥ 99.5 % (excluye mantenimiento anunciado). | Monitor externo. |
| RNF-041 | Respaldos | `pg_dump` diario automático por base (03:00 hora del servidor) + respaldo antes de cada despliegue. | Archivo diario presente y verificado. |
| RNF-042 | Respaldos | Retención: 14 diarios, 8 semanales, 12 mensuales; copia fuera del servidor (Hetzner Storage Box u objeto S3). | Política aplicada por script. |
| RNF-043 | Respaldos | Prueba de restauración mensual en una base temporal. | Registro de la prueba. |
| RNF-050 | Compatibilidad | Chrome/Edge ≥ últimas 2 versiones (Android, Windows); Safari iOS/iPadOS ≥ 16 para meseros (sin impresión directa). | Matriz de pruebas en [14-plan-de-pruebas.md](14-plan-de-pruebas.md). |
| RNF-051 | Compatibilidad | Hardware mínimo recomendado: ver [06-arquitectura-adr.md](06-arquitectura-adr.md#7-hardware-recomendado). | — |
| RNF-060 | Usabilidad | Mobile first: toma de pedido usable con una mano en pantallas de 360 px de ancho. | Prueba con meseros. |
| RNF-061 | Usabilidad | KDS: letra mínima 20 px en ítems, alto contraste (WCAG AA), **sin modo oscuro** (PA-050), sonido configurable (tono, volumen, repetición). | Legible a 2 m. |
| RNF-062 | Usabilidad | Botones táctiles ≥ 44×44 px. | — |
| RNF-063 | Usabilidad | Sistema visual **Botanical Graphite** en toda la aplicación, con los tokens y las reglas de [18-sistema-de-diseno.md](18-sistema-de-diseno.md). | Ningún color fuera de los tokens; todas las combinaciones de texto cumplen WCAG 2.2 AA según la tabla del doc 18. |
| RNF-070 | Regional | Moneda GTQ, zona horaria America/Guatemala, español; todo configurable. Fechas guardadas en UTC (`timestamptz`). | Reportes por "día" usan la zona horaria de la sucursal. |
| RNF-080 | Observabilidad | Logs con pino en nivel `warn` en producción, JSON, con etiquetas `[AUTH]`, `[SYNC]`, `[PRINT]`, `[KDS]`, `[PAY]`, `[DB]`, `[AI]`. | `grep "\[SYNC\]"` encuentra los eventos. |
| RNF-081 | Observabilidad | Monitor por cron cada minuto con alertas por Telegram (ver [13-operacion.md](13-operacion.md)). | Alerta en ≤ 2 min tras caída. |
| RNF-090 | Privacidad | Datos personales mínimos (nombre/teléfono para llevar, NIT). Sin datos de tarjeta (la terminal es externa). | No se guardan números de tarjeta. |
| RNF-091 | Privacidad | Los datos de un cliente nunca se mezclan con otro (base separada). Exportación y borrado de datos de un cliente a solicitud. | Script de exportación. |
| RNF-092 | Privacidad | El chatbot no envía datos personales al LLM (solo agregados). | Revisión de prompts registrados. |
| RNF-100 | Mantenibilidad | Migraciones solo aditivas; aplicadas a todas las bases antes de compilar. | Revisión en cada PR. |
| RNF-101 | Mantenibilidad | Cobertura de pruebas ≥ 70 % en dominio (cálculos de cuentas, pagos, corte, costeo, sincronización). | Reporte de CI. |
| RNF-102 | Configurabilidad | Ningún valor propio de un restaurante en el código. | Revisión de código: búsqueda de literales de negocio. |
