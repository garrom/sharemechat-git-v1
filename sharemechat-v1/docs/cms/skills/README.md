# Skills — Pipeline editorial Claude Cowork

Versionado de las **skills personales de Claude Cowork** que el flujo
`FULL_ARTICLE_ORCHESTRATED` del CMS invoca como pipeline editorial multi-rol.

Ver [ADR-014](../../06-decisions/adr-014-full-article-orchestrated-pipeline.md)
para el contexto, decisión y consecuencias del flujo orquestado, y
[ADR-013](../../06-decisions/adr-013-full-article-run-phase3b.md) para la
versión inicial monolítica que ADR-014 reemplaza.

## Por qué versionar las skills aquí

Las skills viven principalmente en el espacio personal de Claude Cowork del
editor. Sin embargo, la calidad de los artículos publicados depende
**directamente** del contenido de cada skill: el prompt del CMS solo nombra
las skills y delega su ejecución a Cowork. Si las skills cambian, el output
cambia.

Versionarlas aquí permite:

- auditar qué skill produjo qué artículo (cruzando `prompt_template_id` con la
  versión de skill en git);
- recuperar una skill rota o sobrescrita accidentalmente en Cowork;
- compartir el pipeline editorial con futuros editores sin que tengan que
  reconstruir las skills a mano.

## Skills del pipeline `FULL_ARTICLE_ORCHESTRATED`

| Orden | Archivo | Rol |
|-------|---------|-----|
| 1 | [`cms-research-seo.md`](cms-research-seo.md) | Investigación web + SEO + outline |
| 2 | [`cms-draft-writer.md`](cms-draft-writer.md) | Redacción del cuerpo Markdown |
| 3 | [`cms-editorial-polish.md`](cms-editorial-polish.md) | Pase de coherencia, tono y forma |
| 4 | [`cms-brand-legal-review.md`](cms-brand-legal-review.md) | Revisión brand + legal + DSA/GDPR |
| 5 | [`cms-json-builder.md`](cms-json-builder.md) | Empaquetado al schema 1.0 |
| 6 | [`sharemechat-voice.md`](sharemechat-voice.md) | Voz de marca transversal |

`sharemechat-voice` es transversal: no tiene un paso propio en el pipeline,
sino que se aplica como guía de estilo en todos los pasos del 1 al 5.

## Convenciones de archivo

Cada archivo lleva frontmatter mínimo en estilo Claude Cowork:

```yaml
---
name: <nombre exacto de la skill en Cowork>
description: <una frase>
---
```

Tras el frontmatter, el cuerpo replica el contenido textual de la skill
personal correspondiente. El editor mantiene la sincronización manualmente
cuando edita la skill en Cowork: copia el cuerpo aquí y commitea con un
mensaje del tipo `cms: bump cms-research-seo skill (motivo)`.

## Limitaciones actuales

- los stubs iniciales contienen únicamente el frontmatter más un placeholder
  `TODO: pegar contenido de la skill personal`. El editor responsable los
  completa en cuanto la skill personal está estable.
- no se ejecutan automáticamente desde el backend: el backend solo nombra las
  skills en el prompt; quien las invoca es Claude Cowork al recibir el prompt
  copiado por el editor.
