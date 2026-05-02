# ADR-010 — Internal Content CMS with AI-Assisted Workflow (Content Agent v1)

## Estado 
Aprobada

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

```text
IDEA → OUTLINE_READY → DRAFT_GENERATED → IN_REVIEW → APPROVED → PUBLISHED