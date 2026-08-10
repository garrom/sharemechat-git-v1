# GIT-WORKFLOW.md — Política de ramas, commits, merges, push y deploy

> **Ámbito.** Repo Sharemechat, operado en **múltiples sesiones simultáneas** (varias
> sesiones de IA + el operador), cada una potencialmente en un worktree distinto.
> Objetivo: que ninguna sesión pise a otra, y que — **solo bajo instrucción explícita
> del operador** — cualquier sesión pueda integrar y desplegar de forma segura.
>
> **Estado:** propuesta v1 (2026-08-10). Las secciones marcadas `⟡ DECISIÓN OPERADOR`
> requieren tu confirmación antes de considerarse vinculantes.
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
3. **El operador es el punto de serialización.** Integrar a `main` y desplegar son acciones
   **privilegiadas**: las autoriza el operador, **una a una**. Nunca dos integraciones/deploys
   en vuelo a la vez.
4. **Autorización explícita y por-instancia.** "Puedes hacer merge/deploy" vale para **esa**
   acción concreta, no es un permiso permanente ni transferible a la siguiente.
5. **Nada destructivo sin verificar.** Antes de borrar/forzar (reset --hard, push --force,
   borrar rama) se mira el objeto y se confirma. El drift-check `CRITICAL` **aborta siempre**;
   está prohibido sortearlo con `-SkipDriftCheck` (ver `CLAUDE.md`).

---

## 2. Modelo de aislamiento: 1 sesión = 1 worktree = 1 rama

- Cada sesión tiene **un worktree** bajo `.claude/worktrees/<slug>/` y **una rama** `claude/<slug>`.
- El **nombre del worktree y el de la rama coinciden**. (Hoy hay cruces: p.ej. worktree
  `…origin-attribution` con rama `…dashboard-favoritos-scroll` → a corregir, §8.)
- El directorio **top-level** del repo (`sharemechat-git-v1/`) debe quedar en `main` en reposo,
  no en una feature branch. Si una sesión necesita el top-level, primero comprueba en qué rama está.

`⟡ DECISIÓN OPERADOR (worktrees):` `CLAUDE.md` dice hoy *"NO usar git worktree bajo ningún
concepto"* y *"NO crear .claude/worktrees/"*. La práctica actual (4 worktrees activos) lo
contradice, y los worktrees son **la herramienta correcta** para paralelismo sin pisarse.
**Recomendación:** bendecir worktrees oficialmente y **retirar esa prohibición de `CLAUDE.md`**.
Alternativa (si prefieres prohibirlos de verdad): consolidar a un único checkout y serializar
todas las sesiones sobre él (más simple pero mata el paralelismo real). Hasta que decidas, esta
política asume el modelo de worktrees.

---

## 3. Ramas

**Naming**
- Trabajo de IA: `claude/<slug-descriptivo>` (p.ej. `claude/seed-customer-acquisition`).
- Trabajo del operador / features largas: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`.

**Ciclo de vida**
- **Vida corta.** Una rama nace de `origin/main` actualizado, vive lo que dura su tarea,
  se integra y **se borra** (local y remota). Ramas que acumulan >X días o >N commits por
  detrás de main son deuda (hoy hay varias a 780+ commits → §8).
- **Origen limpio.** Antes de empezar: `git fetch origin && git switch -c claude/<slug> origin/main`.
- **Una rama = una tarea.** No mezclar frentes no relacionados en la misma rama.

---

## 4. Commits

- **Convención de mensaje:** ver `documentation-governance.md`. Resumen operativo:
  - **Sin `Co-Authored-By:`** — autoría única del operador (regla de `CLAUDE.md`).
  - Prefijo tipo-scope cuando aplique (`feat(cms): …`, `fix(chat): …`, `chore(deploy-state): …`).
  - **Regla del mismo commit:** la entrada de bitácora/doc que motiva el cambio va en **el
    mismo commit** que el cambio, no en uno posterior.
- **Higiene de contenido:** nunca credenciales, IPs internas, ARNs ni secrets (ni en el diff ni
  en el mensaje). Secrets a runtime vía stdin/env, jamás a disco versionado.
- **Commits atómicos:** un cambio coherente por commit; preferir varios commits pequeños a uno
  gigante mezclado.
- **Commit en la rama propia** por defecto. Commitear en **otra** rama (checkout ajeno) solo
  bajo instrucción explícita (§6).

---

## 5. Push

- **Siempre a la rama propia:** `git push origin HEAD`. 
- **Nunca** `git push origin HEAD:main` ni fast-forward directo a `main` a mitad de trabajo.
- **Nunca** `--force` sobre una rama compartida/remota sin instrucción explícita y verificación.
- Empujar pronto y a menudo la rama propia = respaldo + visibilidad para las otras sesiones.

**Leer trabajo de otra rama sin fusionar:** `git show origin/<rama>:<ruta>` (solo lectura).
No mergees ramas ajenas a la tuya para "ver" algo.

---

## 6. Integración a `main` (privilegiada)

Merge a `main` **solo** con instrucción explícita del operador para esa integración concreta.
Procedimiento:

1. `git fetch origin` y **rebase/merge de `origin/main`** sobre la rama a integrar (resolver
   conflictos en la rama, no en main).
2. Verificar que compila / tests relevantes pasan (si aplica al cambio).
3. Integrar por **una** de estas vías (según indique el operador):
   - **PR** (preferido si hay revisión): abrir, mergear tras aprobación.
   - **Merge local coordinado**: `git switch main && git merge --no-ff claude/<slug> && git push origin main`.
4. **Borrar la rama** integrada (local + remota) y **retirar su worktree** si ya no se usa.
5. Avisar al operador: "integrado `<slug>` a main (`<sha>`)".

Regla de serialización: **una integración en vuelo a la vez.** Si otra sesión está integrando,
esperar turno (lo arbitra el operador).

---

## 7. Deploy

### 7.1 Modelo por defecto: merge-a-main → deploy-desde-main
El drift-check compara cada surface contra `origin/main`; por eso lo desplegado debe salir de
`main`. Flujo normal:

1. Integrar a `main` (§6).
2. Desplegar con el tooling existente (nunca a mano saltándose el check):
   - Frontend: `ops/scripts/deploy-frontend.ps1 -Environment <env> [-Surface product|admin|both] -AssumeYesNonCritical`
     (default `both`; `CRITICAL` **aborta siempre**; no usar `-SkipDriftCheck`).
   - Backend manual (`scp`+`systemctl restart`): inmediatamente después
     `ops/scripts/update-manifest-backend.ps1 -Environment <env>` (borrando el `.bak` previo,
     N=1 backup).
3. El manifest `ops/deploy-state/<env>.yaml` queda actualizado y commiteado.

### 7.2 Excepción: deploy directo de una rama (hotfix / preview)
Permitido **solo bajo instrucción explícita** y sabiendo que:
- El drift-check reportará divergencia vs `main` (esperado). Documentar en el manifest **qué rama
  y commit** se desplegó y por qué.
- Es **estado transitorio**: hay que integrar esa rama a `main` cuanto antes para que `main`
  vuelva a reflejar producción. Un deploy de rama que no se integra es deuda de despliegue.

### 7.3 Serialización
**Un deploy por entorno en vuelo a la vez.** Dos sesiones desplegando el mismo entorno se pisan
el manifest. Lo arbitra el operador.

---

## 8. Higiene / limpieza pendiente (estado 2026-08-10)

- **Podar ramas zombis:** locales a 780-796 commits por detrás de `origin/main`
  (`amazing-hamilton`, `keen-driscoll`, `nifty-aryabhata`, `pedantic-blackwell`, `wizardly-dewdney`,
  `competent-chandrasekhar`, `affectionate-easley`…). Confirmar que no tienen trabajo sin
  integrar y borrarlas.
- **Resolver cruce dir↔rama** del worktree `…origin-attribution` (tiene checkouteada
  `…dashboard-favoritos-scroll`).
- **Dejar el top-level en `main`** en reposo (hoy en `feat/streaming-layout`).
- **Confirmar qué ramas remotas son "vivas"** (hoy solo 3 `claude/*` + `feat/streaming-layout`
  en origin) y borrar remotas muertas.

---

## 9. Cómo se habilita "cualquier sesión bajo mi instrucción puede merge/commit/deploy de cualquier rama"

Esto **sí** es posible y seguro con este marco, porque las salvaguardas no son "prohibir", son
"serializar + verificar":

- **Commit de cualquier rama:** la sesión hace checkout de esa rama en un worktree y commitea.
  Permitido bajo instrucción.
- **Merge de cualquier rama a main:** §6, bajo instrucción, sincronizando con `origin/main` antes.
- **Deploy de cualquier rama:** §7 — por defecto integrando a main primero; excepción marcada si
  pides deploy directo de rama.
- **Lo único innegociable:** (a) el operador autoriza cada acción privilegiada; (b) una
  integración y un deploy-por-entorno en vuelo a la vez; (c) `CRITICAL` del drift-check aborta;
  (d) nunca secrets a disco ni `--force`/reset sin verificar.

Checklist que una sesión ejecuta antes de una acción privilegiada:
1. `git fetch origin` — ¿estoy sincronizado con `origin/main`?
2. ¿Hay otra integración/deploy en vuelo? (preguntar al operador si dudo).
3. ¿La instrucción del operador cubre **esta** acción concreta?
4. (Deploy) correr drift-check; si `CRITICAL`, **parar y avisar**.
5. Ejecutar, actualizar manifest/bitácora en el mismo commit, avisar resultado con el `<sha>`.

---

## 10. Decisiones pendientes del operador

1. `⟡` **Worktrees**: bendecirlos y retirar la prohibición de `CLAUDE.md` (recomendado), o
   prohibirlos de verdad y consolidar a un checkout único.
2. `⟡` **Ubicación canónica** de este documento: raíz (como ahora) con puntero desde `CLAUDE.md`,
   o moverlo a `docs/04-operations/` (coherente con doc-governance) dejando puntero en raíz.
3. `⟡` **Modelo de deploy**: confirmar "merge-a-main → deploy" como default y deploy-directo-de-rama
   como excepción marcada (recomendado), vs. permitir deploy de rama como vía de primera clase.
4. `⟡` **Vía de integración**: ¿PR con revisión por defecto, o merge local coordinado? (afecta a §6).
