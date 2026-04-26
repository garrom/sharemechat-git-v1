# ADR-008: Auth-risk con respuesta progresiva sobre login de producto

## Estado

Aprobada e implementada en backend. Validada en TEST con tráfico real sobre login de producto. Pendiente de extensión al resto de superficies de autenticación y de nivelado sobre AUDIT.

## Contexto

SharemeChat ya disponía antes de esta decisión de un rate limit clásico en backend (`ApiRateLimitService` y `ApiRateLimitFilter`) y de un pipeline perimetral de auditoría desplegado en AUDIT, orientado a tráfico HTTP general de borde.

Ese rate limit clásico es necesario pero no suficiente como capa de defensa frente a abuso de autenticación: regula caudal pero no observa la forma del ataque y trata por igual a la primera petición legítima y al intento número cinco de un atacante. El pipeline perimetral de AUDIT, por su parte, está diseñado para tráfico hostil genérico y no debe mezclarse con señales propias de credenciales.

Quedaba abierto el frente `auth-risk`: una capa específica para detectar patrones anómalos sobre login y aplicar respuesta proporcional sin crear arquitectura nueva ni introducir CAPTCHA, WAF ni decisiones de borde.

## Problema

Era necesario decidir:

- qué señales observar sobre login de producto sin contaminar el rate limit existente
- cómo expresar el riesgo de forma explicable y operable
- qué hacer cuando el riesgo es alto, sin filtrar información al atacante ni alterar el contrato HTTP percibido por el frontend
- dónde colocar la lógica para que sea fácilmente extensible a otras superficies de autenticación

## Decisión

Se introduce una capa nueva **Auth-risk** dentro del backend Java, sin paquetes nuevos, con tres piezas: `service/AuthRiskService`, `service/AuthRiskContext` y `constants/AuthRiskConstants`.

La capa se rige por dos principios estructurales:

1. **Observación primero, respuesta después.** Un primer despliegue funcional registra eventos y calcula nivel sin actuar (modo OBSERVE). Un segundo paso, gobernado por una propiedad independiente, activa la respuesta progresiva.
2. **Contrato HTTP uniforme.** Toda la lógica de defensa permanece invisible al cliente: las respuestas de login no cambian, ni en status code, ni en mensaje, ni en headers, ni en cookies.

### Modelo de eventos y estado

- Eventos: `LOGIN_ATTEMPT`, `LOGIN_SUCCESS`, `LOGIN_FAILURE` (login de producto)
- Estado en Redis bajo namespace `ar:{env}:`, separado del resto de claves del backend
- Contadores de fallo por `emailHash` y por IP con TTL corto
- Sets de IPs distintas por `emailHash` y de `emailHash` distintos por IP con TTL largo
- Clave de bloqueo temporal por `emailHash` cuando se alcanza nivel CRITICAL

### Niveles y respuesta progresiva

- `NORMAL` y `SUSPICIOUS`: solo log
- `HIGH`: retardo aleatorio en un rango configurable antes de devolver el fallo
- `CRITICAL`: bloqueo temporal por `emailHash` mediante `SET NX EX`, sin refrescar TTL si ya existe

Durante el bloqueo, los siguientes intentos contra ese `emailHash` devuelven el mismo 401 que un fallo de credenciales y **no contaminan los contadores ni los sets**, lo que evita extender artificialmente el bloqueo a costa de futuros intentos legítimos.

### Privacidad y observabilidad

- los logs llevan prefijo `[AUTH-RISK]` y nunca contienen email plano, password, JWT, refresh token raw ni hash de refresh token
- el email se transforma con HMAC-SHA256 truncado usando una salt configurable por entorno
- el user-agent también se sustituye por un hash truncado
- si la salt está vacía cuando la capa está habilitada, el servicio cae a no-op con un único warn discreto

### Fail-open

- toda excepción dentro del scoring o de las operaciones Redis se silencia
- si Redis no responde, el login funciona como antes
- si la salt no está disponible, la capa no actúa

## Por qué bloqueo por `emailHash` y no por IP

Bloquear por IP en este frente introduciría dos problemas de impacto desproporcionado:

- las redes con NAT corporativa, salida móvil agregada o CGN pueden agrupar a muchos usuarios legítimos detrás de una sola IP; bloquear esa IP convierte un único intento abusivo en una incidencia que afecta a todos
- el control por IP ya existe en otra capa: `ApiRateLimitFilter` aplica límites IP-based al login y al refresh, y la auditoría perimetral de AUDIT se encarga del tráfico hostil genérico

El `emailHash` es la unidad mínima coherente con el activo a proteger, una credencial concreta. El bloqueo por `emailHash` afecta solo a la cuenta abusada. Si en una iteración futura se necesita bloqueo por IP, debe diseñarse separadamente, con allowlist explícita y umbrales más conservadores, no extendiendo este mecanismo.

## Por qué contrato HTTP uniforme

Devolver una respuesta diferente cuando el `emailHash` está bloqueado convertiría el control en un oráculo: un atacante podría enumerar emails válidos comparando respuestas y, por la misma vía, descubrir si una cuenta está actualmente bajo escrutinio del sistema.

Mantener el mismo 401 con el mismo mensaje "Credenciales inválidas" garantiza que:

- el atacante no obtiene señal sobre si su `emailHash` está bloqueado
- el frontend no necesita conocer el control y no requiere cambios
- los runbooks operativos no dependen de un nuevo código de error

El delay en HIGH es deliberadamente aleatorio dentro de un rango, lo que reduce la facilidad para usar la latencia como fingerprint del sistema, sin pretender eliminarla.

## Por qué no CAPTCHA en esta fase

El CAPTCHA exige integración frontend, gestión de proveedor externo, decisiones de privacidad respecto al usuario legítimo y un coste operativo no trivial. La presente decisión prioriza ganancias inmediatas sobre la base ya existente:

- la respuesta progresiva ya añade fricción real al ataque automatizado sin tocar UX legítima
- CAPTCHA podría introducirse más adelante como capa adicional, no sustitutiva, condicionada al comportamiento detectado por Auth-risk
- mientras tanto, el sistema queda observable y reversible en cualquier momento

Si en una fase posterior se decide adoptar CAPTCHA, debería ser dirigido (mostrarse solo cuando Auth-risk lo justifique) y nunca por defecto.

## Alternativas consideradas

- **Solo modo OBSERVE permanente**: descartado porque no añade fricción real al atacante; el log por sí solo solo sirve para análisis post-hoc.
- **Bloqueo agresivo por IP**: descartado por riesgo desproporcionado en NAT corporativos y CGN, además de duplicar lo que ya hace `ApiRateLimitFilter` en otra capa.
- **Persistencia de eventos en MySQL**: descartado de inicio para no acoplar la capa de seguridad al modelo de datos transaccional ni al rendimiento de RDS; Redis con TTL es suficiente para el alcance actual.
- **Reusar el pipeline perimetral de AUDIT**: descartado porque trata tráfico HTTP genérico y mezclaría señales muy distintas; Auth-risk debe vivir cerca del flujo de credenciales, no del firewall.

## Consecuencias

- el login de producto ahora dispone de telemetría específica de abuso de credenciales y de respuesta progresiva sin alterar el contrato HTTP
- el resto de superficies de autenticación (login admin, refresh, forgot/reset password) quedan cubiertas por el rate limit clásico pero no por Auth-risk, lo que será objeto de iteraciones siguientes
- aparece deuda de persistencia de logs cuando el backend se ejecuta en modo manual: la trazabilidad depende de mantener viva la sesión interactiva
- aparece deuda residual de detección low-and-slow: ataques deliberadamente lentos pueden permanecer bajo el umbral HIGH/CRITICAL durante el tiempo de vida del TTL corto
- la propiedad `authrisk.response.enabled` permite rollback inmediato a modo OBSERVE puro sin redeploy de código

## Estado de implementación

- Fase 1 y Fase 2 implementadas y validadas en TEST y AUDIT
- Namespace por entorno corregido (`AUTHRISK_ENV`)
- Comportamiento en producción simulada confirmado
