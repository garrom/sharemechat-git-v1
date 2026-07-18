# Plan de captación de tráfico — SharemeChat (Q3 2026)

> **Naturaleza del documento.** Análisis estratégico de palancas de captación de tráfico para el perfil específico del operador y las restricciones reales del proyecto. Responde a la causa #1 ("T1 — el SEO solo no llega y no hay plan B") identificada en `pre-mortem-launch-2026-07.md`.
>
> Construido sobre investigación deep-research del 2026-06-29 (5 ángulos, 22 fuentes fetchadas, 89 claims extraídos, 25 verificados con votación adversarial 3-vote, 12 confirmados / 13 refutados). El resultado completo del research está en el transcript del workflow `wf_7e348bf6-47b`. Las afirmaciones de este documento incluyen el voto de verificación entre paréntesis cuando proceden de él.
>
> Tono operativo: el operador es ingeniero, no marketer. Sin jerga, sin promesas. Análisis honesto para decidir dónde meter 30-45 h/semana durante 6 meses sabiendo que si no funciona el proyecto cierra.
>
> Próxima revisión obligatoria: 2026-09-30 (cierre de mes 3, junto con la revisión trimestral del tracking SEO).

---

## Hallazgo estructural que reescribe la premisa del plan

Antes de las tres fases, un hecho que el research destapó y que cambia el razonamiento:

**CooMeet, el comparable más cercano al posicionamiento "adult dating intimate 1-a-1", recibe el 81.18% de su tráfico orgánico desde la keyword branded "coomeet"** (301K búsquedas/mes, posición #1), más un 4.88% + 1.01% en misspellings de marca, totalizando ~87% branded. Verificado en `semrush.com/website/coomeet.com/overview/` (vote 3-0).

Implicación dura: **el SEO topical genérico no replica el modelo del comparable de referencia**. Lo que sostiene a CooMeet hoy es marca acumulada en años, no el cluster Omegle ni keywords transaccionales. SharemeChat puede sostener cadencia editorial (los 29 artículos del plan v4) como assets defensivos y para posicionamiento defensivo (cuando alguien busque "SharemeChat"), pero esperar que un blog nuevo en sector adult genere volumen vía keywords genéricas en 6 meses **es esperanza, no estrategia**. El research adversarial corroboró esto: el claim "SEO orgánico es viable como canal primario para SharemeChat" fue refutado 0-3 cuando se intentó verificar con datos de Similarweb y Semrush.

Consecuencia para el plan: las 3 palancas seleccionadas no son "SEO + complementos". Son **"3 palancas para construir marca y captar talento (modelos) mientras el SEO compone en segundo plano"**. La marca es la palanca real; el SEO es subordinado.

---

## FASE 1 — Catálogo de palancas €0-cash o low-cost (<100€/mes)

Cada palanca se cataloga con coste, tiempo del operador, curva de retorno, requisitos y ejemplos verificables. Las palancas refutadas por el research adversarial o explícitamente fuera de restricciones se listan al final con razón clara.

### P1 — SEO continuado del blog (cadencia 1/semana)

| Campo | Valor |
|---|---|
| Descripción | Cadencia 1 artículo/semana sobre el plan editorial v4 (29 artículos en cola). |
| Coste | €0 (tiempo operador + IA local). |
| Tiempo operador | 4-6 h/semana sostenido. |
| Curva de retorno | 3-6 meses primer tráfico significativo, 12-18 meses para volumen. Sandbox Google los primeros 3 meses. |
| Requisitos previos | Ya operativo (5 artículos publicados, pipeline editorial IA cerrado, sitemap funcionando). Falta resolver bugs SEO críticos del pre-mortem (internal linking, GTM gating). |
| Ejemplos verificables | CooMeet recibe 87% del orgánico desde keyword branded, no desde SEO topical (3-0). El SEO topical de los comparables aporta volumen marginal sobre la marca. |
| Veredicto | **Mantener pero subordinado.** No es palanca de adquisición primaria. Sí es asset defensivo + posicionamiento de marca + landing de conversión para otras palancas. |

### P2 — Trade PR editorial a XBIZ (sin coste, B2B)

| Campo | Valor |
|---|---|
| Descripción | Press releases a editores de XBIZ.com en categorías Web & Technology / Movies & Stars sobre lanzamiento de producto, novedad técnica/compliance, reclutamiento de modelos. |
| Coste | €0 si va vía editorial (no sponsored). Sponsored post empieza en $400-1500/mes según fuentes del sector — **fuera de presupuesto**. |
| Tiempo operador | 2-3 h por press release. Cadencia realista: 1-2 al mes (más sería forzado, hay límite de noticias reales del proyecto). |
| Curva de retorno | 4-8 semanas hasta primer pickup editorial, asumiendo ángulos relevantes. Los artículos publicados de XBIZ no traen tráfico consumer (no es su audiencia), pero sí generan: (a) credibilidad ante PSP, (b) descubrimiento por afiliados / agencies / modelos que leen el medio, (c) backlinks de dominio con autoridad. |
| Requisitos previos | Descubrir contactos editoriales (XBIZ no publica submission guidelines explícitas — verificado, vote 1-2 sobre claim de submission guidelines, ver caveat). Vía: LinkedIn de redactores listados en Muckrack + email directo. |
| Ejemplos verificables | XBIZ es trade press B2B fundada 1998 en LA. Audiencia: creators, performers, webmasters, brand execs, marketers, developers (3-0). Cobertura típica documentada por Muckrack: "DollPimp Debuts", "Devin Drills Launches New Paysite", "Tad Pole to Attend Exxxotica Minneapolis". Implica que un pitch "SharemeChat launches verified 1-to-1 platform with Didit KYC + Sightengine real-time moderation" encaja estructuralmente. |
| Veredicto | **Go.** Ratio impacto/esfuerzo razonable para B2B. NO esperar tráfico consumer; esperar credibilidad + atracción de afiliados/modelos. |

Sources: `xbiz.com/about`, `muckrack.com/media-outlet/xbiz`, `en.wikipedia.org/wiki/XBIZ`, `xbizmedia.com/contact-index.php`.

### P3 — Programa de afiliados propio (revshare, no PPS)

| Campo | Valor |
|---|---|
| Descripción | Plataforma de afiliados propia con tracking de referrals + dashboard de comisiones. Permite que terceros (creators, webmasters, blogs adult-adjacent) traigan clientes a cambio de % de revenue de por vida. |
| Coste | €0-50/mes. Implementación interna (operador es ingeniero) o usar Post Affiliate Pro (~50€/mes plan starter) si se prefiere no construir. CrakRevenue como red externa **NO es palanca para el operador**: es el aggregator donde se promocionan las plataformas establecidas (LiveJasmin, ImLive, Chaturbate, etc.); SharemeChat tendría que pagar por estar listado y eso implica volumen comprometido. |
| Tiempo operador | 30-50 h de implementación inicial (1 sub-paquete técnico). Después: 2-3 h/semana en gestionar afiliados activos (validación, soporte, pagos). |
| Curva de retorno | 2-4 meses desde despliegue hasta primer afiliado generando volumen. La curva depende del reclutamiento manual de afiliados, no del producto. |
| Requisitos previos | (a) Decisión de tasa: el benchmark verificado es **30-40% revshare lifetime** (CrakRevenue paga 40.15% revshare en ImLive, 10.24% en LiveJasmin, 18% en MyFreeCams) (3-0). CooMeet paga 40% revshare CPS + 5% sub-affiliate (vote 2-1, caveat: dato puede tener 1-2 años). (b) LTV medido del cliente: hoy no existe (pre-launch). Sin LTV no se puede fijar PPS sin quemar margen — por eso revshare, no PPS. (c) Infraestructura técnica de tracking + pagos (Wise para payouts internacionales, mínimo $50). |
| Ejemplos verificables | CrakRevenue aggrega 15+ programas cam major con 40+ advertisers (3-0). Tarifas publicadas (verificables en `crakrevenue.com/offers/cam/`): ImLive $175 PPS / 40.15% revshare lifetime; LiveJasmin $130 PPS + 10.24% revshare; Stripchat $168 PPS / 16.25% revshare; Jerkmate up to $20 PPL; MyFreeCams 18% revshare lifetime. |
| Veredicto | **Go, en revshare puro 35-40% lifetime inicial.** No usar PPS hasta tener LTV medido (6-9 meses post-lanzamiento). |

Sources: `crakrevenue.com/offers/cam/`, `crakrevenue.com/offers/cam/imlive-affiliate-program/`, `offervault.com/offer/...imlive-pps`, `affpaying.com/coomeet`.

### P4 — Reclutamiento directo de modelos como vector de tráfico

| Campo | Valor |
|---|---|
| Descripción | Cada modelo verificada activa atrae clientes propios (audiencia que ya tenía en redes/comunidades) — el reclutamiento de modelos no es solo problema de inventario, es **palanca de captación de clientes**. |
| Coste | €0 (KYC modelo via Didit en plan free hasta 500/mes). Posible incentivo de bienvenida (BFPM-style para modelos) si se decide. |
| Tiempo operador | 8-15 h/semana sostenido inicialmente. Outreach manual + onboarding + soporte privado. |
| Curva de retorno | 4-8 semanas hasta primeras 10 modelos onboarded; 12-24 semanas hasta 30-50 modelos activas que generan matching real. |
| Requisitos previos | (a) Identificar canales reales donde están las modelos — **aquí el research adversarial refutó las listas teóricas**: los claims sobre r/OnlyFansAdvice, r/OnlyFansPromotions, r/SexWorkersOnly como recruitment channels fueron refutados 0-3, además contradichos por la investigación humana del 2026-06-25 que confirmó ban para operadores en r/CreatorsAdvice, r/Fansly_Advice, r/SexWorkerSupport. La afirmación de DMs respetuosos en X (Twitter) a modelos como vector funcional también fue refutada 0-3. (b) Automatización del KYC modelo (hoy manual, deuda conocida). (c) Model Contract v5 alineado con posicionamiento adult dating intimate (deuda R5 de known-debt). |
| Ejemplos verificables | Ningún claim del research verificó plataformas adult cam que documentaran reclutamiento directo de modelos como vector primario de tráfico. La hipótesis es razonable pero está **menos respaldada por datos públicos** que las palancas anteriores. |
| Veredicto | **Go con cautela.** Es la palanca de mayor potencial estratégico (modelos = clientes vía audiencia propia), pero el vector concreto (qué canales, qué outreach) necesita validación experimental controlada porque las listas "obvias" fueron refutadas. |

### P5 — Comunidad propia: r/SharemeChat + Discord

| Campo | Valor |
|---|---|
| Descripción | Mantener r/SharemeChat (creado 12-jun-2026, 0 posts) y abrir Discord propio como hub de discusión + retención de modelos onboarded y clientes early. |
| Coste | €0 (Reddit + Discord free). |
| Tiempo operador | 3-5 h/semana en moderación + contenido + responder. |
| Curva de retorno | 6-12 meses para masa crítica (~100 miembros activos). Más rápido si se canaliza tráfico de otras palancas hacia la comunidad. |
| Requisitos previos | Disciplina de cadencia. Contenido (posts, AMAs, behind-the-scenes del proyecto técnico). |
| Ejemplos verificables | El research no encontró casos documentados específicos de plataformas cam 1-a-1 que usaran subreddit propio como motor primario; sí encontró ejemplo estructural (recomendación BHW de operadores: "Reddit con contenido watermarked de modelos, subreddits personales, promoción directa de modelos" — vote 2-1). |
| Veredicto | **Go como complemento, no como motor.** Tiene valor de retención y de canalizar conversión de otras palancas. No genera tráfico nuevo significativo por sí solo. |

### P6 — Reddit r/CamGirlProblems como karma-only sin disclosure

| Campo | Valor |
|---|---|
| Descripción | Continuar pipeline social-ops de comentarios genuinos en r/CamGirlProblems sin mencionar nunca SharemeChat. Acumula karma + observa conversaciones del sector + posicionamiento implícito del operador como conocedor. |
| Coste | €0. |
| Tiempo operador | 1-2 h/semana. |
| Curva de retorno | Indirecta. No genera tráfico directo. Construye sustrato de credibilidad operativa del operador. |
| Requisitos previos | Pipeline ya operativo (ADR-040, ADR-041). Disciplina de "jamás mencionar producto". |
| Ejemplos verificables | El research adversarial refutó la afirmación de que r/CamGirlProblems es canal documentado de reclutamiento de modelos (0-3). Pero la investigación humana del 2026-06-25 lo confirmó como único sub adult-ecosystem que no banea operadores en modo karma-only. |
| Veredicto | **Mantener al ritmo mínimo.** Aporta poco pero el coste es bajo. No invertir más horas aquí. |

### P7 — Quora answering en temas adult-adjacent

| Campo | Valor |
|---|---|
| Descripción | Responder preguntas en Quora sobre temas adult-adjacent (videochat, citas online, anonimato, alternatives Omegle, etc.) con respuestas largas y útiles que ocasionalmente puedan referenciar SharemeChat de forma natural. |
| Coste | €0. |
| Tiempo operador | 2-4 h/semana. |
| Curva de retorno | 3-6 meses primer tráfico medible. Quora indexa muy bien en Google y las respuestas longevas pueden generar tráfico durante años. |
| Requisitos previos | Cuenta Quora con bio honesta (no necesariamente revelar operador, pero sí no mentir). Estilo de respuesta útil-primero, promo-jamás. |
| Ejemplos verificables | El research no aportó casos documentados específicos de plataformas adult cam usando Quora como vector. La hipótesis está poco respaldada empíricamente, pero el coste de probar es muy bajo. |
| Veredicto | **Go como experimento controlado.** Asignar 2 h/semana durante 8 semanas y medir. Si a las 8 semanas no hay clicks medibles desde Quora hacia el sitio, abandonar. |

### P8 — Guest posting en blogs sex-tech / dating-tech adyacentes

| Campo | Valor |
|---|---|
| Descripción | Escribir artículos para blogs adyacentes (sex-tech, dating tech, privacy/security) con bio que enlace SharemeChat. |
| Coste | €0 si el blog acepta guest sin pago. Algunos exigen €50-200/post. |
| Tiempo operador | 6-10 h por post (research + redacción + pitch + revisión editorial). Cadencia realista 1/mes. |
| Curva de retorno | 8-12 semanas desde pitch hasta publicación; tráfico real depende de la audiencia del blog. Bajo en absoluto pero longevo. |
| Requisitos previos | Identificar blogs adyacentes que acepten guest posts + tienen audiencia relevante. Lista no investigada en profundidad por el research. |
| Ejemplos verificables | Ninguno verificado en el research. Práctica común en SEO general; aplicabilidad específica a sector adult no confirmada con casos. |
| Veredicto | **Diferir.** No es la palanca con mejor ratio. Considerar si una de las 3 principales falla. |

### P9 — Listings/directorios adult (TopCams, BestCamSites)

| Campo | Valor |
|---|---|
| Descripción | Listar SharemeChat en directorios review de cam sites (TopCams.com, BestCamSites.com, similares). |
| Coste | Free listing posible en algunos; muchos cobran por listing destacado ($100-500/mes). |
| Tiempo operador | 2-3 h de setup + actualización ocasional. |
| Curva de retorno | Inmediata si el listing es free y bien posicionado; nula si requiere paid. |
| Requisitos previos | Producto en estado mostrable (modelos activas, screenshots, USP claro). Hoy no aplica todavía. |
| Ejemplos verificables | El research no fetchó directorios concretos verificando políticas de listing free vs paid. |
| Veredicto | **Diferir hasta mes 4-5** (cuando haya producto mostrable). Probar variantes free; descartar paid. |

### P10 — Foros B2B AdultWebmasterForum / GFY

| Campo | Valor |
|---|---|
| Descripción | Participar en foros B2B de operadores adult para descubrir prácticas + visibilidad. |
| Coste | €0. |
| Tiempo operador | 3-5 h/semana. |
| Curva de retorno | Indirecta; no genera tráfico consumer. |
| Requisitos previos | Foros activos con masa de operadores discutiendo. |
| Ejemplos verificables | **Refutado 0-3** que `gfy.com` y `ynot.com` sigan siendo foros B2B activos principales. Estado actual de AdultWebmasterForum sin verificar en el research. |
| Veredicto | **No-go por ahora.** Open question: verificar estado real de GFY y AWF antes de invertir tiempo. Si están muertos, esta palanca no existe. |

### P11 — YouTube/TikTok adult-adjacent

**No-go.** TikTok y Meta prohíben referencia a sitios adultos en TOS. YouTube limita severamente y cierra cuentas si el canal apunta a sitio adult. Documentado en `estrategia.md`. Riesgo alto, retorno nulo.

### P12 — Email marketing

**No aplica pre-launch.** Sin base de leads no hay a quién enviar. Re-evaluar cuando hayan ≥500 registros (probablemente mes 6+).

### P13 — Partnerships con creadoras OnlyFans/Fansly con audiencia propia

**Hipótesis con baja evidencia.** Ningún claim del research verificó plataformas adult cam que documentaran este vector como funcional. Conceptualmente plausible (es una forma específica de P4 — reclutamiento de modelos), pero sin caso documentado. Tratar como variante exploratoria dentro de P4, no como palanca separada.

### Palancas explícitamente fuera de restricciones (mencionadas para registro)

- **Paid traffic en redes nicho adult** (TrafficJunky, ExoClick, JuicyAds, Adsterra): mínimo €200-500/mes para tracción real. Fuera de presupuesto. La afirmación de que el 40% del tráfico adult cam viene de estas redes fue **refutada 0-3** por el research; el mix real es menos claro pero el estructural sigue: las redes nicho son la vía estándar para escala paid en adult, y para SharemeChat eso es inaccesible hoy.
- **Sponsored posts en XBIZ/YNOT**: $400-1500/mes según el sector. Fuera de presupuesto.
- **Agency / consultor PR externo**: típicamente $2000+/mes. Restricción dura.
- **Programas de afiliados externos (CrakRevenue) como advertiser**: requieren volumen comprometido y suelen pedir setup fee + budget mensual. Fuera del modelo de SharemeChat hoy.
- **Multicuentas Reddit, compra de karma, bots, proxies pagos**: restricción dura, además de riesgo de baneo permanente que destruye la cuenta principal.
- **Press release sobre PRNewswire / PRWeb**: $300-800/post. Fuera de presupuesto.

---

## FASE 2 — Análisis comparativo para el perfil del operador

Filtrado de las 13 palancas anteriores contra restricciones duras. Tabla comparativa con scoring 0-10 en cada criterio. Total = suma / 60.

| Palanca | C1 Prob tráfico 90d (0-10) | C2 Volumen 6m (visitas/mes) | C3 Curva aprendizaje | C4 h/sem | C5 Sinergia | C6 Riesgo | Total /60 | Go/No-go |
|---|---:|---|---|---:|---|---|---:|---|
| P1 SEO continuado | 2 | 200-800 | 1-2 sem (ya soltura) | 4-6 | Alta con P5/P2 | Bajo | 28 | **Go** (subordinado) |
| P2 Trade PR XBIZ | 4 | 50-300 (B2B, no consumer) | 2-3 sem | 4-6 (1-2 posts/mes) | Alta con P3/P4 | Bajo | 34 | **Go** |
| P3 Afiliados propio | 5 | 100-1000 si 5-10 afiliados activos | 1-2 meses (setup + reclutamiento) | 4-6 sostenido tras setup | Muy alta con P2/P4 | Medio | 36 | **Go** |
| P4 Reclutamiento modelos | 6 (modelos atraen su audiencia) | 200-2000 (depende n modelos × audiencia/modelo) | 1-2 meses (validar canales) | 8-15 | Muy alta con P5 | Medio-alto (canales sin validar) | 38 | **Go (principal)** |
| P5 Comunidad propia | 1 | 50-500 | 1 sem | 3-5 | Alta con P4 | Bajo | 24 | **Go (complemento)** |
| P6 r/CamGirlProblems | 0 (cero disclosure) | 0 directo | 1 sem | 1-2 | Baja | Bajo | 12 | **Mantener mínimo** |
| P7 Quora answering | 3 | 50-300 | 1 sem | 2-4 | Media (sinergia con SEO) | Bajo | 24 | **Experimento 8 sem** |
| P8 Guest posting | 2 | 30-200 | 2-3 sem | 6-10/post | Media | Bajo | 22 | **Diferir** |
| P9 Listings adult | 3 (si free) / 0 (paid) | 100-500 si bien posicionado | 1 sem | 2-3 | Media con P2 | Bajo | 22 | **Diferir mes 4-5** |
| P10 Foros B2B | n/a (estado incierto) | n/a | n/a | n/a | n/a | n/a | n/a | **No-go** hasta verificar |

**Notas críticas sobre el scoring:**

- C1 (probabilidad 90 días) es **brutal en todas las palancas** porque adult + dominio nuevo + restricciones de paid es la peor combinación posible para tracción rápida. Ninguna palanca pasa de 6/10 honesto.
- C2 (volumen 6 meses) son rangos amplios porque el sector tiene **alta varianza** según ejecución. El extremo bajo es realista si el operador ejecuta consistentemente; el alto requiere tracción inesperada en alguna palanca.
- C4 (horas/semana) sumadas: las 4 palancas "Go" principales (P1+P2+P3+P4) suman 20-32 h/semana. Cabe en las 30-45 h disponibles del operador con margen para imprevistos. Añadir P5 (3-5 h) y P6/P7 (3-6 h combinadas) sigue dentro de presupuesto pero exige disciplina.
- C5 (sinergia) es donde se justifica la combinación: P2 (PR) atrae afiliados (P3) y modelos (P4); P4 (modelos) alimenta P5 (comunidad); P5 (comunidad) ayuda a retención + amplifica P1 (SEO via tráfico de marca). Es un sistema, no palancas sueltas.
- C6 (riesgo): P3 (afiliados) tiene riesgo medio porque si la tasa revshare se fija mal o si la economía de la plataforma no cuadra, el operador puede acabar pagando comisiones sobre clientes que no generan margen. P4 (modelos) tiene riesgo medio-alto porque los canales obvios fueron refutados y hay que descubrir los reales.

---

## FASE 3 — Plan operativo recomendado

### A. Combinación óptima: 3 palancas + 2 de soporte

**Palancas principales (motor):**

1. **P4 — Reclutamiento directo de modelos** (8-15 h/semana). Es la palanca con mayor potencial sistémico: modelos onboarded traen audiencia propia + sostienen matching + dan credibilidad.
2. **P3 — Programa de afiliados propio** (30-50 h setup + 4-6 h/semana después). Multiplica el alcance del operador. Cada afiliado activo es un canal independiente que el operador no tiene que ejecutar.
3. **P2 — Trade PR a XBIZ** (4-6 h/semana). Da credibilidad B2B + atrae afiliados y modelos (no consumers).

**Palancas de soporte (no motores, pero suman):**

4. **P1 — SEO continuado** (4-6 h/semana). Mantener cadencia. Asset defensivo + posicionamiento de marca.
5. **P5 — Comunidad propia** (3-5 h/semana). Discord + r/SharemeChat para retención de modelos onboarded + clientes early.

**Total horas/semana:** 23-38 (sostenido tras setup). Cabe en las 30-45 disponibles.

**Lo que se descarta o difiere:**

- P6 r/CamGirlProblems: mantener al mínimo (1-2 h/semana). No invertir más.
- P7 Quora: experimento controlado durante 8 semanas (2 h/semana). Si no genera tráfico medible, abandonar.
- P8 Guest posting, P9 Listings: diferir a mes 4-5 si hay tracción.
- P10 Foros B2B: no-go hasta verificar estado activo.
- P11 YouTube/TikTok, P12 Email, P13 Partnerships OF/Fansly: no aplican o sin evidencia.

### B. Plan 90 días dividido en fases

#### Semanas 1-2 — Aprendizaje + setup

**Objetivo de la fase:** dejar instaladas las 3 palancas principales antes de empezar a producir.

| Actividad | Tiempo | Output esperado |
|---|---|---|
| **P4-prep**: Mapear canales reales de captación de modelos | 6 h | Lista validada de 10-15 canales concretos (subs, Discord públicos, Telegrams, marketplaces tipo Modelhub, etc.) con política de cada uno respecto a operadores. **No usar las listas refutadas en el research**. Validar humanamente cada uno como se hizo en la investigación 2026-06-25. |
| **P3-setup técnico**: Diseñar e implementar tracking de afiliados | 20-30 h | Sub-paquete técnico: tabla `affiliates` + tracking link (`?ref=xxx` + cookie 90 días) + dashboard básico para el afiliado + cálculo de revshare mensual. Stack: lo que ya hay. |
| **P3-setup operativo**: Definir tasa, payout policy, terms | 4-6 h | Documento con: 35% revshare lifetime inicial, payout mensual via Wise a partir de $50 USD, terms vs fraud (refunds restados, chargebacks deducidos). Decisión registrada. |
| **P2-prep**: Identificar contactos editoriales XBIZ + redactar 1er pitch | 6-8 h | Hoja con 3-5 nombres de editores XBIZ (de Muckrack + LinkedIn) + draft de press release "SharemeChat — Adult 1-to-1 Verified Platform with Real-Time AI Moderation". |
| **P5-setup**: Abrir Discord oficial + reactivar r/SharemeChat | 3-4 h | Discord con canales mínimos (general, models-onboarding-help, clients-feedback, devlog) + reglas. r/SharemeChat con 3-4 posts iniciales (descripción producto + screenshots si los hay). |
| **Lectura/aprendizaje** del sector | 4-6 h | Leer: 5 últimos posts en XBIZ.com sobre lanzamientos cam recientes para calibrar tono. Documentación CrakRevenue (`crakrevenue.com/offers/cam/`) para entender economics de afiliados real. Cierre del sub-paquete Affiliates con ADR. |

**Total tiempo semanas 1-2:** 60-80 h (cabe en 2 semanas × 30-45 h con holgura).

**Métricas al cierre de semana 2:**
- Sub-paquete técnico de afiliados desplegado en TEST (no PROD todavía).
- 1 press release listo para enviar.
- 10-15 canales de modelos validados con política.
- Discord + r/SharemeChat operativos.

#### Semanas 3-6 — Ejecución inicial

**Objetivo de la fase:** producir resultados medibles en cada palanca.

| Palanca | Actividad sostenida | Ritmo | Métrica de la palanca |
|---|---|---|---|
| **P4** | Outreach a modelos en los 10-15 canales validados. Mensajes manuales personalizados (no copy-paste). | 10-15 outreach/semana | Modelos onboarded con KYC superado al final de semana 6. |
| **P3** | Reclutar primeros 5-10 afiliados manualmente. Email directo a webmasters identificables vía XBIZ + dueños de blogs sex-tech adyacentes. | 5-10 outreach/semana | Afiliados con cuenta creada al final de semana 6. |
| **P2** | Enviar press release 1 (semana 3). Si hay pickup en semanas 4-5, preparar press release 2 (semana 6) sobre métrica concreta (p.ej. "primeras 10 modelos verificadas"). | 1 PR/mes | Menciones XBIZ + replies de editor. |
| **P1** | Cadencia editorial 1 artículo/semana. Resolver bug crítico de internal linking del pre-mortem T2 al inicio de la fase. | 1/semana | Artículos indexados en GSC. |
| **P5** | 3 posts/semana en Discord + 1 post/semana en r/SharemeChat. | 4 posts/semana | Miembros únicos activos. |
| **P7** | Quora experimento: 2 respuestas/semana en preguntas adult-adjacent. | 2/semana | Views totales + clicks al sitio. |

**Total tiempo semanas 3-6:** 25-38 h/semana sostenido.

**Métricas al cierre de semana 6:**
- P4: ≥10 modelos verificadas con `verification_status=APPROVED` y al menos 5 con login activo.
- P3: ≥3 afiliados con cuenta creada, ≥1 con primer link de tracking generado.
- P2: 1 mención editorial en XBIZ o 1 reply de editor pidiendo más info.
- P1: 4 artículos publicados en el período, sitemap actualizado, al menos 50% indexados en GSC.
- P5: Discord con ≥20 miembros únicos, r/SharemeChat con ≥10 miembros.
- P7: ≥16 respuestas Quora, ≥1 click al sitio desde una de ellas.

#### Semanas 7-12 — Ajuste y escalado

**Objetivo de la fase:** doblar la apuesta en lo que funcione, abandonar lo que no, decidir si se abre a PROD público.

Decisión por palanca al inicio de semana 7:

| Palanca | Criterio escalar | Criterio abandonar | Pivote alternativo |
|---|---|---|---|
| **P4** | ≥10 modelos verificadas en semanas 3-6 → escalar a 20-30 modelos en semanas 7-12 | <5 modelos verificadas en semanas 3-6 → reevaluar canales y outreach script | Probar partnership directo con 1-2 agencies cam latam (referral fee fijo en lugar de outreach manual) |
| **P3** | ≥3 afiliados con cuenta + ≥1 link generado → escalar reclutamiento a 10-15 afiliados activos | <2 afiliados creados → diagnosticar fricción del proceso (terms? tasa? UX dashboard?) | Reducir esfuerzo en P3 y reinvertir horas en P4 |
| **P2** | ≥1 pickup XBIZ → preparar serie editorial (3 PR escalonadas mes 7-9) | 0 reply de editor en 6 semanas → reducir frecuencia PR a 1 cada 2 meses | Pivote a YNOT o AVN si XBIZ no responde |
| **P1** | Impresiones GSC creciendo 20-30% mes a mes → mantener cadencia | Impresiones planas → revisar bug internal linking + reescribir 2-3 keywords objetivo | Reducir cadencia a 1/quincena si no compone |
| **P7** | ≥5 clicks al sitio desde Quora en 8 semanas → mantener | <2 clicks → abandonar | n/a |

**Trigger de pivote estratégico completo:**

Si al final de semana 12 (fin del trimestre) el total de **clientes registrados con email verificado** es **< 5** y el total de **modelos verificadas activas** es **< 10**, las palancas no están funcionando. En ese punto las opciones reales son:

1. **Activar paid traffic adult-specialist** (TrafficJunky o ExoClick) con budget mínimo €200/mes durante 3 meses. Requiere abrir presupuesto fuera de la restricción actual o financiar con próximos meses de salario externo. Decisión personal del operador.
2. **Pivote a posicionamiento más concreto** dentro del nicho (no pivote de modelo de negocio, sino de propuesta de valor — p.ej. "el único 1-a-1 con KYC verified + moderación real-time": doblar ese ángulo en todas las palancas).
3. **Pausa estratégica** del frente comercial mientras se replantea (mantener costes fijos al mínimo, sin abandonar el proyecto).

### C. Señales de éxito o fracaso a vigilar cada 2 semanas

Revisión bisemanal el domingo, junto con la revisión semanal P7 del operador.

| Métrica | Fuente | Umbral éxito (escalar) | Umbral fracaso (revisar palanca) |
|---|---|---|---|
| Modelos verificadas con login últimos 7d | BD: `users WHERE role=MODEL AND verification_status=APPROVED AND last_login > NOW()-7d` | Crecimiento +2/quincena sostenido | 0 nuevas en 2 quincenas seguidas |
| Afiliados con cuenta + tracking link generado | BD: tabla `affiliates` | +1/quincena sostenido | 0 nuevas en 2 quincenas seguidas |
| Sesiones GA4 desde tráfico **no-Direct** | GA4 Acquisition (excluir Direct) | +20% bisemanal | Planas o descendentes 4 quincenas seguidas |
| Impresiones GSC | GSC | +15% bisemanal | Planas 4 quincenas seguidas |
| Menciones XBIZ (búsqueda manual "sharemechat" en xbiz.com) | xbiz.com search | ≥1 nueva mes 2 / ≥3 mes 3 | 0 al mes 3 |
| Miembros únicos activos Discord (mensaje en últimos 14d) | Discord admin | +5/quincena | Planas con <20 totales mes 2 |
| Primeras transacciones reales (cuando se active PSP) | BD: `transactions WHERE type=INGRESO AND amount>0` | ≥3 mes 3 / ≥10 mes 6 | 0 al mes 3 |

**Trigger de pivote estratégico completo (ya enunciado en B):** <5 clientes registrados con email verificado + <10 modelos verificadas activas al final de semana 12 → activar una de las 3 opciones (paid, pivote propuesta valor, pausa).

### D. Riesgos del plan

**Lista honesta de qué puede salir mal y dónde están los puntos ciegos.**

1. **El reclutamiento de modelos puede ser más lento de lo previsto.** El research adversarial refutó las listas obvias de canales (subreddits OF, X DMs). Significa que el operador tendrá que descubrir empíricamente qué canales funcionan. Es trabajo de validación con tasa de éxito incierta. **Asunción frágil**: que existen canales adult-friendly accesibles al operador que aún no se han identificado. Si no existen, P4 se queda sin combustible.

2. **El programa de afiliados puede no atraer afiliados sin LTV demostrado.** Los afiliados experimentados del sector eligen plataformas con métricas conocidas. SharemeChat pre-launch no tiene track record. **Asunción frágil**: que afiliados pequeños / nuevos / amigos del sector aceptarán probar SharemeChat por la tasa competitiva (35-40% revshare) a pesar de no tener métricas. Realidad: probablemente los primeros 5-10 afiliados serán contactos personales del operador + creators muy nichos, no afiliados profesionales.

3. **XBIZ puede no responder a un operador desconocido.** El research confirmó que XBIZ no publica submission guidelines. Sin contacto editorial cultivado, el primer PR puede ir al spam. **Asunción frágil**: que un email frío bien redactado a un editor de Muckrack tendrá respuesta. Realidad: tasa de respuesta de cold email a editorial press está típicamente en 5-15%.

4. **El operador puede saturarse con 25-30 h/semana sostenidas durante 12 semanas.** La estimación de "30-45 h/semana disponibles" es teórica; en la práctica hay enfermedades, urgencias del trabajo Ayesa, agotamiento, vida personal. **Asunción frágil**: cadencia operativa sostenida 12 semanas sin descansos. Realidad: planificar 1 semana de buffer cada 4-5 es necesario.

5. **Las 3 palancas están correlacionadas en su éxito.** Si XBIZ no funciona, los afiliados profesionales no descubren la plataforma. Si los afiliados no se atraen, el reclutamiento de modelos no escala más allá del outreach manual del operador. Si las modelos no atraen su propia audiencia, no hay clientes. **El sistema es frágil porque cada palanca depende de la siguiente.** Punto ciego: no hay una palanca completamente independiente que dé resultado garantizado aunque las otras fallen.

6. **El bug crítico de internal linking del pre-mortem T2 sigue sin resolver al inicio del plan.** Si no se cierra en semanas 1-3, el SEO sigue siendo invisible y la palanca P1 no compone. Riesgo de que se posponga "porque no es el frente activo".

7. **La economía del programa de afiliados puede romperse sin LTV.** Si se promete 35-40% revshare lifetime y el LTV real es bajo, el operador puede acabar pagando comisiones que excedan el margen. **Mitigación**: limitar afiliados activos a 10-20 primeros meses; medir LTV a 3 meses post-lanzamiento; ajustar tasa para nuevos afiliados con clausula de revisión documentada en terms.

### E. Hitos esperables si el plan funciona

Realistas, no optimistas. Si la realidad es peor, releer este documento y la sección D.

**Mes 1 (julio 2026):**
- Setup técnico afiliados completado.
- 5-10 modelos en pipeline KYC (no necesariamente APPROVED todavía).
- 1 PR enviado a XBIZ. Pickup esperado: 0-1.
- Discord operativo con 10-15 miembros (incluyendo operador + 1-2 amigos invitados).
- 4 artículos blog publicados, sitemap creciendo.
- **Métricas críticas**: ≥3 modelos verificadas, ≥1 afiliado con cuenta, 0-2 menciones XBIZ.

**Mes 3 (septiembre 2026) — umbral "coming soon" → lanzamiento privado:**
- 10-20 modelos verificadas activas (criterio: login en últimos 7d).
- 3-5 afiliados con cuenta, 1-2 con link generado.
- 1-3 menciones XBIZ acumuladas.
- 8-12 artículos blog publicados, GSC con impresiones crecientes.
- 5-15 clientes registrados con email verificado (mayoría amigos + traídos por afiliados early).
- **Decisión de fase**: si se cumplen ≥10 modelos + ≥5 clientes verificados, abrir a "lanzamiento privado limitado" (Fase 4 del roadmap go-live: PROD privado funcional). Si no, mantener PRELAUNCH.

**Mes 6 (diciembre 2026) — tracción medible:**
- 30-50 modelos verificadas activas.
- 8-15 afiliados, 3-5 generando referrals con actividad.
- Tráfico orgánico no-Direct: 500-2000 sesiones/mes.
- 5-10 menciones XBIZ acumuladas + posiblemente 1 en YNOT o AVN.
- 20-50 clientes activos (compraron al menos 1 pack).
- **Decisión de fase**: si se llega a 25 clientes + 25 modelos del objetivo del operador, considerar Fase 5 (PROD público limitado) con apertura progresiva. Si no se llega, releer plan completo y considerar paid traffic.

**Honestidad de los hitos:** estos números están **alineados con el escenario pesimista del modelo financiero** (`modelo-financiero.md`) que el operador ya aceptó. No son optimistas. Cualquier cifra mayor sería sorpresa positiva; cualquier cifra menor obliga a la decisión del trigger de pivote.

---

## Notas finales

### Lo que cambia respecto al pre-mortem

El pre-mortem (T1) decía "el SEO solo no llega y no hay plan B". Este plan **es** el plan B. No depende de SEO. Depende de marca + afiliados + modelos. SEO es asset complementario que compone en segundo plano.

El pre-mortem (T5) decía "el operador no activó paid traffic por bloqueo psicológico". Este plan **explícitamente no propone paid traffic** porque está fuera de presupuesto. Pero define un trigger duro (mes 3, <5 clientes y <10 modelos) que obliga a la decisión: o se abre presupuesto para paid, o se pivota propuesta de valor, o se pausa. La decisión no se difiere indefinidamente.

### Para considerar cuando haya más presupuesto

Listo como registro, no como acción inmediata. Si el plan funciona y hay revenue sostenido en mes 6:

- **€200-500/mes en TrafficJunky o ExoClick** con landings dedicadas a cluster Omegle / "videochat verificado" / segmentos US tier-1.
- **Sponsored post en XBIZ Newsletter** ($400-1500/mes según fuente). Tras tener pickup editorial orgánico que justifique el sponsored.
- **Listing en CrakRevenue** como advertiser para acelerar reclutamiento de afiliados profesionales. Requiere comprometer presupuesto mensual fijo.
- **Asesoría legal externa adult-experienced** para cerrar las 5 políticas CardBilling / Verotel + 2257 + Records Custodian (€1500-3000 one-shot). Crítico para go-live público según pre-mortem B1+B2.

### Próxima revisión obligatoria

**2026-09-30** (cierre de mes 3). Revisar este plan contra realidad observada:
- ¿Cuántas modelos verificadas? Comparar con 10-20 esperadas.
- ¿Cuántos afiliados? Comparar con 3-5 esperados.
- ¿Cuántos clientes verificados? Comparar con 5-15 esperados.
- ¿Pickup XBIZ? Comparar con 1-3 esperados.
- **Decisión binaria**: avanzar a Fase 4 (PROD privado funcional) si se cumplen umbrales, o disparar trigger de pivote estratégico si no.

---

## Fuentes y verificación

Investigación deep-research ejecutada el 2026-06-29. Transcript completo en `workflows/wf_7e348bf6-47b`. Resumen de verificación adversarial: 12 claims confirmados (3-0 o 2-1), 13 claims refutados (0-3 o 1-2).

### Fuentes primarias y secundarias usadas

- `https://en.wikipedia.org/wiki/XBIZ` — historia y posicionamiento XBIZ (3-0).
- `https://muckrack.com/media-outlet/xbiz` — contactos editoriales y cobertura típica (3-0).
- `https://www.xbiz.com/about` — auto-descripción B2B (3-0).
- `https://xbizmedia.com/contact-index.php` — contacto general (info@xbiz.com, no editorial específico).
- `https://www.crakrevenue.com/offers/cam/` — listado de programas cam aggregados (3-0).
- `https://www.crakrevenue.com/offers/cam/imlive-affiliate-program/` — tarifas concretas ImLive (3-0).
- `https://offervault.com/offer/cbcaf4a16fceb18018f3888e64e639e4/imlive-pps` — verificación cruzada tarifas (3-0).
- `https://www.affpaying.com/coomeet` — tarifas CooMeet afiliados (2-1, caveat: dato puede tener 1-2 años).
- `https://www.semrush.com/website/coomeet.com/overview/` — mix de tráfico CooMeet (3-0 sobre 81% branded).
- `https://journals.sagepub.com/doi/full/10.1177/29768624251408916` — paper académico sobre ecosistema publicitario adult (3-0).
- `https://www.blackhatworld.com/seo/journey-from-masterbater-to-adult-webmaster.1371260/` — quote BHW sobre SEO whitelabel (2-1).

### Claims importantes refutados (lo que el operador NO debe usar como base)

- "40% del tráfico adult cam viene de redes nicho" (0-3).
- "CooMeet 89.99% organic vs 10.01% paid" (0-3) — la realidad es más matizada, el 81% branded del orgánico cambia la interpretación.
- "r/OnlyFansAdvice, r/OnlyFansPromotions, r/SexWorkersOnly como recruitment channels" (0-3) — además contradichos por investigación humana 2026-06-25.
- "X (Twitter) DMs respetuosos a modelos como vector funcional" (0-3).
- "gfy.com y ynot.com siguen siendo foros B2B activos principales" (0-3) — estado actual incierto.
- "LuckyCrush usa Display advertising como canal primario" (0-3).
- "LuckyCrush opera in-house affiliate con 30% revshare CPS" (1-2).

---

*Documento creado el 2026-06-29 como respuesta operativa a la causa T1 del pre-mortem. Próxima revisión: 2026-09-30.*
