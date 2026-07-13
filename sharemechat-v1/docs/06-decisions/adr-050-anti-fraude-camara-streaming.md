# ADR-050 — Anti-fraude de cámara para streaming 1-a-1: blacklist de virtual cameras (Fase A) + liveness challenge diario con SightEngine (Fase B)

> Estado: VIGENTE
> Fecha: 2026-07-13
> Vigencia esperada: hasta que el volumen o los patrones de fraude reales justifiquen face-match contra selfie KYC (Didit), detección continua durante el stream, o rotación de vendor de liveness.
> Reemplaza: N/A (documento nuevo).
> Ver también: [ADR-030](adr-030-moderation-pipeline-build-vs-rent.md), [ADR-036](adr-036-moderation-pipeline-architectural-stance.md), [ADR-037](adr-037-moderation-visual-vendor-sightengine.md), [ADR-035](adr-035-age-and-identity-verification-vendor-consolidation-on-didit.md).

## Estado

Aceptada. Fase A (blacklist client-side) implementada y desplegada en TEST el 2026-07-13 en commit `f8151c8`. Fase B (liveness challenge server-side con SightEngine) es el trabajo derivado principal de este ADR, aterrizado técnicamente aquí y ejecutado en subpasadas posteriores.

## Contexto

En un producto de videochat 1-a-1 con modelo económico pay-per-second, el fraude más grave es que la modelo **cobre por streaming en vivo mostrando vídeo pregrabado**. Los ataques prácticos disponibles a coste cero para el atacante:

1. **Cámara virtual (OBS Virtual Camera, ManyCam, Snap Camera, Xsplit, DroidCam, e2eSoft VCam, etc.)**: software que aparece como dispositivo `videoinput` en `navigator.mediaDevices.enumerateDevices()` con label del vendor. Permite inyectar cualquier fuente (fichero de vídeo, ventana, imagen fija) al `getUserMedia` de un navegador. Es el ataque más común porque OBS es gratis y masivo en el vertical adult/cam.
2. **Cámara virtual con label reescrito**: usuario avanzado renombra el driver o usa un plugin (SnapCam Pro, Reincubate Camo con "System Camera") para que `enumerateDevices()` no delate al vendor. Salta el Nivel 1 sin coste.
3. **Streaming secundario**: dispositivo físico apuntando a una pantalla que reproduce vídeo grabado. No hay software virtual involucrado, pasa cualquier check de label. Ataque más caro (requiere setup físico) pero indetectable por Nivel 1.

Impacto asimétrico:

- Fraude por **modelo**: la modelo cobra `STREAM_EARNING` por servicio no prestado en vivo → coste directo a la plataforma en payout. Además rompe la propuesta de valor "interacción real" al cliente pagador. Es el escenario prioritario.
- Fraude por **cliente**: menor coste directo (el cliente paga con su saldo igual, es su dinero), pero degrada la experiencia de la modelo y viola términos de uso. Se mantiene por coherencia UX y política.

El proyecto ya integra **SightEngine** como vendor de clasificación visual (ADR-037), en el frente de moderación de contenido (nudez, violencia, minor). El adapter `SightengineModerationClient` está operativo con workflow consolidado en TEST. Se reutiliza esa infraestructura de HTTP + auth para la Fase B evitando integrar un vendor de liveness dedicado (iProov, Onfido Liveness) en esta iteración.

## Análisis previo

### Componentes reutilizables

- **`SightengineModerationClient`** en [`src/main/java/com/sharemechat/streammoderation/service/SightengineModerationClient.java`](../../src/main/java/com/sharemechat/streammoderation/service/SightengineModerationClient.java): adapter HTTP con `RestTemplate`, timeouts 5s connect / 10s read, credenciales via `SightengineProperties`. Puede extenderse con un método `submitFaceAttributes(bytes)` que apunte a `/1.0/check.json?models=face-attributes` (endpoint distinto al workflow de moderación de contenido, misma auth) para obtener los scores necesarios en Fase B.
- **`SightengineProperties`** en `config/`: mismas credenciales `apiUser` + `apiSecret` sirven para face-attributes; no requieren cuenta separada. La clave `workflowId` es específica del pipeline de moderación de contenido; face-attributes no usa workflow, es un `models=` en query string.
- **Patrón `Constants.<Domain>Status`** para strings de estado ya usado en `AffiliateCommissionStatus`, `ModerationReportStatuses`, etc. Se replica.
- **Patrón `@ConfigurationProperties`** con toggle `enabled=false` como kill-switch, ya usado en `SightengineProperties`, `AffiliateProperties`. Se replica para `LivenessProperties`.
- **Guard en WebSocket handler** al recibir `set-role`/`start-match`: el `MatchingHandler` ya rechaza clientes sin `client_kyc_status=APPROVED` con close code 4030 (sub-frente Didit cliente, 2026-06-20). Se replica el patrón con nuevo close code 4031 `LIVENESS_REQUIRED`.

### Componentes que hay que crear

- **Guard client-side de virtual cameras**: `frontend/src/utils/virtualCameraGuard.js` con blacklist específica de labels y `checkPhysicalCamera(stream)`. Ya implementado en Fase A (`f8151c8`).
- **Tabla nueva `liveness_attempts`**: id, user_id (FK), challenge_type, prompt_lc, status, sightengine_verdict JSON, frames_count, timestamps, `passed_until` (TTL del pass).
- **Entidad `LivenessAttempt`** + `LivenessAttemptRepository`.
- **Servicio `LivenessChallengeService`**: `startChallenge(userId)` y `verify(challengeId, framesBase64[])`. Delega a SightEngine face-attributes.
- **Endpoints REST**:
  - `POST /api/streaming/liveness/challenge` — start (devuelve id + type + prompt).
  - `POST /api/streaming/liveness/verify` — verify.
- **Guard en `MatchingHandler`**: al `set-role` verificar `passed_until > now`; si no → close 4031.
- **Frontend `LivenessChallengeModal.jsx`**: prompt + countdown + captura frames + POST verify + result.
- **Wire en 3 dashboards** (`DashboardModel`, `DashboardClient`, `DashboardUserClient`): antes del `handleStartMatch` abrir modal.
- **Copy i18n ES + EN** para los 4 challenge types.

## Decisión

### D1 — Modelo de defensa en capas: Fase A + Fase B

La defensa anti-fraude de cámara opera en dos capas complementarias, no alternativas:

- **Fase A (Nivel 1) — Blacklist client-side de labels de virtual cameras**: `checkPhysicalCamera(stream)` compara el label del track de vídeo con lista específica (OBS, ManyCam, Snap, Xsplit, DroidCam, e2eSoft, Reincubate Camo, Elgato Virtual, SplitCam, WebcamMax, YouCam, AlterCam, etc.). Si matchea → bloquear + modal + no marcar `cameraActive`. Cero llamadas a red, ~0 ms overhead, cero coste operativo. Cubre el 90 % del uso casual del ataque OBS-por-defecto.
- **Fase B (Nivel 2) — Liveness challenge server-side con SightEngine**: antes del primer `startMatch` del día, el usuario debe pasar un challenge de 3 frames con modelo `face-attributes` de SightEngine. Cubre los ataques que Fase A no puede: cámara virtual con label reescrito, dispositivo físico apuntando a pantalla con vídeo grabado. Los frames del challenge se generan reactivamente en el momento (parpadea, sonríe, gira cabeza), por lo que un vídeo pregrabado no reacciona → falla.

Ambas fases se aplican a **cliente y modelo**. Motivación: aunque el impacto económico directo del cliente-que-fingirece-humano es menor, la coherencia UX y la trazabilidad de que "ambos lados son reales" es requisito de compliance para el vertical.

### D2 — Blacklist específica, no regla genérica "virtual"

Fase A usa lista específica de fabricantes conocidos. Se **descarta** una regla genérica tipo `label.includes('virtual')` porque bloquearía casos legítimos: Continuity Camera en macOS Ventura+ (iPhone como webcam Apple usa "Continuity Camera" en el label, es cámara real con procesado), NVIDIA Broadcast (aplica filtros a webcam física), EpocCam como camara auxiliar legítima. La blacklist mantiene ~25 entradas del catálogo actual y se amplía en el módulo `virtualCameraGuard.js` cuando aparezcan vendors nuevos relevantes.

### D3 — Frecuencia del liveness: una vez al día por usuario

Al primer `startMatch` del día calendario UTC, se dispara el challenge. Si pasa, se guarda `passed_until = now + 24h` en `liveness_attempts` y los siguientes `startMatch` en las 24h no repiten. Balance UX/seguridad razonable en fase pre-launch:

- **Descartado**: challenge por cada `startMatch` — fricción excesiva (usuarios que hacen 10 matches/hora reciben 10 challenges, coste SightEngine ~$0.06/hora/usuario por lado), sin ganancia proporcional porque el ataque económico ya está mitigado si el primer challenge del día bloquea.
- **Descartado**: challenge una vez por sesión de app (login) — un solo login puede durar horas y encadenar N matches; una sesión larga con vídeo pregrabado no se pilla nunca.
- **Adoptado**: una vez al día — el atacante debe pasar el challenge cada día que quiera operar el fraude, invalidando setups automatizados de "abrir vídeo → iniciar streaming N horas".

Property `moderation.liveness.ttl-seconds=86400` gobierna el TTL; ajustable sin redeploy vía config.env.

### D4 — Un solo challenge random, no secuencia

Cada verificación selecciona uno de `{BLINK, TURN_LEFT, TURN_RIGHT, SMILE}` aleatoriamente. **Descartado** el modo secuencia (2 challenges encadenados) porque duplica fricción sin cubrir ataques adicionales relevantes en fase pre-launch: quien puede precomputar respuesta a 1 puede a 2. Robustez adicional se abordará en frente futuro con face-match contra selfie Didit (deuda `#D-25` abajo), no con más challenges.

Los 4 tipos:

- **BLINK**: usuario cierra ambos ojos 2 veces con intervalo breve. Verdict: en los 3 frames capturados, al menos uno debe tener `eyes_closed > 0.5` y al menos otro `eyes_closed < 0.3`. Diferencia neta > 0.4.
- **TURN_LEFT**: usuario gira la cabeza a su izquierda. Verdict: `yaw` (ángulo horizontal de la cara) en el último frame difiere del primero en > 15°, en dirección izquierda (yaw negativo por convención SightEngine).
- **TURN_RIGHT**: espejo de TURN_LEFT, yaw positivo.
- **SMILE**: usuario sonríe visiblemente. Verdict: `smile` score > 0.6 en algún frame y < 0.3 en otro (transición neutra→sonrisa).

Umbrales concretos en properties `moderation.liveness.thresholds.*` (versionable sin redeploy). Umbrales iniciales calibrados con tests manuales del operador; deuda `#D-26` para calibración empírica con datos reales tras primeros 100 attempts.

### D5 — Fail-closed-soft: SightEngine caído no bloquea al usuario

Al no responder SightEngine (timeout, 5xx, credenciales blank, `enabled=false`), el service marca la fila `liveness_attempts` como PASSED con `sightengine_verdict = {"vendor_unavailable": true}` y `passed_until = now + property TTL corto (5 min)`, no como FAILED. Motivación coherente con ADR-036 bloque 3 (fail-closed-soft para moderación de contenido): un vendor caído no debe expulsar usuarios legítimos ni acumular incidentes de soporte. El operador ve en el panel admin el número de PASSED-por-vendor-caído (deuda `#D-27`) y decide si extiende la política o cambia vendor.

En modo MOCK (`enabled=false` explícito, no por vendor caído): PASSED inmediato con `sightengine_verdict = {"mock": true}`, TTL completo 24h. Sirve para desarrollo local y AUDIT sin credenciales reales.

### D6 — Rate limit y bloqueo tras N fallos

Property `moderation.liveness.max-failed-attempts-per-day=3`: al tercer FAILED del día, el usuario queda bloqueado (no puede iniciar nuevo challenge) durante `cooldown-seconds=300` (5 min). Al expirar, puede volver a intentar. Escala a bloqueo administrativo si acumula 3 cooldowns en 24h → nueva fila `moderation_reports` con tipo `LIVENESS_ABUSE` para revisión manual del operador.

Motivación: evitar bruteforce del challenge (probar N grabaciones distintas hasta encontrar una que pase por artefacto de SightEngine) sin castigar al usuario legítimo con webcam de mala calidad.

### D7 — Guard en WebSocket MatchingHandler, no en HTTP

El gate final es el `MatchingHandler` al recibir `set-role`: si `liveness_attempts` de ese user no tiene `passed_until > now`, cierra con close code **4031 LIVENESS_REQUIRED**. El frontend traduce ese code a redirect a modal de challenge (patrón calcado del 4030 CLIENT_KYC_REQUIRED).

Motivación: defensa en profundidad. El modal frontend puede saltarse (devtools, adversario técnico); el WS del backend no. Coherente con el gate KYC del sub-frente Didit cliente (2026-06-20).

### D8 — Kill-switch por property, no por rol/entorno

Property `moderation.liveness.enabled=false` en `application.properties` con override en `config.env` runtime. Cuando `false`, tanto el guard WS como los endpoints REST devuelven "PASSED" degenerado sin llamar a SightEngine. En TEST arranca con `false` para iteración; en AUDIT/PROD se activa cuando el operador cierre calibración D4.

**Descartado**: activación por rol (solo MODEL, no CLIENT) — introducirá inconsistencia UX y complicará el guard. Si el operador decide en el futuro desactivar solo para cliente, se abre property `moderation.liveness.enabled-client-role=true|false` en frente separado.

### D9 — Tabla independiente, no reutilizar `kyc_sessions`

`liveness_attempts` es tabla nueva con FK a `users(id)`. **Descartado** reutilizar `kyc_sessions` (que aloja las sesiones Didit) porque la semántica es diferente: Didit son verificaciones one-shot vinculadas al ciclo de vida de la cuenta (KYC APPROVED/REJECTED permanente); liveness attempts son verificaciones repetidas diarias que expiran a las 24h. Mezclarlas en la misma tabla obligaría a discriminadores y confundiría la historia operativa.

### D10 — Auditoría y reporting

Cada fila de `liveness_attempts` guarda el `sightengine_verdict` completo (JSON) para reproducibilidad y para calibración empírica de umbrales D4. Cadencia de retención: 90 días (property `moderation.liveness.retention-days=90`); job de purga mensual limpia filas antiguas. Los agregados operativos (attempts/día, tasa de fallo, distribución por challenge type) permanecen en un dashboard admin mínimo (deuda `#D-28`, no requerido para lanzar Fase B).

## Alternativas descartadas

### Face-match contra selfie KYC de Didit para cada startMatch

Rechazada como Fase B inicial. Reutilizaría el selfie del KYC Didit (ya presente en `kyc_sessions`) para comparar contra un frame del stream en vivo. Ventaja: cierra el ataque "grabé un vídeo de otra persona con expresiones vivas". Desventaja: requiere API de face-match dedicada (Didit no la expone en el plan actual del ADR-035; se necesitaría contratar Face++ o AWS Rekognition Compare) con coste unitario por comparación superior al liveness. Se difiere como frente propio cuando el volumen o el patrón de fraude lo justifiquen (deuda `#D-25`).

### Detección continua de spoof durante el stream

Rechazada como Fase B. Análisis frame-a-frame durante toda la sesión de streaming con modelo `face-liveness` de un vendor especializado detecta artefactos de reproducción de pantalla. Coste alto (verifica cada frame moderado, ~$0.002 × 60-100 frames/sesión) y latencia añadida. Se difiere a evolución futura (deuda `#D-29`) si aparecen ataques que pasan el liveness inicial y luego cambian a vídeo grabado dentro de la sesión.

### Client-side approx. con `face-api.js`

Rechazada. Ejecutar face-detection y challenge verification 100 % en JavaScript en el navegador tiene coste operativo cero pero es evadible abriendo devtools y falseando el resultado del `POST verify` que se enviaría al backend. La defensa server-side con SightEngine cierra el vector.

### Vendor dedicado de liveness (iProov, Onfido Liveness, FaceIO)

Descartada en esta iteración. iProov y Onfido tienen "Flashmark" / active liveness robustos y probados en KYC, pero suponen contratar un nuevo vendor con negociación comercial, integración adapter nueva, y coste unitario superior a SightEngine face-attributes (~$0.10-0.50 vs ~$0.002 por check). Se reserva para evolución si SightEngine face-attributes muestra tasa de falso positivo/negativo insuficiente tras calibración D4.

### Regla genérica `label.includes('virtual')` en Fase A

Rechazada en D2. Bloquearía casos legítimos (Continuity Camera macOS, NVIDIA Broadcast, EpocCam standalone). Blacklist específica cubre el 90 % del uso casual sin falsos positivos.

## Consecuencias

Positivas:

- Fase A cierra la mayoría del uso casual del ataque OBS por defecto sin coste operativo ni fricción para usuarios legítimos.
- Fase B añade defensa contra vídeo pregrabado con setup avanzado (label reescrito). El challenge random en vivo es evadible solo con reacciones humanas reales.
- Reutilización de SightEngine (ya integrado, ya contratado) minimiza superficie de vendors nuevos y no cambia el modelo económico documentado.
- Fail-closed-soft (D5) evita expulsar usuarios legítimos cuando el vendor cae, coherente con la política ADR-036.
- Kill-switch por property (D8) permite desactivar en emergencia sin redeploy.
- Guard en WebSocket (D7) hace que la defensa sea irrompible desde el frontend.

Negativas / coste operativo:

- Coste SightEngine adicional: aproximadamente $0.006-0.010 por verificación (3 frames × $0.002/op). Con TTL 24h y frecuencia estimada 100 usuarios activos/día → ~$1/día en pre-launch. Escala linealmente con volumen; revisable en `docs/01-business/financiero/modelo-financiero.md` cuando se active en PROD.
- Fricción UX una vez por día: el primer `startMatch` del día abre modal con ~10-15 s de challenge. Aceptable en fase de captación pero medible; deuda `#D-30` para métrica de abandono en el modal.
- Umbrales D4 pueden dar falsos positivos con webcams de baja resolución o iluminación pobre. Calibración empírica planificada tras primeros 100 attempts reales.
- Fase A es evadible por atacante avanzado (renombrado del driver). No es defensa de una sola capa; requiere Fase B activa en PROD para cerrar el vector económico.
- El adapter SightEngine face-attributes es un endpoint distinto (`/1.0/check.json?models=face-attributes`) del workflow de moderación de contenido (`/1.0/check-workflow.json`); duplica el path HTTP pero mantiene la misma auth. El adapter se refactoriza para soportar ambos con el mismo `RestTemplate` compartido.

## Deudas diferidas (fuera del alcance de este ADR)

- **#D-25** — Face-match contra selfie KYC Didit como Fase C. Requiere API de comparación (Face++, AWS Rekognition Compare). Frente propio cuando volumen o patrón de fraude lo justifiquen.
- **#D-26** — Calibración empírica de umbrales D4 tras 100 attempts reales. Ajuste de `eyes_closed`, `yaw diff`, `smile` según distribución observada.
- **#D-27** — Panel admin con dashboard mínimo de attempts (tasa de fallo, distribución por challenge type, PASSED-por-vendor-caído).
- **#D-28** — Job de purga mensual de `liveness_attempts` con retención 90 días.
- **#D-29** — Detección continua de spoof durante el stream (frame-a-frame con modelo `face-liveness` dedicado). Evolución si el gate inicial se muestra insuficiente.
- **#D-30** — Métrica de abandono en el modal de challenge (frontend) para detectar fricción excesiva o falsos positivos.
- **#D-31** — Property `moderation.liveness.enabled-client-role=true|false` si el operador decide diferenciar cliente/modelo en el futuro.
- **#D-32** — Rate limit del endpoint `POST /api/streaming/liveness/challenge` por IP (no solo por user) para prevenir enumeración/DoS.

## Trabajo derivado — subpasadas propuestas

Ordenadas por dependencia lógica. El operador confirma cadencia y agrupación cuando toque implementar.

1. **Fase A: virtualCameraGuard + i18n + wire 3 dashboards + deploy TEST**. **HECHA** (commit `f8151c8`, deploy TEST 2026-07-13).
2. **Migración Flyway V19 + entidad + repository + constants + property config**. Crea tabla `liveness_attempts` con FK a `users(id)`, enum de status y challenge type. Entidad `LivenessAttempt` + `LivenessAttemptRepository` con `findLatestPassedByUserId`. `Constants.LivenessChallengeType` + `LivenessChallengeStatus`. `LivenessProperties` con toggle y umbrales. Cero lógica de negocio.
3. **`LivenessChallengeService` + integración SightEngine face-attributes**. `startChallenge(userId)` con selección random del tipo + rate limit D6. `verify(challengeId, frames)` con delegación a `SightengineFaceAttributesClient` (método nuevo o adapter separado). Reglas D4 hardcoded en el service con umbrales desde property. Fail-closed-soft D5. Tests unitarios.
4. **Endpoints REST + guard `MatchingHandler`**. `POST /api/streaming/liveness/challenge` + `POST /api/streaming/liveness/verify`. Guard en `MatchingHandler` al `set-role` con close code 4031 LIVENESS_REQUIRED. Tests.
5. **Frontend `LivenessChallengeModal.jsx`**. Prompt + countdown + captura 3 frames espaciados 1.5 s del `localStream` con canvas → base64 → POST verify. Manejo de failed/retry (max 3 D6). Copy i18n ES + EN para 4 tipos.
6. **Wire en 3 dashboards + close code 4031 en frontend**. Antes del `handleStartMatch` en `DashboardModel`, `DashboardClient`, `DashboardUserClient`: abrir modal si backend `GET /api/streaming/liveness/status` dice que no hay pass vigente. Traducir close 4031 del WS a re-abrir modal.
7. **Testing manual + deploy TEST + activación**. Verificación con vídeo pregrabado en OBS renombrado (debe fallar), verificación con cámara física (debe pasar), verificación con `enabled=false` (debe pasar degenerado). Deploy backend + frontend. Activación en TEST tras calibración inicial.

Aproximadamente 6 subpasadas efectivas (la 1 ya hecha). El detalle exacto de cada una — nombres finales de columnas, propiedades exactas, endpoints — se cierra en la implementación con la doc del ADR como contrato.

## Trazabilidad

- Postura arquitectónica de moderación IA: [ADR-036](adr-036-moderation-pipeline-architectural-stance.md).
- Vendor SightEngine: [ADR-037](adr-037-moderation-visual-vendor-sightengine.md).
- Build vs rent de moderación: [ADR-030](adr-030-moderation-pipeline-build-vs-rent.md).
- KYC vendor Didit: [ADR-035](adr-035-age-and-identity-verification-vendor-consolidation-on-didit.md).
- Gate WS por KYC cliente (patrón guard replicado): sub-frente Didit cliente 2026-06-20 en [ADR-035](adr-035-age-and-identity-verification-vendor-consolidation-on-didit.md).
- Fase A commit: `f8151c8` en `main` (2026-07-13).

---

**Alcance de entorno**: la Fase B se implementa y activa primero en **TEST**. AUDIT y PROD se propagan tras calibración empírica de umbrales D4 y decisión de corte del operador. La property `moderation.liveness.enabled` gobierna la activación por entorno sin redeploy.

## Actualización 2026-07-13 — Cambio de gesture challenge a presence check (D4 revisado)

Al activar la Fase B en TEST y probar con webcam real (Logitech C270, iluminación de salón), el operador reportó tasa de falso negativo alta con los 4 gestures BLINK/TURN_LEFT/TURN_RIGHT/SMILE de SightEngine face-attributes: *"no me ha reconocido ninguna, UX pésima"*. Los umbrales del D4 original son sensibles a resolución de cámara y calidad de luz, y calibrarlos por cámara/entorno es un problema que hasta vendors dedicados de gesture liveness abordan con hardware+software especializado.

Además, evidencia de industria del vertical (WebSearch 2026-07-13, DatingScout review de CooMeet) confirma que **ninguna plataforma comparable usa gesture challenges automáticos como gate inicial**. CooMeet solo pide activar cámara al inicio; los gestures los piden **moderadores humanos** que se meten dentro de sesiones activas y suspenden cuentas que fallan. Camsurf, Chatrandom y Stripchat directamente no verifican liveness al empezar.

Se cierra el cambio con luz verde explícita del operador el 2026-07-13.

### D4 revisado — Presence check simple, sin gestures

**El challenge activo pasa a ser un único tipo `PRESENCE`.** El usuario ve el modal, pulsa "Empezar", mira a la cámara 3 segundos mientras se capturan los frames. Cero gesture forzado.

**Regla de verify** (`LivenessChallengeService.evaluate(PRESENCE, frames)`):

1. **Presencia de cara**: al menos `min-faces-detected` frames tienen cara detectada por el vendor. Umbral por defecto 2 de 3.
2. **Micro-movement**: suma acumulada de `|smile[i] - smile[i-1]|` + `|eyesClosed[i] - eyesClosed[i-1]|` + `|yaw[i] - yaw[i-1]|/30` a lo largo de todos los frames ≥ `min-delta`. Umbral por defecto 0.05.

Semántica del umbral: una imagen totalmente estática (JPEG cargado en OBS como source) da `totalDelta = 0.0`; cualquier persona real sentada ante la cámara supera ampliamente 0.05 por micro-movimientos naturales (respirar, ojos, cara).

### Qué se cierra y qué se deja pasar con el nuevo D4

**Cierra** (bloquea):
- Foto fija JPEG cargada en OBS Virtual Camera.
- Frame estático (screen sharing de imagen sin movimiento).
- Cámara con lente tapado (sin cara).
- Usuario que abandona antes de la captura (menos de 2 frames con cara).

**No cierra** (deja pasar):
- Vídeo pregrabado de una persona real moviéndose. **Mismo caso que CooMeet y el resto del vertical**.

Este trade-off se acepta como coste aceptable de la fase actual. La cobertura completa contra vídeo pregrabado se difiere a evolución futura, cuando el operador tenga:
- Moderadores humanos que puedan intervenir dentro de sesiones (modelo CooMeet).
- Face-match contra selfie KYC (deuda `#D-25` original).
- Vendor dedicado de active liveness (iProov / Onfido) cuando el volumen lo justifique.

### Retrocompat y schema

- Los tipos `BLINK/TURN_LEFT/TURN_RIGHT/SMILE` se conservan en `Constants.LivenessChallengeType` y en el CHECK constraint (deuda mínima) para compat con filas históricas ya persistidas en TEST. Las reglas de verify legacy siguen en `evaluate()` sin cambios.
- La migración `V20__liveness_add_presence_challenge_type.sql` relaja el CHECK constraint para incluir `PRESENCE`. Sin cambio de columnas ni backfill.
- El service `LivenessChallengeService` emite **solo** `PRESENCE` tras esta revisión.
- `LivenessProperties.Thresholds` se extiende con la subclase `Presence` (`min-delta` + `min-faces-detected`). Los otros thresholds legacy se conservan.
- El frontend i18n añade `PRESENCE_PROMPT` (ES + EN). Los prompts de gestures viejos se conservan por si aparece una fila con tipo antiguo. El copy de `status.capturing` y `status.failed` se ajusta para no mencionar "gesto".

### Subpasadas afectadas del roadmap

- Subpasada 3 (service + SightEngine adapter): el adapter SightEngine no cambia; solo cambia la regla en `evaluate()`. Los tests unitarios se actualizan con 5 casos PRESENCE (pass con micro-movement, fail con imagen fija, tolerancia a 1 frame sin cara, fail si mayoría de frames sin cara, tipo emitido en startChallenge).
- Subpasada 5 (frontend modal): copy de i18n suavizado. UI del modal sin cambios estructurales.
- Nueva subpasada 8 implícita: revisitar D4 con moderación humana cuando el operador tenga equipo 24/7 disponible post-launch. Puede reactivar BLINK/TURN/SMILE como gate opcional o pasarlos al panel del moderador humano.
