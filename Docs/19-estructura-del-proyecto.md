# 19 — Estructura del proyecto (carpetas)

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio**. Registra cada cambio en el [Control de cambios](README.md#control-de-cambios).

> Las carpetas ya existen en el repositorio (vacías, con `.gitkeep`). **No se crean carpetas fuera de esta guía.** Si hace falta una nueva, primero se agrega aquí, se registra en el Control de cambios y se avisa a la otra persona.
>
> El repositorio es lo que en el servidor se clona como `/opt/mise/app/` ([06 §2](06-arquitectura-adr.md#2-estructura-en-el-servidor)).

## 1. Vista general

```
mise-by-rengo/
├── .github/workflows/    CI de GitHub Actions (ci.yml)
├── .impeccable/          Configuración de la revisión de diseño de la skill impeccable
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
├── prisma.config.ts       Configuración de Prisma 7: esquema en prisma/schema, carga el .env
└── src/
    ├── server.ts          Punto de entrada: carga el .env de la carpeta actual y escucha en 127.0.0.1
    ├── generated/         Cliente de Prisma generado (prisma generate); no se sube al repositorio
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

**Esquema Prisma por módulo:** `backend/prisma/schema/<modulo>.prisma` evita que las dos personas editen el mismo archivo. `base.prisma` tiene solo el generador y la conexión. **Confirmado con Prisma 7.10 (2026-11-12)**: esquema en varios archivos + `prisma.config.ts`.

**`backend/src/core/` (Semana 0, bloque 3, hecho 2026-11-12):**

| Archivo | Qué hace |
|---|---|
| `env.ts` | Valida el `.env` con Zod (doc 13 §2.1). Si falta una clave o es inválida, el backend no arranca y dice cuál |
| `logger.ts` | Opciones de pino: JSON, campo `client`, nunca contraseñas/PIN/tokens; `tagged('SYNC', '...')` pone la etiqueta al inicio (doc 13 §6) |
| `errors.ts` | `AppError(código, mensaje, details)` y el manejo único de errores: 404 `NOT_FOUND`, 400 `VALIDATION_ERROR` con `details[]` por campo, 500 `INTERNAL_ERROR` sin exponer el detalle |
| `auth.ts` | `authenticate` (token de acceso + `X-Device-Id` + `X-Branch-Id`) y `requirePermission('permiso')` → 403 `AUTHORIZATION_REQUIRED`. El token lleva usuario, dispositivo, sucursales y permisos; el módulo `auth` (H1) lo emite y puede cambiar ese contenido |
| `db.ts` | Cliente de Prisma con `@prisma/adapter-pg` y `pingDb` para `/api/health` |
| `app.ts` | `buildApp()`: arma Fastify con Zod (`fastify-type-provider-zod`), errores y módulos. Las pruebas lo usan con `app.inject` |

Las rutas validan con los esquemas Zod de `shared/contracts` directamente en `schema: { body, response }`. La idempotencia (`Idempotency-Key`) la agrega Pablito con la outbox (doc 17 §4.2, módulo 7).

**H1 de Deniscito (hecho 2026-11-12):** módulos `auth` (emparejar, login, PIN, refresh, logout, revocar, autorización 🔑 con `authorize('permiso')`), `audit` (`recordAudit`, `changedFields`), `config` (configuración pública y del restaurante, licencia y su guardia, sucursales, plantillas de ticket, logo) y `catalog` (menú, categorías, productos, modificadores, combos, agotados, fotos). Tablas en `auth.prisma`, `config.prisma`, `audit.prisma` y `catalog.prisma`; primera migración `h1_auth_config_audit_catalog` con los `CHECK` de estados y la bitácora de solo `INSERT` (trigger). Otros archivos del core: `ids.ts` (ULID ↔ uuid), `secrets.ts` (argon2id y tokens), `media.ts` (imágenes a WebP), `seed.ts` + `seed-cli.ts`, `pairing-code-cli.ts`.

**Pruebas con base real:** las pruebas de los módulos usan PostgreSQL de verdad. En local, `backend/.env.test` con `TEST_DATABASE_URL` (una base `mise_test`, que se vacía en cada prueba); en el CI, un PostgreSQL 18 del workflow. Antes de las pruebas se aplican las migraciones (`migrate deploy`). Ayudas: `core/test-db.ts`, `core/test-app.ts` (`setupFixture`, `createUser`).

**Comandos del backend:** `pnpm --filter @mise/backend dev` (desarrollo con `tsx`, lee `shared` desde el fuente y usa `backend/.env`), `build` (genera Prisma y compila a `dist/`), `start` (`node dist/server.js`). Desde la raíz, `pnpm build` compila `shared` y después el backend.

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

**Cimientos del frontend (Semana 0, bloque 4, hecho 2026-11-12):**

| Lugar | Qué tiene |
|---|---|
| `index.html`, `vite.config.ts` | Entrada de Vite y la PWA (`vite-plugin-pwa`): manifiesto con los colores del tema, service worker que precarga la app y nunca guarda `/api` ni `/socket.io`. En desarrollo, `/api` va al backend local (`127.0.0.1:3000`) |
| `src/main.tsx` | Arranque: estilos, tema por defecto y la app |
| `app/` | `App` (TanStack Query + rutas), `router.tsx` (React Router: `/` dispositivo sin emparejar, `/mesero`, `/caja`, `/kds`, `/admin`, `/reportes`, y `/_ui` solo en desarrollo), `AppShell` (barra superior con el área y la conexión), `device-areas.ts` (dueño e hito de cada área), `PendingModule` (lugar de un módulo que aún no existe), `UiPreview` (catálogo visual de componentes) |
| `styles/index.css` | Tailwind 4 con **solo** los tokens del tema (los colores por defecto de Tailwind están desactivados), escala tipográfica 12/14/16/20/24/32, radios 4/8 px, una sombra para lo que flota, foco, selección y cifras tabulares (`.tabular`). Fuente Inter servida desde la app, solo alfabetos latinos |
| `styles/themes/` | `botanical-graphite.ts` (fuente única de los valores), `index.ts` (temas disponibles) y `apply-theme.ts` (aplica el tema y el `primary` del cliente si cumple el contraste) |
| `core/api/` | `apiFetch` (URL relativa `/api`, cabeceras de sesión con `configureApi`, errores como `ApiError` con el código del doc 08; sin conexión = `NETWORK_ERROR`) y `createQueryClient` (reintenta solo sin conexión o errores 5xx) |
| `core/ui/` | `Button` (primary, secondary, outline, danger; 48 o 56 px), `Card`, `Modal` (`<dialog>` nativo), `NumericKeypad` (montos y PIN, también con teclado físico), `ConnectionIndicator` (color + ícono + texto) |
| `core/format/` | `formatMoney` (string decimal, sin coma flotante), `formatTime`, `formatDateTime` con la zona de la sucursal |
| `public/icons/` | Ícono **provisional** (PA-056) en SVG y PNG 192/512/maskable |

**H1 de Deniscito en el frontend (hecho 2026-11-12):**

| Lugar | Qué tiene |
|---|---|
| `core/session/` | `sessionStore`: dispositivo emparejado y sesión en `localStorage` (SC-13), cabeceras de cada petición, refresco automático del token vencido y cierre de sesión; `useDevice`, `useSession`, `hasPermission`, `homePathFor` |
| `core/config/` | `usePublicConfig` (aplica el tema real del restaurante) y `useRegional` (moneda, idioma y zona para formatear) |
| `core/ui/Field.tsx` | `TextInput`, `Select`, `Switch` y `Badge`, con error = ícono + texto |
| `modules/auth/` | Emparejar (`/emparejar`) y entrar (`/entrar`, PIN o contraseña según el dispositivo, SC-22) |
| `modules/admin/` | `/admin/restaurante` (datos, regional, tema y color propio con revisión de contraste en vivo, logo), `/admin/menu` (categorías, productos, agotados, fotos, combos, modificadores) y `/admin/dispositivos` (código para emparejar) |
| `app/` | `StartRedirect` (`/` → emparejar, entrar o el área del dispositivo) y `AppShell` con el nombre del restaurante, el usuario y Salir; las áreas piden sesión |

Dependencias: React 19, React Router, TanStack Query, Tailwind CSS 4, `lucide-react` (íconos), `@fontsource-variable/inter`, `vite-plugin-pwa`; pruebas con Vitest + jsdom + Testing Library. Comandos: `pnpm --filter @mise/frontend dev` (puerto 5173) y `build`.

## 5. `shared/`

```
shared/
├── contracts/            Esquemas Zod de peticiones, respuestas y eventos, una carpeta por
│   ├── common/           Tipos comunes: ID (ULID), monto, color (SC-05)
│   ├── errors/           módulo (la copia en código de doc 08). Los usan el backend para validar
│   └── <modulo>/         y el frontend para tipar y para los datos simulados
└── domain/               Reglas que deben dar el mismo resultado en el dispositivo (offline) y
    ├── billing/          en el servidor: cálculo de cuenta, descuentos, propina, cambio (doc 05 §4)
    ├── orders/           Estados de pedido e ítem y transiciones permitidas (doc 05 §5)
    ├── folios/           Formato de folios definitivos y temporales (doc 09 §5)
    ├── ids/              Generación de ULID
    └── theme/            Tokens de un tema y validador de contraste (doc 18 §4 y §8); lo usan
                          el frontend (prueba de temas) y el backend (primary del cliente)
```

`shared/` no importa nada de `backend/` ni de `frontend/`.

**Cómo se importa `shared`:** por subruta, ej. `import { newId } from '@mise/shared/domain/ids'` o `'@mise/shared/contracts/errors'`. Cada carpeta tiene un `index.ts` que es lo único que se exporta.

- En desarrollo (typecheck, Vitest y Vite) se lee **el TypeScript fuente**, sin compilar: el `package.json` de `shared` declara la condición `@mise/source`, que activan `tsconfig.base.json` (`customConditions`) y el `vitest.config.ts` de cada paquete.
- En producción el backend lee lo compilado en `shared/dist` (`pnpm --filter @mise/shared build`), así que en el despliegue `shared` se compila antes que el backend (doc 13 §4, paso 7).
- Dependencias de `shared`: `ulid` (generación y conversión ULID ↔ uuid, ADR-006) y `zod` (contratos).
- Estado (2026-11-12): hechos `domain/ids`, `domain/orders` y `contracts/errors`, con pruebas. `domain/billing` y `domain/folios` son de Pablito (doc 17 §1).

## 6. Resto

| Carpeta | Contenido |
|---|---|
| `scripts/` | `nuevo-cliente.sh`, `desplegar.sh`, `respaldo.sh`, `restaurar-cliente.sh`, `monitor.sh`, `suspender-cliente.sh`, `reactivar-cliente.sh`, `baja-cliente.sh`, `licencia.sh`, `listar-clientes.sh`, `verificar-migracion.sh` (doc 13) |
| `templates/seed/` | Datos base del producto, iguales para todo cliente: permisos, unidades, tipos de orden |
| `templates/restaurante-basico/` | Plantilla de onboarding: roles, métodos de pago, motivos, plantillas de ticket, estación, menú de ejemplo. También es el **menú de desarrollo** para trabajar sin la pantalla de admin. `dev-user.json` es **solo de desarrollo**: el seed lo crea únicamente con la opción de desarrollo y `nuevo-cliente.sh` nunca lo carga |
| (formato de `templates/`) | Archivos JSON con un campo `$comment`. `backend/src/core/templates.ts` los lee y valida (formato con Zod y referencias cruzadas: permisos de cada rol, categorías y grupos de cada producto, SKU únicos, combos). Las referencias usan claves de texto (ej. `"category": "bebidas"`); el seed asigna los ULID al cargar. Hecho en la Semana 0, bloque 5 (2026-11-12) |
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
| `.impeccable/config.json` | Revisión de diseño automática de la skill `impeccable`: después de cada cambio a un archivo de interfaz (`.tsx`, `.css`, ...) Claude Code revisa contraste, texto desbordado y desvíos del sistema de diseño. `config.local.json` es personal y no se sube |
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
