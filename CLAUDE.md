# CLAUDE.md — Sharemechat

Eres el asistente de desarrollo principal de Sharemechat (Shareme Technologies OÜ).
**Responde siempre en español.**

---

## Fuente de verdad

Toda la documentación durable del proyecto vive en `sharemechat-v1/docs/`.
No duplicar contenido fuera de ahí. Ver [docs/README.md](sharemechat-v1/docs/README.md) para el gobierno documental.

## Despliegue (CRÍTICO)

**Regla de oro**: no se despliega saltándose el check de drift. El check existe por el incidente del 2026-06-08 (frontend con `productAccessMode` sobre backend 9 días anterior → MODEL y CLIENT viendo solo header+footer). Procedimiento completo en [`docs/04-operations/runbooks.md`](sharemechat-v1/docs/04-operations/runbooks.md) sección *"Runbook de despliegue"*.

Cómo despliega la IA (sesión no interactiva):

```
ops/scripts/deploy-frontend.ps1 -Environment <env> [-Surface <product|admin|both>] -AssumeYesNonCritical
```

`-Surface` es opcional; sin él, el default es `both` y se despliegan ambas superficies (admin → product) con manifests independientes. Pasar `product` o `admin` explícito solo despliega esa surface. El default `both` previene el olvido recurrente de actualizar el bundle admin tras tocar `AdminModelsPanel.jsx` y similares (incidente del paso 2-bis del frente Didit modelo, 2026-06-19, 15 días de drift).

`-AssumeYesNonCritical` deja correr el check y auto-confirma `WARN`/`ALERT`. En `CRITICAL` el script ABORTA SIEMPRE; **la IA NO debe usar `-SkipDriftCheck` para sortear el prompt**, debe PARAR y avisar al operador. Tras un deploy de backend manual (`scp` + `systemctl restart`), ejecutar `ops/scripts/update-manifest-backend.ps1 -Environment <env>` **inmediatamente** (limitación conocida: asume HEAD = commit del JAR; el script tiene `-DryRun` para inspeccionar el diff antes de aplicar).

## Context generation (flujo INACTIVO desde 2026-05-27)

El overview de contexto reutilizable y su guía de generación están **archivados**
en `docs/_archive/context-overview-inactive/`. El caso de uso (arranque de chats
nuevos, pitch a inversores, onboarding de terceros) ya no se da; el contexto del
proyecto se recupera directamente desde la documentación viva (`docs/01-business/`
a `docs/07-roadmap/`, `docs/project-log.md`, ADRs y snapshots).

Si vuelve la necesidad, ver el README de esa carpeta de archivo para reactivar
(mover de vuelta + restaurar esta sección + regenerar el overview desde cero, sin
tomar el contenido archivado como vigente).

## Arranque: qué leer según la tarea

No hay lectura obligatoria global. Carga el contexto mínimo según el frente:

| Si tocas… | Lee primero |
|---|---|
| Negocio, roles, compliance | `docs/01-business/` |
| Arquitectura, backend, frontend, realtime, datos | `docs/02-architecture/` |
| Un entorno concreto (test/audit/prod) | `docs/03-environments/` |
| Correr tests en local / Docker / Testcontainers | `docs/03-environments/test.md` → §*Docker Desktop y Testcontainers en local* (qué corre sin Docker; por qué Testcontainers NO va en local → CI es el juez) |
| Despliegue, runbooks, incidentes, riesgos | `docs/04-operations/` |
| Backoffice y permisos | `docs/05-backoffice/` |
| Decisiones pasadas | `docs/06-decisions/` |
| Prioridades, estado y fase | `docs/07-roadmap/backlog-priorizado.md` (**única fuente de estado**; `current-phase.md`/`pending-hardening.md`/`go-live-roadmap.md` quedaron **archivados** el 2026-08-29 → narrativa histórica en `docs/_archive/07-roadmap/`) |

Los antiguos apéndices de raíz `shareme-context.md` y `shareme-aws-context.md` están **archivados** en `docs/_archive/context-overview-inactive/`. Para identificar un recurso concreto de PROD, usar el `state-mapping` local (`~/.sharemechat/state-mapping.yaml`), que es la fuente viva; los snapshots de `docs/_archive/_snapshots/` son históricos (el inventariado periódico está inactivo).

---

## Dónde se documenta cada cosa (ESCRITURA)

`docs/` está **congelado para notas de un momento**: NO se crean docs nuevos de snapshot, investigación, as-built ni diagnóstico. El trabajo terminado se cierra en su estructura viva (backlog + bitácora). Cuando se pida "documenta esto", el destino es **inequívoco**:

| Qué registrar | Sitio ÚNICO |
|---|---|
| Decisión (elegir A sobre B, patrón, integración, estrategia) | ADR nuevo en `docs/06-decisions/` |
| Cambio de arquitectura/técnico ya decidido | doc vivo en `docs/02-architecture/` (el porqué va en el ADR) |
| Cambio funcional / de negocio (roles, onboarding, compliance) | `docs/01-business/` (+ `docs/05-backoffice/`) |
| Cambio de comportamiento de un entorno | `docs/03-environments/` |
| Un **DATO** del sistema (precio, %, flag, modo, umbral) | NO en prosa → fuente única `docs/_data/*.yaml` + generado (Motor 1, ADR-061) |
| Idea / mejora futura / nueva prioridad / estado de fase | `docs/07-roadmap/backlog-priorizado.md` (única fuente de estado; verificar contra CÓDIGO) |
| Deuda técnica (refactor, atajo) | `docs/04-operations/known-debt.md` |
| Riesgo conocido (algo que puede fallar) | `docs/04-operations/known-risks.md` |
| Incidencia / problema operativo (sobre todo PROD) | `docs/04-operations/incidencias-prod/` |
| Cómo operar algo (procedimiento repetible) | `docs/04-operations/runbooks/` |
| Hito / paquete cerrado / aprendizaje duradero | `docs/project-log.md` (bitácora — el porqué, no el qué) |
| Contexto para Claude en futuras sesiones (preferencia, gotcha) | memoria de Claude (no docs) |
| Skill nueva/modificada | Las skills viven como plugin de Cowork, **fuera de este repo** (la skill ES la fuente; `docs/` NO lleva copia viva). Copias de referencia archivadas de las editoriales/sociales en `docs/_archive/{cms,social}/skills/`. |

Detalle y política de la bitácora en `docs/documentation-governance.md`. Ante duda de si un hito merece bitácora, preguntar al operador.

---

## Rutas clave del código

| Componente | Ruta |
|---|---|
| Backend Java | `sharemechat-v1/src/main/java/com/sharemechat/` |
| Config properties | `sharemechat-v1/src/main/resources/` |
| Frontend React | `sharemechat-v1/frontend/src/` |
| Ops y scripts | `sharemechat-v1/ops/` |

---

## Reglas esenciales

- No analizar: `node_modules/`, `target/`, `.idea/`, `frontend/build/`, `frontend/.cache/`
- Backend: patrón Controller → Service → Repository → Entity
- Frontend: respetar Dual Surface Pattern (product vs admin builds)
- Documentación nueva: dentro de `sharemechat-v1/docs/`, archivo más específico posible, sin duplicar
- Nunca incluir credenciales, IPs internas, ARNs ni secrets en el repo
- Antes de añadir dependencias: verificar OWASP Dependency-Check
- **Ramas, commits, merges, push y deploy (trabajo multi-sesión):** seguir [`GIT-WORKFLOW.md`](GIT-WORKFLOW.md) en la raíz. Modelo: 1 sesión = 1 worktree = 1 rama `claude/<frente>-<slug>`; push inmediato; integrar a `main` y desplegar solo bajo instrucción explícita del operador y serializado. Los **worktrees están permitidos** (bajo `.claude/worktrees/`, nombre = rama); la antigua prohibición era pre-multi-sesión y queda retirada — ver el motivo en `GIT-WORKFLOW.md` §2.

---

## Accesos operativos

Cualquier comando contra infraestructura (AWS CLI, SSH a EC2, túnel RDS, `mysqlsh`) requiere prerrequisitos documentados en [docs/04-operations/access-and-tooling.md](sharemechat-v1/docs/04-operations/access-and-tooling.md). Antes de asumir que no tienes acceso, verifica ese documento y ejecuta el smoke test que contiene.

---

## Objetivo

**Lanzamiento a producción: sin fecha fija.** Se lanza cuando haya suficiente masa de modelos y clientes registrados (el cuello de botella declarado es la captación de modelos). El estado, la fase y las prioridades vivas están en [`docs/07-roadmap/backlog-priorizado.md`](sharemechat-v1/docs/07-roadmap/backlog-priorizado.md), única fuente de estado (verificado contra código).

---

## Convenciones de código y operación

**ONE JAR**. Un único artefacto sirve TEST/AUDIT/PROD; la diferenciación vive en `application-{test,audit,prod}.properties` activadas por `SPRING_PROFILES_ACTIVE`, variables de entorno y flags BD (p. ej. `PRODUCT_ACCESS_MODE`). El binario es idéntico, no el comportamiento: cada entorno puede operar en modo distinto en runtime (p. ej. PROD en `PRELAUNCH` mientras TEST/AUDIT en `OPEN`). No introducir perfiles Maven que produzcan JARs distintos por entorno.

**Higiene de credenciales**. Secrets y passwords nunca por argv ni a disco persistente; si un comando los necesita, vía stdin/heredoc. Tampoco en chat, logs ni historial de shell.

**Estilo de commits**. Sin `Co-Authored-By:`; autoría única del operador. Resto de convenciones en `documentation-governance.md`.

**Vendor-agnostic en el dominio**. El nombre del vendor aparece solo en adapters de cliente HTTP, DTOs de respuesta del vendor y `@ConfigurationProperties` (`kyc.didit.*`, `psp.segpay.*`, etc.). Entidades, tablas, columnas, repositorios, servicios orquestadores y endpoints públicos quedan vendor-agnostic. Los webhook handlers con shape específico por vendor (p. ej. `processVeriffWebhook` / `processDiditWebhook`) son compromiso aceptable, pero el endpoint público que los expone es genérico por dominio (no por vendor).
