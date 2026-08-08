# Auditoría de colisiones de nombres en styled-components (2026-08-08)

**Estado:** COMPLETADA. Consecuencia del bug del scroll investigado en `scroll-dashboard-favoritos-investigation-2026-08-08.md`.

**Autor:** Fase E del refactor de nombres (2026-08-08).

---

## 1. Contexto

Tras resolver el bug del scroll (causado por dos `StyledContainer` distintos en el proyecto, con JavaScript resolviendo imports por orden silenciosamente), se hizo auditoría exhaustiva de todos los nombres de styled-components que colisionan (>1 `export const NombreStyled` en varios archivos de `frontend/src/styles/`) para detectar si otras colisiones latentes reproducían el mismo patrón bug.

## 2. Metodología

Script node en `.tmp/audit-orphans.js` (versión final movida a la investigación).

1. `grep -rn "^export const .* = styled" sharemechat-v1/frontend/src/styles/` → 41 nombres con ≥2 definiciones.
2. Por cada nombre colisionante, buscar imports `import { NombreStyled } from '.../<archivo>'` en consumers (`sharemechat-v1/frontend/src/` fuera de `/styles/`). Contar consumers por origen.
3. Marcar **PELIGROSO** si un consumer importa el mismo nombre desde 2 módulos distintos (patrón bug StyledContainer).
4. Marcar **COSMÉTICO** si cada consumer importa de un único origen consistentemente.
5. Marcar **HUÉRFANO** las definiciones que no tienen ningún consumer.

## 3. Resultado

### PELIGROSOS: 0

Ningún consumer del proyecto reproduce el patrón bug. `StyledContainer` era la única colisión que sí lo reproducía; se resolvió con Fase A (rename `VideochatStyles.StyledContainer → DashboardShell`) y Fase B (rename `NavbarStyles.StyledContainer → PageShell`).

Verificaciones complementarias:
- No hay barrel files en `/styles/` (no existe `styles/index.js`).
- No hay `import * as X from '.../styles/...'`.
- No hay re-exports (`export * from`, `export { X } from`) dentro de `/styles/`.
- Cero imports namespace o default desde cualquier módulo de `/styles/`.

### COSMÉTICOS: 41

Duplicación de código sin efecto de resolución silenciosa. Cada consumer importa de UN único origen. Riesgo: bajo (deuda de mantenimiento, no bug latente).

Clusters detectados:

**ModelDocumentStyles vs PerfilClientModelStyle (10 nombres):**
`CardBody, CardHeader, CardSubtitle, CardTitle, PhotoActions, PhotoEmpty, PhotoImg, PhotoPreview, FileInput, FileNameWrapper, Hint, Message`

**public-styles (ForgotResetPass / RegisterClientModel / Login / PublicShell):**
`ButtonPrimary, Card, Container, Field, FieldError, Form, Input, Label, Title, CloseBtn, StyledBrand, StyledButton, StyledError, StyledInput, StyledLinkButton, TabButton`

**Admin cluster (AdminStyles vs EstadisticaStyles):**
`TabsBar, SectionTitle, Badge, StyledButton, StyledError, StyledInput, TabButton`

**VideochatStyles vs HomeStyles:**
`StyledCenterVideochat, StyledPane, StyledSplit2, StyledThumbsGrid, StyledPrimaryCta`

**Favoritos vs Perfil:**
`Avatar`

**Blog vs Home vs Perfil:**
`HeroContent, HeroTitle, PageWrap`

**ModelProfileExpandedStyles vs MyAssetsManagerStyles:**
`LightboxFrame`

### HUÉRFANOS eliminados (Fase E limpieza): 16

Definiciones sin ningún consumer, borradas del proyecto:

| Nombre | Archivo | Motivo |
|---|---|---|
| `Container` | `public-styles/RegisterClientModelStyles.js` | Register vive en modal (RegisterClientModalContent) |
| `Badge` | `pages-styles/FavoritesStyles.js` | Vivo en AdminStyles |
| `StyledLinkButton` | `AdminStyles.js` | Vivo en LoginStyles |
| `StyledBrand` | `public-styles/LoginStyles.js` | Vivo en NavbarStyles |
| `StyledBrand` | `public-styles/RegisterClientModelStyles.js` | Vivo en NavbarStyles |
| `StyledCenterVideochat` | `public-styles/HomeStyles.js` | Vivo en VideochatStyles |
| `StyledPane` | `public-styles/HomeStyles.js` | Vivo en VideochatStyles |
| `StyledSplit2` | `public-styles/HomeStyles.js` | Vivo en VideochatStyles |
| `StyledThumbsGrid` | `public-styles/HomeStyles.js` | Vivo en VideochatStyles |
| `StyledPrimaryCta` | `public-styles/HomeStyles.js` | Dead code (huérfano en ambas defs) |
| `StyledPrimaryCta` | `pages-styles/VideochatStyles.js` | Dead code (huérfano en ambas defs) |
| `PageWrap` | `subpages/PerfilClientModelStyle.js` | Vivo en BlogStyles |
| `Title` | `subpages/PerfilClientModelStyle.js` | Vivos en 5 módulos, éste no usado |
| `Form` | `subpages/PerfilClientModelStyle.js` | Vivos en Register/Forgot, éste no usado |
| `ButtonPrimary` | `subpages/PerfilClientModelStyle.js` | Vivos en Forgot/PublicShell, éste no usado |
| `SectionTitle` | `subpages/PerfilClientModelStyle.js` | Vivos en Admin/Estadistica/ModelProfileExpanded |

Además, en Fase C se eliminaron 2 huérfanos previos:
- `StyledContainer` en `AdminStyles.js`.
- `StyledContainer` en `LoginStyles.js`.

Total huérfanos eliminados: 18.

## 4. Baseline para futuras auditorías

Comandos de verificación rápidos (para próximas iteraciones):

```bash
# Contar nombres duplicados en /styles/
grep -rn "^export const " sharemechat-v1/frontend/src/styles/ | \
  grep -E "styled\.|styled\(" | \
  awk -F':' '{print $NF}' | awk '{print $3}' | \
  sort | uniq -c | sort -rn | awk '$1>1'
```

Script `audit-orphans.js` reproducible con node (versión final en la investigación relacionada). Ejecutar tras cualquier PR que añada styled-components para asegurar cero PELIGROSOS y trackear COSMÉTICOS.

## 5. Deuda pendiente (no bloqueante)

Los 41 nombres COSMÉTICOS son duplicación de código copy-paste entre módulos. Consolidarlos requeriría 2-3 sesiones de refactor con riesgo real de romper visual sin beneficio funcional. Se documenta como deuda tolerable. Prioridad: baja.

Si en el futuro se decide abordar:
1. Empezar por los clusters con más duplicación (`Card*` 4 nombres × 2 defs, `Photo*` 4 nombres × 2 defs) porque son los más semánticamente idénticos.
2. Consolidar en un módulo compartido (`styles/common/CardStyles.js`, `styles/common/PhotoStyles.js`).
3. Migrar consumers uno a uno con verificación visual.

## 6. Regla operativa añadida

Antes de tocar un styled-component o crear uno nuevo:
1. `grep -n "^export const NombreStyled" sharemechat-v1/frontend/src/styles/` para verificar unicidad.
2. Si aparece en varios módulos: identificar cuál importa el consumer que vas a tocar antes de editar el fichero.
3. Preferir nombres semánticamente específicos (`DashboardShell`, `PageShell`) sobre genéricos (`Container`, `Wrapper`).

Añadida a `CLAUDE.md` y a memoria de sesión para no reproducir el error de diagnóstico del bug del scroll.
