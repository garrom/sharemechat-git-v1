# GIT-WORKFLOW.md — Política de ramas, commits, merges, push y deploy

> **Ámbito.** Repo Sharemechat, operado en **múltiples sesiones simultáneas** (varias
> sesiones de IA + el operador), cada una en su propio worktree.
> Objetivo: que ninguna sesión pise a otra, y que — **solo bajo instrucción explícita
> del operador** — cualquier sesión pueda integrar y desplegar de forma segura.
>
> **Estado:** v1.1 (2026-08-11). Decisiones de §10 **resueltas** por el operador y revisadas
> por las sesiones activas. Vinculante una vez integrada a `main`.
>
> Complementa, no sustituye: [`CLAUDE.md`](CLAUDE.md) (reglas esenciales + deploy),
> `sharemechat-v1/docs/documentation-governance.md` (convenciones de commit y bitácora),
> `sharemechat-v1/docs/04-operations/runbooks.md` (runbook de despliegue).

---

## 1. Principios (reglas de oro)

1. **Aislamiento por defecto.** Cada sesión trabaja en **su propia rama**, en **su propio
   worktree**. Nunca se trabaja directamente sobre `main`.
2. **`main` es la única fuente de verdad de despliegue.** Lo que se despliega sale de `main`
   salvo excepción explícita y marcada (§7.2). El drift-check está construido sobre esta premisa.
3. **El operador autoriza la DECISIÓN; git serializa la ejecución.** Integrar a `main` y
   desplegar son acciones **privilegiadas**: el operador autoriza *que se haga*. Pero la
   serialización técnica **la hace git, no el operador**: dos push a `main` a la vez → el
   segundo es rechazado (`non-fast-forward`) y se re-sincroniza. **Ninguna sesión debe
   preguntar al operador "¿hay otra sesión integrando?"** — eso lo resuelve el rechazo de push
   (§6), no una coordinación humana.
4. **Autorización explícita y por-instancia.** "Puedes hacer merge/deploy" vale para **esa**
   acción concreta, no es permiso permanente ni transferible a la siguiente.
5. **Nada destructivo sin verificar.** Antes de borrar/forzar (reset --hard, push --force,
   borrar rama, `worktree remove`, borrar untracked) se mira el objeto y se confirma. El
   drift-check `CRITICAL` **aborta siempre**; prohibido sortearlo con `-SkipDriftCheck` (`CLAUDE.md`).

---

## 2. Modelo de aislamiento: 1 sesión = 1 worktree = 1 rama

- Cada sesión tiene **un worktree** bajo `.claude/worktrees/<nombre>/` y **una rama**.
- **El nombre del worktree y el de la rama COINCIDEN** (el worktree se llama como la rama sin
  el prefijo `claude/`). Los cruces dir↔rama están prohibidos: son la causa raíz del desmadre.
- El directorio **top-level** del repo (`sharemechat-git-v1/`) queda en `main` **en reposo**.
  Si una sesión lo usa como worktree de una feature, es estado transitorio: al terminar
  (merge+deploy) vuelve a `main`.

**Worktrees: permitidos y recomendados.** Este es el mecanismo oficial de paralelismo
multi-sesión. *Nota histórica:* `CLAUDE.md` prohibía worktrees; esa regla era **pre-multi-sesión**
(un solo checkout, un solo agente) y queda **retirada** por esta política. El motivo se documenta
aquí para que no se "restaure" el veto por inercia: **con varias sesiones IA en paralelo, un
worktree por sesión es lo que evita que se pisen; sin ellos habría que serializar todo el trabajo
sobre un único checkout.**

---

## 3. Ramas

**Naming (patrón determinista → nombre predecible desde el tema)**
- Trabajo de IA: **`claude/<frente>-<slug>`**. `<frente>` sale de un vocabulario corto y fijo:
  `seo`, `blog`, `cms`, `chat`, `kyc`, `payments`, `deploy`, `infra`, `docs`, `moderation`…
  Así, sabiendo el tema, el nombre de la rama (y del worktree) es **adivinable sin preguntar**.
- Trabajo del operador / features largas multi-frente: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`.

**Migración de ramas ya existentes (no romper lo vivo)**
- Las ramas creadas **antes** de este patrón (p.ej. `feat/streaming-layout`) **terminan su vida
  tal cual**; §3 permite `feat/*` para trabajo de operador o features largas. **No** se renombran
  en caliente.
- El patrón `claude/<frente>-<slug>` aplica a **todo frente nuevo** a partir de ahora.

**Ciclo de vida**
- **Vida corta.** Nace de `origin/main` actualizado, vive lo que dura su tarea, se integra y
  **se borra** (local + remota). Ramas muy por detrás de main y sin commits únicos son deuda (§8).
- **Origen limpio:** `git fetch origin && git switch -c claude/<frente>-<slug> origin/main`.
- **Una rama = una tarea.** No mezclar frentes no relacionados en la misma rama (riesgo real:
  una rama `feat/*` que acumula 4-5 frentes complica el merge y el "vida corta").

---

## 4. Commits

- **Convención de mensaje** (ver `documentation-governance.md`):
  - **Sin `Co-Authored-By:`** — autoría única del operador (`CLAUDE.md`).
  - Prefijo tipo-scope cuando aplique (`feat(cms): …`, `fix(chat): …`, `chore(deploy-state): …`).
  - **Regla del mismo commit:** la entrada de bitácora/doc que motiva el cambio va en **el mismo
    commit** que el cambio, no en uno posterior.
- **Higiene:** nunca credenciales, IPs internas, ARNs ni secrets (ni en diff ni en mensaje).
  Secrets a runtime vía stdin/env, jamás a disco versionado.
- **Atómicos:** un cambio coherente por commit; mejor varios pequeños que uno gigante mezclado.
- **En la rama propia** por defecto. Commitear en **otra** rama (checkout ajeno) solo bajo
  instrucción explícita (§6/§9).

---

## 5. Push

- **Siempre a la rama propia:** `git push origin HEAD` (o `git push -u origin HEAD` la primera
  vez, para dejar el upstream configurado y evitar el aviso "no upstream").
- **Push inmediato = publicar tu existencia.** Empujar la rama nada más crearla y tras cada
  commit. **Regla dura: una rama que no está en `origin` no existe para las demás sesiones.**
- **Nunca** `git push origin HEAD:main` ni fast-forward directo a `main` a mitad de trabajo.
- **Nunca** `--force` sobre rama compartida/remota sin instrucción explícita y verificación.

**El registro de "quién está en qué" ES git** (no un fichero, que en ramas aisladas daría
conflictos): con todas las ramas vivas en `origin` y nombre-por-frente,
`git fetch origin && git branch -r -v` muestra el **mapa completo** — cada rama + su último
commit = qué hace cada sesión. **Leer trabajo ajeno sin fusionar:** `git show origin/<rama>:<ruta>`.

---

## 6. Integración a `main` (privilegiada)

Merge a `main` **solo** con instrucción explícita del operador para esa integración concreta.
**Vía elegida: merge local coordinado** (sin PR obligatorio):

1. `git fetch origin` y **rebase/merge de `origin/main`** sobre la rama a integrar (conflictos se
   resuelven en la rama, no en main).
2. Verificar que compila / tests relevantes pasan (si aplica al cambio).
3. `git switch main && git merge --no-ff <rama> && git push origin main`.
4. **Borrar la rama** integrada (local + remota) y **retirar su worktree** si ya no se usa.
5. Avisar al operador: "integrado `<rama>` a main (`<sha>`)".

*(PR de GitHub queda como opción puntual cuando quieras revisión inline o circular un borrador
entre sesiones, no como vía por defecto.)*

**Serialización = git, no el operador.** No hay que preguntar "¿hay otra integración en vuelo?".
El paso 1 (`fetch` + `merge origin/main`) + el paso 3 lo resuelven solos:

- Si otra sesión pusheó a `main` primero, tu `git push origin main` es **rechazado**
  (`non-fast-forward`). No hay pisón silencioso.
- Ante el rechazo: `git fetch origin`, `git merge origin/main` en tu rama (integra lo de la otra),
  re-verifica y **vuelve a pushear**. Reintento mecánico, no decisión humana.
- **Prohibido** resolver un rechazo con `--force` (borraría el trabajo de la otra sesión).

Es decir: el operador autoriza *que integres*; **quién va primero lo decide el rechazo de push**.

---

## 7. Deploy

### 7.1 Modelo por defecto: merge-a-main → deploy-desde-main
El drift-check compara cada surface contra `origin/main`; por eso lo desplegado debe salir de
`main` (desplegar fuera de main deja a `main` sin reflejar producción = el incidente de drift del
2026-06-08). Flujo normal:

1. Integrar a `main` (§6).
2. Desplegar con el tooling (nunca a mano saltándose el check):
   - Frontend: `ops/scripts/deploy-frontend.ps1 -Environment <env> [-Surface product|admin|both] -AssumeYesNonCritical`
     (default `both`; `CRITICAL` **aborta siempre**; no usar `-SkipDriftCheck`).
   - Backend manual (`scp`+`systemctl restart`): inmediatamente después
     `ops/scripts/update-manifest-backend.ps1 -Environment <env>` (borrando el `.bak` previo, N=1).
3. El manifest `ops/deploy-state/<env>.yaml` queda actualizado y commiteado.

### 7.2 Excepción: deploy directo de una rama (hotfix / preview)
Permitido **solo bajo instrucción explícita** sabiendo que:
- El drift-check reportará divergencia vs `main` (`ALERT` esperado). Documentar en el manifest
  **qué rama y commit** se desplegó y por qué.
- Es **estado transitorio**: integrar esa rama a `main` cuanto antes. Un deploy de rama que no se
  integra es deuda de despliegue. (Caso vivo hoy: deploys a TEST desde `feat/streaming-layout`.)

### 7.3 Serialización
**Un deploy por entorno en vuelo a la vez.** Dos sesiones desplegando el mismo entorno se pisan
el manifest. Lo arbitra el operador.

---

## 8. Higiene / limpieza

**Hecho (2026-08-11):** borradas 8 ramas zombis local-only, fully-merged, 0 commits únicos
(`amazing-hamilton`, `keen-driscoll`, `nifty-aryabhata`, `pedantic-blackwell`, `wizardly-dewdney`,
`competent-chandrasekhar`, `affectionate-easley`, `feat/gift-emojis-chat-redesign`).

**Pendiente, coordinado (NO en caliente):**
- **Top-level en `feat/streaming-layout`**: vivo, pendiente de merge a main + deploy PROD. Se deja
  en `main` **después** de ese merge+deploy, no antes.
- **Cruce dir↔rama** en worktree `…origin-attribution-0c86b5` (tiene checkouteada
  `…dashboard-favoritos-scroll-issue-490e84`). Verificado: la rama es **puntero stale** (0 commits
  únicos, ya contenida en main y en `feat/streaming-layout`) y los untracked `gifts/`/`gift-*`
  tienen sus paths **ya commiteados** en `feat/streaming-layout` (restos). Fix, **tras** merge+PROD
  de streaming-layout y con la sesión de ese worktree idle:
  1. `diff` de los untracked vs `feat/streaming-layout` para certificar que no hay contenido único.
  2. `git switch claude/sharemechat-origin-attribution-0c86b5` en ese worktree (deshace el cruce),
     o `git worktree remove` si ya no se usa. **Ojo: es el cwd de una sesión** → hacerlo desde otra
     sesión o con esa idle, nunca en caliente.
  3. Borrar la rama stale `claude/dashboard-favoritos-scroll-issue-490e84` tras confirmar.

---

## 9. Cómo se habilita "cualquier sesión, bajo mi instrucción, puede merge/commit/deploy de cualquier rama"

Posible y seguro con este marco, porque las salvaguardas no son "prohibir" sino "serializar + verificar":

- **Commit de cualquier rama:** checkout de esa rama en un worktree y commit. Bajo instrucción.
- **Merge de cualquier rama a main:** §6, bajo instrucción, sincronizando con `origin/main` antes.
- **Deploy de cualquier rama:** §7 — por defecto integrando a main primero; excepción marcada
  (§7.2) si pides deploy directo de rama.
- **Innegociable:** (a) el operador autoriza cada acción privilegiada; (b) una integración y un
  deploy-por-entorno en vuelo a la vez; (c) `CRITICAL` del drift-check aborta; (d) nunca secrets a
  disco ni `--force`/reset/borrado sin verificar.

**Checklist antes de una acción privilegiada:**
1. `git fetch origin` + `merge origin/main` — sincronizar con `origin/main` (NO preguntar al
   operador si otra sesión integra; si colisionáis, el push a main será rechazado y se reintenta, §6).
2. ¿La instrucción del operador cubre **esta** acción concreta?
3. (Deploy) correr drift-check; si `CRITICAL`, **parar y avisar**.
4. Ejecutar. Si `git push origin main` es rechazado (non-fast-forward): re-sincronizar y reintentar
   (nunca `--force`).
5. Actualizar manifest/bitácora en el mismo commit, avisar resultado con el `<sha>`.

---

## 10. Decisiones tomadas (operador, 2026-08-11)

1. **Worktrees:** permitidos y oficiales; se retira la prohibición de `CLAUDE.md` (§2), con motivo
   documentado.
2. **Ubicación de este documento:** raíz del repo + puntero desde `CLAUDE.md`.
3. **Modelo de deploy:** merge-a-main → deploy por defecto; deploy directo de rama = excepción
   marcada (§7).
4. **Vía de integración:** merge local coordinado (§6); PR opcional para revisión/circulación.
5. **Patrón de nombres + registro-vía-git:** §3 y §5. Revisado y aceptado por las sesiones activas.
