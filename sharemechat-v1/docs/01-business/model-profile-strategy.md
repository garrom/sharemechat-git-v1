# Estrategia de página pública de modelo

> Estado: VIGENTE
> Fecha: 2026-07-09
> Última revisión: 2026-07-24 (retirada §4 tracking de afiliación por [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md); actualización CTA con rango de precio autoservicio)
> Vigencia esperada: indefinida (producto estable, evoluciona con el producto)
> Reemplaza: N/A (documento nuevo)
> Ver también: [ADR-048](../06-decisions/adr-048-pagina-publica-modelo-slug.md), [ADR-018](../06-decisions/adr-018-blog-static-rendering.md), [ADR-019](../06-decisions/adr-019-blog-spa-react.md), [ADR-022](../06-decisions/adr-022-blog-cms-multilingual-es-en.md), [ADR-033](../06-decisions/adr-033-noindex-non-prod-environments.md), [ADR-042](../06-decisions/adr-042-prerender-cron-on-backend-ec2.md), [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md), [launch-strategy.md](launch-strategy.md), [sistema-tiers-modelos.md](sistema-tiers-modelos.md)

## 1. Propósito y sinergia

La página pública de modelo `sharemechat.com/m/:slug` (y su equivalente bilingüe `sharemechat.com/en/m/:slug`) es la superficie de producto que **sirve dos propósitos distintos con el mismo pilar técnico**:

- **Producto visible**: la plataforma deja de ser un coming-soon y pasa a mostrar oferta real.
- **SEO long-tail**: cada perfil es una landing indexable con contenido único (nombre de la modelo, idiomas, disponibilidad, presentación, precio elegido).

Esta sinergia (movimientos A + D + E de la estrategia de lanzamiento) hace que la página pública de modelo sea el pilar central del pivote de soft launch. Detalle contextual en [launch-strategy.md](launch-strategy.md) § 4.

**Nota sobre afiliación (retirada por ADR-052)**: en la versión original de este documento se listaba como tercer propósito el "soporte de afiliación y herramienta de venta" y la URL `/m/:slug` operaba también como link de afiliación (`?ref=`). Ese propósito queda retirado tras la eliminación del programa de afiliadas ([ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D11). La página sigue siendo palanca central del soft launch por producto visible + SEO; el `?ref=` deja de tener función operativa cuando se materialice la retirada técnica (frente separado).

## 2. Contenido de la página

Cada página `/m/:slug` sirve una vista pública con:

- **Fotos y vídeos KYC-aprobados de la modelo**, servidos desde el multi-asset Layer 2 backend ya existente. Solo assets aprobados por moderación pasan al front público.
- **Presentación editorial corta**: bio de la modelo, idiomas hablados, horarios habituales de disponibilidad.
- **Precio por minuto elegido por la modelo**: visible claramente en la tarjeta y en la vista de perfil. El valor está dentro del rango de su tramo (€1 T0; €1-3 T1; €1-6 T2; €1-9 T3) según [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D10.
- **Estado online / offline** en tiempo real. Si offline, se ofrece la modelo alternativa online más cercana al perfil visitado.
- **CTA dual**:
  - "Iniciar sesión privada" → flujo de pago normal, tarifa por minuto elegida por la modelo dentro del rango de su tramo. Ver [sistema-tiers-modelos.md](sistema-tiers-modelos.md).
  - "Chatear gratis" → entra al freemium interno (chat texto, emojis, hasta 3 min de video/día bajo el sistema de packs con cooldown documentado en [sistema-tiers-modelos.md](sistema-tiers-modelos.md) § 6). Si la modelo tiene Estatus Pro y ha desactivado trial, el CTA "Chatear gratis" se sustituye por "Recarga para chatear con ella".
- **Kit de assets sociales autogenerado** (banners, GIFs cortos, plantillas de tweet en ES/EN) descargables desde un botón discreto de la propia página. La modelo o su estudio los usan para promocionar el link de perfil en X, Telegram, Reddit, etc.

La página **no** contiene contenido adult-themed en zonas públicas: solo material apto SFW (Safe For Work) según la política ya establecida para la zona pública en [business-model.md](business-model.md). El contenido adult vive dentro de la sesión privada 1-a-1.

## 3. Base técnica reutilizada

La implementación no introduce infraestructura nueva. Todos los componentes ya operativos:

- **Multi-asset Layer 2 backend**: los assets KYC-aprobados de la modelo (foto perfil, galería, vídeos cortos) están cableados en el modelo de datos actual. La ruta pública sirve solo un subconjunto (los marcados como públicos por la propia modelo dentro del panel).
- **CMS bilingüe ES/EN** documentado en [ADR-022](../06-decisions/adr-022-blog-cms-multilingual-es-en.md). Cada perfil se sirve en las dos variantes de idioma con `hreflang` y canonical apuntando al idioma correcto.
- **Prerender estático a S3 + CloudFront** documentado en [ADR-018](../06-decisions/adr-018-blog-static-rendering.md), [ADR-019](../06-decisions/adr-019-blog-spa-react.md) y el cron backend de [ADR-042](../06-decisions/adr-042-prerender-cron-on-backend-ec2.md). Los perfiles se prerenderan igual que los artículos del blog: HTML servido desde CloudFront, meta tags Open Graph + Twitter Card + JSON-LD `Person` inyectados en el HTML servido (no post-mount), invalidación selectiva al aprobar o retirar assets o al cambiar la tarifa elegida.
- **Noindex no-PROD** documentado en [ADR-033](../06-decisions/adr-033-noindex-non-prod-environments.md). En TEST y AUDIT las páginas `/m/:slug` sirven con `X-Robots-Tag: noindex` para no filtrar contenido de pruebas a Google.

## 4. Tracking de afiliación (RETIRADO)

> ⚠️ SECCIÓN RETIRADA
> Contenido histórico movido a: [_deprecated/registro.md §"[affiliate-program.md] §'Programa de afiliados'"](../_deprecated/registro.md) (bloque relacionado del programa de afiliadas retirado).
> Motivo: [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D11.
> Fecha retirada: 2026-07-24

La URL del perfil (`/m/:slug`) opera hoy exclusivamente como landing SEO + producto visible. El sufijo `?ref=<affiliate_id>` queda desactivado cuando se materialice la retirada técnica del programa de afiliadas (frente separado: purga de `AffiliateAttributionService` + retirada del cookie handler + cleanup de columnas BD).

## 5. Kit de assets sociales

Desde cada página `/m/:slug`, la propia modelo (autenticada) puede descargar:

- Banners estáticos con la portada de su perfil y CTA "chatea conmigo en SharemeChat".
- GIFs cortos autogenerados a partir de los vídeos KYC-aprobados de la modelo (formato optimizado para X/Telegram, no NSFW).
- Plantillas de tweet en ES y EN con la URL del perfil precargada.

El objetivo del kit es reducir la fricción operativa para que las modelos con audiencia propia (X, Telegram, Reddit) usen su URL de perfil como link canónico en todas partes.

## 6. Uso operativo B2B

La misma página sirve al operador como material de venta a estudios pequeños:

- Cada modelo del estudio tiene su URL SEO en un dominio con autoridad creciente.
- El estudio puede orquestar la publicación de las URLs de sus modelos en sus propias redes.
- El pitch al estudio se apoya en material tangible ya funcionando, no en promesas.
- **Propuesta económica al estudio**: reparto 75-79% escalonado por modelo ([ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md)) + rango de precio autoservicio (€1-9/min) por modelo. Sin programa de afiliación adicional. Los términos B2B adicionales por volumen o exclusividad se negocian caso por caso fuera del régimen estándar.

Contexto operativo del pitch B2B en [launch-strategy.md](launch-strategy.md) § 4-D.

## 7. Métricas propuestas

Instrumentación mínima al lanzar la superficie:

- **Impresiones GSC por `/m/:slug`**: crecimiento agregado y por perfil.
- **Sesiones GA4 desde landing `/m/:slug`**: crecimiento y proporción del tráfico total.
- **Conversión perfil → click en CTA "sesión privada"** por perfil (para detectar qué perfiles convierten y qué perfiles solo son SEO).
- **Conversión perfil → primera compra** por perfil.
- **Tarifa media elegida por perfil** por tramo: indica si el rango de precio se está usando o si las modelos T2/T3 se quedan en el mínimo del rango.

Estas métricas no están todavía implementadas. Se abren como deuda de instrumentación al desplegar la superficie.

## 8. Referencias

- [ADR-048 — Página pública de modelo `/m/:slug` como palanca central](../06-decisions/adr-048-pagina-publica-modelo-slug.md)
- [ADR-052 — Rediseño estructural del reparto, rango de precio autoservicio y retirada del programa de afiliadas](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md)
- [launch-strategy.md](launch-strategy.md) — contexto estratégico del pivote y sinergia A+D+E.
- [sistema-tiers-modelos.md](sistema-tiers-modelos.md) — sistema de tramos, rango de precio, Estatus Pro, primer minuto trial.
- [affiliate-program.md](affiliate-program.md) — stub de retirada del programa de afiliadas.
- [ADR-022](../06-decisions/adr-022-blog-cms-multilingual-es-en.md), [ADR-018](../06-decisions/adr-018-blog-static-rendering.md), [ADR-019](../06-decisions/adr-019-blog-spa-react.md), [ADR-042](../06-decisions/adr-042-prerender-cron-on-backend-ec2.md), [ADR-033](../06-decisions/adr-033-noindex-non-prod-environments.md) — bases técnicas reutilizadas.
