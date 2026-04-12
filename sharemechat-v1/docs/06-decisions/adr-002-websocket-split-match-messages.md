# ADR-002: Separación de WebSocket entre matching y mensajería

## Estado

Aprobada y en uso.

## Contexto

El sistema soporta dos dinámicas realtime con necesidades distintas:

- matching aleatorio
- mensajería y llamada directa

## Decisión

Separar ambos dominios en dos endpoints WebSocket distintos: `/match` y `/messages`.

## Consecuencias

- reduce mezcla de estados y responsabilidades
- permite evolucionar reglas de negocio por canal
- obliga a mantener coherencia de autenticación y compliance en ambos handlers
