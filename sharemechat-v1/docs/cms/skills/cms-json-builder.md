---
name: cms-json-builder
description: Empaqueta los artefactos de las fases anteriores en un único objeto JSON conforme al schema 1.0 del CMS, listo para validación backend. Único artefacto entregable del run.
---

TODO: pegar aquí el contenido textual de la skill personal `cms-json-builder`
de Claude Cowork. El cuerpo debe describir cómo Cowork lee
`01_research/`, `02_draft/`, `03_polish/`, `04_review/` y produce
`05_final/final.json` con TODOS los campos obligatorios del schema 1.0
(`schema_version`, `run_type`, `language`, `research_summary`, `sources_used`,
`search_intent`, `target_keywords`, `competitor_insights`, `article_outline`,
`draft_markdown`, `seo_title`, `meta_description`, `suggested_slug`,
`risk_notes`, `fact_check_notes`, `self_check_passed`, `self_check_failures`),
incluyendo las reglas reforzadas que el adaptador del backend exige
(≥5 sources, ≥4 secciones outline, draft ≥800 chars, seo_title/meta no vacíos,
target_keywords con un type=primary, self_check_passed=true).
