# 16 — Preguntas abiertas y supuestos

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio**. Registra cada cambio en el [Control de cambios](README.md#control-de-cambios).

Prioridad: 🔴 bloquea el inicio del desarrollo · 🟡 debe resolverse durante la Fase 1 · 🟢 puede esperar.

Al resolver una pregunta: muévela a la sección 3 con la respuesta y la fecha, actualiza los documentos donde aparece y registra el cambio en el [Control de cambios](README.md#control-de-cambios).

## 1. Preguntas abiertas (`[PENDIENTE DE DEFINIR]`)

| ID | Pregunta | Prioridad | Dónde aparece | Opciones / recomendación |
|---|---|:-:|---|---|
| PA-001 | ¿Una línea con cantidad > 1 (ej. 3 cervezas) se puede separar en unidades entre cuentas? | 🔴 | RF-104, HU-028, doc 07 | **Recomendación:** sí, *dividiendo la línea* en dos ítems (2 + 1) antes de moverla; así se respeta "un ítem = una cuenta". La división conserva pedido, modificadores y precio |
| PA-002 | ¿Cómo se desglosará el IVA incluido en el precio (para FEL y reportes)? | 🟢 | RF-274, doc 07 §4.8 | IVA 12 % general: `base = precio / 1.12`. Confirmar con contador si hay productos exentos o régimen de pequeño contribuyente (tasa distinta) |
| PA-003 | ¿El RPA de FEL accederá a `invoice_events` directo en la base (rol dedicado) o por API con token de servicio? | 🟢 | doc 08 §2.13 | Recomendación: API con token de servicio (no abre la base) |
| PA-010 | ¿El mesero puede cobrar en mesa en el primer cliente? | 🟡 | doc 03 §4 | Configurable por rol; por defecto no |
| PA-011 | ¿"Órdenes" en dashboard y reportes cuenta cuentas pagadas u ocupaciones? | 🟡 | doc 12 §1 | Supuesto: cuentas pagadas. Alternativa: ocupaciones (una mesa dividida en 3 cuentas = 1 orden) |
| PA-012 | ¿En qué día se refleja una anulación hecha un día después del pago? | 🟡 | doc 12 §4 | Validar con contador |
| PA-013 | ¿Se permite reabrir una cuenta pagada para corregirla (en vez de anular y volver a cobrar)? | 🟢 | RF-069 | Recomendación: no en MVP; solo anular |
| PA-014 | Planes comerciales y módulos por plan (precios, límites de dispositivos, IA incluida) | 🟡 | doc 07 `license` | Definir por RENGO |
| PA-015 | Política de vencimiento de licencia (días de aviso, gracia, solo lectura) | 🟡 | RF-256 | Supuesto: aviso 15 días, gracia 7, luego solo lectura |
| PA-020 | Versión exacta de Prisma (cliente sin motor binario / driver adapter) y de Node LTS al iniciar | 🔴 | ADR-002 | Decidir al cerrar Fase 0 con la versión estable vigente |
| PA-021 | Modelos de impresoras, tablets y router del primer cliente | 🔴 | ADR-003, doc 06 §7, doc 14 §7 | Recomendado: Epson con Ethernet y ePOS en cocina |
| PA-022 | Ubicación del VPS en Hetzner (EE. UU. vs. Europa) | 🔴 | doc 09 §2, doc 13 §1 | Recomendado: EE. UU. (Ashburn) por latencia |
| PA-023 | Dominio de cada cliente: ¿subdominio de RENGO (`cliente.mise.rengo...`) o dominio propio del cliente? | 🟡 | doc 13 §2 | Ambos posibles; subdominio de RENGO simplifica el alta |
| PA-024 | ¿El fondo inicial se sugiere automáticamente con lo que quedó del corte anterior? | 🟢 | doc 05 paso 1 | Supuesto: sí, editable |
| PA-025 | ¿Hay conteo obligatorio por denominación en el corte? | 🟢 | RF-065 | Supuesto: opcional |
| PA-030 | ¿La llave del LLM es de RENGO (costo en la licencia) o del cliente? | 🟡 | doc 10 §2.1 | Recomendación: de RENGO, con cuotas por plan |
| PA-031 | ¿Qué proveedor y modelo de LLM se usa por defecto? | 🟡 | doc 10 §2.1 | Recomendado: Claude Haiku 5.5; revisar precios al implementar |
| PA-032 | Retención del historial del chatbot | 🟢 | doc 10 §8 | Supuesto: 12 meses |
| PA-040 | ¿Se requiere el estado de mesa "Por limpiar" tras liberar? | 🟢 | HU-044 | Configurable; por defecto no |
| PA-041 | Al enviar un borrador con un producto que se agotó mientras tanto: ¿bloquear o permitir con autorización? | 🟡 | HU-003 | Supuesto: permitir con 🔑 de gerente |
| PA-042 | ¿Se permite abrir turno de caja sin conexión? | 🟡 | doc 05 paso 1, doc 09 §4.3 | Supuesto: sí, con conflicto si había otro abierto |
| PA-043 | ¿Comandas en orden del carrito o agrupadas por categoría? | 🟢 | doc 11 §4.1 | Configurable; por defecto orden del carrito |
| PA-044 | ¿El QR de pre-cuenta para cobro offline entra en el MVP? | 🟡 | doc 09 §6.2 | Recomendado: sí, simplifica el cobro durante cortes |
| PA-045 | Regla de redondeo del precio sugerido (a Q 0.50, Q 1.00, Q 5.00) | 🟢 | RF-135 | Configurable; por defecto Q 1.00 hacia arriba |
| PA-046 | ¿Se aceptan propinas en métodos distintos al efectivo y cómo se reparten? (reparto fuera de alcance) | 🟢 | RF-025 | Supuesto: se registran en cualquier método; reparto fuera de alcance |

## 2. Supuestos

| ID | Supuesto | Documento |
|---|---|---|
| S-01 | Metas del MVP (60 s por pedido, 2 s al KDS, 99.5 % de disponibilidad) | 01 §1.7 |
| S-02 | 30 dispositivos simultáneos por sucursal y 3 sucursales por cliente como máximo de diseño | RNF-021 |
| S-03 | `connection_limit` = 5 por cliente (+2 de solo lectura) | RNF-025, 13 §7.2 |
| S-04 | Bloqueo por inactividad: 15 min celular, 5 min caja, 30 min admin | 03 §6 |
| S-05 | Tope de descuento por defecto del cajero: 10 % | 03 §4 |
| S-06 | El mesero no cobra por defecto | 03 §4 |
| S-07 | Excedente en métodos no efectivo se rechaza (no se da cambio sobre tarjeta) | HU-041 |
| S-08 | En el corte, las cuentas abiertas pasan al siguiente turno | HU-012 |
| S-09 | Pedido no marcado como entregado se marca automáticamente al imprimir la pre-cuenta y se excluye del promedio | 05 paso 9 |
| S-10 | Propina calculada después de descuentos | 05 §4 |
| S-11 | Imágenes públicas por URL versionada (sin autenticación) | 08 §2.4 |
| S-12 | Semana inicia el lunes | 10 §3.2 |
| S-13 | Límites del chatbot (30 preguntas/usuario/día, 100/cliente/día, 1 M tokens/mes) | 10 §7 |
| S-14 | Consumo de datos < 300 MB/día por sucursal | 06 §7 |
| S-15 | Hardware y costos de referencia | 06 §7, 09 §2 |
| S-16 | VPS inicial 4 vCPU / 8 GB / 160 GB; ~15 clientes por servidor | 13 §1, §7 |
| S-17 | Consumo de RAM por proceso 150–300 MB | 13 §7.1 |
| S-18 | Tamaño de base ~0.5–1 GB/año por cliente de 1 sucursal | 13 §7.3 |
| S-19 | Umbrales del monitor | 13 §6 |
| S-20 | Herramientas de prueba (Vitest, Playwright, k6, toxiproxy) | 14 §1 |
| S-21 | Operación en paralelo con papel 3 días en UAT | 14 §9 |
| S-22 | Duraciones de las fases con 2 desarrolladores | 15 §1 |
| S-23 | Primer cliente: 1 sucursal, ≤ 15 mesas, ≤ 6 meseros, ~150 cuentas/día | 15 §3 |
| S-24 | Órdenes = cuentas pagadas | 12 §1 |
| S-25 | Conversiones de unidad por insumo (ej. 1 huevo = 50 g) | 07 §4.6 |
| S-26 | Reportes > 92 días en segundo plano | RF-175 |
| S-27 | PostgreSQL 17 | 06 §3.3 |

## 3. Resueltas

| ID | Pregunta | Respuesta | Fecha | Documentos actualizados |
|---|---|---|---|---|
| — | — | — | — | — |
