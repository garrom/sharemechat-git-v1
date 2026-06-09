# SharemeChat

Repositorio principal de producto, backend y backoffice de SharemeChat.

La documentación interna del proyecto vive en [docs/README.md](docs/README.md) y está organizada por dominios funcionales, arquitectura, entornos, operaciones, backoffice, decisiones y roadmap.

Este repositorio mantiene conocimiento durable del sistema. El inventario sensible o demasiado operativo de infraestructura no forma parte de la documentación principal.

## Despliegue

**Regla crítica**: no se despliega saltándose el check de drift. Está ahí por el incidente del 2026-06-08 (frontend con `productAccessMode` sobre backend 9 días anterior → MODEL y CLIENT viendo solo header y footer); su historia vive en [`docs/04-operations/incident-notes.md`](docs/04-operations/incident-notes.md).

El procedimiento completo (frontend con `ops/scripts/deploy-frontend.ps1`, backend manual seguido de `ops/scripts/update-manifest-backend.ps1`, niveles de severidad del check, flags y workflow por contexto humano/IA/reparación) vive en [`docs/04-operations/runbooks.md`](docs/04-operations/runbooks.md), sección *"Runbook de despliegue"*.
