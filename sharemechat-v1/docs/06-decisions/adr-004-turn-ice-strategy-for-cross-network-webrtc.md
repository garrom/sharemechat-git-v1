# ADR-004: Estrategia TURN/ICE para videochat cross-network

## Estado

Propuesta.

## Contexto

El codigo versionado de SharemeChat ya resuelve:

- signaling WebRTC por `/match` y `/messages`
- matching y coordinacion realtime
- autenticacion de las superficies implicadas

Sin embargo, la conectividad WebRTC sigue mostrando fragilidad cuando cliente y modelo estan en redes distintas o con IP publica distinta.

La evidencia hoy soportada por codigo y diagnostico operativo es:

- el frontend usa `simple-peer`
- `offer` y `answer` circulan correctamente
- en algunos casos llega a recibirse `peerStream`
- el fallo posterior se produce en ICE
- los `iceServers` estan hardcodeados en frontend
- se usa STUN publico y TURN publico estatico
- no existe servicio backend versionado que entregue configuracion ICE por entorno
- no existe evidencia versionada de una estrategia propia y controlada de relay por entorno

Esto deja al videochat aleatorio especialmente expuesto en escenarios cross-network reales, donde la conectividad depende mas de candidatos relay que de rutas directas o favorables.

## Alternativas evaluadas

### A. Mantener la estrategia actual con TURN publico estatico hardcodeado

Pros:

- cambio cero inmediato
- complejidad tecnica minima

Contras:

- mantiene dependencia de un relay ajeno al proyecto
- no ofrece control por entorno
- no permite rotacion ni gestion propia de credenciales
- deja poca capacidad de observabilidad y diagnostico
- no es una base robusta para TEST, AUDIT y futuros entornos reales

### B. Mantener temporalmente la estrategia actual, pero centralizar la configuracion ICE en backend

Pros:

- reduce dispersion de `iceServers` hardcodeados
- permite parametrizar TURN/STUN por entorno
- prepara el camino para migrar a una estrategia propia sin rehacer luego todo el frontend
- mantiene cambios acotados frente a una sustitucion completa inmediata

Contras:

- si el relay subyacente sigue siendo un TURN publico estatico, la robustez real apenas mejora
- sigue dejando una dependencia externa fragil como base efectiva de conexiones cross-network
- resuelve mejor configuracion que conectividad

### C. Adoptar una estrategia propia y controlada de TURN/ICE por entorno, servida desde backend

Pros:

- alinea la conectividad WebRTC con una operacion industrial por entorno
- permite controlar credenciales, rotacion y observabilidad
- elimina la dependencia estructural de `iceServers` hardcodeados en frontend
- ofrece una base mas robusta para conexiones cross-network reales
- encaja mejor con entornos separados TEST, AUDIT y futuros entornos productivos

Contras:

- exige introducir una capa backend de provision de configuracion ICE
- requiere gestion operativa real del relay por entorno
- añade trabajo de despliegue, validacion y observabilidad

## Decision recomendada

Adoptar como objetivo la alternativa C:

- estrategia propia y controlada de TURN/ICE por entorno
- configuracion ICE entregada al frontend desde backend

Como paso transicional, usar una variante acotada de la alternativa B:

- eliminar `iceServers` hardcodeados dispersos en frontend
- centralizar la configuracion ICE en backend o en una fuente unica parametrizable por entorno
- mantener temporalmente un relay existente solo mientras se prepara la operacion completa de la estrategia objetivo

## Motivo

La fragilidad actual no apunta al signaling, sino al relay y a la estrategia ICE.

Mientras el proyecto dependa de TURN publico estatico hardcodeado:

- las conexiones cross-network seguiran siendo fragiles
- el comportamiento variara por entorno y por red del usuario
- el equipo seguira teniendo poca capacidad de control y diagnostico

Centralizar primero la configuracion ICE reduce deuda inmediata, pero no basta como solucion final si el relay sigue siendo ajeno y no controlado por el proyecto.

## Consecuencias

### Tecnicas

- el frontend dejara de definir `iceServers` en multiples puntos
- el backend necesitara exponer una configuracion ICE coherente por entorno
- el realtime pasara a depender de una estrategia TURN versionable y observable, no de constantes dispersas

### Operativas

- cada entorno necesitara su validacion de conectividad cross-network
- la observabilidad debera distinguir mejor si una sesion usa candidatos directos o relay
- el equipo ganara capacidad para aislar problemas de red frente a problemas de signaling

### De seguridad y control

- se reduce el uso de credenciales estaticas visibles en frontend
- la estrategia por entorno deja de descansar en un relay publico ajeno como dependencia estructural

## Pendiente tras esta decision

- definir el contrato backend para entregar configuracion ICE al frontend
- decidir la operacion concreta del relay por entorno sin documentar detalle sensible en el repo principal
- revisar los puntos frontend donde hoy se repiten `iceServers`
- anadir observabilidad suficiente para confirmar uso real de candidatos relay en pruebas cross-network
