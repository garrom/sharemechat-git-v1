# Registro de contenido documental retirado

> Estado: VIGENTE
> Fecha: 2026-07-09
> Vigencia esperada: indefinida
> Reemplaza: N/A
> Ver también: `documentation-governance.md` § "Patrón de deprecados centralizados"

## Propósito

Registro histórico de contenido documental retirado. Preserva el rastro de decisiones y contenido superseded sin contaminar la lectura de los ficheros vigentes.

## Cómo usar este registro

Cuando se retira una sección de un fichero vigente, el contenido histórico se mueve aquí bajo un heading con el formato:

```
## [fichero-origen.md] §"nombre sección"

> Retirado: YYYY-MM-DD
> Motivo: [ADR de referencia u otra razón]
> Origen exacto: docs/ruta/al/fichero.md § "nombre sección exacto"

[contenido íntegro retirado, sin modificación]
```

En el fichero de origen queda solo un bloque de referencia con el formato canónico documentado en `documentation-governance.md`:

```
> ⚠️ SECCIÓN RETIRADA
> Contenido histórico movido a: _deprecated/registro.md §"[nombre sección]"
> Motivo: [ADR de referencia u otra razón]
> Fecha retirada: [YYYY-MM-DD]
```

Este registro no se edita retroactivamente: las entradas pasadas no se reescriben ni se borran. Si una decisión que motivó una retirada se revierte, se añade una entrada nueva que documenta el retorno.

Orden de las entradas: cronológico inverso estricto (más reciente arriba, justo después de este bloque de introducción).

## Entradas

## [affiliate-program.md] §"Programa de afiliados" (fichero íntegro)

> Retirado: 2026-07-24
> Motivo: [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D11 retira el programa de afiliadas en su totalidad. El reparto escalonado 75-79% modelo del nuevo régimen sobre-incentiva a la modelo a traer clientes propios sin necesidad de programa adicional, y mantener afiliadas junto al reparto nuevo dilye el mensaje comercial y añade complejidad estructural (tracking, atribución, reversos, cierres mensuales) que en pre-launch no se justifica. Retirada limpieza total incluyendo código y schema en frente técnico posterior (V38 drop + purga servicios/entidades/endpoints/UI).
> Origen exacto: docs/01-business/affiliate-program.md (fichero completo, versión vigente al 2026-07-24 con cabecera "Fecha: 2026-07-09")

# Programa de afiliados

> Estado: VIGENTE
> Fecha: 2026-07-09
> Vigencia esperada: indefinida
> Reemplaza: N/A (documento nuevo)
> Ver también: [ADR-048](../06-decisions/adr-048-pagina-publica-modelo-slug.md), [model-profile-strategy.md](model-profile-strategy.md), [launch-strategy.md](launch-strategy.md), [../07-roadmap/plan-captacion-trafico-2026-q3.md](../07-roadmap/plan-captacion-trafico-2026-q3.md) § P3

## 1. Estado

**En desarrollo, no lanzado en producción.** La palanca P3 del plan de captación Q3 2026 propone construir un programa de afiliados propio (revshare, no PPS por falta de LTV medido pre-launch). Este documento formaliza el diseño del programa a nivel de página de negocio estable, separado de la ejecución operativa del plan Q3.

El diseño técnico (tracking, tabla `affiliates`, dashboard, cálculo de revshare mensual, flujo de payout) está pendiente. Contexto y estimación de esfuerzo en [`../07-roadmap/plan-captacion-trafico-2026-q3.md`](../07-roadmap/plan-captacion-trafico-2026-q3.md) § P3.

## 2. Tier único: 30 % revshare lifetime

**Un solo tier de afiliación**, sin variantes:

- **30 % revshare lifetime** de lo que factura cada cliente traído por afiliación.
- Lifetime: la comisión se paga sobre todas las compras futuras del cliente atribuido, sin fecha de caducidad, mientras el cliente permanezca activo.
- Aplica por igual a **modelos afiliadas** (que promocionan su propia URL de perfil) y a **entidades externas** (blogs, empresas, agencias, estudios) que se registren en el programa.

No hay tiers especiales por volumen, antigüedad, categoría de afiliado ni ningún otro criterio. Un solo programa, una sola tasa.

Los términos comerciales específicos con entidades B2B concretas (por ejemplo, un estudio con 15 modelos que negocia condiciones económicas adicionales por volumen o exclusividad) se acuerdan caso por caso fuera del programa de afiliación estándar y no forman parte de este documento.

## 3. Elegibilidad

- **Modelos**: cualquier modelo con KYC APPROVED en la plataforma es elegible automáticamente. Su URL de perfil (`sharemechat.com/m/:slug` según [model-profile-strategy.md](model-profile-strategy.md)) es su link de afiliación con `ref=` implícito apuntando a sí misma.
- **Entidades externas** (empresas, agencias, estudios, blogs afiliados): onboarding manual por parte del operador. Requiere revisión mínima de la entidad, aceptación de terms, y creación de un `affiliate_id` con URL personalizada.

Ambos tipos de afiliado se procesan por el mismo pipeline técnico y cobran a la misma tasa (30 %).

## 4. Terms

Reglas de deducción y anti-fraude aplicables a todo `affiliate_id`:

- **Refunds** al cliente atribuido → se descuentan de la base de cálculo de la comisión del afiliado en el mes en que ocurren.
- **Chargebacks** al cliente atribuido → se descuentan de la base de cálculo. Si el saldo del afiliado queda negativo en el mes, arrastra a meses siguientes hasta compensar.
- **Cooldown antifraude**: si en la vida de un `affiliate_id` la tasa de chargeback sobre transacciones atribuidas supera un umbral configurable (referencia inicial: 3 % sostenido durante 3 meses), el `affiliate_id` se suspende de nuevos payouts hasta revisión manual.
- **Duplicidad**: un mismo cliente no puede tener varios `affiliate_id` atribuidos. Vale el último click con `ref=` dentro de la ventana de cookie (90 días) antes de la primera compra.

## 5. Payout

- **Método**: Wise.
- **Divisa**: EUR o USD según preferencia del afiliado, sujeto a disponibilidad de Wise en su país.
- **Mínimo**: 50 USD acumulados. Si el saldo del mes está por debajo, se acumula al mes siguiente hasta cruzar el umbral.
- **Cadencia**: mensual. Payout de cada mes calendario se procesa en la primera semana del mes siguiente.
- **Documentación fiscal**: el afiliado es responsable de declarar la comisión percibida según la legislación de su jurisdicción. La plataforma emite el detalle mensual de comisiones pero no retiene impuestos por el afiliado.

## 6. Sinergia con la página de modelo

El link de afiliación **ES la URL del perfil**. No hay dos URLs. La sinergia técnica y de producto:

- Una modelo comparte `https://sharemechat.com/m/lucia?ref=lucia` en X → todos los visitantes le quedan trackeados a ella misma.
- Un estudio comparte `https://sharemechat.com/m/lucia?ref=studioX` en una landing propia → todos los visitantes de ese link específico quedan trackeados al estudio (aunque la sesión termine en compra de la modelo Lucía, la comisión se paga al `studioX`, no a Lucía).
- Sin `?ref=`, autoafiliación implícita a la propia modelo del perfil visitado.

Cookie de tracking en el navegador visitante persistente 90 días desde el último click con `ref=`. Detalle en [model-profile-strategy.md](model-profile-strategy.md) § 4.

## 7. Táctica de outreach

Las modelos con audiencia propia en X, Telegram o Reddit del orden de 5.000-30.000 followers tienen el mayor potencial de tracción como afiliadas. Ese perfil valora acceso temprano a plataformas nuevas donde puede capturar long-tail SEO de su propio nombre.

Por eso, el operador dedica esfuerzo prioritario a identificar 3-5 modelos con esas características y contactarlas en la primera oleada de reclutamiento. Reciben las mismas condiciones que cualquier otra afiliada: 30 % revshare lifetime, la misma URL de perfil, los mismos assets sociales, el mismo payout.

## 8. Referencias

- [ADR-048 — Página pública de modelo `/m/:slug` como palanca central](../06-decisions/adr-048-pagina-publica-modelo-slug.md) — pieza técnica que integra el link de afiliación en la URL del perfil.
- [model-profile-strategy.md](model-profile-strategy.md) — detalle de la superficie de producto y del tracking.
- [launch-strategy.md](launch-strategy.md) § 4 — encaje del programa con la estrategia de soft launch cripto.
- [`../07-roadmap/plan-captacion-trafico-2026-q3.md`](../07-roadmap/plan-captacion-trafico-2026-q3.md) § P3 — diseño operativo del programa como palanca de captación.
