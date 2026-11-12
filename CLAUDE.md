# Mise by Rengo — Instrucciones del proyecto

> ⚠️ **IMPORTANTE — REGLAS DEL PROYECTO (OBLIGATORIAS)**
>
> 1. **No se escribe ninguna línea de código hasta que la documentación de [Docs/](Docs/) esté terminada y aprobada** por RENGO (ver estado en [Docs/README.md](Docs/README.md)).
> 2. **La documentación vive en `Docs/` en formato Markdown (`.md`) y se actualiza cada vez que se hace un cambio** (requisitos, diseño, decisiones o código). Ningún cambio se considera terminado si la documentación no lo refleja.
> 3. Cada cambio se registra en el **Control de cambios** de [Docs/README.md](Docs/README.md) con fecha, documento afectado y descripción.
> 4. Nada propio de un restaurante va fijo en el código: todo es configuración.
> 5. Si falta información, no se inventa: se marca `[SUPUESTO]` o `[PENDIENTE DE DEFINIR]` y se agrega a [Docs/16-preguntas-abiertas.md](Docs/16-preguntas-abiertas.md).

## Qué es
Mise by Rengo es un POS para restaurantes, estándar y configurable, que RENGO vende a varios clientes. Modelo multicliente: un solo código compilado una vez; por cliente, un proceso backend (pm2), una base PostgreSQL y un dominio, detrás de Caddy en un VPS Hetzner sin Docker.

## Sistema visual: paleta Botanical Graphite
Detalle, tabla de contraste y reglas por módulo en [Docs/18-sistema-de-diseno.md](Docs/18-sistema-de-diseno.md). Resumen obligatorio para cualquier trabajo de UI:

| Token | Hex | Uso |
|---|---|---|
| `primary` | `#243A35` | Identidad de la app: botones principales, navegación activa, encabezados destacados, selección, acciones prioritarias |
| `secondary` | `#526D61` | Botones secundarios, íconos activos, enlaces, elementos interactivos de menor jerarquía |
| `accent` | `#A5A58D` | Solo complemento: etiquetas, indicadores pequeños, detalles. Nunca dominante ni como texto sobre fondo claro |
| `surface` | `#E9E5D8` | Tarjetas suaves, contenedores, separadores, fondos de componentes |
| `background` | `#F8F7F2` | Fondo general |
| `success` / `warning` / `error` | `#38845B` / `#D69B3D` / `#C65353` | Solo funcionales. `warning` siempre con texto `primary`, nunca blanco |

- Fondos claros, jerarquía consistente, sin colores fuera de la paleta, colores solo por token (nunca hex sueltos), contraste WCAG 2.2 AA y el estado nunca se comunica solo con color.
- Implementar el sistema visual **no cambia la lógica ni la funcionalidad**.
- En color manda Botanical Graphite; la skill `claude` queda como referencia de tipografía, espaciado y estilo.
- Sin modo oscuro. El cliente solo puede cambiar `primary` (con validación de contraste). Los colores van por tema (`frontend/src/styles/themes/`), ver Docs/18 §8.

## Skills del proyecto (`.claude/skills/`)

| Skill | Origen | Uso en Mise |
|---|---|---|
| `design-taste-frontend` (Taste Skill 2.5) | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | Pensada para sitios de marketing (landing pages). Úsala para páginas públicas de RENGO/Mise. En la app POS (mesero, caja, KDS) mandan los RNF de usabilidad de [Docs/02-requisitos.md](Docs/02-requisitos.md). Trae un hook `Stop` que solo actúa si existe una carpeta `.taste-skill/` |
| `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | Revisión de UI contra las Web Interface Guidelines (descarga las reglas en cada revisión) |
| `emil-design-eng` | [emilkowalski/skills](https://github.com/emilkowalski/skills) | Pulido de UI y decisiones de animación |
| `playwright-cli` | [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli) | Automatizar el navegador y probar la PWA. Requiere `npm install -g @playwright/cli@latest` |
| `claude` (carpeta `awesome-design-claude`) | [bergside/awesome-design-skills](https://github.com/bergside/awesome-design-skills) | Referencia de tipografía, espaciado y estilo editorial (WCAG 2.2 AA). **En color manda Botanical Graphite** ([Docs/18](Docs/18-sistema-de-diseno.md)); el cliente solo puede cambiar `primary` (PA-048) |

## Estructura y reparto del trabajo
- Las carpetas del repositorio están definidas en [Docs/19-estructura-del-proyecto.md](Docs/19-estructura-del-proyecto.md). **No se crean carpetas fuera de esa guía** sin agregarlas primero al documento.
- El trabajo se reparte **por módulos** entre Persona 1 = Pablito (Sala y caja) y Persona 2 = Deniscito (Cocina y gestión): ver [Docs/17-plan-de-trabajo.md](Docs/17-plan-de-trabajo.md). Cada persona edita solo las carpetas de sus módulos.
- Los commits los hace cada persona; Claude no hace commits.

## Dónde empezar
- Índice de la documentación: [Docs/README.md](Docs/README.md)
- Arquitectura y ADR: [Docs/06-arquitectura-adr.md](Docs/06-arquitectura-adr.md)
- Modelo de datos: [Docs/07-modelo-de-datos.md](Docs/07-modelo-de-datos.md)
