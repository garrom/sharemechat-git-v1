# ADR-036 - Postura arquitectónica del pipeline de moderación IA del streaming

## Estado

Aceptado el 2026-06-17.

Este ADR cierra la postura arquitectónica del frente de moderación IA sobre streaming en vivo. Es complemento operativo de [ADR-030](adr-030-moderation-pipeline-build-vs-rent.md) (build vs rent ya zanjado: control plane propio + clasificadores alquilados), y deja la selección concreta del vendor de clasificación visual reservada para un ADR-037 posterior, que se abrirá cuando se cierre contrato.

## Contexto

ADR-030 zanjó qué se construye y qué se alquila en el pipeline de moderación, pero no fijó las decisiones arquitectónicas que condicionan la implementación: dónde se captura el frame, con qué cadencia, cómo se comporta el sistema cuando el vendor no responde, y cuándo procede evolucionar el modelo de captura. El cierre del frente Didit (ADR-035) deja el siguiente epic estructural exactamente aquí, y el plazo de lanzamiento (1-jul-2026) obliga a fijar postura antes de empezar la implementación.

Cuatro entradas de investigación de mercado y de práctica industrial alimentan la decisión:

- **Exigencia del card brand vía PSP**: Mastercard exige moderación en tiempo real para live stream adult como condición de aprobación del merchant. Segpay (vía PSP activa, ver [psp-strategy.md](../01-business/psp-strategy.md)) lo refleja explícitamente en su due diligence checklist. La exigencia regulatoria es moderación real-time; no exige infalibilidad del control.
- **Lección operativa de la industria de random video chat**: el cierre de Omegle en noviembre de 2023 por demandas relacionadas con ausencia de moderación demuestra que el stack mínimo viable en este vertical es AI + cola humana + reporting. Las plataformas supervivientes que operan random video chat lo confirman con esa misma combinación.
- **Práctica WebRTC mainstream**: la moderación en tiempo real es más natural cuando el media pasa por un SFU server-side. P2P + moderación es viable, pero exige captura cliente-side desde el browser del modelo, lo que asume riesgo de spoofing por parte de un cliente comprometido.
- **Capacidad técnica del mercado de vendors**: los vendors candidatos identificados en ADR-030 ofrecen dos modos de integración con WebRTC: server-side vía URL HLS (requiere SFU) y image API frame-a-frame compatible con captura cliente-side. Para volumen pre-launch (orden de 10-20 sesiones concurrentes activas con 1 frame cada 10-15 segundos) el coste operativo estimado es manejable en cualquier vendor del mercado.

La arquitectura realtime actual de SharemeChat es WebRTC P2P (ver `docs/02-architecture/realtime-architecture.md`): el media no atraviesa el backend; el backend solo participa en señalización y en autoridad de confirmación vía `POST /api/streams/{streamRecordId}/ack-media`. Migrar a SFU server-side es una reingeniería mayor incompatible con el plazo de go-live.

## Decisión

Se adoptan cuatro bloques de postura arquitectónica que conjuntamente fijan el modo de operar del pipeline de moderación IA durante la fase de lanzamiento y la transición posterior. Los bloques son vendor-agnostic por construcción: el cambio del vendor visual no obliga a reabrir este ADR.

### 1. Captura cliente-side desde el browser del modelo

Los frames sometidos a moderación se capturan en el browser de la modelo durante la sesión activa, no en backend ni en infraestructura intermedia. El riesgo de spoofing por parte de un cliente comprometido (modelo con browser instrumentado para servir frames distintos al stream real) queda asumido y mitigado por:

- KYC obligatorio previo (operativo desde ADR-035), que añade fricción real al uso de identidades falsificadas y deja evidencia auditable de la identidad detrás de cada cuenta de modelo.
- Banning escalado tras violaciones repetidas, registrado con audit log y trazable hacia el PSP cuando proceda.
- Cola humana sobre severidades intermedias, que detecta patrones que un clasificador automático puede no resolver bien por sí solo.
- Workflow de quejas activo, que cierra el bucle desde el lado del usuario afectado.

La defensibilidad de esta postura ante PSP descansa en que la exigencia regulatoria es moderación real-time, no infalibilidad del control. Un sistema con captura cliente-side + KYC + ban escalado + cola humana cubre la exigencia del card brand y es operativamente sostenible para una OÜ pre-ingresos.

### 2. Cadencia de muestreo

El muestreo opera a una frecuencia de 1 frame cada 10 a 15 segundos por sesión activa. El parámetro es configurable por entorno mediante una property (`moderation.sampling.cadence-seconds` o equivalente del prefijo `moderation.*`), de forma que cada entorno pueda ajustarlo sin redeploy del JAR. Los defaults para entornos no productivos pueden ser más laxos (cadencia mayor) para reducir coste durante validación.

La frecuencia se elige por equilibrio entre coste por inferencia (más muestreo, más coste lineal) y latencia de detección efectiva (más muestreo, menor ventana de exposición a contenido prohibido). El rango 10-15 segundos es coherente con el volumen pre-launch estimado y con la práctica del sector adult.

### 3. Modo de fallo fail-closed-soft

Cuando el vendor no responde durante una ventana de N minutos consecutivos sobre una sesión concreta, el sistema registra incidente, notifica al operador y marca la sesión como `moderation_degraded`. Tras una ventana adicional de X minutos en estado degradado continuo, la sesión se corta mediante el mecanismo de auto-corte ya existente. Los parámetros N y X son configurables.

Las dos alternativas extremas quedan descartadas:

- **Fail-open puro** (continuar la sesión sin moderación si el vendor no responde) es indefendible ante card brand: deja un agujero operativo durante incidentes prolongados del vendor.
- **Fail-closed estricto** (corte inmediato al primer fallo de inferencia) es impracticable: un flap de red puntual cerraría sesiones sanas, degradando la experiencia y generando falsos positivos de incidente sin valor de seguridad.

La política intermedia conserva la trazabilidad (incidente registrado, sesión marcada, operador alertado) y corta solo cuando la degradación deja de ser puntual.

### 4. Plan de evolución a captura server-side condicionado

La captura cliente-side es la postura para la fase de lanzamiento. Se reevaluará la migración a captura server-side (vía SFU u otro mecanismo que sitúe el media en una superficie observable por el backend) al cumplirse cualquiera de las siguientes condiciones:

- Primer incidente verificado de spoofing en producción, con evidencia razonable de que el browser del modelo emitió frames distintos al stream real.
- Cruce de un volumen de sesiones concurrentes que haga viable la inversión en SFU (umbral concreto a fijar cuando el volumen se acerque).
- Endurecimiento de exigencias de cualquier card brand que haga insuficiente la captura cliente-side.
- Cierre de contrato con un vendor que no soporte image API frame-a-frame y obligue al modo server-side vía URL HLS.

Mientras ninguna de esas condiciones se dé, el modelo de captura cliente-side se mantiene. La decisión de evolucionar se documentará en un ADR específico, que actualizará o supersederá éste si procede.

## Alternativas descartadas

- **SFU server-side desde el día 1**. Descartado por dos motivos: plazo (la reingeniería WebRTC P2P → SFU es incompatible con el go-live del 1-jul-2026, y supondría rehacer el handling realtime y la confirmación de stream) y coste operativo (relay de todo el media por backend, que escala con el número de sesiones activas y no solo con el muestreo). La opción queda accesible cuando alguna de las condiciones del bloque 4 se cumpla.
- **Fail-open puro**. Descartado por exigencia implícita del card brand de moderación real-time: una sesión sin moderación efectiva durante un incidente del vendor no es defendible aunque el incidente sea genuinamente externo.
- **Ausencia de moderación AI inicial** (operar solo con reporting de usuarios y cola humana reactiva). Descartado por la combinación de exigencia del card brand y de la lección operativa documentada de la industria de random video chat: la ausencia de moderación proactiva es lo que cerró el caso Omegle.

## Consecuencias

### Arquitectura

- El contrato `ModerationProviderClient` se diseña con un método síncrono `submitImage(byte[], metadata) → VerdictResult` como entrada principal, coherente con el modo image API frame-a-frame de los vendors candidatos. El webhook entrante genérico (`POST /api/webhooks/moderation/...`) se construye en paralelo siguiendo el patrón Didit, pero no es crítico para el día 1 del muestreo cliente-side síncrono.
- El frontend del modelo integra captura periódica mediante `<canvas>` + `toBlob()` + POST al backend, alineado con la cadencia decidida. Es trabajo nuevo localizado en los componentes de videochat del modelo.
- El control plane (backend) recibe el frame, lo reenvía al adapter del vendor activo, persiste el verdict y aplica la acción correspondiente (no-op, enqueue para cola humana, auto-corte). El patrón vendor-agnostic validado con KYC se calca: entidad y tablas agnósticas con prefijo `stream_moderation_*`, adapter vendor-specific aislado, properties con nombre del vendor (`moderation.<vendor>.*`).
- El attendance log (defensa anti-chargeback, requisito específico definido en ADR-030) se beneficia de la misma postura: el muestreo de presencia facial puede reutilizar el mismo mecanismo de captura cliente-side, ya sea separado o piggyback sobre el mismo frame.

### Operaciones

- La selección concreta del vendor de clasificación visual queda reservada para un ADR-037 posterior, que se abrirá cuando se cierre contrato con un proveedor concreto. Este ADR-036 es estable y no se reabre al cambiar de vendor: solo cambia el adapter.
- La regla vendor-agnostic formalizada en `CLAUDE.md` (commit `d8329b4`) se aplica al frente desde el inicio: el adapter HTTP, los DTOs de respuesta del vendor y las `@ConfigurationProperties` son las únicas piezas que llevan el nombre del vendor. Entidades, tablas, columnas, repositorios, servicios orquestadores y endpoints públicos son agnósticos.
- La regla de evidencia de ADR-030 sigue vigente: la documentación de arquitectura de la moderación (presumible `docs/02-architecture/moderation-pipeline.md` o similar) se escribe cuando arranque la implementación, no antes.

### Riesgos

- **Riesgo de spoofing asumido**. La captura cliente-side desde un browser controlado por el usuario es estructuralmente menos resistente que la captura server-side. Las mitigaciones (KYC, ban escalado, cola humana, quejas) reducen el incentivo y la persistencia del comportamiento abusivo, pero no eliminan la categoría de riesgo. El bloque 4 fija las condiciones bajo las que se reevalúa la postura.
- **Dependencia del browser del modelo**. La captura solo funciona mientras el componente del modelo está vivo y enviando frames. Una desactivación del componente cliente sin cortar la sesión deja una ventana sin muestreo. El modo de fallo del bloque 3 cubre esta categoría con la misma política `moderation_degraded` que aplica a fallos del vendor.
- **Coste lineal con número de sesiones activas**. Una vez en producción con volumen creciente, el coste por inferencia escala con el muestreo agregado. La cadencia configurable del bloque 2 permite modular el coste sin redeploy si la economía lo exige.

## Consecuencias positivas y trade-off

Positivas:

- Postura defendible ante PSP cumpliendo la exigencia regulatoria de moderación real-time, sin reingeniería realtime previa al go-live.
- Coste operativo manejable para volumen pre-launch en cualquier vendor del mercado, con palanca de cadencia para modular.
- Patrón vendor-agnostic reutilizado del frente KYC, sin invención arquitectónica nueva.
- Cambio futuro de vendor o evolución a captura server-side queda accesible sin reabrir este ADR (solo cambian adapter y, en su caso, mecanismo de captura).

Trade-off asumido:

- Se acepta el riesgo estructural de spoofing del modelo en captura cliente-side, mitigado con KYC + ban escalado + cola humana + workflow de quejas, a cambio de poder llegar al go-live con moderación operativa y sin reingeniería WebRTC.

## Notas

Próximos pasos: la implementación del pipeline se fragmenta en paquetes siguiendo los ocho componentes de ADR-030. El Paquete 1 cimenta el contrato vendor-agnostic, las tablas `stream_moderation_*`, los hooks en el ciclo de vida del stream y un adapter MOCK que permite validar end-to-end sin coste y sin vendor real. La selección del vendor concreto se cerrará en ADR-037 cuando exista contrato, momento en el que la activación operativa será cambio de flag + credenciales, sin reabrir esta postura arquitectónica.
