# Skills — Pipeline editorial Claude Cowork

Versionado de las **skills personales de Claude Cowork** que el flujo
`FULL_ARTICLE_ORCHESTRATED` del CMS invoca como pipeline editorial multi-rol.

Ver [ADR-014](../../06-decisions/adr-014-full-article-orchestrated-pipeline.md)
para el contexto del pipeline orquestado,
[ADR-022](../../06-decisions/adr-022-blog-cms-multilingual-es-en.md) y
[ADR-023](../../06-decisions/adr-023-bilingual-editorial-pipeline-es-en.md)
para el modelo bilingüe inicial, y
[ADR-025](../../06-decisions/adr-025-flyway-introduction-and-cms-v2-schema.md)
para el rediseño actual a entidad lógica única con traducciones por idioma
(schema 2.0).

## Por qué versionar las skills aquí

Las skills se ejecutan en el espacio personal de Claude Cowork del editor.
Sin embargo, la calidad y la coherencia operativa de los artículos publicados
dependen **directamente** del contenido de cada skill: el prompt del CMS solo
nombra las skills y delega su ejecución a Cowork. Si las skills cambian, el
output cambia.

Desde el paquete 4 del rediseño bilingüe (ADR-025), el **repo es la fuente
de verdad** del contenido completo de las skills. Las skills personales en
Cowork son una copia operativa que se mantiene sincronizada con el repo.
Cualquier cambio de fondo se hace primero en el repo, se valida con git, y
después se replica en Cowork.

Esto permite:

- auditar qué skill produjo qué artículo (cruzando `prompt_template_id` con
  la versión de skill en git);
- recuperar una skill rota o sobrescrita accidentalmente en Cowork;
- compartir el pipeline editorial con futuros editores sin que tengan que
  reconstruir las skills a mano;
- revisar cambios estructurales de las skills en pull request, no en
  pantalla de Cowork.

## Skills del pipeline `FULL_ARTICLE_ORCHESTRATED`

Tras el rediseño ADR-025, el pipeline emite siempre un **único JSON
bilingüe schema 2.0** con estructura `shared` + `locales.{es,en}`. La fase
4.5 (`cms-translate-en`) se ejecuta siempre como parte obligatoria del
pipeline; no hay opt-out. La invariante "ES + EN obligatorios para
publicar" se enforce en el backend.

| Orden | Archivo | Rol |
|-------|---------|-----|
| — | [`cms-orchestrator.md`](cms-orchestrator.md) | Orquestador del pipeline editorial completo |
| 1 | [`cms-research-seo.md`](cms-research-seo.md) | Investigación web + SEO + outline |
| 2 | [`cms-draft-writer.md`](cms-draft-writer.md) | Redacción del cuerpo Markdown en ES |
| 3 | [`cms-editorial-polish.md`](cms-editorial-polish.md) | Pase de coherencia, tono y forma |
| 4 | [`cms-brand-legal-review.md`](cms-brand-legal-review.md) | Revisión brand + legal + DSA/GDPR |
| 4.5 | [`cms-translate-en.md`](cms-translate-en.md) | Traducción ES→EN (obligatoria, sin opt-out) |
| 5 | [`cms-json-builder.md`](cms-json-builder.md) | Empaquetado a JSON bilingüe schema 2.0 (`shared` + `locales.es` + `locales.en`) |
| — | [`sharemechat-voice.md`](sharemechat-voice.md) | Voz de marca transversal (secciones ES y EN) |

`cms-orchestrator` y `sharemechat-voice` no tienen un paso numerado propio:

- `cms-orchestrator` encadena las fases 1→5 al recibir el prompt del CMS.
  Lee el prompt expandido emitido por el backend, identifica que es un run
  `FULL_ARTICLE_ORCHESTRATED`, prepara el working directory y ejecuta cada
  skill en orden.
- `sharemechat-voice` se aplica como guía de estilo en todos los pasos del
  1 al 5 (incluida la 4.5). Mantiene secciones ES y EN para que la fase 4.5
  tenga material editorial de referencia al traducir.

## Convenciones de archivo

Cada archivo del repo contiene el **contenido completo** que vive en Cowork,
no un resumen ni un stub. Estructura recomendada:

```yaml
---
skill: <nombre exacto de la skill en Cowork>
phase: <numero o "transversal" o "orquestador">
status: cowork-source-of-truth
related_adr:
  - ADR-NNN
---
```

Tras el frontmatter, dos secciones:

- `## Descripción` — qué hace la skill (campo "description" de Cowork).
- `## Instrucciones` — instrucciones operativas completas que el modelo
  ejecuta (campo "instructions" de Cowork).

## Procedimiento de actualización

Cuando una skill necesita cambiar:

1. Modificar el fichero correspondiente en `docs/cms/skills/`.
2. Commit con mensaje `cms: bump <skill> (motivo)`.
3. Tras el merge, copiar el contenido actualizado del repo a Cowork
   (pegar en los campos "description" e "instructions" de la skill personal).
4. Si la skill afecta al contrato del JSON o a invariantes del backend,
   considerar si toca abrir o actualizar un ADR.

## Limitaciones actuales

- La sincronización Cowork ↔ repo es manual. No hay tooling que detecte
  automáticamente si las skills en Cowork divergen de las del repo. El
  editor responsable mantiene la disciplina de actualizar siempre el repo
  primero.
- Las skills no se ejecutan automáticamente desde el backend: el backend
  solo nombra las skills en el prompt; quien las invoca es Claude Cowork al
  recibir el prompt copiado por el editor.
- La sección EN de `sharemechat-voice` debe quedar escrita antes del primer
  run productivo bilingüe en producción. Hasta entonces, los outputs EN
  tendrán voz inestable.