# 15 — Roadmap, riesgos y supuestos

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio**. Registra cada cambio en el [Control de cambios](README.md#control-de-cambios).

## 1. Fases

```mermaid
gantt
    title Mise by Rengo — fases (duraciones aprobadas, equipo de 2 desarrolladores)
    dateFormat  YYYY-MM-DD
    axisFormat  %b %Y
    section Fase 0
    Documentación y aprobación          :f0, 2026-11-11, 3w
    Prueba de hardware de impresión      :f0b, after f0, 1w
    section Fase 1 (MVP)
    Base: plataforma, auth, config, menú :f1a, after f0b, 4w
    Servicio: mesas, pedidos, KDS, impresión :f1b, after f1a, 4w
    Cobro, caja y corte                  :f1c, after f1b, 3w
    Offline-first y sincronización       :f1d, after f1b, 4w
    Recetas, dashboard y reportes base   :f1e, after f1c, 3w
    Staging, pruebas y UAT               :f1f, after f1e, 3w
    Salida a producción primer cliente   :milestone, after f1f, 0d
    section Fase 2
    Chatbot IA y reportes avanzados      :f2, after f1f, 6w
    section Fase 3
    FEL vía RPA y multiestación          :f3, after f2, 8w
```

> Reparto del trabajo entre las 2 personas, por hito: ver [17-plan-de-trabajo.md](17-plan-de-trabajo.md).

### Fase 0 — Documentación (actual)
| Entregable | Criterio de salida |
|---|---|
| Documentación completa (este directorio) | ✅ Aprobada por RENGO el 2026-11-12 (versión 1.0); preguntas abiertas críticas (🔴 en [16](16-preguntas-abiertas.md)) resueltas |
| Prueba de concepto de impresión **sin código de producto** | Validar con la impresora real del cliente: ePOS LAN desde Android, iPhone y PC; WebUSB en Android; certificados HTTPS de la impresora (ADR-003) |
| Compra/definición de hardware del primer cliente | Lista aprobada (ver [06 §7](06-arquitectura-adr.md#7-hardware-recomendado)) |

### Fase 1 — MVP (primer cliente)
| Módulo | Incluye | RF |
|---|---|---|
| Plataforma | Servidor, Caddy, pm2, PostgreSQL, `nuevo-cliente.sh`, `desplegar.sh`, respaldos, monitor Telegram, licencia y módulos | RF-250 a RF-256 |
| Autenticación | Usuarios, roles configurables, PIN, dispositivos, autorización 🔑, bitácora | RF-030 a RF-035, RF-070, RF-255 |
| Configuración | Restaurante, sucursal, regionales, tickets, menú, modificadores, combos, mesas (lista), métodos de pago, propina, descuentos, motivos, impresoras | RF-001 a RF-004, RF-010 a RF-020, RF-022, RF-025 a RF-038, RF-041 |
| Servicio | Mesas, para llevar, rondas, KDS con sonido y colores, tres tiempos, avisos al mesero, entrega | RF-050 a RF-059, RF-100 a RF-109 (salvo RF-104) |
| Cobro y caja | Cuentas divididas (incluye separar unidades de una línea), pre-cuenta, pagos mixtos, recibo, cancelaciones, reapertura de cuentas pagadas en efectivo (sin anulaciones), turnos con fondo fijo o variable, retiros, corte | RF-060 a RF-067, RF-069, RF-104 |
| Impresión | Comanda, pre-cuenta, recibo, corte (58/80 mm), transportes ePOS + WebUSB (+ QZ si la caja es Windows) | ADR-003 |
| Offline | PWA, IndexedDB, outbox, folios temporales, impresión local, conflictos, indicador, procedimiento y formato de papel | RF-220 a RF-230 |
| Recetas | Insumos, unidades, recetas, costo teórico, precio sugerido, margen y alertas | RF-130 a RF-132, RF-134 a RF-139 |
| Dashboard y reportes | Dashboard del día; reportes RPT-001 a RPT-008, RPT-010 a RPT-012, RPT-020, RPT-030 a RPT-033, RPT-040 a RPT-044, RPT-050 a RPT-052, RPT-060 a RPT-062; CSV y Excel | RF-150 a RF-153, RF-170 a RF-172, RF-174 |
| Extensiones | Campos NIT/CF, catálogo de tipos de orden, modelo de estaciones | RF-270, RF-273 |

### Fase 2
| Funcionalidad | RF |
|---|---|
| Chatbot de IA para reportes | RF-200 a RF-206 |
| Exportación PDF, mapa de calor, reportes en segundo plano, RPT-009, RPT-013, RPT-021 a RPT-023, RPT-053, RPT-054, RPT-063 | RF-172, RF-173, RF-175 |
| Editor visual del mapa de mesas | RF-021 |
| Importar/exportar menú | RF-040 |
| Precios por sucursal, sub-recetas | RF-012, RF-133 |
| Textos configurables de la interfaz | RF-005 |
| Web Push para avisos al mesero, reporte X, apertura de cajón sin venta | RF-071 |
| QR de pre-cuenta para cobro offline (si no entra en MVP) | doc 09 §6.2 |

### Fase 3
| Funcionalidad | Nota |
|---|---|
| Facturación electrónica FEL vía RPA | Por ahora no se maneja IVA ni FEL (PA-002, PA-003). Se agregan con migraciones aditivas: estado de facturación, `invoice_events`, desglose de IVA y conexión del RPA (RF-271, RF-272, RF-274) |
| Varias estaciones de cocina (ruteo por categoría, KDS por estación, comanda por estación) | Modelo ya preparado |
| Multisucursal avanzado (reportes consolidados, precios por sucursal) | |
| Panel de plataforma para RENGO (web) en lugar de scripts | Aprobado (2026-11-12) |

### Fuera de alcance (sin fecha)
Delivery de cualquier tipo, menú online y pedidos en línea, reservaciones y lista de espera, inventario de existencias/compras/proveedores, reseñas y encuestas, asistencia del personal, agentes de IA en WhatsApp o teléfono, verificación automática de transferencias, pronósticos, ingeniería de menú automática, promociones automáticas, configuración de impuestos, servidor local, Docker.

## 2. Riesgos

| ID | Riesgo | Prob. | Impacto | Mitigación |
|---|---|:-:|:-:|---|
| R-01 | La impresión desde el navegador no funciona con la impresora elegida (certificados HTTPS de ePOS, permisos de red local de Chrome, drivers WebUSB en Windows) | Media | Alto | Prueba de hardware en Fase 0 antes de comprar; QZ Tray como respaldo en caja Windows; lista de impresoras certificadas |
| R-02 | Meseros con iPhone no pueden imprimir sin internet si la impresora no es ePOS | Alta | Medio | Exigir impresora ePOS LAN en cocina; procedimiento en papel |
| R-03 | Internet inestable en el restaurante | Alta | Alto | Dual WAN 4G obligatorio en la guía de instalación; offline-first |
| R-04 | Conflictos de sincronización confunden al personal | Media | Medio | Regla "a cargo", operaciones solo-agregar, pantalla de conflictos, capacitación |
| R-05 | Latencia alta Guatemala → servidor | Baja | Medio | Resuelto: VPS en EE. UU. (PA-022) |
| R-06 | Consumo de RAM por proceso (Prisma) mayor al estimado | Media | Medio | Medir en F1; cliente Prisma sin motor binario; `max-old-space-size`; plan de crecimiento |
| R-07 | Requisitos fiscales: el restaurante debe emitir FEL y el sistema aún no lo hace | Alta | Alto | El cliente mantiene su método actual de facturación hasta Fase 3; leyenda "no es factura" en el recibo; decisión de RENGO: sin IVA ni FEL por ahora (PA-002) |
| R-08 | Resistencia del personal a pasar de papel a sistema | Media | Alto | Capacitación por rol, operación en paralelo 3 días, interfaz mobile first simple |
| R-09 | Costos del LLM fuera de control | Baja | Medio | Cuotas por cliente, modelo pequeño, *prompt caching*, registro de costo |
| R-10 | Migración no aditiva rompe a varios clientes a la vez | Baja | Alto | `verificar-migracion.sh`, respaldo previo, staging con varios clientes |
| R-11 | Un solo servidor = punto único de falla | Media | Alto | Respaldos externos diarios, procedimiento de restauración probado mensualmente, offline-first en el restaurante; considerar réplica en Fase 3 |
| R-12 | Safari/iOS borra datos de PWA no usadas | Baja | Medio | `storage.persist()`, PWA instalada, outbox se vacía al reconectar |
| R-13 | Datos personales (teléfonos, NIT) | Baja | Medio | Datos mínimos, fuera de la capa semántica, aviso de privacidad del cliente |

## 3. Supuestos principales
Lista completa en [16-preguntas-abiertas.md](16-preguntas-abiertas.md#2-supuestos). Los más relevantes:
1. El primer cliente tiene 1 sucursal, ≤ 15 mesas, ≤ 6 meseros simultáneos y ~150 cuentas/día.
2. Cobran la caja y el mesero desde su celular (configurable, S-06; el efectivo del mesero va al turno de la caja principal, PA-052).
3. Se usa una impresora ePOS LAN en cocina y otra (USB o LAN) en caja.
4. Hay al menos un dispositivo Android o PC además de los celulares de meseros.
5. El cliente acepta instalar un router dual WAN con 4G.
6. El servidor se ubica en una región de Hetzner en EE. UU.
7. Los precios incluyen impuestos y el recibo no es factura fiscal.
