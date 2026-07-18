# Estrategia de lanzamiento por fases

> Estado: TRANSITORIO
> Fecha: 2026-07-09
> Vigencia esperada: hasta post-soft-launch (previsto Q4 2026), momento en el que se archivará en `_archive/`
> Reemplaza: N/A (documento nuevo)
> Ver también: [ADR-047](../06-decisions/adr-047-pivote-soft-launch-cripto-paxum.md), [ADR-048](../06-decisions/adr-048-pagina-publica-modelo-slug.md), [psp-strategy.md](psp-strategy.md), [model-profile-strategy.md](model-profile-strategy.md), [affiliate-program.md](affiliate-program.md), [sistema-tiers-modelos.md](sistema-tiers-modelos.md)

## 1. Contexto

Al cierre de este documento, la percepción operativa del proyecto identifica dos bloqueos al arranque real:

- **Tráfico cero**: la plataforma está en coming-soon con solo registros abiertos. El plan SEO (blog) y el plan de afiliación no están generando tráfico. La meta previa era acumular clientes y modelos registradas antes de lanzar.
- **PSP tarjeta bloqueado**: la vía activa CardBilling / Verotel queda cerrada por requisito de director residente en Estonia inviable a corto plazo. Otras opciones adult (CCBill, Epoch, Verotel / CardBilling group) también descartadas por razones distintas. Cripto (NOWPayments) y Paxum son las dos únicas vías viables a corto plazo. Vendo y CommerceGate quedan como contactos abiertos.

Ante esto, la tentación inicial es añadir una zona peer-to-peer gratis (tipo Omegle moderado, con registro + KYC) como canal de tráfico orgánico paralelo. Este documento registra por qué esa vía se descarta y qué estrategia se adopta en su lugar.

## 2. Diagnóstico corregido

No son dos problemas independientes. Es **un problema real** (PSP tarjeta) más **una consecuencia** (no hay tráfico porque no hay producto lanzable, no al revés):

- El SEO no convierte porque el CTA final es "regístrate y espera". Ningún blog trae conversiones a un coming-soon.
- Los afiliados no venden porque no tienen producto vivo que promocionar.
- Sin PSP tarjeta no hay negocio adult premium en 2026 a escala completa, pero cripto + Paxum es un mercado real (5-12% del volumen total) suficiente para operar en modo puente.

**Conclusión operativa**: el problema real es que el proyecto está en coming-soon indefinido esperando la perfección (todos los métodos de pago desde el día uno) y eso está impidiendo lo bueno (estar en el mercado y aprender).

## 3. Alternativa peer-to-peer descartada

La zona peer-to-peer gratis se estudió y se descarta. Los seis motivos operativos, en resumen:

1. **Precedente Omegle/Chatroulette**: registro y KYC no resuelven moderación en tiempo real de contenido no consentido ni menores usando DNI de terceros. Bajo DSA (EU) y 2257 (US) la plataforma sería responsable como productor. Requiere estructura de moderación 24/7 fuera del alcance actual.
2. **Canibaliza la propuesta de valor premium** (modelos verificadas, 30% revshare de afiliación). Cliente potencial piensa "¿por qué pago si hay gratis?", modelo profesional piensa "¿esto me trata como profesional o como sala anónima?".
3. **Coste operativo negativo**: bandwidth WebRTC + STUN/TURN + moderación + infra + soporte, todo pagado, con cero ingresos del canal.
4. **Riesgo legal por gifts a "chicas normales no modelos"**: convertiría a la plataforma en operador de sex work no verificado sin contratos de talento, sin registros 2257, sin edad certificada por la plataforma. Riesgo penal, no administrativo.
5. **Reduce opciones de PSP tarjeta**: broadcasting sin control es alérgeno directo para el underwriting adult de cualquier PSP tarjeta futuro.
6. **Tráfico peer-to-peer no convierte a sesión de pago**: el intent de un usuario que llega buscando gratis es NO pagar. Embudo ancho arriba, cuello estrangulado abajo, bandwidth pagado en el ancho.

El detalle completo y la formalización del descarte viven en [ADR-047](../06-decisions/adr-047-pivote-soft-launch-cripto-paxum.md), sección "Alternativas consideradas".

## 4. Estrategia adoptada — cuatro movimientos

Se adoptan cuatro movimientos operativos, no cinco. El posible "modelo cam público con tips" que apareció en discusión previa queda descartado por el operador y no se enumera.

### A. Freemium DENTRO del producto principal

Ya implementado parcialmente. Estado actual: **chat texto siempre gratis, emojis gratis, tres minutos de video gratis al día, solo los gifts se pagan**. Detalle mecánico completo (packs de slots gratis con cooldown progresivo, tarifas por tier de la modelo, cap efectivo ~3 min gratis/día por cliente en régimen estacionario) en [sistema-tiers-modelos.md](sistema-tiers-modelos.md) § 5.

Este movimiento no requiere trabajo nuevo salvo mantener la mecánica actual. El único pendiente es la **página pública de la modelo** navegable con fotos/vídeos KYC-aprobados como entrada natural al freemium (Movimiento E abajo).

### C. Lanzar YA con cripto (NOWPayments) + Paxum sin esperar tarjeta

**Objetivo del soft launch cripto-only: producto vivo, no facturación**. Lo que se gana:

- Producto validado (funciona con dinero real, aunque sea volumen bajo).
- Casos de éxito para reclutamiento de más modelos.
- Prueba de vida para PSPs de tarjeta futuros (histórico transaccional real).
- Contenido SEO real (páginas de modelo con actividad medible).
- Aprendizaje operativo (moderación, soporte, incidencias reales).

### D. B2B con estudios pequeños de webcam

En vez de reclutar 30 modelos una a una, negociar con 2-3 estudios pequeños (candidatos: Colombia, Rumanía) que ya operan 10-15 modelos cada uno con audiencia propia. La plataforma ofrece:

- El 30% de afiliación estándar aplicable a cada modelo del estudio sobre el tráfico que ella misma trae desde su URL de perfil (según el programa único documentado en [affiliate-program.md](affiliate-program.md)).
- Página SEO por modelo con dominio de autoridad creciente como material de venta para el estudio.
- Onboarding coordinado (los estudios manejan la mayor parte del soporte al talento).

Los estudios aportan oferta y audiencia. La plataforma aporta SEO de dominio y arquitectura de producto. Ratio 10 modelos activas mucho más rápido que outreach 1-a-1. Los términos comerciales específicos con cada estudio (si hubiera algún acuerdo económico añadido por volumen o exclusividad) se negocian caso por caso fuera del programa de afiliados estándar y no se documentan como tier general.

### E. Pivot del blog SEO a SEO de perfiles de modelos

El blog corporativo no tiene volumen realista en 6-12 meses (validado en el research del plan de captación Q3). Un perfil SEO-optimizado por modelo (`sharemechat.com/m/:slug` + `/en/m/:slug`) sí tiene long-tail relevante y sirve como pilar de tres cosas a la vez: producto visible, SEO, soporte de afiliación.

Detalle técnico y de contenido en [model-profile-strategy.md](model-profile-strategy.md). Decisión formalizada en [ADR-048](../06-decisions/adr-048-pagina-publica-modelo-slug.md). Reutiliza CMS bilingüe y prerender S3+CloudFront ya operativos.

## 5. Segmentos que pagan con cripto

La fricción de pagar con cripto es real pero está exagerada. Hoy pagar con NOWPayments desde USDT/USDC ya en un exchange (Binance, Coinbase, Kraken) son cuatro clicks y dos minutos. Cinco perfiles capturan el volumen cripto-only realista:

1. **Privacidad extrema no paranoica**: abogados, jueces, políticos locales, ejecutivos cotizados, médicos, casados en países conservadores. ARPU alto. Statement bancario con cargo adult sería prueba forense.
2. **Países con controles cambiarios o bloqueo de tarjeta para adult**: Oriente Medio, Turquía, Rusia, LATAM parcial, Indonesia, Vietnam. Volumen alto, ARPU medio.
3. **Crypto natives 25-40 años**: tech-adjacent, USDT en wallet activo, fidelidad alta.
4. **Baneados de mainstream** por transacciones adult repetidas: cuentas cerradas por PSPs generalistas.
5. **Gifts como gasto no-esencial**: el mismo usuario que no paga 8 €/min de sesión sí manda tip de 5 € en contexto público. Cripto para gifts tiene menos fricción psicológica.

Estimación: cripto-only captura **5-12% del volumen combinado de cripto + tarjeta**. Suficiente para operar el puente mientras se cierra un PSP tarjeta viable.

## 6. Asimetría modelos-vs-clientes

Modelos y clientes NO son simétricos en two-sided marketplaces adult. El cuello de botella son siempre las modelos:

- 10 modelos verificadas activas online → los clientes las encuentran (SEO, redes sociales, boca a boca de las propias modelos) incluso sin marketing.
- 100 clientes registrados y 0 modelos online → los 100 se evaporan en dos semanas.

**Consecuencia operativa**: la semana cero del soft launch NO es "captar clientes con blog". Es **conseguir 10 modelos verificadas activas**. Todo lo demás sigue de ahí. Esta prioridad invalida cualquier meta previa simétrica del tipo "X clientes + X modelos antes de lanzar": los dos lados no son intercambiables ni se ponderan igual.

## 7. Plan concreto de las 2 semanas siguientes

Ejecución operativa, no aspiracional:

1. **Lanzar infraestructura de página pública de modelo `/m/:slug`** con SEO + tracking de afiliación integrado. Aprovechar el CMS bilingüe, el prerender S3+CloudFront y el multi-asset Layer 2 ya existentes.
2. **Pasar de coming-soon a soft-launch** con banner discreto en el header: "beta, pagos en cripto de momento, tarjeta próximamente". Cambio de percepción: de "empresa que no existe todavía" a "empresa que ya opera con limitación acotada".
3. **Primer batch de 5-10 modelos verificadas** por dos vías paralelas: (a) 2-3 estudios pequeños Colombia/Rumanía como B2B, (b) modelos independientes activas en X con audiencia propia identificada.
4. **Anuncio público del soft-launch**: post en r/CamGirlProblems (respetando el pipeline social-ops de [ADR-040](../06-decisions/adr-040-pivote-target-subs-social-ops.md), disclosure explicit + audiencia models), pin en X. Ángulo: plataforma nueva en beta con 30% de afiliación lifetime a la modelo por cada cliente que trae.

## 8. Referencias

- [ADR-047 — Pivote de coming-soon a soft launch con PSP puente cripto + Paxum](../06-decisions/adr-047-pivote-soft-launch-cripto-paxum.md)
- [ADR-048 — Página pública de modelo `/m/:slug` como palanca central](../06-decisions/adr-048-pagina-publica-modelo-slug.md)
- [psp-strategy.md](psp-strategy.md) — estrategia de PSP (pendiente actualización en Fase B con el nuevo estado post-CardBilling / Verotel).
- [model-profile-strategy.md](model-profile-strategy.md) — detalle de la página pública de modelo.
- [affiliate-program.md](affiliate-program.md) — programa de afiliados y sinergia con página de modelo.
- [sistema-tiers-modelos.md](sistema-tiers-modelos.md) — freemium interno del producto y economía de modelos.
