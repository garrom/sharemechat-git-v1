# Programa de afiliados

> Estado: **RETIRADO** por [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) (2026-07-24).
> Ver también: [sistema-tiers-modelos.md](sistema-tiers-modelos.md) (reparto escalonado 75-79% modelo que sustituye la función incentivadora del programa).

> ⚠️ CONTENIDO RETIRADO
> Contenido histórico movido a: [_deprecated/registro.md §"[affiliate-program.md] §'Programa de afiliados'"](../_deprecated/registro.md).
> Motivo: [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D11.
> Fecha retirada: 2026-07-24

## Motivo del retiro

El programa de afiliadas internas (30% revshare por cliente atribuido a la modelo referidora) queda eliminado por completo. El nuevo reparto escalonado 75-79% modelo introducido por ADR-052 sobre-incentiva a la modelo a traer clientes propios sin necesidad de programa adicional. Mantener afiliadas junto al reparto nuevo dilye el mensaje comercial (75% modelo + 30% adicional referral supera el 100% del bruto empresa en algunos escenarios) y añade complejidad estructural (tracking, atribución, reversos, cierres mensuales) que en pre-launch no se justifica.

La afiliación externa B2B (blogs, agencias, estudios) también queda descartada como programa estándar. Si en el futuro una entidad externa negocia condiciones B2B, se hace **caso por caso fuera del programa estándar**, con acuerdo bilateral y contabilidad manual, no como programa de plataforma.

## Consecuencias documentales y técnicas

- **Código y schema**: retirada limpieza total en frente técnico posterior. Migration V38 dropea tablas `affiliate_codes`, `affiliate_commissions`, `affiliate_click_events`, `affiliate_link_tokens` y columnas `clients.referrer_model_user_id`, `users.referral_code_owner`, `users.first_stream_charge_at`. Se purgan servicios (`AffiliateCommissionService`, `AffiliateAttributionService`, `AffiliateBonusService`, `AffiliateCodeService`, `AffiliateHashService`, `AffiliateLinkTokenService`), entidades, controllers, tests, componentes frontend (`/model/affiliate`, landing `/i/:token`, banner referral en registro cliente).
- **Documentos business**: `launch-strategy.md`, `model-profile-strategy.md`, `plan-captacion-trafico-2026-q3.md §P3`, `business-model.md` se actualizan retirando referencias al programa. Las URLs de perfil `/m/:slug` siguen siendo palanca central por ADR-048, solo se retira su lectura como "link de afiliación implícito".
- **Deudas conocidas**: las 6 deudas del ADR-049 (`#D-18` a `#D-23`) registradas en `../04-operations/known-debt.md` quedan canceladas por retiro del programa (no por resolución).
- **ADR-049**: marcado SUPERSEDED en su cabecera (histórico auditable, no se borra).

## Referencia canónica del nuevo mensaje al reclutamiento

La propuesta al outreach de reclutamiento de modelos deja de ser "30% revshare lifetime por cliente traído" y pasa a ser:

- **75% del bruto** desde el minuto 1 sin condiciones (vs 50-60% competencia).
- **77% al superar 3.500 €/mes**, **78% al superar 5.000 €/mes**, **79% al superar 6.500 €/mes** (facturación bruta rolling 30d).
- **Rango de precio autoservicio**: 1 €/min en T0; 1-3 €/min al superar 3.500 €; 1-6 €/min al superar 5.000 €; 1-9 €/min al superar 6.500 €.
- **Estatus Pro** al superar 1.500 €/mes: control opcional del trial (la modelo decide si acepta clientes trial o no).

Detalle completo en [sistema-tiers-modelos.md](sistema-tiers-modelos.md) tras su reescritura por ADR-052.
