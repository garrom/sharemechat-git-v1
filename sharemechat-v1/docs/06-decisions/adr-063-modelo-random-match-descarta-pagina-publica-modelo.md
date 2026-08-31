# ADR-063 — Se confirma el modelo de producto match-aleatorio 1-a-1 (tipo CooMeet) y se descarta la página pública por modelo `/m/:slug` (supersede ADR-048)

> Estado: Aceptada (VIGENTE)
> Fecha: 2026-08-31
> Reemplaza / supersede: [ADR-048](adr-048-pagina-publica-modelo-slug.md) (y su doc de estrategia [`../01-business/model-profile-strategy.md`](../01-business/model-profile-strategy.md))
> Ver también: [ADR-047](adr-047-pivote-soft-launch-cripto-paxum.md), [ADR-052](adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md), [`../01-business/launch-strategy.md`](../01-business/launch-strategy.md), [`../01-business/business-model.md`](../01-business/business-model.md)

## Contexto

[ADR-048](adr-048-pagina-publica-modelo-slug.md) (jul-2026) propuso una **página pública por modelo** `sharemechat.com/m/:slug` como "palanca central" que resolvía tres cosas con el mismo pilar técnico: producto visible + SEO long-tail + soporte de afiliación. Desde entonces:

- **La pata de afiliación ya cayó**: el programa de afiliadas (ADR-049) se retiró por completo en [ADR-052](adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) (2026-07-24). El link de afiliación *era* la URL `/m/`, así que uno de los tres propósitos ya no existe.
- **Verificación de comparables (2026-08-31, con búsqueda web)**: CooMeet, LuckyCrush, Flingster, Chatspin y los videochat 1-a-1 "adult dating" **no tienen páginas públicas por modelo**: funcionan por **emparejamiento aleatorio automático** (no se navega ni se elige a nadie). Las páginas públicas por modelo son el patrón de los **cam sites** (Chaturbate, Stripchat, LiveJasmin), un producto distinto cuyo núcleo es *navegar-y-elegir*.
- **Realidad SEO**: el valor long-tail de `/m/` depende de inventario (hoy ~1 modelo) y competiría con cam sites establecidos por el nombre de cada modelo; una modelo nueva no tiene demanda de búsqueda por su nombre. El tráfico lo traería la propia modelo compartiendo su URL, no el descubrimiento orgánico.

SharemeChat se posiciona como **match aleatorio 1-a-1 con mujeres verificadas (KYC), tipo CooMeet** (ver [`business-model.md`](../01-business/business-model.md)). Construir `/m/:slug` importaría el **escaparate del cam site** sobre un núcleo que no es de escaparate: un híbrido que no encaja con la identidad del producto.

## Decisión

1. **Se confirma el modelo de producto**: videochat de **match aleatorio 1-a-1** con modelos verificadas, sin escaparate navegable de modelos. Es el modelo de CooMeet, no el de los cam sites.
2. **Se descarta la página pública por modelo `/m/:slug`** (ADR-048). No se implementa.
3. [ADR-048](adr-048-pagina-publica-modelo-slug.md) pasa a **SUPERSEDED** por este ADR. El doc [`model-profile-strategy.md`](../01-business/model-profile-strategy.md) queda **superseded** (se conserva por trazabilidad histórica; no describe producto vigente).
4. La **captación de modelos** —que era el problema que `/m/` pretendía resolver— se reorienta al modelo real de *supply* de un producto tipo CooMeet: **reclutamiento directo / B2B** (outreach, estudios, acuerdos de supply, referidos), **no** SEO de perfiles. El diseño concreto de esa palanca queda como **frente aparte, pendiente de abrir**.

## Justificación

El núcleo de SharemeChat es el emparejamiento aleatorio. La superficie pública por modelo pertenece a otro modelo de negocio (cam site) y, además, sus tres justificaciones originales se han erosionado: la afiliación desapareció (ADR-052), y el SEO long-tail no es realista sin inventario ni frente a la competencia establecida. Mantener ADR-048 VIGENTE arriesgaba que se construyera una superficie ajena al producto. Se cierra la línea.

## Consecuencias

- **Positivas**: coherencia de identidad de producto; no se invierte esfuerzo en una superficie que no encaja; el backlog deja de arrastrar un P1 que no debía ejecutarse.
- **Negativas**: el pivote de soft launch descrito en [`launch-strategy.md`](../01-business/launch-strategy.md) pierde su "pilar técnico" A+D+E; queda **sin palanca de producto-visible / SEO**. El blog queda como asset defensivo. La captación de modelos necesita una **palanca nueva (reclutamiento directo)**, pendiente de diseñar — es ahora el hueco estratégico principal.
- **Sin efecto sobre**: el directorio existente `/modelos` (superficie de registro separada cliente/modelo, otra cosa) y el resto del producto. El freemium "chatear gratis" ([`sistema-tiers-modelos.md`](../01-business/sistema-tiers-modelos.md)) no dependía de `/m/` para existir; solo pierde ese punto de entrada.

## Notas

- Decisión del operador (2026-08-31) tras verificar que los comparables directos (CooMeet/LuckyCrush) no usan páginas públicas por modelo.
- Fuentes de la verificación: comparativas CooMeet vs LuckyCrush (match aleatorio, sin selección de modelo) y perfil público de LiveJasmin (patrón cam site).
