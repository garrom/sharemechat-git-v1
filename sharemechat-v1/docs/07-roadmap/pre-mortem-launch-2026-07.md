# Pre-mortem del lanzamiento — SharemeChat

> **Naturaleza del documento.** Ejercicio de pre-mortem (Gary Klein) ejecutado el 2026-06-29, situándose hipotéticamente en marzo de 2027 y asumiendo como hecho rotundo que SharemeChat ha fracasado. Razonamiento hacia atrás, sin suavizar, desde el estado real del proyecto a fecha de redacción. **No es una predicción**: el objetivo es destapar puntos ciegos y disparar acciones preventivas antes de la apertura de PROD.
>
> Base factual: `01-business/seo/estrategia.md`, `01-business/seo/seo-baseline-snapshot-2026-06-21.md`, `01-business/seo/tracking-mensual.md`, `01-business/financiero/modelo-financiero.md`, `01-business/psp-strategy.md`, `01-business/geographic-strategy.md`, `04-operations/known-risks.md`, `04-operations/known-debt.md`, `07-roadmap/{go-live-roadmap,current-phase,pending-hardening}.md`, ADRs 028 / 029 / 035 / 036 / 037 / 040.
>
> **Lectura del documento**: el bloque TRÁFICO es el más desarrollado porque la captación es la preocupación dominante declarada por el operador. Las "otras causas" cubren puntos ciegos que no se han pedido pero que el dossier real saca a la luz.
>
> Fecha del ejercicio: 2026-06-29. Próxima revisión recomendada: 2026-09-16 (M3, primera revisión trimestral SEO).

> **Actualización 2026-07-18 (no reescribe el análisis original).** Dos hechos posteriores al ejercicio cambian dos causas concretas del bloque TRÁFICO/PSP sin invalidar la estructura general:
>
> - **A1 (Segpay condicional / plan B no contactado)**: **Segpay ha quedado DESCARTADO** por incompatibilidad estructural (Segpay exige residencia del director/beneficiario efectivo en el mismo país donde está constituida la sociedad; SharemeChat es OÜ estonia con operador residente fuera, lo que Segpay clasifica como indicio de "empresa pantalla" y bloquea onboarding). El primer PSP potencial de tarjeta pasa a ser **CardBilling (filial de Verotel)**, todavía sin contacto formal. Ver [psp-strategy.md](../01-business/psp-strategy.md) actualizado.
> - **PSP puente cripto en operación**: la Gate 3 del pivote soft launch (al menos un flujo de pago real end-to-end en PROD) queda cubierta desde 2026-07-17 con **NOWPayments activo en PROD** (cripto custodial: BTC + USDT-Tron + USDT-Ethereum + USDC-Ethereum). Ver [ADR-051](../06-decisions/adr-051-psp-puente-cripto-nowpayments.md). Esto altera la lectura del punto A2 (webhook CCBill sin firma) y de A3 (pack mínimo €10 frena el funnel) porque el circuito real de circulación de dinero ya no depende de tarjeta sino de un puente cripto validado end-to-end en sandbox y activado en producción.
>
> El resto del análisis del pre-mortem (TRÁFICO T1-T6, compliance B1-B4, modelos C1-C4, fraude D1-D3, tesorería G1-G2) sigue vigente al 2026-07-18 sin cambios materiales.

---

## 1. Escenario de fracaso — marzo 2027

Estamos en marzo de 2027, seis a ocho meses después del go-live planificado para el 1 de julio de 2026. SharemeChat no facturó nada relevante en sus primeros seis meses operacionales: el tráfico orgánico no arrancó por encima del escenario pesimista del modelo financiero, el funnel se detuvo en el step de verificación de edad del cliente, no se firmó ningún PSP en condiciones operativas estables, el inventario de modelos verificadas no llegó a una masa que sostuviese el matching y el operador agotó el límite de gasto personal mensual sostenible antes de poder demostrar tracción. La sociedad cierra operaciones con la infraestructura técnica funcionando bien y las decisiones de compliance documentadas con detalle, pero sin haber resuelto el problema real del negocio: que **nadie llega a la plataforma, y de los pocos que llegan, casi nadie completa el primer pago**.

---

## 2. Bloque TRÁFICO — causas dominantes (de más a menos probable)

### T1. El SEO orgánico no superó el escenario pesimista y no hubo plan B

**Mecanismo concreto del fallo.**
El propio `estrategia.md` ya proyectaba **~€500 acumulados en 18 meses** en el pesimista y **~€7.000 en el normal** (break-even mensual hacia el mes 15-16 sólo en el normal). El operador asumió formalmente el pesimista como referencia operativa (`modelo-financiero.md` §1, decisión registrada el 2026-06-17). Es decir, el modelo de negocio se firmó **sabiendo que el SEO solo no sostiene la operación en 18 meses**, y se aceptó cubrir ~€247/mes de pérdida personal. Cuando los KPIs reales de M3-M6 (sep-dic 2026) no se desviaron del pesimista, no había mecanismo de activación de palancas alternativas: paid traffic en redes adultas (TrafficJunky/ExoClick), PR sectorial (XBIZ/YNOT/AVN), affiliates y partnerships estaban listados como "evaluar en M6 si los KPIs siguen en pesimista" (`modelo-financiero.md` §5 trigger 2), pero ninguna palanca estaba contratada, presupuestada ni operativamente probada. El operador llegó a M9 sin haber gastado un euro en paid traffic y sin ningún acuerdo de afiliación cerrado.

**Por qué esto es la causa #1.** No es que SEO falle — es que el plan asumía explícitamente que SEO sería insuficiente y nunca se construyó el segundo motor. El fracaso aquí es estratégico, no de ejecución del blog.

**Señal de alerta temprana (AHORA).** En M3 (sep 2026), comparar `Sesiones × % Organic` real contra el plan pesimista. Si está al nivel pesimista o por debajo durante 2 meses consecutivos, **activar paid traffic adult-specialist sin esperar a M6**, contra el calendario que dice el documento. El trigger oficial es M6; en marzo 2027 ese mes ya pasó sin actuación.

---

### T2. El bug crítico de internal linking nunca se resolvió y mató el descubrimiento orgánico desde el primer día

**Mecanismo concreto del fallo.**
`seo-baseline-snapshot-2026-06-21.md` §7 documenta con curl reproducible que:

- El HTML inicial servido por CloudFront en `/`, `/blog/es`, `/blog/en` y `/blog/es/<slug>` es **idéntico** (3192 bytes), un shell SPA con `<title>1-to-1 Video Chat with Verified Models | SharemeChat</title>` para cualquier URL.
- En el HTML inicial del listing **no hay un solo `<a href>` a los artículos**: los enlaces emergen tras la hidratación React, vía `useEffect` que llama a `/api/public/content/articles`.
- En el HTML inicial del artículo individual no hay canonical, no hay hreflang, no hay JSON-LD `BlogPosting`. Todo lo emite `seoHelpers.js` post-hidratación.

GSC ya reportaba a 2026-06-21 "ninguna página de referencia". Googlebot moderno ejecuta JS, pero **prioriza HTML inicial para asignar crawl budget en sitios nuevos**. Bing, agregadores RSS, link previews legacy (WhatsApp/Telegram/Slack) y bots de IA training (GPTBot, ClaudeBot, PerplexityBot) ven la home en lugar de los artículos. El sitemap.xml es la única vía sólida de descubrimiento — un único punto, frágil.

Los quick wins propuestos por el agente SEO (inyectar listado en `index.html` con `<noscript>`, gatear GTM por hostname, añadir `BreadcrumbList`, IndexNow) suman ~8h de trabajo y no se aplicaron por priorización. En marzo 2027 el blog siguió teniendo cobertura GSC muy parcial, posición media estancada por encima de 30 en queries objetivo y CTR irrelevante.

**Por qué esto es la causa #2.** El plan SEO se ejecutó sobre un sitio que arquitectónicamente impide el descubrimiento orgánico. Cada artículo nuevo nutría el `<noscript> vacío`. La cadencia 1/semana sostenida produjo 30 artículos asset pero Google no los descubrió a tiempo.

**Señal de alerta temprana (AHORA).** En GSC, panel "Páginas" filtrado por "Indexadas": si el número de URLs indexadas no crece al ritmo del sitemap (cada artículo nuevo + sus pares hreflang debería aparecer indexado en 1-2 semanas tras publicación), el problema arquitectónico está activo. Cruzar con la indexación masiva manual del 2026-06-16 (8 URLs forzadas en GSC) — si esas siguen siendo el grueso a M3, hay bug.

---

### T3. GTM hardcoded contaminó las métricas durante meses y enmascaró el problema real

**Mecanismo concreto del fallo.**
`seo-baseline-snapshot-2026-06-21.md` §8 documenta que `GTM-T7BNJP4M` está hardcoded en `frontend/public/index.html` sin gateo por hostname. Se dispara en TEST, AUDIT y PROD por igual. El propio tracking M0 (jun 2026) reportó **131 sesiones GA4 totales con ~90% Direct (autonavegación del operador y tests internos)**: sólo 2 sesiones de 131 (1.53%) eran Organic Search real.

Si el GTM no se gatea, este patrón se mantuvo. En M3-M6, "subir de 100 a 500 sesiones" puede haber sido enteramente artefacto de despliegues, pruebas E2E, smokes desde admin y revisores externos (Patricia Ucros de Segpay, asesoría legal). El operador tomó decisiones leyendo un número inflado, retrasó la activación del paid traffic porque "estamos cerca del normal", y no descubrió la inversión hasta M9, cuando ya era irrecuperable.

**Por qué esto es la causa #3.** Es el fallo que multiplica los otros: sin métrica limpia, no se puede activar correctamente el trigger del modelo financiero. Está identificado y catalogado como quick win de 2h, pero no se ejecutó.

**Señal de alerta temprana (AHORA).** En GA4, panel `Traffic acquisition` últimos 28 días, mirar `Session source/medium` filtrado por `Direct`. Si `Direct` representa >40% del tráfico de forma sostenida, la métrica está contaminada y los KPIs del tracking mensual no son fiables. El M0 ya reportó 90% Direct: el problema es real y vivo.

---

### T4. Reddit como motor #2 nunca alcanzó el umbral operativo y X se quedó en warmup permanente

**Mecanismo concreto del fallo.**
El plan declara `estrategia.md` §3: *"Reddit como motor #2: r/SharemeChat propio + comentarios genuinos en subs hispanos y angloparlantes. Tráfico directo y construcción de backlinks naturales."* Estado real a 2026-06-29:

- `u/sharemechat`: **1 karma**, 9 días de antigüedad.
- `r/SharemeChat`: **0 posts** (creado 12-jun-2026).
- `@shareme_chat`: **0 followers**, 6 días, 2 aportes, fase warmup.
- Subs target de ADR-040 (`r/CamGirlProblems`, `r/SexWorkerSupport`, `r/CreatorsAdvice`, `r/Fansly_Advice`): primer comentario operativo el 2026-06-19 en `r/CamGirlProblems` (2 comentarios variante B). Los otros 3 subs siguen sin validar empíricamente sus mínimos `min_karma`/`min_age_days` (deuda registrada en `known-debt.md` 2026-06-19).

Reddit requiere meses de karma + antigüedad para no ser shadowbaneado por AutoMod en subs serios. El pipeline social-ops está bien diseñado (ADR-034, 038, 039, 040, 041) pero la ejecución estaba en **mes 1 de un proceso de 6-12 meses** justo cuando el lanzamiento se abre. El ratio 10% promo / 90% aporte (ADR-034) significa que de cada 10 publicaciones, sólo 1 puede mencionar la plataforma. Con cadencia de 1-2 comentarios por sesión y 4 subs target, los ritmos del warmup difícilmente generan más de 5-10 promos publicables en los primeros 6 meses post-lanzamiento. La conversión Reddit→signup en sector adulto se sitúa típicamente por debajo del 0.5%; aritméticamente esto no mueve la aguja.

**Por qué esto es la causa #4.** Las dos plataformas que iban a compensar el SEO lento estaban tan en arranque que el "soft launch" coincidió con cuentas sociales menores que las de un usuario casual. La estrategia es correcta; los tiempos de warmup son los que son.

**Señal de alerta temprana (AHORA).** Tracking mensual `tabla 3a`: si `Followers X` no cruza 50 a M3 (sep 2026) y `Karma Reddit` no cruza 100 a M3, el warmup no está respondiendo a la cadencia planificada. Cualquier desviación aquí adelanta la necesidad de paid traffic o de invertir en cuentas existentes (compra de cuentas Reddit con karma maduro está fuera del marco operativo del operador, pero conviene saberlo).

---

### T5. Los canales pagados nunca se activaron por bloqueo psicológico, no por bloqueo regulatorio

**Mecanismo concreto del fallo.**
Los canales adyacentes posibles del `estrategia.md` §1 — TrafficJunky, ExoClick, JuicyAds, XBIZ/YNOT/AVN, affiliates, partnerships — son **legítimos para el sector**. No están bloqueados como TikTok o Meta Ads. El operador no los activó porque (a) cuesta €200-500/mes adicionales, (b) requiere cerrar contrato con una red adulta y aprender su panel, (c) la decisión financiera de asumir el pesimista implícitamente eliminó el presupuesto de paid. El trigger M6 estaba en el documento pero "evaluar palanca" no es "activar palanca".

En marzo 2027 el operador llevaba 9 meses de pesimista confirmado y aún no había firmado un IO de €300 con TrafficJunky.

**Por qué esto es la causa #5.** Es el clásico fallo de "el plan B existe en el documento pero no en el calendario". Sin un milestone hard, los planes B se aplazan indefinidamente.

**Señal de alerta temprana (AHORA).** En el tracking mensual de septiembre 2026 (M3, primera revisión obligatoria), debe haber **una decisión binaria**: activar paid o no activar, con presupuesto concreto y panel concreto. "Volver a revisar en M6" no es una decisión: es una postergación.

---

### T6. Dependencia estructural de un dominio nuevo en sector saturado

**Mecanismo concreto del fallo.**
Datos de `estrategia.md` §2: sólo el **1.74% de páginas nuevas alcanza top 10 en su primer año**, sandbox Google 1-3 meses, edad media de página #1 son 5 años. SharemeChat compite contra dominios con décadas (Chaturbate, LiveJasmin, Camsoda, Stripchat) y contra comparables del posicionamiento adult dating intimate (CooMeet, LuckyCrush, Chatspin) con autoridad de dominio establecida. El blog arrancó marzo 2026; en marzo 2027 lleva 12 meses, justo en el rango donde *empieza* a verse tracción real — pero con el bug T2 nunca compuso.

Además, AI Overviews activos en ~30% de queries reducen el CTR de la posición 1 en un 58% (datos Ahrefs en el propio documento). Una keyword competida que se rankee #3 cuando el target era #1 da ya muy poco tráfico — el "premio" por ranquear se ha encogido.

**Por qué esto es la causa #6.** Es estructural, no operativo. Se sabía. No invalida el plan, pero acota su techo. Cualquier comparación con CooMeet o LuckyCrush en marzo 2027 ignora que ellos llevan 5-10 años acumulando autoridad de dominio.

**Señal de alerta temprana (AHORA).** Posición media en queries objetivo durante 6 meses consecutivos. Si a M9 sigue por encima de 20 en las 5 keywords principales del plan editorial, la asimetría de autoridad de dominio es irreversible con SEO orgánico y hay que cambiar de motor.

---

## 3. Otras causas — agrupadas por área

### A. PSP y cobros — el embudo se rompió en el step de pagar

**A1. Segpay no aceptó el método de verificación de cliente o el due diligence se alargó más de 6 meses.**
`psp-strategy.md` declara explícitamente que la continuidad con Segpay es **condicional**: si exige documento al 100% de consumidores, no se sigue con Segpay. El plan B (Verotel/Vendo, RocketGate, Epoch) **no está contactado formalmente**: la idea es "mantener la información actualizada" pero "no hacer onboarding paralelo". En el escenario de fracaso, Segpay tardó hasta noviembre 2026 en cerrar el due diligence, o lo rechazó y el onboarding con un PSP alternativo se llevó otros 4-6 meses adicionales. Durante todo ese tiempo no había circuito de pago real.

**A2. El webhook `/api/billing/ccbill/notify` se desplegó sin verificación de firma cuando se reabrió CCBill como plan de emergencia.**
`known-risks.md` línea 12: *"Riesgo crítico antes de dinero real: `POST /api/billing/ccbill/notify` sigue siendo `permitAll` y whitelist permanente. Hasta implementar validacion de firma, origen/contrato PSP, idempotencia y proteccion anti-replay, un notify `APPROVED` no debe considerarse apto para operacion real."* Con la presión del lanzamiento, en algún momento entre julio y octubre 2026 alguien lo activó "temporalmente" en PROD. Un atacante o un actor curioso disparó notify APPROVED falsos y la wallet del cliente reflejó saldo no respaldado por pago real. Aunque el daño económico fue contenido por el modelo BFPM, la corrección urgente quemó dos semanas del operador en un mes en que no había revenue.

**A3. Pricing pack mínimo €10 frenó el funnel.**
`pricing.md` y ADR-011 fijan el pack mínimo en €10. Comparables del sector ofrecen demos gratis + paquetes desde €2-5. El cliente nuevo, tras pasar age verification, se encontró con barrera de €10 en la primera recarga. La conversión "verificado → primera compra" se quedó por debajo del 5% (vs 10% pesimista del modelo financiero). El pack mínimo se decidió por razones unitarias (fee fijo Segpay vs ticket) — pero esa decisión proteje el unit economics a costa de cerrar el funnel.

**Señales tempranas.**
- A1: cada semana que Patricia Ucros (Segpay) no cierra el due diligence es una semana de delay del go-live. **Si el cierre Segpay no se ha firmado para el 2026-09-30, activar plan B contra Verotel o RocketGate.**
- A2: monitorizar SQL `payment_sessions WHERE source='ccbill_notify' AND signature_validated=FALSE`. Cualquier fila aquí en PROD es bandera roja inmediata.
- A3: en GA4, evento `purchase_attempt_started` vs `purchase_completed` en los primeros 30 días. Si el drop-off > 50%, el pack mínimo es el problema (o el flow tiene fricción técnica).

---

### B. Moderación y cumplimiento legal — bloqueantes que se subestimaron

**B1. Declaración 2257 y Records Custodian no producidos a tiempo.**
`known-risks.md` líneas 38-39: *"Declaracion 2257 ausente del footer del SPA. Records Custodian no nombrado. Bloqueante para go-live publico."* La declaración 2257 es exigible por la sección 2257 del US Code para cualquier merchant con producción visual real, incluso si la sociedad es OÜ estonia, en cuanto se sirve a usuarios US. Sin esto, cualquier audit del card brand o de un PSP US-conectado dispara congelación de la cuenta merchant. En el escenario de fracaso, el go-live abrió US sin 2257 visible y, en algún momento de Q4 2026, Mastercard o el propio Segpay solicitaron la documentación. El PSP suspendió procesado mientras se produce; el operador necesitó 3-4 semanas para nombrar al Records Custodian, redactar la declaración con asesoría externa, desplegarla en footer y pasar la verificación. Durante esas semanas, ya con tráfico real, no se procesó nada.

**B2. Cinco políticas formales del PSP nunca firmadas legalmente.**
`compliance-deliverables.md` nota interna 2026-06-27: *"las cinco políticas formales que el PSP exige siguen como 'estado PLANIFICADO' en este documento porque ninguna está aún firmada legalmente; existen como textos en `Legal.jsx` y en los PDFs generables por el script, pero la firma legal definitiva exige revisión por asesoría externa. Bloqueante para cerrar onboarding Segpay y para go-live público."* Sin asesoría legal contratada, esto se postergó pasada la fecha del lanzamiento. Segpay no cerró onboarding final. El go-live "público" del 1-jul-2026 se hizo realmente en modo PRELAUNCH durante todo el verano, sin posibilidad de cobrar.

**B3. Sightengine en PROD se activó con prisa y produjo falsos positivos masivos.**
`known-risks.md` línea 37 + `known-debt.md` 2026-06-27 punto 10: la activación de Sightengine en PROD estaba pendiente al 2026-06-28 (AUDIT recién activado, PROD aún MOCK). Al activarse en julio bajo presión de lanzamiento, sin más curva de calibración que la observada en TEST/AUDIT (~10 frames totales validados), el `summary.action` del workflow Sightengine devolvió `reject` por falsos positivos en streams legítimos. Modelos verificadas vieron sesiones killed unilateralmente. La queja en el sub `r/CamGirlProblems` (donde el operador ya tenía presencia) viralizó: "SharemeChat banea sin causa". La reputación entre talento se hundió en 2 semanas. Cuando se corrigió la configuración, las modelos ya habían migrado.

**B4. La detección de imagen congelada / presence challenge nunca se implementó.**
Deuda #11 en `known-debt.md` 2026-06-27 (descubierta el 2026-06-28 durante validación E2E AUDIT). Una modelo dejó cámara apuntando a vídeo congelado mientras 6 clientes pagaron minutos creyéndose conectados a persona viva. Cliente reportó chargeback, Segpay congeló cuenta, y el caso llegó a foros del sector como evidencia de que "SharemeChat es un timo". Aunque la deuda está identificada en código, no se priorizó porque "es post-go-live".

**Señales tempranas.**
- B1: estado del Records Custodian. Si para el 2026-08-15 sigue siendo "PLANIFICADO" en `compliance-deliverables.md`, parar lanzamiento US.
- B2: si para 2026-09-01 no hay 5 PDFs firmados por asesoría legal externa, activar el sub-paquete "asesoría legal urgente" como gasto fuera de presupuesto.
- B3: durante las primeras 2 semanas post-activación Sightengine PROD, monitorizar diariamente `stream_moderation_reviews` con `decision=REJECT` o `severity=RED`. Si la tasa de RED supera 5% de los streams analizados, el threshold del workflow Sightengine está mal calibrado.
- B4: implementar 11.A (frame-difference) **antes** del go-live público, no después. La pérdida directa al cliente por imagen congelada es trivialmente demostrable ante un PSP.

---

### C. Captación y retención de modelos — sin modelos, no hay servicio

**C1. El inventario de modelos verificadas no llegó a la masa mínima para sostener matching aleatorio.**
Fase 2 del go-live roadmap ("Captación inicial de modelos") está **NO INICIADA** al 2026-06-29. El roadmap dice "prioridad: Latinoamérica". A 2 días del lanzamiento previsto, no hay un pipeline activo de captación, no hay agencies contactadas, no hay budget asignado, y la captación orgánica vía Reddit (subs adult-ecosystem de ADR-040) lleva 10 días con 2 comentarios y 1 karma. En marzo 2027 el matching aleatorio mostraba "no hay modelos disponibles" al 70% de los intentos de cliente. Los clientes que hicieron primer pago no encontraron oferta y no volvieron.

**C2. KYC de modelo manual sobre Didit cuello de botella.**
`known-risks.md` línea 36: *"KYC de modelos vive en modo manual sobre Veriff."* Tras el pivote a Didit (ADR-035), el proceso sigue requiriendo revisión admin del resultado del webhook. Con el operador como única persona en operación, cada onboarding requiere 24-48h de respuesta. Las modelos abandonan el proceso antes de cerrarlo. Comparables del sector cierran KYC modelo en <2h con automatización completa.

**C3. Tier inicial 5-15 demasiado bajo, sin BFPM para modelos.**
`sistema-tiers-modelos.md` §2: tier inicial €0.05 primer minuto + €0.15 siguientes. Una modelo nueva necesita 600 minutos facturados en 30 días para subir a tier 7-20. Con el inventario bajo, el matching es escaso, los 600 minutos no se acumulan, las modelos se quedan en tier 5-15 y el ingreso por hora (~€9 trabajando todo el tiempo) es no-competitivo frente a Chaturbate (10-30% revenue share del tip cliente con techo €100+/h) o Fansly. El churn de modelos pre-150min facturados superó el 80%.

**C4. Model Collaboration Agreement v4 con lenguaje legacy.**
Deuda R5 en `known-debt.md` 2026-06-27. El contrato firmado en producción (`model_contract.pdf v4_2026-03-23`) sigue con lenguaje del régimen previo, no alineado con el posicionamiento adult dating intimate refactorizado en Fase 2 (commit 2026-06-27). Una modelo experimentada del sector leyó el contrato, vio inconsistencias con la práctica del vertical, y publicó en `r/CamGirlProblems` (donde SharemeChat ya tenía presencia) un análisis crítico. Esto desbloqueó el resto del problema C1.

**Señales tempranas.**
- C1: contar modelos verificadas con `verification_status=APPROVED` en PROD. Si para el 2026-09-30 no hay al menos 30 modelos activas que hayan logueado en los últimos 7 días, el matching no funcionará al abrir Fase 5.
- C2: tiempo medio de aprobación KYC modelo (desde webhook approved hasta `verification_status=APPROVED` definitivo). Si supera 12h, automatizar antes de go-live.
- C3: a M3, mirar la mediana de minutos facturados por modelo en los primeros 30 días. Si <100, el sistema de tiers no incentiva la permanencia y hay que cambiar el escalón o introducir BFPM también para modelos.
- C4: priorizar R5 (Model Contract v5) **antes** del go-live público, no después.

---

### D. Fraude — el control plane existe pero el atacante encuentra el hueco

**D1. Wallet falseado vía webhook PSP no validado (combinado con A2 arriba).**
Si en algún momento del año `permitAll` siguió activo, un script trivial dispara saldos no respaldados.

**D2. Bot-traffic falseando age gate de invitado.**
`known-risks.md` línea 33: *"El age gate de invitado acepta cualquier UUID arbitrario enviado como cookie `consent_id`, sin verificacion de sesion previa ni vinculo con un flujo frontend valido."* Un atacante envía consent_id arbitrarios y agota recursos del flow de login sin pasar la fricción humana. No es robo, pero infla métricas y dispara falsos triggers del modelo financiero.

**D3. Auth-risk no detecta low-and-slow.**
`known-risks.md` línea 30. Credential stuffing distribuido bajo el umbral CRITICAL pudo abrir cuentas. No es daño económico inmediato pero sí ruido en el matching y posible incidente regulatorio si esos accesos llegaron a contenido adulto.

**Señal temprana.**
Monitor diario de `payment_sessions` con `amount` no concordante con packs P10/P20/P40, de `consent_events` sin user_id previo, y de logs `[AUTH-RISK]` con scoring HIGH durante >5 días seguidos.

---

### E. Costes AWS y runway — los fijos te comen lento

**E1. AWS €120/mes asumido fuera del circuito Companio.**
`accounting-status.md` y `modelo-financiero.md`: costes fijos €257/mes (AWS €120 + Companio €110 + Sightengine €27). Sightengine puede saltar a Pro ($99/mes) cuando se cruce el umbral de 250 sesiones/mes o 10 concurrentes pico. Si tres entornos siguen activos en idle (TEST + AUDIT + PROD), AWS puede subir a €150-180/mes con un mes ocioso. El "gasto personal de Alain" de €247/mes se convirtió en €290-320/mes durante los meses sin revenue.

**E2. No hay plan de consolidación AWS si M3 confirma pesimista.**
El modelo financiero §4 lo dice claro: *"AWS, Companio y Sightengine mandan. €20/mes ahorrados = €380 menos en 19 meses de bolsillo."* En el escenario de fracaso, ningún paso de consolidación se tomó: TEST y AUDIT seguían corriendo 24/7 en marzo 2027.

**Señal temprana.**
Factura AWS mes a mes. Cualquier crecimiento sostenido por encima de €130/mes sin justificación funcional dispara acción de consolidación.

---

### F. UX, retención y marca

**F1. El bug visual de Chromium desktop en RANDOM siguió abierto en go-live.**
`known-risks.md` línea 8 + `pending-hardening.md` "Rediseño controlado del render remoto en Chromium desktop". El stage remoto sigue mostrando salto/encogimiento durante la fase inicial. Un cliente nuevo lo interpretó como "se ha desconectado" y abandonó el primer pago. Replicado en reviews de foros: "se ve mal en mi Chrome".

**F2. Confusión entre adult dating intimate y cam adult broadcast en la copy pública.**
Tras la Fase 2 del refactor de lenguaje (2026-06-27), la copy del SPA está alineada con adult dating intimate. Pero la búsqueda orgánica trae keywords del cam adult tradicional ("cam girls", "live cam") que el contenido SEO no satura. Los usuarios que llegan buscando cam adult broadcast multi-cliente se decepcionan con la propuesta 1-a-1 y no convierten. Los usuarios que buscan adult dating intimate no encuentran la plataforma porque las keywords long-tail propias no rankean (T2).

**F3. Ausencia de país-gating granular en US frenó el go-live anglófono completo.**
`geographic-strategy.md` declara beachhead anglófono con "US en estados aplicables". ADR-031 cerró cliente=28 / modelo=46. Pero "estados aplicables" en US requiere granularidad sub-estatal (Free Speech Coalition v. Paxton, mosaico estatal). El control técnico para esto no estaba al go-live. El operador o (a) abrió US sin granularidad y se expuso a investigación estatal en Texas/Utah/Louisiana, o (b) cerró US entero y perdió 50%+ del beachhead.

**Señales tempranas.**
- F1: bug tracker del componente WebRTC en Chrome desktop. Cualquier reporte abierto en el repo o en foros internos antes del go-live es prioridad alta.
- F2: GSC `Search queries` en M3. Si las top 10 queries que traen tráfico son de cam adult tradicional, hay mismatch de promesa y producto.
- F3: granularidad US debe estar definida antes de 2026-08-15. No abrir US si no está cerrada.

---

### G. Tesorería personal

**G1. El "gasto personal de Alain" cruzó el umbral de sostenibilidad.**
`modelo-financiero.md` declara que Alain asume ~€247/mes como referencia (pesimista) durante 18-24 meses. Pero también dice "Sin capital inicial: cada mes en pérdida se cubre con nómina externa de Alain". Si la nómina externa cambia (despido, reducción de jornada, gastos personales no previstos: salud, familia, vivienda), el runway personal se evapora en 2-3 meses. No hay reserva corporativa.

**G2. El operador-único como factor de riesgo.**
Toda la operación recae en una persona. Una baja médica de 4 semanas en otoño 2026 paralizó el frente de captación de modelos, el deploy de Sightengine PROD, y la comunicación con Segpay simultáneamente. Cuando se reincorpora, el momentum se había perdido.

**Señal temprana.**
Cualquier mes con gasto personal real superior a €350. Si sucede 2 meses seguidos, pausar gastos opcionales y considerar pausa estratégica del frente comercial mientras se estabilizan los fijos.

---

## 4. Top 5 acciones preventivas — máxima palanca, antes del lanzamiento

Ordenadas por ratio impacto / esfuerzo. Las cinco caben en agosto-septiembre 2026 si se atacan en paralelo.

### #1 — Cerrar el bug de internal linking + gatear GTM antes del go-live público

**Por qué.** Sin esto, todo el SEO orgánico es invisible y todas las métricas que justifican (o no) activar paid son ruido. Pack mínimo recomendado del agente SEO: inyectar listado en `index.html` con `<noscript>` (4-6h) + gatear GTM por hostname (2h) + `BreadcrumbList` JSON-LD (1h) + IndexNow (2-3h). **Total: ~8-12h.**
**Cómo.** Frente dedicado de un solo sub-paquete antes del 2026-07-15.
**Métrica de éxito.** A 4 semanas del despliegue, GSC reporta crecimiento en URLs indexadas + GA4 muestra Direct < 30% del tráfico total.

### #2 — Activar paid traffic adult-specialist en M3 sin condicional

**Por qué.** El plan SEO solo no sostiene el negocio según el propio documento. Esperar a M6 para "evaluar palanca" es perder 3 meses operativos. Presupuestar €200-300/mes en TrafficJunky o ExoClick desde septiembre 2026, con landing dedicada y tracking de conversión segregado.
**Cómo.** Reservar €1.500 del runway personal para 6 meses de paid traffic (mejor que €1.500 quemados en costes fijos sin retorno). Cerrar IO con una red antes del 2026-09-30 con o sin SEO funcionando.
**Métrica de éxito.** En M6 (dic 2026), revenue mensual atribuible a paid > revenue atribuible a organic. Si paid no mueve la aguja, descartar y reasignar a PR sectorial o affiliates.

### #3 — Cerrar PSP con plan B contactado en paralelo, no después

**Por qué.** Esperar a la respuesta definitiva de Segpay antes de tocar el plan B es regalar 4-6 meses al fracaso. El propio documento dice "no se hace onboarding paralelo hasta que sea necesario" — esto debe cambiar **ahora**.
**Cómo.** Contactar Verotel/Vendo y RocketGate como conversación informal antes del 2026-08-15. Email con resumen del producto + posicionamiento adult dating intimate + estado del compliance. No pide onboarding, pide pre-cualificación. Si Segpay cierra, el plan B sigue dormido. Si Segpay no cierra, el plan B no arranca desde cero.
**Métrica de éxito.** Antes del 2026-09-30, tener al menos un PSP secundario con conversación abierta y feedback preliminar sobre el método de age verification (Didit Adaptive Age Verification).

### #4 — Producir los 5 PDFs Segpay con asesoría legal externa y nombrar Records Custodian

**Por qué.** `compliance-deliverables.md` y `known-risks.md` lo marcan como **bloqueante de go-live público**. Sin esto, abrir PROD es exponerse a congelación de la cuenta merchant. La pérdida potencial supera con creces el coste de la asesoría (€1.500-3.000 estimado).
**Cómo.** Contratar asesoría adult-experienced (la asesoría general no vale; este vertical exige experiencia específica con Mastercard AN 5196, Visa Rule ID 0003356, 2257). Cerrar las 5 políticas + declaración 2257 + nombramiento Records Custodian antes del 2026-08-31. Tracking de aceptación versionada de policies (deuda G3) en el mismo frente.
**Métrica de éxito.** Los 5 PDFs firmados, declaración 2257 desplegada en footer del SPA y Records Custodian con dirección física declarada antes del go-live público.

### #5 — Construir el pipeline de captación de modelos como frente dedicado, no como consecuencia del Reddit social-ops

**Por qué.** Sin masa crítica de modelos verificadas, el matching no funciona y el funnel se rompe en "no hay con quién hablar". Reddit social-ops es bueno pero lento. Hacen falta caminos paralelos.
**Cómo.** Definir un sub-paquete operativo antes del 2026-07-31 que incluya: (a) Contactar 5 agencies cam latam con propuesta white-label / referral; (b) Automatizar KYC modelo (de manual a automatización completa Didit-driven); (c) Cerrar la deuda R5 (Model Contract v5 alineado con posicionamiento intimate); (d) Bonus financiado plataforma para primeras 100 modelos (BFPM tipo, replicando el patrón de cliente); (e) Implementar 11.A (frame-difference anti-fraude) para defender la propuesta frente a abuso operativo de modelo.
**Métrica de éxito.** Al menos 50 modelos verificadas con `verification_status=APPROVED` antes del 2026-09-30, con al menos 30 con login activo en los últimos 7 días al 2026-10-31.

---

## 5. Acciones no incluidas en el top 5 pero registradas

Estas no caben en el top 5 por restricción de palanca, pero deben planificarse:

- Implementar país-gating granular US sub-estatal (F3) o cerrar US del beachhead inicial.
- Resolver el bug visual de Chromium desktop en RANDOM (F1) antes del go-live.
- Definir umbral de consolidación AWS si M3 confirma pesimista (E2).
- Validar empíricamente los 3 subs target restantes de ADR-040 (known-debt 2026-06-19).
- Reporting mensual al PSP automatizado: cualquier nil report fallado dispara revisión Segpay.
- Persistencia de logs `[AUTH-RISK]` en TEST (sigue manual).
- DPIA del flujo biométrico cliente — sin esto no se activa Didit en cliente con base jurídica defendible GDPR.

---

## 6. Cierre — qué hacer con este documento

Este pre-mortem es una herramienta de detección de puntos ciegos, no un veredicto. La hipótesis del operador (asumir pesimista, sostener €247/mes durante 18-24 meses, dejar que el SEO componga) sigue siendo defendible si y solo si:

- Los KPIs de M3 (sep 2026) muestran impresiones GSC creciendo 20-30% mes a mes;
- Las palancas alternativas (paid, PR, affiliates) tienen presupuesto reservado y mecanismo de activación en M6 sin necesidad de nueva decisión estratégica;
- Los bloqueantes de go-live (PSP, compliance formal, internal linking) están cerrados antes del 2026-09-30.

Si alguno de esos tres puntos falla, este pre-mortem debe releerse antes de tomar la siguiente decisión.

**Próxima revisión obligatoria del documento.** 2026-09-16 (M3, junto con la primera revisión del tracking mensual SEO). Comparar narrativa de fracaso vs realidad observada y archivar o actualizar.

---

## 7. Referencias

- `01-business/seo/estrategia.md` — Estrategia de tráfico orgánico, 18 meses.
- `01-business/seo/seo-baseline-snapshot-2026-06-21.md` — Hallazgos críticos de internal linking y GTM.
- `01-business/seo/tracking-mensual.md` — KPIs reales M0 vs plan.
- `01-business/financiero/modelo-financiero.md` — Decisión pesimista, €247/mes, break-even mes 15-16 normal.
- `01-business/psp-strategy.md` — Segpay condicional, plan B no contactado.
- `01-business/geographic-strategy.md` — Beachhead anglófono + oleada UE.
- `01-business/compliance-deliverables.md` — 5 políticas Segpay PLANIFICADAS, 2257 ausente.
- `01-business/sistema-tiers-modelos.md` — Tier 5-15 inicial, ventana 30d móvil.
- `04-operations/known-risks.md` — 45 riesgos vivos al 2026-06-28.
- `04-operations/known-debt.md` — 11 deudas estratégicas vivas tras Sightengine.
- `07-roadmap/{go-live-roadmap,current-phase,pending-hardening}.md` — Roadmap a GO LIVE.
- ADRs 028 / 029 / 035 / 036 / 037 / 040.

---

*Documento creado el 2026-06-29 como ejercicio de pre-mortem. No es una predicción operativa. Próxima revisión: 2026-09-16.*
