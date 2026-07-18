# Estrategia geográfica de lanzamiento

Documento de dirección de trabajo, **no finalizada**. Recoge la postura actual sobre qué mercados servir y en qué orden, condicionada por la clasificación adult/streaming ([ADR-028](../06-decisions/adr-028-business-classification-adult-streaming.md)) y por el régimen regulatorio de los mercados objetivos.

La lista concreta de países servidos en el go-live PROD se cerró en [ADR-031](../06-decisions/adr-031-country-gating-go-live-prod.md) (cliente: 28 / modelo: 46, con RU/CU/VE/NI/UA excluidos del modelo por sanciones o riesgo operativo). El mecanismo técnico de bloqueo sigue siendo el definido en [ADR-007](../06-decisions/adr-007-country-blacklist-phase1-backend-primary.md). Este documento se mantiene como dirección estratégica de medio plazo (oleadas posteriores, reconsideración de mercados, evolución a granularidad sub-país en US).

## Postura general

SharemeChat se dirige **solo a mercados occidentales con poder adquisitivo medio-alto**. No se persigue volumen sino chargeback rate sano y revenue por usuario.

El supuesto de que "queda algún mercado occidental laxo" donde operar adult sin el cuerpo completo de compliance ya no se sostiene. Los mercados anglófonos principales han endurecido el régimen en los últimos 24 meses:

- **EE.UU.**: mosaico estatal tras *Free Speech Coalition v. Paxton* (Texas). Cada estado con ley de age verification debe tratarse caso por caso; algunos quedan fuera de scope hasta que el cumplimiento sea técnico-legalmente viable.
- **UK**: Online Safety Act vigente; guía Ofcom de enero 2025 sobre "highly effective age assurance" — la estimación facial cubre el requisito (ver ADR-029).
- **UE**: DSA aplicable, art. 28 con obligaciones específicas para plataformas que operan adult.
- **Australia**: Online Safety Act australiano con régimen propio.

El coste de construir compliance para operar en cualquiera de estos mercados es prácticamente fijo (vale igual para uno o para varios). Una vez construido, sirve para todos los mercados servidos.

## Mercados objetivos: dos oleadas

### Beachhead — Tier anglófono de alto poder adquisitivo

Primera ola. Mercados servidos desde go-live público:

- Reino Unido
- Irlanda
- Canadá
- Australia
- Nueva Zelanda
- EE.UU. en los estados aplicables (a determinar caso por caso según ley estatal)

Razón del beachhead anglófono: la adquisición orgánica realista en esta fase (X, Reddit, SEO de blog SFW) es eficiente sobre audiencia anglófona. Meta/Instagram/TikTok están cerrados a este vertical, por lo que no compensan el coste de adquisición pagada. El idioma de la plataforma (ya soportado en i18n EN) cubre estos mercados sin trabajo adicional de localización.

### Oleada 2 — UE continental de alto poder adquisitivo

Segunda ola. Activación posterior al beachhead, condicionada a viabilidad de localización:

- DACH (Alemania, Austria, Suiza)
- Países nórdicos
- Países Bajos
- Francia

Razón de la oleada 2: poder adquisitivo medio-alto comparable al beachhead, pero exige localización mínima al idioma local (DE, FR, NL, NO/SV/DA/FI) para conversión razonable. Activable cuando la localización sea operativamente viable.

### Resto del mundo

**Geobloqueo**:

- Jurisdicciones donde no operamos por diseño (régimen regulatorio incompatible o ausencia de PSP local viable).
- Estados US con ley aún no servidos.
- Regiones de bajo ARPU + alto chargeback.

El mecanismo técnico de bloqueo está definido en [ADR-007](../06-decisions/adr-007-country-blacklist-phase1-backend-primary.md). La lista concreta de países servidos (cliente 28 / modelo 46) está cerrada en [ADR-031](../06-decisions/adr-031-country-gating-go-live-prod.md).

## Implicaciones operativas

- **PSP**: el PSP adult-specialist seleccionado (CardBilling / Verotel como vía activa, ver [psp-strategy.md](psp-strategy.md)) debe cubrir los mercados servidos. Si la cobertura geográfica del PSP no incluye algún mercado objetivo, el orden de activación se ajusta.
- **Verificación de edad e identidad**: el flujo Didit (vendor único KYC consolidado en [ADR-035](../06-decisions/adr-035-age-and-identity-verification-vendor-consolidation-on-didit.md), arquitectura original en [ADR-029](../06-decisions/adr-029-age-and-identity-verification-architecture.md)) cubre los mercados objetivo. Cuando se active la oleada 2, hay que verificar que la lista de documentos y la cobertura idiomática del flujo soporta los nuevos mercados.
- **Localización**: el beachhead anglófono no requiere trabajo adicional de localización. La oleada 2 sí. El backlog de i18n del producto (ver `pending-hardening.md`) se prioriza para los idiomas de la oleada 2 cuando se active.
- **Reporting al PSP**: se hace agregado, no por mercado.

## Lo que NO está decidido

- La lista concreta de países servidos en el beachhead (especialmente la selección de estados US aplicables).
- La fecha de activación de la oleada 2.
- Si algún mercado del beachhead queda fuera por incompatibilidad con la cobertura del PSP final.
- Cómo se gestiona la rotación de la lista cuando la regulación de un estado/país cambia.

La selección concreta del go-live se cerró en [ADR-031](../06-decisions/adr-031-country-gating-go-live-prod.md). Las decisiones pendientes restantes (oleada 2, granularidad estatal US, reincorporación de UA/VE si CardBilling / Verotel confirma payouts) se documentarán como revisiones del propio ADR-031 o como ADRs sucesivos.

## Idea operativa de fondo

El coste de compliance es casi fijo una vez construido. Lo que mantiene sano el negocio es la **disciplina de chargebacks** — operar en mercados de alta confianza (poder adquisitivo medio-alto, cultura de pago con tarjeta consolidada) reduce el chargeback rate y mantiene el PSP estable. Cualquier expansión a mercados de mayor riesgo se evalúa contra el impacto previsible en chargeback rate, no contra el volumen potencial.

## Referencias

- [ADR-028](../06-decisions/adr-028-business-classification-adult-streaming.md) — clasificación adult/streaming.
- [ADR-007](../06-decisions/adr-007-country-blacklist-phase1-backend-primary.md) — mecanismo de bloqueo por país.
- [ADR-031](../06-decisions/adr-031-country-gating-go-live-prod.md) — listas finales cliente (28) y modelo (46) para go-live PROD.
- [psp-strategy.md](psp-strategy.md) — PSP y redundancia.
- [compliance-deliverables.md](compliance-deliverables.md) — entregables que aplican a todos los mercados servidos.
