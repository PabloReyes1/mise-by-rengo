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
