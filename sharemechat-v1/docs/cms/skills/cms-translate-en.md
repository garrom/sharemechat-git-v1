---
skill: cms-translate-en
phase: 4.5
purpose: Traducir el articulo revisado del locale base al ingles para soporte multilingue del CMS.
inputs:
  - 04_review/reviewed.md       (ES, articulo revisado y aprobado en fase 4)
  - 04_review/review_notes.md   (contexto, no se traduce)
  - 00_input/brief.md           (contexto del tema)
outputs:
  - 04_review/reviewed_en.md    (EN, articulo traducido y adaptado al mercado anglosajon)
default_behavior: |
  Se ejecuta POR DEFECTO entre fase 4 y fase 5. Salto opcional con la cadena
  literal "skip translate-en" en el mensaje del operador al lanzar el pipeline.
related_adr:
  - ADR-022 (Blog multilingue ES+EN)
  - ADR-023 (Pipeline editorial bilingue)
---

# cms-translate-en

Skill personal del editor (vive en Claude.ai/Cowork). Este fichero es un stub
documental que mantiene sincronia con la skill real.

## Que hace

Lee el articulo revisado en espanol (`04_review/reviewed.md`) y produce una
version en ingles adaptada (no literal) al mercado anglosajon, respetando la
voz editorial de SharemeChat. La traduccion deriva del revisado, no del
research ni del polished; cualquier correccion aplicada en la fase 4
(brand/legal/DSA/GDPR) se propaga automaticamente a la version EN.

## Estructura preservada

- Mismo numero de H2 y H3 en el mismo orden semantico que el ES.
- Longitud objetivo: similar al ES, +-10% en palabras.
- Cero hechos nuevos. Cero contenido omitido.
- Las citas y referencias a fuentes (`[source N]` si aparecen) se conservan
  con el mismo indice; las URLs de `sources_used` son compartidas entre ES y
  EN.

## Adaptaciones permitidas (no literalismo)

- Modismos y expresiones idiomaticas: adaptar al ingles natural (no traducir
  palabra por palabra).
- Ejemplos culturales: mantener si son universales; sustituir si son demasiado
  hispanos para el mercado anglosajon, **sin cambiar el hecho subyacente**.
- Comillas: usar comillas dobles curvas (" y ") en EN.
- Numeros decimales: punto como separador decimal en EN (vs coma en ES).

## Metadatos generados

Al final de `reviewed_en.md`, añade un bloque YAML-like literal:

```
---
SUGGESTED_SLUG_EN: tu-propuesta-en-kebab-case
SUGGESTED_SEO_TITLE_EN: Tu titulo SEO en ingles (<=60 chars)
SUGGESTED_META_DESC_EN: Tu meta description en ingles (<=160 chars)
---
```

Reglas:

- `SUGGESTED_SLUG_EN`: piensa el slug OPTIMO para SEO anglosajon, no traduzcas
  literalmente el slug ES. Kebab-case estricto (minusculas, sin acentos, sin
  guiones bajos).
- `SUGGESTED_SEO_TITLE_EN`: titulo natural en ingles, ≤60 chars.
- `SUGGESTED_META_DESC_EN`: descripcion natural en ingles, ≤160 chars.

Estos campos los lee el `cms-json-builder` para construir el `final_en.json`.

## Cuando NO se ejecuta

Si el operador incluye la cadena literal `skip translate-en` en su mensaje
al lanzar el pipeline en Cowork, esta skill se salta y la fase 5
(`cms-json-builder`) emite solo `final_es.json`. Usar este opt-out cuando el
contenido sea especifico del mercado hispano (anuncios operativos regionales,
contenido editorial localizado) y no proceda version EN.

## Voz editorial

Coherente con `sharemechat-voice`:

- Sobria, sin emojis, sin sensacionalismo.
- Comillas dobles curvas en ingles.
- Tono neutro y profesional.
- Sin claims comerciales sobre packs, precios o disponibilidad 24/7.
- Sin comparativas nominales con competidores.

## Output esperado de la skill al terminar

Confirma brevemente que `04_review/reviewed_en.md` esta escrito y resume en
una linea:

- numero de H2 y H3 (deben coincidir con el ES).
- longitud en palabras (objetivo: ±10% respecto al ES).
- los tres campos del bloque metadata final (`SUGGESTED_SLUG_EN`,
  `SUGGESTED_SEO_TITLE_EN`, `SUGGESTED_META_DESC_EN`) con sus longitudes.
