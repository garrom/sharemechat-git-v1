# ADR-052 — Rediseño estructural del reparto modelo/empresa, rango de precio autoservicio, Estatus Pro y retirada del programa de afiliadas

> Estado: VIGENTE
> Fecha: 2026-07-24
> Vigencia esperada: hasta que el volumen y el mix real cripto/tarjeta permitan renegociar % PSP o hasta que un pivote de posicionamiento (premium vs mass-market) obligue a rediseñar
> Reemplaza: [ADR-043](adr-043-pricing-formalization-current-state.md) §1 (tarifa cliente `€1/min` plana), §4 (sistema de 3 tiers `5-15 / 7-20 / 9-40`). [ADR-049](adr-049-programa-afiliadas-modelos.md) queda **SUPERSEDED** en su totalidad (programa de afiliadas retirado).
> Ver también: [ADR-011](adr-011-pricing-simplification-and-minimum-threshold.md), [ADR-012](adr-012-bfpm-platform-funded-bonus.md), [ADR-047](adr-047-pivote-soft-launch-cripto-paxum.md), [ADR-048](adr-048-pagina-publica-modelo-slug.md), [ADR-051](adr-051-psp-puente-cripto-nowpayments.md), [`../01-business/sistema-tiers-modelos.md`](../01-business/sistema-tiers-modelos.md), [`../01-business/pricing.md`](../01-business/pricing.md), [`../01-business/unit-economics.md`](../01-business/unit-economics.md)

## Estado

Aceptada. Decisión estructural de reordenamiento del ciclo económico (reparto, precio, retribución). Cero implementación en esta iteración. La materialización técnica (migrations, servicios, entities, UI) se planifica en fases posteriores condicionadas al gate de apertura de ADR-047 y a la disponibilidad de PSP tarjeta viable.

## Contexto

Al cierre de este ADR conviven en el repo tres piezas de la línea económica que, tras el pivote soft launch cripto (ADR-047) y la ronda de outreach inicial de reclutamiento, dejan de ser óptimas conjuntamente:

- **Reparto por tiers `5-15 / 7-20 / 9-40`** (ADR-043 §4, tabla `model_earning_tiers`): plataforma retiene entre 60% y 85% del bruto según tier de la modelo. Para una modelo nueva empezando en tier 5-15, el ratio inicial es **15% modelo / 85% plataforma**. Frente a competencia habitual del sector (50-60% modelo), es un mensaje comercial muy débil en el outreach cuando no hay tráfico que compense con volumen.
- **Precio plano `€1/min`** (ADR-043 §1, `application.properties: billing.rate-per-minute=1.00`): sin capacidad de la modelo para modular su tarifa. Modelos con audiencia propia o marca personal no pueden capturar willingness-to-pay superior de sus clientes; una modelo generalista está en el mismo precio que una modelo con demanda propia comprobable.
- **Programa de afiliadas internas** (ADR-049, revisado 2026-07-23 con D2 ventana 12m + D4 sin salvaguarda): añade complejidad estructural (tablas `affiliate_codes`, `affiliate_commissions`, `affiliate_link_tokens`, `affiliate_click_events`, columnas `clients.referrer_model_user_id`, `users.referral_code_owner`, `users.first_stream_charge_at`, servicio `AffiliateCommissionService`) que en el escenario de reparto elevado (75-79% modelo) deja de justificarse: el % elevado ya sobre-incentiva a la modelo a traer clientes propios sin necesidad de programa adicional.

El escenario operativo del proyecto (según ADR-047) es:

1. **Sin presupuesto de publicidad**: el arranque depende de reclutamiento de modelos con audiencia propia, no de captación paga de clientes.
2. **Volumen crítico previo a renegociar PSP**: los fees efectivos actuales de PSPs adult-adjacent (~1% cripto, ~10-15% tarjeta) solo bajan cuando se demuestra volumen sostenido. Hasta entonces la palanca disponible es la propuesta de valor a la modelo, no el margen unitario.
3. **Estonia + Segpay bloqueado** (ADR-047): se está negociando activamente con nuevos PSPs de tarjeta que acepten el perfil corporativo (director no residente en Estonia). Hasta que uno cierre, el 100% del ingreso viene por NOWPayments + Paxum (ADR-051).

En ese escenario, la palanca con mayor retorno es maximizar el gancho de reclutamiento hacia modelos, aceptando margen unitario bajo hasta que el volumen justifique renegociar % PSP.

## Análisis previo

### Mapeo del código actual afectado

- **Tabla `model_earning_tiers`** en [`src/main/resources/db/migration/V1__baseline.sql`](../../src/main/resources/db/migration/V1__baseline.sql) (líneas 369-378): 3 tiers con `first_minute_earning_per_min` y `next_minutes_earning_per_min`. Fuente de verdad del sistema previo.
- **Tabla `model_tier_daily_snapshots`** en la misma migración: snapshot diario del tier vigente por modelo, con `window_start`, `window_end`, `billed_seconds`, `billed_minutes`, `tier_id`. **Reutilizable**: la infraestructura de snapshot diario y ventana rolling 30d es exactamente la que el nuevo sistema necesita para resolver el tramo (%reparto + rango de precio + Estatus Pro) de cada modelo.
- **`ModelTierService`** en [`src/main/java/com/sharemechat/service/ModelTierService.java`](../../src/main/java/com/sharemechat/service/ModelTierService.java): `WINDOW_DAYS = 30`, lógica de resolución de tier por acumulado de minutos facturados. Reescribible manteniendo la firma de resolución diaria.
- **`ModelTierSnapshotJob`** en [`src/main/java/com/sharemechat/jobs/ModelTierSnapshotJob.java`](../../src/main/java/com/sharemechat/jobs/ModelTierSnapshotJob.java): job programado. Reutilizable con cambio interno del cálculo del tramo.
- **`billing.rate-per-minute=1.00`** en `application.properties`: tarifa única. Deprecable en favor de propiedades de rango.
- **`UserTrialService`** en [`src/main/java/com/sharemechat/service/UserTrialService.java`](../../src/main/java/com/sharemechat/service/UserTrialService.java): sistema de packs con cooldown para el primer minuto trial. El campo `first_minute_earning_per_min` (vigente por tier de la modelo) alimenta hoy el pago del primer minuto. Requiere alimentarse en el nuevo régimen desde una propiedad plana (D8).
- **Programa de afiliadas completo** (ADR-049): entidades `AffiliateCode`, `AffiliateCommission`, `AffiliateClickEvent`, `AffiliateLinkToken`, servicios `AffiliateCommissionService`, `AffiliateAttributionService`, `AffiliateBonusService`, `AffiliateCodeService`, `AffiliateHashService`, `AffiliateLinkTokenService`, migrations V15 a V36 relativas a afiliadas, columnas en `users` y `clients`. Retirable en bloque (D11).

### Componentes que hay que crear o modificar

- **Nueva propiedad configurable de tramos** (`application.properties`): definición declarativa de los 4 tramos con sus umbrales, %reparto y rango de precio.
- **Nueva tabla `model_pricing_tiers`** (opcional, alternativa a properties): 4 filas con `min_billed_gross_eur_30d`, `model_share_pct`, `rate_min_eur_per_min`, `rate_max_eur_per_min`. Si se usa, sustituye a `model_earning_tiers`. Ver D5 y alternativas para el trade-off properties vs BD.
- **Extensión del snapshot diario**: `model_tier_daily_snapshots` gana columnas `billed_gross_eur_30d` (base del umbral), `pricing_tier_id`, `model_share_pct`, `rate_min`, `rate_max`, `pro_status_active` (bool derivado del umbral D6). Compatible con la lógica actual, solo añade dimensiones.
- **Nueva columna `users.chosen_rate_eur_per_min`** o similar: valor elegido por la modelo dentro del rango que su tramo le permite. Validado en backend contra `rate_min`/`rate_max` del tramo vigente.
- **Nuevo endpoint `PUT /api/models/me/pricing`**: la modelo elige su tarifa dentro del rango permitido.
- **Nuevo endpoint `PUT /api/models/me/pro-status`**: la modelo (si Pro está activo) activa/desactiva su disponibilidad para trials.
- **Frontend product panel de la modelo**: sección "Mis condiciones económicas" con estado del tramo, %reparto, rango de precio, selector de tarifa dentro del rango, toggle de Estatus Pro (visible solo si activo), historial de descuentos con evidencia (D9).
- **Retirada del programa de afiliadas**: migration V38 de drop de columnas y tablas (D11).

## Decisión

Se rediseña la línea económica de SharemeChat con las siguientes decisiones (D1..D12). Cambian conjuntamente porque una sola de ellas por separado no reordena el ciclo.

### D1 — Reparto escalonado por facturación bruta

Se sustituye el sistema de tiers `5-15 / 7-20 / 9-40` (retribución absoluta por minuto) por un sistema de **4 tramos de %reparto** determinados por la facturación bruta acumulada rolling 30d de la modelo:

| Tramo | Facturación bruta acumulada (rolling 30d) | % modelo | % empresa (bruto) |
|---|---|---:|---:|
| T1 (entrada) | 0 – 3.500 € | **75%** | 25% |
| T2 | > 3.500 € | **77%** | 23% |
| T3 | > 5.000 € | **78%** | 22% |
| T4 | > 6.500 € | **79%** | 21% |

- El tramo se recalcula en el **snapshot diario existente** (`ModelTierSnapshotJob`), sobre la **facturación bruta rolling 30d** (lo que paga el cliente en `STREAM_CHARGE`, no lo que gana la modelo). Reutiliza la infraestructura de snapshot y ventana móvil vigentes.
- El tramo **se mantiene trabajando**, se pierde al caer bajo el umbral. Simétrico como el sistema previo.
- Aplica al minuto 2 en adelante de cada sesión. El primer minuto trial tiene régimen propio (D8).
- Los umbrales viven como filas de la tabla `model_pricing_tiers` (BD, no properties). Ver D5 para la justificación.

### D2 — Rango de precio autoservicio con desbloqueos por tramo

La modelo elige su tarifa por minuto dentro de un **rango permitido por su tramo vigente**:

| Tramo | Rango de precio / min | Nota |
|---|---|---|
| T1 | **1 €/min fijo** | Sin capacidad de modulación al arrancar. |
| T2 (> 3.500 €) | 1 – 3 €/min | La modelo elige dentro del rango. |
| T3 (> 5.000 €) | 1 – 6 €/min | |
| T4 (> 6.500 €) | 1 – 9 €/min | Techo actual €9/min. |

- El techo (€9/min hoy) queda **configurable** desde `application.properties` (`billing.pricing.rate-max-eur-per-min=9.00`) para permitir ampliaciones futuras (15 €/min o más) sin migration.
- La modelo elige su tarifa con endpoint `PUT /api/models/me/pricing` y se persiste en `users.chosen_rate_eur_per_min`. Al bajar de tramo, si su tarifa elegida excede el máximo del tramo nuevo, se recorta automáticamente al máximo del tramo destino en el próximo snapshot.
- **El desbloqueo es de rango de precio, no de reparto**: los dos ejes (D1 %reparto y D2 rango de precio) comparten los mismos umbrales (€3.500, €5.000, €6.500) pero son dimensiones independientes.
- Los rangos por tramo viven como columnas de la tabla `model_pricing_tiers`. El techo global vive en properties.

### D3 — Estatus Pro: control opcional del trial

Feature única desacoplada de %reparto y de rango de precio. Se activa **al superar 1.500 € de facturación bruta acumulada rolling 30d**. Su valor operativo es un solo toggle: **la modelo con Estatus Pro decide en su panel si acepta clientes trial o no**.

- Umbral **1.500 €** vive como property configurable (`billing.pro-status.min-billed-gross-eur-30d=1500`).
- Cuando una modelo Pro **desactiva trial**, el cliente trial que entra en su tarjeta desde la home ve un CTA **"recarga para chatear con ella"**, no la modelo invisible. Exclusividad estimula conversión.
- El estado (elegible / activo) se refleja en `model_tier_daily_snapshots.pro_status_active` como bool derivado del umbral, y la elección de la modelo (aceptar trial sí/no) se persiste en `users.pro_accepts_trial` (default `true` para no romper flujo trial existente cuando Pro se active por primera vez).
- Endpoint `PUT /api/models/me/pro-status`: la modelo elige. UI del toggle **solo visible cuando Pro está elegible**.
- **Ampliaciones futuras del pack Pro** (visibilidad prioritaria en home, dashboard analytics, herramientas de gestión avanzada) quedan **diferidas** a ADRs posteriores. No forman parte del scope de este ADR.

### D4 — Método de pago del cliente: precio único, empresa absorbe diferencial

El cliente elige entre cripto y tarjeta al pagar (dependiente del PSP cerrado en cada momento; ADR-047 y ADR-051 marcan el frente en curso). **El precio mostrado al cliente es el mismo pase lo que pase**, y la modelo cobra su %reparto sobre ese precio pase lo que pase.

- La empresa cobra su %reparto bruto sobre facturación y **absorbe el 100% del diferencial de fees PSP entre cripto y tarjeta**. El diferencial es margen operativo puro de la empresa como compensación por el riesgo operativo (chargebacks tarjeta, mantenimiento de dos rails de pago, reconciliación).
- **No hay comunicación al cliente ni a la modelo sobre este diferencial**. Ni "descuento por pagar en cripto" ni "recargo por tarjeta". Precio único hacia ambos lados.
- Márgenes netos aproximados por método (asumiendo 20-25% bruto empresa y fees actuales):
  - **Cripto** (fees ~1%): 19-24% neto sobre facturación según tramo.
  - **Tarjeta** (fees ~10-15%): 5-15% neto sobre facturación según tramo (delgado, sensible a chargebacks).
  - **Mix realista arranque (50/50 cripto/tarjeta)**: 12-19% neto sobre facturación según tramo.

Los márgenes por tramo son **suficientes para operar en soft launch** (ADR-047) y **dependen críticamente de dos palancas futuras**: (a) mix real que se estabilice con más peso cripto que 50/50, (b) renegociación de fees PSP tarjeta cuando el volumen lo justifique.

### D5 — Ubicación de las condiciones económicas: BD, no properties

Los umbrales de tramo (0/3.500/5.000/6.500), los %reparto por tramo (75/77/78/79) y los rangos de precio por tramo (1, 1-3, 1-6, 1-9) viven como **filas de una nueva tabla `model_pricing_tiers`**, no como properties.

- Trade-off decidido: las properties simplifican deploys pero **no permiten auditoría histórica** de qué condiciones económicas estuvieron vigentes en qué fecha. Al ser condiciones económicas que la modelo puede citar comercialmente ("cuando me reclutaron me prometieron 77% al superar 3.500 €"), necesitan un histórico consultable en BD.
- La tabla `model_pricing_tiers` tiene versionado por `effective_from` / `effective_to` para permitir cambios auditables. Las condiciones vigentes son las filas con `effective_to IS NULL`.
- El **techo global de precio** (€9/min hoy) y el **umbral Estatus Pro** (€1.500/mes) sí viven en `application.properties` como parámetros de sistema, no como condiciones económicas versionadas.

### D6 — Base del umbral: facturación bruta cliente, rolling 30d

Todos los umbrales de tramo (D1) y de Estatus Pro (D3) se calculan sobre la **facturación bruta que paga el cliente** por minutos consumidos con la modelo (columna equivalente a la suma de `STREAM_CHARGE` en `Transaction` del cliente atribuida a la modelo), no sobre lo que gana la modelo tras reparto.

- **Ventana rolling 30d con snapshot diario**: mismo mecanismo que el sistema vigente. `ModelTierSnapshotJob` calcula el acumulado y lo escribe en `model_tier_daily_snapshots.billed_gross_eur_30d`.
- **Primer minuto trial cuenta hacia el umbral** aunque el cliente no pague (lo asume la empresa). Es facturación real generada por la modelo, aunque la empresa absorba el coste. Sin esto, una modelo con muchos trials pero pocas sesiones "queda anclada" en T1.
- Los gifts **NO cuentan** hacia los umbrales de este ADR: en el momento de ADR-052 tenían reparto propio fijo (ADR-043 §5, 90/10), que este rediseño no tocó. *(Posteriormente [ADR-056](adr-056-sistema-master-studio.md) revisión 2026-08-01 cambió los gifts a **reparto por tramo** — ver ADR-043 §5, superseded.)*

### D7 — Responsabilidad económica de la modelo

Se formalizan tres categorías de costes con reparto de responsabilidad distinto:

**Costes operativos estándar** (absorbidos por el %empresa bruto):
- Fees PSP (variable + fijo por transacción, tarjeta o cripto).
- Reserve / rolling reserve del PSP (si aplica).
- Coste técnico variable (bandwidth WebRTC, STUN/TURN, AWS por minuto streamed).
- Coste de moderación proactiva sobre esa modelo (Sightengine mensual, monitoring).

**Descuentos del payout siguiente de la modelo** (por eventos específicos atribuibles a esa modelo):
- **Chargeback** del cliente sobre una sesión específica con esa modelo.
- **Refund** aprobado por queja específica del cliente sobre esa modelo (contenido no acordado, cancelación unilateral por la modelo, etc.).
- **Sanciones PSP** por incumplimiento claro y documentado de la modelo (ejemplo: contenido en la sesión que dispara alerta PSP y multa).

El descuento se aplica sobre el **payout siguiente**, con el motivo, fecha, importe y evidencia asociada visibles en el panel de la modelo (D9). Saldo negativo del mes **se arrastra a meses futuros** hasta compensar. **Umbral de suspensión temporal**: si los chargebacks atribuidos a una modelo superan el **~5% de su facturación bruta mensual**, se suspende temporalmente pendiente de revisión. La cifra concreta (umbral exacto, ventana de cálculo, política de reactivación) se materializa en **T&C y contrato de modelo**, fuera del scope de este ADR.

**No entran en esta política** (se tratan por vía moderación, no descuento automático):
- Errores técnicos (equipamiento defectuoso, conexión inestable, pérdidas de sesión no imputables a la modelo).
- No-shows (modelo no aparece en sesión programada). Warnings escalados y, si reincidencia, suspensión temporal, pero **no descuento automático de payout**.
- Sanciones administrativas (avisos, warnings) que no involucran evento económico atribuido.

### D8 — Primer minuto trial: €0,07/min plano

El primer minuto trial (cliente entra a probar bajo el sistema de packs con cooldown existente en `UserTrialService`) se **paga a la modelo a €0,07/min plano**, independientemente del tramo de la modelo o de su tarifa autoservicio elegida.

- Valor alineado con el `first_minute_earning_per_min` del tier medio actual (`7-20`), no un cambio de expectativas para la modelo.
- **Se avisa transparentemente a la modelo antes del arranque de la sesión** (UI de trial explícita en su panel: "sesión trial, primer minuto €0,07").
- Vive como property configurable: `billing.trial.first-minute-earning-eur-per-min=0.07`.
- **Modelos con Estatus Pro pueden desactivar el trial** (D3) si prefieren no aceptar clientes trial a ese precio bajo. Es el mecanismo que resuelve la asimetría entre modelos T1 (aceptan trial de buen grado) y modelos T4 Pro (pueden preferir centrarse en clientes de pago).

### D9 — Transparencia en el panel de la modelo

El panel de la modelo (`/model` frontend product) muestra:
- **Tramo actual** con umbral vigente y siguiente.
- **%reparto** aplicable.
- **Rango de precio** permitido y **tarifa elegida** dentro del rango.
- **Estatus Pro**: elegible / activo / no elegible, con toggle de aceptación de trial cuando Pro es elegible.
- **Historial de descuentos** aplicados a payouts, con motivo, fecha, importe y **evidencia asociada** (link a la sesión, chargeback notification del PSP, decisión de moderación).
- **Derecho a disputa**: cada descuento con botón "reclamar", que dispara un ticket interno gestionado por el equipo de soporte con SLA definido (fuera del scope de este ADR).

La transparencia total es requisito de la política de descuentos (D7). Sin panel navegable, un descuento sin explicación destruye la confianza que el %reparto elevado pretende construir.

### D10 — Comunicación al cliente: precio mostrado antes de la sesión

Cada tarjeta de modelo en la home y en la vista de perfil (`/m/:slug`, ADR-048) muestra **claramente el precio por minuto** que ha elegido la modelo. Sin precio visible, el cliente entra a sesión sin saber el ritmo de consumo, lo que genera fricción de conversión y disputas.

- Precio mostrado en formato "**X €/min**" con notación clara.
- Cuando la modelo modifica su tarifa dentro del rango, el cambio es **efectivo inmediatamente** (no diferido a snapshot). El cliente que inicia sesión después del cambio ve el precio nuevo.
- La UX específica (colocación del precio en la tarjeta, tipografía, disclaimers) queda fuera del scope del ADR.

### D11 — Retirada completa del programa de afiliadas (ADR-049 SUPERSEDED)

El programa de afiliadas internas queda **eliminado por completo**. El %reparto elevado (75-79% modelo) ya sobre-incentiva a la modelo a traer clientes propios sin necesidad de programa adicional. Mantener afiliadas junto al reparto nuevo diluye el mensaje comercial y añade complejidad estructural (tracking, atribución, reversos, cierres mensuales) que en pre-launch no se justifica.

- **ADR-049 se marca SUPERSEDED por ADR-052** en su cabecera (histórico auditable, no se borra el fichero).
- **Retirada limpia de código y schema** (opción 1 evaluada explícitamente contra dejar código muerto):
  - **Migration V38**: drop de tablas `affiliate_codes`, `affiliate_commissions`, `affiliate_click_events`, `affiliate_link_tokens`, y drop de columnas `clients.referrer_model_user_id`, `users.referral_code_owner`, `users.first_stream_charge_at`.
  - **Purga de código**: eliminación de `AffiliateCommissionService`, `AffiliateAttributionService`, `AffiliateBonusService`, `AffiliateCodeService`, `AffiliateHashService`, `AffiliateLinkTokenService`, entidades correspondientes, endpoints REST, componentes frontend, tests unitarios asociados.
  - **Documentación**: `affiliate-program.md` se mueve a `_deprecated/registro.md` con nota. Referencias en `roles-and-flows.md`, `plan-captacion-trafico-2026-q3.md` § P3, `launch-strategy.md` § afiliación se retiran o se marcan superseded.
- **Sin usuarios afectados en producción**: el programa nunca llegó a PROD, solo TEST. No hay comunicación externa que gestionar.
- **Afiliación externa B2B** (blogs, agencias, estudios): **descartada también**. No hay nada implementado y no se implementará. Si en el futuro una entidad externa negocia condiciones B2B, se hace **caso por caso fuera del programa estándar**, con acuerdo bilateral y contabilidad manual, no como programa de plataforma.

### D12 — Retirada del sistema de tiers `5-15 / 7-20 / 9-40`

El sistema de tiers previo (ADR-043 §4) queda superseded por D1+D2 de este ADR.

- **Migration V38** (misma que D11) elimina las filas de `model_earning_tiers` y crea `model_pricing_tiers` (D5) con las nuevas condiciones vigentes.
- **`ModelTierService` y `ModelTierSnapshotJob`** se refactorizan para operar sobre `model_pricing_tiers` y sobre facturación bruta rolling 30d (D6) en vez de sobre minutos facturados. La firma del snapshot (una fila por modelo por día en `model_tier_daily_snapshots`) se mantiene con columnas nuevas.
- **`billing.rate-per-minute=1.00`** en `application.properties` deja de tener sentido como valor único: se sustituye por `users.chosen_rate_eur_per_min` (persistido por modelo) leído por el motor de facturación al arranque de sesión.
- **Tabla `model_earning_tiers`** se conserva como registro histórico auditable si contiene filas históricas de snapshots referenciados, o se elimina en la misma V38 si no hay referencias. Decisión concreta se toma al escribir V38 (fuera del scope de este ADR).

## Consecuencias

### Positivas

- **Reclutamiento de modelos**: 75% modelo desde el minuto 1 cierra la objeción principal del outreach en primera frase (competencia habitual del sector 50-60%). El escalado a 79% en tramo alto mantiene motivación por escalar sin canibalizar el gancho de entrada.
- **Modelos con marca propia** capturan willingness-to-pay superior de sus clientes con rango 1-9 €/min. La palanca de captura de valor deja de estar en manos exclusivas de la plataforma.
- **Simplicidad estructural** tras retirar afiliadas: un solo mecanismo económico (reparto + rango de precio + Estatus Pro) sustituye tres (tiers previos + reparto + programa de afiliadas). Menor superficie de bug, menor deuda técnica, mayor coherencia narrativa.
- **Auditoría histórica de condiciones económicas**: la tabla `model_pricing_tiers` con versionado por `effective_from`/`effective_to` permite responder sin ambigüedad "¿qué condiciones aplicaban a esta modelo el 15 de marzo?".
- **Alineamiento con soft launch cripto** (ADR-047): margen neto aceptable con mix cripto elevado, sin depender de cerrar PSP tarjeta antes de arrancar.

### Negativas

- **Margen empresa delgado**, especialmente en tarjeta (5-15% neto según tramo). Sensible a chargebacks y refunds. El negocio depende de **volumen y mix cripto favorable** para acumular resultado positivo. El ADR asume esta apuesta explícitamente: el volumen se prioriza sobre el margen unitario.
- **Rango 1-9 €/min genera fricción con packs de recarga vigentes (10/20/40 €)**: un pack de 10 € dura ~1 minuto con modelo top a €9/min, lo que puede desincentivar la compra. Rediseño de packs premium queda como **frente separado** (deuda declarada, no scope de este ADR).
- **Riesgo reputacional del rango de precio visible**: un cliente que entra a una modelo T4 a €9/min sin leer el precio puede sentirse "engañado". Compensado por D10 (precio visible en tarjeta y perfil) pero requiere UX cuidadosa.
- **Retirada del programa de afiliadas es visible en el outreach**: modelos ya contactadas a las que se mencionó el programa reciben ahora una propuesta distinta. Comunicación explícita del cambio requerida (asumida en el outreach post-ADR, no scope técnico).
- **Chargeback threshold en T&C**: la política de descuento por chargebacks/refunds es sensible legalmente. T&C y contrato de modelo deben materializarse cuidadosamente (frente legal/compliance separado).

### Neutrales

- El invariante contable del ledger (Σ CHARGE + Σ EARNING + Σ MARGIN = 0 por sesión) se preserva. Solo cambian los ratios.
- Los packs BFPM (ADR-012) siguen aplicando sin cambio: bonus de minutos servidos independiente del %reparto.
- El sistema de gifts (ADR-043 §5, 90/10) no se toca en este ADR. *(Cambiado después por [ADR-056](adr-056-sistema-master-studio.md) revisión 2026-08-01: reparto por tramo, no 90/10 fijo.)*

## Alternativas consideradas

### A. Reparto plano 80/20 sin tramos

**Rechazada.**

Propuesta inicial del operador. Ventaja: mensaje simplísimo ("80% siempre, sin condiciones"). Desventajas acumulativas que la hicieron perder frente al escalado 75-79:

1. **Elimina el gancho de progresión**: la modelo no ve premio por escalar su facturación, solo por trabajar más horas al mismo ritmo. El sistema de tiers previo (aunque con ratios peores) sí tenía ese gancho psicológico.
2. **Margen empresa insuficiente en tramo inicial** (20% bruto - 13% fees tarjeta = 7% neto): un chargeback dispara pérdida operativa. En el tramo escalado, T1 con 25% bruto - 13% fees = 12% neto, con colchón razonable.
3. **Desperdicia el andamio mental de los 3 tiers**: la comunicación al cliente y a la modelo ya asume que "hay progresión". Un plano 80/20 borra un elemento ya establecido y trabajado.

Se recupera lo bueno del plano 80/20 (mensaje simple hacia arriba) manteniendo un **top de 79%** que en la práctica es "80% redondo" desde el punto de vista de la modelo top.

### B. Mantener sistema de tiers previo `5-15 / 7-20 / 9-40`

**Rechazada.**

La retribución absoluta por minuto (€0,05 / €0,07 / €0,09 primer minuto; €0,15 / €0,20 / €0,40 siguientes) equivale a un reparto **15% / 20% / 40% modelo**. Para reclutamiento en 2026 es ratio comercial muy débil frente a competencia habitual del sector. El operador confirma en el contexto que el bloqueo real de captación de modelos es el ratio, no la ejecución. Mantener el sistema previo implica no resolver ese bloqueo y volver al escenario del ADR-047 (drenaje sin aprendizaje).

### C. Precio único plano €1/min (sin rango autoservicio)

**Rechazada.**

Simplifica la UX del cliente y evita la fricción de packs premium (consecuencia negativa listada). Pero desperdicia la palanca de captura de valor de modelos con marca propia, que en el escenario de reclutamiento pre-launch son precisamente las modelos con audiencia propia (5-30k followers según ADR-049 §7). La modelo con audiencia externa quiere capturar el premium de sus clientes propios, no compartirlo con la plataforma vía precio plano.

### D. Mantener programa de afiliadas al lado del reparto nuevo

**Rechazada.**

Con reparto 75-79% modelo, el programa de afiliadas paga 30% adicional del cliente traído. El compuesto "modelo referidora al 30% + modelo receptora al 75-79%" hace que el total pagado supere el 100% del bruto empresa en algunos escenarios (revshare pagado sobre bruto cliente, no sobre bruto empresa). Se puede rediseñar la mecánica de reparto de la comisión de afiliación, pero añade complejidad de cálculo y auditoría sin justificación operativa: el %elevado ya cumple la función que las afiliadas pretendían cumplir.

### E. Dejar código de afiliadas muerto (feature flag off) en lugar de purgarlo

**Rechazada** (opción 2 del análisis).

Ahorra el esfuerzo de la migration V38 y de la purga de servicios/tests. Pero mantiene ~2.500 líneas de código muerto en el repo, tablas vacías en BD, entities cargadas por Hibernate, tests que corren y aumentan tiempo de CI. En un proyecto pre-launch sin usuarios afectados, la ventaja de la limpieza total (Opción 1) es clara y consistente con la política de "no perpetuar deuda estructural".

### F. Condiciones económicas en properties (no en BD)

**Rechazada** (evaluada en D5).

Properties simplifican deploys y quitan una tabla. Pero pierden auditoría histórica: no se puede responder "¿qué condiciones económicas estuvieron vigentes en fecha X?" mirando la BD. En condiciones económicas que la modelo cita comercialmente y sobre las que puede haber disputa, el histórico auditable pesa más que la simplicidad de deploy.

## Impacto

### Impacto en documentación

Ficheros business que quedan superseded o requieren reescritura en Fase B posterior al ADR:

- **`sistema-tiers-modelos.md`**: reescritura completa. Los 3 tiers desaparecen. Se sustituye por sistema de 4 tramos + rango de precio + Estatus Pro.
- **`pricing.md`**: reescritura. Precio deja de ser plano €1/min.
- **`unit-economics.md`**: reescritura. Reparto se cierra por primera vez (75/77/78/79). Fees PSP se aproximan con NOWPayments (~1%) y tarjeta (~10-15%) como aproximaciones vigentes de ADR-051 y del frente de negociación PSP tarjeta abierto.
- **`affiliate-program.md`**: **DEPRECATED**. Mover a `docs/_archive/_deprecated/` con nota y referencia a ADR-052.
- **`business-model.md`**: actualización de la sección de reparto y de la retirada del programa de afiliadas.
- **`launch-strategy.md`**: actualización de la sección afiliación (§4).
- **`model-profile-strategy.md`**: retirada de la sección de afiliación como palanca. La página `/m/:slug` sigue siendo palanca central por ADR-048; solo se retira la lectura como "link de afiliación implícito".
- **`financiero/modelo-financiero.md` + xlsx**: recalcular con reparto 75-79% y mix cripto/tarjeta actualizado. Ajuste completo del horizonte de break-even.
- **`docs/_archive/07-roadmap/plan-captacion-trafico-2026-q3.md`** § P3: la palanca "programa de afiliados propio" queda eliminada. Sustituir por "reclutamiento directo con propuesta 75-79%".
- **`../07-roadmap/current-phase.md`**: añadir frente "materialización ADR-052" en la fase vigente.
- **`../04-operations/riesgos-operacionales.md`**: añadir riesgo "margen tarjeta delgado, sensible a chargebacks" con mitigación (mix cripto favorable + renegociación PSP a volumen).

### Impacto en código

Cambios técnicos (fuera del scope de este ADR pero enumerados como consecuencia directa):

**Backend**:
- Migration `V38__drop_affiliate_program.sql`: drop tablas y columnas afiliadas.
- Migration `V39__model_pricing_tiers_v1.sql`: crea `model_pricing_tiers` con las 4 filas (T1/T2/T3/T4), añade columnas al snapshot diario, añade `users.chosen_rate_eur_per_min` y `users.pro_accepts_trial`.
- Purga: `AffiliateCommissionService`, `AffiliateAttributionService`, `AffiliateBonusService`, `AffiliateCodeService`, `AffiliateHashService`, `AffiliateLinkTokenService`, entities correspondientes, controllers, tests, DTOs.
- Refactor: `ModelTierService` y `ModelTierSnapshotJob` a operar sobre facturación bruta rolling 30d y sobre `model_pricing_tiers`.
- Nuevo `PricingService`: expone tramo, %reparto, rango, tarifa vigente por modelo.
- Nuevos endpoints: `PUT /api/models/me/pricing`, `PUT /api/models/me/pro-status`.
- Nuevos endpoints: `GET /api/models/me/economics` (dashboard modelo con tramo, tarifa, Pro, historial descuentos).
- Refactor motor de facturación: leer `users.chosen_rate_eur_per_min` al arranque de sesión en vez de `billing.rate-per-minute`.
- Refactor `UserTrialService`: primer minuto trial paga €0,07 plano de property.
- Deprecar `application.properties: billing.rate-per-minute`. Nueva property `billing.pricing.rate-max-eur-per-min=9.00`, `billing.pro-status.min-billed-gross-eur-30d=1500`, `billing.trial.first-minute-earning-eur-per-min=0.07`.

**Frontend product**:
- Nuevo panel modelo `/model/economics` (o sección dentro del panel existente) con dashboard de tramo, %reparto, rango, selector de tarifa, toggle Pro, historial descuentos con evidencia y reclamación.
- Tarjeta de modelo en home y `/m/:slug`: precio visible por minuto.
- Retirada de UI de afiliadas (`/model/affiliate`, landing `/i/:token`, banner referral en registro cliente).

**Frontend admin**:
- Nuevo panel admin de descuentos: gestión de reclamaciones de modelos sobre descuentos aplicados.
- Retirada del panel admin de afiliaciones (si existe).

### Impacto en compliance

- **Chargeback threshold ~5%**: la materialización concreta (umbral exacto, ventana, política) se hace en T&C y contrato de modelo, revisada por asesoría legal antes de exponer a modelos.
- **Descuentos automáticos de payout**: la política de deducción debe estar cubierta en T&C con opt-in explícito de la modelo al firmar. Sin ese consentimiento formal, un descuento aplicado sin autorización previa es disputable.
- **Transparencia en el panel de la modelo** (D9): es requisito no solo comercial sino legal (GDPR / derecho de acceso a decisiones automatizadas del art. 22 GDPR si el descuento es automatizado). La UI del historial no es opcional.

### Impacto en modelo financiero

- Reparto 75-79% (ADR-052) sustituye reparto 15-40% (ADR-043 §4) en los cálculos.
- Fees PSP se aproximan con NOWPayments 1% cripto + fees tarjeta 10-15% cuando esté cerrado.
- Horizonte de break-even se recalcula. Es probable que se aleje significativamente respecto al modelo previo (margen unitario delgado); el ADR asume esta consecuencia como coste del reclutamiento agresivo.
- El **modelo financiero pasa a ser función del volumen y del mix cripto/tarjeta**, más que del reparto (que queda fijo). La sensibilidad principal del negocio se traslada del %reparto a esos dos ejes.

### Impacto en riesgo operacional

- **Nuevo riesgo alto**: margen tarjeta delgado, sensible a chargebacks. Mitigación: mix cripto favorable + renegociación PSP a volumen.
- **Nuevo riesgo medio**: modelo T4 con tarifa €9/min y pack cliente de €10 genera fricción de conversión. Mitigación: rediseño de packs premium (frente separado).
- **Riesgo eliminado**: complejidad y auditoría del programa de afiliadas (tracking, atribución, reversos, cierres mensuales).
- **Riesgo eliminado**: disputas de afiliadas sobre atribución y comisiones no cobradas.

## ADRs relacionadas

- **ADR-011**: catálogo `10 / 20 / 40` y umbral mínimo de recarga. Se mantiene vigente en cuanto a packs; la fricción con el rango de precio 1-9 €/min queda declarada como consecuencia negativa a resolver en frente separado.
- **ADR-012**: BFPM / Bonus Financiado por la Plataforma en Minutos. Se mantiene vigente sin cambio.
- **ADR-028**: clasificación adult/streaming. Sin impacto.
- **ADR-043**: formalización del estado de pricing. **§1 (tarifa `€1/min` plana) y §4 (tiers `5-15 / 7-20 / 9-40`) quedan superseded** por este ADR. §2 (umbral corte), §3 (packs `10/20/40`) y §5 (reparto de gifts) se mantienen vigentes.
- **ADR-047**: pivote soft launch cripto + Paxum. Este ADR es coherente con la fase soft launch declarada allí.
- **ADR-048**: página `/m/:slug`. Se mantiene vigente; en este ADR se retira solo su lectura como "link de afiliación implícito".
- **ADR-049**: programa de afiliadas de modelos. **SUPERSEDED en su totalidad**. El fichero se mantiene con cabecera actualizada a SUPERSEDED por ADR-052 y remisión a este documento.
- **ADR-051**: PSP puente cripto (NOWPayments). Sin cambio; este ADR usa los ratios de fees declarados allí como base del margen calculado en D4.
