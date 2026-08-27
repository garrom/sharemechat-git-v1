# Sistema de tramos y economía de modelos — SharemeChat

> **Documento operativo.** Explica el sistema de retribución de modelos verificadas: reparto escalonado por facturación, rango de precio autoservicio, Estatus Pro y primer minuto trial.
>
> Versión 2.1 — 2026-08-04 (actualización por [ADR-056 §D3](../06-decisions/adr-056-sistema-master-studio.md) que sobrescribió los umbrales y porcentajes de ADR-052). Versión 2.0 del 2026-07-24 con `75-79%` y umbrales `3.500/5.000/6.500` queda superseded. Versión 1.0 del 17 jun 2026 con 3 tiers `5-15 / 7-20 / 9-40` archivada en git history.
>
> **Lectura clave**: la modelo cobra **50-60% del bruto** que paga el cliente, con progresión por facturación (umbrales 0 / 1.000 / 4.000 / 15.000 €). Puede **elegir su tarifa por minuto** dentro del rango que su tramo le permite. El primer minuto de sesión trial es **para atraer al cliente**: se paga a la modelo a tarifa reducida (€0,07/min) y modelos con Estatus Pro pueden desactivarlo.

---

## 1. Resumen del sistema

SharemeChat retribuye a las modelos verificadas mediante **cuatro tramos** determinados por la facturación bruta acumulada rolling 30 días. Cada tramo define dos cosas independientes:

- El **% de reparto** que la modelo se lleva del bruto que paga el cliente (50-60%).
- El **rango de precio por minuto** dentro del que la modelo puede elegir su tarifa (1 €/min fijo en T1; 1-9 €/min en T4).

Los tramos se recalculan **una vez al día** mediante un snapshot que mira la facturación bruta acumulada de los **últimos 30 días** (ventana móvil). El sistema es simétrico: al subir de tramo se desbloquea más margen de precio y mejora el %reparto; al bajar por debajo del umbral, se pierde el tramo en el siguiente snapshot.

Adicionalmente, la modelo puede activar **Estatus Pro** al superar 1.500 €/mes: una feature opcional que le permite decidir si acepta clientes trial en su tarjeta o no.

**Modalidad Master**: cuando la modelo opera bajo un Master (estudio), aplica **los mismos tramos y umbrales**. La única diferencia es el destinatario del ingreso: el 50-60% del bruto se abona al saldo del Master (no al de la modelo directamente); el reparto interno posterior Master↔modelo es privado ([ADR-056 §D4 revisión 2026-07-30](../06-decisions/adr-056-sistema-master-studio.md)).

---

## 2. Los 4 tramos — tabla de referencia

<!-- BEGIN generated:pricing-tiers renderer=md-table (no editar a mano; fuente docs/_data/pricing-tiers.yaml) -->
| Tramo | Facturación bruta (rolling 30d) | % modelo | % empresa | Rango €/min |
|---|---|---:|---:|---|
| T1 | desde 0 € | 50% | 50% | 1 €/min fijo |
| T2 | desde 1.000 € | 54% | 46% | 1 – 3 €/min |
| T3 | desde 4.000 € | 57% | 43% | 1 – 6 €/min |
| T4 | desde 15.000 € | 60% | 40% | 1 – 9 €/min |
<!-- END generated:pricing-tiers -->

- **Umbral T4 es el más alto configurado hoy**. El techo de precio (€9/min) es una property configurable (`billing.pricing.rate-max-eur-per-min=9.00`); ampliaciones futuras a €15/min o superiores no requieren migration, solo cambio de property + fila de `model_pricing_tiers` para el rango.
- **Los umbrales de reparto y de precio comparten los mismos escalones** (€1.000, €4.000, €15.000): cada desbloqueo de precio viene acompañado de mejora de reparto. Un solo gráfico comunica ambas dimensiones.
- SharemeChat retiene siempre **≥ 40% del bruto** (sostenibilidad protegida — [ADR-056 §D3](../06-decisions/adr-056-sistema-master-studio.md) justifica el nivel frente a fees PSP tarjeta ~10-15% + costes operativos).

---

## 3. Mecánica de progresión entre tramos

### Cómo se sube de tramo

1. **Toda modelo nueva empieza en T1**, con 0 € de facturación bruta acumulada.
2. Cuando la **facturación bruta acumulada rolling 30d** supera el umbral siguiente, la modelo pasa al tramo superior en el siguiente snapshot diario:
   - Al superar **1.000 €** → sube a **T2** (54% + rango 1-3 €/min).
   - Al superar **4.000 €** → sube a **T3** (57% + rango 1-6 €/min).
   - Al superar **15.000 €** → sube a **T4** (60% + rango 1-9 €/min).
3. **El paso no es inmediato durante la sesión**: el sistema ejecuta un snapshot diario que recalcula el tramo de cada modelo. El resultado del snapshot es la fila del día en `model_tier_daily_snapshots`.

### Cómo se baja de tramo

El sistema es **simétrico**. La ventana de 30 días es **móvil**: cada día que pasa, la facturación de hace más de 30 días "sale" de la ventana de cálculo. Si la modelo deja de trabajar y su acumulado en los últimos 30 días cae por debajo del umbral del tramo actual, baja al siguiente snapshot diario.

Al bajar de tramo, si la tarifa elegida por la modelo excede el máximo del tramo destino, se **recorta automáticamente** al máximo del tramo destino. Ejemplo: modelo en T4 con tarifa €7/min baja a T2 → su tarifa se ajusta a €3/min (el máximo permitido en T2). Sin bajada de tramo, la modelo mantiene su tarifa elegida indefinidamente.

### Implicación

El tramo **se mantiene trabajando**, no se gana de forma permanente. Esto crea un incentivo continuo de actividad para las modelos que quieren conservar %reparto alto y capacidad de precio premium.

---

## 4. Rango de precio autoservicio

Dentro de cada tramo, la modelo **elige libremente su tarifa por minuto** dentro del rango permitido. La elección se persiste en `users.chosen_rate_eur_per_min` vía endpoint `PUT /api/models/me/pricing`. El cambio es **efectivo inmediatamente** (el cliente que inicia sesión después del cambio ve el precio nuevo, sin diferimiento al snapshot).

### Comunicación al cliente

Cada tarjeta de modelo en la home y en la vista de perfil (`/m/:slug`) muestra **claramente el precio por minuto** que ha elegido la modelo. Sin precio visible, el cliente entra a sesión sin saber el ritmo de consumo, lo que genera fricción de conversión y disputas.

### Interacción con packs de recarga

Los packs vigentes (10 / 20 / 40 €) están calibrados para tarifas cercanas a €1/min (T1). Una modelo T4 cobrando €9/min consume el pack de 10 € en poco más de un minuto: hay fricción de conversión con el catálogo actual. **El rediseño de packs premium queda como frente separado** (deuda declarada, ver [`../04-operations/known-debt.md`](../04-operations/known-debt.md)); no forma parte del scope inmediato.

---

## 5. Estatus Pro: control opcional del trial

Feature única desacoplada de %reparto y de rango de precio. Se activa **al superar 1.500 € de facturación bruta acumulada rolling 30d** (umbral configurable via `billing.pro-status.min-billed-gross-eur-30d`).

Su valor operativo es un solo toggle: **la modelo con Estatus Pro decide en su panel si acepta clientes trial o no**. Endpoint: `PUT /api/models/me/pro-status`. UI del toggle **solo visible cuando Pro está elegible**.

### Cuando una modelo Pro desactiva trial

El cliente trial que entra en su tarjeta desde la home ve un CTA **"recarga para chatear con ella"**, no la modelo invisible. La exclusividad estimula conversión: el cliente ve que la modelo existe pero requiere pack contratado.

### Ampliaciones futuras del pack Pro

Visibilidad prioritaria en home, dashboard analytics, herramientas de gestión avanzada quedan **diferidas** a decisiones posteriores. No forman parte del scope de este documento.

---

## 6. Primer minuto trial

El primer minuto de sesión bajo el régimen trial (cliente entra a probar bajo el sistema de packs con cooldown existente) se **paga a la modelo a €0,07/min plano**, independientemente del tramo de la modelo o de su tarifa autoservicio elegida.

### Mecánica del trial

- El cliente registrado NO paga el primer minuto de cada sesión trial.
- Es la **plataforma quien paga** ese primer minuto a la modelo, a €0,07/min.
- A partir del **segundo minuto**, el cliente paga la tarifa elegida por la modelo (€1 – €9 según su tramo y elección).
- Se avisa transparentemente a la modelo antes del arranque de la sesión trial (UI del panel: "sesión trial, primer minuto €0,07").

### Tope diario por cliente

Para evitar abuso, existe un **máximo de minutos gratis al día por cliente**. Sistema de packs con cooldown progresivo entre packs:

- Cada **pack** son **3 slots** con cap de **60 s/slot** (≈ 3 minutos por pack).
- **Pack 1** (slots 1-3): sin cooldown, disponible inmediatamente.
- **Pack 2** (slots 4-6): cooldown de **1 hora** desde el fin del pack anterior.
- **Pack 3** (slots 7-9): cooldown de **4 horas** desde el fin del pack anterior.
- **Pack 4 y siguientes**: cooldown de **24 horas** entre packs.

**Tope efectivo en régimen estacionario**: **~3 minutos gratis cada 24 h por cliente** (un único pack/día tras el periodo de onboarding).

**Pico durante las primeras horas de uso**: hasta **~9 minutos** acumulados (los 3 primeros packs encadenados en aproximadamente 5 horas).

Implementado en [`sharemechat-v1/src/main/java/com/sharemechat/service/UserTrialService.java`](../../src/main/java/com/sharemechat/service/UserTrialService.java):

- `TRIAL_MAX_SLOTS_PER_USER = 3`
- `TRIAL_MAX_SECONDS_PER_SESSION = 60L`
- `TRIAL_HARD_CUTOFF_SECONDS = 50L`
- Lógica de cooldown entre packs: método `canStartTrial()`

Las tres constantes son hardcoded; no son parametrizables por properties. Para modificarlas hay que tocar el código y redesplegar.

### Interacción con Estatus Pro

Modelos con Estatus Pro pueden **desactivar el trial** en su panel. Es el mecanismo que resuelve la asimetría entre modelos T1 (aceptan trial de buen grado) y modelos T4 Pro (pueden preferir centrarse en clientes de pago).

### El trial cuenta hacia los umbrales de tramo y Pro

Aunque el cliente no pague, el primer minuto trial es **facturación real generada por la modelo** (la empresa la absorbe como coste). Los €0,07/min cuentan hacia el acumulado rolling 30d para efectos de subir de tramo o alcanzar Estatus Pro. Sin esto, una modelo con muchos trials pero pocas sesiones "quedaría anclada" en T1.

### Implicación económica

El primer minuto gratis es un **coste de adquisición** asumido por la plataforma. Cada vez que un cliente prueba sin terminar comprando, la plataforma ha pagado €0,07 a la modelo sin ingreso compensatorio.

Coste de un primer minuto trial no convertido:
- 3 minutos de trial diarios (régimen estacionario) × €0,07 = **€0,21/día por cliente que consuma su cupo trial completo**.
- Multiplicado por número de clientes activos con trial habilitado.

Métrica a monitorizar: **tasa de conversión "minuto 1 trial → minuto 2 pagado"** por modelo y agregada. Si la tasa cae por debajo de X%, el ratio coste-adquisición se rompe.

---

## 7. Reparto plataforma / modelo — desglose por método de pago

El precio mostrado al cliente es el mismo pase cripto o tarjeta ([ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D4). La modelo cobra su %reparto pase lo que pase. La empresa absorbe el diferencial de fees PSP como margen operativo.

### Ejemplo A: sesión de 10 min a €1/min con modelo T1

- Cliente paga: **€1 × 10 = €10** (menos el primer minuto trial si aplica; asumamos ya no aplica).
- Modelo (50%): **€5,00**.
- Empresa bruto (50%): **€5,00**.
- Empresa neto:
  - Cripto (fees ~1%): €10 × 1% = €0,10 → **€4,90 neto** (49% neto sobre facturación).
  - Tarjeta (fees ~13%): €10 × 13% = €1,30 → **€3,70 neto** (37% neto sobre facturación).

### Ejemplo B: sesión de 10 min a €3/min con modelo T2

- Cliente paga: **€3 × 10 = €30**.
- Modelo (54%): **€16,20**.
- Empresa bruto (46%): **€13,80**.
- Empresa neto:
  - Cripto: €30 × 1% = €0,30 → **€13,50 neto** (45% neto).
  - Tarjeta: €30 × 13% = €3,90 → **€9,90 neto** (33% neto).

### Ejemplo C: sesión de 5 min a €9/min con modelo T4

- Cliente paga: **€9 × 5 = €45**.
- Modelo (60%): **€27,00**.
- Empresa bruto (40%): **€18,00**.
- Empresa neto:
  - Cripto: €45 × 1% = €0,45 → **€17,55 neto** (39% neto).
  - Tarjeta: €45 × 13% = €5,85 → **€12,15 neto** (27% neto).

**Lectura**: el margen empresa neto es cómodo en cripto (39-49% según tramo) y aceptable en tarjeta (27-37% según tramo). El nivel se estableció por [ADR-056 §D3](../06-decisions/adr-056-sistema-master-studio.md) tras análisis del sector: SharemeChat sigue ofreciendo a la modelo mejor % que LiveJasmin L1 (30%) o BongaCams entry-level, con un margen para la plataforma que absorbe fees PSP + coste operativo + reserve. Ver [unit-economics.md](unit-economics.md) para el análisis completo y para la sensibilidad al mix cripto/tarjeta.

---

## 8. Responsabilidad económica de la modelo

Se distinguen tres categorías con reparto de responsabilidad distinto ([ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D7):

### Costes operativos estándar (absorbidos por el %empresa bruto)

- Fees PSP (variable + fijo por transacción, tarjeta o cripto).
- Reserve / rolling reserve del PSP (si aplica).
- Coste técnico variable (bandwidth WebRTC, STUN/TURN, AWS por minuto streamed).
- Coste de moderación proactiva sobre esa modelo (Sightengine mensual, monitoring).

### Descuentos del payout siguiente de la modelo (por eventos específicos atribuibles)

- **Chargeback** del cliente sobre una sesión específica con esa modelo.
- **Refund** aprobado por queja específica del cliente sobre esa modelo (contenido no acordado, cancelación unilateral por la modelo, etc.).
- **Sanciones PSP** por incumplimiento claro y documentado de la modelo.

Se aplica sobre el **payout siguiente**, con el motivo, fecha, importe y evidencia asociada visibles en el panel de la modelo (§9). Saldo negativo del mes **se arrastra a meses futuros** hasta compensar. **Umbral de suspensión temporal**: si los chargebacks atribuidos a una modelo superan el **~5% de su facturación bruta mensual**, se suspende temporalmente pendiente de revisión. La cifra concreta (umbral exacto, ventana de cálculo, política de reactivación) vive en **T&C y contrato de modelo**.

### Fuera de esta política (tratados por vía moderación, no descuento automático)

- Errores técnicos (equipamiento defectuoso, conexión inestable, pérdidas de sesión no imputables a la modelo).
- No-shows (modelo no aparece en sesión programada). Warnings escalados y, si reincidencia, suspensión temporal, pero **no descuento automático de payout**.
- Sanciones administrativas (avisos, warnings) que no involucran evento económico atribuido.

---

## 9. Panel de la modelo: transparencia obligatoria

El panel de la modelo (`/model/economics` frontend product) muestra:

- **Tramo actual** con umbral vigente y siguiente.
- **%reparto** aplicable.
- **Rango de precio** permitido y **tarifa elegida** dentro del rango.
- **Estatus Pro**: elegible / activo / no elegible, con toggle de aceptación de trial cuando Pro es elegible.
- **Historial de descuentos** aplicados a payouts, con motivo, fecha, importe y **evidencia asociada** (link a la sesión, chargeback notification del PSP, decisión de moderación).
- **Derecho a disputa**: cada descuento con botón "reclamar", que dispara un ticket interno gestionado por el equipo de soporte con SLA definido.

La transparencia total es requisito de la política de descuentos (§8). Sin panel navegable, un descuento sin explicación destruye la confianza que el %reparto elevado pretende construir. Es requisito no solo comercial sino legal (GDPR / derecho de acceso a decisiones automatizadas del art. 22 GDPR si el descuento es automatizado).

---

## 10. Métricas operativas a monitorizar

Para validar que el sistema funciona económicamente, hay que vigilar:

| Métrica | Significa | Por qué importa |
|---|---|---|
| **Distribución de tramo** | Cuántas modelos en cada tramo (T1, T2, T3, T4) | Indica madurez del marketplace; si todas están en T1 hay problema de retención de modelos activas. |
| **Modelos que suben de tramo por mes** | Flujo upward | Salud del sistema de incentivos. |
| **Modelos que bajan de tramo por mes** | Flujo downward | Si es alto, churn de modelos activas. |
| **Modelos con Estatus Pro** | Cuántas superan el umbral 1.500 € | Indicador de capacidad de la plataforma para generar volumen por modelo. |
| **Modelos Pro que desactivan trial** | Cuántas Pro apagan el trial | Señal de saturación de la modelo con clientes pagados. |
| **Tarifa media elegida por tramo** | Distribución de `chosen_rate_eur_per_min` dentro de cada tramo | Si en T2 todas eligen €3 (el máx), tal vez el rango se queda corto; si todas eligen €1 (el mín), el desbloqueo de rango no se está usando. |
| **Tasa min1→min2 en trial** | % de sesiones trial que pasan al minuto 2 pagado | Si es baja, las demos cuestan mucho y no convierten. |
| **Chargebacks/refunds por modelo** | Volumen y %sobre facturación por modelo | Para disparar suspensión temporal si supera el ~5% mensual. |

Estas métricas no están todavía implementadas — se deben definir cuando el producto entre en fase **Soft Launch** operativa.

---

## 11. Decisiones y restricciones del diseño actual

- **4 tramos escalonados en %reparto y rango de precio** con umbrales compartidos: aprovecha el mismo gráfico mental para comunicar dos dimensiones a la modelo.
- **50-60% modelo** como propuesta comercial competitiva frente al 30-45% habitual del sector adult cam (LiveJasmin L1 30%, BongaCams entry ~35%). Palanca de reclutamiento en pre-launch alineada con el diseño Master (mismos tramos para libre y bajo Master, ver [ADR-056](../06-decisions/adr-056-sistema-master-studio.md)).
- **Rango autoservicio de precio**: da a la modelo con marca propia palanca de captura de valor sobre sus clientes; la modelo generalista mantiene €1/min sin fricción.
- **Estatus Pro desacoplado** (una feature única: control del trial): evita complicar el pack Pro en el arranque. Ampliaciones futuras (visibilidad, analytics) van por decisiones separadas.
- **Umbrales sobre facturación bruta rolling 30d** (no earnings modelo, no mes calendario, no snapshot puntual): reutiliza la infraestructura del snapshot diario existente y evita "cliff-edge" al final de mes.
- **Ubicación de las condiciones económicas en BD** (tabla `model_pricing_tiers` con versionado `effective_from`/`effective_to`), no en properties: permite auditoría histórica de qué condiciones estuvieron vigentes en qué fecha (necesario cuando la modelo cita las condiciones comercialmente).

---

## 12. Referencias

- Decisión estructural: [ADR-052 — Rediseño estructural del reparto, rango de precio autoservicio y retirada del programa de afiliadas](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md).
- Pricing del producto: [pricing.md](pricing.md).
- Modelo de unit economics general: [unit-economics.md](unit-economics.md).
- Modelo financiero (proyección mes a mes; pendiente recalibrar tras ADR-052): [`financiero/modelo-financiero.md`](financiero/modelo-financiero.md).
- Estrategia SEO y proyecciones de tráfico: [seo/estrategia.md](seo/estrategia.md).
- Deudas técnicas conocidas relacionadas (rediseño packs premium, cambios BD tras ADR-052): [`../04-operations/known-debt.md`](../04-operations/known-debt.md).
- Implementación técnica pendiente (frente separado, materialización de ADR-052):
  - Migration V38 (drop tablas afiliadas + drop `model_earning_tiers` previa) + V39 (nueva `model_pricing_tiers` + columnas snapshot).
  - Refactor `ModelTierService` + `ModelTierSnapshotJob` a operar sobre facturación bruta rolling 30d.
  - Nuevo `PricingService` y endpoints `PUT /api/models/me/pricing`, `PUT /api/models/me/pro-status`, `GET /api/models/me/economics`.
  - Panel product `/model/economics`.
- Implementación técnica del primer minuto trial (sistema de packs y cooldown): [`src/main/java/com/sharemechat/service/UserTrialService.java`](../../src/main/java/com/sharemechat/service/UserTrialService.java) y entidad [`src/main/java/com/sharemechat/entity/UserTrialStream.java`](../../src/main/java/com/sharemechat/entity/UserTrialStream.java) (tabla `user_trial_streams`).

---

*Documento reescrito 2026-07-24 por [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md); actualizado 2026-08-04 por [ADR-056 §D3](../06-decisions/adr-056-sistema-master-studio.md) (nuevos tramos y umbrales) y §D4 revisión (motor INDIVIDUAL per modelo válido también para modalidad Master). Próxima revisión: cuando se replanteen los tramos, los umbrales, el techo de precio, la política de Estatus Pro o la mecánica del trial.*
