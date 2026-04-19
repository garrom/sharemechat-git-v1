# ADR-007: Blacklist por pais con backend como capa principal en fase 1

## Estado

Aprobada como decision de diseno para implantacion gradual posterior.

## Contexto

SharemeChat ya dispone en backend de una pieza versionada para bloqueo por pais: `CountryAccessService`.

El codigo actual resuelve el pais del request a partir de headers reenviados por la cadena de proxy/CDN y expone configuracion versionada para:

- activar o desactivar el control
- decidir si se bloquea cuando falta el dato de pais
- declarar la blacklist de paises
- fijar el mensaje funcional de rechazo

La evidencia actual del repositorio confirma que este enforcement ya se usa en:

- `POST /api/users/register/client`
- `POST /api/users/register/model`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/admin/auth/login`

La misma evidencia confirma tambien que no existe hoy un filtro global, interceptor global ni enforcement equivalente dentro de los handlers WebSocket de `/match` y `/messages`.

Por tanto, el estado real actual no es ausencia total de bloqueo por pais, pero tampoco una politica uniforme sobre toda la aplicacion.

## Problema

SharemeChat necesita una politica de blacklist por pais mas coherente para AUDIT/PRE y entornos siguientes, con presupuesto limitado y sin abrir de inicio una implantacion mas agresiva en edge.

La primera fase no debe empezar por una capa edge como autoridad principal porque:

- el repositorio ya contiene logica util en backend
- el enforcement actual ya existe parcialmente en controladores REST
- el despliegue gradual y el rollback son mas simples en backend
- una decision temprana en edge introduciria mas acoplamiento operativo sin resolver por si sola la coherencia funcional del codigo

Tambien debe evitarse mezclar esta primera fase con una extension simultanea a WebSocket si eso impide cerrar antes un baseline claro en REST.

## Opciones consideradas

### Opcion 1

Usar edge/CDN como capa principal desde la primera fase.

Pros:

- cobertura potencial sobre frontend y backend
- rechazo temprano del trafico no deseado

Contras:

- mayor dependencia de infraestructura no versionada en el repo principal
- menor granularidad funcional para despliegue gradual
- mas riesgo de bloquear trafico legitimo de pruebas PSP en la primera iteracion
- no aprovecha que el backend ya dispone de logica real para este problema

### Opcion 2

Usar backend Spring Boot como capa principal en fase 1 y ampliar de forma gradual la cobertura REST antes de abordar WebSocket o edge como capa principal.

Pros:

- reutiliza la logica ya existente en codigo
- facilita rollback por configuracion o por alcance de endpoints
- permite controlar la extension del enforcement por grupos funcionales
- encaja mejor con el estado real del repositorio

Contras:

- no bloquea por si sola la entrega inicial del frontend estatico
- mantiene dependencia de headers reenviados por infraestructura
- deja deuda temporal si WebSocket se aplaza

### Opcion 3

Usar Nginx como capa principal para `/api`, `/match` y `/messages`.

Pros:

- rechazo previo al backend para trafico de aplicacion
- buen punto de logging operativo

Contras:

- el repositorio no contiene hoy una politica versionada de bloqueo por pais en Nginx
- seguiria sin cubrir de forma natural el frontend estatico
- añade logica operativa fuera de la capa donde ya existe la semantica funcional

## Decision

Se adopta la opcion 2.

En fase 1, el backend Spring Boot sera la capa principal de enforcement de blacklist por pais.

La implantacion se plantea como despliegue gradual y no como bloqueo total inmediato de toda la superficie publica.

La cobertura base de fase 1 parte del estado ya existente y lo mantiene como baseline:

- registro client
- registro model
- login producto
- refresh de sesion
- login admin

Sobre esa base, la ampliacion recomendada de fase 1 se limita a REST sensible y alineado con transiciones de cuenta o dinero:

- recuperacion y reseteo de password
- reenvio de verificacion de email
- inicio de sesion de pago PSP
- inicio de KYC externo
- endpoints de transaccion que abren primera compra, recarga o payout

Esta decision no adopta edge/CDN como capa principal en la primera fase.

Esta decision tampoco da por cerrada la extension a WebSocket. `/match` y `/messages` quedan explicitamente fuera de fase 1 salvo nueva decision posterior.

## Justificacion

El repositorio ya soporta backend como punto de enforcement real y verificable. Esa base hace innecesario abrir primero una solucion principal en edge o Nginx para resolver la primera iteracion.

El baseline actual ya protege el acceso inicial de cuenta y sesion, pero sigue dejando huecos relevantes en otros flujos REST y una brecha completa en WebSocket. La forma mas coherente de cerrar la primera brecha sin rediseñar la infraestructura es ampliar la cobertura backend en los flujos REST mas sensibles.

Dejar WebSocket para una fase posterior reduce el alcance inicial y evita mezclar en la misma iteracion decisiones distintas de autenticacion de handler, semantica realtime y politicas de cierre de sesion.

## Impacto

Arquitectura:

- backend pasa a ser la autoridad principal prevista para la primera fase de blacklist por pais
- edge no se considera autoridad principal en la primera fase
- WebSocket queda fuera del alcance inicial

Codigo:

- la futura implantacion debera ampliar enforcement en grupos REST concretos, no abrir todavia una solucion global indiscriminada
- la fuente de pais sigue basada en headers reenviados por infraestructura

Operacion:

- la decision facilita despliegue gradual y rollback acotado
- la trazabilidad de rechazos puede quedar centralizada en respuestas y logs backend ya existentes

## Consecuencias

Positivas:

- aprovecha codigo ya existente
- reduce coste y riesgo de la primera iteracion
- fija un alcance inicial defendible y verificable

Negativas:

- no bloquea la entrega inicial del frontend
- mantiene dependencia de la calidad de los headers de pais enviados por infraestructura
- deja deuda temporal en WebSocket

Trade-offs:

- se prioriza coherencia funcional y simplicidad de despliegue frente a cobertura total inmediata
- se acepta una fase 1 parcial para evitar abrir una decision de edge mas agresiva antes de tiempo

## Notas

Esta decision formaliza una estrategia de fase 1.

No aprueba todavia implementacion concreta.

No aprueba edge como capa principal en la primera fase.

No aprueba enforcement WebSocket en esta iteracion inicial.
