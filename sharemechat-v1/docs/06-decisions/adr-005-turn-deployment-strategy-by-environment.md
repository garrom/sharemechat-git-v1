# ADR-005: Estrategia de despliegue TURN por entorno

## Estado

Propuesta.

## Contexto

ADR-004 ya fija la direccion tecnica de SharemeChat para WebRTC:

- estrategia TURN/ICE controlada por entorno
- configuracion ICE servida desde backend
- eliminacion de `iceServers` hardcodeados en frontend

Lo que sigue pendiente ahora no es la logica de aplicacion, sino la topologia de despliegue por entorno.

El proyecto necesita mantener un principio estable:

- mismo codigo en AUDIT, TEST y futuros entornos productivos
- distinta capacidad y complejidad de infraestructura segun el entorno

Tambien existe una restriccion operativa clara:

- AUDIT y TEST deben priorizar coste bajo y simplicidad
- PRO debe poder crecer sin cambiar el contrato logico ni el codigo de la aplicacion
- no conviene introducir alta disponibilidad prematura en esta fase

## Alternativas evaluadas

### A. Misma topologia minima en todos los entornos

Consiste en desplegar una unica instancia TURN por entorno y mantener la misma forma operativa en AUDIT, TEST y PRO.

Pros:

- simplicidad maxima
- coste bajo al inicio
- misma logica de despliegue en todos los entornos

Contras:

- en PRO deja poca capacidad de crecimiento
- obliga a rediseñar despues la topologia si el trafico crece
- mezcla la necesidad de validacion de AUDIT/TEST con la futura necesidad de capacidad de PRO

### B. Topologia minima en AUDIT y TEST, y topologia inicial de PRO preparada para escalar

Consiste en mantener una unica instancia TURN en AUDIT y TEST, pero definir para PRO una forma inicial simple que ya permita evolucionar hacia varias instancias sin cambiar codigo.

Pros:

- minimiza coste en entornos no productivos
- mantiene el mismo comportamiento logico en todos los entornos
- evita alta disponibilidad prematura
- deja a PRO en una base que puede crecer sin rediseño

Contras:

- exige decidir desde ya una forma de despliegue algo mas estructurada para PRO
- introduce mas disciplina operativa que la alternativa minima total

### C. Desplegar desde el principio una topologia sobredimensionada y altamente disponible en todos los entornos

Pros:

- uniformidad de topologia
- maxima preparacion teorica para crecimiento

Contras:

- sobreingenieria prematura
- coste innecesario en AUDIT y TEST
- mas complejidad operativa sin beneficio real en esta fase
- aumenta el riesgo de pagar complejidad antes de validar bien la nueva estrategia TURN/ICE

## Decision

Adoptar la alternativa B.

### AUDIT

- despliegue TURN minimo
- una unica instancia por entorno
- sin alta disponibilidad
- orientado a validacion funcional y diagnostico

### TEST

- despliegue TURN minimo
- una unica instancia por entorno
- sin alta disponibilidad
- orientado a validacion funcional estable con bajo trafico

### PRO inicial

- despliegue TURN simple, pero ya desacoplado para poder crecer sin cambiar codigo
- una unica instancia en la fase inicial
- sin alta disponibilidad en esta etapa
- con una organizacion operativa que permita evolucionar despues a varias instancias o reparto de carga manteniendo el mismo contrato backend/frontend

### Evolucion futura posible de PRO

- crecimiento horizontal del relay
- reparto de carga o separacion por capacidad
- endurecimiento progresivo de observabilidad y tolerancia a fallo

Esa evolucion futura no forma parte de esta decision de implementacion inicial, pero la topologia elegida no debe bloquearla.

## Motivo

Esta estrategia equilibra:

- mismo comportamiento logico en todos los entornos
- coste bajo en AUDIT y TEST
- capacidad de evolucion en PRO sin cambiar codigo
- evitacion de alta disponibilidad prematura

El valor real no esta en replicar la misma infraestructura fisica en todos los entornos, sino en mantener el mismo contrato logico y una topologia coherente con el nivel de trafico esperado.

## Consecuencias

### Tecnicas

- el backend y el frontend deben consumir la misma forma logica de configuracion ICE en todos los entornos
- la variacion entre entornos quedara en capacidad y operacion, no en comportamiento del codigo

### Operativas

- AUDIT y TEST podran validar la estrategia TURN/ICE con coste contenido
- PRO podra arrancar simple y crecer despues sin rediseñar la capa de aplicacion

### De coste y red

- TURN puede mover volumen real de trafico y debe tratarse como componente sensible en costes
- una topologia de salida mal planteada puede disparar coste de red aunque la logica del producto no cambie

## Riesgo operativo critico

En AWS, una topologia TURN que dependa de NAT Gateway de forma ineficiente puede escalar costes rapidamente:

- NAT Gateway introduce coste fijo por tiempo de uso
- NAT Gateway introduce coste variable por trafico
- TURN puede generar trafico significativo al actuar como relay de media

Por tanto, el diseno de red del relay debe considerar explicitamente el coste de trafico y no solo la conectividad. Este ADR no fija una arquitectura sensible concreta, pero si deja establecido que una topologia incorrecta puede volver antieconomico el servicio aunque el codigo no cambie.

## Pendiente tras esta decision

- definir la implementacion concreta de la topologia por entorno fuera del repo principal
- enlazar esta decision con la posterior implementacion backend de provision de configuracion ICE
- validar coste y comportamiento cross-network en AUDIT y TEST antes de fijar la forma operativa inicial de PRO
