# Design spec exacto — Rediseño Favoritos (v2 final) — 2026-08-19

Fuente visual: `mocks/favoritos-final.html` (aprobado por el operador). Este
documento acota **valores exactos** para implementar sin "ojímetro". Todo medido
en el mock. Fuente tipográfica global heredada: `Inter, system-ui, -apple-system,
"Segoe UI", Roboto, sans-serif` (no se declara por componente salvo tamaño/peso).

> Nota de implementación: estos valores son el objetivo de diseño. Al portar a
> styled-components conviene promover los colores a tokens (ver §1) en vez de
> hardcodearlos. Los `rgba(255,255,255,.0x)` son capas sobre fondo oscuro.

---

## 1. Tokens de color

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0a0c10` | fondo del tab (tras las columnas) |
| `--panel-1` | `#14171d` | tope de columnas (rail/spot/composer) |
| `--panel-2` | `#0f1217` | base de columnas (degradado) |
| `--line` | `rgba(255,255,255,.07)` | bordes/divisores sobre oscuro |
| `--ink` | `#eaeef3` | texto principal |
| `--ink-2` | `#c3cad3` | texto secundario / iconos botón |
| `--mut` | `#8b94a1` | texto atenuado (labels, horas, previews) |
| `--center` | `#0d1015` | base del área de chat |
| `--peer` | `#1b2029` | burbuja de la modelo |
| `--peer-line` | `rgba(255,255,255,.07)` | borde burbuja modelo |
| `--me` | `#283040` | burbuja propia (grafito) |
| `--red` | `#ea1d1d` | acento de marca (CTA, enviar, selección, like) |
| `--red-2` | `#b91212` | fondo inferior de degradados rojos |
| `--red-line` | `rgba(234,29,29,.34)` | bordes rojos sutiles |
| `--red-glow` | `rgba(234,29,29,.28)` | sombras de botones rojos |
| `--gold-1` / `--gold-2` | `#ffd778` / `#f5b942` | badge de precio + corona |
| `--ok` | `#22c55e` | presencia en línea |
| `--busy` | `#f59e0b` | presencia ocupada |
| `--off` | `#8891a0` | presencia desconectada |

---

## 2. Layout general

- Contenedor tab: `display:flex; height:100%` (en el mock `660px`), fondo `--bg`.
- **3 columnas**: rail `flex:0 0 288px` · centro `flex:1; min-width:0` · spot `flex:0 0 320px`.
- Columnas rail y spot: `background:linear-gradient(180deg,#14171d,#0f1217)`,
  borde interior `1px solid --line` (rail: `border-right`; spot: `border-left`).

---

## 3. Columna izquierda — Conversaciones

**Cabecera (`.railTop`)**: `padding:16px 14px 8px`.
- Título `h2`: `12–13px / 800 / letter-spacing .05em / text-transform:uppercase / color --mut`, `margin:0 2px 10px`.
- **Buscador (`.search`)**: `background:rgba(255,255,255,.06); border:1px solid --line; border-radius:11px; padding:8px 12px; gap:8px`. Input interno `13.5px`, placeholder `--mut`, icono `--mut 13px`.

**Lista (`.list`)**: `padding:8px 10px 12px; gap:1px; overflow-y:auto`.

**Etiqueta de grupo (`.grouplbl`)** ("En línea"/"Desconectadas"): `10.5px / 700 / letter-spacing .06em / uppercase / --mut`, `padding:10px 8px 5px`.

**Fila de contacto (`.item`)**: `padding:9px 10px; gap:11px; border-radius:12px; border:1px solid transparent`.
- Hover: `background:rgba(255,255,255,.05)`.
- Seleccionada (`.sel`): `background:linear-gradient(90deg, rgba(234,29,29,.15), rgba(234,29,29,.03)); border-color:--red-line`.

**Avatar (`.av`/`.avl`)**: `44×44; border-radius:50%`. Sin foto (`.avl`): degradado `135deg, #ff5c8a, #a78bfa`, inicial `700 #fff`.
**Punto de presencia (`.dot`)**: `12×12; border-radius:50%; border:2.5px solid #0f1217`, posición `right:0; bottom:0`. Colores: on `--ok`, busy `--busy`, off `--off`.

**Texto fila**:
- Fila superior (`.itop`): nombre + hora, `align-items:baseline; gap:8px`.
- Nombre (`.nm`): `14.5px / 600 / #e2e7ec`, ellipsis.
- Hora (`.time`): `11px / --mut`.
- Preview (`.prevtxt`): `12.5px / --mut`, ellipsis.
- Badge 24/7 (`.badge247`): `9.5px / 800; color:#0f5132; background:#d1f4df; border-radius:999px; padding:2px 6px`.
- No-leídos (`.unread`): `min-width:18px; height:18px; padding:0 5px; border-radius:999px; background:--red; color:#fff; 11px/700`, centrado.

---

## 4. Columna centro — Chat

**Cabecera (`.chead`)**: `padding:13px 18px; gap:12px; border-bottom:1px solid --line; background:rgba(20,23,29,.6)`.
- Avatar (`.chsm`): `38×38; border-radius:50%`.
- Nombre (`.who .n`): `15.5px / 700 / #f2f5f8`.
- Presencia (`.who .p`): `12px / color --ok`, con punto `7×7` a la izquierda.
- Botón "Ver original" (`.btnOrig`): `12px / 600 / #cbd5e1; border:1px solid --line; background:rgba(255,255,255,.05); border-radius:999px; padding:6px 12px`. Alineado a la derecha (`margin-left:auto`).

**Área de mensajes (`.scroll`)** — fondo EXACTO (3 capas + patrón):
```css
background-color:#0d1015;
background-image:
  radial-gradient(130% 62% at 84% -10%, rgba(234,29,29,.22), transparent 58%),
  radial-gradient(80% 55% at 6% 108%, rgba(234,29,29,.10), transparent 55%),
  radial-gradient(90% 50% at -5% 2%, rgba(167,139,250,.08), transparent 55%),
  url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'><g fill='none' stroke='%23ffffff' stroke-opacity='0.045' stroke-width='1'><path d='M17 5 L23 17 L17 29 L11 17 Z'/><circle cx='17' cy='17' r='1.1' fill='%23ffffff' fill-opacity='0.05' stroke='none'/></g></svg>");
background-repeat:no-repeat,no-repeat,no-repeat,repeat;
padding:18px clamp(16px,3vw,30px);
```
(Glow rojo dominante arriba-derecha + rojo tenue abajo-izquierda + violeta muy leve
arriba-izquierda + trama de rombos blancos al ~4.5%.)

**Separador de día (`.daysep span`)**: `11px / 600 / --mut; background:rgba(255,255,255,.05); border:1px solid --line; border-radius:999px; padding:4px 12px`. Centrado, `margin:2px 0 16px`.

**Fila de mensaje (`.row`)**: `margin:10px 0`. Propia (`.me`): `justify-content:flex-end`.
**Grupo burbuja (`.bubwrap`)**: `gap:9px; max-width:74%; align-items:flex-end`. Propia invierte con `flex-direction:row-reverse`.
**Mini-avatar**: modelo (`.mav`) `26×26` foto; propio (`.mavm`) `26×26`, `background:#2f6b4a`, inicial `700 11px #fff`.
**Burbuja (`.bub`)**: `padding:10px 14px; border-radius:16px; font-size:14.5px; line-height:1.5`.
- Modelo (`.peer`): `background:--peer; border:1px solid --peer-line; border-bottom-left-radius:5px; color:#e7ebf1`.
- Propia (`.me`): `background:--me; border-bottom-right-radius:5px; color:#f4f7fb`.
**Timestamp (`.ts`)**: `10.5px / --mut; margin-top:4px` (propia alineada a la derecha).
**Traducción (`.trans`)**: `12.5px / color #8fb4e8; gap:5px; margin-top:5px`.
**Emoji suelto grande (`.emojiBig`)**: `font-size:36px; line-height:1` (sin burbuja).

**Composer (`.composer`)**: `padding:12px 16px; gap:10px; border-top:1px solid --line; background:--panel-1`.
- Botones emoji / regalo (`.cbtn`): `42×42; border-radius:12px; border:1px solid --line; background:rgba(255,255,255,.06); font-size:19px; color:--ink-2`. Hover `rgba(255,255,255,.11)`.
- Input (`.input`): `height:44px; border-radius:12px; border:1px solid transparent; background:rgba(255,255,255,.08); color:#f8fafc; padding:0 14px; font-size:15px`. Placeholder `rgba(226,232,240,.6)`. Foco: `border-color:--red-line; box-shadow:0 0 0 3px rgba(234,29,29,.10)`.
- Enviar (`.send`): `44×44; border-radius:12px; border:0; background:linear-gradient(180deg,--red,--red-2); color:#fff; font-size:16px; box-shadow:0 6px 16px --red-glow`.

---

## 5. Columna derecha — Spotlight

Contenedor (`.spot`): `flex:0 0 320px; overflow-y:auto`.

**Cover (`.cover`)**: `height:230px`. Imagen `object-fit:cover` a todo el ancho.
- Velo inferior (`::after`): `linear-gradient(180deg, rgba(15,18,23,0) 35%, rgba(15,18,23,.55) 70%, --panel-1 100%)` para fundir con el cuerpo.
- Info sobre cover (`.coverInfo`): `left:16px; right:16px; bottom:12px`.
  - Nombre (`.n`): `21px / 800 / #fff`, con corona SVG `22×22` a la derecha (gap 9px).
  - Presencia (`.p`): `12.5px / color #d7f7e3`, punto `7×7 --ok` + "· 24 años".

**Cuerpo (`.spotbody`)**: `padding:14px 16px 18px; gap:14px`.

### 5.1 Botón "Iniciar videollamada" (`.cta`) — acción principal
```css
display:block; width:100%; border:0; cursor:pointer;
border-radius:14px; padding:13px 16px; color:#fff; text-align:left;
background:linear-gradient(180deg, #ea1d1d, #b91212);
box-shadow:0 10px 24px rgba(234,29,29,.28);
position:relative;
```
Contenido:
- Línea 1 (`.l1`): texto **"📹 Iniciar videollamada"** — `font-size:15.5px; font-weight:800; display:flex; gap:9px` (emoji cámara + texto). Fuente Inter (heredada).
- Línea 2 (`.l2`): subtítulo **"1,50 € / min · saldo suficiente"** — `font-size:12px; color:rgba(255,255,255,.82); margin-top:2px`. El importe €/min sale de la tarifa real; el sufijo cambia a "saldo insuficiente" si aplica.
- Flecha (`.arrow`): "›" `18px`, `position:absolute; right:16px; top:50%; translateY(-50%)`.

### 5.2 Reputación (`.rep`)
`display:flex; align-items:center; gap:12px; background:rgba(255,255,255,.04); border:1px solid --line; border-radius:14px; padding:12px 14px`.
- Corona SVG (`.crownbig`): `38×35`.
- Número (`.repn .k`): `18px / 800 / #fff`. Etiqueta (`.repn .s`): `11.5px / uppercase / --mut` (p.ej. "Tiara · me gusta").
- Botón "Dar like" (`.likebtn`): `13px / 700; color:#ff8a8a; background:rgba(234,29,29,.12); border:1px solid --red-line; border-radius:11px; padding:8px 12px; gap:6px` (corazón ❤ + texto).

### 5.3 Datos (`.sec` + `.facts`)
- Título sección (`.h`): `11px / 800 / uppercase / letter-spacing .05em / --mut`.
- Rejilla (`.facts`): `grid-template-columns:1fr 1fr; gap:8px`.
- Celda (`.fact`): `background:rgba(255,255,255,.04); border:1px solid --line; border-radius:11px; padding:9px 11px`.
  - Label (`.fl`): `10px / 700 / uppercase / --mut`. Valor (`.fv`): `13.5px / #e6eaef`.
- Campos: Altura, Cuerpo, Pecho, Idioma (de `model_profile_attributes` + idioma).

### 5.4 Regalos rápidos (`.qgifts` / `.qchip`)
- Contenedor: `display:flex; gap:7px; flex-wrap:wrap`.
- Chip (`.qchip`): `44×44; border-radius:12px; border:1px solid --line; background:radial-gradient(circle at 50% 32%, rgba(255,255,255,.09), rgba(255,255,255,.02)); font-size:21px`. Hover `translateY(-3px)`.
- Precio (`.pr`): `8px / 800; color:#2a1c04; background:linear-gradient(180deg,--gold-1,--gold-2); border-radius:999px; padding:1px 5px`, esquina inferior-derecha.

### 5.5 Ver perfil completo (`.fullprofile`) — D1
Precedido de divisor (`.divider`: `height:1px; background:--line; margin:2px 0`).
```css
display:flex; align-items:center; justify-content:center; gap:7px; width:100%;
border:1px solid --line; background:transparent; color:--ink-2;
border-radius:11px; padding:10px; font-size:13px; font-weight:600; cursor:pointer;
```
Texto **"Ver perfil completo ›"**. Hover: `background:rgba(255,255,255,.05); color:#fff; border-color:rgba(255,255,255,.16)`. Abre el modal `ModelProfileExpanded` existente.

---

## 6. Navbar
Se respeta el navbar actual (no se rediseña). En el mock se replica solo como
contexto: fondo `#0a0c10`, borde inferior `--line`, tab activa con subrayado rojo
`2px --red`.

---

## 7. Resumen de fuentes usadas
- **Familia única**: Inter (con la cadena de fallback del sistema). No se
  introduce ninguna fuente nueva.
- **Pesos**: 600 (nombres, textos de énfasis), 700 (números, badges, likes,
  inputs de acción), 800 (títulos de sección, nombre en cover, línea 1 del CTA).
- **Tamaños clave**: 21px (nombre cover), 15.5px (CTA l1 / nombre chat / nombre
  header), 14.5px (nombre lista / burbuja), 13.5–13px (valores/botones), 12.5px
  (preview/traducción/subtítulos), 11–10px (labels/horas/timestamps).
