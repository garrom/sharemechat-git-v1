# Endurecimiento pendiente

> **Naturaleza de este documento.**
> Este documento es **backlog técnico estructural**, no roadmap ejecutivo. Recoge deuda observable, líneas de hardening y planes de estabilización por frente, sin orden de negocio.
>
> El roadmap principal hacia GO LIVE vive en [go-live-roadmap.md](go-live-roadmap.md) y dicta qué entradas de este backlog se consumen en cada fase y cuándo. Una entrada aquí no implica trabajo inmediato: la prioridad la fija el roadmap.
>
> No borrar entradas técnicas que dejen de ser prioritarias por decisión de fase; marcarlas como obsoletas y mantener la trazabilidad.

## Plan maestro de estabilización progresiva

Objetivo:

- ordenar el siguiente tramo de trabajo sin reabrir demasiados frentes a la vez
- consolidar primero i18n, contrato de errores y superficies críticas de producto
- dejar backend estructural y backoffice en una secuencia realista y trazable

Prioridad ejecutiva:

- inmediata: contención de i18n y de mensajes funcionales visibles en producto
- alta: saneado del criterio de uso de catálogos y del contrato de errores funcionales
- media: estabilización incremental de backoffice y consolidación documental
- posterior a PSP o AUDIT: refactors estructurales amplios que hoy no son requisito para cerrar deuda visible

### Parte 1 - I18N

Fase 1. Contención y estabilización

- identificar y acotar superficies donde la UI sigue mostrando mensajes raw de backend o WebSocket
- eliminar en producto los hardcodes visibles en alerts, modales y estados principales cuando ya exista equivalente en catálogo
- evitar que fixes puntuales de copy contaminen flujos de negocio o modales compartidos
- mantener el idioma visible como responsabilidad del frontend, aunque backend siga emitiendo texto libre

Fase 2. Saneado de catálogos

- revisar la estructura de `es.json` y `en.json` por dominios funcionales y no por ocurrencias puntuales
- consolidar claves de producto reutilizables para purchase, payout, gifts, calling, auth y consent
- corregir duplicidades y literales casi equivalentes antes de seguir ampliando el catálogo
- validar encoding, consistencia de placeholders y simetría real ES/EN

Fase 3. Consolidación del criterio de uso

- fijar una regla estable para errores funcionales: preferir clave i18n propia o mapping frontend y no `err.message` como copy final de UI
- fijar también una regla estable para alerts y modales compartidos: no introducir copy de negocio local en dashboards si la UI ya dispone de helper o contexto común
- dejar documentado que substring matching o heurísticas de texto pueden mantenerse temporalmente para control de flujo, pero no para el texto final de interfaz

Fase 4. Validación por flujos

- validar de extremo a extremo login, register, purchase, random, gifts, calling, payouts, favoritos y consent
- validar desktop y mobile en producto antes de extender limpieza a superficies secundarias
- dejar backoffice para una validación separada una vez el producto tenga criterio estable

### Parte 1B - Product Operational Mode

Capa server-side de admisión al producto, transversal a auth, roles y rate limit. Enum de modo (`OPEN/PRELAUNCH/MAINTENANCE/CLOSED`), dos flags independientes de registro (cliente y modelo) y flag de simulación económica directa, aplicada por filtro REST tras `CookieJwtAuthenticationFilter` y por interceptor de handshake en `/match` y `/messages`. Decisión completa en [ADR-009](../06-decisions/adr-009-product-operational-mode.md).

Estado: **implementación parcial**. Backend implementado en los tres componentes definidos. **Validado con tráfico real en TEST y AUDIT** para el cierre de registro server-side (`PRODUCT_REGISTRATION_CLIENT_ENABLED=false` y `PRODUCT_REGISTRATION_MODEL_ENABLED=false` con `PRODUCT_ACCESS_MODE=OPEN`) y **validado en TEST** para el gobierno de endpoints económicos directos mediante `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED`. Operativa concreta en [runbooks.md](../04-operations/runbooks.md).

Pendiente dentro del alcance de la propia capa:

- validación operativa de los modos `PRELAUNCH`, `MAINTENANCE` y `CLOSED` aplicados al producto (login, refresh, endpoints REST funcionales, handshake WS)
- frontend: tratamiento de `PRODUCT_UNAVAILABLE`, `PRODUCT_MAINTENANCE`, `REGISTRATION_CLOSED` y `SIMULATION_DISABLED` donde aplique
- ejercicio de la allowlist por userId dentro de un modo restrictivo
- decisión sobre la limitación consciente del refresh con access_token expirado en sesiones backoffice
- validación de configuración AUDIT/PROD con `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=false`

Dependencias externas al Product Operational Mode:

- integración PSP real CCBill
- verificación de firma del webhook CCBill

Esta entrada es **backlog técnico consumido por Fase 0** del roadmap principal y sigue siendo **prerrequisito de Fase 1**. No duplicar aquí el contenido de la ADR; cualquier matiz de fondo se discute allí.

No mezclar este frente con i18n ni con auth-risk: el modo decide *si* dejas pasar; auth-risk regula abuso de credenciales sobre login real; i18n decide qué texto mostrar al usuario admitido. Son capas distintas.

### Parte 1C-pre - Pricing simplification y BFPM (ADR-011 + ADR-012)

Estado:

- **Fase 3A — packs P10/P20/P40**: implementada con alcance limitado y validada en TEST. Catálogo legacy `P5 / P15 / P30 / P45` eliminado del código funcional. Detalle estructural en [ADR-011](../06-decisions/adr-011-pricing-simplification-and-minimum-threshold.md).
- **BFPM Fase 4A — bonus EUR financiado por plataforma**: implementada y validada en TEST. Catálogo vigente: P10 sin bonus, P20 con bonus 2 EUR, P40 con bonus 4 EUR. Asientos contables `BONUS_GRANT` (cliente) y `BONUS_FUNDING` (plataforma). Detalle estructural en [ADR-012](../06-decisions/adr-012-bfpm-platform-funded-bonus.md).
- **BFPM Fase 4B-a — auditoría interna contable**: implementada y validada en TEST. Cuatro checks BFPM en `ACCOUNTING_AUDIT` scope `DEFAULT`: `BFPM_INVARIANT_BREACH`, `BFPM_BONUS_GRANT_WITHOUT_FUNDING`, `BFPM_BONUS_FUNDING_WITHOUT_GRANT`, `BFPM_TOTAL_PAGOS_MISMATCH`. Sin falsos positivos. Sin cambios en checks existentes ni en schema.

Pendiente:

- **BFPM Fase 4B-b — reporting backoffice y política de refund con bonus**: endpoint admin con resumen BFPM (bonus emitido / financiado / pares); decisión documental y técnica sobre cómo opera `manualRefundToClient` cuando el saldo cliente incluye bonus consumido o pendiente. Es **prerrequisito** previo a la integración PSP real.
- **Centralización fuerte del catálogo** (BD o endpoint dinámico de packs): no abordada todavía. La duplicidad transitoria frontend/backend queda como deuda técnica aceptada.
- **CCBill real y firma webhook**: bloqueado hasta recibir el manual oficial.

No duplicar aquí el contenido de las ADRs.

### Parte 1C - Superficies económicas no directas

Estado: **pendiente**. Fase 1/Fase 2 ya cerraron el gobierno de endpoints económicos directos (`/api/transactions/first`, `/api/transactions/add-balance`) y el inicio facturable de streams desde `billable_start`/`confirmed_at`. Queda un frente separado para auditar y endurecer superficies que mueven saldo, ledger o estados económicos fuera de esa flag.

Alcance inicial:

- `POST /api/billing/ccbill/notify`: bloqueante antes de dinero real hasta validar firma, origen/contrato PSP, idempotencia y replay.
- admin refund.
- admin payout review.
- admin stream kill.
- gifts por WebSocket.
- stream settlement por WebSocket.
- trials.
- unsubscribe/forfeit.

Esta entrada no reabre Product Operational Mode. `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED` solo gobierna `/api/transactions/first` y `/api/transactions/add-balance`; payout, gifts, trials, refunds y webhook PSP son otra familia.

### Parte 2 - Backend

Qué conviene congelar por ahora

- no rehacer todavía la arquitectura realtime
- no reabrir TURN, matching o cobro salvo incidencia funcional nueva
- no mezclar la estabilización i18n con cambios de negocio o de compliance ya cerrados

Deuda estructural observable

- contrato de errores funcionales no estabilizado entre REST y WebSocket
- uso amplio de `ex.getMessage()` como payload de UI
- mezcla de mensajes libres, códigos parciales y heurísticas por substring
- diferencias de tratamiento entre endpoints REST, handlers WebSocket y frontend

Trabajo posterior recomendado

- definir códigos funcionales estables para errores de negocio visibles en producto
- extender esos códigos primero a saldo, gifts, calling, payout, auth y moderación
- mantener `message` como soporte o fallback, pero no como autoridad de idioma de UI
- planificar esa capa como hardening posterior, no como fix rápido mezclado con copy

### Parte 2B - Auth-risk y abuso de autenticacion

Estado actual consolidado (Fase 1 + Fase 2):

- Fase 1 (modo OBSERVE) y Fase 2 (respuesta progresiva con delay en HIGH y bloqueo temporal por `emailHash` en CRITICAL) implementadas sobre login de producto y **validadas con tráfico real en TEST y AUDIT**
- contrato HTTP del login no se ha visto alterado: bloqueo y credencial incorrecta devuelven respuesta indistinguible (mismo status, mismo body, sin `Set-Cookie`)
- namespace Redis aislado por entorno (`ar:test:*`, `ar:audit:*`) tras corrección y validación de `AUTHRISK_ENV`
- logs `[AUTH-RISK]` persistentes en AUDIT vía `journald`; en TEST siguen siendo efímeros mientras el arranque permanezca manual
- detalles técnicos durables documentados en `docs/02-architecture/backend-architecture.md` y operación del control (activación, validación, diagnóstico, liberación de bloqueo) en `docs/04-operations/runbooks.md`; la decisión estructural está recogida en ADR-008

Objetivo de las siguientes iteraciones:

- consolidar el frente sin reabrir la base ya validada y sin mezclarlo con la defensa perimetral ya desplegada en AUDIT

Pendiente posterior, en orden tentativo:

- nivelado del frente sobre AUDIT antes de considerar cerrado el alcance multi-entorno
- extensión a login admin, refresh y forgot/reset password reusando el mismo `AuthRiskService` y el mismo namespace Redis con sus propios prefijos lógicos
- detección low-and-slow apoyada en señales adicionales (ventanas más largas, agregaciones por subred o ASN) sin tocar la lógica actual de niveles
- persistencia de logs `[AUTH-RISK]` cuando el backend deje de ejecutarse en modo manual: redirección a archivo o `journald` para que la trazabilidad no dependa de la sesión activa
- revisión del age gate de invitado para evitar que un cliente automatizado se salte la fricción aceptando cualquier UUID arbitrario como `consent_id`

Criterio que se mantiene:

- priorizar señales y scoring explicable antes de automatismos agresivos
- mantener este frente separado del pipeline de access audit perimetral para no mezclar ruido general de Internet con abuso real de autenticacion
- no reabrir en esta fase la decisión de WAF, fail2ban ni CAPTCHA dentro del backend Java

### Parte 3 - Frontend producto y backoffice

Subparte A. Producto

Orden recomendado:

- primero journeys críticos visibles: purchase, gifts, random, calling, auth y consent
- después alerts secundarios, favoritos, perfiles y flujos menos sensibles
- por último limpieza cosmética o homogenización de componentes si sigue haciendo falta

Qué validar primero

- dashboard cliente y dashboard modelo
- modales compartidos de compra, payout, report, block y auth
- flujos donde hoy se combinan eventos WebSocket con alerts locales y mensajes backend

Qué dejar para después

- normalización total de todos los alerts legacy
- microcopy fino de superficies no críticas
- refactors amplios de dashboards si no aportan estabilidad inmediata

Subparte B. Backoffice

Orden recomendado:

- consolidar primero shell, acceso, overview, stats y paneles ya parcialmente migrados a i18n
- después abordar paneles con deuda clara de hardcodes y `res.text()` raw: administration, data, finance, db, models y audit
- dejar para el final cualquier reescritura estética o reorganización de componentes admin

Qué merece la pena traducir ya

- accesos, errores principales, overview y paneles usados en operación diaria
- estados de bloqueo, errores de login y paneles de monitorización activa

Qué no es prioridad inmediata

- copy secundaria de auditorías puntuales
- microtextos internos no visibles fuera del equipo
- refactors de estructura admin que no reduzcan riesgo operativo real

## Internacionalización incremental del backoffice

Objetivo:

- habilitar la primera iteración de i18n del backoffice con riesgo bajo, reutilizando el motor compartido actual y separando lógicamente recursos `product` y `admin`

Secuencia:

- Fase 1A: shell autenticado, layout, navegación lateral, topbar, metapills, estado restringido por email no verificado dentro del shell y selector visible de idioma en el shell
- Fase 1B: acceso al backoffice, login interno, verificación interna de email y selector visible de idioma en acceso y login

Dependencias mínimas:

- ADR de estrategia compartida de i18n aprobado
- uso preferente de `apiFetch` en los archivos admin migrados
- política mixta de errores ya fijada para la primera iteración

- homogeneizar enforcement de consentimiento y compliance entre REST y WebSocket
- reducir acoplamiento del frontend a dominios de test
- revisar configuración realtime por entorno
- evaluar evolución de uploads locales hacia una estrategia más escalable si el producto crece
- terminar de cerrar integración PSP real
- clarificar activación operativa del proveedor KYC y su documentación asociada
- mantener la documentación sincronizada con código y sin inventario sensible

## Rediseño controlado del render remoto en Chromium desktop

Incidencia de origen:

- el stage remoto puede encogerse o hacer un salto visual en Chromium de escritorio durante la fase inicial entre `remoteStream` presente y video remoto visualmente listo
- Firefox y mobile no reproducen ese comportamiento
- el flujo WebRTC termina estableciéndose correctamente, por lo que el frente abierto es de render y composición visual

Hallazgos estructurales que justifican rehacer el enfoque por fases:

- RANDOM desktop reacciona muy pronto a `remoteStream` y cambia el layout a `full-remote`
- CALLING desktop reacciona al estado funcional `in-call`, no a readiness visual del remoto
- la zona mezcla wrappers compartidos, overlays y estilos inline en componentes delicados
- RANDOM y FAVORITOS repiten patrones parecidos con diferencias suficientes para que un parche local sea frágil
- una primera implementación basada en placeholder local y readiness distribuida por componente no superó validación manual y debe considerarse intento fallido

Plan incremental recomendado:

- fase 0: confirmar rollback completo del intento fallido y validar de nuevo el comportamiento base en Chrome y Edge de escritorio
- fase 1: aislar y documentar el contrato visual deseado del stage remoto desktop, separando claramente estado funcional, estado de media y estado visual
- fase 2: limpieza base sin cambio funcional
- fase 2 detalle:
  normalizar wrappers desktop del remoto entre RANDOM y FAVORITOS
  reducir estilos inline en el stage remoto y mover composición delicada a styled-components reutilizables
  separar mejor overlay, media remota y capa de placeholder para que no compitan en el mismo bloque improvisado
- fase 3: introducir una base reutilizable de stage remoto desktop con geometría estable y soporte nativo para fase pre-media
- fase 4: activar el nuevo flujo visual primero en RANDOM desktop y validar manualmente antes de extender
- fase 5: extender la misma base a CALLING desktop solo si RANDOM queda estable
- fase 6: cierre documental y ajuste de riesgos una vez la validación manual confirme que Chromium deja de mostrar salto visual

Criterio de alcance para la primera iteración útil:

- no tocar backend
- no tocar TURN
- no tocar signaling
- no cambiar la lógica funcional del emparejamiento o de la llamada
- no mezclar desktop con mobile
- dejar fuera de la primera fase cualquier pulido cosmético no necesario para estabilidad del stage

### Aterrizaje técnico de fase 2

Objetivo:

- preparar la zona desktop del remoto para un cambio posterior de comportamiento sin alterar todavía el flujo visual actual

Cambios estructurales concretos esperados:

- extraer de inline styles la geometría repetida de `StyledRemoteVideo` en desktop:
  `position`, `width`, `height`, `overflow`, `background` y radio superior
- extraer de inline styles la geometría básica del `<video>` remoto y del `<video>` local cuando hoy repiten `width`, `height`, `objectFit` y `display`
- normalizar el wrapper desktop del remoto en RANDOM y FAVORITOS para que siga siempre la misma secuencia:
  `StyledCallCardDesktop` -> `StyledCallVideoArea` -> wrapper remoto desktop -> `StyledCallStage` -> capas internas
- separar en estilos reutilizables tres capas ya existentes pero hoy mezcladas:
  capa de media remota
  capa de overlays persistentes
  capa de footer o composer fuera del stage
- introducir nombres y puntos de extensión coherentes para estado visual desktop sin activarlo todavía, por ejemplo:
  `data-remote-visual-state`
  `data-stage-surface`
  o equivalentes

Piezas que conviene concentrar primero:

- wrapper remoto desktop de RANDOM cliente y modelo
- wrapper remoto desktop de FAVORITOS cliente y modelo
- top bar de stage desktop
- bloque de video local PiP desktop
- contenedor overlay de chat desktop dentro del stage

Piezas que no conviene tocar en fase 2:

- gating por `remoteStream`
- gating por `callStatus`
- eventos `loadedmetadata`, `canplay` o `playing`
- lógica de signaling o media
- ramas mobile
- composer o dock de chat fuera del stage salvo lo necesario para mantener consistencia de estructura

### Aterrizaje técnico de fase 3

Objetivo:

- introducir una base reutilizable del stage remoto desktop que desacople composición visual, media remota y readiness visual sin extender todavía el cambio a todo el sistema

Responsabilidades de esa base reutilizable:

- reservar geometría estable del remoto en desktop
- encapsular el wrapper remoto y sus capas
- aceptar el `<video>` remoto real y su overlay visual sin que el componente padre tenga que recomponer toda la jerarquía
- soportar una fase pre-media desktop con estado visual propio
- exponer un punto claro para placeholder o capa de transición sin mezclarlo con chat, top bar o PiP local

Partes comunes que debería absorber:

- wrapper remoto desktop
- stage base
- capa de media remota
- capa de placeholder o pre-media
- capa superior para top bar, PiP local y overlay de chat

Partes que deberían seguir siendo específicas:

- contenido de top bar de RANDOM frente a FAVORITOS
- acciones inferiores y composer
- reglas funcionales que determinan si RANDOM está buscando o si CALLING está en `in-call`
- contenido concreto del chat o de acciones de llamada

Forma recomendada de resolverlo:

- combinación de subcomponente React pequeño para el stage remoto desktop
- styled-components para la geometría, capas y variantes visuales
- mantener helpers mínimos solo para derivar el estado visual, evitando lógica dispersa en cada JSX

Contrato estructural recomendado de la base reusable:

- `remoteVideo`
- `remoteVideoRef`
- `remoteWrapRef`
- `visualState`
- `topBar`
- `localPiP`
- `overlay`
- `footer` o composición externa separada cuando aplique

El objetivo del contrato no es esconder la lógica funcional, sino evitar que cada pantalla reconstruya a mano el mismo stage con pequeñas diferencias peligrosas.

### Alternativas para la base reusable

Alternativa conservadora:

- mantener los componentes actuales
- crear solo un subcomponente `DesktopRemoteStageShell`
- pasarle children para top bar, video local, chat y placeholder

Ventajas:

- menor riesgo inicial
- diff más pequeño
- adopción progresiva primero en RANDOM

Inconvenientes:

- sigue dejando bastante responsabilidad en cada pantalla
- la consistencia entre RANDOM y FAVORITOS depende más de disciplina que de estructura

Alternativa más limpia:

- crear una base reusable más opinionada para el stage remoto desktop
- esa base controla capas, placeholder, media remota y slots de overlay

Ventajas:

- mejor separación entre estado funcional y estado visual
- menos duplicidad real
- más fácil extender a FAVORITOS después de validar RANDOM

Inconvenientes:

- exige una fase 2 más cuidada
- requiere definir mejor el contrato del stage antes de tocar comportamiento

Recomendación de implementación posterior:

- fase 2: converger primero estructura y estilos desktop sin tocar comportamiento
- fase 3: implementar la alternativa conservadora como primer paso real de reutilización
- fase 4: activar el estado visual nuevo solo en RANDOM desktop
- dejar FAVORITOS fuera hasta validar que RANDOM mantiene layout estable y no introduce regresiones en overlays, chat o PiP local

Validación manual esperada por iteración:

- tras fase 2:
  mismo comportamiento visible que antes en desktop
  misma composición funcional en RANDOM y FAVORITOS
  ausencia de regresiones en fullscreen, PiP local y overlay de chat
- tras fase 3 en RANDOM:
  geometría estable del stage remoto durante fase pre-media
  transición limpia cuando el video remoto queda listo
  sin degradar la confirmación de media ni la experiencia actual en Firefox

Estado posterior de esta línea:

- una variante reciente de integración en RANDOM desktop ha quedado descartada por introducir una regresión grave de render desktop sobre un problema original que era solo visual y temporal
- esa variante no debe reutilizarse como baseline ni como punto de continuación directa
- cualquier reentrada futura en este frente deberá arrancar desde una base funcional conocida y avanzar con validación incremental estricta entre fases, manteniendo separado el problema visual de cualquier contaminación funcional del flujo

### Parte 4 - Compliance, PSP, verificación y monitorización

Frente **abierto**, marcado como **prioritario** dada la fase actual del proyecto (onboarding PSP activo, régimen adult/streaming asumido) pero **sin fase asignada ni prioridad numérica fija** en el roadmap. El secuenciado lo fija el operador caso por caso. Esta entrada cataloga las líneas de trabajo dentro del frente, no las ordena.

Dirección estructural ya fijada:

- Clasificación adult/streaming, descartada la ruta dating ([ADR-028](../06-decisions/adr-028-business-classification-adult-streaming.md)).
- Arquitectura de verificación de edad e identidad (KYC modelos + estimación facial cliente + secundaria, vía Veriff) ([ADR-029](../06-decisions/adr-029-age-and-identity-verification-architecture.md)).
- Pipeline de moderación: build control plane, rent clasificadores ([ADR-030](../06-decisions/adr-030-moderation-pipeline-build-vs-rent.md)).
- Estrategia PSP: redundancia, CardBilling / Verotel vía activa no cerrada ([psp-strategy.md](../01-business/psp-strategy.md)).
- Estrategia geográfica: beachhead anglófono + oleada UE continental ([geographic-strategy.md](../01-business/geographic-strategy.md)).

Líneas de trabajo abiertas dentro del frente (sin orden impuesto aquí):

- **PSP**: cerrar contrato con CardBilling / Verotel (o alternativa). Implementar integración técnica y validación de firma webhook. Mantener integración CCBill disponible por reactivación.
- **Plan B de PSP**: mantener alineado un adquirente adult-specialist alternativo (candidatos identificados: Verotel/Vendo, RocketGate, Epoch) como contingencia ante la condicionalidad de CardBilling / Verotel sobre el método de verificación de cliente (ADR-029). No se hace onboarding paralelo hasta que sea necesario; lo que sí se mantiene actualizado es la información de cada candidato (cobertura, condiciones, postura sobre age assurance). Detalle en [psp-strategy.md](../01-business/psp-strategy.md).
- **Model Collaboration Agreement — residuales tras lote de endurecimiento (2026-06-04)**:
    - Despliegue de la v4.2 (fuera del alcance del lote de endurecimiento, ejecutado por el pipeline TEST → AUDIT → PROD). En el despliegue se materializa el archivado en `ops/legal-history/model_contract/` siguiendo el procedimiento del README de esa carpeta. El archivo en repo arranca limpio desde la v4.2 en adelante.
    - Notificación proactiva por email a las modelos cuando se publica una versión nueva del contrato (job que detecta cambio de `currentVersion` y dispara mail a `acceptedEver=true && acceptedCurrent=false`). Hoy el flujo es pasivo: la modelo solo se entera al cargar el SPA.
    - Flujo formal de supresión completa GDPR de cuenta de modelo que anonimice PII en `model_contract_acceptances` conservando hecho + versión + timestamp + hash. La migración V7 cambió la FK a ON DELETE RESTRICT para preservar el histórico, pero el procedimiento de anonimización aún no está implementado.
- **Verificación de edad e identidad**: automatizar el KYC de modelos (hoy manual). Implementar gate de estimación facial del cliente en la primera recarga, con secundaria por tarjeta/open banking. Garantizar disciplina "pre-pago SFW" en toda la superficie pública.
- **Moderación con IA**: estado parcial. Control plane interno construido en Paquete 1 (commit `6cebf90`, 2026-06-21) con muestreo de frames cadencia 15s, hooks auto-corte/baneo, dashboard mínimo en panel admin (cola + stats). Vendor visual seleccionado: **Sightengine** ([ADR-037](../06-decisions/adr-037-moderation-visual-vendor-sightengine.md)). Adapter real desplegado y `active_mode=SIGHTENGINE` en TEST tras P2.1 (`9d2662c`) + P2.2 (`3e97839`, delegación de decisión granular AMBER/RED al `summary.action` del workflow Sightengine; CRITICAL MINORS/GORE blindado en código). Pendiente: (a) activación SIGHTENGINE en AUDIT (sub-paquete dedicado); (b) activación SIGHTENGINE en PROD pre-go-live (sub-paquete dedicado, incluye salto del plan Free al Starter $29/mes del vendor); (c) vendor CSAM dedicado (PhotoDNA/Thorn) — hoy cubierto tácticamente por Sightengine `minor` + KYC layered defense; (d) attendance log de presencia de la modelo en cámara durante stream; (e) preview de imagen del `evidence_ref` en panel admin (hoy solo expone la S3 key); (f) integración moderación de chat (clasificación de texto + acción); (g) workflow formal de quejas con SLA y trazabilidad al PSP; (h) reporting mensual + nil report al PSP. El detalle operativo y las deudas vivas viven en la entrada de bitácora del 2026-06-27 (cierre P2.1 + P2.2) y en `known-debt.md`.
- **Entregables compliance accionables**: declaración 2257 + Records Custodian. Cinco políticas formales que el PSP exige (Content Management, Consumer Age Verification, Complaint & Removal, Model Agreement, Chargeback-Fraud Mitigation). SLA de 5 días hábiles para quejas. Reporting mensual + nil report al PSP. Valoración membresía ASACP. DPIA + base jurídica del flujo biométrico bajo GDPR. Alineación DSA art. 28. Detalle accionable en [compliance-deliverables.md](../01-business/compliance-deliverables.md).
- **Equipo humano de moderación**: pendiente de plan operativo según volumen real (staff propio o vendor de trust & safety gestionado).
- **Country-gating real**: futuro ADR específico cuando se cierre la lista concreta de mercados servidos. Reusará el mecanismo de [ADR-007](../06-decisions/adr-007-country-blacklist-phase1-backend-primary.md).

Naturaleza del frente: cada línea avanza a su ritmo y bloquea distintos puntos del roadmap. Algunas son bloqueantes para el go-live público (estimación facial cliente, declaración 2257, políticas formales), otras son endurecimiento continuado post-go-live (capa IA completa, attendance log, equipo trust & safety).

No duplicar aquí el contenido de los ADRs ni de los docs business. Cualquier matiz de fondo se discute allí.

---

## Parte 5 - Experiencia de usuario y captación (post pivote 2026-07-27)

Tres líneas de trabajo alistadas tras el pivote de estrategia del 2026-07-27 (cripto como método secundario, PSP tarjeta como método principal en cuanto se cierre onboarding). Ninguna es bloqueante para arrancar PSP tarjeta, pero las tres reducen fricción o riesgo operativo en el escenario de captación masiva que ese frente traerá.

### 5.1 Sistema de tickets de incidencias (ADR-054)

Estado: **ADR-054 aceptado el 2026-07-27**, cero implementación técnica. Detalle completo del alcance y las 6 fases planificadas en el Frente 4 de [`current-phase.md`](current-phase.md).

Objetivo:
separar la gestión de **incidencias** (problemas reales con posible compensación económica) de las **consultas** (dudas resueltas por el bot LLM), y construir el sistema de trazabilidad + verificación automática + compensación antes de que el frente PSP tarjeta traiga reclamaciones masivas inevitables (chargebacks preventivos, cortes técnicos, moderación auto-cut percibida como injusta, saldo no acreditado).

Reutilización estructural del ADR-046 (chat soporte + panel humano) para el canal de comunicación y del panel financiero admin actual (`AdminFinancePanel` + `TransactionService.manualRefundToClient`) para la compensación económica — zero refactor del ledger contable.

### 5.2 Login con Google (OAuth2) — ADR-058

**Estado: Fase 1 completada end-to-end en TEST (2026-08-06). Fase 2 (deploy AUDIT + PROD) BLOQUEADA por Fase 0.3.**

Ver ADR-058 para el diseño y decisiones aceptadas. Referencia de implementación: entrada bitácora `docs/project-log.md#2026-08-06`.

Alcance implementado (Fase 1, sólo rol CLIENT, patrón fan/creator OnlyFans validado):
- Backend: migraciones V47 (tabla `oauth_accounts` multi-provider) + V48 (`users.password` NULLABLE). Endpoint público `POST /api/auth/google` con pipeline completo de auth (age-gate + rate-limit + country + auth-risk + backoffice deny + status + cookies JWT). Endpoints autenticados `/api/users/me/oauth/*` para link/unlink/relink y `/api/users/me/password/initial` para añadir password fallback a users Google-only. `GoogleIdTokenVerifierService` con la librería oficial `google-api-client:2.7.2` (rechazado explícitamente `spring-boot-starter-oauth2-client`). Política account linking **híbrida P2/P3**: auto-link solo si `email_verified=true` en ambos lados (Google claim + BD); si no, `EMAIL_COLLISION_NEEDS_PASSWORD` (usuario debe login clásico y vincular desde perfil). Identificador federado: claim `sub` de Google (no email, por spec).
- Frontend: componente `GoogleSignInButton` reutilizable con GIS oficial (`renderButton`). Integración en `LoginModalContent` (vista login) y `RegisterClientModalContent` (vista register-client). Card "Cuentas vinculadas" en `/perfil-client` con estado + unlink + sub-form contextual "Añadir contraseña". Hook `useGoogleAuth` con mapping exhaustivo de códigos backend a i18n. Tests 17/17 verde.
- Fase 0 Google Cloud: proyecto `sharemechat-auth` separado del `sharemechat-analytics`; OAuth Client Web application con 3 orígenes autorizados; consent screen en modo **Testing** con 2 test users Gmail del operador.

---

> **⚠️ ESTADO — Feature flag activo, PROD desplegable sin bloqueo**
>
> **Update 2026-08-07 (Estrategia 3)**: el bloqueo original "no desplegar Fase 2 a PROD hasta publicar consent Google Cloud" ha sido reemplazado por un **feature flag en frontend** (`isGoogleOAuthEnabled()` en `frontend/src/config/runtimeEnv.js`). El flag detecta el hostname en runtime: `true` en TEST/AUDIT/localhost, `false` en PROD (dominio raíz `sharemechat.com` y subdominios PROD). Efecto:
>
> - **HEAD siempre es desplegable a PROD sin restricción**. El botón GIS, el separador "o", la card "Cuentas vinculadas" del perfil, y todo componente UI de Google están ocultos automáticamente en PROD por el flag. Backend Google endpoints presentes (`/api/auth/google`, `/api/users/me/oauth/*`) pero inaccesibles porque nada del frontend PROD los llama.
> - **Sin dependencia de `PRODUCT_ACCESS_MODE=PRELAUNCH`** para el gate. Puedes bajar PRELAUNCH cuando quieras, Google sigue oculto en PROD por el flag.
> - **Override manual** disponible para pruebas puntuales: variable de entorno build-time `REACT_APP_GOOGLE_OAUTH_FORCE_ENABLED=true` fuerza el UI en cualquier hostname (uso previsto: build de verificación post-brand-verification antes del cutover definitivo).
>
> **Secuencia para activar Google en PROD cuando corresponda**:
> 1. **Fase 0.3**: publicar consent screen a Production en Google Cloud Console + pasar brand verification.
> 2. Cambiar el default del flag en `runtimeEnv.js` (invertir el check `IS_PROD_ENV` o eliminar el flag entero si Google queda activo permanentemente).
> 3. Build + deploy frontend PROD.
>
> **Riesgo asociado a Fase 0.3**: Google puede rechazar brand verification para plataforma adult, o exigir disclaimers/screenshots/videos del flow. Si rechaza definitivamente, ADR-058 se mantiene en TEST/AUDIT como sandbox y PROD sigue con el flag OFF sin cambios. Coste esperado: 1-2 sesiones del operador + 3-8 semanas de revisión de Google en el peor caso.

---

Fase 2 AUDIT (no bloqueada, ejecutable cuando el operador quiera):
- SSH audit-backend: añadir `GOOGLE_OAUTH_CLIENT_ID` a `/opt/sharemechat/config.env`.
- Deploy backend (Flyway aplica V47+V48 en RDS AUDIT).
- Deploy frontend audit (product + admin surfaces).
- Smoke: `POST /api/auth/google` con token inválido → 401/403 esperado (endpoint vivo).
- Los 2 test users Gmail del operador pueden hacer flow completo en `audit.sharemechat.com`.
- Estimación: ~20 min end-to-end.

### 5.3 Traductor automático en chat P2P — HECHO (2026-08-08)

Estado: **implementado y desplegado en TEST**. Cerrado el 2026-08-08.

Traduce automáticamente los mensajes recibidos en las 3 superficies de chat
del producto (chat P2P WhatsApp favoritos, chat overlay durante llamada 1a1
favoritos, chat overlay durante videochat random) al idioma preferido del
viewer, cuando el sender escribe en un idioma distinto. Cache backend en
tabla `message_translations` por `(messageId, targetLang)` evita re-llamar
al provider ante el mismo mensaje visto de nuevo.

**Decisiones tomadas y aplicadas:**
- **Proveedor**: Google Cloud Translation v2 (500K chars/mes gratis
  forever, luego $20/M). Adapter vendor-agnostic
  (`TranslationProvider` interface) permite migrar a DeepL sin cambio
  de dominio.
- **Idioma preferido del user**: selector explícito
  `users.preferred_chat_lang` (VARCHAR(5) NULL) con fallback a `ui_locale`.
  15 idiomas soportados (es, en, pt, fr, it, de, nl, pl, ru, ja, zh, ko,
  ar, tr, ro) en constante `SupportedChatLanguages`.
- **Qué se traduce**: mensajes RECIBIDOS en idioma distinto (mensajes
  propios NO se traducen; MVP alineado con pattern WhatsApp). Traducir
  también mensajes propios al idioma del peer (pattern CooMeet exacto,
  requiere `peerLang` en conversación) queda como T7 opcional.
- **Cache**: tabla side `message_translations` (message_id + target_lang
  UNIQUE, FK CASCADE a messages). Migration V51.
- **Gifts / mensajes con marker `[[GIFT:*]]`**: no se traducen.
- **Toggle on/off**: global por sesión, persistido en localStorage
  (`sharemechat.chat.showOriginal`). Botón flotante "Ver original /
  Mostrar traducciones" visible cuando hay al menos un mensaje del peer
  en la conversación en curso.

**Coste operativo real**: 0€ en TEST y previsiblemente meses en soft launch
(cache + volumen bajo). Overage estimado $5-25/mes en early growth.

**Modo degradado**: si `translation.google.enabled=false` o `apiKey`
blank, endpoints devuelven 503 y la UI oculta toda la superficie de
traducción (toggle, sub-línea, card selector perfil). Permite arrancar
TEST/AUDIT/PROD sin credenciales configuradas.

**Entregables backend** (commit `6f52ceb`):
- Migration V51 (`message_translations` + `users.preferred_chat_lang`).
- Entity `MessageTranslation` + `MessageTranslationRepository`.
- `TranslationProvider` interface + `GoogleCloudTranslationClient` adapter.
- `MessageTranslationService` cache-first + batch.
- `MessagesController`: `POST /api/messages/{id}/translate`, `POST
  /api/messages/translate-batch`, `GET /api/messages/translation-config`.
- `UserController`: `PUT /api/users/me/preferred-chat-lang` validado.
- `SupportedChatLanguages` constant.
- Config `translation.google.*` con env vars `TRANSLATION_GOOGLE_*`.

**Entregables frontend** (commits `6cce95b`, `a5a1e7e`, `e87015f`,
`391f7eb`, `5e14bbc`, `505b810`, `da693d9`, `6261058`):
- `api/translationApi.js`, `hooks/useTranslationSettings`,
  `hooks/useMessageTranslations`, `components/PreferredChatLangCard`.
- `SupportMessageBubble` con prop `translation` (sub-línea suave bajo el
  content con icono ↻).
- `VideoChatFavoritosCliente/Modelo`: chat P2P WhatsApp + overlay call
  (con snapshot de ids para filtrar solo mensajes de la llamada actual).
- `VideoChatRandomCliente/Modelo`: hooks + toggle + retención de msgId
  al recibir mensaje por WS.
- `DashboardClient/Model.onChatMessage`: retiene `msgId` + `senderId`
  del WS backend para reutilizar el endpoint batch existente con cache
  BD compartido.
- `PerfilClient/Model`: card "Idioma del chat" con selector 15 idiomas
  (auto-oculta si feature disabled).
- i18n keys `chat.translation.showOriginal` + `showTranslations`
  (es + en).

**Deuda opcional (T7)**: traducir mensajes propios al idioma del peer
(pattern CooMeet exacto simétrico). Requiere `peerLang` disponible en el
frontend (extender `MessageDTO.senderLang` o endpoint conversations con
peerLang). ~1 sesión. Solo si se detecta valor en producción tras uso real.

**Bugs colaterales resueltos durante el frente**:
- Scroll de página en dashboard favoritos con historial largo (Fase A
  refactor styled-components; anterior bug latente desde 7e6b543).
- `openChatWith` al re-clickear mismo contacto → chat vacío infinito
  (commit b9948a4).
- Overlay call chat no persistía histórico durante llamada — resuelto
  con snapshot de ids conocidos, no timestamps (evita bug de zona
  horaria backend LocalDateTime sin zone).
- `style={{position:'relative'}}` inline sobre `StyledChatContainer`
  colapsaba el overlay a 0px alto (sobrescribía el `position:absolute
  inset:0` nativo del styled).

### 5.4 Sistema Master/Studio (ADR-056)

Estado: **ADR-056 aceptado el 2026-07-29**, cero implementación técnica. Detalle completo del alcance y las 8 fases planificadas (S1-S8) en el Frente 5 de [`current-phase.md`](current-phase.md).

Objetivo:
introducir rol MASTER (estudios de webcam) tras pivote estratégico de captación — 6 meses de captación fallida de modelos individuales por barrera de acceso, no por régimen económico (SharemeChat ya ofrece 2× lo que da LiveJasmin al broadcaster individual). Los estudios colombianos aportan 5-15 modelos entrenadas por captación, resolviendo el problema.

Cambios estructurales al régimen económico ADR-052: reparto dual INDIVIDUAL (50-60% T1-T4) vs MASTER (50-70%), umbrales absolutos sacados de LiveJasmin oficial (L1/L3/L5/L7 equivalente EUR: 0/1.000/4.000/15.000 €), motor unificado con detección Master en `StreamService.endSession`, escalado agregado por Master, payouts multi-rail (Paxum → Yoursafe → cripto).

Sin grandfathering — modelos individuales existentes pasan al nuevo régimen desde momento de aplicación (coste real ≈ 0 dado que hoy hay 0 modelos facturando en T2+).

**Resuelto 2026-07-31 — Redirect browser Didit Master apunta a `/master-kyc-didit/processing`**:
- Backend: fix `assertWorkflowIdMatchesSessionType` acepta webhook con
  workflow=model sobre sesión MASTER cuando `masterWorkflowId` está en
  fallback (esperado hasta que el operador cree workflow dedicado en Didit
  dashboard).
- Frontend: nueva página `MasterKycDiditProcessingPage.jsx` con
  `RequireRole=MASTER`, ruta `/master-kyc-didit/processing`, polling
  `/api/masters/me/overview` cada 3s hasta 60s.
- Env vars TEST: publicado `KYC_DIDIT_MASTER_CALLBACK_URL=https://test.sharemechat.com/master-kyc-didit/processing`
  en `/opt/sharemechat/config.env` + restart servicio.
- **Pendiente PROD/AUDIT**: publicar el env var equivalente
  `KYC_DIDIT_MASTER_CALLBACK_URL=https://sharemechat.com/master-kyc-didit/processing`
  (PROD) y `https://audit.sharemechat.com/master-kyc-didit/processing`
  (AUDIT cuando esté disponible) antes del deploy del frontend Master a
  esos entornos. Sin ese env var el fallback a `KYC_DIDIT_CALLBACK_URL`
  legacy vuelve a romper el redirect.

**Deuda operativa 2026-07-31 — Contrato Modelo v4.2 publicado solo en TEST**:
el PDF servido en `https://assets.test.sharemechat.com/legal/model_contract.pdf`
(manifest version `model_contract_v42_2026-07-31`, sha256
`3E1CBFAC1A12277CFB13455371E42D038F1B44149B6CBF55199F13EBFF0CEDA3`)
sustituye la v4.1 anterior (mismo texto legal + ajuste menor Section 2
adult-oriented + formato limpio reportlab en lugar de `markdown-pdf`
que rompía cada frase en párrafo suelto). Generado por
`ops/legal-pdfs/generate_legal_pdfs.py` como job #10 y archivado en
`ops/legal-history/model_contract/model_contract_v42_2026-07-31.pdf`.
Cambia SHA256 → las modelos que ya firmaron v4.1 pasan a estado
`acceptedCurrent=false` y necesitan re-firmar antes de operar (en TEST
no hay modelos reales, en PROD sí habría que planificar re-aceptación
masiva). **Antes de PROD/AUDIT**: replicar publicación al bucket
correspondiente (`assets-sharemechat-audit` / `assets-sharemechat-prod`)
+ manifest.json + invalidación CloudFront de la distribución de assets
del entorno + copia al histórico local con la misma version_id (regla
de `ops/legal-history/README.md`: nombre fichero = version del manifest,
nunca sobrescribir).

**Deuda operativa 2026-08-01 — Tabla de referencia de tramos en dashboard Master**:
al aplicar la Opción D se rediseñó el panel Tarifa del modelo bajo
Master para ocultar la tabla T0-T3 INDIVIDUAL (irrelevante para su
reparto real). En su lugar, dicha tabla — con las dos variantes
INDIVIDUAL y MASTER — debe mostrarse en el dashboard Master (tab
Overview o pestaña dedicada), para que el Master pueda planificar
tarifas y anticipar el escalado de sus modelos. Estado: no
implementada. Prioridad baja tras cerrar Opción D + puntos de UX
Master 2026-08-01.

**Deuda operativa 2026-08-01 — Dashboard Modelo bajo Master necesita vista de transparencia "Lo que has generado" (Opción D)**:
tras el cambio 2026-08-01 que unifica el reparto de gifts al motor de
tramos (JAR `dbf22209`, ver TransactionService.processGiftInternal),
la modelo bajo Master no ve `STREAM_EARNING` ni `GIFT_EARNING` en su
tab Facturación — todo el earning se atribuye al Master. Consecuencia:
la modelo pierde visibilidad de lo que genera y no puede verificar
que el Master le paga off-platform el `internal_share_pct` pactado.
Vector de conflicto en el sector adult.

**Opción D aprobada por operador 2026-08-01** (pendiente de implementar):
- Backend: query del historial modelo debe incluir transacciones donde
  `attributed_model_user_id = suUserId` (aunque el `user_id` sea el
  Master). Exponer también `internal_share_pct` vigente de la modelo
  al propio endpoint del modelo (`GET /api/models/me/*` o similar).
- Frontend Modelo: en la tab Facturación, si `master_user_id != null`:
  - Banner claro: "Estos ingresos son propiedad de tu Master {name}.
    Cobras según acuerdo interno pactado ({X}%). Contacta con tu
    Master para tus pagos."
  - Columna extra "Tu neto pactado" = `importe × internal_share_pct/100`.
- Sin cambio de flujo económico, solo lectura + banner + columna
  calculada. Máxima transparencia sin renegociar el modelo económico.

Prioridad: mañana 2026-08-02 al retomar S5.a.8 (agrupable con S5.a.8.c
"columna €/min neto modelo" del panel Master, que también necesita
exponer `internal_share_pct` desde backend).

Trigger para el operador cuando retome: buscar "Opción D" o
"opcion-d-modelo-bajo-master" en pending-hardening + memoria.

**Deuda operativa 2026-07-31 — Cláusulas D7 del Contrato Modelo (chargebacks/disputa/reserva) pendientes hasta Sub-frente 3 técnico ADR-052**:
el borrador `docs/01-business/model-contract-v5-clauses-d7-draft.md`
define X.1-X.7 (categorías costes, notificación 7d, umbral 5%,
disputa 10d, transparencia panel, consentimiento, reserva 5%×90d).
Ninguna cláusula X.2-X.7 se puede publicar hoy porque el respaldo
técnico no existe (no hay tabla `payout_deductions`, no hay cálculo
ratio individual, no hay botón disputa panel, no hay tickets
internos, no hay retención automática 5%). Publicar creando
obligaciones incumplibles daría argumento legal directo a la modelo.
El v4.1 §8 vigente ("Adjust or reverse earnings in case of disputes,
chargebacks, or violations") cubre el mínimo hoy porque no hay D9
descuentos automáticos desplegados (todo ad-hoc por operaciones).
**Cuando toque implementar Sub-frente 3 técnico ADR-052 (D9)**:
crear entidad `DeductionEvent` + tabla `payout_deductions` +
service notificación 7d + endpoint disputa + panel modelo botón
disputa + retención 5% × 90d + estado `UNDER_REVIEW` en
`PayoutRequest`. Solo entonces publicar v5 real con cláusulas X.1-X.7
completas.

**Deuda operativa 2026-07-31 — Contrato Master publicado en TEST es BORRADOR**:
el PDF servido en `https://assets.test.sharemechat.com/legal/master_contract.pdf`
(manifest version `master_contract_v1_2026-07-31`, sha256
`490864CE00608B13332DFAA71AA9C6C723F0126276DAAAA5C3302760D2F376D7`)
es la conversión directa de `docs/01-business/master-contract-v1-draft.md`
generada con `markdown-pdf` para desbloquear el flujo end-to-end de firma
en TEST (S5.a fix, 2026-07-31). El fichero fuente es **draft** — redactado
entre operador y Claude sin revisión legal — y contiene la tabla de tramos
económicos que la revisión D4 (2026-07-30) reemplazó por referencia al
Dashboard Master. **Antes de PROD**: revisar el MD desde cero, validar
cláusulas 5.1-5.5 tras revisión D4, publicar versión nueva con
`master_contract_v1_YYYY-MM-DD.pdf` distinta y actualizar el manifest en
S3 PROD (`assets.sharemechat.com/legal/master_contract.pdf`) + S3 AUDIT
cuando esté disponible. También revisar si conviene sustituir `markdown-pdf`
por generación con plantilla profesional (pandoc + template LaTeX, o
Puppeteer HTML→PDF con estilo de marca).

**Referencia UX Studio LiveJasmin — mapa de servicios a replicar (2026-08-08)**:
observado del backoffice `StudioAccount` de LiveJasmin (acceso público al
onboarding Studio). Sirve como baseline funcional del dashboard Master de
SharemeChat cuando el sistema esté consolidado. NO es alcance de S1-S8
actual; iteración posterior tras validar Master en producción con volumen
real. No se archiva screenshot en repo (copyright competidor).

Módulos observados en el nav lateral del backoffice LiveJasmin Studio:

1. **Models** — CRUD y gestión de modelos vinculadas al Master.
   - Buscador por nombre.
   - Filtros por estado con contadores: All Models, Online, Unfinished
     (KYC incompleto), Rejected, Active, Closed, Suspended.
   - Orden por categoría (Amateur Girl, Dancer, Fetish Woman, Free Show
     Girl, etc.).
   - Botón "Add new Model" que dispara flujo de onboarding.
   - Por cada modelo: avatar, nombre, categoría, estado, acciones rápidas
     (info, stats individual, settings, preview).
2. **Statistics** — analítica agregada por Master y por modelo.
3. **Messages** — bandeja de comunicaciones con la plataforma o modelos.
4. **Personal Data** — datos del propio Master (fiscal, contacto).
5. **Payout** — gestión de pagos con submenú (probable: métodos,
   historial, próximo pago, umbrales, invoices).
6. **Loyalfans** — integración cruzada con otro producto del grupo LiveJasmin.
7. **Referrals** — programa referidos con submenú (invitar modelos y/o
   Masters, tracking comisiones).
8. **Help & Info** — documentación, FAQ, contacto soporte con submenú.

Traducción al roadmap SharemeChat (post-launch, no bloquea S1-S8):

| Módulo LiveJasmin | Estado en SharemeChat | Prioridad |
|---|---|---|
| Models — tabla con filtros y contadores por estado | Falta; S3-S4 solo cubre invitación y onboarding, no la vista tabla con filtros/badges | **Alta** (usabilidad con 5-15 modelos por Master) |
| Statistics agregado por Master | Falta; solo overview per modelo | **Alta** (visibilidad económica al Master) |
| Payout con historial + próximo pago + umbrales | Parcial en S6 payout multi-rail; falta UX de historial y próximo pago | Media |
| Referrals programa Master→Master o Master→modelo | Falta | Media (crecimiento viral) |
| Messages centralizado | Cubierto conceptualmente por tickets ADR-054 con canal Master-plataforma | Baja |
| Help & Info integrado | Falta; el operador acompaña a cada Master en persona por ahora | Baja |

### Naturaleza y prioridad de la Parte 5

Las cuatro líneas comparten haber sido levantadas conversacionalmente durante las sesiones del 2026-07-27 (5.1-5.3, pivote hacia PSP tarjeta) y 2026-07-29 (5.4, pivote hacia captación estudios). Ninguna tiene fecha impuesta. Orden sugerido según impacto en fricción vs riesgo técnico:

1. **5.1 Sistema de tickets** — HECHO (T1-T6 completadas 2026-07-27).
2. **5.3 Traductor** — HECHO (T1-T6 + streaming completados 2026-08-08).
3. **5.4 Sistema Master/Studio** — impacto estratégico alto (posibilita captación), ADR aceptado, 8 fases planificadas. Bloquea siguiente ciclo comercial.
4. **5.2 Google login** — impacto alto en fricción registro cliente, bloqueado hasta verificar TOS Google para adult.
