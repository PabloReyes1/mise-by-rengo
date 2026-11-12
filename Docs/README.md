# Mise by Rengo — Documentación técnica y funcional

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio** (requisitos, diseño, decisiones o código). Todo cambio se registra en el [Control de cambios](#control-de-cambios) de este archivo.

| Campo | Valor |
|---|---|
| Producto | **Mise by Rengo** (de *mise en place*: todo listo y en su lugar) |
| Empresa | RENGO |
| Primer cliente | Restaurante pequeño en Guatemala (hoy lleva sus cuentas en papel) |
| Versión de la documentación | 0.1 (borrador) |
| Estado | 🟡 **En revisión** — el desarrollo NO puede iniciar hasta cambiar a ✅ Aprobada |
| Idioma | Español |

## Índice

| # | Documento | Contenido |
|---|---|---|
| 01 | [Resumen ejecutivo y glosario](01-resumen-ejecutivo-glosario.md) | Visión, alcance, principios, glosario |
| 02 | [Requisitos](02-requisitos.md) | RF-xxx y RNF-xxx con criterios de aceptación |
| 03 | [Actores, roles y permisos](03-actores-roles-permisos.md) | Actores, roles por defecto, matriz de permisos |
| 04 | [Historias de usuario](04-historias-de-usuario.md) | Historias por módulo (Dado/Cuando/Entonces) |
| 05 | [Flujos y estados](05-flujos-y-estados.md) | Flujo operativo paso a paso y diagramas de estado |
| 06 | [Arquitectura y ADR](06-arquitectura-adr.md) | Servidor, dispositivos, impresoras, decisiones |
| 07 | [Modelo de datos](07-modelo-de-datos.md) | Diagrama ER y descripción de tablas |
| 08 | [API REST y tiempo real](08-api.md) | Endpoints y eventos Socket.IO |
| 09 | [Modo sin internet](09-modo-sin-internet.md) | Estrategia offline-first y contingencia |
| 10 | [Chatbot de IA para reportes](10-chatbot-ia.md) | Capa semántica, seguridad, costos |
| 11 | [Impresión](11-impresion.md) | Comanda, pre-cuenta, recibo, corte (80 y 58 mm) |
| 12 | [Catálogo de reportes](12-catalogo-reportes.md) | Métricas, filtros y fórmulas |
| 13 | [Operación](13-operacion.md) | Alta de cliente, despliegue, respaldos, monitoreo, crecimiento |
| 14 | [Plan de pruebas](14-plan-de-pruebas.md) | Pruebas funcionales, de red y concurrencia |
| 15 | [Roadmap](15-roadmap.md) | Fases, riesgos y supuestos |
| 16 | [Preguntas abiertas](16-preguntas-abiertas.md) | Todos los `[PENDIENTE DE DEFINIR]` y `[SUPUESTO]` |
| 17 | [Plan de trabajo para 2 personas](17-plan-de-trabajo.md) | Reparto por módulos (Sala y caja / Cocina y gestión), Semana 0 conjunta, reglas de integración, hitos |
| 18 | [Sistema de diseño](18-sistema-de-diseno.md) | Paleta Botanical Graphite, contraste WCAG, uso por módulo |
| 19 | [Estructura del proyecto](19-estructura-del-proyecto.md) | Carpetas del repositorio, convenciones por módulo, qué va en cada lugar |

## Convenciones

- `RF-xxx`: requisito funcional. `RNF-xxx`: requisito no funcional. `HU-xxx`: historia de usuario. `ADR-xxx`: decisión de arquitectura. `PR-xxx`: caso de prueba. `RPT-xxx`: reporte. `PA-xxx`: pregunta abierta.
- `[SUPUESTO]`: valor asumido para poder avanzar; debe confirmarse con RENGO o el cliente.
- `[PENDIENTE DE DEFINIR]`: decisión abierta; está en [16-preguntas-abiertas.md](16-preguntas-abiertas.md).
- Diagramas en Mermaid (se ven en VS Code con la extensión de vista previa de Markdown + Mermaid, y en GitHub/GitLab).
- Montos en **GTQ** (Q) con 2 decimales; horas en **America/Guatemala**. Ambos son configuración, no valores fijos.
- Los nombres de tablas, campos y endpoints van en inglés (`snake_case` en base de datos, `camelCase` en API); todo lo demás en español.

## Cómo mantener esta documentación

1. Antes de cambiar código, actualiza el documento afectado (requisito, modelo de datos, API, etc.).
2. Si el cambio contradice una decisión, escribe un ADR nuevo en [06-arquitectura-adr.md](06-arquitectura-adr.md) que reemplace al anterior (no borres el anterior: márcalo como *Reemplazado por ADR-xxx*).
3. Al resolver una pregunta abierta, muévela a "Resueltas" en [16-preguntas-abiertas.md](16-preguntas-abiertas.md) y actualiza todos los documentos donde aparecía.
4. Registra el cambio en la tabla de abajo.

## Control de cambios

| Fecha | Versión | Documento(s) | Cambio | Autor |
|---|---|---|---|---|
| 2026-11-11 | 0.1 | Todos | Creación inicial de la documentación a partir de `prompt-documentacion-pos-v2.md` | Claude (asistente) |
| 2026-11-11 | 0.1 | `CLAUDE.md` | Se agregan 5 skills al proyecto en `.claude/skills/`: design-taste-frontend, web-design-guidelines, emil-design-eng, playwright-cli y claude (awesome-design). Se documenta su uso | Claude (asistente) |
| 2026-11-11 | 0.1 | `17-plan-de-trabajo.md` (nuevo), `06-arquitectura-adr.md` §2, `15-roadmap.md`, `16-preguntas-abiertas.md` | Propuesta de reparto del trabajo entre 2 personas (A: backend y plataforma; B: frontend PWA y dispositivos), Semana 0 conjunta, reglas de integración y trabajo por hito. Se agrega la carpeta propuesta `app/shared/` (contratos y dominio compartidos) | Claude (asistente) |
| 2026-11-11 | 0.1 | `18-sistema-de-diseno.md` (nuevo), `CLAUDE.md`, `02-requisitos.md` (RNF-063), `07-modelo-de-datos.md` (`client_settings`), `16-preguntas-abiertas.md` (PA-048 a PA-050) | Se adopta la paleta Botanical Graphite definida por RENGO, con tabla de contraste WCAG, combinaciones permitidas y aplicación a estados de mesa, KDS, indicador de conexión y gráficas | Claude (asistente) |
| 2026-11-11 | 0.1 | `19-estructura-del-proyecto.md` (nuevo), `17-plan-de-trabajo.md` (reescrito), `06-arquitectura-adr.md` §2 y §3.2, `16-preguntas-abiertas.md` (PA-047), `CLAUDE.md`; carpetas `backend/`, `frontend/`, `shared/`, `scripts/`, `templates/`, `tests/` | Se crea la estructura de carpetas del repositorio (vacías, con `.gitkeep`). El reparto del trabajo cambia de backend/frontend a **por módulos**: Persona 1 (Sala y caja) y Persona 2 (Cocina y gestión). El módulo `orders` se divide en `orders` (sala) y `kitchen` (KDS); se agrega `system`. Esquema Prisma en un archivo por módulo | Claude (asistente) |
| 2026-11-11 | 0.1 | `17-plan-de-trabajo.md` §4 (nuevo), `06-arquitectura-adr.md` (ADR-012), `16-preguntas-abiertas.md` (PA-020) | Orden de construcción de los 26 módulos (primero los no negociables, luego el flujo operativo, al final la gestión). Investigación de versiones: se propone Node.js 24 LTS con Prisma 7, Fastify 5, Vite 8 y React 19 | Claude (asistente) |
| 2026-11-11 | 0.1 | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 19; se elimina la carpeta `backend/src/modules/fel/` | RENGO resuelve PA-001, 002, 003, 010, 011, 012, 013, 015, 020, 022, 023, 024 y 025. Cambios principales: **sin anulaciones de cuentas** (RF-068 retirado) y **reapertura de cuentas pagadas en efectivo** en el MVP (RF-069, permiso `bill.reopen`); separar unidades de una línea entre cuentas (RF-104); **sin IVA ni FEL** por ahora (solo NIT/CF; `invoice_events` y estado de facturación pasan a F3); órdenes = ocupaciones; fondo inicial fijo o variable y conteo por denominación configurables por caja; licencia vencida → solo lectura; ADR-012 aceptado; VPS en EE. UU.; dominio a elección del cliente. Nueva pregunta PA-051 (corregir cobros con tarjeta) | Claude (asistente) |
| 2026-11-11 | 0.1 | 02, 03, 04, 05, 06 (ADR-008), 07, 08, 09, 10, 11, 12, 13, 14, 16, 17, 18 (§7 y §8 nuevo), 19; carpeta `frontend/src/styles/themes/` | RENGO resuelve PA-030, 031, 032, 040–046, 048–051 y corrige (también doc 15 y CLAUDE.md) S-04, 05, 06, 10, 13, 16, 28, 29 y 32. Cambios principales: sin bloqueo por inactividad (sesión vence a las 12 h sin actividad); el gerente activa los descuentos y fija los límites; **el mesero cobra** (configurable); propina siempre sugerida con reparto configurable; **abrir turno solo en línea y corte provisional sin conexión** (`CERRADO_PROVISIONAL`, conflicto `CORTE_DIFERENTE`); reapertura desde otro turno del mismo día con `REVERSO_REAPERTURA` en el turno actual, sin importar la mesa; cuentas con tarjeta no se corrigen; chatbot con llave de RENGO, modelo por definir, 100 preguntas al mes y sin historial (`ai_queries`); producto agotado, "Por limpiar", orden de comanda y redondeo configurables; QR de pre-cuenta en el MVP; solo `primary` es cambiable; sin modo oscuro; propuesta de sistema de temas. Nuevas preguntas PA-052 (turno del efectivo del mesero) y PA-053 (qué temas ofrecer) | Claude (asistente) |
| 2026-11-12 | 0.1 | 03, 05, 06 (§7 reescrito), 07, 09, 12 (RPT-034 nuevo), 14, 15, 16, 17, 18 (§8.4 y §8.5 nuevos), `CLAUDE.md` | RENGO resuelve PA-047 (Persona 1 = Pablito, Persona 2 = Deniscito), PA-052 (el efectivo que cobra el mesero va al turno de la caja principal; nuevo `cash_registers.is_main` y reporte RPT-034) y PA-053 (5 temas adicionales, con asignación de tokens y revisión de contraste). PA-021 pasa a 🟡 con un kit de hardware de trabajo pensado para meseros con su propio celular (Epson ePOS LAN, KDS opcional, dual WAN con 4G). Nueva PA-054 (aprobar tonos derivados de los temas) | Claude (asistente) |
| 2026-11-12 | 0.1 | 16, 17, 18 | RENGO aprueba los tonos derivados de los temas adicionales (PA-054). Las preguntas que siguen abiertas (PA-014, PA-021) se resuelven durante el avance; mientras tanto se usa la recomendación de cada una | Claude (asistente) |
