# Context generation guidelines — SharemeChat

Este documento define cómo generar y mantener el fichero `shareme-context-overview.md`.

## Objetivo

Generar un documento de contexto reutilizable para:
- nuevos chats en asistentes (ChatGPT, Claude, etc.)
- preparación de pitch a inversores
- onboarding rápido de terceros

Debe ser:
- compacto
- coherente
- estable en el tiempo
- sin duplicar la documentación técnica completa

## Fuente de verdad

Claude debe SIEMPRE basarse en:
- `docs/01-business/`
- `docs/02-architecture/`
- `docs/03-environments/`
- `docs/04-operations/`
- `docs/05-backoffice/`
- `docs/07-roadmap/`

NO inventar información fuera de estos documentos.

## Reglas de contenido

### 1. Nivel de abstracción

- Nivel medio-alto (ni marketing vacío ni código detallado)
- Explicar el sistema, no implementaciones concretas
- Evitar clases Java, endpoints específicos o detalles internos innecesarios

### 2. Estructura obligatoria

El documento SIEMPRE debe contener:

1. Identidad del proyecto
2. Descripción del producto
3. Arquitectura técnica (alto nivel)
4. Entornos
5. Seguridad actual
6. Estado actual
7. Problemas abiertos
8. Roadmap inmediato
9. Filosofía de desarrollo
10. Objetivo final

No añadir ni eliminar secciones sin justificación explícita.

### 3. Coherencia

- No contradecir la documentación existente
- No duplicar texto literal de otros documentos
- Resumir, no copiar

### 4. Seguridad

Nunca incluir:
- IPs
- credenciales
- tokens
- rutas internas sensibles
- detalles explotables

### 5. Enfoque

Debe poder leerse como:
- documento técnico para ingeniero
- base de pitch para inversor

### 6. Tono

- profesional
- claro
- sin marketing exagerado
- sin emojis
- sin opiniones subjetivas

## Cuándo regenerar el documento

Actualizar cuando haya cambios en:

- arquitectura relevante
- seguridad (auth-risk, pipeline, etc.)
- roadmap
- modelo de negocio
- estado de producción

NO actualizar por cambios menores de UI o refactors internos.

## Anti-patrones

Claude NO debe:

- mezclar contexto con decisiones nuevas
- proponer mejoras dentro de este documento
- convertirlo en un documento técnico detallado
- escribir código
- duplicar contenido de `docs/02-architecture/`

## Resultado esperado

Un único fichero:

- claro
- reutilizable en otros chats
- estable
- alineado con el estado real del proyecto