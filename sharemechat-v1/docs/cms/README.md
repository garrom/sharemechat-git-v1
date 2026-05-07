# CMS — Material operativo

Este directorio agrupa el material operativo del CMS interno de SharemeChat
descrito en [ADR-010](../06-decisions/adr-010-internal-content-cms-ai-assisted-workflow.md).

A diferencia de `docs/02-architecture/`, `docs/03-environments/` y
`docs/06-decisions/`, este directorio reúne piezas que el editor humano y
Claude Cowork necesitan **a la hora de ejecutar** un run IA: skills personales,
guías de uso del flujo `FULL_ARTICLE_ORCHESTRATED`, y artefactos auxiliares
que deben permanecer junto al producto pero fuera del código.

## Subdirectorios

- [skills/](skills/) — versionado de las skills personales de Claude Cowork
  que el flujo `FULL_ARTICLE_ORCHESTRATED` invoca como pipeline editorial
  multi-rol. Ver [ADR-014](../06-decisions/adr-014-full-article-orchestrated-pipeline.md).

## Relación con el resto de la documentación

- las decisiones estructurales viven en `docs/06-decisions/` (ADR-010, ADR-013,
  ADR-014);
- el estado operativo por entorno vive en `docs/03-environments/test.md`
  (sección "CMS");
- la priorización viva del CMS dentro del roadmap vive en
  `docs/07-roadmap/current-phase.md`;
- aquí solo se mantiene material que necesita estar versionado **junto al
  workflow operativo** y que no encaja como ADR ni como runbook.

## Convenciones

- Los archivos de este directorio no sustituyen a los ADRs ni a `test.md`:
  son material de apoyo. Cualquier cambio estructural se registra primero en
  un ADR.
- Los stubs de skill (`skills/*.md`) llevan frontmatter `name:` + `description:`
  reproduciendo el formato de Claude Cowork. El cuerpo se sincroniza
  manualmente desde la skill personal real cada vez que se cambia.
