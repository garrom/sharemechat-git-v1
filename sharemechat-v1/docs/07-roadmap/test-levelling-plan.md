# Plan de nivelación de TEST respecto a AUDIT

## Objetivo

Elevar el entorno TEST al mismo nivel operativo que AUDIT sin abrir refactors de aplicación. El backend Spring Boot y el frontend React comparten código fuente con AUDIT y PRO, por lo que la nivelación es casi exclusivamente de infraestructura y operación, con diferencias resueltas por properties y variables de entorno por perfil.

## Principios

- Aplicar el patrón ya validado en AUDIT sin reabrir decisiones.
- Cambios reversibles por fase, con criterio explícito de rollback.
- Cada fase deja el entorno en estado operativo, aunque sea parcial.
- No introducir variaciones de código por entorno — las diferencias viven en properties y variables de entorno.
- No mezclar esta nivelación con frentes funcionales abiertos en `pending-hardening.md`.

## Diferencias observadas entre AUDIT y TEST

Nivel aplicación — sin delta real: mismo código, mismo comportamiento funcional, diferencias resueltas por perfil.

Nivel operativo en TEST respecto a AUDIT:

- backend no arranca de forma persistente tras reinicio de máquina
- storage privado no activado como S3 de forma efectiva en operación (aun estando soportado por código)
- no hay TURN propio operativo en el entorno
- vhost publicado con endurecimiento menos alineado con AUDIT en log format y en política de bloqueo por IP
- no hay pipeline de trazabilidad de accesos desplegado
- legado operativo residual sin retirada ordenada (MySQL local en la máquina, restos históricos sin uso)

## Orden recomendado

El orden minimiza riesgo: primero lo que desbloquea validación funcional, después alineación de endurecimiento, después observabilidad, y finalmente limpieza.

### Fase 1 — Arranque persistente del backend en TEST

Objetivo:

- dejar el backend de TEST como servicio gestionado y reactivo a reinicios del host, al mismo nivel que AUDIT.

Alcance mínimo:

- definir servicio persistente del entorno equivalente al ya validado en AUDIT
- habilitar arranque automático en boot
- validar comportamiento tras reinicio completo de la máquina

Criterios de aceptación:

- el backend vuelve a estado activo sin intervención manual tras reboot
- el perfil de aplicación activo es el del entorno y no el de AUDIT
- properties y variables de entorno del host quedan alineadas con la convención ya usada en AUDIT, sin arrastrar valores concretos de otro entorno

Rollback:

- detener el servicio persistente
- volver al arranque manual previo hasta rehacer la fase

Riesgo: bajo. No cambia ni la aplicación ni su configuración funcional.

### Fase 2 — Storage privado efectivo sobre S3 en TEST

Objetivo:

- operar TEST con el mismo proveedor de storage privado ya validado en AUDIT, cerrando cualquier dependencia funcional del filesystem local.

Alcance mínimo:

- activación efectiva del proveedor S3 privado por variables de entorno estándar del backend
- credenciales AWS del host resolubles por el mecanismo estándar del proveedor, sin secretos hardcodeados en código ni en properties versionadas
- validación de uploads sensibles end-to-end
- retirada del filesystem local legado como fuente activa

Criterios de aceptación:

- subida de documentos correcta
- lectura solo a través de `/api/storage/content`
- ausencia de dependencia operativa del filesystem local legado
- cumplimiento de los mismos criterios ya cerrados en AUDIT para esta activación

Rollback:

- revertir la variable de tipo de storage a la configuración previa
- el cambio es reversible sin tocar código

Riesgo: medio funcional, bajo estructural. El código ya está validado en AUDIT.

Dependencias:

- no depende de fase 1 a nivel estricto, pero conviene ejecutarla con backend ya gestionado por servicio persistente para tener arranque limpio durante la validación.

### Fase 3 — TURN propio operativo en TEST

Objetivo:

- dotar a TEST de la misma base mínima TURN ya cerrada en AUDIT, alineada con ADR-004 y ADR-005.

Alcance mínimo:

- despliegue TURN mínimo para el entorno, una única instancia, sin alta disponibilidad
- credenciales TURN y URLs por entorno resueltas por variables de entorno del host
- backend publica configuración ICE por entorno a través del endpoint ya existente
- frontend consume esa configuración sin cambios

Criterios de aceptación:

- evidencia operativa en el propio servidor TURN de relay funcional a nivel de protocolo
- evidencia frontend de `candidateType=relay` y selected pair `relay (TURN)`
- conexión WebRTC estable en sesión de validación funcional del entorno

Rollback:

- desactivar TURN propio y volver a la resolución externa previa hasta rehacer la fase

Riesgo: medio. Aislado: no toca aplicación, solo infraestructura del entorno y variables de entorno.

Dependencias:

- ninguna sobre fase 1 o 2, pero conviene ejecutarla después para mantener validación funcional estable.

### Fase 4 — Alineación de endurecimiento del vhost

Objetivo:

- alinear el vhost publicado de TEST con el patrón de endurecimiento ya validado en AUDIT, sin cambios funcionales en tráfico útil.

Alcance mínimo:

- log format alineado con el patrón del entorno de referencia
- mecanismo de bloqueo por IP equivalente al ya usado en AUDIT, inicialmente vacío
- headers forward relevantes y timeouts largos de realtime alineados
- límite efectivo de subida HTTP coherente con los límites multipart versionados en backend

Criterios de aceptación:

- el vhost de TEST expone el mismo contrato operativo que el de AUDIT a nivel funcional
- no hay regresión en rutas `/api`, `/match`, `/messages`, ni en storage privado
- el bloqueo por IP está disponible como mecanismo aunque empiece sin entradas

Rollback:

- revertir al vhost anterior del entorno
- el cambio vive fuera del repositorio principal y no arrastra código versionado

Riesgo: bajo, siempre que se valide antes de aplicar.

### Fase 5 — Pipeline de trazabilidad de accesos en TEST

Objetivo:

- replicar en TEST la trazabilidad mínima ya operativa en AUDIT, sin leerla como sistema completo de seguridad.

Alcance mínimo:

- los cuatro componentes ya validados en AUDIT: normalización, clasificación, informe diario y bloqueo de IPs
- activación de logging de la capa edge hacia almacenamiento del entorno
- informe diario por correo hacia el buzón operativo del proyecto

Criterios de aceptación:

- los componentes arrancan por servicios y timers persistentes
- el informe diario se genera y se entrega
- el mecanismo de bloqueo dinámico de IPs queda disponible aunque empiece sin entradas

Rollback:

- deshabilitar timers y servicios
- la infraestructura aplicativa de TEST queda sin degradación funcional

Riesgo: bajo. Es observabilidad perimetral desacoplada del flujo principal.

Dependencias:

- requiere fase 4 para que el log format y el mecanismo de bloqueo estén alineados.

### Fase 6 — Retirada de legado operativo en TEST

Objetivo:

- cerrar la fase dejando TEST sin legado operativo residual que pueda contaminar decisiones posteriores sobre PRO.

Alcance mínimo:

- retirada de servicios locales no usados por la aplicación efectiva del entorno
- liberación de espacio en disco sin afectar a la operación
- confirmación de que ningún flujo depende de artefactos históricos

Criterios de aceptación:

- el entorno no mantiene servicios redundantes ni duplicidades locales respecto al proveedor ya activado en fase 2
- el uso de disco queda en márgenes comparables a los de AUDIT

Rollback:

- cada retirada se realiza con snapshot previo o con pausa intermedia antes de eliminar de forma definitiva

Riesgo: bajo si se hace con verificación previa y snapshot.

### Fase 7 — Validación cruzada y cierre

Objetivo:

- cerrar la nivelación con evidencia end-to-end comparable a la ya documentada en AUDIT.

Alcance mínimo:

- sesión de validación funcional completa del entorno: autenticación, matching, llamadas, gifts, payouts y backoffice
- confirmación de paridad operativa con AUDIT en realtime, storage privado, TURN y trazabilidad de accesos
- actualización del documento del entorno en `03-environments/test.md` con el estado final

Criterios de aceptación:

- el entorno queda en un estado operativo equivalente al de AUDIT a nivel de infraestructura y operación
- las diferencias que permanezcan están justificadas por propósito del entorno y no por deuda

## Fuera de alcance

- cambios estructurales de aplicación, realtime o matching
- refactors de compliance o de contrato de errores
- creación de infraestructura PRO — pertenece a un frente posterior

## Relación con otros frentes

- esta nivelación no debe mezclarse con los frentes abiertos en `pending-hardening.md`
- una vez cerrada, sirve como base estable para planificar la creación del entorno PRO replicando el patrón ya validado en AUDIT y confirmado en TEST
