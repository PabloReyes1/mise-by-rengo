# 19 — Estructura del proyecto (carpetas)

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio**. Registra cada cambio en el [Control de cambios](README.md#control-de-cambios).

> Las carpetas ya existen en el repositorio (vacías, con `.gitkeep`). **No se crean carpetas fuera de esta guía.** Si hace falta una nueva, primero se agrega aquí, se registra en el Control de cambios y se avisa a la otra persona.
>
> El repositorio es lo que en el servidor se clona como `/opt/mise/app/` ([06 §2](06-arquitectura-adr.md#2-estructura-en-el-servidor)).

## 1. Vista general

```
mise-by-rengo/
├── .github/workflows/    CI de GitHub Actions (ci.yml)
├── Docs/                 Documentación (manda sobre el código)
├── backend/              API Fastify + Prisma (un proceso por cliente)
├── frontend/             PWA React (una sola compilación para todos los clientes)
├── shared/               Código usado por backend y frontend: contratos y dominio
├── scripts/              Scripts de operación (nuevo-cliente.sh, desplegar.sh, ...)
├── templates/            Seed, plantillas de configuración inicial, Caddy y pm2
└── tests/                Pruebas de punta a punta y de carga
```

Las pruebas unitarias y de integración van **junto al código** que prueban (`*.test.ts`); `tests/` es solo para las que cruzan todo el sistema.

## 2. Organización por módulos

Cada módulo de negocio tiene **la misma carpeta en los tres lugares**, para que una persona sea dueña de su módulo completo:

| Módulo | Backend `backend/src/modules/` | Contratos `shared/contracts/` | Frontend `frontend/src/modules/` |
|---|---|---|---|
| Mesas y ocupaciones | `floor/` | `floor/` | `mesero/` |
| Toma y envío de pedidos | `orders/` | `orders/` | `mesero/` |
| Cocina (KDS) | `kitchen/` | `kitchen/` | `cocina/` |
| Cuentas, descuentos y pagos | `billing/` | `billing/` | `mesero/` (dividir cuentas) y `caja/` (cobrar) |
| Turnos y corte | `cash/` | `cash/` | `caja/` |
| Menú | `catalog/` | `catalog/` | `admin/` (editar) — todos lo leen |
| Configuración, licencia, sucursales, dispositivos, impresoras | `config/` | `config/` | `admin/` |
| Login, PIN, emparejamiento, permisos | `auth/` | `auth/` | `auth/` |
| Recetas y costeo | `recipes/` | `recipes/` | `admin/` |
| Dashboard y reportes | `reports/` | `reports/` | `reportes/` |
| Chatbot (F2) | `ai/` | `ai/` | `reportes/` |
| Sincronización sin internet | `sync/` | `sync/` | `core/offline/` |
| Tiempo real | `realtime/` | `realtime/` | `core/realtime/` |
| Bitácora | `audit/` | — | `admin/` (consulta en `reportes/`) |
| Health, hora, config pública | `system/` | `system/` | `core/config/` |

## 3. `backend/`

```
backend/
├── prisma/
│   ├── schema/            Un archivo .prisma por módulo (floor.prisma, orders.prisma, ...)
│   └── migrations/        Generadas por Prisma; solo aditivas (ADR-007)
├── sql/
│   └── semantic/          Vistas del esquema semantic (reportes y chatbot), un .sql por vista
└── src/
    ├── core/              Infraestructura común: carga del .env (Zod), cliente Prisma, arranque
    │                      de Fastify en 127.0.0.1, verificación de JWT y permisos, errores,
    │                      logger pino con etiquetas, idempotencia, servicio de bitácora
    └── modules/
        └── <modulo>/      system, config, auth, audit, catalog, floor, orders, kitchen,
                           billing, cash, sync, realtime, recipes, reports, ai
                           (fel/ se agregará cuando se implemente FEL, Fase 3)
```

**Archivos dentro de cada módulo del backend** (convención; se crean al programar):

| Archivo | Contenido |
|---|---|
| `<modulo>.routes.ts` | Rutas Fastify; valida entrada con los esquemas de `shared/contracts/<modulo>` y revisa permisos |
| `<modulo>.service.ts` | Reglas de negocio y transacciones |
| `<modulo>.repo.ts` | Consultas Prisma (con `select` explícito: nunca columnas pesadas en listas) |
| `<modulo>.events.ts` | Eventos de tiempo real que emite el módulo (si aplica) |
| `<modulo>.test.ts` | Pruebas del módulo (Vitest + `fastify.inject`) |
| `index.ts` | Registra el módulo en la aplicación |

Un módulo **no** importa archivos internos de otro módulo: usa su `service` exportado desde `index.ts`.

**Esquema Prisma por módulo:** `backend/prisma/schema/<modulo>.prisma` evita que las dos personas editen el mismo archivo. Requiere una versión de Prisma con esquema en varios archivos (estable desde Prisma 6.7) — confirmar en PA-020.

## 4. `frontend/`

```
frontend/
├── public/
│   ├── icons/             Íconos de la PWA (manifest)
│   └── sounds/            Sonidos del KDS y de avisos al mesero
└── src/
    ├── app/               Arranque: router, providers, layouts por tipo de dispositivo,
    │                      redirección según el dispositivo registrado
    ├── styles/            Tokens como variables CSS y carga del tema (doc 18)
    │   └── themes/        Un archivo por tema (botanical-graphite.ts); validador de contraste (doc 18 §8)
    ├── core/              Infraestructura común (ningún módulo de negocio vive aquí)
    │   ├── api/           Cliente HTTP (URL relativa /api), TanStack Query, errores, 🔑
    │   ├── session/       Sesión, usuario actual, permisos, vencimiento a las 12 h sin actividad
    │   ├── config/        Config pública del cliente, tema, textos, regionales
    │   ├── ui/            Componentes base del sistema de diseño (botón, tarjeta, modal,
    │   │                  teclado numérico, indicador de conexión, ...)
    │   ├── format/        Moneda, fechas y zona horaria
    │   ├── offline/       Dexie (IndexedDB), outbox, detector de conexión, folios temporales,
    │   │                  conflictos y registro de cortes
    │   ├── realtime/      Cliente Socket.IO, salas, reconexión con lastSeq
    │   └── print/
    │       ├── transports/  epos-lan, webusb, webserial, webbluetooth, qz, delegate
    │       └── documents/   Comanda, pre-cuenta, recibo, corte, movimiento, prueba (doc 11)
    └── modules/
        ├── auth/          Emparejar dispositivo, login, PIN
        ├── mesero/        Mesas, toma de pedido, carrito, cuentas, entrega, pre-cuenta
        ├── cocina/        KDS
        ├── caja/          Turno, cobro, retiros/depósitos, corte, para llevar
        ├── admin/         Configuración, menú, mesas, usuarios, roles, dispositivos,
        │                  impresoras, recetas, conflictos, bitácora
        └── reportes/      Dashboard, reportes, exportación, chatbot (F2)
```

**Subcarpetas de cada módulo del frontend** (ya creadas):

| Carpeta | Contenido |
|---|---|
| `pages/` | Pantallas (una por ruta) |
| `components/` | Componentes que solo usa este módulo |
| `hooks/` | Lógica de estado y reglas de pantalla |
| `api/` | Consultas y mutaciones del módulo (pasan por `core/api` o por la outbox de `core/offline`) |

Reglas:
- Un módulo **no** importa nada de otro módulo. Si dos módulos necesitan lo mismo, se sube a `core/` (avisando al dueño de `core/`).
- Ningún color en hex dentro de los módulos: solo tokens de `styles/` (doc 18).
- Toda acción operativa pasa por la outbox de `core/offline` (doc 09 §4.2).

## 5. `shared/`

```
shared/
├── contracts/            Esquemas Zod de peticiones, respuestas y eventos, una carpeta por
│   ├── errors/           módulo (la copia en código de doc 08). Los usan el backend para validar
│   └── <modulo>/         y el frontend para tipar y para los datos simulados
└── domain/               Reglas que deben dar el mismo resultado en el dispositivo (offline) y
    ├── billing/          en el servidor: cálculo de cuenta, descuentos, propina, cambio (doc 05 §4)
    ├── orders/           Estados de pedido e ítem y transiciones permitidas (doc 05 §5)
    ├── folios/           Formato de folios definitivos y temporales (doc 09 §5)
    └── ids/              Generación de ULID
```

`shared/` no importa nada de `backend/` ni de `frontend/`.

## 6. Resto

| Carpeta | Contenido |
|---|---|
| `scripts/` | `nuevo-cliente.sh`, `desplegar.sh`, `respaldo.sh`, `restaurar-cliente.sh`, `monitor.sh`, `suspender-cliente.sh`, `reactivar-cliente.sh`, `baja-cliente.sh`, `licencia.sh`, `listar-clientes.sh`, `verificar-migracion.sh` (doc 13) |
| `templates/seed/` | Datos base del producto, iguales para todo cliente: permisos, unidades, tipos de orden |
| `templates/restaurante-basico/` | Plantilla de onboarding: roles, métodos de pago, motivos, plantillas de ticket, estación, menú de ejemplo. También es el **menú de desarrollo** para trabajar sin la pantalla de admin |
| `templates/caddy/` | Plantilla del bloque Caddy por cliente (doc 13 §2.2) |
| `templates/pm2/` | Plantilla de la app pm2 por cliente (doc 13 §2.3) |
| `tests/e2e/` | Playwright: flujos completos y pruebas sin internet (doc 14 §2–§4, §7) |
| `tests/load/` | k6: carga (doc 14 §5) |

Los archivos de configuración de la raíz se crean en la Semana 0 ([17 §2](17-plan-de-trabajo.md#2-semana-0-cimientos)), a cargo de Deniscito:

| Archivo | Para qué |
|---|---|
| `package.json` | Scripts de todo el repositorio y herramientas compartidas; fija pnpm (`packageManager`) y Node 24 (`engines`) |
| `pnpm-workspace.yaml` | Declara los paquetes `backend`, `frontend` y `shared` (§7) |
| `tsconfig.base.json` | Opciones de TypeScript comunes; cada paquete tiene su `tsconfig.json` que lo extiende |
| `eslint.config.js` | Lint (ESLint con typescript-eslint); incluye la regla "sin colores hex en los módulos" (doc 18) |
| `.prettierrc.json`, `.prettierignore` | Formato |
| `.dependency-cruiser.cjs` | Reglas entre módulos (§8) |
| `vitest.config.ts` | Pruebas: un proyecto por paquete; cada paquete tiene su `vitest.config.ts` |
| `.nvmrc` | Versión de Node (24) |
| `.editorconfig`, `.gitattributes` | Saltos de línea LF y UTF-8 en todos los archivos (el servidor es Linux y los `.sh` fallan con CRLF) |
| `.gitignore`, `.env.example` | Archivos que no se suben y plantilla del `.env` (doc 13 §2.1) |
| `.github/workflows/ci.yml` | CI: typecheck, lint, formato, reglas entre módulos y pruebas en cada push y pull request |

**Comandos de la raíz:** `pnpm typecheck`, `pnpm lint`, `pnpm format` / `pnpm format:check`, `pnpm check:boundaries`, `pnpm test` y **`pnpm verify`**, que corre todo lo que corre el CI. Antes de subir cambios se corre `pnpm verify`. (No se llama `ci` porque `pnpm ci` es un comando propio de pnpm que reinstala todo.)

## 7. Gestor de paquetes: pnpm

Se usa **pnpm** con workspaces (aprobado por RENGO, 2026-11-12); no se usa npm ni yarn para instalar.

- `pnpm-workspace.yaml` en la raíz declara los tres paquetes: `backend`, `frontend` y `shared`. `backend` y `frontend` usan `shared` como dependencia `workspace:*`.
- Un solo `pnpm-lock.yaml` en la raíz, que se sube al repositorio. No se suben `package-lock.json` ni `yarn.lock`.
- La versión de pnpm se fija en el campo `packageManager` del `package.json` de la raíz (hoy `pnpm@12.18.0`) y se activa con Corepack (`corepack enable pnpm`), igual en las máquinas de desarrollo, el CI y el servidor.
- **Por qué:** pnpm no deja que un paquete use una dependencia que no declaró en su `package.json`. Con npm eso funciona en la PC y falla después en el servidor. Además instala más rápido y ocupa menos disco.

## 8. Las reglas entre módulos las revisa la máquina

Las reglas de importación de §3, §4 y §5 no se quedan solo en este documento: las verifica **dependency-cruiser** (archivo `.dependency-cruiser.cjs` en la raíz) con el comando `pnpm check:boundaries`. Corre en el CI y **el CI falla si alguna se rompe** (aprobado por RENGO, 2026-11-12).

| Regla | Dónde está escrita |
|---|---|
| Un módulo del backend no importa archivos internos de otro módulo; solo lo que exporta su `index.ts` | §3 |
| Un módulo del frontend no importa nada de otro módulo; lo común se sube a `core/` | §4 |
| `shared/` no importa nada de `backend/` ni de `frontend/` | §5 |
| `backend/` y `frontend/` no se importan entre sí; lo que comparten va en `shared/` | §1 |

Si hace falta una excepción, primero se escribe aquí con su motivo, después se agrega al archivo de reglas y se registra en el Control de cambios. No se desactiva una regla en el código para que el CI pase.
