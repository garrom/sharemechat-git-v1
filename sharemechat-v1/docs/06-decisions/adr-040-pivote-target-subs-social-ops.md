# ADR-040 — Pivote estratégico del target de subs en el pipeline social-ops: de subs casuales a subs adult-ecosystem (clients + models)

## Estado

Aceptada — 2026-06-18.

## Contexto

El pipeline social-ops definido en [ADR-034](adr-034-social-ops-methodology.md) cubre la metodología base ("automatizar el pensar, no el publicar"). El modo `thread_comment` añadido en [ADR-039](adr-039-pipeline-social-modo-thread-comment.md) extiende esa metodología con dos capacidades: descubrir threads candidatos en subs target (script `social-thread-finder.ps1`, justificado en [ADR-038](adr-038-social-reddit-warmup-rss-not-oauth.md)) y redactar 2 variantes de comentario por thread.

La lista de subs target original de ADR-039 era `r/AskReddit`, `r/CasualConversation` y `r/Showerthoughts`. La elección de esos subs se hizo cuando el objetivo era **acumular karma puro en cuentas anglo de alto tráfico**, sin considerar el carácter marca-explícito de `u/sharemechat`.

Durante la validación previa a FASE 2C el operador detectó dos disonancias operativas reales:

1. **La bio del perfil es marca-explícita**: *"Private 1-to-1 video chat with verified models. Pay per minute, no subscriptions. 18+"*. Comentar en subs casuales con voz coloquial anclada en vivencias personales genera dissonance cuando un lector abre el perfil y se topa con un servicio adulto.
2. **La voz performativa no se sostiene**: redactar comentarios sin marca durante semanas mientras la cuenta lo es se traduce en esfuerzo elevado del operador para esquivarla en cada frase, sin retorno aparente en términos de captación de usuarios reales.

Además, en la dimensión de negocio, SharemeChat necesita **dos públicos distintos** que el pipeline social-ops anterior no diferenciaba:

- **Clientes** (usuarios que pagan por minuto): los subs casuales no canalizaban ningún tráfico cualificado hacia este lado.
- **Modelos** (talento que opera en la plataforma): sin modelos no hay servicio. La competencia directa (Coomeet, LuckyCrush, Chaturbate, StripChat, BongaCams, MyFreeCams, Jerkmate) capta modelos vía Reddit en subs del ecosistema adulto que el pipeline anterior ignoraba.

## Decisión

**Pivotar el target de subs del modo `thread_comment` de subs casuales a subs adult-ecosystem**, diferenciando dos dimensiones operativas: captación de clientes y captación de modelos.

### 1. Lista final de subs target (validados humanamente 2026-06-18)

| Sub | `target_audience` | `rol` | Notas operador |
|---|---|---|---|
| `r/CreatorsAdvice` | `both` | `target_brand_fit` | Validado. Audiencia mixta creators NSFW + lurkers. |
| `r/SexWorkerSupport` | `models` | `target_brand_fit` | Validado. Sub pequeño (~633 visitas/sem), útil como fuente de research adicional. |
| `r/CamGirlProblems` | `models` | `target_brand_fit` | Validado. PRIORITARIO (~226k visitas/sem). Threads de problemas operativos = ventana directa al ángulo plataforma. |
| `r/Fansly_Advice` | `models` | `target_brand_fit` | Validado. Slug exacto con guion bajo. ~22k visitas/sem. Target competencia directa OF/Fansly. |

Decisión "4 subs y no 5" descrita en el informe FASE 2D-1.5: con `comment_karma: 1` y 8 días de cuenta, 1-2 comentarios por sesión es el techo realista. 4 subs cubren ambas dimensiones (2 lean clients + 2 lean models) en 2-3 sesiones; 5 obligan a saltar alguno en cada rueda. Simetría 50/50 entre dimensiones.

### 2. Subs descartados explícitamente

- **`r/AdultContentCreators`**: validación humana detectó que el sub está dominado por **fotos** (creators promocionando contenido visual), no por discusión profesional. Comentar de texto en hilos de fotos no aporta ni a la cuenta ni a la audiencia.
- **`r/CamModelCommunity`**: **banneado por Reddit** (validación humana). El status anterior conocido era "quarantined"; en 2026-06-18 el sub está fuera de servicio. No utilizable como target.
- **`r/OnlyFansAdvice`**: deferido a **FASE 2D-3** (cuando la cuenta tenga `karma_total >= 50` y `edad_dias >= 30`). Razón: SharemeChat es alternativa directa a OnlyFans; entrar como cuenta marca sin contexto previo en el ecosistema es el riesgo de mod-ban más alto del catálogo. Una cuenta con karma y antigüedad demostrables tiene chance de ser tolerada; una cuenta recién horneada no.

### 3. Línea roja confirmada: no entrar en subs oficiales de plataforma competencia

Subs como `r/Coomeet`, `r/LuckyCrush`, `r/Chaturbate`, `r/StripChat` (y derivados oficiales) están **fuera del catálogo**, aunque existan y sean accesibles. La razón: comentar como cuenta marca de plataforma competidora en el sub oficial de otra plataforma es mala etiqueta del ecosistema y muy probable mod-ban inmediato.

Distinto es **discutir esas plataformas en subs de discusión profesional** (`r/CamGirlProblems`, `r/CreatorsAdvice`, etc.): ahí sí cabe el ángulo "alternativa concreta a {plataforma}" con disclosure honesto. Para canalizar esa oportunidad, se introducen las **boost keywords** del script de descubrimiento (ver § 5).

### 4. Schema bump del ledger `social-state.json` v0.2 → v0.3

Dos campos nuevos en cada entrada de `platforms.reddit.subreddits[]`:

- **`rol`** (string): `"karma"` (subs casuales legacy) o `"target_brand_fit"` (subs nuevos donde la marca encaja por contexto). Sustituye el `rol: "karma"` único anterior.
- **`target_audience`** (array de strings): `["clients"]` | `["models"]` | `["clients", "models"]`. Determina el ángulo de comentario y la política de disclosure aplicable.

Compatibilidad retroactiva: si una entrada del ledger no tiene `target_audience`, el resto del pipeline lo trata como `["both"]` por defecto.

Las dos entradas legacy (`r/AskReddit`, `r/CasualConversation`) **se conservan en el ledger con `rol: "karma"`**, no se usan en el flujo principal y solo son accesibles vía `-SubsOverride` en el script para experimentación o reactivación futura.

### 5. Boost keywords en el descubrimiento de threads

El script `social-thread-finder.ps1` añade una variable `$BoostKeywords` con plataformas competencia (`coomeet`, `luckycrush`, `chaturbate`, `stripchat`, `bongacams`, `myfreecams`, `jerkmate`, `camsoda`, `flirt4free`). Threads cuyo título matchea cualquiera de ellos suben al **top de su sub en la salida markdown** con la etiqueta visual `[BOOST]` tras el título.

Cuando `social-comment-helper` recibe un thread con BoostKeyword:
- Si el sub tiene `target_audience` que incluye `models`, fuerza disclosure **explicit** en la variante A ("alternativa concreta a {plataforma}").
- La variante B mantiene disclosure **light** como contrapunto.

### 6. Sub-tipos de comentario en `social-platform-rules`

Se introducen dos sub-tipos del tipo `comment` existente:

- **`comment.warmup_casual`** (legacy): max 250 chars, max 3 frases. Usado solo en flujo legacy con subs `r/AskReddit` / `r/CasualConversation` / `r/Showerthoughts` via `-SubsOverride`.
- **`comment.advice_substantive`** (nuevo, default para los 4 subs target): max 1200 chars, 8-15 frases, primera persona, anclado en experiencia operativa. Es el registro que los subs de advice esperan; el techo de 250 chars del modo legacy resulta en comentarios percibidos como vacíos en este contexto.

### 7. Política de disclosure diferenciada

Dos sub-modos en `social-brand-legal-review`:

- **`disclosure.light`**: una línea de contexto sobre la plataforma DENTRO del aporte (no como apertura), solo si el thread la pide. Sin URL.
- **`disclosure.explicit`**: declarar fundador permitido en apertura ("I run SharemeChat, a 1-a-1 cam platform based in EU..."). Sin URL. Sin CTA. Sin claims sobre precio o resultados.

Reglas duras preservadas idénticas en ambos sub-modos: **18+, menores (línea roja absoluta), claims falsos, links en cuerpo (regla dura, no negociable)**.

Selección del sub-modo:
- `target_audience: ["clients"]` → `disclosure.light` siempre.
- `target_audience: ["models"]` → `disclosure.explicit` permitido; el helper decide por thread.
- `target_audience: ["clients", "models"]` → ángulo del thread manda.
- Override por boost: si el thread tiene BoostKeyword y el sub incluye `models` en `target_audience`, force `disclosure.explicit` en variante A.

## Opciones consideradas

### Opción 1 — Mantener subs casuales y operar con voz performativa más estricta

Seguir comentando en `r/AskReddit` / `r/CasualConversation` / `r/Showerthoughts` apretando aún más la regla "sin marca, sin auto-referencia". Confiar en que el karma acumulado abra la puerta a posts propios en `r/SharemeChat` con conversión hacia clientes.

Descartada porque:
- La disonancia bio-voz no desaparece con apretar la regla; sigue presente cada vez que un lector abre el perfil de `u/sharemechat`.
- El karma acumulado en subs casuales **no transfiere audiencia cualificada** a `r/SharemeChat`: la audiencia de casuales no es target del producto.
- Coste operativo alto del operador (esquivar marca en cada frase) sin retorno mensurable.

### Opción 2 — Pivotar solo a subs de captación de clientes (sin dimensión talento)

Cubrir la dimensión clientes con subs como `r/CreatorsAdvice` + `r/AdultContentCreators` y dejar la captación de modelos para Twitter/X o canales aparte.

Descartada porque:
- Una conversación con una modelo activa en Coomeet (operador) confirma que **Reddit es donde las modelos buscan plataforma activamente**. Renunciar a esta dimensión es renunciar a un canal validado de captación de talento.
- Sin modelos no hay servicio; la captación de talento no es opcional.
- El esfuerzo marginal de añadir 2 subs adicionales para target talento es bajo comparado con el coste de oportunidad.

### Opción 3 (la elegida) — Pivote a 4 subs adult-ecosystem repartidos 2 clients + 2 models

Lista final del § 1, con simetría 50/50. Las dos dimensiones cubiertas con dos subs cada una, decisiones operativas (disclosure, boost) configurables por sub vía ledger.

Se elige porque:
- Cubre ambas dimensiones de negocio críticas sin sobre-extender la operativa.
- 4 subs son sostenibles con karma 1 y 8 días de cuenta; ampliar a 5+ es FASE 2D-3 cuando el karma lo permita.
- Reaprovecha íntegramente la arquitectura del modo `thread_comment` de ADR-039 (dos invocaciones, pausa humana, packager); solo se actualizan datos (ledger, script defaults, voz) y reglas (platform-rules sub-tipos, brand-legal-review sub-modos).
- Mantiene los subs casuales como `rol: "karma"` en el ledger sin destruir la opción de reactivarlos vía `-SubsOverride`.

## Consecuencias

### Positivas

- La marca de `u/sharemechat` deja de generar dissonance: en los 4 subs target la marca encaja por contexto.
- La voz del operador deja de ser performativa; el registro `comment.advice_substantive` permite el vocabulario operativo de oficio (`shift`, `payout`, `verification flow`, `KYC up front`).
- La dimensión de captación de talento entra en el pipeline social-ops por primera vez. Hasta ahora estaba implícita en el sub `own` (`r/SharemeChat`); ahora es explícita en 2 subs target.
- El boost keywords abre una ventana directa a captar modelos insatisfechas con plataformas competencia, con disclosure honesto y sin denigrar.
- La arquitectura del modo `thread_comment` (ADR-039) **no cambia**. Cambia el target y la voz; el pipeline y sus dos invocaciones con pausa humana son los mismos.

### Negativas

- Mayor superficie de mod-ban: subs adult-ecosystem tienen moderación más sensible a auto-promoción que subs casuales. Mitigación: disclosure light por defecto, explicit solo cuando el sub lo invita o hay boost.
- Voz híbrida (sharemechat-voice) más compleja de mantener: ahora hay tres registros (CMS editorial + comentarios casuales legacy + comentarios advice substantive con sub-variantes clients/models). Mitigación: sub-secciones claras en `sharemechat-voice.md`, ejemplos DO/DON'T por variante.
- Validación end-to-end con Cowork (FASE 2C) se rehace contra esta lista nueva, no contra la lista casuales original. La validación previa contra casuales queda como referencia de funcionamiento del pipeline, no de la elección de subs.
- Schema bump v0.2 → v0.3 introduce dos campos nuevos en el ledger. Compatibilidad retroactiva: si una entrada no tiene `rol` o `target_audience`, defaults aplicables (`karma` y `["both"]` respectivamente). Sin migración masiva.

## Relación con otras ADRs

- [ADR-034](adr-034-social-ops-methodology.md) — metodología social-ops base. Esta ADR mantiene íntegramente sus principios; solo cambia el target del modo `thread_comment`.
- [ADR-038](adr-038-social-reddit-warmup-rss-not-oauth.md) — RSS público sin auth para descubrimiento. Sigue siendo la fuente del script; ADR-040 añade `$BoostKeywords` como variable nueva, no cambia el mecanismo de fetch.
- [ADR-039](adr-039-pipeline-social-modo-thread-comment.md) — modo `thread_comment` y arquitectura de dos invocaciones con pausa humana. **No cambia**. ADR-040 es la primera revisión del **target** sin tocar la **arquitectura**.

## Fases del frente

- **FASE 2A** (commit `dbb5274` + hot-fix `da6542b`): script `social-thread-finder.ps1` + ADR-038.
- **FASE 2B-1** (sesión previa): investigación + diseño § 3.B del output.
- **FASE 2B-2** (commit `9042712`): implementación del modo `thread_comment` + ADR-039.
- **FASE 2B-2 hot-fix** (commit `036fec2`): regla operativa de Cowork (sin XML en `description`).
- **FASE 2D-1** + **FASE 2D-1.5** (sesiones previas, informes en chat): investigación del pivote + ampliación con dimensión talento.
- **FASE 2D-2** (esta sesión): implementación del pivote — ADR-040 + schema bump ledger + actualización del script + actualización de 4 skills + hot-fix code fence en `social-comment-helper` + README + project-log.
- **FASE 2C** (diferida): validación end-to-end real con Cowork contra los 4 subs nuevos.
- **FASE 2D-3** (futura, no en esta sesión): incorporar `r/OnlyFansAdvice` cuando la cuenta tenga `karma_total >= 50` y `edad_dias >= 30`. Revisión de los DUDOSOS del informe 2D-1 (r/SexWorkers, r/SexWorkersOnly, r/TheOFHubForGirls, r/SellerCircleStage) si en el primer ciclo con los 4 subs nuevos hay margen operativo para ampliar.
