# README — `social-thread-finder.ps1`

Script local PowerShell que descubre threads candidatos en subreddits target para que el operador comente manualmente. Descarga el feed Atom público (`hot.rss`) de cada sub, aplica filtros (edad, palabras tabu, posts administrativos, autores bot) y emite a stdout una lista markdown lista para pegar en Cowork.

**Decisión arquitectónica subyacente**: [ADR-038](../../docs/06-decisions/adr-038-social-reddit-warmup-rss-not-oauth.md) (RSS público, sin OAuth, sin credenciales).

## Cómo ejecutarlo

Desde la raíz del repo (o desde cualquier carpeta — el script no asume cwd):

```powershell
# Descubrimiento normal con la config por defecto (3 subs target).
.\sharemechat-v1\ops\scripts\social-thread-finder.ps1

# Lo mismo con log detallado de fetches y filtros.
.\sharemechat-v1\ops\scripts\social-thread-finder.ps1 -Verbose

# Override de subs (p. ej. probar con otros).
.\sharemechat-v1\ops\scripts\social-thread-finder.ps1 -SubsOverride "r/Cooking,r/Coffee"

# Menos candidatos por sub (más estricto).
.\sharemechat-v1\ops\scripts\social-thread-finder.ps1 -MaxPerSub 3

# Markdown a stdout + JSON estructurado en C:\tmp\thread-candidates.json.
.\sharemechat-v1\ops\scripts\social-thread-finder.ps1 -OutputJson

# Inspección cruda sin filtros para debugging.
.\sharemechat-v1\ops\scripts\social-thread-finder.ps1 -DryRun
```

Si lo ejecutas con `-Verbose`, añade `-Verbose` al final. No requiere PS 7 (compatible con 5.1+).

## Qué esperar como output

Markdown a stdout, una sección por sub, con los N candidatos que pasaron los filtros. Ejemplo abreviado:

```
# Candidatos para comentario (descubrimiento 2026-06-18T11:06)

Subs consultados: r/AskReddit, r/CasualConversation, r/Showerthoughts
Total candidatos despues de filtros: 10

## r/AskReddit

### 1. People with a very high pain tolerance, what was THE most painful thing you've experienced?
- URL: https://www.reddit.com/r/AskReddit/comments/.../people_with_a_very_high_pain_tolerance/
- Edad: 6,4h (publicado 2026-06-18T04:43Z)
- Autor: /u/CosmicBunnyBabe8912

### 2. ...

## r/Showerthoughts

### 1. ...
```

Códigos de salida:

- **0** — al menos un candidato emitido. El stdout contiene markdown utilizable.
- **1** — cero candidatos tras filtros, o el script encontró errores en TODOS los subs. Razones posibles: rate limit, sub mal escrito, feed Reddit caído, filtros demasiado restrictivos.

## Cómo usar el output

1. Copiar el bloque markdown completo desde `# Candidatos para comentario` hasta el final.
2. Pegarlo como input en una sesión Cowork que invoque la skill `social-comment-helper`. **PENDIENTE FASE 2B**: esa skill aún no existe en el repo. Hasta entonces, el output sirve como input manual: el operador elige uno o dos candidatos, abre el thread en el navegador, lee el OP completo, y escribe el comentario a mano respetando voz `sharemechat-voice`.
3. Tras publicar el comentario, actualizar el ledger `docs/social/social-state.json` incrementando `subreddits[<sub>].ratio.aporte` del sub donde se publicó (esto lo hará la FASE 2B automáticamente vía `social-packager`; por ahora es manual).

## Troubleshooting

### Reddit devuelve 429 en uno o varios subs

```
ADVERTENCIA: [r/Showerthoughts] Fetch fallo: Error en el servidor remoto: (429) Too Many Requests.
```

Reddit aplica rate limit muy agresivo a fetches anónimos consecutivos. Si te ha ocurrido:

1. Esperar **5-10 minutos** antes de reintentar. Reddit mantiene el throttle varios minutos tras el primer 429.
2. Reducir la frecuencia de ejecución (1-2 sesiones por día como máximo, espaciadas).
3. Si el problema persiste todo el día: aumentar `$SleepSeconds` en el header del script (default 8 s; subir a 15-20 s).

El script tolera el 429 con warning y continúa con los siguientes subs; no aborta el run. Si todos los subs dan 429, sale con código 1 + mensaje.

### Un sub devuelve 404

```
ADVERTENCIA: [r/sub_inventado] Fetch fallo: Error en el servidor remoto: (404) No se encontró.
```

1. Verificar el nombre del sub en `reddit.com/r/<nombre>`. Reddit es case-insensitive en URLs pero el feed Atom puede ser sensible.
2. Confirmar que el sub existe y es público (no restringido, no banned).
3. Reintentar con el nombre correcto vía `-SubsOverride "r/nombre_correcto"`.

### El XML no parsea

```
ADVERTENCIA: [r/AskReddit] XML malformado: ...
```

Causa probable: Reddit cambió el formato del feed Atom o devolvió HTML en lugar de XML (suele pasar bajo ataque DDoS o mantenimiento). Acciones:

1. Ejecutar con `-DryRun -Verbose` para ver qué llega del servidor en cada sub.
2. Comparar manualmente con `curl https://www.reddit.com/r/AskReddit/hot.rss -A "test"` para ver si el formato del feed cambió.
3. Si Reddit cambió el formato, reportar issue para actualizar el parseo del script (probablemente nombres de campos Atom).

### `Get-Date -AsUTC` no se reconoce

Sintoma: error de PowerShell sobre `-AsUTC`. Causa: estás en PS 7+ y el script asume PS 5.1+ (donde se usa `(Get-Date).ToUniversalTime()` para compatibilidad). El script ya está adaptado; si ves este error es señal de que alguien modificó el script sin probar en 5.1. Revertir esa modificación.

## Configuración en el header del script

Las constantes que un operador puede ajustar viven al inicio del script (entre `# CONFIG EN EL HEADER` y `# Helpers`):

- `$SubsConfig` — lista de subs con sus `MaxAgeHours` específicos.
- `$UserAgent` — UA declarado en cada fetch. **No omitir**: Reddit penaliza fetches anónimos con 429 mucho antes.
- `$SleepSeconds` — espera entre fetches consecutivos. Default 8 s.
- `$TabuKeywords` — palabras prohibidas en el título (case-insensitive). Default cubre temas inflamables (religión, política, identidad, conflicto armado).
- `$AdminMarkers` — substring que indica post administrativo del sub (Welcome Thread, Megathread, etc.). Por defecto cubre los más comunes.
- `$BotAuthors` — autores cuyo contenido se descarta. Default `AutoModerator` + variantes.

Cualquier cambio en estos defaults debería ir acompañado de una entrada en `docs/project-log.md` explicando el motivo.

## Lo que NO hace este script

- **No publica** comentarios. Lo posteas tú a mano desde tu navegador.
- **No actualiza** el ledger `social-state.json`. Eso lo hará la FASE 2B vía `social-packager`.
- **No escribe** ningún archivo en el repo. Cuando ejecutas con `-OutputJson`, escribe en `C:\tmp\` (fuera del repo).
- **No requiere** credenciales OAuth ni secretos. Solo HTTP plano a `reddit.com`.

## Referencias

- [ADR-038](../../docs/06-decisions/adr-038-social-reddit-warmup-rss-not-oauth.md) — RSS público sin auth para descubrimiento Reddit (decisión arquitectónica).
- [ADR-034](../../docs/06-decisions/adr-034-social-ops-methodology.md) — metodología social-ops base.
- [`docs/social/README.md`](../../docs/social/README.md) — flujo completo del pipeline social-ops.
