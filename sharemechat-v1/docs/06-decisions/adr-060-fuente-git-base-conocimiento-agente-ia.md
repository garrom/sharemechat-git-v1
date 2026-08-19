# ADR-060: Fuente de verdad en git para la Base de Conocimiento del Agente IA + seeder idempotente anti-drift

## Estado

Propuesta (2026-08-19). Extiende y concreta la "Fase 2" que [ADR-044](adr-044-knowledge-base-externa.md) dejó pendiente (CRUD admin + invalidación automática). No la sustituye: el modelo de datos (`support_bot_prompts`), la caché Caffeine y el endpoint `/reload` de ADR-044 siguen vigentes.

## Contexto

Tras la Fase 1.D de ADR-044, el contenido de la Base de Conocimiento (BdC) del Agente IA de soporte vive **exclusivamente en la tabla MySQL `support_bot_prompts`**. Los 14 ficheros `.md` que la hidrataban se eliminaron del JAR. La única vía soportada de modificar la BdC es **SQL directo contra la tabla de cada entorno + `POST /api/admin/knowledge-base/reload`**.

Auditoría del 2026-08-19 (tabla viva de TEST) que motiva esta decisión:

- 12 de 14 bloques congelados en el seed del 2026-07-07 (~6 semanas sin tocar).
- Cobertura nula de features que ya están en PROD: **Master** (0/14), **Google Sign-In** (0/14), **likes/insignias de perfil** (0/14), **landing /modelos** (0/14). **Cripto** ausente justo en los bloques de pago (`pagos-y-saldo`, `payout-y-tiers`).

El problema no es un texto suelto: el contexto quedó fijado en julio y la aplicación se movió por debajo, **y como la fuente vive solo en la BD (fuera de git, edición SQL manual) nadie ve el desfase**. Tres fricciones estructurales:

1. **Sin fuente versionada ni revisión.** No hay PR, ni diff, ni historia; el conocimiento del bot no se revisa como el resto del código.
2. **Drift latente entre TEST/AUDIT/PROD.** Cada `UPDATE` manual se aplica por entorno a mano; nada garantiza que los tres tengan el mismo texto ni lo detecta.
3. **Sin trazabilidad.** No hay forma de responder "¿qué texto exacto vio el usuario que reportó X el día Y?".

ADR-044 ya había huido de los `.md` en el JAR por una razón válida: **iterar el contenido no debe exigir rebuild + redeploy de un JAR de ~150 MB**. Cualquier solución debe preservar esa iteración rápida.

## Problema

Que la BdC pueda: (a) vivir en git (versionada, revisable por PR, con historia); (b) ser **idéntica en los 3 entornos por construcción**, no por disciplina manual; (c) cambiarse **sin recompilar/redesplegar el JAR**; (d) sin coste añadido en el hot-path del bot (la lectura por request debe seguir siendo O(1) en memoria).

## Decisión

Fuente de verdad en git **fuera del classpath del JAR**, empujada a la tabla de cada entorno por un endpoint admin de UPSERT idempotente y un script de sincronización. En una sola frase: los `.md` vuelven a git pero **no al JAR**; un script los sincroniza a la BD sin redeploy.

### Fuente de verdad

`sharemechat-v1/support-kb/<case_key>.md`, un fichero por bloque, con front-matter:

```yaml
---
case_key: pagos-y-saldo
role: CLIENT            # CLIENT | MODEL | BOTH (declarativo; sustituye a ROLE_OVERRIDES y a la derivación por sufijo)
active: true
description: Pagos, packs, saldo, reembolsos
# keywords: [...]       # reservado para B.2 (unificación del router); ignorado en fase 1
---
(contenido markdown del prompt)
```

El front-matter declara el rol explícitamente y elimina la frágil derivación por prefijo numérico (`deriveCaseKey`). Los ficheros **no viven bajo `resources/`**: no inflan el JAR ni se acoplan al ciclo de deploy del backend.

### Backend (aditivo sobre ADR-044)

- `POST /api/admin/knowledge-base/sync` — recibe el payload parseado (lista de `{caseKey, role, content, active, description}`) y hace **UPSERT**:
  - `INSERT` los nuevos; `UPDATE` los que cambiaron de `content` (incrementa `version`, refresca `updated_at`); deja intactos los iguales.
  - `case_key` presente en tabla pero ausente del payload → `active = false` (**soft-delete**; nunca borra filas).
  - Devuelve un **diff** (created / updated / unchanged / deactivated + hash SHA-256 por case_key). **No devuelve `content`** (higiene ADR-044 intacta).
  - Al terminar, `KnowledgeBaseService.reload()`.
- `GET /api/admin/knowledge-base/state` — devuelve por case_key: `version`, `active`, `updatedAt` y **hash SHA-256 del content** (hash, no content). Es lo que el script compara contra git.
- Autorización: heredada de `/api/admin/**` → `ROLE_ADMIN`. Sin matcher nuevo en SecurityConfig.

### Script de operación

`ops/scripts/sync-support-kb.ps1 -Environment <env> [-DryRun]` — equivalente de `deploy-frontend.ps1` para el contexto:

- Lee los `.md` del checkout de main, parsea front-matter, calcula hash por fichero.
- `GET /state` del entorno → **diff** git-vs-tabla.
- `-DryRun` (defecto seguro): imprime el diff, no toca nada. Es el "drift-check" del contexto.
- Run real: `POST /sync` → UPSERT + reload. **Idempotente**: sin cambios en git, 0 updates.
- El mismo git-source aplicado a `test`→`audit`→`prod` deja los tres **idénticos** (anti-drift por construcción).
- Autenticación: login admin (`/api/auth/login`) + JWT en `Authorization: Bearer`. Sin infra nueva.

### Eficiencia

B no toca el hot-path: el bot sigue leyendo de la caché en memoria (`Map.get`, O(1)). El `/sync` corre solo cuando se edita contenido (no por request): payload ~50 KB, UPSERT de ~14-20 filas, un `reload` de la caché. El coste real del subsistema —los tokens del system prompt por mensaje— no lo cambia B; se gobierna por contenido (un bloque por caso vía router, prefijo fijo `comportamiento-agente-ia` + `ui-reference` lean y prompt-cached).

### Alternativas descartadas

1. **Volver a los `.md` en `resources/` + UPSERT en el seed** (B-en-JAR). Da versionado + revisión + anti-drift gratis (ONE JAR = mismo contenido), pero **reintroduce la fricción que ADR-044 rechazó**: cada corrección editorial exige rebuild + redeploy del JAR. Descartada por eso.
2. **CRUD admin en la UI (la "Fase 2" literal de ADR-044).** Resuelve la ergonomía de edición pero **no** la fuente versionada ni el anti-drift: el contenido seguiría naciendo en la BD sin PR. Puede añadirse encima de esta decisión más adelante; no la sustituye.
3. **Filesystem del EC2 + `support.kb.directory`.** El endpoint `seed-from-jar` ya admite leer de un directorio si se configura `support.kb.directory`. Descartada por la misma razón que en ADR-044 (alt. 2): estado por-instancia, `scp` a cada EC2, drift no detectable, rompe la portabilidad del artefacto.

### Fuera de alcance (fase 2, B.2)

Unificación del router: mover las reglas hardcodeadas de `SupportBotRouterService` al mismo git-source vía el campo `keywords` del front-matter, para que añadir un tema sea un fichero + `sync` sin recompilar Java. El front-matter ya reserva el campo; el runtime lo ignora en fase 1.

## Rollout (aditivo, reversible)

- **B.0** — Exportar las 14 filas vivas de TEST a `support-kb/*.md` (baseline fiel; read-only + commit).
- **B.1** — Endpoints `/sync` + `/state` (deploy backend, una vez).
- **B.2** — Script `sync-support-kb.ps1`.
- **B.3** — Desde aquí, todo cambio de BdC = editar `.md` → PR → `sync -Environment <cada>`. Se deprecia el SQL manual.
- **Rollback**: nada se sustituye; `/reload`, `seed-from-jar` y el SQL siguen. El UPSERT nunca hace hard-delete; `-DryRun` va primero.

## Consecuencias

Positivas: BdC versionada y revisable por PR; los 3 entornos idénticos por construcción con detección de drift (`-DryRun`); iteración sin rebuild del JAR; `version`/`updated_at` reflejan cambios reales; base para B.2 (router) y para unificar el FAQ público como subconjunto de `producto-general`.

Negativas / coste: dos endpoints admin y un script nuevos por mantener; la autenticación del script (login admin + JWT) es un patrón nuevo en los ops-scripts; mientras dure la transición coexisten el SQL manual y el sync (mitigado deprecando el primero en B.3).

## Trazabilidad

- Auditoría que motiva la decisión: sesión 2026-08-19 (tabla viva TEST).
- Extiende: [ADR-044](adr-044-knowledge-base-externa.md) (Fase 2 pendiente).
- Deuda relacionada: `docs/04-operations/known-debt.md` (CRUD admin sigue siendo deuda; esta ADR cubre el anti-drift, no la UI de edición).
