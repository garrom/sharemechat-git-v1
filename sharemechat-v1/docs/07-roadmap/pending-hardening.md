# Endurecimiento pendiente

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

Estado actual:

- Fase 1 (modo OBSERVE) y Fase 2 (respuesta progresiva con delay en HIGH y bloqueo temporal por `emailHash` en CRITICAL) implementadas sobre login de producto y validadas en TEST con tráfico real
- contrato HTTP del login no se ha visto alterado: bloqueo y credencial incorrecta devuelven respuesta indistinguible
- detalles técnicos durables documentados en `docs/02-architecture/backend-architecture.md` y operación del control en `docs/04-operations/runbooks.md`; la decisión estructural está recogida en ADR-008

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
