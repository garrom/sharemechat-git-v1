# Knowledge Base — SharemeChat Agente IA de Soporte

Este directorio quedó **vacío de contenido temático tras Fase 1.D del refactor
Agente IA** ([ADR-044](../../../../docs/06-decisions/adr-044-knowledge-base-externa.md)).
La BdC del Agente IA de soporte vive ahora **exclusivamente en MySQL** en la
tabla `support_bot_prompts`, cacheada en memoria por
`com.sharemechat.support.service.KnowledgeBaseService` (Caffeine, hidratación
en `@PostConstruct` + endpoint admin `POST /api/admin/knowledge-base/reload`
para propagar cambios sin reiniciar).

## Qué queda en este directorio

- `README.md` — este fichero, referencia mínima.
- `00-placeholder.md` — safety net histórico del antiguo
  `SupportKnowledgeBaseLoader`. El loader fue eliminado en Fase 1.D; el
  placeholder se mantiene como marcador del directorio y para evitar builds
  vacíos si en el futuro se reintroduce alguna forma de BdC embebida.

## Qué desapareció en Fase 1.D

- Los 14 ficheros temáticos (`00-comportamiento-agente-ia.md`,
  `02-onboarding-cliente.md`, …, `producto-general.md`) que hidrataban
  antiguamente el `SupportKnowledgeBaseLoader` al arrancar.
- `com.sharemechat.support.service.SupportKnowledgeBaseLoader` (Java
  service) y su test.

## Cómo se hidrata la BdC en un entorno nuevo

Cada entorno con schema Flyway V13 aplicado tiene la tabla
`support_bot_prompts` (vacía por defecto). Dos vías:

1. **Canónica hasta Fase 1.C**: `POST /api/admin/knowledge-base/seed-from-jar`
   leía los `.md` del classpath e insertaba una fila por fichero. **Ya no
   funciona** porque el classpath no tiene `.md` temáticos; el endpoint sigue
   presente pero devuelve `insertedCount=0`.
2. **Vigente post Fase 1.D**: seed por SQL directo contra la tabla
   `support_bot_prompts`. Se ejecutó el 2026-07-07 en los tres entornos
   (TEST vía UPDATE tras seed-from-jar previo; AUDIT y PROD vía `INSERT INTO`
   parametrizado desde script Python cargando los `.md` del working tree en
   el momento del seed). La bitácora del proyecto conserva el script como
   referencia reejecutable.

## Modelo canónico de la tabla

- 14 filas activas, una por `case_key`.
- Comportamiento transversal: `comportamiento-agente-ia` + `ui-reference`
  (siempre incluidas en el system prompt).
- Router determinista (`SupportBotRouterService`) selecciona 1 case_key
  adicional según rol + keywords del mensaje. Fallback: `producto-general`.
- Reglas del router hardcodeadas en el service; `case_key`s deben existir
  en la tabla o el bot loguea WARN y sigue con string vacío para esa sección.
