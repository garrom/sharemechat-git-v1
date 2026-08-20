# Plan de rediseño — Perfil (cliente/modelo) — 2026-08-20

**Estado:** DISEÑO EN CURSO. Dirección de UX **aprobada por el operador** (mock).
Pendiente: cerrar el diff real↔mock y trocear en fases. **Nada implementado aún.**

**Restricción CLAVE del operador:** el **sistema de subida/validación de ficheros
NO se toca** — solo **aspecto** (restyle). La UX/estética es la del mock; la lógica
por debajo (endpoints, validación formato/tamaño, límites, revisión, principal,
lightbox, modal de subida) se conserva **tal cual**.

**Mock de referencia:** `perfil-redesign-assets/mocks/perfil-modelo.html`.

---

## 1. Andamiaje real (fuente leída)

`PerfilModel.jsx` + `PerfilClientModelStyle.js` + `MyAssetsManager.jsx`
(+`MyAssetsManagerStyles.js`):

```
PageShell (fondo #111418, oscuro)
└─ StyledNavbar (brand + "Back")
└─ ProfileMain (panel claro: pageBg gradiente #f9fafb→#f3f5f7, borde #e6e7ea, radius 18)
   ├─ ProfileHeader (card): Avatar(68px, anillo rojo) + Nombre + chip MODEL + subtítulo + Meta[Status/Email/Idioma]
   ├─ ContractNoticeCard (condicional)
   ├─ Mensajes (loading/error/ok)
   └─ ProfileGrid (2 columnas)
      ├─ IZQUIERDA:
      │   ├─ Card "Datos básicos" (name/surname/nickname)  ← SIN botón guardar
      │   ├─ Card "Sobre ti" (bio/interests) + [Guardar]   ← guarda TAMBIÉN los básicos
      │   ├─ Card "Datos físicos" (bust/height/butt/body) + [Guardar]  (endpoint aparte)
      │   └─ MyAssetsManager: 2 secciones — **Fotos (5) + Vídeos (2)**, slots con
      │        thumbnail + estrella principal + badge estado (Aprobado/Pendiente/
      │        Rechazado) + menú "…" (marcar principal / eliminar) + "+" añadir.
      │        Modal de subida (preview) + lightbox. Validación cliente:
      │        JPG/PNG/WebP ≤10 MB · MP4 ≤60 MB.
      └─ DERECHA:
          ├─ ModelReputationCard (likes+insignia+progreso+"Ver Top modelos")
          ├─ PreferredChatLangCard
          └─ SecurityCard (cambiar contraseña + darse de baja)
```
El **cliente** comparte shell/estilos; más simple: sin físicos/reputación/contrato;
foto **única** (MediaCard en la derecha, no MyAssetsManager) + LinkedAccountsCard (Google).

**SISTEMA que NO se toca (solo aspecto):** toda la lógica de `MyAssetsManager`
(endpoints `/me/assets`, POST multipart, PUT principal, DELETE; validación
formato/tamaño; límites 5/2; estados de revisión; principal; modal; lightbox) y
la lógica de guardado de `PerfilModel/PerfilClient` (endpoints, handlers).

---

## 2. Diff real ↔ mock (lo que cambia)

Etiquetas: **[Aspecto]** solo estilo · **[Estructura]** reordenar/mover ·
**[Nuevo]** no existe.

### Fondos y color
1. **[Aspecto]** Fondo exterior (`PageShell`): real **`#111418` (oscuro)** → mock
   **claro** (`#eef0f4`). *(Punto a decidir: mantener oscuro o pasar a claro; ver §4.)*
2. **[Aspecto]** Botón "Guardar" (accent): real **`#354556`** (pizarra) → mock
   **`#1b2027`** (tinta casi negra). Menor; unificable.
3. **[Aspecto]** Panel de contenido, cards, borde y sombra: se mantienen
   (panel claro, cards blancas, radius, sombra suave) con acentos rojos.

### Estructura / jerarquía
4. **[Estructura]** **Fotos y vídeos suben a lo más alto** de la columna izquierda
   (hero), antes iban lo último. Siguen **separados** (Fotos 5 / Vídeos 2), como el sistema real.
5. **[Nuevo]** **Barra de completitud** en la cabecera ("70% completo · añade un
   vídeo para destacar"). Cálculo en frontend (campos + assets); sin backend.
6. **[Estructura]** **Guardar por card**: "Datos básicos" pasa a tener **su propio**
   botón (hoy no tiene; se guarda desde "Sobre ti"). Cada card guarda lo suyo.
   *(Requiere partir `handleSave` en dos: básicos vs sobre-ti. Solo lógica de UI de
   guardado, no toca los endpoints.)*
7. **[Aspecto]** Cabecera: avatar un poco mayor; misma info (nombre/chip/meta).

### Gestor de assets (solo aspecto)
8. **[Aspecto]** Slots restyleados a la estética del mock (thumbnail redondeado,
   badge de estado con color, estrella de principal roja, "+" con borde discontinuo
   rojo). **La lógica no cambia**: mismos slots (5/2), estados, menú, modal, lightbox.
9. **[Aspecto]** Foto **aspect 3/4**, vídeo **aspect 16/9** en los slots (presentación).

*(Cliente: los mismos criterios; su foto única se restylea sin tocar la lógica de
select/upload/delete.)*

---

## 3. Design-spec (valores) — real vs mock

| Token / elemento | Real (actual) | Mock (nuevo) |
|---|---|---|
| Fondo exterior (PageShell) | `#111418` (oscuro) | `#eef0f4` (claro) *(decisión)* |
| Panel contenido (ProfileMain) | `linear-gradient(180deg,#f9fafb,#f3f5f7)` | igual (claro) |
| Card | `#ffffff`, borde `#e6e7ea`, radius 14–16, sombra `0 1px 2px + 0 8px 24px rgba(17,24,39,.06)` | igual |
| Acento rojo | `#ea1d1d` / soft `#fbeaea` / line `rgba(234,29,29,.28)` | igual |
| Botón guardar | `#354556` | `#1b2027` (o unificar a `#354556`) |
| Título sección | barra roja 3×15 + texto 15px/800 `#1b2027` | igual |
| Barra completitud | — | `#e9edf2` fondo, relleno `linear-gradient(90deg,#f0b331,#ea1d1d)`, 8px, radius 999 |
| Slot foto | (MyAssetsManagerStyles actual) | radius 12, aspect 3/4, thumb cover; badge estado ok `rgba(31,157,87,.95)` / pend `rgba(224,176,49,.97)` / rej `rgba(176,64,47,.97)`; estrella `rgba(234,29,29,.92)`; "+" borde discontinuo `redLine` sobre `redSoft` |
| Slot vídeo | — | igual pero aspect 16/9, fondo `#0e0f12`, overlay ▶ |

*(Los valores exactos finales de cada componente se cierran en el design-spec de
implementación cuando arranquemos, como en favoritos.)*

---

## 4. Decisiones abiertas
- **D1 — Fondo exterior claro vs oscuro.** El real es oscuro (`#111418`); el mock lo
  puso claro. ¿Mantener oscuro (coherente con favoritos) o claro (más "formulario")?
- **D2 — Guardar por card.** Confirmar que se parte `handleSave` (básicos / sobre-ti)
  y que "Datos básicos" tenga su propio botón.
- **D3 — Completitud.** Fórmula (qué campos + assets cuentan y con qué peso).

## 5. Fases (borrador)
- **Fase 1 — Cabecera + completitud** (aspecto + barra nueva).
- **Fase 2 — Fotos/Vídeos como hero + restyle de slots** (aspecto; sistema intacto).
- **Fase 3 — Guardar por card** (partir handleSave; UI).
- **Fase 4 — Restyle general de cards/campos** (aspecto) + fondo (D1).
- **Fase 5 — Cliente** (mismos criterios; foto única).
Cada fase valida en TEST; a main/PROD bajo OK explícito.
