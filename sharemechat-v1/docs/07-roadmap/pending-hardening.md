# Endurecimiento pendiente

## Internacionalizacion incremental del backoffice

Objetivo:

- habilitar la primera iteracion de i18n del backoffice con riesgo bajo, reutilizando el motor compartido actual y separando logicamente recursos `product` y `admin`

Secuencia:

- Fase 1A: shell autenticado, layout, navegacion lateral, topbar, metapills, estado restringido por email no verificado dentro del shell y selector visible de idioma en el shell
- Fase 1B: acceso al backoffice, login interno, verificacion interna de email y selector visible de idioma en acceso y login

Dependencias minimas:

- ADR de estrategia compartida de i18n aprobado
- uso preferente de `apiFetch` en los archivos admin migrados
- politica mixta de errores ya fijada para la primera iteracion

- homogeneizar enforcement de consentimiento y compliance entre REST y WebSocket
- reducir acoplamiento del frontend a dominios de test
- revisar configuracion realtime por entorno
- evaluar evolucion de uploads locales hacia una estrategia mas escalable si el producto crece
- terminar de cerrar integracion PSP real
- clarificar activacion operativa del proveedor KYC y su documentacion asociada
- mantener la documentacion sincronizada con codigo y sin inventario sensible

## Rediseño controlado del render remoto en Chromium desktop

Incidencia de origen:

- el stage remoto puede encogerse o hacer un salto visual en Chromium de escritorio durante la fase inicial entre `remoteStream` presente y video remoto visualmente listo
- Firefox y mobile no reproducen ese comportamiento
- el flujo WebRTC termina estableciendose correctamente, por lo que el frente abierto es de render y composicion visual

Hallazgos estructurales que justifican rehacer el enfoque por fases:

- RANDOM desktop reacciona muy pronto a `remoteStream` y cambia el layout a `full-remote`
- CALLING desktop reacciona al estado funcional `in-call`, no a readiness visual del remoto
- la zona mezcla wrappers compartidos, overlays y estilos inline en componentes delicados
- RANDOM y FAVORITOS repiten patrones parecidos con diferencias suficientes para que un parche local sea fragil
- una primera implementacion basada en placeholder local y readiness distribuida por componente no supero validacion manual y debe considerarse intento fallido

Plan incremental recomendado:

- fase 0: confirmar rollback completo del intento fallido y validar de nuevo el comportamiento base en Chrome y Edge de escritorio
- fase 1: aislar y documentar el contrato visual deseado del stage remoto desktop, separando claramente estado funcional, estado de media y estado visual
- fase 2: limpieza base sin cambio funcional
- fase 2 detalle:
  normalizar wrappers desktop del remoto entre RANDOM y FAVORITOS
  reducir estilos inline en el stage remoto y mover composicion delicada a styled-components reutilizables
  separar mejor overlay, media remota y capa de placeholder para que no compitan en el mismo bloque improvisado
- fase 3: introducir una base reutilizable de stage remoto desktop con geometria estable y soporte nativo para fase pre-media
- fase 4: activar el nuevo flujo visual primero en RANDOM desktop y validar manualmente antes de extender
- fase 5: extender la misma base a CALLING desktop solo si RANDOM queda estable
- fase 6: cierre documental y ajuste de riesgos una vez la validacion manual confirme que Chromium deja de mostrar salto visual

Criterio de alcance para la primera iteracion util:

- no tocar backend
- no tocar TURN
- no tocar signaling
- no cambiar la logica funcional del emparejamiento o de la llamada
- no mezclar desktop con mobile
- dejar fuera de la primera fase cualquier pulido cosmetico no necesario para estabilidad del stage

### Aterrizaje tecnico de fase 2

Objetivo:

- preparar la zona desktop del remoto para un cambio posterior de comportamiento sin alterar todavia el flujo visual actual

Cambios estructurales concretos esperados:

- extraer de inline styles la geometria repetida de `StyledRemoteVideo` en desktop:
  `position`, `width`, `height`, `overflow`, `background` y radio superior
- extraer de inline styles la geometria basica del `<video>` remoto y del `<video>` local cuando hoy repiten `width`, `height`, `objectFit` y `display`
- normalizar el wrapper desktop del remoto en RANDOM y FAVORITOS para que siga siempre la misma secuencia:
  `StyledCallCardDesktop` -> `StyledCallVideoArea` -> wrapper remoto desktop -> `StyledCallStage` -> capas internas
- separar en estilos reutilizables tres capas ya existentes pero hoy mezcladas:
  capa de media remota
  capa de overlays persistentes
  capa de footer o composer fuera del stage
- introducir nombres y puntos de extension coherentes para estado visual desktop sin activarlo todavia, por ejemplo:
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
- logica de signaling o media
- ramas mobile
- composer o dock de chat fuera del stage salvo lo necesario para mantener consistencia de estructura

### Aterrizaje tecnico de fase 3

Objetivo:

- introducir una base reutilizable del stage remoto desktop que desacople composicion visual, media remota y readiness visual sin extender todavia el cambio a todo el sistema

Responsabilidades de esa base reutilizable:

- reservar geometria estable del remoto en desktop
- encapsular el wrapper remoto y sus capas
- aceptar el `<video>` remoto real y su overlay visual sin que el componente padre tenga que recomponer toda la jerarquia
- soportar una fase pre-media desktop con estado visual propio
- exponer un punto claro para placeholder o capa de transicion sin mezclarlo con chat, top bar o PiP local

Partes comunes que deberia absorber:

- wrapper remoto desktop
- stage base
- capa de media remota
- capa de placeholder o pre-media
- capa superior para top bar, PiP local y overlay de chat

Partes que deberian seguir siendo especificas:

- contenido de top bar de RANDOM frente a FAVORITOS
- acciones inferiores y composer
- reglas funcionales que determinan si RANDOM esta buscando o si CALLING esta en `in-call`
- contenido concreto del chat o de acciones de llamada

Forma recomendada de resolverlo:

- combinacion de subcomponente React pequeño para el stage remoto desktop
- styled-components para la geometria, capas y variantes visuales
- mantener helpers minimos solo para derivar el estado visual, evitando logica dispersa en cada JSX

Contrato estructural recomendado de la base reusable:

- `remoteVideo`
- `remoteVideoRef`
- `remoteWrapRef`
- `visualState`
- `topBar`
- `localPiP`
- `overlay`
- `footer` o composicion externa separada cuando aplique

El objetivo del contrato no es esconder la logica funcional, sino evitar que cada pantalla reconstruya a mano el mismo stage con pequeñas diferencias peligrosas.

### Alternativas para la base reusable

Alternativa conservadora:

- mantener los componentes actuales
- crear solo un subcomponente `DesktopRemoteStageShell`
- pasarle children para top bar, video local, chat y placeholder

Ventajas:

- menor riesgo inicial
- diff mas pequeño
- adopcion progresiva primero en RANDOM

Inconvenientes:

- sigue dejando bastante responsabilidad en cada pantalla
- la consistencia entre RANDOM y FAVORITOS depende mas de disciplina que de estructura

Alternativa mas limpia:

- crear una base reusable mas opinionada para el stage remoto desktop
- esa base controla capas, placeholder, media remota y slots de overlay

Ventajas:

- mejor separacion entre estado funcional y estado visual
- menos duplicidad real
- mas facil extender a FAVORITOS despues de validar RANDOM

Inconvenientes:

- exige una fase 2 mas cuidada
- requiere definir mejor el contrato del stage antes de tocar comportamiento

Recomendacion de implementacion posterior:

- fase 2: converger primero estructura y estilos desktop sin tocar comportamiento
- fase 3: implementar la alternativa conservadora como primer paso real de reutilizacion
- fase 4: activar el estado visual nuevo solo en RANDOM desktop
- dejar FAVORITOS fuera hasta validar que RANDOM mantiene layout estable y no introduce regresiones en overlays, chat o PiP local

Validacion manual esperada por iteracion:

- tras fase 2:
  mismo comportamiento visible que antes en desktop
  misma composicion funcional en RANDOM y FAVORITOS
  ausencia de regresiones en fullscreen, PiP local y overlay de chat
- tras fase 3 en RANDOM:
  geometria estable del stage remoto durante fase pre-media
  transicion limpia cuando el video remoto queda listo
  sin degradar la confirmacion de media ni la experiencia actual en Firefox

Estado posterior de esta linea:

- una variante reciente de integracion en RANDOM desktop ha quedado descartada por introducir una regresion grave de render desktop sobre un problema original que era solo visual y temporal
- esa variante no debe reutilizarse como baseline ni como punto de continuacion directa
- cualquier reentrada futura en este frente debera arrancar desde una base funcional conocida y avanzar con validacion incremental estricta entre fases, manteniendo separado el problema visual de cualquier contaminacion funcional del flujo
