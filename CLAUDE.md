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
ops/scripts/deploy-frontend.ps1 -Environment <env> -Surface <product|admin> -AssumeYesNonCritical
```

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
| Despliegue, runbooks, incidentes, riesgos | `docs/04-operations/` |
| Backoffice y permisos | `docs/05-backoffice/` |
| Decisiones pasadas | `docs/06-decisions/` |
| Prioridades y fase actual | `docs/07-roadmap/current-phase.md` + `pending-hardening.md` |

Los antiguos apéndices de raíz `shareme-context.md` (stub puntero) y `shareme-aws-context.md` (inventario de IDs AWS) están **archivados** en `docs/_archive/context-overview-inactive/` desde 2026-05-27. Para identificar un recurso concreto de PROD, usar el snapshot más reciente en `docs/_snapshots/` y el `state-mapping` local (`~/.sharemechat/state-mapping.yaml`), que son la fuente viva y actualizada; `shareme-aws-context.md` quedó obsoleto (pre-frente PRO).

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
- NO usar `git worktree` bajo ningún concepto
- NO crear carpetas auxiliares tipo `.claude/worktrees/`

---

## Accesos operativos

Cualquier comando contra infraestructura (AWS CLI, SSH a EC2, túnel RDS, `mysqlsh`) requiere prerrequisitos documentados en [docs/04-operations/access-and-tooling.md](sharemechat-v1/docs/04-operations/access-and-tooling.md). Antes de asumir que no tienes acceso, verifica ese documento y ejecuta el smoke test que contiene.

---

## Objetivo

**Lanzamiento a producción: 1 de julio de 2026.**
Estado y prioridades vivas en `docs/07-roadmap/`.
