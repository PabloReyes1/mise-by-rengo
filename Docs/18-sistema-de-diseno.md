# 18 — Sistema de diseño: paleta Botanical Graphite

> ⚠️ **IMPORTANTE — REGLA DEL PROYECTO:** No se escribe ninguna línea de código hasta que esta documentación esté terminada y aprobada. La documentación vive en `Docs/` en formato `.md` y **se actualiza cada vez que se hace un cambio**. Registra cada cambio en el [Control de cambios](README.md#control-de-cambios).

> Estado: **Aprobada por RENGO** (paleta, PA-048, PA-049 y PA-050 resueltas el 2026-11-11). El sistema de temas (§8) está **implementado** con Botanical Graphite como único tema (Semana 0, 2026-11-12); los 5 temas adicionales (§8.4) y sus tonos derivados están **aprobados** (PA-053, PA-054).

## 1. Objetivo
Botanical Graphite es el sistema visual de **Mise by Rengo** en todos los módulos (mesero, caja, KDS, admin, reportes), pantallas, formularios, menús y componentes. Debe transmitir una plataforma gastronómica **moderna, profesional, elegante y versátil**, apta para cualquier tipo de restaurante.

Al implementarlo **no se modifica la lógica ni la funcionalidad**: solo se adapta y estandariza la parte visual.

## 2. Paleta

| Token | Hex | Rol | Dónde se usa |
|---|---|---|---|
| `primary` | `#243A35` | Color de identidad de la aplicación | Botones principales, navegación activa, encabezados destacados, elementos seleccionados, acciones prioritarias |
| `secondary` | `#526D61` | Jerarquía inferior a `primary` | Botones secundarios, iconografía activa, enlaces, elementos interactivos |
| `accent` | `#A5A58D` | Complemento, **uso moderado** | Etiquetas, indicadores pequeños, detalles visuales. **Nunca** como color dominante |
| `surface` | `#E9E5D8` | Superficies secundarias | Tarjetas suaves, contenedores, separadores destacados, fondos de componentes |
| `background` | `#F8F7F2` | Fondo general | Fondo de toda la aplicación: limpio, cálido, elegante |
| `success` | `#38845B` | Funcional | Confirmaciones, estados correctos, "Listo", "En línea" |
| `warning` | `#D69B3D` | Funcional | Advertencias, estados intermedios, "Inestable" |
| `error` | `#C65353` | Funcional | Errores, acciones destructivas, "Sin conexión", tiempos vencidos |

**No se introducen colores adicionales** que rompan la identidad. Esta regla aplica a cada tema: un tema solo usa los colores de su paleta, más los tonos derivados aprobados por RENGO (PA-054, §8.4). El único color fuera de la paleta es el blanco `#FFFFFF`, y solo para el texto sobre fondos oscuros. El blanco está aprobado para ese uso (PA-049 b). Si un caso no se puede resolver con estos tokens, se lleva a RENGO.

## 3. Lineamientos
1. `primary` es el identificador de la aplicación: es el color que más "se reconoce".
2. Se priorizan los fondos claros (`background`) y las superficies limpias (`surface`).
3. No se usan todos los colores con la misma intensidad. Proporción orientativa por pantalla: ~60 % `background`, ~25 % `surface`, ~10 % `primary`/`secondary`, ≤ 5 % `accent` y funcionales.
4. Jerarquía visual consistente: una sola acción `primary` por vista o sección; las demás son `secondary` o de contorno.
5. `accent` solo como complemento.
6. Contraste y legibilidad garantizados en textos, botones e íconos (§4).
7. Mismos tokens y los mismos usos en todos los módulos.
8. **Los colores se usan solo por token** (variables CSS / tema de Tailwind), nunca como hex sueltos en los componentes.

## 4. Contraste (WCAG 2.2 AA)

Relaciones calculadas con la fórmula de luminancia de WCAG. Mínimos: **4.5:1** texto normal · **3:1** texto grande (≥ 24 px, o ≥ 18.66 px en negrita) y componentes de UI.

| Texto / ícono ↓ sobre → | `background` | `surface` | Blanco | `primary` |
|---|:-:|:-:|:-:|:-:|
| `primary` | **11.31** ✅ | **9.62** ✅ | 12.13 ✅ | — |
| `secondary` | **5.26** ✅ | 4.48 ⚠️ | 5.65 ✅ | 2.15 ❌ |
| `accent` | 2.34 ❌ | 1.99 ❌ | 2.51 ❌ | 4.83 ✅ |
| `success` | 4.24 ⚠️ | 3.61 ⚠️ | 4.55 ✅ | 2.67 ❌ |
| `warning` | 2.27 ❌ | 1.93 ❌ | 2.44 ❌ | **4.98** ✅ |
| `error` | 4.11 ⚠️ | 3.50 ⚠️ | 4.41 ⚠️ | 2.75 ❌ |
| `background` | — | 1.17 ❌ | — | **11.31** ✅ |
| Blanco | — | — | — | **12.13** ✅ |

✅ texto normal · ⚠️ solo texto grande o íconos/UI (≥ 3:1) · ❌ no usar para texto

### 4.1 Combinaciones permitidas

| Elemento | Fondo | Texto / ícono | Contraste |
|---|---|---|---|
| Texto principal | `background` o `surface` | `primary` | 11.31 / 9.62 |
| Texto secundario (ayudas, metadatos) | `background` | `secondary` | 5.26 |
| Texto secundario sobre `surface` | `surface` | `secondary` **solo ≥ 18.66 px en negrita**; si no, `primary` | 4.48 |
| Botón principal | `primary` | Blanco o `background` | 12.13 / 11.31 |
| Botón secundario | `secondary` | Blanco | 5.65 |
| Botón de contorno | `background` + borde `secondary` | `secondary` | 5.26 |
| Enlace | `background` | `secondary` subrayado | 5.26 |
| Etiqueta / chip de `accent` | `accent` | `primary` | 4.83 |
| Aviso (warning) | `warning` | `primary` (**nunca** blanco) | 4.98 |
| Éxito | `success` | Blanco | 4.55 |
| Error / acción destructiva | `error` | Blanco **solo ≥ 18.66 px en negrita** (PA-049 a: texto grande en negrita, sin color nuevo) | 4.41 |
| Mensaje de error en un formulario | `background` | Ícono `error` + texto `primary` (el color no es la única señal) | 11.31 |
| Deshabilitado | `surface` | `accent` (exento de contraste por WCAG; nunca solo color: también cursor y `aria-disabled`) | — |
| Foco de teclado | — | Anillo de 2 px `secondary` sobre `background` | 5.26 |

### 4.2 Reglas que salen de la tabla
- `accent` y `warning` **nunca** se usan como color de texto sobre fondos claros.
- `success` y `error` como texto solo en tamaño grande o como íconos; los mensajes van en `primary`, con el ícono de color al lado.
- `surface` sobre `background` (1.17) casi no se distingue, y la paleta no tiene un tono intermedio para bordes. Por eso las tarjetas en `surface` se separan con espacio. Cuando el límite importa, llevan un **borde de 1 px `accent`** (2.34, decorativo) o `secondary` si delimitan un control interactivo (5.26, cumple el 3:1 de componentes).
- El estado **nunca** se comunica solo con color (texto, ícono o forma además del color). Esto es importante en el KDS y en el mapa de mesas.

## 5. Aplicación por módulo

### 5.1 Estados de mesa (RF-109) — propuesta de valores por defecto
Los colores de estado son **configurables por cliente** (RF-109); estos son los valores de la plantilla, y siempre se acompañan de ícono y texto.

| Estado | Fondo de la tarjeta | Borde / ícono | Texto |
|---|---|---|---|
| Libre | `background` | `accent` | `primary` |
| Ocupada | `secondary` | — | Blanco |
| Con pedido en cocina | `surface` | `warning` | `primary` |
| Lista para entregar | `success` | — | Blanco |
| Pre-cuenta impresa | `accent` | — | `primary` |
| Unida | `surface` | `secondary` punteado | `primary` |
| Bloqueada | `surface` | — | `accent` + ícono de candado |

### 5.2 KDS (RF-058, RNF-061)
- Umbrales de tiempo: a tiempo → `success`, cerca del límite → `warning`, vencido → `error`, en la franja superior de la tarjeta, con el texto del temporizador en negrita ≥ 24 px (pasa el criterio de texto grande).
- Ítem cancelado: tachado + etiqueta "CANCELADO" en `error`, negrita.
- **Sin modo oscuro** (PA-050). El KDS usa los mismos fondos claros que el resto de la app; para que se lea bien en cocina, los textos son grandes y en negrita y las tarjetas tienen borde `primary`.

### 5.3 Indicador de conexión (doc 09 §9)
🟢 En línea → `success` · 🟡 Inestable → `warning` · 🔴 Sin conexión → `error`. Siempre con texto ("En línea", "Inestable", "Sin conexión").

### 5.4 Reportes y gráficas
Series en este orden: `primary`, `secondary`, `accent`, `surface` con borde `primary`. Los colores funcionales solo para significado (meta cumplida, alerta de margen). Para más de 4 series se usan tonos de opacidad de `primary`/`secondary`, sin colores nuevos.

### 5.5 Tickets impresos
Las impresoras térmicas son monocromas: la paleta no aplica a los impresos (doc 11).

## 6. Implementación

> **Hecho en la Semana 0 (bloque 4, 2026-11-12):** tokens en `frontend/src/styles/index.css` (Tailwind 4 sin su paleta por defecto: solo existen los colores del tema y el blanco), temas en `frontend/src/styles/themes/`, validador de contraste en `shared/domain/theme` (lo usarán también el backend y la prueba de cada tema nuevo) y componentes base en `frontend/src/core/ui` (doc 19 §4). Catálogo visual en `/_ui` (solo desarrollo).
>
> **Decisiones de implementación:**
> - **Tipografía** (de la skill `claude`): una sola familia, **Inter** variable, con cifras tabulares para montos, horas y folios. Escala fija 12/14/16/20/24/32 px; 20 px en negrita cuenta como texto grande para WCAG. Espaciado 4/8/12/16/24/32; radios 4 y 8 px; sin sombras salvo en lo que flota (modales).
> - **Botones:** 48 px (md) o 56 px (lg) de alto (RNF-062). El destructivo siempre usa 20 px en negrita (PA-049 a). Deshabilitado: `surface` + `accent`, `aria-disabled` y cursor.
> - **Indicador de conexión (§5.3):** `warning` sobre fondo claro no llega a 3:1 como ícono, así que el ícono de cada estado va dentro de un círculo de su color (blanco sobre `success`/`error`, `primary` sobre `warning`) y el texto siempre es `primary`.
> - **`theme-color`** del navegador = `background` (coincide con la barra superior de la app).
> - Revisión con `web-design-guidelines` aplicada (2026-11-12): sin espera de doble toque, animaciones solo de `transform`/`opacity`, enlace para saltar al contenido, áreas seguras del celular.

- Los tokens se definen una sola vez como variables CSS (`--color-primary`, `--color-secondary`, `--color-accent`, `--color-surface`, `--color-background`, `--color-success`, `--color-warning`, `--color-error`) y se exponen en el tema de Tailwind con esos mismos nombres.
- El frontend aplica el tema que devuelve `GET /api/config/public` (doc 06 §3.4): `theme_id` (por defecto `botanical-graphite`) y, si existe, `color_primary_override`.
- **El cliente solo puede cambiar `primary`** (PA-048). `secondary`, `accent`, `surface`, `background` y los colores funcionales son fijos. Al guardar un `primary` nuevo, el backend valida que cumpla: blanco sobre `primary` ≥ 4.5, `primary` sobre `background` ≥ 4.5 y `primary` sobre `surface` ≥ 4.5; si no cumple, se rechaza con un mensaje que dice qué falla.
- Revisión de cada pantalla con la skill `web-design-guidelines` y verificación de contraste automática en las pruebas E2E.
- La skill `claude` (`awesome-design-claude`) sigue siendo la referencia para tipografía, espaciado y estilo; **en color manda este documento**.

## 7. Preguntas de este documento
| ID | Estado | Respuesta |
|---|---|---|
| PA-048 | ✅ Resuelta 2026-11-11 | Solo se cambia `primary`, con validación de contraste. Se quiere un sistema de varios temas: ver §8 |
| PA-049 | ✅ Resuelta 2026-11-11 | (a) Botones destructivos con texto blanco grande en negrita (≥ 18.66 px), sin color nuevo. (b) Se acepta el blanco sobre fondos oscuros |
| PA-050 | ✅ Resuelta 2026-11-11 | Sin modo oscuro (tampoco en el KDS) |
| PA-053 | ✅ Resuelta 2026-11-12 | RENGO entregó 5 paletas más; asignación de tokens y contraste en §8.4 |
| PA-054 | ✅ Resuelta 2026-11-12 | Se aprueban los tonos derivados ◆ de §8.4 |

## 8. Sistema de temas (implementado 2026-11-12)

**Pregunta de RENGO:** ¿qué tan complicado es tener varios temas?

**Respuesta corta:** es **poco trabajo si se hace desde el inicio** (Semana 0) y **caro si se agrega después**. Como la regla ya es "colores solo por token, nunca hex sueltos", el sistema de temas es casi gratis: un tema es solo otro juego de valores para los mismos 8 tokens.

### 8.1 Cómo funciona
1. **Tokens como variables CSS.** Los componentes solo usan `var(--color-primary)` (vía Tailwind). Ningún componente sabe qué tema está activo.
2. **Un tema = un objeto de datos.** Cada tema es un objeto con los 8 tokens en `shared/domain/theme/themes.ts` (desde 2026-11-12, SC-21: el backend también los necesita para validar el `primary` del cliente), por ejemplo:
   ```ts
   export const botanicalGraphite = {
     id: "botanical-graphite",
     primary: "#243A35", secondary: "#526D61", accent: "#A5A58D",
     surface: "#E9E5D8", background: "#F8F7F2",
     success: "#38845B", warning: "#D69B3D", error: "#C65353",
   };
   ```
3. **Aplicar el tema.** Al cargar `config/public`, la app pone `data-theme="<id>"` en `<html>` y escribe las variables CSS. Si hay `color_primary_override`, solo se cambia `--color-primary`. Cambiar de tema no recarga la página.
4. **Validador de contraste automático.** Una prueba recorre todos los temas y comprueba las combinaciones permitidas de §4.1 (ej. blanco sobre `primary` ≥ 4.5). Un tema que no cumple no pasa la prueba y no se puede publicar. El mismo validador se usa en el backend para el `primary` del cliente.
5. **Configuración.** El administrador elige el tema en Configuración › Restaurante (`client_settings.theme_id`) y, opcionalmente, su `primary`.

### 8.2 Qué cuesta
| Momento | Esfuerzo | Por qué |
|---|---|---|
| En la Semana 0, junto con los tokens | **2 a 3 días extra** | Variables CSS, cargar el tema, validador de contraste y la prueba. Botanical Graphite queda como el único tema del MVP |
| Cada tema nuevo después | **Medio día** | Elegir 8 colores, pasar el validador y revisar las pantallas principales |
| Si se agrega cuando ya hay pantallas | **Semanas** | Hay que buscar y cambiar colores sueltos en todos los componentes |

### 8.3 Límites
- Todos los temas son **claros** (PA-050: no hay modo oscuro). Un tema oscuro sería otro trabajo: revisar cada combinación de §4.1 y los estados de mesa.
- Los colores funcionales (`success`, `warning`, `error`) pueden variar por tema, pero siempre deben pasar el validador.
- Los impresos no cambian (son monocromos).
- Los temas viven en el código (son parte del producto, iguales para todos los clientes); lo que cada cliente elige es configuración. Esto cumple la regla 4 del proyecto.

**Recomendación:** hacerlo en la Semana 0 (módulo 3, frontend core) con Botanical Graphite como único tema, y agregar los otros como datos (§8.4).

### 8.4 Temas adicionales definidos por RENGO (PA-053, 2026-11-12)

RENGO entregó 5 paletas de 5 colores. Cada tema necesita los 8 tokens, así que aquí se asigna cada color a un token y se revisa el contraste con las mismas reglas de §4. Botanical Graphite sigue siendo el tema por defecto.

**Cómo se asignó:**
- `primary`: el color oscuro de la paleta (botones principales y texto). Debe dar ≥ 4.5 con texto blanco, sobre `background` y sobre `surface`.
- `secondary`: un segundo color que dé ≥ 4.5 sobre `background` (enlaces, íconos activos).
- `accent`: un color de la paleta solo para detalles; nunca como texto ni como estado.
- `surface` y `background`: los colores claros.
- `success`, `warning`, `error`: los de Botanical Graphite (§2) en todos los temas, salvo donde la paleta trae un dorado que pasa las reglas: ahí ese dorado reemplaza a `warning` para no tener dos amarillos parecidos.
- Cuando la paleta no trae un color que cumpla una regla, se propone un **tono derivado**: el mismo color de la paleta, más claro o más oscuro. Los derivados están marcados con ◆ y fueron **aprobados** por RENGO el 2026-11-12 (PA-054).

#### Tema 1 — "Piedra y rosa" (`piedra-y-rosa`)
| Token | Color | Hex |
|---|---|---|
| primary | Stone Brown | `#5E5B52` |
| secondary | ◆ Rose Kiss oscurecido | `#A3245C` |
| accent | Pink Carnation (y Rose Kiss `#FE5D9F` en gráficas) | `#F686BD` |
| surface | Pale Sky | `#BAD7F2` |
| background | Lemon Chiffon | `#FFFBBD` |
| success / warning / error | Botanical Graphite | `#38845B` / `#D69B3D` / `#C65353` |

Contraste: blanco sobre `primary` 6.79 ✅ · `primary` sobre `background` 6.39 ✅ · `primary` sobre `surface` 4.55 ✅ · `secondary` sobre `background` 6.67 ✅ y sobre `surface` 4.75 ✅.
⚠️ Ningún color de la paleta sirve como `secondary` (Rose Kiss da 2.72 sobre el fondo), por eso el derivado. `error` sobre `surface` da 2.96 (< 3): los indicadores de error dentro de tarjetas `surface` llevan borde `primary`. Rose Kiss se parece a `error`: no usarlo en etiquetas.

#### Tema 2 — "Carbón y oro" (`carbon-y-oro`)
| Token | Color | Hex |
|---|---|---|
| primary | Charcoal Brown | `#423E37` |
| secondary | Dim Grey | `#6E675F` |
| accent | Rosy Granite | `#A39594` |
| surface | Eggshell | `#EDEBD7` |
| background | ◆ Eggshell aclarado | `#F7F6EE` |
| warning | Sunflower Gold (reemplaza el de Botanical) | `#E3B23C` |
| success / error | Botanical Graphite | `#38845B` / `#C65353` |

Contraste: blanco sobre `primary` 10.63 ✅ · `primary` sobre `background` 9.80 ✅ y sobre `surface` 8.84 ✅ · `secondary` sobre `background` 5.14 ✅ y sobre `surface` 4.63 ✅ · `primary` sobre `warning` 5.42 ✅.
Es el tema que mejor cumple. ⚠️ La paleta solo trae un color claro, por eso el fondo derivado (si se usara Eggshell para fondo y tarjetas, las tarjetas no se distinguirían del fondo).

#### Tema 3 — "Violeta medianoche" (`violeta-medianoche`)
| Token | Color | Hex |
|---|---|---|
| primary | Midnight Violet | `#30011E` |
| secondary | Charcoal | `#545454` |
| accent | Dark Goldenrod | `#B68F40` |
| surface | Celadon | `#B6CCA1` |
| background | Tea Green | `#D7FCD4` |
| success / warning / error | Botanical Graphite | `#38845B` / `#D69B3D` / `#C65353` |

Contraste: blanco sobre `primary` 18.28 ✅ · `primary` sobre `background` 16.33 ✅ y sobre `surface` 10.57 ✅ · `secondary` sobre `background` 6.77 ✅ · `secondary` sobre `surface` 4.38 ⚠️ (igual que en Botanical: solo texto grande o íconos).
Sin derivados. ⚠️ El fondo y las tarjetas son verdes, así que `success` (verde) se distingue poco: sobre `surface` da 2.63 y `error` 2.55. Los estados dentro de tarjetas llevan borde `primary` y siempre texto o ícono. Dark Goldenrod se parece a `warning`: solo como detalle.

#### Tema 4 — "Uva y porcelana" (`uva-y-porcelana`, paleta de la imagen)
| Token | Color | Hex |
|---|---|---|
| primary | ◆ Dusty Grape oscurecido | `#3F4270` |
| secondary | Dusty Grape | `#5B5F97` |
| accent | Pale Slate (y Grapefruit Pink `#FF6B6C` en gráficas) | `#B8B8D1` |
| surface | ◆ Pale Slate aclarado | `#ECECF4` |
| background | Porcelain | `#FFFFFB` |
| warning | Sunflower Gold (reemplaza el de Botanical) | `#FFC145` |
| success / error | Botanical Graphite | `#38845B` / `#C65353` |

Contraste: blanco sobre `primary` 9.44 ✅ · `primary` sobre `background` 9.42 ✅ y sobre `surface` 8.03 ✅ · `secondary` sobre `background` 5.94 ✅ y sobre `surface` 5.06 ✅ · `primary` sobre `warning` 5.83 ✅.
⚠️ Con Dusty Grape como `primary`, el dorado no se lee con texto `primary` (3.67) y Pale Slate como `surface` no deja leer `secondary` (3.06) ni los estados (≈ 2.3). Por eso se oscurece el `primary` y se aclara la `surface`; Dusty Grape sigue presente como `secondary`. Grapefruit Pink se parece a `error`: solo en gráficas.

#### Tema 5 — "Cielo de medianoche" (`cielo-de-medianoche`)
| Token | Color | Hex |
|---|---|---|
| primary | Baltic Blue | `#1C5D99` |
| secondary | Carbon Black | `#222222` |
| accent | Pacific Blue (y Powder Blue `#BBCDE5` en detalles) | `#639FAB` |
| surface | ◆ Powder Blue aclarado | `#E4ECF6` |
| background | White | `#FFFFFF` |
| success / warning / error | Botanical Graphite | `#38845B` / `#D69B3D` / `#C65353` |

Contraste: blanco sobre `primary` 6.83 ✅ · `primary` sobre `background` 6.83 ✅ y sobre `surface` 5.73 ✅ · `secondary` sobre `background` 15.91 ✅.
⚠️ Powder Blue como `surface` no deja leer `primary` (4.22) ni los estados (≈ 2.7), por eso se aclara. Pacific Blue no sirve como texto (2.97 sobre blanco).

### 8.5 Resumen de temas
| Tema | Derivados ◆ | Cumple sin restricciones |
|---|:-:|---|
| Botanical Graphite (por defecto) | 0 | Sí (con las reglas de §4.2) |
| 1 · Piedra y rosa | 1 | Casi: errores dentro de tarjetas con borde |
| 2 · Carbón y oro | 1 | Sí |
| 3 · Violeta medianoche | 0 | Casi: estados dentro de tarjetas con borde; `secondary` en tarjetas solo grande |
| 4 · Uva y porcelana | 2 | Sí |
| 5 · Cielo de medianoche | 1 | Sí |

**Cuándo:** el sistema de temas se hace en la Semana 0 con Botanical Graphite; los 5 temas se agregan en H1 como datos, medio día cada uno. Antes de publicarlos se revisan las pantallas de mesero, caja y KDS con cada tema.

