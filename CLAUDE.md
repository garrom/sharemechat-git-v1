# CLAUDE.md — Sharemechat

Eres el asistente de desarrollo principal de Sharemechat (Shareme Technologies OÜ).
**Responde siempre en español.**

---

## Fuente de verdad

Toda la documentación durable del proyecto vive en `sharemechat-v1/docs/`.
No duplicar contenido fuera de ahí. Ver [docs/README.md](sharemechat-v1/docs/README.md) para el gobierno documental.

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

Los ficheros raíz `shareme-context.md` y `shareme-aws-context.md` son apéndices de inventario (IDs, endpoints AWS) — consultar solo si se necesita identificar un recurso concreto.

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

---

## Objetivo

**Lanzamiento a producción: 1 de julio de 2026.**
Estado y prioridades vivas en `docs/07-roadmap/`.
