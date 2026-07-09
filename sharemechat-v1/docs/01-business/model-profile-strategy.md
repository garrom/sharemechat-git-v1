# Estrategia de página pública de modelo

> Estado: VIGENTE
> Fecha: 2026-07-09
> Vigencia esperada: indefinida (producto estable, evoluciona con el producto)
> Reemplaza: N/A (documento nuevo)
> Ver también: [ADR-048](../06-decisions/adr-048-pagina-publica-modelo-slug.md), [ADR-018](../06-decisions/adr-018-blog-static-rendering.md), [ADR-019](../06-decisions/adr-019-blog-spa-react.md), [ADR-022](../06-decisions/adr-022-blog-cms-multilingual-es-en.md), [ADR-033](../06-decisions/adr-033-noindex-non-prod-environments.md), [ADR-042](../06-decisions/adr-042-prerender-cron-on-backend-ec2.md), [launch-strategy.md](launch-strategy.md), [affiliate-program.md](affiliate-program.md)

## 1. Propósito y sinergia

La página pública de modelo `sharemechat.com/m/:slug` (y su equivalente bilingüe `sharemechat.com/en/m/:slug`) es la superficie de producto que **sirve tres propósitos distintos con el mismo pilar técnico**:

- **Producto visible**: la plataforma deja de ser un coming-soon y pasa a mostrar oferta real.
- **SEO long-tail**: cada perfil es una landing indexable con contenido único (nombre de la modelo, idiomas, disponibilidad, presentación).
- **Soporte de afiliación y herramienta de venta**: la URL del perfil ES el link de afiliación de la modelo, y el mismo material sirve al operador como pitch B2B a estudios pequeños.

Esta sinergia (movimientos A + D + E de la estrategia de lanzamiento) hace que la página pública de modelo sea el pilar central del pivote de soft launch. Detalle contextual en [launch-strategy.md](launch-strategy.md) § 4.

## 2. Contenido de la página

Cada página `/m/:slug` sirve una vista pública con:

- **Fotos y vídeos KYC-aprobados de la modelo**, servidos desde el multi-asset Layer 2 backend ya existente. Solo assets aprobados por moderación pasan al front público.
- **Presentación editorial corta**: bio de la modelo, idiomas hablados, horarios habituales de disponibilidad.
- **Estado online / offline** en tiempo real. Si offline, se ofrece la modelo alternativa online más cercana al perfil visitado.
- **CTA dual**:
  - "Iniciar sesión privada" → flujo de pago normal, tarifa por minuto de la modelo según su tier.
  - "Chatear gratis" → entra al freemium interno (chat texto, emojis, hasta 3 min de video/día según packs de slots documentados en [sistema-tiers-modelos.md](sistema-tiers-modelos.md) § 5).
- **Kit de assets sociales autogenerado** (banners, GIFs cortos, plantillas de tweet en ES/EN) descargables desde un botón discreto de la propia página. La modelo o su estudio los usan para promocionar el link de perfil en X, Telegram, Reddit, etc.

La página **no** contiene contenido adult-themed en zonas públicas: solo material apto SFW (Safe For Work) según la política ya establecida para la zona pública en [business-model.md](business-model.md). El contenido adult vive dentro de la sesión privada 1-a-1.

## 3. Base técnica reutilizada

La implementación no introduce infraestructura nueva. Todos los componentes ya operativos:

- **Multi-asset Layer 2 backend**: los assets KYC-aprobados de la modelo (foto perfil, galería, vídeos cortos) están cableados en el modelo de datos actual. La ruta pública sirve solo un subconjunto (los marcados como públicos por la propia modelo dentro del panel).
- **CMS bilingüe ES/EN** documentado en [ADR-022](../06-decisions/adr-022-blog-cms-multilingual-es-en.md). Cada perfil se sirve en las dos variantes de idioma con `hreflang` y canonical apuntando al idioma correcto.
- **Prerender estático a S3 + CloudFront** documentado en [ADR-018](../06-decisions/adr-018-blog-static-rendering.md), [ADR-019](../06-decisions/adr-019-blog-spa-react.md) y el cron backend de [ADR-042](../06-decisions/adr-042-prerender-cron-on-backend-ec2.md). Los perfiles se prerenderan igual que los artículos del blog: HTML servido desde CloudFront, meta tags Open Graph + Twitter Card + JSON-LD `Person` inyectados en el HTML servido (no post-mount), invalidación selectiva al aprobar o retirar assets.
- **Noindex no-PROD** documentado en [ADR-033](../06-decisions/adr-033-noindex-non-prod-environments.md). En TEST y AUDIT las páginas `/m/:slug` sirven con `X-Robots-Tag: noindex` para no filtrar contenido de pruebas a Google.

## 4. Tracking de afiliación integrado en la URL

La URL del perfil ES el link de afiliación. No hay dos URLs distintas ("una para SEO, otra para afiliación") — es la misma.

- Formato: `https://sharemechat.com/m/:slug?ref=:affiliate_id`
- Sin `?ref=`, el tráfico se atribuye a la propia modelo (autoafiliación implícita).
- Con `?ref=:affiliate_id`, el tráfico queda trackeado como del afiliado externo (otra modelo, estudio, empresa afiliada).
- Cookie del navegador visitante persistente **90 días** desde el último click con `ref=`. Si el visitante registra cuenta y hace primera compra dentro de esos 90 días, la comisión se paga al `affiliate_id` de la cookie.
- El programa único de afiliación y las condiciones de payout se documentan en [affiliate-program.md](affiliate-program.md).

## 5. Kit de assets sociales

Desde cada página `/m/:slug`, la propia modelo (autenticada) puede descargar:

- Banners estáticos con la portada de su perfil y CTA "chatea conmigo en SharemeChat".
- GIFs cortos autogenerados a partir de los vídeos KYC-aprobados de la modelo (formato optimizado para X/Telegram, no NSFW).
- Plantillas de tweet en ES y EN con la URL del perfil precargada (`?ref=` autoinsertado con el `affiliate_id` de la propia modelo).

El objetivo del kit es reducir la fricción operativa para que las modelos con audiencia propia (X, Telegram, Reddit) usen su URL de perfil como link canónico en todas partes.

## 6. Uso operativo B2B

La misma página sirve al operador como material de venta a estudios pequeños:

- Cada modelo del estudio tiene su URL SEO en un dominio con autoridad creciente.
- El estudio puede orquestar la publicación de las URLs de sus modelos en sus propias redes.
- El pitch al estudio se apoya en material tangible ya funcionando, no en promesas.

Contexto operativo del pitch B2B en [launch-strategy.md](launch-strategy.md) § 4-D.

## 7. Métricas propuestas

Instrumentación mínima al lanzar la superficie:

- **Impresiones GSC por `/m/:slug`**: crecimiento agregado y por perfil.
- **Sesiones GA4 desde landing `/m/:slug`**: crecimiento y proporción del tráfico total.
- **Conversión perfil → click en CTA "sesión privada"** por perfil (para detectar qué perfiles convierten y qué perfiles solo son SEO).
- **Conversión perfil → primera compra** atribuida por cookie de afiliación (90 días).
- **Distribución de tráfico por `ref=`**: qué % del tráfico llega con afiliación de terceros vs autoafiliación de la propia modelo.

Estas métricas no están todavía implementadas. Se abren como deuda de instrumentación al desplegar la superficie.

## 8. Referencias

- [ADR-048 — Página pública de modelo `/m/:slug` como palanca central](../06-decisions/adr-048-pagina-publica-modelo-slug.md)
- [launch-strategy.md](launch-strategy.md) — contexto estratégico del pivote y sinergia A+D+E.
- [affiliate-program.md](affiliate-program.md) — programa de afiliación y payout.
- [sistema-tiers-modelos.md](sistema-tiers-modelos.md) — economía interna de modelos y freemium (chat texto, emojis, 3 min video/día).
- [ADR-022](../06-decisions/adr-022-blog-cms-multilingual-es-en.md), [ADR-018](../06-decisions/adr-018-blog-static-rendering.md), [ADR-019](../06-decisions/adr-019-blog-spa-react.md), [ADR-042](../06-decisions/adr-042-prerender-cron-on-backend-ec2.md), [ADR-033](../06-decisions/adr-033-noindex-non-prod-environments.md) — bases técnicas reutilizadas.
