# ADR-044: Base de conocimiento del Agente IA de soporte externalizada a MySQL con caché en memoria

## Estado

Aceptada. Introducida en Fase 1.A del refactor del Agente IA de soporte (2026-07-04). Coexistente con la BdC en JAR durante Fase 1.A y 1.B; Fase 1.C sustituirá la lectura del JAR por la lectura de esta tabla y Fase 1.D eliminará los `.md` del JAR.

## Contexto

El Agente IA de soporte (`SupportBotService`) consume una base de conocimiento (BdC) formada por 15 ficheros `*.md` bajo `sharemechat-v1/src/main/resources/knowledge-base/`. Estos ficheros se cargan al arrancar el backend por `SupportKnowledgeBaseLoader`, se concatenan y se incluyen en el `system` prompt de cada llamada a Claude Haiku, con `cache_control: ephemeral` para aprovechar prompt caching de 5 minutos.

Al madurar la BdC (correcciones tras smokes, ampliación de temario, troubleshooting por rol) han aparecido tres fricciones estructurales:

1. **Ciclo de iteración lento.** Un cambio de literal en una FAQ implica edición del `.md`, `mvn package`, `scp` del JAR (~150 MB) a EC2, `systemctl restart` y ventana de reinicio del backend. Para correcciones puramente editoriales el coste operativo es desproporcionado.
2. **Riesgo de drift entre entornos.** El JAR es idéntico en TEST/AUDIT/PROD (regla ONE JAR — CLAUDE.md), pero cualquier deploy parcial (rebuild solo en TEST) deja la BdC divergente entre entornos hasta el siguiente ciclo. La bitácora contiene incidentes de drift análogos (frontend product/admin, 2026-06-19).
3. **Sin trazabilidad histórica.** Los `.md` viven en Git, pero no hay noción de versión aplicada, ni forma de responder "¿qué texto exacto vio el usuario que reportó X el 2026-06-15?" sin `git blame` cruzado con timestamps de deploy.

## Problema

Necesitamos que la BdC pueda:

- Editarse sin reconstruir ni redesplegar el JAR.
- Ser recargable en caliente por un endpoint admin (para propagar cambios sin `restart`).
- Ser consistente entre TEST/AUDIT/PROD por decisión explícita del operador (no por deploy accidental).
- Mantener el mismo perfil de latencia y coste actual (prompt caching de Anthropic + serialización del system prompt): la lectura de la BdC por request no puede ir a BD.

## Decisión

Externalizar la BdC a una tabla MySQL `support_bot_prompts` en Aurora, cacheada en memoria del proceso Spring Boot mediante Caffeine y consumida por un nuevo `KnowledgeBaseService`.

### Modelo de datos

Tabla `support_bot_prompts`:

- `id` BIGINT PK
- `case_key` VARCHAR UNIQUE — clave semántica derivada del nombre del fichero MD (`00-comportamiento-agente-ia` → `comportamiento-agente-ia`, kebab-case sin prefijo numérico).
- `role` VARCHAR — audiencia: `CLIENT`, `MODEL` o `BOTH`. Inferida en el seed a partir del nombre (`12-troubleshooting-modelo` → `MODEL`, `13-troubleshooting-cliente` → `CLIENT`, resto → `BOTH`).
- `content` LONGTEXT — contenido markdown crudo del prompt.
- `description` VARCHAR — descripción corta, editorial (opcional).
- `active` BOOLEAN — permite deshabilitar sin borrar.
- `version` INT — se incrementa en cada UPDATE del `content` (Fase 1.A no la usa en runtime; queda para observabilidad futura).
- `created_at` / `updated_at` TIMESTAMP.

Índice sobre `role` para filtrados futuros por audiencia.

### Estrategia de caché

- **Caffeine** (`com.github.ben-manes.caffeine:caffeine`) compatible con Spring Boot 3.5.5.
- **Hidratación al arranque** (`@PostConstruct`): `SELECT * FROM support_bot_prompts WHERE active = TRUE`. El resultado se guarda en un `Map<caseKey, content>` thread-safe (`ConcurrentHashMap` interno o `Cache<String,String>` de Caffeine sin TTL).
- **Sin TTL**. La caché se refresca únicamente por dos vías:
  1. Reinicio del backend.
  2. Endpoint admin `POST /api/admin/knowledge-base/reload` (invalidación + repobado completo desde BD).
- **Sin invalidación por escritura**. La única forma soportada de modificar la BdC en Fase 1.A es SQL directo contra la BD y `reload` en cada entorno donde se aplique el cambio (queda documentado en `known-debt.md` que Fase 2 introducirá un CRUD admin con invalidación automática).
- **Hilo-seguridad**. Las lecturas concurrentes son puras `get` sobre el `Map`. La escritura completa (`reload`) se hace en un mapa nuevo y se sustituye la referencia atómicamente.

### Alternativas descartadas

1. **Seguir en el JAR indefinidamente.** Descartada por las tres fricciones citadas: iteración lenta, drift latente, sin versionado. La ventaja (código y datos en un único artefacto reproducible) se preserva parcialmente en Fase 1.A mediante `POST /api/admin/knowledge-base/seed-from-jar`, que permite reconstruir la tabla desde el JAR como fallback.
2. **Filesystem del EC2** (leer `.md` de `/opt/sharemechat/knowledge-base/`). Descartada porque introduce un estado por-instancia externo al ONE JAR: el operador tendría que `scp` los ficheros a cada EC2, y AUDIT/PROD podrían quedar drift-eados sin que ningún check lo detecte. Además rompería la portabilidad del artefacto (correr el JAR en otra máquina requeriría montar el directorio).
3. **S3 + CloudFront.** Descartada por sobre-ingeniería para Fase 1.A: introduce dependencia de red en el arranque del backend, requiere IAM y política de invalidación de caché de CloudFront (que a su vez tiene sus propios TTLs), y multiplica el número de superficies donde el operador debe hacer cambios. MySQL ya está en el camino crítico del backend; añadir S3 no.
4. **Redis / cache distribuido.** Descartada porque no hay concurrencia entre instancias (el backend TEST es una única EC2, PROD igual en pre-launch). Sobra la coordinación.

### Ausencia de multi-lang en esta fase

La BdC actual mezcla ES + EN en el mismo fichero y Claude detecta el idioma automáticamente (regla vigente del `SupportKnowledgeBaseLoader`). No se introduce columna `lang` ni tablas por idioma. Cuando aparezca la necesidad (por ejemplo, split de contenidos legales por jurisdicción), se abordará en ADR posterior con un `case_key + lang` compuesto.

### Plan de migración one-shot desde MDs del JAR

Fase 1.A introduce el endpoint `POST /api/admin/knowledge-base/seed-from-jar` que:

1. Lista los `.md` bajo `classpath:knowledge-base/*.md`.
2. Excluye `README.md` (metadocumentación) y `00-placeholder.md` (redundante con `01-producto.md`, mantenido como safety net del loader del JAR pero no aportando valor incremental a la BdC externa).
3. Deriva `case_key` del nombre (kebab-case sin prefijo numérico ni extensión).
4. Deriva `role` del nombre (`*-modelo` → `MODEL`, `*-cliente` → `CLIENT`, resto → `BOTH`).
5. Inserta con `INSERT IGNORE` (idempotente: re-lanzar el endpoint no sobrescribe filas existentes).
6. Devuelve conteo de insertados / omitidos.

Este endpoint es el mecanismo autorizado para poblar la tabla en TEST/AUDIT/PROD tras aplicar la migración Flyway V13. En Fase 1.D, los `.md` del JAR se eliminan y este endpoint queda como fósil o se elimina también.

### Plan de rollback

Fase 1.A es **puramente aditiva**: `SupportBotService`, `SupportKnowledgeBaseLoader` y la BdC del JAR permanecen intactos y siguen siendo la fuente de datos que consume el bot en runtime. El nuevo `KnowledgeBaseService` no está integrado en el pipeline de generación del `system` prompt en esta fase.

Rollback ante fallo del arranque:

- Si la migración V13 falla (schema inconsistente), Flyway aborta el arranque; se revierte por rollback de deploy estándar (backup del JAR anterior + `systemctl restart`).
- Si la hidratación al arranque falla (BD inaccesible, timeout, tabla vacía tras la migración pero antes del seed), el `KnowledgeBaseService` **loguea WARN y arranca con caché vacía; NO propaga excepción**. El bot sigue funcionando con la BdC del JAR sin degradación.
- La activación del consumo por `SupportBotService` (Fase 1.C) es un cambio de código separado que no está en este commit.

## Higiene de logs

- El `content` completo de un prompt **jamás** aparece en logs de nivel INFO / DEBUG / WARN. Los logs de arranque, `reload` y `seed-from-jar` reportan únicamente conteos y `case_key`s.
- Ningún endpoint admin devuelve el `content` completo en la respuesta HTTP (por si el token JWT del admin queda cacheado en un proxy o herramienta de captura).

## Autorización

Los endpoints `/api/admin/knowledge-base/**` heredan la protección genérica de SecurityConfig sobre `/api/admin/**`: requieren autoridad `ROLE_ADMIN` (o el equivalente vía `BackofficeAuthorities`). No se introducen entradas explícitas nuevas en SecurityConfig.

## Consecuencias

Positivas:

- Iteración editorial de la BdC sin rebuild del JAR (post Fase 1.C).
- Fuente de verdad única y consultable por SQL (`SELECT case_key, updated_at FROM support_bot_prompts`).
- Base para futuras funciones (CRUD admin UI, historial de versiones, A/B testing de prompts).

Negativas / coste operativo:

- Un nuevo componente cacheado en memoria (Caffeine) y un endpoint admin por proteger.
- Divergencia posible entre BdC del JAR y BdC de la tabla mientras dure la coexistencia (Fase 1.A → 1.D). Mitigación: `seed-from-jar` es la única vía autorizada de repobado; los cambios ad-hoc en la tabla quedan documentados como deuda hasta que llegue el CRUD admin.

## Trazabilidad

- Bitácora de la sesión de introducción: `docs/project-log.md` (entrada 2026-07-04 correspondiente a Fase 1.A del refactor Agente IA).
- Deuda derivada: `docs/04-operations/known-debt.md` — MDs de `resources/knowledge-base/` pendientes de eliminación tras seed en los tres entornos.
- Fases siguientes:
  - **1.B**: smokes en TEST validando que la tabla contiene los mismos textos que el JAR (bit-a-bit tras normalizar whitespace).
  - **1.C**: `SupportBotService` deja de consumir el output de `SupportKnowledgeBaseLoader` y pasa a consumir `KnowledgeBaseService.getPromptContent(caseKey)` con concatenación equivalente.
  - **1.D**: eliminación de `resources/knowledge-base/*.md` y del `SupportKnowledgeBaseLoader`, con nueva ADR o extensión de esta.

## Actualización Fase 1.B (2026-07-04)

Aplicada la taxonomía objetivo directamente en el filesystem (opción II del análisis previo, no la opción III híbrida) para que el mapeo `.md` ↔ fila de tabla sea 1:1 desde el primer seed, sin ediciones SQL manuales posteriores. Cambios:

- **Split de `03-onboarding-modelo.md`** en dos ficheros: `03-onboarding-modelo.md` (entrada al sistema: registro, contrato, KYC, aprobación, assets, suspensión/baneo) y `03b-payout-y-tiers.md` (sistema económico: tiers, gifts, payout, umbral, Wise). Suspensión/baneo se mantiene en `onboarding-modelo` por proximidad narrativa MODEL — solapamiento aceptado con `08-cuenta.md` (que trata suspensión en abstracto para BOTH).
- **Fusión** de `01-producto.md` + `10-preguntas-frecuentes.md` → `producto-general.md` (sin prefijo numérico). El fichero fusionado degrada los headings del FAQ (10) a `##` bajo la jerarquía del producto (01), y absorbe las notas Agente IA de 10 al final. `01-producto.md` y `10-preguntas-frecuentes.md` **eliminados del repo**.
- **`deriveCaseKey` relajado** en `KnowledgeBaseAdminController` para aceptar dos ramas explícitas de prefijo: `\d+-` (existente) y `\d+[a-z]-` (nueva, permite `03b-`). Implementado con dos ramas explícitas en Java, no regex con opcional. Ficheros sin prefijo numérico (`producto-general.md`) se devuelven tal cual sin extensión.
- **Map `ROLE_OVERRIDES`** en `KnowledgeBaseAdminController` para forzar `role` en case_keys cuyo nombre no lo revela: `pagos-y-saldo` → `CLIENT`, `payout-y-tiers` → `MODEL`. El resto sigue la lógica por sufijo (`-modelo` → MODEL, `-cliente` → CLIENT, resto → BOTH). Constante estática documentada; ampliable si aparecen futuros case_keys ambiguos.
- **Log INFO por fila insertada** en `seed-from-jar`: `[KB-ADMIN] seed: inserted case_key=X role=Y source=Z`.
- Sin cambios en schema (V13 vigente sin V14). Sin cambios en `SupportBotService`, `SupportController` ni frontend. `SupportKnowledgeBaseLoader` sigue leyendo el directorio como blob — el bot en runtime recibe el mismo corpus total, solo reorganizado.

Taxonomía resultante (14 filas que producirá `seed-from-jar`):

| # | case_key | role | Fichero fuente |
|---|---|---|---|
| 1 | `comportamiento-agente-ia` | BOTH | `00-comportamiento-agente-ia.md` |
| 2 | `producto-general` | BOTH | `producto-general.md` |
| 3 | `onboarding-cliente` | CLIENT | `02-onboarding-cliente.md` |
| 4 | `onboarding-modelo` | MODEL | `03-onboarding-modelo.md` |
| 5 | `payout-y-tiers` | MODEL (via override) | `03b-payout-y-tiers.md` |
| 6 | `chat-y-favoritos` | BOTH | `04-chat-y-favoritos.md` |
| 7 | `pagos-y-saldo` | CLIENT (via override) | `05-pagos-y-saldo.md` |
| 8 | `moderacion-y-seguridad` | BOTH | `06-moderacion-y-seguridad.md` |
| 9 | `privacidad-y-datos` | BOTH | `07-privacidad-y-datos.md` |
| 10 | `cuenta` | BOTH | `08-cuenta.md` |
| 11 | `empresa-y-contacto` | BOTH | `09-empresa-y-contacto.md` |
| 12 | `ui-reference` | BOTH | `11-ui-reference.md` |
| 13 | `troubleshooting-modelo` | MODEL | `12-troubleshooting-modelo.md` |
| 14 | `troubleshooting-cliente` | CLIENT | `13-troubleshooting-cliente.md` |

`00-placeholder.md` y `README.md` siguen excluidos del seed.
