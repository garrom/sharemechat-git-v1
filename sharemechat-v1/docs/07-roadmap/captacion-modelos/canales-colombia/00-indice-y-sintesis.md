# Canales de captación DIRECTA de modelos — Colombia (mapa de datos con evidencia)

> **SONDA N2 · 2026-09-03.** Investigación con 4 agentes en paralelo sobre los **2 canales** que pidió el operador: **prensa/bolsas de empleo** (elempleo, jooble, otras) y **X (social)**. Objetivo: **mapa de datos con evidencia REAL** (buscar y encontrar, no inferir). **Sin recomendaciones** (fase posterior). Marco: captación DIRECTA plataforma→modelo (ver [`../../debate-arranque.md`](../../debate-arranque.md) A1). País: Colombia (uno por estudio).
>
> Etiquetas: **DATO DURO** (fuente/URL verificable) · **IMPRESIÓN** (patrón sin fuente sólida) · **NO VERIFICADO**.

## Ficheros

| # | Canal | Fichero |
|---|---|---|
| 1 | Prensa — **elempleo.com** | [`elempleo.md`](elempleo.md) |
| 2 | Prensa — **jooble** (co.jooble.org) | [`jooble.md`](jooble.md) |
| 3 | Prensa — **otras bolsas CO** (computrabajo, magneto, bumeran, indeed) | [`otras-bolsas.md`](otras-bolsas.md) |
| 4 | **X (social)** | [`x-social.md`](x-social.md) |
| 5 | **CÓMO PUBLICAR** tú el anuncio (feasibility + coste + patrón + plantilla) | [`como-publicar.md`](como-publicar.md) |

> **Actualización 2026-09-03 (2ª tanda SONDA):** al mapa de "qué hay" se suma
> [`como-publicar.md`](como-publicar.md) — cómo publicar TÚ como particular: **elempleo** (1ª gratis,
> luego ~30 USD; "webcam" en claro) y **beBee/trabajo.org** (1ª gratis; alimenta a Jooble) son
> viables; **OLX prohibido**; **TikTok/Facebook/web propia** gratis para captación fría. Coste de
> arranque ≈ 0. Dato que choca con "persona física, punto": el patrón ganador es **marca ligera de
> estudio**, no individuo desnudo (decisión del operador).

## Resumen por canal (una línea cada uno)

| Canal | Veredicto de evidencia |
|---|---|
| **elempleo.com** | **Canal ACTIVO.** ≥7 anuncios reales de **estudios** (Latin Wishes SAS, Zeus Cams, Horizon Group SAS, La Sensualite, BS representaciones…), foco Bogotá + Barranquilla/Ricaurte. GOTCHA: buscador JS (no filtra por keyword), ofertas caducan a 410 rápido, anunciante = estudio intermediario (no la plataforma), contacto directo solo en sus webs. |
| **jooble** | **Casi nulo como oferta explícita.** "videochat"/"camgirl" = **0** literal. "modelo webcam" = **miles FALSOS** (hostess/casino/protocolo; el "8747 ofertas" del título SEO está desmentido por el contenido). **1 sola oferta genuina:** Lions Agency (Medellín), eufemismo *"streamer de videollamadas… solo un celular e internet… 100% remoto… mujeres mayores de edad… ingresos variables"*. |
| **otras bolsas** | **Magneto365 = CERO** (no existe la categoría). **Bumeran = no opera en Colombia.** Computrabajo e Indeed **bloqueados** al fetch (Indeed sí tiene página indexada de "modelo webcam" → hay algún volumen, no legible). |
| **X (social)** | **X NO se puede leer sin login** (HTTP 402 en todo; nitter murió por cease-and-desist de X, ago-2026). Lo visible = **estudios con audiencia diminuta** (37-122 followers) + perfiles-satélite hacia OnlyFans. |

## Hallazgos transversales (datos, no recomendaciones)

1. **Los 2 canales pedidos están dominados por ESTUDIOS, no por la relación directa.** Tanto en las bolsas como en X, quien aparece reclutando es el **estudio intermediario**, no la modelo suelta ni la plataforma. La captación DIRECTA plataforma→modelo **apenas tiene presencia visible** en estos dos canales. (DATO DURO — corroborado por los 4 agentes.)

2. **El perfil "chica que YA monetiza su imagen y tiene audiencia propia" NO está en X — está en TikTok, Instagram y OnlyFans.** Las colombianas con audiencia real (Esperanza Gómez, Aida Cortés, Angie Brand ~185M COP/mes) son marca OF/IG/TikTok; X es solo un satélite de tráfico. Las individuales que sí están en X tienen followings de dos cifras. (DATO DURO + IMPRESIÓN fundada.)

3. **Existe un "playbook" de eufemismos** con el que este reclutamiento evade los filtros y el estigma (transcrito de anuncios reales): *"streamer de videollamadas"*, *"modelo virtual"*, *"trabajo desde casa"*, *"sin experiencia"*, *"solo un celular e internet"*, *"pagos en dólares / quincenales / semanales"*, *"mujeres mayores de edad / 18-30"*, *"totalmente virtual, sin contacto físico"*, *"desde casa o satélite"*, *"hasta 80% desde estudio, 95% desde casa"*. Casi nunca se dice "webcam adulto" en abierto. (DATO DURO.)

4. **Hay evidencia directa del argumento "no hace falta estudio":** la oferta de **Lions Agency** en jooble vende explícitamente *"solo necesitas un celular e internet… 100% remoto desde cualquier parte del mundo"* — validación de campo de la tesis del operador (una chica con laptop/móvil basta). (DATO DURO.)

5. **Realidad técnica de captura (relevante para cualquier automatización):** estos portales son **difíciles de leer por máquina** — elempleo (JS, ofertas a 410), computrabajo (Cloudflare, vacío), indeed (403), X (402 sin login), magneto (ignora la query). La evidencia real se obtuvo sobre todo del **índice de Google**, no del sitio en vivo.

## Señal para la fase de recomendación (NO es recomendación, solo lo que el dato apunta)

- Si el objetivo es la **chica directa con audiencia propia**, el dato dice que **X es el estanque equivocado** y que ese perfil vive en **TikTok/Instagram/OnlyFans**. Decidir si se añade ese canal es de la fase siguiente.
- Las **bolsas de empleo** sirven, pero hoy son sobre todo **puerta de estudios** (elempleo el más usado); usarlas para captación DIRECTA implicaría **publicar tú un anuncio** (no rastrear), con el playbook de eufemismos de arriba.

## Lo que NO se verificó (consolidado)

- **Contenido/contacto vivo** de casi todas las ofertas: elempleo a 410 (solo snippet de Google), computrabajo/indeed bloqueados, ficha de detalle de Lions Agency no abierta (sin teléfono/email/link de aplicar).
- **Conteos totales reales** por keyword: contaminados por el ensanchamiento SEO de los buscadores; ningún número debe tomarse como "oferta webcam real".
- **X en vivo**: cero timelines/posts/engagement; solo bios cacheadas por Google. Follower counts posiblemente desactualizados.
- **Vigencia hoy** de estudios/ofertas (varios de 2017-2022).
- **Eufemismos no probados** que puedan esconder oferta bajo términos no obvios en páginas profundas.
