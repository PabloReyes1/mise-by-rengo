# 04 — Historias de usuario

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio**. Registra cada cambio en el [Control de cambios](README.md#control-de-cambios).

Formato: **Como** <rol>, **quiero** <acción>, **para** <beneficio>. Criterios en **Dado / Cuando / Entonces**. Cada historia indica los RF que cubre.

---

## Módulo A — Configuración

### HU-001 Configurar identidad del restaurante (RF-001, RF-004)
Como **administrador**, quiero cargar el nombre, logo y colores de mi restaurante, para que la app y los tickets muestren mi marca.
- **Dado** que estoy en Configuración › Restaurante, **cuando** subo un logo PNG y elijo el color primario `#8B1E3F`, **entonces** al recargar cualquier dispositivo ve el logo y el color sin que RENGO recompile nada.
- **Dado** un logo de más de 2 MB, **cuando** lo subo, **entonces** el sistema lo redimensiona o muestra "El archivo supera 2 MB".

### HU-002 Crear producto con modificadores (RF-011, RF-013, RF-014)
Como **gerente**, quiero crear un producto con grupos de modificadores, para que el mesero no pueda olvidar preguntar el término de la carne.
- **Dado** el grupo "Término" obligatorio con mínimo 1 y máximo 1, **cuando** lo asigno a "Lomito", **entonces** al tomar el pedido no se puede agregar Lomito sin elegir término.
- **Dado** el grupo "Extras" opcional con máximo 3 y "Extra queso" a Q 5.00, **cuando** el mesero elige 2 extras, **entonces** el precio de la línea suma Q 10.00.
- **Dado** que intenta elegir 4 extras, **entonces** el sistema bloquea la cuarta selección y muestra "Máximo 3".

### HU-003 Marcar producto agotado (RF-011)
Como **cocina**, quiero marcar un producto como agotado, para que los meseros no lo vendan.
- **Dado** que "Pepián" está activo, **cuando** lo marco agotado en el KDS, **entonces** en ≤ 2 s aparece en gris con la etiqueta "AGOTADO" en todos los celulares y no se puede agregar.
- **Dado** un pedido en borrador que ya contenía Pepián, **cuando** el mesero intenta enviarlo, **entonces** se le avisa "Pepián se agotó" y debe quitarlo o confirmarlo con un gerente `[SUPUESTO]`.

### HU-004 Crear combo (RF-015)
Como **gerente**, quiero crear "Combo almuerzo" con plato fuerte a elegir y bebida a elegir a Q 45.00, para vender menús del día.
- **Dado** el combo con componentes elegibles, **cuando** el mesero lo agrega, **entonces** debe elegir un plato y una bebida; la comanda muestra el combo y debajo cada componente con sus modificadores.

### HU-005 Configurar mesas y zonas (RF-020)
Como **gerente**, quiero crear zonas "Salón" y "Terraza" con sus mesas, para que los meseros las ubiquen.
- **Dado** la zona Terraza con mesas T1–T6, **cuando** un mesero abre la vista de mesas, **entonces** ve las pestañas por zona y el estado de cada mesa.

### HU-006 Configurar métodos de pago y propina (RF-025, RF-027)
Como **administrador**, quiero definir mis métodos de pago y la propina sugerida, para cobrar como trabaja mi restaurante.
- **Dado** que creo "Transferencia" con "pide referencia", **cuando** el cajero cobra con ese método, **entonces** el campo referencia es obligatorio.
- **Dado** propina sugerida 10 % editable, **cuando** se cobra una cuenta de Q 200.00, **entonces** se propone Q 20.00 y el cajero puede cambiarla a Q 0.00.

### HU-007 Crear un rol personalizado (RF-031)
Como **administrador**, quiero crear el rol "Capitán de meseros" con permisos de unir mesas y transferir, para delegar sin dar acceso de gerente.
- **Dado** el rol nuevo con `table.merge` y `table.transfer_waiter`, **cuando** un capitán une dos mesas, **entonces** no se le pide autorización.

### HU-008 Registrar dispositivo e impresora (RF-035, RF-036, RF-037)
Como **administrador**, quiero registrar la tablet de caja y su impresora USB de 80 mm, para que los recibos salgan ahí.
- **Dado** la tablet registrada como "Caja 1" con prefijo de folio `C1`, **cuando** pulso "Imprimir prueba", **entonces** sale un ticket con el nombre del dispositivo, fecha y la tabla de caracteres (ñ, á, Q).

### HU-009 Configurar descuentos y motivos (RF-026, RF-028)
Como **administrador**, quiero un catálogo de descuentos con motivos, para controlar por qué se descuenta.
- **Dado** el motivo "Cortesía de la casa" y tope de Cajero 10 %, **cuando** un cajero aplica 15 %, **entonces** se pide PIN de gerente y la bitácora registra ambos usuarios.

---

## Módulo B — Caja

### HU-010 Abrir turno de caja (RF-050)
Como **cajero**, quiero abrir mi turno con el fondo inicial, para empezar a cobrar.
- **Dado** que no hay turno abierto en "Caja 1", **cuando** ingreso fondo Q 500.00, **entonces** el turno queda abierto con mi usuario, hora y dispositivo.
- **Dado** que ya hay un turno abierto en esa caja, **cuando** intento abrir otro, **entonces** se muestra "Ya hay un turno abierto por <usuario> desde <hora>".

### HU-011 Registrar retiro de efectivo (RF-064)
Como **cajero**, quiero registrar un retiro de Q 300.00 para pagar al proveedor de gas, para que el corte cuadre.
- **Dado** el turno abierto, **cuando** registro un retiro con motivo "Pago a proveedor", **entonces** el efectivo esperado baja Q 300.00 y se imprime un comprobante de retiro (si está configurado).

### HU-012 Corte de caja (RF-065)
Como **cajero**, quiero hacer el corte de mi turno, para entregar la caja cuadrada.
- **Dado** que hay cuentas abiertas cobradas parcialmente en mi turno, **cuando** inicio el corte, **entonces** se me avisa y puedo continuar (las cuentas siguen abiertas para el siguiente turno) `[SUPUESTO]`.
- **Dado** esperado Q 2,350.00 y contado Q 2,340.00, **cuando** confirmo, **entonces** se registra diferencia −Q 10.00, se pide comentario obligatorio si la diferencia supera el umbral configurado y se imprime el corte.
- **Dado** que no tengo `cash.view_expected`, **cuando** hago el corte, **entonces** cuento primero (corte a ciegas) y solo después veo la diferencia.
- **Dado** que no hay internet, **cuando** intento el corte, **entonces** el botón está deshabilitado con "Requiere conexión".

---

## Módulo C — Mesas y pedidos

### HU-020 Abrir mesa (RF-051)
Como **mesero**, quiero abrir la mesa 5 con 4 comensales, para empezar a tomar el pedido.
- **Dado** que la mesa 5 está libre, **cuando** la abro con 4 comensales, **entonces** queda "Ocupada" a mi nombre con "Cuenta 1" creada.
- **Dado** que otro mesero la abrió segundos antes, **cuando** intento abrirla, **entonces** veo "La mesa 5 ya fue abierta por Luis" y no se crea una segunda ocupación.

### HU-021 Crear orden para llevar (RF-052)
Como **cajero**, quiero crear un pedido para llevar a nombre de "Sra. López, 5555-1234" recibido por teléfono, para mandarlo a cocina.
- **Dado** el botón "Para llevar", **cuando** ingreso el nombre y los productos y envío, **entonces** la comanda dice "PARA LLEVAR — Sra. López" y la orden aparece en la lista de para llevar.

### HU-022 Tomar pedido en el celular (RF-053)
Como **mesero**, quiero agregar productos con modificadores y notas rápido desde mi celular, para no hacer esperar a la mesa.
- **Dado** la mesa 5 abierta, **cuando** busco "lom", **entonces** aparece "Lomito" en ≤ 300 ms (búsqueda local).
- **Dado** que agrego 2 Lomitos término medio con nota "sin cebolla", **entonces** se ve una línea "2 × Lomito · Término medio · Nota: sin cebolla".
- **Dado** que cierro la app por error, **cuando** la vuelvo a abrir, **entonces** el borrador sigue ahí.

### HU-023 Enviar a cocina (RF-054, RF-055)
Como **mesero**, quiero enviar el pedido a cocina con un toque, para que empiecen a prepararlo.
- **Dado** un borrador con 3 líneas, **cuando** pulso "Enviar a cocina", **entonces** el KDS suena y muestra la orden al final de la cola, y la impresora de cocina imprime la comanda.
- **Dado** que es la segunda ronda de la mesa 5, **entonces** la comanda y la tarjeta del KDS dicen "ADICIONAL".
- **Dado** que la impresora no responde, **entonces** el mesero ve "Comanda no impresa — reintentar" y el pedido igual llega al KDS.

### HU-024 Aceptar pedido en cocina (RF-056)
Como **cocina**, quiero aceptar un pedido, para indicar que empecé a prepararlo.
- **Dado** el pedido #0042 en "Recibido" con 3 min de espera, **cuando** pulso "Aceptar", **entonces** pasa a "En preparación", se guarda `accepted_at` y el temporizador de preparación inicia en 00:00.

### HU-025 Marcar listo (RF-057)
Como **cocina**, quiero marcar un pedido como listo, para que el mesero lo recoja.
- **Dado** el pedido #0042 en preparación, **cuando** pulso "Listo", **entonces** el celular del mesero asignado suena/vibra con "Mesa 5 — #0042 listo" y la tarjeta sale del KDS a "Listos" (visible 10 min).
- **Dado** que el mesero no tiene la app abierta, **entonces** recibe la notificación al volver a abrirla y la mesa 5 se ve en color "Listo para entregar" en la caja.

### HU-026 Marcar entregado (RF-059)
Como **mesero**, quiero marcar el pedido como entregado, para cerrar el tiempo de entrega.
- **Dado** el pedido #0042 en "Listo", **cuando** pulso "Entregado", **entonces** se guarda `delivered_at` y se calcula el tiempo de entrega.

### HU-027 Cancelar ítem enviado (RF-067)
Como **mesero**, quiero cancelar un ítem que ya fue a cocina porque el comensal cambió de opinión, para no cobrarlo.
- **Dado** que no tengo `order.cancel_sent`, **cuando** cancelo "1 × Lomito", **entonces** se pide motivo y PIN de un gerente.
- **Dado** la autorización, **entonces** el KDS muestra el ítem tachado con "CANCELADO", se imprime comanda de cancelación y la bitácora registra motivo, solicitante y autorizador.

### HU-028 Dividir cuenta (RF-101, RF-102, RF-103)
Como **mesero**, quiero dividir la mesa 5 en una cuenta por persona, para que cada uno pague lo suyo.
- **Dado** la mesa con 6 líneas en "Cuenta 1", **cuando** creo "Cuenta 2" y arrastro 2 líneas, **entonces** ambas cuentas muestran sus totales recalculados.
- **Dado** que "Cuenta 2" ya está pagada, **cuando** intento mover un ítem a ella, **entonces** se rechaza: "No se puede modificar una cuenta pagada".
- **Dado** la línea "3 × Cerveza", **cuando** intento mover 1 sola unidad, **entonces** el comportamiento depende de PA-001 `[PENDIENTE DE DEFINIR]`.

### HU-029 Unir mesas (RF-105)
Como **mesero**, quiero unir las mesas 5 y 6 porque llegó más gente, para manejarlas como una sola.
- **Dado** ambas ocupadas, **cuando** uno 6 a 5 (con autorización si no tengo permiso), **entonces** los pedidos y cuentas de 6 pasan a la ocupación de 5 y la mesa 6 muestra "Unida a 5".

### HU-030 Transferir mesa a otro mesero (RF-107)
Como **gerente**, quiero pasar las mesas de Ana a Luis al terminar su turno, para que Luis las atienda.
- **Dado** 3 mesas de Ana, **cuando** las transfiero a Luis, **entonces** Luis las ve como propias, recibe los avisos de "Listo" y la bitácora registra la transferencia.

---

## Módulo D — Cobro

### HU-040 Imprimir pre-cuenta (RF-060)
Como **mesero**, quiero imprimir la pre-cuenta de la cuenta 1, para que el comensal la revise.
- **Dado** la cuenta con Q 185.00, **cuando** imprimo la pre-cuenta, **entonces** sale con detalle, propina sugerida y total, y la mesa cambia a "Pre-cuenta impresa".

### HU-041 Cobrar con varios métodos (RF-061, RF-062)
Como **cajero**, quiero cobrar una cuenta parte en efectivo y parte con tarjeta, para aceptar cómo paga el comensal.
- **Dado** total Q 203.50 (incluida propina), **cuando** registro tarjeta Q 100.00 con referencia y efectivo Q 150.00, **entonces** el cambio es Q 46.50, la cuenta queda pagada y se imprime el recibo.
- **Dado** que registro tarjeta Q 250.00 en una cuenta de Q 203.50, **entonces** se rechaza: "El excedente solo puede darse como cambio en efectivo" `[SUPUESTO]`.

### HU-042 Aplicar descuento (RF-026)
Como **cajero**, quiero aplicar 10 % de descuento a la cuenta por "Cliente frecuente", para premiar al cliente.
- **Dado** que mi tope es 10 %, **cuando** aplico 10 % con motivo, **entonces** se aplica sin autorización y queda en bitácora.

### HU-043 Anular cuenta pagada (RF-068)
Como **gerente**, quiero anular una cuenta cobrada por error, para corregir la caja.
- **Dado** la cuenta pagada en efectivo, **cuando** la anulo con motivo "Cobro duplicado", **entonces** la cuenta pasa a "Anulada", se registra un movimiento negativo en el turno abierto y, si tenía factura emitida, se genera evento `ANULAR` para el RPA.
- **Dado** que no hay internet, **entonces** la anulación está bloqueada.

### HU-044 Liberar mesa (RF-063)
Como **cajero**, quiero que la mesa se libere al pagarse todas sus cuentas, para que se pueda volver a usar.
- **Dado** la mesa 5 con cuenta 1 pagada y cuenta 2 abierta, **entonces** sigue ocupada. **Cuando** se paga la cuenta 2, **entonces** la mesa queda "Libre" (o "Por limpiar" si está configurado `[SUPUESTO]`).

---

## Módulo E — Recetas y costeo

### HU-050 Cargar receta y ver precio sugerido (RF-132, RF-135, RF-136)
Como **gerente**, quiero cargar la receta del Lomito, para saber cuánto me cuesta y a cuánto debería venderlo.
- **Dado** el insumo "Lomito de res" a Q 120.00/kg y la receta con 250 g, más papas (Q 0.90 de costo), **cuando** guardo, **entonces** el costo teórico es Q 30.90.
- **Dado** % de costo objetivo 30 %, **entonces** el precio sugerido es Q 103.00 (redondeo a Q 1.00).
- **Dado** precio asignado Q 95.00, **entonces** se muestra margen real 67.5 % y el aviso "Bajo el objetivo (70 %)".

### HU-051 Actualizar costo de un insumo (RF-138)
Como **gerente**, quiero actualizar el costo de la carne, para ver qué platillos se afectan.
- **Dado** que cambio el costo de Q 120.00 a Q 135.00/kg, **cuando** guardo, **entonces** se lista "Productos afectados" con su nuevo costo y margen.

---

## Módulo F — Dashboard y reportes

### HU-060 Ver el día en el dashboard (RF-150 a RF-152)
Como **dueño**, quiero ver al abrir la app cómo va el día, para tomar decisiones rápido.
- **Dado** que son las 14:00 del martes, **entonces** veo ventas, órdenes, ticket promedio y la comparación contra el martes anterior hasta las 14:00.

### HU-061 Reporte de ventas por mesero (RF-170, RF-171)
Como **gerente**, quiero ver ventas y propinas por mesero del mes, para calcular incentivos.
- **Dado** el filtro "mes actual" y sucursal Centro, **entonces** veo por mesero: órdenes, ventas, ticket promedio y propinas.

### HU-062 Exportar a Excel (RF-172)
Como **administrador**, quiero exportar las ventas del mes a Excel, para enviarlas a mi contador.
- **Dado** el reporte filtrado, **cuando** pulso "Excel", **entonces** descargo un .xlsx con los mismos datos, montos como número y fechas en hora de Guatemala.

### HU-063 Preguntar al chatbot (RF-200 a RF-206)
Como **dueño**, quiero preguntar "¿cuál fue mi platillo más vendido en octubre?", para no buscar entre reportes.
- **Dado** conexión y permiso `ai.chat`, **cuando** pregunto, **entonces** recibo el nombre, cantidad y monto, el periodo interpretado ("1–31 oct 2026") y un enlace al reporte equivalente.
- **Dado** la pregunta "borra las ventas de ayer", **entonces** responde que solo puede consultar información.
- **Dado** la pregunta "¿quién ganará el partido?", **entonces** responde que solo atiende preguntas sobre los reportes del restaurante.

---

## Módulo G — Sin internet

### HU-070 Seguir tomando pedidos sin internet (RF-220 a RF-225)
Como **mesero**, quiero seguir tomando pedidos si se cae el internet, para no detener el servicio.
- **Dado** que se cae la conexión, **entonces** mi barra superior muestra "Sin conexión · 0 pendientes".
- **Cuando** envío un pedido a cocina, **entonces** recibe folio temporal `M3-0012`, se imprime la comanda directamente en la impresora de cocina (si mi dispositivo tiene ruta de impresión) y el contador muestra "1 pendiente".
- **Cuando** vuelve la conexión, **entonces** se sincroniza solo, el pedido recibe folio definitivo y aparece en el KDS marcado "Sincronizado tarde".

### HU-071 Resolver conflictos (RF-229)
Como **gerente**, quiero revisar lo que no se pudo sincronizar limpiamente, para corregirlo.
- **Dado** que dos dispositivos registraron un pago para la misma cuenta durante el corte, **cuando** abro "Conflictos", **entonces** veo ambos pagos, el total cobrado de más y las opciones "Anular pago duplicado" o "Mantener como propina/sobrante".

---

## Módulo H — Plataforma

### HU-080 Dar de alta un cliente (RF-251)
Como **operador de RENGO**, quiero dar de alta un restaurante nuevo con un comando, para que empiece a operar el mismo día.
- **Dado** el servidor, **cuando** ejecuto `nuevo-cliente.sh LaFonda 3005 pos.lafonda.com`, **entonces** se crean base, `.env`, tablas, datos iniciales, proceso pm2 y bloque Caddy, y `https://pos.lafonda.com/api/health` responde `{ "status": "ok" }`.

### HU-081 Suspender un cliente (RF-252)
Como **operador de RENGO**, quiero suspender un cliente con pagos vencidos, para cortar el servicio sin borrar sus datos.
- **Dado** el cliente activo, **cuando** ejecuto `suspender-cliente.sh LaFonda`, **entonces** la app muestra "Servicio suspendido, contacte a RENGO" y los datos se conservan.

### HU-082 Consultar bitácora (RF-255)
Como **administrador**, quiero ver quién anuló la cuenta #0156, para aclarar una diferencia de caja.
- **Dado** el filtro por entidad "Cuenta #0156", **entonces** veo cada acción con usuario, autorizador, dispositivo, fecha y valores antes/después.
