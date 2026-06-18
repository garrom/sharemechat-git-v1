# ADR-038 — Descubrimiento de threads Reddit vía RSS público sin auth

## Estado

Aceptada — 2026-06-18.

## Contexto

La FASE 2 del sistema de warmup social-ops (extensión del pipeline definido en [ADR-034](adr-034-social-ops-methodology.md)) requiere descubrir threads candidatos en subreddits target para que el operador pueda comentar manualmente y construir karma. El descubrimiento manual leyendo la web no escala (3 subs × 25 entries cada uno × varias veces al día = mucho tiempo del operador para filtrar contenido irrelevante).

En la sesión previa de investigación se exploró si el pipeline social existente (skills de Cowork) podía hacer el fetch nativo. El test empírico de FASE 0 mostró que **Cowork no puede fetch directo** a `reddit.com/.../new.json` desde sus skills: el endpoint requiere autenticación o user-agent específico que Cowork no expone.

La decisión intermedia fue **pivot a script local con OAuth Reddit**. Esa vía se exploró y se bloqueó por dos motivos prácticos:

1. La Data API legacy de Reddit, tras el endurecimiento de 2023 contra scrapers de IA (corte de acceso a Apollo, Reddit Sync, OpenAI, Google), ahora requiere **submit request con caso de moderación** para activar una app de usuario para uso comercial. El operador completó el formulario pero el captcha entraba en bucle al crear la app, sin resolución conocida.
2. Reddit Developer Platform es la alternativa moderna pero está orientada a bots complejos con WebSocket y eventos en tiempo real — overkill para descubrimiento periódico de 3 subs × pocas peticiones.

Durante esa exploración, el operador validó empíricamente una tercera vía: Reddit expone **feeds Atom públicos** (`https://www.reddit.com/r/SUB/hot.rss`) sin requerir credenciales. Test con los 3 subs target devolvió XML Atom estándar con `<title>`, `<link href>`, `<published>` y `<author><name>` por entry, 25 entries por feed. Esta vía es lo que el resto del corpus llama "READ-ONLY público" — el mismo principio que sigue `sync-skills-to-cowork.ps1` (lee del repo, escribe a Cowork; no consume credenciales del usuario operativo).

## Decisión

Usar **el feed Atom público (`hot.rss`) de cada sub target** como mecanismo de descubrimiento de threads candidatos en Reddit. Sin OAuth, sin credenciales, sin secretos en el repo. El script local `ops/scripts/social-thread-finder.ps1` descarga los feeds vía HTTP plano con un `User-Agent` declarado, parsea el XML con `[xml]` nativo de PowerShell, aplica filtros (edad, palabras tabu, posts administrativos, autores bot) y emite a stdout una lista markdown que el operador pega como input de la skill de Cowork `social-comment-helper` (en FASE 2B, pendiente).

El descubrimiento del thread sigue siendo asistido (script + Cowork); la **acción** (postear el comentario) sigue siendo manual por el operador desde su navegador, alineado con el principio de ADR-034 *"automatizar el pensar, no el publicar"*.

## Opciones consideradas

### Opción 1 — OAuth vía Data API legacy de Reddit

Registrar una app Reddit en `https://www.reddit.com/prefs/apps`, obtener `client_id`/`client_secret` y autenticarse con OAuth para usar la API JSON oficial (`/r/SUB/hot.json?limit=25`).

Descartada porque:

- Reddit requiere desde 2023 un submit request con motivación de "moderación" para activar uso comercial; el formulario tiene un captcha que entró en bucle sin resolverse en la sesión de pruebas.
- Introduce un secreto (`client_secret`) que habría que gestionar en local sin entrar al repo (alineado con la regla dura del proyecto), pero rompe el principio de "fuera del producto" de ADR-034 al meter una credencial de plataforma externa en el flujo operativo.
- Beneficio marginal: con OAuth el rate limit es 60 req/min en lugar del más estricto anónimo, pero con 3 subs × 1-2 sesiones/día el volumen no justifica el coste de gestión del secreto.

### Opción 2 — Reddit Developer Platform

Construir un bot vía el nuevo framework de Reddit (`reddit/devvit`).

Descartada porque:

- Overkill para descubrimiento read-only de 3 subs.
- Requiere WebSocket, eventos en tiempo real e infraestructura de bot que no aplica al caso de uso (operador asistido, no automatización de acciones).
- Probablemente bloqueado por la misma barrera de verificación que la opción 1.

### Opción 3 — Scraping HTML de las páginas públicas

Hacer GET a `https://www.reddit.com/r/SUB/hot/` y parsear el HTML.

Descartada porque:

- Más frágil: Reddit cambia el HTML con frecuencia.
- Más gris en ToS: scraping HTML está expresamente desincentivado en el User Agreement.
- Sin estructura: requeriría regex sobre HTML o `HtmlAgilityPack`, mientras que el Atom es XML estándar parseable nativamente.
- No aporta nada que el RSS no aporte ya.

### Opción 4 — Pushshift u otros archivos históricos

Usar archivos de terceros como Pushshift, Camas, etc.

Descartada porque:

- Pushshift quedó tocado tras el corte de API de Reddit en 2023 — su acceso público se limitó severamente y la calidad de los datos recientes varía.
- No es real-time: los threads "candidatos para comentar" deben ser recientes (max 24h en r/AskReddit), y la mayoría de archivos tienen lag de horas o días.
- Reintroduce dependencias externas no controlables.

### Opción 5 (la elegida) — RSS público sin auth

Descrita en "Decisión" arriba. Se elige porque:

- Cero secretos, cero registro, cero captcha.
- XML Atom estándar con campos suficientes (`title`, `link`, `published`, `author`).
- Patrón coherente con `sync-skills-to-cowork.ps1` (script local, fuera del producto, fuera de SecurityConfig del backend).
- Validado empíricamente con los 3 subs target en la FASE 0 bis.
- Compatible con ADR-034 (el script descubre, no publica; sigue "automatizar el pensar, no el publicar").

## Trade-offs aceptados

**Limitaciones del RSS** respecto a la API OAuth:

- **`num_comments` no aparece en el RSS**. El operador lo ve manualmente al abrir el thread antes de comentar. Aceptado: la cifra exacta no es necesaria para descubrir; el filtro por número de comentarios se aplica en cabeza del operador (no comentar en threads con 0 respuestas, no comentar en threads ya saturados con 500+).
- **Flag `NSFW` no aparece**. Los 3 subs target (`r/AskReddit`, `r/CasualConversation`, `r/Showerthoughts`) son SFW por construcción, así que no es problema real.
- **Rate limit anónimo más estricto** que con OAuth. Observación empírica durante el desarrollo: Reddit devuelve `429 Too Many Requests` ya con 3 fetches consecutivos en pocos segundos. Mitigación: el script declara `User-Agent: SharemeChat:warmup-finder:v1 (by /u/sharemechat)` y hace `Start-Sleep -Seconds 8` entre fetches consecutivos. Para 3 subs = ~16 s totales por sesión, asumible. Si Reddit devuelve 429 a un sub, el script loguea el fallo y continúa con los siguientes — no aborta el run entero.

**Lo que no se modela en este ADR**:

- El comentario final no se publica desde el script ni desde Cowork. Lo postea el operador desde su navegador. La acción es humana por diseño (ADR-034) y por restricción regulatoria (ToS de Reddit prohíben automatizar acciones que afectan al estado de la plataforma).
- El script no persiste el ledger `social-state.json`. El packager del pipeline social (FASE 2B) lo hará tras la sesión Cowork.

## Consecuencias

### Positivas

- Cero secretos en el repo. La regla del proyecto "no `.env`, no credenciales en repo" se mantiene sin esfuerzo.
- Patrón coherente con el resto del corpus: script local PowerShell en `ops/scripts/`, fuera del producto, fuera del backend, fuera de `SecurityConfig`.
- Si Reddit cierra el RSS público en el futuro, el coste de pivotar es bajo: el contrato JSON que produce el script y el contrato del pipeline social no cambian; solo cambia el backend del script.

### Negativas

- Vulnerable a cambios unilaterales de Reddit en el formato del feed Atom (campo `<title>`, namespace XML, etc.). Mitigación: el script falla con warning explícito y continúa con el siguiente sub; los warnings invitan al operador a abrir un issue.
- Rate limit anónimo puede ser más restrictivo en ciertas franjas horarias o tras campañas de abuso de terceros contra Reddit. Mitigación: el script ya tolera 429 con warning + continuación; el operador puede esperar 5-10 min y reintentar.

### Nuevo principio establecido

**"READ-ONLY público de Reddit sin auth está permitido para descubrimiento de candidatos a comentar"**. No aplicable a posting (el posteo manual desde navegador queda fuera del scope automatizable). No aplicable a contadores agregados de cuenta (karma, followers): esos los actualiza el humano leyendo su perfil al persistir el ledger.

## Relación con otras ADRs

- [ADR-034](adr-034-social-ops-methodology.md) — metodología social-ops. ADR-038 es una extensión operativa coherente con sus dos principios: el script descubre (automatizar el pensar) pero no publica; el script vive en `ops/scripts/`, no en el producto.
- ADR-014 (pipeline editorial orquestado) — patrón gemelo de skills Cowork que ADR-034 replicó. Esta ADR es ortogonal: añade un script local al flujo social, no toca el pipeline editorial.

## Fases del frente

- **FASE 0 / FASE 0 bis** (ya hechas, esta sesión y la previa): investigación + pivots de backend (Cowork fetch → OAuth → RSS).
- **FASE 2A** (esta sesión): script `social-thread-finder.ps1` + ADR-038 + README operativo.
- **FASE 2B** (próxima sesión): skill nueva `social-comment-helper` en `docs/social/skills/` + extensión del contrato del `social-orchestrator` con modo `thread_comment` + posibles ajustes a `social-phase-gate` y `social-brand-legal-review` para el caso "comentario en thread ajeno".
