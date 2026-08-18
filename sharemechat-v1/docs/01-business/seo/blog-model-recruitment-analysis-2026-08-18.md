# Análisis: blog editorial y captación de MODELOS vía SEO

**Fecha:** 2026-08-18
**Autor:** sesión de análisis (solo lectura; no se tocó el sistema editorial, que está maduro y funcionando).
**Objetivo del frente futuro:** generar artículos de blog que **también capten modelos** (no solo clientes), con buenas keywords de reclutamiento en el slug. Este documento es la puesta al día previa; no propone ejecutar nada todavía.

> Doctrina de keywords y arquitectura del blog: ver [ADR-045] (1 primaria única por URL, 3-5 secundarias; primaria no se repite entre URLs = canibaliza; ES/EN no canibalizan por hreflang [ADR-022]) y el circuito editorial descrito abajo.

---

## 1. Cómo funciona el sistema editorial (verificado)

Pipeline de extremo a extremo:

```
Plan editorial v9 (Excel, hoja "Input CMS")
  → ContentPromptBuilder.java (backend) genera el "prompt del CMS"
    (secciones XML: run_metadata, editorial_input {title, brief, target_keywords},
     constraints, research_directives, tabla del pipeline, output_contract, self_check)
  → operador corre /cms-orchestrator en Claude Code (NO Cowork) con ese prompt
    → 7 agentes en cadena (todos con la voz `sharemechat-voice`):
        1) cms-research-seo   → research + fuentes reales (mín. 5), search intent, outline
        2) cms-draft-writer   → borrador ES
        3) cms-editorial-polish → pulido ES
        4) cms-brand-legal-review → revisión marca/legal (DSA, GDPR, 2257) ES
        4.5) cms-translate-en → versión EN (no traducción literal; adaptada al mercado)
        5) cms-json-builder   → final.json schema 2.0 (shared + locales.es + locales.en)
        5.5) cms-json-validator → valida/repara sintaxis JSON
  → final.json se pega en el CMS admin → /blog → sitemap → Bing (GEO)
```

**Punto CRÍTICO para el objetivo de modelos:** las **keywords primarias ES/EN son AUTORITATIVAS del plan (Excel)** — ADR-045. `cms-research-seo` **NO elige keywords**; investiga, redacta y traduce *alrededor* de las que le dan. Por tanto **la calidad SEO depende de que las keywords del plan v9 sean buenas** (con demanda real). El motor es sólido; el cuello de botella es la selección de keyword aguas arriba.

Datos de arranque para el operador (`BLOG/INSTRUCCIONES_GENERAR_ARTICULO.txt`): se lanza en **Claude Code** (no Cowork), con web activado, invocando `/cms-orchestrator` + el prompt del CMS entero. Son 6-7 fases / varios minutos.

---

## 2. Estado del contenido publicado (7 en PROD) = 100% CLIENTE

Las 7 publicadas (plan v9, estado `publicado`/`hecho pend`) son todas de audiencia **cliente/usuario** (cluster Omegle + primeros pasos):

- `que-es-videochat-1-a-1`, `alternativas-omegle-2026`, `omegle-alternative-reddit`,
  `elegir-videochat-seguro`, `foto-perfil-videochat`, `que-datos-guarda-videochat`,
  `verified-video-chat-real-people`.

Ninguna es de audiencia "Modelo".

---

## 3. Hallazgo clave: el plan v9 YA tiene contenido de modelo, pero SIN publicar

La hoja "Input CMS" del plan v9 tiene una columna **"Audiencia"**. Además de las de cliente, contiene:

- **5 artículos de audiencia "Modelo"** (todos en estado **Pendiente**):
  - `como-cobran-modelos-videochat` — KW EN: *how cam models get paid*
  - `bio-modelo-conectar` — *cam model bio*
  - `equipo-minimo-modelo-empezar` — *cam model equipment*
  - `tiempo-descansos-camming` — *camming burnout breaks*
  - `marca-personal-modelo-privacidad` — *cam model personal brand*
- **~11 artículos "Usuario y modelo"** (dual), también en su mayoría Pendiente.

Es decir: **el contenido de modelo no falta en el plan; falta publicarlo.** La prioridad de publicación hasta ahora ha sido captación de cliente (mercado huérfano de Omegle).

---

## 4. El gap real (dos cosas)

### 4.1 Las keywords de modelo NO salieron de un estudio
El estudio de keywords (`COMERCIAL_COSTES/keyword-research-sharemechat-us-2026-06-24.xlsx`) es **100% cliente**: 25 keywords priorizadas, todas del mercado huérfano de Omegle (omegle alternative, talk to strangers, chatroulette, video chat random…). Sus propias "Notas estratégicas" admiten dos cosas decisivas:
- **La herramienta gratis (Keyword Surfer / Google Keyword Planner) FILTRA las keywords explícitamente adultas** → devuelven volumen 0 (cam girls = 0, random video chat = 0). No es que nadie las busque; la herramienta las oculta por política de Google.
- Para targetear ese mercado haría falta **Semrush/Ahrefs de pago o ingeniería inversa de competidores adult** (Chaturbate, Stripchat…).
- Los ángulos que el estudio marcó como "pendiente 2ª ronda" (verified models, premium paid) son **todavía de cliente**, no de reclutamiento de modelo.

→ Conclusión: las keywords de modelo del plan v9 se eligieron **a ojo, sin datos de volumen/dificultad**. Pueden no ser las óptimas (slug/keyword).

### 4.2 Las 5 de modelo sesgan a "ya eres modelo" (retención/how-to)
Bio, equipo, burnout, marca personal = contenido para quien **ya** es modelo (retención). Falta el **top-of-funnel de reclutamiento**, que es donde está el volumen de búsqueda: *how to become a webcam model*, *how much do cam models make*, *best cam sites to work for 2026*, *is camming safe/legit*, *webcam modeling for beginners*. De ese tramo, solo "how cam models get paid" está representado.

---

## 5. Lo que YA está listo (no hay que rehacer nada)

- **El pipeline funciona y está maduro** (7 publicadas, ADR-045, hreflang ES/EN, GEO/Bing, prerender auto-curativo).
- **La voz de marca `sharemechat-voice` ya tiene registro "talento/modelo"** (disclosure explícito permitido, vocabulario del oficio: shift, payout, KYC up front). El motor puede escribir en el tono correcto para modelos.
- **La landing `/modelos` está viva** (SEO + prerender social, ver `blog`/SEO docs 2026-08-17) para enlazarla como CTA desde cada artículo de modelo → cierra el bucle contenido→registro.

---

## 6. Recomendación (para cuando se decida mover; NO ejecutar aún)

El desbloqueo no es tocar el sistema, sino **dos pasos aguas arriba**:

1. **Ronda de keyword research específica de reclutamiento de modelos.** Con herramienta que no filtre adult (o ingeniería inversa de competidores) para obtener volumen/dificultad reales, incluyendo el **top-of-funnel** que falta (become a model, how much do they earn, best sites to work). Salida: temas + primary/secondary ES+EN + intención, en el mismo formato que la hoja "Input CMS".
2. **Integrar/afinar esas filas en el plan** (validar/optimizar los slugs+keywords de las 5 existentes + añadir las top-of-funnel que falten) y **correr el pipeline existente** sobre ellas. Cada artículo enlaza a `/modelos` como CTA.

Con eso, el mismo motor que ya funciona empieza a producir SEO de reclutamiento con keywords que sí tienen demanda.

**Caveat honesto:** el SEO de reclutamiento de modelos es competitivo y lento (semanas-meses para indexar/rankear en dominio joven), y rara vez es el canal principal — el que más convierte suele ser el directo (sitios de comparación de plataformas, foros/comunidades del oficio, outreach; ver el pipeline social-ops del proyecto). El blog es complemento (long-tail + respuestas de IA vía Bing/GEO), no el motor único.

---

## 7. Punteros (ficheros externos al repo)

- **Estudio de keywords (cliente):** `Sharemechat_Aplicaciones/COMERCIAL_COSTES/keyword-research-sharemechat-us-2026-06-24.xlsx` (hojas: Top 25 priorizadas / Todas las keywords / Búsquedas semilla / Notas estratégicas). También el PDF `Free Keyword Research for SharemeChat (US English 2026)`.
- **Plan editorial vigente:** `Sharemechat_Aplicaciones/BLOG/plan-editorial-sharemechat-v9.xlsx` (hoja "Input CMS" = fuente de las filas del pipeline; columnas: Slug, Título, Categoría, Brief, Keyword primaria/secundaria ES, Keyword primaria/secundaria EN, Locale, Audiencia, Intención SEO, Prioridad, Mes, Estado).
- **Cómo lanzar el pipeline:** `Sharemechat_Aplicaciones/BLOG/INSTRUCCIONES_GENERAR_ARTICULO.txt`.
- **Agentes del pipeline (skills):** `cms-orchestrator`, `cms-research-seo`, `cms-draft-writer`, `cms-editorial-polish`, `cms-brand-legal-review`, `cms-translate-en`, `cms-json-builder`, `cms-json-validator`; voz transversal `sharemechat-voice`.
- **Backend:** `ContentPromptBuilder.java` (genera el prompt), `ContentArticleService` / `SitemapController` (publicación + sitemap), `BlogArticleView.jsx` / `seoHelpers.js` (front).
