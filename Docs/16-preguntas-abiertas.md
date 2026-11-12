# 16 — Preguntas abiertas y supuestos

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio**. Registra cada cambio en el [Control de cambios](README.md#control-de-cambios).

Prioridad: 🔴 bloquea el inicio del desarrollo · 🟡 debe resolverse durante la Fase 1 · 🟢 puede esperar.

Al resolver una pregunta: muévela a la sección 3 con la respuesta y la fecha, actualiza los documentos donde aparece y registra el cambio en el [Control de cambios](README.md#control-de-cambios).

## 1. Preguntas abiertas (`[PENDIENTE DE DEFINIR]`)

> RENGO decidió (2026-11-12) que las preguntas que siguen abiertas se resuelven **durante el avance** del proyecto. Mientras tanto se trabaja con la recomendación de cada una.

| ID | Pregunta | Prioridad | Dónde aparece | Opciones / recomendación |
|---|---|:-:|---|---|
| PA-021 | Modelos de impresoras, router y (si se usan) tablets del primer cliente | 🟡 | ADR-003, doc 06 §7, doc 14 §7 | **Propuesta de trabajo** (2026-11-12): kit de doc 06 §7, pensado para meseros con su propio celular (impresoras Epson con ePOS LAN, KDS opcional, router dual WAN con 4G). RENGO elige los equipos finales; ya no bloquea el inicio |
| PA-014 | Planes comerciales y módulos por plan (precios, límites de dispositivos, IA incluida) | 🟡 | doc 07 `license` | RENGO lo definirá más adelante (2026-11-11). No bloquea: la tabla `license` ya permite cualquier combinación |

## 2. Supuestos

Los supuestos que RENGO corrigió el 2026-11-11 dicen "**Confirmado**"; se dejan aquí para no perder el número.

| ID | Supuesto | Documento |
|---|---|---|
| S-01 | Metas del MVP (60 s por pedido, 2 s al KDS, 99.5 % de disponibilidad) | 01 §1.7 |
| S-02 | 30 dispositivos simultáneos por sucursal y 3 sucursales por cliente como máximo de diseño | RNF-021 |
| S-03 | `connection_limit` = 5 por cliente (+2 de solo lectura) | RNF-025, 13 §7.2 |
| S-04 | **Confirmado:** sin bloqueo por inactividad. Token de acceso corto (15 min) que se refresca mientras se usa; la sesión vence a las 12 h sin actividad | 03 §6, RF-032, RNF-002, ADR-008 |
| S-05 | **Confirmado:** el gerente decide si se permiten descuentos y el límite de cada rol. En la plantilla los descuentos vienen **desactivados** `[SUPUESTO]` | 03 §4, §5, 07 `client_settings` |
| S-06 | **Confirmado:** en la plantilla el mesero **sí cobra** y el pago se registra al momento; la caja también cobra. Configurable por rol. Turno del efectivo: PA-052 | 03 §4, 05 paso 11 |
| S-07 | Excedente en métodos no efectivo se rechaza (no se da cambio sobre tarjeta) | HU-041 |
| S-08 | En el corte, las cuentas abiertas pasan al siguiente turno | HU-012 |
| S-09 | Pedido no marcado como entregado se marca automáticamente al imprimir la pre-cuenta y se excluye del promedio | 05 paso 9 |
| S-10 | **Confirmado:** la propina siempre es **sugerida**. Se calcula después de descuentos `[SUPUESTO]` | 05 §4, RF-025 |
| S-11 | Imágenes públicas por URL versionada (sin autenticación) | 08 §2.4 |
| S-12 | Semana inicia el lunes | 10 §3.2 |
| S-13 | **Confirmado:** 100 preguntas al mes por cliente; al llegar al límite se bloquea y pide contactar a RENGO para aumentarlo | 10 §7, 07 `license` |
| S-14 | Consumo de datos < 300 MB/día por sucursal | 06 §7 |
| S-15 | Hardware y costos de referencia | 06 §7, 09 §2 |
| S-16 | **Confirmado:** el tamaño del VPS y cuántos clientes por servidor los define RENGO (referencia: 4 vCPU / 8 GB / 160 GB; ~15 clientes) | 13 §1, §7 |
| S-17 | Consumo de RAM por proceso 150–300 MB | 13 §7.1 |
| S-18 | Tamaño de base ~0.5–1 GB/año por cliente de 1 sucursal | 13 §7.3 |
| S-19 | Umbrales del monitor | 13 §6 |
| S-20 | Herramientas de prueba (Vitest, Playwright, k6, toxiproxy) | 14 §1 |
| S-21 | Operación en paralelo con papel 3 días en UAT | 14 §9 |
| S-22 | Duraciones de las fases con 2 desarrolladores | 15 §1 |
| S-23 | Primer cliente: 1 sucursal, ≤ 15 mesas, ≤ 6 meseros, ~150 cuentas/día | 15 §3 |
| S-24 | Una orden se cuenta en el día de negocio de su última cuenta pagada | 12 §1 |
| S-25 | Conversiones de unidad por insumo (ej. 1 huevo = 50 g) | 07 §4.6 |
| S-26 | Reportes > 92 días en segundo plano | RF-175 |
| S-27 | PostgreSQL 17 | 06 §3.3 |
| S-28 | **Confirmado:** una cuenta pagada en efectivo se puede reabrir **desde otro turno** (por si hay cambio de turno mientras se resuelve). El reverso va al turno abierto donde se reabre | RF-069, 05 paso 14 |
| S-29 | **Confirmado:** se reabre sin importar si la mesa está ocupada o libre; la ocupación y la mesa no cambian | RF-069, 05 paso 14 |
| S-30 | No se puede separar un ítem que tiene descuento de ítem aplicado (hay que quitarlo primero) | RF-104 |
| S-31 | Con fondo variable, se sugiere lo que quedó en el corte anterior | RF-050, 05 paso 1 |
| S-32 | **Confirmado:** la licencia avisa 15 días antes de vencer y **repite el aviso cada día** desde el primero | RF-256 |
| S-33 | VPS en Ashburn (dentro de EE. UU.) | 13 §1 |
| S-34 | La reapertura solo se permite dentro del **mismo día de negocio** del cobro | RF-069, 08, 12 §4 |
| S-35 | En el reparto `POOL`, las propinas del día de negocio se reparten en partes iguales entre los meseros que trabajaron ese día | RF-025, 07, RPT-033 |
| S-36 | Corte provisional: si el esperado recalculado difiere, el turno se cierra con el del servidor y se crea `CORTE_DIFERENTE` | 05 paso 13, 09 §4.3 |
| S-37 | Las consultas guardadas del chatbot se pueden repetir sin LLM y sin gastar cuota; se guardan 12 meses; el mes de la cuota es el calendario del cliente | 10 §7, §8 |
| S-38 | Sistema de temas: 2–3 días extra en la Semana 0; medio día por tema nuevo | 18 §8 |
| S-39 | Tokens máximos por respuesta del chatbot: 800 | 10 §7 |
| S-40 | Los temas adicionales usan los colores funcionales de Botanical Graphite, salvo el dorado de los temas 2 y 4, que reemplaza a `warning` | 18 §8.4 |
| S-41 | Los 5 temas adicionales se cargan en H1, medio día cada uno | 18 §8.5 |
| S-42 | Kit de hardware de trabajo (TM-m30III / TM-T20III Ethernet, TP-Link ER605 + router 4G) mientras RENGO elige | 06 §7 |

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
