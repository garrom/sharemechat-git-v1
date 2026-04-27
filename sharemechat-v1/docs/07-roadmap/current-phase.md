# Fase actual

La lectura consolidada del repositorio y del material previo sitúa a SharemeChat en una fase de MVP industrial avanzado.

La fase actual es de **transición hacia GO LIVE controlado**, no únicamente de hardening técnico. La prioridad ya no es solo estabilizar producto y ordenar deuda transversal, sino ejecutar el camino ordenado de fases hacia lanzamiento, captación inicial y monetización real.

El roadmap principal vive en [go-live-roadmap.md](go-live-roadmap.md) y se organiza por fases de negocio. Este documento se mantiene como apunte rápido de estado y de prioridades vivas, y debe leerse contra la fase activa de ese roadmap. El backlog técnico estructural se mantiene aparte en [pending-hardening.md](pending-hardening.md).

A día de hoy la fase activa del roadmap es **Fase 0 — Cierre de riesgos pre-PRO**.

Dentro de Fase 0, la pieza activa de diseño y documentación es **Product Operational Mode** (modos `OPEN/PRELAUNCH/MAINTENANCE/CLOSED` y flags de registro independientes), recogida en [ADR-009](../06-decisions/adr-009-product-operational-mode.md). Estado: diseñada, pendiente de implementación. Es prerrequisito de Fase 1.

## Qué ya existe con consistencia

- producto y backoffice sobre base común
- realtime dividido por dominios
- trazabilidad económica y de streams
- modelo de permisos de backoffice
- aislamiento conceptual de entornos
- observabilidad perimetral desacoplada en AUDIT con normalizacion, clasificacion, reporting y bloqueo real diarios de accesos
- pipeline perimetral AUDIT completamente operativo en modo automatico: normalizer → classifier (ejecucion diaria previa) → blocker real Carril A (07:30 UTC) → nginx actualizado diariamente sin intervencion manual
- gobernanza activa del pipeline perimetral: `check_ops_consistency.py` (repo) y `check_ops_runtime.sh` (EC2); runtime check limpio con `errors=0 warnings=0` tras correccion de orden temporal
- pipeline TEST desplegado en DRY_RUN=1 como entorno de observacion paralelo antes de cualquier activacion de bloqueo real
- `auth-risk` Fase 1 (modo OBSERVE) y Fase 2 (respuesta progresiva con delay en HIGH y bloqueo temporal por `emailHash` en CRITICAL) **completadas y validadas con tráfico real en TEST y AUDIT** sobre login de producto, manteniendo contrato HTTP uniforme y sin filtración de información
- namespace Redis de `auth-risk` aislado correctamente por entorno (`ar:test:*`, `ar:audit:*`) tras corrección y validación de `AUTHRISK_ENV`; logs `[AUTH-RISK]` persistentes en AUDIT vía `journald`

## Qué sigue en transición

- endurecimiento de compliance entre canales
- parametrización real por entorno
- cierre operativo de PSP y KYC externo
- saneado continuo de documentación e infraestructura
- contención y consolidación del sistema i18n en producto y backoffice
- estabilización del contrato funcional de errores entre REST, WebSocket y frontend
- separación progresiva entre lógica de producto, alerts compartidos y copy de interfaz
- extensión de `auth-risk` al resto de superficies de autenticación: login admin, refresh y forgot/reset password
- detección low-and-slow sobre la base actual de `auth-risk` para cubrir ataques deliberadamente lentos por debajo de los umbrales actuales
- persistencia de logs en archivo o `journald` cuando el backend de TEST deje de ejecutarse de forma manual
