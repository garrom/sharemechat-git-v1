# ADR-048 — Página pública de modelo `/m/:slug` como palanca central de producto, SEO y afiliación

> Estado: VIGENTE
> Fecha: 2026-07-09
> Vigencia esperada: indefinida (superficie de producto estable)
> Reemplaza: N/A (documento nuevo)
> Ver también: [ADR-018](adr-018-blog-static-rendering.md), [ADR-019](adr-019-blog-spa-react.md), [ADR-022](adr-022-blog-cms-multilingual-es-en.md), [ADR-033](adr-033-noindex-non-prod-environments.md), [ADR-042](adr-042-prerender-cron-on-backend-ec2.md), [ADR-047](adr-047-pivote-soft-launch-cripto-paxum.md), [`../01-business/model-profile-strategy.md`](../01-business/model-profile-strategy.md), [`../01-business/affiliate-program.md`](../01-business/affiliate-program.md), [`../01-business/launch-strategy.md`](../01-business/launch-strategy.md)

## Estado

Aceptada.

## Contexto

Dos observaciones que motivan el diseño de una superficie pública dedicada a la modelo:

### El blog SEO no convierte con producto en coming-soon

El plan de captación Q3 2026 identificó que **CooMeet, el comparable más cercano al posicionamiento adult dating intimate 1-a-1, captura el 81,18 % de su tráfico orgánico desde una única keyword branded** ("coomeet"), más un 4,88 % + 1,01 % en misspellings, totalizando ~87 % branded. El SEO topical genérico no replica el modelo del comparable.

Un blog corporativo nuevo en sector adult con dominio de baja autoridad y producto no lanzado no tiene forma realista de generar volumen de tráfico calificado en 6-12 meses. El blog es útil como asset defensivo (cuando alguien busca "SharemeChat") y de posicionamiento de marca, pero no como palanca primaria de adquisición.

### La sinergia A+D+E de la estrategia de soft launch apunta al mismo pilar técnico

La [`launch-strategy.md`](../01-business/launch-strategy.md) identifica que tres movimientos operativos (freemium visible, B2B con estudios pequeños, SEO de perfiles de modelo) convergen en el mismo pilar técnico: **una página pública por modelo**. La misma superficie sirve tres propósitos con costes marginales cercanos a cero:

- **Producto visible**: la plataforma deja de ser coming-soon y muestra oferta real.
- **SEO long-tail**: cada perfil es una landing indexable con contenido único.
- **Soporte de afiliación**: la URL del perfil ES el link de afiliación de la modelo, y sirve como material de venta B2B al operador para pitch a estudios.

### Infraestructura técnica ya disponible

La infraestructura CMS bilingüe (ADR-022), el prerender estático a S3+CloudFront (ADR-018 / ADR-019 / ADR-042) y el multi-asset Layer 2 backend están operativos. La superficie de página de modelo no requiere infraestructura nueva salvo la ruta pública y el flujo de aprobación de assets para publicación.

## Opciones consideradas

### Opción 1 — No abrir superficie pública de modelo

Mantener el catálogo de modelos únicamente accesible desde dentro del producto (matching aleatorio y flujo `/messages`), sin páginas públicas indexables.

Pros:
- Cero superficie de producto nueva.
- Cero superficie SEO nueva que mantener.

Contras:
- Renuncia al pilar técnico compartido A+D+E.
- Blog corporativo queda como único vector SEO, con volumen esperado marginal.
- Modelos no tienen material tangible para compartir en sus propias redes.
- Estudios pequeños no tienen material de venta para promocionar a sus modelos.

### Opción 2 — Página pública de modelo `/m/:slug` (opción elegida)

Cada modelo con KYC APPROVED recibe una página pública en `sharemechat.com/m/:slug` (+ variante bilingüe `sharemechat.com/en/m/:slug`) con contenido curado desde el multi-asset Layer 2.

Pros:
- Cubre los tres propósitos A+D+E con el mismo pilar técnico.
- Reutiliza infraestructura CMS + prerender + multi-asset ya operativa.
- La URL del perfil sirve directamente como link de afiliación (ver [`affiliate-program.md`](../01-business/affiliate-program.md)).
- SEO long-tail sobre nombres de modelo, idiomas, disponibilidad — keywords menos saturadas que las genéricas.

Contras:
- Superficie de producto nueva que mantener (flujo de aprobación de assets públicos, invalidación del prerender al cambiar contenido).
- Riesgo si el flujo de aprobación deja pasar contenido no apto para zona pública (SFW obligatorio).
- Depende de que existan modelos con KYC APPROVED que quieran perfil público (opt-in por la modelo, no obligatorio).

### Opción 3 — Un solo directorio agregado `/modelos` sin páginas individuales

Una sola página tipo listado con foto pequeña de cada modelo activa y enlace directo a matching, sin página propia por modelo.

Pros:
- Superficie pequeña.
- No requiere flujo de aprobación de assets por modelo.

Contras:
- Cero SEO long-tail (todas las modelos comparten una única URL).
- Ninguna modelo puede compartir su URL propia en sus redes.
- Estudios no tienen material de venta específico por modelo.
- No cubre el propósito de afiliación ni el B2B.

## Decisión

**Cada modelo con KYC APPROVED puede recibir una página pública `sharemechat.com/m/:slug` con contenido servido desde el multi-asset Layer 2 backend**, con las siguientes características:

- **Bilingüe**: variantes `/m/:slug` (ES por defecto) y `/en/m/:slug` (EN) con `hreflang` correcto y canonical por idioma. Reutiliza CMS bilingüe de [ADR-022](adr-022-blog-cms-multilingual-es-en.md).
- **Contenido curado**: fotos y vídeos KYC-aprobados marcados como públicos por la propia modelo (opt-in por asset). Presentación editorial corta, idiomas hablados, horarios habituales, estado online/offline en tiempo real.
- **CTA dual**:
  - "Iniciar sesión privada" → flujo de pago normal.
  - "Chatear gratis" → freemium interno según [`sistema-tiers-modelos.md`](../01-business/sistema-tiers-modelos.md) § 5.
- **SFW obligatorio en zona pública**: la política de zona pública sin contenido adult-themed de [`business-model.md`](../01-business/business-model.md) sigue aplicando. Solo el material apto SFW pasa a las páginas públicas; el contenido adult vive dentro de la sesión privada 1-a-1.
- **Tracking de afiliación integrado en la URL**: `sharemechat.com/m/:slug?ref=:affiliate_id`, cookie 90 días, atribución al último click con `ref=` antes de la primera compra. Detalle en [`affiliate-program.md`](../01-business/affiliate-program.md) § 6 y [`model-profile-strategy.md`](../01-business/model-profile-strategy.md) § 4.
- **Kit de assets sociales autogenerado**: la modelo autenticada descarga banners, GIFs y plantillas de tweet ES/EN con su URL de perfil precargada desde la propia página. Detalle en [`model-profile-strategy.md`](../01-business/model-profile-strategy.md) § 5.
- **Prerender estático a S3+CloudFront**: la superficie pública se sirve como HTML pre-renderizado igual que el blog. Reutiliza [ADR-018](adr-018-blog-static-rendering.md) / [ADR-019](adr-019-blog-spa-react.md) / [ADR-042](adr-042-prerender-cron-on-backend-ec2.md). Meta tags Open Graph, Twitter Card y JSON-LD `Person` inyectados en el HTML servido (no post-mount, para que los crawlers y previewers no-JS los vean).
- **Noindex en entornos no-PROD**: en TEST y AUDIT las páginas `/m/:slug` sirven con `X-Robots-Tag: noindex` y `<meta name="robots" content="noindex">` según [ADR-033](adr-033-noindex-non-prod-environments.md).

## Justificación

La sinergia A+D+E hace que esta superficie sea el pilar central del pivote de soft launch: **el mismo trabajo técnico resuelve tres problemas de negocio distintos**, con reutilización agresiva de infraestructura ya operativa. Cualquier alternativa (opción 1 o 3) renuncia a esa sinergia y deja el pivote sin palanca de producto visible tangible.

El comparable CooMeet demuestra que en este vertical la marca acumulada domina el orgánico. SharemeChat no puede competir por acumulación de marca en 6 meses. Puede competir por **volumen de landings long-tail nuevas** (una por modelo) que capturen keywords menos saturadas.

## Impacto

### Impacto en arquitectura

- Nueva ruta pública `/m/:slug` y `/en/m/:slug` en el frontend con SSR/prerender.
- Nuevo flujo en el backend: publicación de perfil (opt-in por modelo) + aprobación de assets como públicos.
- Nueva superficie a mantener por el cron de prerender ([ADR-042](adr-042-prerender-cron-on-backend-ec2.md)): invalidación selectiva al aprobar / retirar asset o al cambiar estado online.
- Nuevo esquema de eventos en `content_review_events` conceptualmente análogo al del blog para trazabilidad de aprobación de perfil público (a diseñar en la implementación).

### Impacto en documentación

- `roles-and-flows.md`: nuevo flujo "publicación de perfil público" (se añade en Fase B).
- `system-overview.md` y `frontend-architecture.md`: nueva superficie pública `/m/:slug` (se documenta en Fase B).
- `sistema-tiers-modelos.md`: el CTA "Chatear gratis" desde `/m/:slug` es la puerta de entrada natural al freemium ya documentado allí.

### Impacto en compliance

- Los assets publicados en zona pública deben ser SFW por política ya existente ([`business-model.md`](../01-business/business-model.md)). La flag de "público" por asset se aprueba manualmente en el flujo de moderación humana asíncrona ya existente.
- La declaración 2257 y Records Custodian aplica a todo el contenido de modelo, incluidos los assets publicados en zona pública (aunque sean SFW): la identidad y edad de la persona representada están verificadas por el flujo KYC del propio proceso de onboarding.

### Impacto en riesgo operacional

- Riesgo bajo de contaminación NSFW en zona pública si el flujo de aprobación se salta o falla. Mitigado por moderación humana obligatoria antes de marcar asset como público.
- Riesgo bajo de que perfiles públicos vacíos (modelos con KYC APPROVED pero sin assets aprobados como públicos) generen impresiones sin conversión. Mitigado por gating: la ruta `/m/:slug` solo sirve HTML si la modelo tiene al menos 1 asset público aprobado.

## Consecuencias

- **Positivas**: pilar técnico compartido resuelve producto visible + SEO + afiliación con un solo esfuerzo. Reutiliza infraestructura al 100 %. Cada modelo verificada gana material propio para compartir en sus redes. El operador gana material de venta B2B.
- **Negativas**: el blog SEO se degrada explícitamente a asset defensivo secundario. Nuevo flujo de aprobación de assets como públicos (SFW gating). Nueva superficie prerenderizada a mantener.
- **Trade-off principal**: se cambia "un solo canal SEO (blog)" por "muchas landings SEO (una por modelo) más blog defensivo". Requiere disciplina operativa (onboarding rápido de perfiles públicos) para que la superficie funcione realmente.

## Notas

- La implementación concreta (schema, endpoints, componentes frontend) queda fuera del alcance de este ADR y se cerrará como sub-paquete técnico dentro del Frente 3 del pivote de soft launch, a materializar en Fase B.
- El link de afiliación es la URL del perfil. No hay dos URLs paralelas ("una para SEO, otra para afiliación"). Esto se articula en [`affiliate-program.md`](../01-business/affiliate-program.md).
- **Contexto estratégico completo** del pivote y la sinergia A+D+E en [`../01-business/launch-strategy.md`](../01-business/launch-strategy.md).
