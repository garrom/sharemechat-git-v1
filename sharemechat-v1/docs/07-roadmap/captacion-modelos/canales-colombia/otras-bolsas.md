# Otras bolsas de empleo CO (computrabajo, magneto, bumeran, indeed) — evidencia

> SONDA N2 · 2026-09-03. Índice en [`00-indice-y-sintesis.md`](00-indice-y-sintesis.md).

Nota metodológica (DATO DURO): **Computrabajo** devuelve vacío vía WebFetch (Cloudflare/JS); **Indeed CO** → HTTP 403. **Magneto365** y **Bumeran** sí fetcheables. Para computrabajo/indeed hay más NO VERIFICABLE que FOUND/NOT FOUND.

## Por bolsa

### Computrabajo (co.computrabajo.com) — objetivo principal, BLOQUEADO
- WebFetch vacío en todas las páginas. Snippets solo devuelven categorías genéricas.
- "videochat"/"chat" → resuelven a **call center bilingüe legítimo** ("asesor/agente chat bilingüe", Jazzplat/Adecco, $1.8M-2.75M COP), NO adulto. [trabajo-de-chat](https://co.computrabajo.com/trabajo-de-chat).
- Landings existentes pero contenido no accesible: [trabajo-de-modelo](https://co.computrabajo.com/trabajo-de-modelo), [trabajo-de-modelo-mujer](https://co.computrabajo.com/trabajo-de-modelo-mujer), [trabajo-de-monitor](https://co.computrabajo.com/trabajo-de-monitor).
- **Veredicto:** NO se confirmó ni una oferta adulta real (bloqueo). Lo único legible como "videochat" es contact-center. IMPRESIÓN: si hay oferta adulta, no está indexada para WebSearch US o usa eufemismos.

### Magneto365 (magneto365.com/co) — VERIFICADO = CERO
- DATO DURO: [buscador](https://www.magneto365.com/co/trabajos/buscar) con "modelo webcam" y "videochat" devolvió 20 empleos **ajenos** (Supervisor Ventas, Cajero, Conductor D1, Soldador…); ignora la query y muestra fallback (175.509 cupos). **No tiene la categoría.**

### Bumeran Colombia — VERIFICADO = N/A
- DATO DURO: `bumeran.com.co` → **301 → bumeran.com** (global). Presencia "Colombia" solo en dominio venezolano legacy + noticias de ~2008. **No opera bolsa activa en Colombia.**

### Indeed Colombia (co.indeed.com) — NO VERIFICABLE (403)
- DATO DURO: la URL [q-modelo-webcam-empleos.html](https://co.indeed.com/q-modelo-webcam-empleos.html) **existe e indexada**, pero WebFetch → **403**. Sugiere que sí hay algún volumen, pero no se leyeron títulos/anunciantes. IMPRESIÓN.

## ¿Cuál tiene MÁS oferta? (con datos)
1. **Indeed** — única con página de resultados indexada específica "modelo webcam" (volumen no leído). Probable la mayor, pero IMPRESIÓN.
2. **Computrabajo** — landings relevantes, cero oferta adulta confirmada.
3. **Magneto365** — CERO (DATO DURO).
4. **Bumeran** — N/A (DATO DURO).

**Conclusión:** ninguna de las 4 grandes es el canal principal; el grueso está en **webs de estudios** y, entre bolsas, en **elempleo** (los estudios lo prefieren — Zeus Cams publica ahí). Magneto y Bumeran descartadas por evidencia dura.

## Vocabulario real (transcrito de webs de estudios indexadas)
- "pagos **semanales en dólares** o pesos, horarios flexibles" (Platinium Studio).
- "hasta el **80% desde estudio y hasta un 95% desde casa**" (WOW Studios).
- "trabajar desde la agencia o **desde casa**… 4 jornadas flexibles… cerca a estaciones del metro" (Diamante Webcam, Medellín).
- "**mujeres 18-30, con o sin experiencia**, empresas legalmente constituidas" (agregador Mitula).
- "Modelo Webcam **desde casa o Satélite**" (MaJu Studios).
- Cluster keywords (WOW Studios): "webcam, videochat, bogota, pereira, manizales, medellin, digitadoras, cabinas, chat erótico, chaturbate, mejor pago webcam".

Estudios con web propia vistos: Gold Line, Platinium, WOW, Diamante Webcam, Imperium (Medellín), Studio Xochiquetzal, MaJu (Manizales), JC Studios, Estudio 360 (Itagüí), Zeus Cams (Bogotá). Agregadores que sí listan el nicho: **Mitula** (por ciudad; cert self-signed, no fetcheable) y **Jooble**.

## Lo que NO se verificó
Contenido real de computrabajo (vacío) e indeed (403); Mitula (self-signed); si computrabajo usa eufemismos que evadan las keywords.
