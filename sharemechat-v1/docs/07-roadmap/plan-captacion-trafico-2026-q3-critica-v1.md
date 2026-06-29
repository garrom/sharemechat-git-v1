# Crítica adversarial v1 — plan de captación de tráfico Q3 2026

> **Naturaleza del documento.** Revisión adversarial al plan redactado en [`plan-captacion-trafico-2026-q3.md`](plan-captacion-trafico-2026-q3.md) (2026-06-29). Tres observaciones del Claude.ai planner + revisión del operador. Veredictos honestos: ajustar, defender o reconocer mérito parcial. Cronograma v2 de semanas 0-6 si hay ajustes. No reescribe Fase 2 ni hitos de Fase 3.E.
>
> Fecha: 2026-06-29.

---

## A. Respuesta a Observación 1 — semana 0 de validación P4 antes de invertir en P3

**Veredicto: AJUSTE.**

La observación tiene mérito real, no parcial. El plan original en `plan-captacion-trafico-2026-q3.md` sección 3.B asigna 6 horas a "P4-prep mapear canales reales" en paralelo con 30-50 horas de "P3-setup técnico" en semanas 1-2. **Eso no es validación, es mapeo.** Mapear 10-15 canales y leer sus reglas no demuestra que el outreach realmente funcione; demuestra que los canales existen. Para validar hay que enviar 5-10 mensajes reales y medir tasa de respuesta — eso es 15-25 horas de trabajo, no 6.

El contra-argumento del paralelismo ("son frentes independientes") es **técnicamente cierto pero estratégicamente débil**. P3 (afiliados) sí es un sistema autónomo, pero el reclutamiento de afiliados depende de que alguien descubra SharemeChat — y los dos canales principales de descubrimiento son P2 (XBIZ → afiliados profesionales) y P4 (modelos onboarded → algunas también afiliadas). Si P4 no tiene canal accesible y P2 tarda 4-8 semanas en producir pickup, los primeros 30-50 h de P3 quedan invertidos en un sistema sin tráfico que monetizar. La sección 3.D del plan original ya reconocía este riesgo: *"el sistema es frágil porque cada palanca depende de la siguiente"*. La observación pide ser coherente con ese reconocimiento.

Ajuste concreto: insertar una **semana 0** dedicada a validación P4 (3-4 canales candidatos, 10-15 outreach reales, medir tasa de respuesta), con P2-prep en paralelo (research + draft de press release no requiere ningún canal validado). Si la validación P4 arroja 0 canales con respuesta en 1 semana, **detener P3 antes de empezar setup técnico** y replanear. Si la validación P4 da al menos 1 canal con respuesta medible (≥10% reply rate sobre 10 outreach), proceder con P3 confiados.

---

## B. Respuesta a Observación 2 — mover P2 (XBIZ pitch) antes que P3 (afiliados)

**Veredicto: MÉRITO PARCIAL.**

El plan original sí difería el primer envío de PR a semana 3 sin razón estructural ("Sem 3-6: ejecución inicial"). Eso es un artefacto de la división arbitraria en fases, no una restricción real. P2 es 4-6 h de trabajo y no depende de nada técnico. **Adelantarlo a semana 2 (no semana 1)** es razonable y consistente con que el lead time editorial está fuera del control del operador. Cuanto antes se siembre, antes incuba.

Pero la propuesta del planner de "P2 primero (semana 1)" sobrestima el efecto. Aunque el PR salga en semana 1, la respuesta editorial puede llegar en semana 5-8 indistintamente. El plan original demoraba el envío 2 semanas; adelantarlo gana 2 semanas en el reloj, no acelera nada estructuralmente. **Es una mejora operativa pequeña, no un cambio de orden de palancas.** El plan no propone que P2 vaya "después" de P3; ambos arrancan en semanas 1-2 según el plan original. La crítica de que "P2 va antes que P3" es semánticamente correcta pero el plan ya lo permitía si se ejecuta en el orden natural (PR no requiere setup técnico).

Ajuste concreto: en el cronograma v2 dejar **enviar primer PR en semana 2** (no semana 3), una vez identificados los 3-5 contactos editoriales y redactado el draft. El operador no debe esperar a "abrir la fase de ejecución" — la fase es una etiqueta del documento, no un constraint operativo.

---

## C. Respuesta a Observación 3 — atar el Discord (P5) al onboarding de modelos (P4)

**Veredicto: AJUSTE.**

El contra-argumento ("el plan ya lo asume implícitamente en sección 2 — sinergia C5") es **defensiva débil**. Que el plan mencione "sinergia entre P4 y P5" no significa que el plan operacionalice cómo se concreta esa sinergia. El cronograma original abre Discord en semanas 1-2 como workstream independiente (3-4 h de setup) y luego pide "3 posts/semana en Discord" en semanas 3-6 sin especificar **quién está en el Discord**. Si el operador es el único miembro en semana 6, los 3 posts/semana son ruido.

El planner tiene razón: el Discord tiene que estar atado al flujo de KYC modelo desde el momento en que los primeros modelos verifican. La integración natural es: post-KYC `APPROVED` → email automático con invitación al Discord privado de modelos + acceso a canal `models-onboarding-help`. Esto convierte el Discord en parte del onboarding, no en canal lanzado en vacío. r/SharemeChat queda separado como slow-burn público y no necesita esta atadura.

Ajuste concreto: **demorar la apertura del Discord a cuando haya al menos 1 modelo en pipeline KYC** (probablemente semana 2-3 si la validación P4 da fruto). Convertir "P5-setup Discord 3-4h" en "P5-setup Discord integrado en flujo KYC modelo: 2h de setup + 2h de integración email de invitación al Discord en post-approval webhook hook". El setup baja en tiempo absoluto porque parte del trabajo es código que ya existirá en P4 (notification al modelo al pasar KYC).

---

## D. Cronograma v2 de semanas 0-6

Solo este bloque cambia respecto al plan original. Las semanas 7-12 (escalado), señales de éxito/fracaso (3.C), riesgos (3.D) e hitos (3.E) **siguen vigentes sin modificación**.

### Semana 0 — Validación de hipótesis P4

**Objetivo:** validar empíricamente que existe al menos 1 canal accesible para reclutamiento de modelos antes de invertir 30-50 h en setup técnico de P3.

| Actividad | Tiempo | Output esperado |
|---|---|---|
| **P4-mapeo**: Lista de 10-15 canales candidatos | 6 h | Lista con: nombre canal, política respecto a operadores (verificada humanamente, no asumida), URL, formato esperado de mensaje. NO usar listas refutadas en el research del 2026-06-29. |
| **P4-validación**: Outreach real a 10-15 modelos en 3-4 canales prioritarios | 12-18 h | 10-15 mensajes manuales personalizados enviados. Registro de quién respondió y en qué tono. |
| **P2-prep**: Identificar contactos editoriales XBIZ + redactar 1er pitch | 6-8 h | Hoja con 3-5 nombres de editores XBIZ (Muckrack + LinkedIn) + draft de press release "SharemeChat — Adult 1-to-1 Verified Platform with Real-Time AI Moderation". |
| **Decisión binaria al cierre semana 0** | 1 h | Si ≥1 canal con reply rate ≥10% (es decir, ≥1 respuesta humana sobre 10 outreach): seguir con cronograma. Si 0 canales con respuesta: **detener P3 antes de setup técnico** y dedicar semana 1 a expandir mapeo + outreach. |

**Total semana 0:** 25-33 h. Cabe en una semana del operador.

### Semanas 1-2 — Setup paralelizado + primer PR

**Objetivo:** dejar P3 instalado y P2 sembrado.

| Actividad | Tiempo | Output esperado |
|---|---|---|
| **P3-setup técnico**: tabla `affiliates` + tracking link + dashboard + cálculo revshare | 30-50 h (realista 40-60h; ver sección E abajo) | Sub-paquete técnico desplegado en TEST. |
| **P3-setup operativo**: Definir tasa, payout policy, terms | 4-6 h | Documento con: 35% revshare lifetime inicial, payout mensual via Wise a partir de $50 USD, terms vs fraud (refunds restados, chargebacks deducidos). Decisión registrada como ADR o entrada en `business-model.md`. |
| **P2-envío PR 1 a XBIZ** (semana 2) | 2 h | Press release enviado a 3-5 editores identificados en semana 0. Ángulo: launch de plataforma + USP (KYC Didit + Sightengine real-time). |
| **P4-outreach continuado** sobre canales validados en semana 0 | 8-10 h/semana | 8-10 outreach/semana sobre el canal validado. |
| **P1-cadencia editorial blog** | 4-6 h/semana | 1 artículo publicado/semana. |

**Total semanas 1-2 combinadas:** 50-80 h. Cabe en 2 semanas × 30-45 h con buffer.

### Semanas 3-6 — Ejecución sostenida + Discord cuando hay modelos

**Objetivo:** producir resultados medibles. Discord se abre cuando hay materia prima (primer modelo verificado o en pipeline avanzado).

| Palanca | Actividad | Ritmo | Trigger |
|---|---|---|---|
| **P4** | Outreach sostenido sobre canales validados | 10-15 outreach/semana | Continuo desde semana 1 |
| **P3** | Reclutar primeros 5-10 afiliados manualmente. Email directo a webmasters identificables vía XBIZ + dueños de blogs sex-tech adyacentes. | 5-10 outreach/semana | A partir semana 3 (P3 desplegado) |
| **P2** | Si pickup XBIZ en semanas 4-5, preparar PR 2 sobre métrica concreta ("primeras 10 modelos verificadas"). | 1 PR/mes | Reactivo a respuesta editorial |
| **P5 — Discord** | Abrir cuando haya **≥1 modelo en pipeline KYC**. Setup 2h + integración email post-approval 2h. | Reactivo a P4 | Semana 3-4 esperable |
| **P5 — r/SharemeChat** | 1 post/semana, slow-burn público | 1/semana | Semana 1 en adelante |
| **P1** | Cadencia editorial 1/semana. **Resolver bug crítico internal linking del pre-mortem T2 en semana 1-2** (no diferir). | 1 artículo/semana | Continuo |
| **P7 Quora** | Experimento controlado. 2 respuestas/semana en preguntas adult-adjacent. | 2/semana | Continuo |

**Métricas al cierre de semana 6 (sin cambios respecto al plan original):**
- P4: ≥10 modelos verificadas con `verification_status=APPROVED` y al menos 5 con login activo.
- P3: ≥3 afiliados con cuenta creada, ≥1 con primer link de tracking generado.
- P2: 1 mención editorial en XBIZ o 1 reply de editor pidiendo más info.
- P1: 4 artículos publicados en el período, sitemap actualizado, ≥50% indexados en GSC.
- P5: Discord con ≥10 miembros (5 modelos + operador + 2-3 amigos invitados), r/SharemeChat con ≥10 miembros.
- P7: ≥16 respuestas Quora, ≥1 click al sitio.

**Diferencia neta con el plan v1:**
- Plan total se alarga 1 semana (semana 0 añadida).
- Discord se abre 2-3 semanas más tarde, pero arranca con masa de modelos en lugar de vacío.
- Primer PR sale en semana 2 en lugar de semana 3.
- La decisión binaria al cierre de semana 0 protege de invertir 30-50 h en P3 sin canal de tráfico validado para P4.

---

## E. Otros puntos que reconsidero tras esta crítica

**Sí hay tres adicionales que conviene marcar honestamente:**

1. **Estimación del setup técnico P3 (30-50 h) está optimista.** El sistema completo de afiliados incluye: tabla DB + migration, generación de tracking link, captura de cookie 90 días, dashboard del afiliado (UI), cálculo de revshare mensual, payout flow vía Wise (manual u online), terms y política antifraude documentada. El operador es frontend developer pero esto es full-stack. Realista: **40-60 h, no 30-50 h**. Ajuste sutil pero importante para no quemar la semana 1-2.

2. **El ritmo "10-15 outreach/semana" sostenido desde semana 3 está optimista para un operador sin experiencia previa.** Los primeros 5-10 outreach incluyen curva de aprendizaje: ajustar tono, formato de mensaje, prueba/error de qué timing funciona. Realista: 5-8 outreach/semana en semanas 3-4, escalando a 10-15 en semanas 5-6 una vez calibrado el script. El plan original no lo articulaba.

3. **El total combinado de horas en semanas 1-2 del plan v1 (60-80 h) está al límite máximo de la capacidad declarada (30-45 h × 2 semanas = 60-90 h).** Sin buffer para imprevistos del trabajo Ayesa o vida personal. La crítica adversarial no lo plantea explícitamente, pero el cronograma v2 lo agrava al añadir semana 0. **Recomendación operativa**: planificar 1 semana de buffer entre semanas 4 y 5 (o equivalente) para absorber inevitables retrasos. No es un cambio del cronograma, es honestidad sobre la velocidad real sostenible.

Estos tres puntos no son crítica del planner — son auto-honestidad sobre el plan original. Los flagueo porque la pregunta E lo pide.

**No reconsidero:**

- La selección de las 3 palancas principales (P4 + P3 + P2). El research adversarial sigue confirmándolas.
- El descarte de palancas refutadas (X DMs a modelos, r/OnlyFansAdvice como recruitment channel, GFY/YNOT como foros activos).
- El trigger duro de pivote a semana 12 (<5 clientes verificados + <10 modelos verificadas → 3 opciones binarias).
- Los hitos esperables mes 1 / mes 3 / mes 6 de la sección 3.E del plan v1.

---

## Resumen ejecutivo

| Observación | Veredicto | Acción |
|---|---|---|
| 1. Semana 0 de validación P4 antes de P3 | **AJUSTE** | Insertar semana 0 con outreach real + decisión binaria al cierre |
| 2. Mover P2 antes que P3 | **MÉRITO PARCIAL** | Adelantar primer PR a semana 2 (no semana 3); orden estructural ya estaba bien |
| 3. Atar Discord al onboarding de modelos | **AJUSTE** | Demorar apertura Discord a cuando haya ≥1 modelo en pipeline KYC; integrar en email post-approval |

**Cambio neto en el cronograma:** +1 semana (semana 0). Riesgo de inversión técnica P3 sin canal P4 validado: mitigado. Discord arranca con masa, no en vacío. Primer PR sale 1 semana antes de lo planeado.

**Próxima revisión obligatoria del cronograma v2:** al cierre de semana 0 (decisión binaria sobre canales P4). Si la validación falla, **el plan se reabre antes de continuar** — no se sigue automáticamente al cronograma original con la esperanza de que algo aparezca.

---

*Documento creado el 2026-06-29. Versión v1 de la crítica adversarial sobre el plan principal.*
