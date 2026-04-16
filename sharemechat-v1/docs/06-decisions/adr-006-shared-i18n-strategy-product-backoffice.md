# ADR-006: Estrategia compartida de i18n para producto y backoffice

## Estado

Aprobada y planificada para ejecucion incremental.

## Contexto

SharemeChat ejecuta producto y backoffice sobre una sola aplicacion React con dos superficies de build y routing condicional.

El frontend ya dispone de infraestructura i18n operativa basada en `i18next`, `initReactI18next`, `SessionProvider`, persistencia de `uiLocale` y fallback a ingles. Esa infraestructura ya se usa en producto, pero no esta integrada de forma ordenada en la superficie de backoffice.

El backoffice comparte bootstrap, sesion y estado de usuario con producto, pero hoy sigue mostrando copys hardcodeados en shell, acceso y paneles internos. Esto impide una operativa consistente para perfiles internos o externos de habla inglesa.

El analisis del codigo confirma que el problema principal no es la ausencia de motor i18n, sino la falta de integracion ordenada del backoffice sobre una infraestructura ya existente.

## Problema

El backoffice no es internacionalizable de forma consistente en su estado actual.

La infraestructura i18n existente es reutilizable, pero si se amplia sin separacion logica entre producto y admin aumentara la deuda actual de recursos y copys.

Ademas, tocar en una sola entrada el shell autenticado y el acceso interno aumenta el riesgo funcional de la primera iteracion sin aportar valor suficiente.

## Opciones consideradas

### Opcion 1

Reutilizar exactamente la infraestructura y los recursos actuales sin separacion logica por superficie.

Pros:

- menor coste inmediato
- no exige una estructura nueva de claves

Contras:

- mezcla producto y backoffice en el mismo espacio semantico
- aumenta el monolito actual de recursos
- empeora mantenimiento y trazabilidad del copy

### Opcion 2

Reutilizar la infraestructura actual y separar recursos por superficie product/admin, sin ordenar el backoffice por modulos.

Pros:

- mantiene un unico motor
- reduce acoplamiento entre superficies
- limita el riesgo de implantacion

Contras:

- el backoffice acabaria generando otro bloque monolitico de recursos
- no corrige por si sola la dispersion de textos

### Opcion 3

Mantener un unico motor i18n compartido, reutilizar la infraestructura actual, separar recursos por superficie product/admin y organizar las claves de backoffice por modulos, con una primera iteracion dividida en dos subfases de bajo riesgo.

Pros:

- conserva compatibilidad con la arquitectura actual
- reduce riesgo funcional
- mejora mantenibilidad
- permite migracion incremental real

Contras:

- exige fijar una convencion minima antes de implementar
- durante un tiempo conviviran zonas migradas y no migradas

## Decision

Se adopta la opcion 3.

SharemeChat mantendra un unico motor i18n compartido en frontend.

La infraestructura actual basada en `i18next` y `SessionProvider` se reutiliza como base tambien para la superficie admin.

Los recursos de traduccion se separaran por superficie `product` y `admin` a nivel logico y de archivos, sin introducir una segunda infraestructura i18n.

Las claves de backoffice se organizaran por modulos funcionales y no se mezclaran sin criterio con las claves actuales de producto.

La primera iteracion se divide en dos subfases:

- Fase 1A: shell autenticado del backoffice, layout, navegacion lateral, topbar, metapills, estado restringido por email no verificado dentro del shell y boton visible de idioma dentro del shell
- Fase 1B: acceso al backoffice, login interno, verificacion interna de email y boton visible de idioma en acceso y login

En esta decision no entran paneles operativos de backoffice. Quedan fuera `overview`, `operations`, `models`, `moderation`, `finance`, `audit`, `data`, `administration` y `profile` como dominios de contenido.

En la primera iteracion se prioriza riesgo bajo sobre amplitud de alcance.

## Justificacion

La arquitectura actual ya comparte bootstrap, sesion y estado de locale entre superficies. El backoffice necesita internacionalizacion real, pero no necesita una infraestructura distinta.

Mantener un unico motor reduce complejidad, evita duplicacion y aprovecha la resolucion actual de `uiLocale` y fallback a ingles.

Separar recursos por superficie y por modulos contiene el riesgo tecnico y evita agravar la deuda existente.

La division entre Fase 1A y Fase 1B reduce riesgo funcional. Primero se estabiliza el shell autenticado y su estructura visible sin tocar el flujo de acceso. Despues se aborda el acceso interno sobre una base de recursos, convenciones y comportamiento ya asentada.

## Impacto

Arquitectura:

- se mantiene una unica infraestructura i18n compartida
- se explicita la separacion logica de recursos por superficie

Codigo:

- el backoffice dejara de incorporar hardcodes nuevos en las zonas migradas
- se introduciran recursos propios de admin organizados por modulos
- la primera iteracion se ejecutara en dos subfases para limitar alcance y riesgo

Operacion:

- el backoffice podra evolucionar hacia uso real en espanol e ingles sin cambiar su arquitectura base
- el idioma del usuario autenticado podra gobernar tambien la experiencia interna

Riesgos:

- persistencia temporal de mensajes backend no localizados
- convivencia transitoria entre zonas migradas y no migradas
- inconsistencias si la primera iteracion mezcla contenido de shell con paneles operativos

## Consecuencias

Positivas:

- solucion contenida y compatible con la arquitectura actual
- menor riesgo que abrir una segunda capa i18n
- mejor separacion conceptual entre producto y backoffice
- validacion funcional por capas, primero shell autenticado y despues acceso interno

Negativas:

- la migracion no sera instantanea
- seguira existiendo deuda previa en producto y en mensajes backend hasta que se aborde de forma explicita
- la primera iteracion queda mas fragmentada

Trade-offs:

- se prioriza una estrategia de bajo riesgo y alta compatibilidad frente a un rediseño mayor
- se acepta deuda residual controlada a cambio de una adopcion segura y gobernable

## Notas

Esta decision fija la estrategia general y la division de la primera iteracion.

No aprueba rediseños grandes de arquitectura frontend.

No aprueba una reestructuracion completa del sistema i18n de producto.

No aprueba la entrada en paneles operativos de backoffice en la primera iteracion.
