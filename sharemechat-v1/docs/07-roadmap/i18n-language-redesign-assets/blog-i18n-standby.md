# Blog multi-idioma — STANDBY

> Parte del proyecto [i18n redesign](../i18n-language-redesign-plan.md). **En
> standby por decisión del operador (2026-08-20):** "el blog lo trataremos aparte,
> ya veremos cómo". Aquí se anota el contexto para retomarlo, sin decidir todavía.

## Por qué el blog es un caso especial (no es como el chrome de la UI)

- El blog **no** es texto de UI traducible por JSON. Son **artículos autorales**
  (contenido), con su propio pipeline editorial (plan → CMS/`ContentPromptBuilder`
  → pipeline `cms-*` → `final.json` → `/blog` → sitemap → Bing).
- Es **palanca GEO/SEO**: las keywords, `hreflang` (ADR-022) y la no-canibalización
  (ADR-045: 1 primaria única/URL, secundarias sí, ES/EN no canibalizan por hreflang)
  son el núcleo del valor. Traducir a máquina sin estrategia de keywords por idioma
  **destruiría** ese valor.
- Namespace i18n propio: `i18n/locales/blog/{es,en}.json` (solo el chrome del blog:
  hero, listing, sidebar, card, cta…), separado del contenido de los artículos.

## Cuestiones abiertas (a decidir cuando se retome)

1. ¿Traducir artículos existentes a fr/de, o **crear contenido nativo** por idioma
   con research de keywords propio (lo correcto para GEO)?
2. `hreflang` y estructura de URLs por idioma para el blog (`/fr/blog/...`).
3. Prioridad vs. captación de modelos vía SEO (ver
   `docs/01-business/seo/blog-model-recruitment-analysis-2026-08-18.md`).

## Estado

**Sin trabajo. Standby.** No tocar hasta instrucción explícita del operador.
