# ADR-047 — Pivote de coming-soon a soft launch con PSP puente cripto + Paxum

> Estado: VIGENTE
> Fecha: 2026-07-09
> Vigencia esperada: hasta que se cierre un PSP tarjeta viable y el soft launch se convierta en lanzamiento público pleno
> Reemplaza: la parte de `psp-strategy.md` que declaraba a Segpay como "vía activa" (retirada a mover a `_deprecated/registro.md` en Fase B)
> Ver también: [ADR-028](adr-028-business-classification-adult-streaming.md), [ADR-011](adr-011-pricing-simplification-and-minimum-threshold.md), [ADR-048](adr-048-pagina-publica-modelo-slug.md), [`../01-business/launch-strategy.md`](../01-business/launch-strategy.md), [`../01-business/psp-strategy.md`](../01-business/psp-strategy.md)

## Estado

Aceptada.

## Contexto

Al cierre de este ADR, la operación del proyecto está bloqueada en dos frentes simultáneos con impacto en el arranque real:

### PSP tarjeta cerrado en el corto plazo

- **Segpay** era la vía activa de onboarding declarada en `psp-strategy.md`. La due diligence se detiene por requisito estonio de **director residente en Estonia**, inviable operativamente a corto plazo. La vía queda cerrada, no diferida.
- **CCBill**: quedó silente tras conversaciones iniciales; se descarta formalmente.
- **Epoch**, **Verotel** y **CardBilling group**: descartados por razones distintas (encaje geográfico, requisitos de volumen o silencio comercial).
- **Vendo** y **CommerceGate**: quedan como **contactos abiertos**, sin cierre negativo formal, disponibles para reactivar más adelante sin bloquear la operación.

### Coming-soon indefinido drena caja sin aprendizaje

El coming-soon del producto consume ~257 €/mes en costes fijos (AWS + Companio + Sightengine) sin generar ningún metricable: sin producto lanzable, el SEO no convierte, los afiliados no venden, y la plataforma no acumula pruebas de vida para futuros PSPs de tarjeta.

Los únicos PSPs adult-adjacent viables a corto plazo son:

- **NOWPayments** (cripto USDT/USDC/BTC → conversión spot a EUR).
- **Paxum** (wallet especializado en sector adult para cargas y payouts).

La estimación operativa razonable es que estos dos PSPs juntos capturan **5-12 % del volumen combinado de tarjeta + cripto** en el vertical. Es un mercado real, no marginal, y suficiente para operar en modo puente mientras se cierra un PSP tarjeta viable.

## Opciones consideradas

### Opción 1 — Mantener coming-soon indefinido hasta cerrar PSP tarjeta

Postura previa por defecto: no lanzar hasta que la experiencia de compra sea completa con tarjeta.

Pros:
- Experiencia de usuario más pulida al abrir.
- Sin riesgo de dañar reputación con un producto parcialmente operativo.

Contras:
- Drena 257 €/mes de caja sin retorno operativo.
- No acumula prueba transaccional real que sirva de argumento a PSPs tarjeta futuros.
- No permite reclutar modelos con producto vivo.
- El SEO no convierte porque el CTA final es "regístrate y espera".

### Opción 2 — Añadir una zona peer-to-peer gratuita como canal de tráfico paralelo

Zona tipo Omegle moderado, con registro + KYC obligatorio, para captar tráfico orgánico independiente del producto de pago.

Descartada. Ver sección "Alternativas consideradas — zona peer-to-peer gratuita" más abajo para el detalle.

### Opción 3 — Soft launch con PSP puente cripto + Paxum (opción elegida)

Pasar de coming-soon a soft launch con los dos PSPs que sí son viables hoy, aceptando que solo se cubre el 5-12 % del mercado como puente hasta cerrar un PSP tarjeta.

Pros:
- Producto vivo desde ya. Aprendizaje operativo real.
- Genera prueba transaccional útil para negociar con Vendo / CommerceGate / futuros candidatos.
- El SEO puede empezar a convertir sobre las páginas de perfil de modelo (ver [ADR-048](adr-048-pagina-publica-modelo-slug.md)).
- Permite reclutar modelos con producto que ya funciona.
- Cripto abre segmento de países con controles cambiarios o bloqueo bancario para adult (no accesible con tarjeta occidental).

Contras:
- Volumen esperado modesto (5-12 % del mercado potencial). No sostiene el negocio por sí solo.
- Requiere banner en el header explicando la limitación de pagos. Puede leerse como "producto incompleto" por parte de una fracción de visitantes.
- No aísla al proyecto de la obligación de cerrar PSP tarjeta en algún momento; solo compra tiempo.

## Decisión

**Pasar de coming-soon a soft launch con PSP puente cripto (NOWPayments) + Paxum** cuando se cumpla el **gate de apertura**:

1. **≥10 modelos verificadas activas** (KYC APPROVED con login en los últimos 7 días).
2. **Página `/m/:slug` operativa en PROD** con contenido navegable y tracking de afiliación integrado (según [ADR-048](adr-048-pagina-publica-modelo-slug.md)).
3. **PSP cripto en producción** con al menos una transacción real completada end-to-end (compra de pack → wallet actualizada → sesión consumida).

Al pasar el gate:

- Se retira el modo coming-soon del banner principal.
- Se instala un banner discreto: "beta, pagos en cripto de momento, tarjeta próximamente".
- Se permite registro y compra normal desde los mercados servidos por [ADR-031](adr-031-country-gating-go-live-prod.md).
- Se comunica públicamente el soft launch por los canales habituales (X, r/CamGirlProblems, blog).

**Meta operativa asimétrica de reemplazo**: la meta previa simétrica "30 clientes + 30 modelos antes de lanzar" queda **invalidada** por la asimetría real del marketplace. La única meta operativa es **10 modelos verificadas activas primero**; los clientes vienen después y no requieren gate previo.

## Justificación

Los dos motivos operativos clave del pivote:

1. **El bloqueo real es coming-soon, no PSP tarjeta**: sin producto visible, el resto de palancas (SEO, afiliados, reclutamiento) están sin combustible. Cripto+Paxum resuelven el problema de "estar vivo", aunque no el de "capturar mercado completo".
2. **La asimetría del marketplace manda**: 10 modelos activas atraen clientes por SEO, boca a boca y redes de las propias modelos. 100 clientes registrados sin modelos online se evaporan en 2 semanas. La priorización de modelos primero cambia la mecánica de todo lo demás.

## Impacto

### Impacto en documentación

- Ficheros con menciones a "Segpay como vía activa" que quedan superseded: `psp-strategy.md`, `business-model.md`, `compliance-scope.md`, `geographic-strategy.md`, `unit-economics.md`, `sistema-tiers-modelos.md` § 6, `seo/estrategia.md` § 4 F2, `financiero/modelo-financiero.md`, `financiero/modelo-financiero-tablas.md`. Estos ficheros se actualizan en Fase B del pivote siguiendo el patrón de deprecados centralizados de `documentation-governance.md`.
- `current-phase.md` incorpora un frente nuevo "Pivote soft launch cripto + página de modelo" en Fase B.
- `roles-and-flows.md` incorpora el flujo "publicación de perfil público" cuando se implemente [ADR-048](adr-048-pagina-publica-modelo-slug.md).

### Impacto en compliance

- **Los entregables 2257 + Records Custodian + moderación en tiempo real + declaración pública siguen siendo obligatorios estructuralmente**, aunque el PSP tarjeta esté pendiente. La clasificación adult/streaming de [ADR-028](adr-028-business-classification-adult-streaming.md) no se relaja por operar con cripto.
- La DPIA biométrica y las políticas formales que exigía Segpay son documentos ya alineados con el régimen adult general, no específicos de Segpay. Se mantienen.

### Impacto en modelo financiero

- La fase F1 "Coming Soon mes 0-3" del modelo financiero actual (revenue = 0) queda invalidada. El soft launch cripto permite revenue desde el mes 1 del gate.
- Los fees asumidos (Segpay 10 % + €0.30) se sustituyen por fees NOWPayments + Paxum reales cuando se contraten. Ajuste de modelo financiero pendiente en Fase B.

### Impacto en riesgo operacional

- Se mitiga el riesgo "gasto sin aprendizaje" del coming-soon indefinido.
- Se asume el riesgo reputacional bajo de operar con "beta, cripto de momento".
- Se mantiene el riesgo de dependencia futura de PSP tarjeta: cripto+Paxum es puente, no destino.

## Consecuencias

- **Positivas**: producto vivo, aprendizaje operativo real, prueba transaccional para PSPs tarjeta futuros, apertura de segmentos cripto (países con controles cambiarios, privacidad extrema, crypto natives).
- **Negativas**: volumen esperado modesto, banner de limitación visible al usuario, dependencia futura de cerrar PSP tarjeta.
- **Trade-off principal**: se cambia "abrir con producto completo" por "abrir con producto parcial más pronto y aprender". La conclusión operativa es que el aprendizaje pesa más que la pulitura.

## Alternativas consideradas — zona peer-to-peer gratuita

Se estudió y se descarta la opción de añadir una zona peer-to-peer gratuita (registro obligatorio, KYC, matching aleatorio 1-a-1 sin coste al cliente) como canal de tráfico orgánico paralelo. Seis motivos operativos acumulativos:

1. **Precedente Omegle / Chatroulette**: registro + KYC no resuelven moderación en tiempo real de contenido sexual no consentido ni menores usando DNI de terceros. Bajo DSA (EU) y 2257 (US) la plataforma sería responsable como productor. Requiere estructura de 20+ moderadores 24/7 y ML afinado, fuera del alcance operativo actual.
2. **Canibaliza la propuesta de valor premium**: cliente potencial piensa "¿por qué pago 8 €/min de sesión privada si hay gratis?"; modelo profesional piensa "¿esto me trata como profesional o como sala anónima?". La propuesta 1-a-1 verificada pierde su diferencial.
3. **Coste operativo negativo**: bandwidth WebRTC + STUN/TURN + moderación + infra + soporte, todo pagado por la plataforma, con cero ingresos del canal. Cuanto más tráfico, más pérdidas.
4. **Riesgo legal por gifts a personas no verificadas como modelos**: la zona P2P abriría la vía a que un cliente envíe gifts a "chicas normales, no modelos". Eso convertiría a la plataforma en operador de sex work no verificado sin contratos de talento, sin registros 2257, sin edad certificada por la plataforma. Riesgo penal, no administrativo.
5. **Reduce opciones futuras de PSP tarjeta**: un producto con broadcasting user-generated sin control estructural es alérgeno directo para el underwriting adult de cualquier PSP tarjeta candidato. Añadir P2P estropea el argumento con Vendo / CommerceGate y con futuros candidatos.
6. **Tráfico peer-to-peer no convierte a sesión de pago**: el intent de un usuario que llega buscando gratis es NO pagar. El embudo tendría entrada ancha en la zona P2P gratuita y cuello estrangulado en la transición a la zona premium. Bandwidth pagado por todo el ancho, revenue solo del cuello.

**Recuperación de las intuiciones útiles del análisis**: bajo la propuesta P2P había tres ideas correctas que se rescatan y encajan por otro camino en la estrategia adoptada:

- Necesidad de producto visible (no coming-soon) → **cubierta por el soft launch cripto** (esta decisión) más la página pública de modelo ([ADR-048](adr-048-pagina-publica-modelo-slug.md)).
- Necesidad de un tier de entrada de baja fricción → **cubierta por el freemium interno ya operativo** (chat texto siempre gratis, emojis gratis, 3 min de video/día). Detalle en [`../01-business/sistema-tiers-modelos.md`](../01-business/sistema-tiers-modelos.md) § 5.
- Necesidad de usar cripto como ventaja no como excusa → **cubierta por esta decisión**, con el segmento cripto documentado en [`../01-business/launch-strategy.md`](../01-business/launch-strategy.md) § 5.

## Notas

- **Vendo y CommerceGate** no se descartan y no se declaran vía activa. Se les considera contactos abiertos en paralelo, sin bloquear la operación. Si en un momento futuro alguno confirma condiciones aceptables, se abre un ADR sucesivo que reemplace el §PSP puente de esta decisión.
- **El banner "beta, pagos en cripto de momento, tarjeta próximamente"** es texto UI que se cambia sin nuevo ADR cuando la situación evolucione. No es parte del contrato de esta decisión.
- **Detalle contextual y estrategia operativa completa** en [`../01-business/launch-strategy.md`](../01-business/launch-strategy.md).
