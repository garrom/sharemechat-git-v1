# ADR-037 - Selección de Sightengine como Plan A del vendor de moderación visual

## Estado

Aceptado el 2026-06-17.

Cierra la reserva del número siguiente que [ADR-036](adr-036-moderation-pipeline-architectural-stance.md) dejó abierta para *"selección concreta del vendor de clasificación visual cuando se cierre contrato"*. Es complemento operativo de ADR-036 y de [ADR-030](adr-030-moderation-pipeline-build-vs-rent.md): cambia el vendor, no la postura arquitectónica ni el reparto build vs rent.

## Contexto

ADR-036 (commit `bc78034`) cerró la postura arquitectónica del pipeline de moderación IA: captura cliente-side desde el browser del modelo, cadencia configurable de 1 frame cada 10-15 segundos, modo de fallo fail-closed-soft, plan de evolución a captura server-side condicionado a métricas concretas. La selección concreta del vendor de clasificación visual quedó reservada para este ADR.

El análisis comparativo se realizó el 2026-06-17 sobre tres candidatos relevantes del mercado para clasificación visual de UGC en el vertical adult/cam:

- **Sightengine**: vendor especializado en moderación de UGC con catálogo granular de 120+ clases y pricing público modelable.
- **Hive**: vendor multi-headed superior en algunas categorías visuales pero con barreras de onboarding.
- **AWS Rekognition**: oferta hyperscaler con coste unitario más bajo pero sin especialización adult.

Criterios evaluados:

- **Pricing transparente**: que el coste por frame y los planes mensuales sean públicos y modelables sin sales call.
- **Compatibilidad con captura cliente-side image API frame-a-frame**: la postura de ADR-036 requiere image API; cualquier vendor que obligue a URL HLS u otra superficie server-side no encaja sin reingeniería.
- **Especialización en UGC adult/cam**: granularidad de clases relevantes (sexual_activity, erotica, underwear, bikini scoreados por separado; no un agregado opaco "nudity").
- **Throughput suficiente para volumen pre-launch**: cuotas mensuales y límites de req/seg compatibles con el rango de 10-20 sesiones concurrentes con cadencia 15 s.
- **Ruta de upgrade del plan sin reingeniería técnica**: que el salto entre planes sea gestión de dashboard, no cambio del adapter ni del workflow.

Coste estimado para volumen pre-launch (sesiones promedio de 5 minutos, cadencia 15 s, escenarios de 4 320 a 86 400 sesiones/mes) calculado para cada vendor:

- **Sightengine**: workflow consolidado a **$0.002/op** (varios modelos aplicados a una misma imagen cuentan como 1 op).
- **Hive**: **$0.003/req** multi-headed.
- **AWS Rekognition**: **$0.001/imagen** en Tier 1 (más barato unitariamente, pero menos especializado).

El coste fijo del plan elegido entra como línea presupuestaria del modelo financiero (ver `docs/01-business/financiero/modelo-financiero.md`, actualizado el 2026-06-17 con la cuota Starter ≈ €27/mes).

## Decisión

Se adopta **Sightengine** como Plan A del vendor de clasificación visual, en plan adecuado por fase. Tres bloques de decisión:

### 1. Vendor primario

**Sightengine** en su plan adecuado por fase. Razones del Plan A:

- Pricing público y modelable que no requiere sales call: permite arrancar el frente sin bloqueo comercial previo.
- Self-serve desde el día 1: alta de cuenta, creación de workflow y generación de credenciales son operaciones de dashboard.
- Especialización en UGC adult/cam con 120+ clases granulares de moderación. Categorías como `nudity` no son un agregado opaco; se desglosan en `sexual_activity`, `erotica`, `underwear`, `bikini` scoreados por separado, lo que habilita políticas de umbral por sub-categoría sin lógica adicional en el control plane.
- **Workflow consolidado** que mantiene el coste por frame en 1 operación aunque se apliquen varios modelos en la misma llamada. Esto es lo que hace que la cuenta económica del frente cierre para el volumen pre-launch sin saltos no lineales.
- Image API frame-a-frame plenamente compatible con la postura cliente-side de ADR-036: no requiere SFU, no requiere URL HLS, no requiere reingeniería realtime.

### 2. Estrategia de cuenta y plan

**Cuenta única** de Sightengine compartida entre los tres entornos TEST / AUDIT / PROD, siguiendo el patrón establecido con Didit en [ADR-035](adr-035-age-and-identity-verification-vendor-consolidation-on-didit.md). API keys distintas por entorno si el dashboard del vendor lo permite; en caso contrario, misma API key con uso responsable y trazabilidad por entorno mediante logs del adapter. Cuota mensual y throughput se comparten entre los tres entornos; la escalada de plan se decide por necesidad agregada, no por entorno.

**Plan progresivo por fase**:

- **Free durante desarrollo** con adapter MOCK operativo en paralelo. El MOCK permite arrancar el Paquete 1 del frente sin tocar la cuota Free.
- **Salto a Starter** ($29/mes ≈ €27/mes, 10 000 ops/mes, 1 req/seg) **antes** de que Segpay realice testing significativo en AUDIT. Este es el punto en el que el adapter Sightengine real empieza a recibir tráfico de verdad y el MOCK queda como fallback de tests.
- **Salto a Pro** ($99/mes, 40 000 ops/mes, 10 req/seg) **antes** del go-live PROD del 1-jul-2026, o al cumplirse cualquiera de estos triggers operativos:
  - Consumo agregado > 7 000-8 000 ops/mes sobre el límite mensual de Starter.
  - Aparición de errores HTTP 429 (rate limit) en los logs del adapter de cualquier entorno.
  - Promedio de > 10 sesiones concurrentes en PROD durante una ventana sostenida.

El salto de plan es gestión de dashboard del vendor: no requiere cambios de código del adapter, no requiere rotación de credenciales salvo que el vendor lo imponga al cambiar de tier.

### 3. Contingencia documentada según patrón ADR-035

**Hive** y **AWS Rekognition** quedan como contingencias del Plan A **documentadas sin priorizar**, coherente con el patrón vendor consolidation formalizado en ADR-035 (Plan A vivo + Plan B/C/D documentados, código del vendor descartado mantenido integrado con flag a `false` cuando proceda).

Cuándo activar contingencia:

- Sightengine deja de cubrir por **calidad insuficiente en alguna categoría crítica** detectada en producción.
- **Endurecimiento de exigencias del card brand** sobre clases que Sightengine no resuelva bien.
- **Cambio comercial inviable** en Sightengine (subida agresiva de precio, retirada del plan self-serve, descontinuación de la image API frame-a-frame).

Cómo activar contingencia (en cualquiera de los tres casos):

- Cambio del adapter (`SightengineModerationClient` → `HiveModerationClient` o `RekognitionModerationClient`) + credenciales del vendor nuevo en `config.env` del entorno correspondiente + reasignación de cuenta operativa. Sin reabrir ADR-036 y sin reabrir este ADR.
- La interface vendor-agnostic `ModerationProviderClient` definida en el frente (calcada del patrón `DiditClient` de KYC) absorbe la sustitución sin cambios en el control plane.

Notas operativas sobre los candidatos de contingencia:

- **Hive** ofrece multi-headed superior pero obliga a Enterprise sales call para volumen real (plan Developer bloqueado a 100 req/día). Si se activa contingencia hacia Hive, la activación incluye onboarding comercial previo.
- **AWS Rekognition** tiene coste unitario más bajo (Tier 1 a $0.001/imagen) pero sin especialización adult; sus categorías son genéricas. Útil como contingencia si el criterio dominante en algún momento pasa a ser coste sobre granularidad. Adicionalmente, AWS comunicó en abril 2026 que deja de aceptar nuevos clientes para Streaming Video Analysis y Batch Image Content Moderation: señal de estrechamiento del área aunque la image API `DetectModerationLabels` sigue disponible para nuevos clientes. Si esta señal se confirmara como retirada total, Rekognition decaería como contingencia y solo quedaría Hive.

## Alternativas descartadas

- **Hive como Plan A**. El bloqueo self-serve a 100 req/día en plan Developer obliga a Enterprise sales call antes de poder integrar a volumen real; ralentiza el arranque del frente y bloquea pre-launch. El patrón vendor consolidation prefiere Plan A con onboarding self-serve y mantener alternativas dormidas, no a la inversa. Hive queda como contingencia disponible si las condiciones cambian.
- **AWS Rekognition como Plan A**. Especialización adult insuficiente para el vertical. Sus categorías de moderación son genéricas frente a las 120+ clases granulares de Sightengine. La señal de abril 2026 sobre retirada de aceptación de nuevos clientes en Streaming Video Analysis y Batch Image Content Moderation, aunque no afecta a la image API, es un indicio de estrechamiento del área. Rekognition queda como contingencia secundaria por coste.
- **Construcción propia de clasificador visual**. Vetada en ADR-030 (build vs rent: control plane propio, clasificadores alquilados). No se reabre en este ADR.
- **Múltiples vendors simultáneos en producción** (Plan A + Plan B activos en paralelo, llamando a ambos en cada frame y arbitrando entre verdicts). Descartado por complejidad operativa y duplicidad de coste fijo sin valor incremental medible en pre-launch. La contingencia se mantiene documentada, no activa.

## Consecuencias

### Arquitectura

- **Properties** con prefijo `moderation.sightengine.*`: `enabled`, `base-url`, `api-user`, `api-secret`, `workflow-id`, `webhook-secret` y los que requiera el adapter al implementar. El nombre del vendor aparece SOLO en config y en `@ConfigurationProperties` (regla de `CLAUDE.md` `d8329b4` sobre vendor-agnostic en dominio).
- **Adapter HTTP** `com.sharemechat.streammoderation.service.SightengineModerationClient` (interface) + su implementación, que cumplen la interface vendor-agnostic `ModerationProviderClient` definida en el frente. Patrón calcado del `DiditClient` / `DiditClientImpl` ya validado.
- **Adapter MOCK** `MockModerationClient` se mantiene operativo en paralelo durante todo el desarrollo y como mecanismo de fallback de tests. La interface vendor-agnostic lo permite trivialmente (el control plane no distingue MOCK de SIGHTENGINE más allá del modo activo).
- **Cuenta única Sightengine** compartida entre TEST / AUDIT / PROD. Una sola subscription mensual. API keys distintas por entorno si el dashboard lo soporta; en caso contrario, misma API key con uso responsable por entorno.
- **Ruta de escalada de plan** documentada (Free → Starter → Pro) gestionada en el dashboard del vendor, sin cambios de código ni de configuración salvo eventual rotación de API keys al cambiar de tier.
- **Compatibilidad con postura arquitectónica de ADR-036** garantizada por diseño: image API frame-a-frame es exactamente el modo que ADR-036 requiere, y Sightengine es uno de los vendors que lo soporta de fábrica.

### Operaciones

- **Vendor-agnostic en dominio preservada**: el código del control plane (entidades, tablas con prefijo `stream_moderation_*`, repositorios, servicios orquestadores, endpoints públicos `/api/admin/stream-moderation/*` y `/api/webhooks/moderation/*`) no menciona "Sightengine"; solo lo hacen el adapter, los DTOs de respuesta del vendor y las properties.
- **Apertura de cuenta Sightengine** (cuenta empresarial OÜ) queda como próximo paso operativo previo al Paquete 1 del frente: creación del workflow consolidado con las categorías visuales relevantes, generación de credenciales, configuración inicial del dashboard. Estas son acciones del operador sobre el vendor, no commits.
- **Modelo financiero** del proyecto ya recoge la cuota Starter ≈ €27/mes como coste fijo (entrada del 2026-06-17 sobre `docs/01-business/financiero/modelo-financiero.md`). Cuando proceda el salto a Pro, el modelo se actualiza con la nueva cuota.

### Riesgos

- **Dependencia single-vendor** equivalente al riesgo asumido con Didit en ADR-035. Mitigación: contingencia documentada con dos candidatos (Hive, Rekognition) y patrón de activación claro.
- **Cambio comercial unilateral del vendor**: subida de precio, retirada de plan self-serve, descontinuación de image API o cambio de tier mínimo accesible. La estrategia de plan progresivo limita la exposición durante desarrollo (Free + MOCK) y solo asume coste fijo cuando el frente está realmente operativo.
- **Aceleración de cuota**: si el volumen real crece más rápido de lo previsto, el salto Starter → Pro debe anticiparse para evitar HTTP 429 en producción. Los triggers definidos en el bloque 2 (consumo > 7 000-8 000 ops/mes, errores 429 en logs del adapter, > 10 sesiones concurrentes en PROD) cubren la detección operativa.

## Consecuencias positivas y trade-off

Positivas:

- Onboarding self-serve permite arrancar el Paquete 1 del frente sin bloqueo comercial previo.
- Coste fijo mínimo en fase de desarrollo (Free + MOCK) y línea presupuestaria modelable a partir de Starter (€27/mes) hasta Pro ($99/mes) según necesidad real.
- Especialización adult con clases granulares facilita políticas de umbral por sub-categoría sin código adicional en el control plane.
- Compatibilidad nativa con la postura arquitectónica de ADR-036; no obliga a reingeniería.
- Contingencia documentada según patrón ADR-035: switch a Hive o Rekognition es cambio de adapter + credenciales, sin reabrir ADRs.

Trade-off asumido:

- Single-vendor en producción (riesgo equivalente al de ADR-035 con Didit), a cambio de simplicidad operativa, una sola subscription mensual y un único contrato a gestionar.

## Notas

- **Próximos pasos operativos**: apertura de cuenta Sightengine (cuenta empresarial OÜ), creación de workflow consolidado con las categorías visuales relevantes, generación de credenciales, integración en el adapter durante el Paquete 1 del frente (junto al MOCK que ya estará operativo en ese paquete).
- **Selección del vendor de CSAM** (Hive, Thorn Safer, PhotoDNA según ADR-030) sigue pendiente y se cerrará en un ADR posterior cuando se aborde el módulo CSAM del pipeline, componente listado en ADR-030 y no prioritario para el Paquete 1.
- **Regla de evidencia de ADR-030 sigue vigente**: `docs/02-architecture/` no se actualiza hasta construir. Este ADR fija vendor, no documenta sistema operativo.
