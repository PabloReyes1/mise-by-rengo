# 01 — Resumen ejecutivo y glosario

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio**. Registra cada cambio en el [Control de cambios](README.md#control-de-cambios).

## 1. Resumen ejecutivo

### 1.1 Qué es
**Mise by Rengo** es un sistema de punto de venta (POS) para restaurantes desarrollado por RENGO. Su nombre viene de *mise en place*: todo listo y en su lugar antes de servir. Cubre el ciclo completo de servicio en sala y para llevar: apertura de caja, mesas, toma de pedido desde el celular del mesero, cocina con pantalla (KDS) y comanda impresa, cuentas divididas, cobro con varios métodos de pago, corte de caja, recetas con costeo teórico, dashboard, reportería y un chatbot de IA que responde preguntas sobre los reportes.

### 1.2 Problema que resuelve
El primer cliente es un restaurante pequeño en Guatemala que lleva sus cuentas en papel. Eso implica:
- Errores al sumar cuentas y al cuadrar la caja.
- Comandas ilegibles o perdidas entre sala y cocina.
- Ningún dato confiable de ventas, tiempos de cocina, platillos rentables o desempeño por mesero.
- Imposibilidad de saber el costo real de cada platillo.

### 1.3 Propuesta de valor
| Para | Valor |
|---|---|
| Dueño / gerente | Ventas y caja cuadradas al día, rentabilidad por platillo, reportes y preguntas en lenguaje natural. |
| Mesero | Toma de pedido rápida en su celular, aviso cuando el pedido está listo, división de cuentas sin calculadora. |
| Cocina | Pedidos en orden de llegada, con sonido, temporizador y comanda impresa. |
| Cajero | Cobro con varios métodos, cambio calculado, recibo impreso y corte de caja guiado. |
| RENGO | Un solo producto que se vende a muchos restaurantes sin tocar código: todo es configuración. |

### 1.4 Principios de diseño
1. **Estándar y configurable.** Nada propio de un restaurante (menú, mesas, roles, tickets, logo, colores, métodos de pago, motivos) está fijo en el código.
2. **Multicliente con aislamiento por base de datos.** Un solo código compilado una vez; por cada cliente, un proceso backend, una base PostgreSQL y un dominio.
3. **Mobile first.** El mesero trabaja en su celular; la caja y el KDS en tablet o PC.
4. **Offline-first sin servidor local.** Si se va el internet, cada dispositivo sigue operando lo esencial y sincroniza al volver.
5. **Ligero.** Fastify, sin Docker, poco consumo de RAM por cliente para que un VPS pequeño aloje varios restaurantes.
6. **Auditable.** Cada acción sensible (descuento, cancelación, anulación, apertura de cajón) queda en la bitácora con usuario, hora y dispositivo.
7. **Solo agregar.** Las migraciones de base solo agregan; las operaciones offline solo agregan.

### 1.5 Alcance resumido
**Incluido:** configuración del restaurante, flujo operativo completo (mesa y para llevar), mesas con varios pedidos y varias cuentas, KDS de una estación, impresión térmica, recetas y costeo teórico (sin stock), dashboard del día, reportería centralizada con exportación, chatbot de IA de solo lectura, modo sin internet, administración de la plataforma multicliente.

**Fuera de alcance (solo puntos de extensión donde se indica):** delivery de cualquier tipo, pedidos en línea y menú público, reservaciones, inventario de existencias, impuestos configurables, facturación electrónica FEL (futura, vía RPA), varias estaciones de cocina (modelo preparado), servidor local, Docker, agentes de IA en WhatsApp/teléfono, pronósticos, promociones automáticas, reseñas, control de asistencia.

### 1.6 Arquitectura en una línea
VPS Hetzner → Caddy (HTTPS, estáticos del frontend PWA, `/api/*` por dominio) → un proceso Node/Fastify por cliente en pm2 (solo `127.0.0.1`) → un PostgreSQL con una base por cliente. Ver [06-arquitectura-adr.md](06-arquitectura-adr.md).

### 1.7 Métricas de éxito del MVP `[SUPUESTO]`
| Métrica | Meta |
|---|---|
| Tiempo de toma de un pedido de 4 ítems en celular | ≤ 60 s |
| Tiempo entre "Enviar a cocina" y verlo en el KDS (con internet) | ≤ 2 s (p95) |
| Diferencia de caja atribuible al sistema | Q 0.00 |
| Pérdida de pedidos durante un corte de internet | 0 |
| Disponibilidad mensual del servicio | ≥ 99.5 % |

## 2. Glosario

| Término | Definición |
|---|---|
| **Cliente** | Restaurante (empresa) que compra Mise by Rengo. Tiene su propia base, proceso backend, dominio y `.env`. No confundir con *comensal*. |
| **Sucursal** | Local físico de un cliente. Una base de cliente puede tener varias sucursales. |
| **Comensal** | Persona que come en el restaurante. |
| **Zona** | Área del restaurante (terraza, salón, barra) que agrupa mesas. |
| **Mesa** | Lugar físico configurado con nombre y capacidad. |
| **Ocupación** | Periodo desde que se abre una mesa hasta que se libera. Agrupa pedidos y cuentas. Las órdenes para llevar también tienen una ocupación sin mesa. |
| **Tipo de orden** | Catálogo extensible: `MESA`, `PARA_LLEVAR`. (Delivery no existe; queda como punto de extensión). |
| **Pedido / Ronda** | Conjunto de ítems enviados a cocina en un mismo envío. Una ocupación puede tener varios. La segunda ronda en adelante se marca "ADICIONAL". |
| **Ítem (línea)** | Un producto con cantidad, modificadores y nota dentro de un pedido. Pertenece a un solo pedido y a una sola cuenta. |
| **Modificador** | Variante o agregado de un producto (ej. "término medio", "extra queso"). Puede tener costo. |
| **Grupo de modificadores** | Conjunto de modificadores con reglas: obligatorio u opcional, mínimo y máximo de selecciones. |
| **Combo** | Producto compuesto por varios productos con precio propio. |
| **Cuenta** | Subdivisión de una ocupación que se cobra por separado (ej. una por persona). |
| **Pre-cuenta** | Impreso con el detalle y el total de una cuenta antes del pago. No es comprobante de pago. |
| **Recibo** | Comprobante térmico impreso tras el pago. No es factura fiscal. |
| **Comanda** | Ticket impreso para cocina con los ítems de un pedido. |
| **KDS** | *Kitchen Display System*: pantalla de cocina que muestra los pedidos. |
| **Estación** | Punto de preparación (cocina, barra). En esta fase existe **una sola**; el modelo está preparado para varias. |
| **Turno de caja** | Periodo entre la apertura y el corte de una caja, con fondo inicial. |
| **Fondo inicial** | Efectivo con que se abre la caja. |
| **Corte de caja** | Cierre de turno: efectivo esperado contra contado, diferencias, retiros y depósitos. |
| **Retiro / Depósito** | Salida o entrada de efectivo de la caja durante el turno, con motivo. |
| **Anulación** | Revertir una cuenta ya pagada. Requiere permiso y motivo. |
| **Cancelación** | Quitar un ítem o pedido antes del pago. Requiere permiso (si ya se envió a cocina) y motivo. |
| **Tiempo de espera** | Enviado a cocina → aceptado por cocina. |
| **Tiempo de preparación** | Aceptado → listo. |
| **Tiempo de entrega** | Listo → entregado por el mesero. |
| **Insumo** | Ingrediente con unidad de medida y costo unitario. |
| **Receta** | Lista de insumos y cantidades de un producto o modificador. |
| **Costo teórico** | Costo calculado con la receta y el costo unitario vigente de los insumos. |
| **Precio sugerido** | Precio propuesto por el sistema según el margen objetivo. Solo es una sugerencia. |
| **Margen** | (Precio − costo) / precio. |
| **% de costo (food cost)** | Costo / precio. |
| **Folio** | Número visible de una orden. Temporal sin conexión (`T2-0005`), definitivo al sincronizar. |
| **Outbox** | Cola local de operaciones pendientes de enviar al servidor. |
| **Clave de idempotencia** | Identificador único de una operación que evita aplicarla dos veces. |
| **ULID** | Identificador único ordenable por tiempo, generado en cada dispositivo. |
| **PWA** | *Progressive Web App*: aplicación web instalable con funcionamiento sin conexión. |
| **Service worker** | Script del navegador que guarda archivos en caché para uso sin conexión. |
| **ESC/POS** | Lenguaje de comandos de impresoras térmicas. |
| **Capa semántica** | Conjunto de vistas y métricas definidas que el chatbot puede consultar, en lugar de las tablas. |
| **FEL** | Factura Electrónica en Línea (SAT Guatemala). Fuera de alcance; se integrará vía RPA. |
| **NIT / CF** | Número de Identificación Tributaria / "Consumidor Final". |
| **RPA** | *Robotic Process Automation*: robot de software que hará la facturación FEL en el futuro. |
| **Caddy** | Servidor web que da HTTPS y enruta cada dominio a su backend. |
| **pm2** | Administrador de procesos de Node.js. |
| **Dual WAN** | Router con dos salidas a internet (fibra + 4G) que cambia automáticamente. |
