# 03 — Actores, roles y matriz de permisos

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio**. Registra cada cambio en el [Control de cambios](README.md#control-de-cambios).

## 1. Actores

| Actor | Tipo | Descripción | Dispositivo típico |
|---|---|---|---|
| Operador de plataforma (RENGO) | Humano, externo al restaurante | Da de alta clientes, despliega versiones, monitorea, respalda. Acceso SSH al servidor. **No** es un usuario dentro de la app del cliente salvo que el cliente lo cree. | PC con SSH |
| Administrador | Humano | Dueño o encargado general. Configura todo y ve todos los reportes. | PC / tablet |
| Gerente | Humano | Supervisa el turno, autoriza descuentos y cancelaciones, revisa conflictos, hace cortes. | Tablet / celular |
| Cajero | Humano | Abre turno, cobra, imprime recibos, hace retiros y corte. | PC o tablet de caja |
| Mesero | Humano | Abre mesas, toma pedidos, divide cuentas, entrega, imprime pre-cuenta. | Celular propio o del restaurante |
| Cocina | Humano | Acepta pedidos y los marca como listos. | Tablet/pantalla KDS |
| Comensal | Humano, externo | No usa el sistema; recibe pre-cuenta y recibo. | — |
| Terminal de tarjeta | Sistema externo | Cobra tarjetas fuera del POS. El cajero registra el pago y la referencia manualmente. | Terminal del banco |
| Proveedor de LLM | Sistema externo | Interpreta preguntas del chatbot. | — |
| RPA de facturación | Sistema externo (futuro, fuera de alcance por ahora: PA-002/PA-003) | Emitirá FEL. Cómo se conecta se decide cuando se implemente. | — |
| Telegram | Sistema externo | Recibe alertas del monitor. | — |

## 2. Roles por defecto (plantilla)

Los roles son **configuración**: el seed crea estos cinco y el administrador puede editarlos, crear otros o borrarlos (excepto que siempre debe quedar al menos un usuario con `config.roles`).

| Rol | Propósito |
|---|---|
| Administrador | Acceso total al cliente. |
| Gerente | Operación completa + autorizaciones + reportes; configuración limitada. |
| Cajero | Caja, cobro y operación de mesas. |
| Mesero | Mesas propias, pedidos, cuentas, pre-cuenta. |
| Cocina | Solo KDS. |

Un usuario puede tener varios roles; sus permisos son la unión. Los permisos se evalúan **en el backend** en cada petición; el frontend solo oculta botones.

## 3. Catálogo de permisos

| Código | Descripción |
|---|---|
| `config.restaurant` | Editar datos del cliente, sucursales, logo, colores, regionales, tickets. |
| `config.menu` | Categorías, productos, modificadores, combos, precios, agotados. |
| `menu.toggle_soldout` | Marcar producto como agotado/disponible (sin editar el resto). |
| `config.tables` | Zonas, mesas, mapa. |
| `config.payments` | Métodos de pago, propina, motivos. |
| `config.discounts` | Activar o desactivar descuentos, catálogo de motivos y límite por rol (S-05). |
| `config.users` | Usuarios. |
| `config.roles` | Roles y permisos. |
| `config.devices` | Dispositivos e impresoras. |
| `config.recipes` | Insumos, recetas, costos, márgenes objetivo. |
| `cash.open_shift` | Abrir turno de caja. |
| `cash.close_shift` | Hacer corte de caja. |
| `cash.movement` | Retiros y depósitos. |
| `cash.open_drawer` | Abrir cajón sin venta. |
| `cash.view_expected` | Ver el efectivo esperado antes de contar (corte "a ciegas" si no lo tiene). |
| `table.open` | Abrir mesa / orden para llevar. |
| `table.view_all` | Ver y operar mesas de otros meseros. |
| `table.merge` | Unir mesas. |
| `table.move` | Cambiar ocupación de mesa. |
| `table.transfer_waiter` | Transferir mesa/cuenta a otro mesero. |
| `order.create` | Tomar pedido y enviar a cocina. |
| `order.cancel_sent` | Cancelar ítems ya enviados a cocina. |
| `bill.split` | Crear cuentas y mover ítems entre cuentas. |
| `bill.print_precheck` | Imprimir pre-cuenta. |
| `bill.reprint` | Reimprimir pre-cuenta o recibo. |
| `discount.apply` | Aplicar descuento dentro del tope del rol. |
| `discount.apply_unlimited` | Aplicar descuento sin tope. |
| `tip.edit` | Cambiar o quitar la propina sugerida. |
| `payment.register` | Registrar pagos y cerrar cuentas. |
| `bill.reopen` | Reabrir una cuenta pagada en efectivo (RF-069). No existe permiso de anulación. |
| `kds.operate` | Aceptar y marcar listo en KDS. |
| `kds.recall` | Regresar un pedido "Listo" a "En preparación". |
| `order.deliver` | Marcar pedido entregado. |
| `sync.resolve_conflicts` | Revisar y resolver conflictos de sincronización. |
| `dashboard.view_own` | Ver dashboard con sus propias ventas. |
| `dashboard.view_all` | Ver dashboard completo de la sucursal. |
| `reports.view` | Acceder a reportería. |
| `reports.financial` | Ver reportes de caja, rentabilidad y costos. |
| `reports.export` | Exportar reportes. |
| `reports.audit` | Ver bitácora de auditoría. |
| `ai.chat` | Usar el chatbot de reportes. |
| `branch.all` | Acceso a todas las sucursales (si no, solo las asignadas). |

## 4. Matriz de permisos por defecto

✅ = tiene el permiso · 🔑 = puede hacerlo con autorización de otro usuario (PIN) · — = no

| Permiso | Administrador | Gerente | Cajero | Mesero | Cocina |
|---|:-:|:-:|:-:|:-:|:-:|
| `config.restaurant` | ✅ | — | — | — | — |
| `config.menu` | ✅ | ✅ | — | — | — |
| `menu.toggle_soldout` | ✅ | ✅ | ✅ | — | ✅ |
| `config.tables` | ✅ | ✅ | — | — | — |
| `config.payments` | ✅ | — | — | — | — |
| `config.discounts` | ✅ | ✅ | — | — | — |
| `config.users` | ✅ | ✅ | — | — | — |
| `config.roles` | ✅ | — | — | — | — |
| `config.devices` | ✅ | ✅ | — | — | — |
| `config.recipes` | ✅ | ✅ | — | — | — |
| `cash.open_shift` | ✅ | ✅ | ✅ | — | — |
| `cash.close_shift` | ✅ | ✅ | ✅ | — | — |
| `cash.movement` | ✅ | ✅ | 🔑 | — | — |
| `cash.open_drawer` | ✅ | ✅ | 🔑 | — | — |
| `cash.view_expected` | ✅ | ✅ | — | — | — |
| `table.open` | ✅ | ✅ | ✅ | ✅ | — |
| `table.view_all` | ✅ | ✅ | ✅ | — | — |
| `table.merge` | ✅ | ✅ | ✅ | 🔑 | — |
| `table.move` | ✅ | ✅ | ✅ | ✅ | — |
| `table.transfer_waiter` | ✅ | ✅ | 🔑 | 🔑 | — |
| `order.create` | ✅ | ✅ | ✅ | ✅ | — |
| `order.cancel_sent` | ✅ | ✅ | 🔑 | 🔑 | — |
| `bill.split` | ✅ | ✅ | ✅ | ✅ | — |
| `bill.print_precheck` | ✅ | ✅ | ✅ | ✅ | — |
| `bill.reprint` | ✅ | ✅ | ✅ | 🔑 | — |
| `discount.apply` | ✅ | ✅ | ✅ (límite que fije el gerente) | 🔑 | — |
| `discount.apply_unlimited` | ✅ | ✅ | 🔑 | 🔑 | — |
| `tip.edit` | ✅ | ✅ | ✅ | ✅ | — |
| `payment.register` | ✅ | ✅ | ✅ | ✅ (configurable) | — |
| `bill.reopen` | ✅ | ✅ | 🔑 | — | — |
| `kds.operate` | ✅ | ✅ | — | — | ✅ |
| `kds.recall` | ✅ | ✅ | — | — | ✅ |
| `order.deliver` | ✅ | ✅ | ✅ | ✅ | — |
| `sync.resolve_conflicts` | ✅ | ✅ | — | — | — |
| `dashboard.view_own` | ✅ | ✅ | ✅ | ✅ | — |
| `dashboard.view_all` | ✅ | ✅ | — | — | — |
| `reports.view` | ✅ | ✅ | — | — | — |
| `reports.financial` | ✅ | ✅ | — | — | — |
| `reports.export` | ✅ | ✅ | — | — | — |
| `reports.audit` | ✅ | ✅ | — | — | — |
| `ai.chat` | ✅ | ✅ | — | — | — |
| `branch.all` | ✅ | — | — | — | — |

> **Resuelto (PA-010, S-06):** que el mesero cobre es **configurable**. En la plantilla el mesero **sí cobra** y el pago queda registrado en el sistema en ese momento; la caja también puede cobrar. Si un cliente quiere que solo cobre la caja, se le quita `payment.register` al rol Mesero desde la configuración, sin código. El efectivo que cobra el mesero va al **turno abierto de la caja principal** de la sucursal (PA-052); el mesero entrega ese efectivo al cajero y el reporte RPT-034 muestra cuánto debe entregar cada mesero. Si la caja principal no tiene turno abierto, el mesero no puede cobrar en efectivo (sí con otros métodos).

## 5. Reglas de autorización

1. **Mesas propias:** sin `table.view_all`, un usuario solo opera las ocupaciones donde es el mesero asignado.
2. **Descuentos:** el gerente decide si se permiten (`client_settings.discounts_enabled`) y el límite de cada rol (`max_discount_pct` y `max_discount_amount`). Si el descuento los supera, se pide autorización (🔑) de un usuario con `discount.apply_unlimited` o con tope suficiente.
3. **Autorización 🔑:** el sistema pide el PIN de otro usuario presente; valida que ese usuario tenga el permiso y esté activo en la sucursal; registra en bitácora `requested_by` y `authorized_by`. La autorización vale para **una sola acción**.
4. **Sucursal:** sin `branch.all`, toda consulta se filtra por las sucursales asignadas al usuario (backend).
5. **Módulo/licencia:** si el módulo está desactivado en la licencia, el permiso no tiene efecto (`403 MODULE_DISABLED`).
6. **Offline:** los permisos se evalúan localmente con la última copia de roles; las acciones 🔑 offline validan el PIN contra el hash guardado localmente del autorizador (ver [09-modo-sin-internet.md](09-modo-sin-internet.md#7-autenticación-sin-conexión)) y el backend las revalida al sincronizar.

## 6. Sesiones por tipo de dispositivo

**No hay bloqueo por inactividad** (S-04). El token de acceso dura poco (15 min) y se refresca solo mientras se usa la app; la sesión **vence después de 12 horas sin actividad**.

| Tipo de dispositivo | Inicio de sesión | Vencimiento de la sesión | Cambio de usuario |
|---|---|---|---|
| Celular personal de mesero | Usuario + contraseña la primera vez; luego PIN | 12 h sin actividad | No (dispositivo personal) |
| Caja (compartido) | Dispositivo registrado por admin; usuarios con PIN | 12 h sin actividad | Sí, con PIN |
| KDS (compartido) | Dispositivo registrado; sesión de rol Cocina | 12 h sin actividad (la pantalla queda siempre encendida) | Con PIN para acciones con autor |
| Administración | Usuario + contraseña | 12 h sin actividad | — |
