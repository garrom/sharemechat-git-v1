# ADR-010 — Internal Content CMS with AI-Assisted Workflow (Content Agent v1)

> **NOTA (2026-05-08)**: el diagrama de estados editorial descrito en este ADR
> queda superseded por [ADR-016](adr-016-content-workflow-simplification-and-retraction.md).
> El workflow vigente es `DRAFT → IN_REVIEW → PUBLISHED → RETRACTED`. El resto de
> decisiones de este ADR (CMS interno integrado en backoffice, asistencia IA con
> `MANUAL_STRUCTURED`, almacenamiento de versiones inmutables en S3, eventos de
> auditoría, segregación documentada — aunque desactivada por ADR-016 D2 al
> operar 1-persona) sigue vigente.

## Estado 
Aprobada (parcialmente superseded por ADR-016 en lo relativo al workflow editorial).

Implementación viva en TEST: Fases 1 (esqueleto editorial), 2 (workflow editorial + versionado + eventos), 3A (runs IA discretos manual structured), 3B (`FULL_ARTICLE_ORCHESTRATED` como flujo principal, pipeline delegado en seis skills personales versionadas en [`docs/cms/skills/`](../cms/skills/) — ver [ADR-014](adr-014-full-article-orchestrated-pipeline.md), supersede de [ADR-013](adr-013-full-article-run-phase3b.md)) y 4A (publicación pública dinámica vía API JSON consumida por el SPA público + preview privada admin + bloqueo terminal sin bypass ADMIN) completadas. Próximo frente: ya implementado como Frente 3 — workflow simplificado y retracción operativa, ver ADR-016. Frentes diferidos sin fecha: publicación estática a S3+CloudFront, heroImageUrl/og:image, SCHEDULED operativo. Cada uno abrirá su propio ADR cuando exista justificación . Las decisiones estructurales del cuerpo de esta ADR siguen vigentes; los matices operativos por fase se documentan en [test.md](../03-environments/test.md) y [current-phase.md](../07-roadmap/current-phase.md).

## Contexto

SharemeChat necesita un sistema para generación y gestión de contenido (blog/SEO) con los siguientes objetivos:

- Captación orgánica (SEO)
- Generación de confianza (PSP, usuarios, modelos)
- Reutilización de contenido en producto, FAQs y comunicación
- Escalabilidad sin depender de generación manual completa

Restricciones clave del sistema actual:

- Backend único en Spring Boot (Controller → Service → Repository → Entity)
- Dos superficies React: product y backoffice (admin)
- Persistencia principal en MySQL (RDS/Aurora)
- Redis reservado para estado efímero (no contenido)
- Backoffice ya actúa como capa operativa interna con permisos granulares
- Infraestructura AWS con CloudFront, S3, EC2 y RDS
- Filosofía de desarrollo: evitar sistemas paralelos, integrar en arquitectura existente

Además:

- No se desea introducir costes automáticos por uso de APIs externas en esta fase
- Se quiere evitar automatización completa sin control humano
- Se requiere trazabilidad completa (auditoría editorial y generación IA)

## Decision

Se decide implementar un **CMS interno integrado en backoffice**, con un **flujo editorial asistido por IA (Content Agent v1)**, bajo las siguientes reglas:

### 1. Integración en sistema existente

El CMS:

- Se implementa dentro del backend Spring Boot existente
- Se expone a través de la superficie de backoffice (admin React)
- Utiliza la misma base de datos MySQL del entorno (TEST, AUDIT, PRO)
- No se crea como servicio externo independiente

### 2. Persistencia

Se añaden nuevas tablas en MySQL con prefijo `content_*`, incluyendo:

- content_articles
- content_article_versions
- content_categories
- content_keywords
- content_generation_runs
- content_review_events
- content_publication_events

MySQL es la fuente de verdad editorial.

S3 se utilizará únicamente para assets (imágenes, OG images, etc.).

Redis no se utilizará para contenido.

### 3. Workflow editorial

Estados principales del contenido:

Nota (post-ADR-016): el diagrama original de seis estados que sigue se conserva como referencia histórica. El workflow vigente es DRAFT → IN_REVIEW → PUBLISHED → RETRACTED, definido en ADR-016. Las menciones más adelante en este ADR a IDEA, OUTLINE_READY, DRAFT_GENERATED y APPROVED deben leerse como contexto histórico.

```text
IDEA → OUTLINE_READY → DRAFT_GENERATED → IN_REVIEW → APPROVED → PUBLISHED