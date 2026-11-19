# 16 — Preguntas abiertas y supuestos

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio**. Registra cada cambio en el [Control de cambios](README.md#control-de-cambios).

Prioridad: 🔴 bloquea el inicio del desarrollo · 🟡 debe resolverse durante la Fase 1 · 🟢 puede esperar.

Al resolver una pregunta: muévela a la sección 3 con la respuesta y la fecha, actualiza los documentos donde aparece y registra el cambio en el [Control de cambios](README.md#control-de-cambios).

## 1. Preguntas abiertas (`[PENDIENTE DE DEFINIR]`)

> RENGO decidió (2026-11-12) que las preguntas que siguen abiertas se resuelven **durante el avance** del proyecto. Mientras tanto se trabaja con la recomendación de cada una. Ninguna bloquea el inicio del desarrollo.

| ID | Pregunta | Prioridad | Dónde aparece | Opciones / recomendación |
|---|---|:-:|---|---|
| PA-021 | Modelos de impresoras, router y (si se usan) tablets del primer cliente | 🟡 | ADR-003, doc 06 §7, doc 14 §7 | **Propuesta de trabajo** (2026-11-12): kit de doc 06 §7, pensado para meseros con su propio celular (impresoras Epson con ePOS LAN, KDS opcional, router dual WAN con 4G). RENGO elige los equipos finales; ya no bloquea el inicio |
| PA-055 | Si se cancelan **todos** los ítems de un pedido en `LISTO` (merma), ¿el pedido pasa a `CANCELADO`? El diagrama del ítem (doc 05 §5.4) permite cancelar ítems `LISTO` y `ENTREGADO`, pero el del pedido (§5.3) solo permite `CANCELADO` desde `ENVIADO` y `EN_PREPARACION` | 🟡 | doc 05 §5.3, `shared/domain/orders` | **Recomendación:** agregar `LISTO → CANCELADO` al pedido; `ENTREGADO` sigue siendo final (los ítems cancelados después de entregar se ven como merma, el pedido queda entregado). Lo decide Pablito (dueño de `orders`) antes de H2. Mientras, el código sigue el diagrama tal como está |
| PA-056 | Logo e ícono de la app de Mise by Rengo (marca de RENGO) | 🟢 | `frontend/public/icons/` | Mientras tanto se usa un ícono **provisional** (una "M" blanca sobre `primary`). RENGO entrega el logo en SVG y se regeneran los PNG de la PWA |
| PA-057 | Tres temas aprobados no cumplen dos combinaciones de doc 18 §4.1 que no se habían calculado: **Piedra y rosa** (texto `primary` sobre `accent` 2.93 y sobre `warning` 2.78), **Carbón y oro** (`primary` sobre `accent` 3.69) y **Cielo de medianoche** (`primary` sobre `accent` 2.30 y sobre `warning` 2.80). Mínimo: 4.5 | 🟡 | doc 18 §8.4, `shared/domain/theme/themes.ts` | **Recomendación:** tonos derivados ◆ como en PA-054 (un `accent` más claro y, donde falla, un `warning` más claro). Mientras tanto esos 3 temas **no se pueden elegir**; sí se pueden Botanical Graphite, Violeta medianoche y Uva y porcelana |

## 2. Supuestos

RENGO confirmó los supuestos el 2026-11-11 (los que corrigió) y el 2026-11-12 (todos los demás). Se dejan aquí para no perder el número. La marca `[SUPUESTO]` ya se quitó de los documentos. **Siguen abiertos S-43 (duración de la Semana 0) y S-44 (contenido de la plantilla).**

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

## 3. Resueltas

| ID | Pregunta | Respuesta | Fecha | Documentos actualizados |
|---|---|---|---|---|
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
