# ADR-025 — Introducción de Flyway con baseline y rediseño del schema CMS bilingüe

## Estado

Aceptada (2026-05-16).

Aplicabilidad: gestión de schema MySQL del proyecto entero; estructura física del módulo CMS (modelo bilingüe ES + EN). Primera pieza del rediseño multilingüe del CMS (paquetes 1-7). Cierra la deuda de schema no versionado documentada implícitamente en el incidente `hero_image_url` y formaliza el modelo bilingüe declarado por [ADR-022](./adr-022-blog-cms-multilingual-es-en.md), [ADR-023](./adr-023-bilingual-editorial-pipeline-es-en.md) y [ADR-024](./adr-024-bilingual-submit-inside-editor.md) en la capa de datos.

## Contexto

### Schema sin herramienta de migración

Hasta hoy el proyecto **no usaba herramienta de migración de schema**. El `pom.xml` no incluía `flyway-core` ni `liquibase-core`. `spring.jpa.hibernate.ddl-auto=validate` validaba que las entidades JPA encajaban con el schema BD al arrancar, pero no aplicaba cambios. Los ficheros bajo `src/main/resources/db/manual/` con naming visual `V<YYYYMMDD>__nombre.sql` eran convención editorial heredada de Flyway, **sin la herramienta detrás**; el operador los ejecutaba a mano con `mysql` CLI sobre el bastión RDS. El snapshot oficial `state-test-2026-05-13-1528.yaml` confirma `flyway_runtime_present: false`.

La ausencia de tooling materializó al menos un caso de drift silencioso: la columna `hero_image_url` se aplicó por `ALTER TABLE` directo sobre TEST/AUDIT sin commitear un `.sql` versionado; código y schema divergieron sin alerta. Otros casos similares podrían existir sin catalogar.

Adicionalmente, la documentación interna del proyecto usaba la palabra "Flyway" como genérico:

- `docs/03-environments/test.md:207` listaba V20260501 y V20260508 como "migraciones Flyway".
- [ADR-016](./adr-016-content-workflow-simplification-and-retraction.md) sec D4 hablaba de "Migración Flyway consolidada" y "Flyway lo gestiona".

Esta fricción terminológica inducía a cualquier lector nuevo a asumir Flyway presente cuando no lo estaba.

### Rediseño del carril multilingüe

Paralelamente, [ADR-022](./adr-022-blog-cms-multilingual-es-en.md) introdujo el modelo bilingüe ES+EN del blog con slugs distintos por locale; [ADR-023](./adr-023-bilingual-editorial-pipeline-es-en.md) cerró el pipeline editorial con la fase 4.5 `cms-translate-en`; [ADR-024](./adr-024-bilingual-submit-inside-editor.md) introdujo el endpoint atómico `output-bilingual` con `parent_article_id` como FK auto-referente para vincular ES (raíz) y EN (hijo).

Tras varios meses de operación se observaron debilidades estructurales del modelo padre/hijo: el hijo EN no hereda `hero_image_url` ni `category` automáticamente, los side-effects S3 del flujo bilingüe no rollbackean al fallar BD, la sincronización ES↔EN post-publicación es manual y silenciosa, el listado admin no agrupa visualmente padre+hijo, etc.

Un análisis de descubrimiento (sesión 2026-05-15) propuso rediseñar el modelo como **artículo lógico único + tabla satélite de traducciones**, eliminando `parent_article_id` y aplicando ES+EN como invariante mandatoria para publicar. Esta ADR materializa la primera pieza de ese rediseño (la base de datos), introduciendo simultáneamente Flyway como red de seguridad para que el cambio quede versionado y reproducible.

## Decisión

### D1 — Adopción de Flyway

Adoptar **Flyway** (gestionado por Spring Boot 3.5.x sin pin de versión) como herramienta de migración de schema del proyecto. Dependencias `org.flywaydb:flyway-core` y `org.flywaydb:flyway-mysql` en `pom.xml`. Carpeta canónica `src/main/resources/db/migration/`. Tracking automático vía la tabla `flyway_schema_history` (creada por la propia herramienta).

Configuración en `application.properties`:

- `spring.flyway.enabled=${SPRING_FLYWAY_ENABLED:true}` — activa Flyway en cada arranque, con override por variable de entorno para casos excepcionales.
- `spring.flyway.baseline-on-migrate=false` — el baseline se realiza una sola vez manualmente, no en cada arranque.
- `spring.flyway.locations=classpath:db/migration` — ruta canónica.

`spring.jpa.hibernate.ddl-auto=validate` se **mantiene** sin cambios: Flyway aplica las migraciones, Hibernate verifica que el schema resultante encaja con las entidades.

### D2 — Estrategia de adopción: baseline manual sobre entornos existentes

Camino elegido (variante "C" en la discusión previa):

- TEST y AUDIT entran a Flyway con `flyway baseline -baselineVersion=1 -baselineDescription="Pre-CMS-v2 state"`. Marca conceptual: "ya están en versión 1, no apliques V1".
- El repo incluye `src/main/resources/db/migration/V1__baseline.sql` con el **dump completo del schema de AUDIT** (43 tablas no-CMS limpias, sin tablas `content_*`). Fuente AUDIT porque AUDIT es el estado conceptualmente más limpio: TEST tiene encima las 4 tablas CMS viejas que `V2` va a sustituir.
- En TEST y AUDIT actuales, **V1 nunca se aplica**: el baseline manual lo marca como aplicado. La única ejecución real de V1 ocurrirá el día que PRO se monte desde cero, donde `flyway migrate` aplicará V1 + V2 + futuras en orden.

### D3 — `V2__cms_v2_schema.sql`: rediseño del CMS

`V2` reescribe completamente las tablas del módulo CMS:

- `DROP TABLE IF EXISTS` en orden inverso de FK para las 4 tablas CMS existentes (`content_review_events`, `content_article_versions`, `content_generation_runs`, `content_articles`).
- `CREATE TABLE` de las 6 tablas del modelo nuevo:
  - `content_articles` — artículo lógico, invariante por idioma (hero_image_url, category, keywords, brief, state, flags, fechas, autoría).
  - `content_article_translations` — cara per-idioma (slug, title, seo_title, meta_description, body_s3_key, body_content_hash, target_keywords). UNIQUE (article_id, locale) y UNIQUE (slug, locale).
  - `content_article_versions` — snapshot del artículo lógico en una transición DRAFT→IN_REVIEW.
  - `content_article_translation_versions` — snapshot per-idioma en esa versión. UNIQUE (version_id, locale).
  - `content_generation_runs` — runs IA, `article_id` apunta al artículo lógico.
  - `content_review_events` — auditoría editorial, `article_id` idem.

`V2` es **idempotente**: re-ejecutar sobre un entorno donde ya esté aplicada limpia y reconstruye. `SET FOREIGN_KEY_CHECKS = 0` envuelve los drops para evitar fallos por orden de FK.

Permisos y rol `EDITOR` que V20260501 sembraba en `permissions`, `backoffice_roles` y `role_permissions` **no se re-siembran**: esas filas viven en tablas no-CMS, sobreviven al drop, y por tanto están presentes en BD desde el baseline.

### D4 — Archivado de los `.sql` pre-Flyway

Los 8 ficheros `.sql` que vivían bajo `src/main/resources/db/manual/` se mueven a `docs/_archive/db-manual-pre-flyway/` con un README explicativo. La carpeta `db/manual/` se elimina. Convención visual de naming `V<N>__nombre.sql` se mantiene de aquí en adelante, ahora respaldada por la herramienta.

Los ficheros archivados se conservan como traza histórica (qué se aplicó cuándo, referencia para restore desde dumps antiguos), pero **no se aplican nunca más**: TEST y AUDIT están en estado post-baseline.

### D5 — Modelo bilingüe en la capa de datos

ES y EN dejan de ser dos filas distintas en `content_articles` vinculadas por `parent_article_id`. Pasan a ser:

- Una fila en `content_articles` (artículo lógico, locale-invariante).
- N filas en `content_article_translations` (una por locale).

Slugs distintos por locale: UNIQUE (slug, locale) sustituye al UNIQUE global de slug. Invariante "ambos locales obligatorios para publicar" se enforce en service en DRAFT→IN_REVIEW (no en BD, porque las invariantes cross-row son awkward de modelar con CHECK).

Extensibilidad a `fr`/`de`/`it`: añadir una fila más por locale en `content_article_translations`. Sin `ALTER TABLE`. La invariante "qué locales son obligatorios para publicar" se eleva a constante de aplicación.

### D6 — Neutralización de servicios y controllers durante la ventana

Como las entidades JPA se reescriben en este paquete (paquete 1), la lógica de servicios y controllers que las consumía deja de compilar. Para mantener el JAR construible y `ddl-auto=validate` operativa, los métodos públicos de `ContentArticleService`, `ContentRunService`, `ContentAdminController`, `ContentRunAdminController`, `ContentPublicController` y `SitemapController#sitemap` se neutralizan con `throw new UnsupportedOperationException("Pendiente paquete 2 — rediseño CMS bilingüe (ADR-025)")`. `SitemapController#robots` queda operativo (no depende del modelo CMS).

Consecuencia: ventana de **ruptura funcional del CMS** entre el merge de paquete 1 y el merge de paquete 2. Los endpoints CMS admin/público devuelven HTTP 500. El frontend admin del CMS y el blog público quedan inoperantes durante esa ventana. **Asumido** por el operador en TEST (entorno wiped y sin tráfico real); en AUDIT el CMS no se usaba; PRO no existe todavía.

## Consecuencias

### Positivas

- **Schema versionado y auditable**. Drift como `hero_image_url` ya no puede ocurrir silenciosamente: cualquier cambio aplicado fuera del flujo Flyway dejará huella en `flyway_schema_history` o romperá el arranque al divergir de las entidades.
- **`ddl-auto=validate` se complementa con Flyway**: la herramienta aplica los cambios, Hibernate verifica el resultado. Red de seguridad doble.
- **PRO desde cero arrancará con `flyway migrate`** aplicando V1 + V2 + futuras en orden, sin intervención manual sobre BD. Reduce drásticamente la fricción del lanzamiento.
- **Modelo bilingüe limpio**: el rediseño elimina el modelo padre/hijo con sus side-effects S3 no rollbackeables, la falta de herencia entre versiones de un mismo grupo y la dificultad de extender a más locales.
- **Deuda terminológica "Flyway" cerrada**: `docs/03-environments/test.md` y ADR-016 ya no inducen a error.

### Negativas / aceptadas

- **Ventana de ruptura funcional del CMS** entre merge de paquete 1 y merge de paquete 2 (esperablemente paquetes 2-5). El frontend admin y el blog público devolverán 500 durante ese tiempo. El runbook de aplicación describe explícitamente esta ventana.
- **`V1__baseline.sql` no se aplica en entornos actuales**: existe sólo como bootstrap futuro para PRO. Discrepancia conceptual entre "lo que dice el repo que es V1" y "lo que está aplicado realmente en TEST/AUDIT". Mitigación: documentado en cabecera del fichero y en el runbook.
- **AUDIT recibe tablas CMS vacías** tras aplicar V2 (no las tenía antes). Espacio reservado para cuando AUDIT publique contenido editorial. Sin impacto operativo hoy.
- **Generación de `V1__baseline.sql` es manual**: el operador debe ejecutar `mysqldump` contra AUDIT y commitear el resultado. El paquete deja sólo placeholder. Si el operador olvida regenerar el dump tras alguna migración futura sobre tablas no-CMS, V1 quedará desactualizado hasta el siguiente baseline. Aceptado mientras el ritmo de migraciones sea bajo; se revisa si se vuelve problemático.
- **Migraciones no-CMS quedan archivadas en bloque**. Las 6 migraciones de dominio backoffice/accounting/consent (V20260401, V20260403, V20260406, V20260407, V20260410, V20260411) viajan al archivo junto con las 2 CMS porque la carpeta `db/manual/` desaparece. No es ideal mezclar dominios, pero la opción "mantener `db/manual/` para los no-CMS" introducía un patrón híbrido permanente (Flyway para CMS, manual para el resto). Decisión: archivar todo y dejar V1 como punto cero unificado.

## Alternativas consideradas y rechazadas

- **Camino A: reescribir las 8 migraciones existentes en una sola fresh** y eliminarlas del repo. Pierde traza histórica de qué se aplicó y cuándo en TEST/AUDIT; complica restore desde dumps antiguos. Rechazada.
- **Camino B: migración evolutiva con `ALTER TABLE`** sobre el schema viejo. TEST se vacía igualmente y AUDIT no tiene CMS; el coste de escribir un ALTER consolidado supera el coste de un DROP+CREATE limpio en V2. Rechazada.
- **No introducir herramienta de migración y seguir aplicando `.sql` a mano**. El incidente `hero_image_url` demuestra que la convención visual sin herramienta no contiene el drift. Rechazada.
- **Liquibase en lugar de Flyway**. Flyway es el patrón estándar Spring Boot, sintaxis SQL nativa (el operador ya escribe `.sql` así), integración managed sin pin de versión. Liquibase requiere XML/YAML/JSON adicional y rompe el patrón visual ya consolidado. Rechazada.
- **Mantener el modelo padre/hijo arreglando los puntos rotos** (en lugar de rediseñar). Implicaba implementar herencia automática `hero_image_url`/`category` padre→hijo, sincronización post-publicación, rollback transaccional S3, agrupación visual padre/hijo en admin. Lista larga de parches sobre un modelo intrínsecamente más complejo que el satélite. Rechazada en favor del rediseño completo.

## Plan de implementación

Este paquete (paquete 1) entrega:

1. Dependencias Flyway en `pom.xml` y configuración en `application.properties`.
2. `src/main/resources/db/migration/V1__baseline.sql` (placeholder; el operador lo rellena con `mysqldump --no-data` de AUDIT).
3. `src/main/resources/db/migration/V2__cms_v2_schema.sql` (schema CMS rediseñado, idempotente).
4. Entidades JPA: `ContentArticle` (reescrita), `ContentArticleTranslation` (nueva), `ContentArticleVersion` (simplificada), `ContentArticleTranslationVersion` (nueva).
5. Repositorios mínimos para esas entidades.
6. Neutralización de servicios y controllers que ya no compilan con el modelo nuevo (con mensaje claro `UnsupportedOperationException`).
7. Movimiento de los 8 `.sql` pre-Flyway a `docs/_archive/db-manual-pre-flyway/` + README explicativo.
8. Corrección de la deuda terminológica "Flyway" en `docs/03-environments/test.md` y `docs/06-decisions/adr-016`.
9. Runbook operativo `docs/04-operations/runbooks/cms-v2-flyway-introduction.md` con los pasos exactos del operador para aplicar el cambio en TEST y AUDIT.

Paquetes siguientes (fuera del alcance de esta ADR, secuenciales):

- **Paquete 2**: servicios CMS reescritos sobre el modelo nuevo (`ContentArticleService`, `ContentRunService`).
- **Paquete 3**: controllers admin reescritos.
- **Paquete 4**: pipeline editorial (skills, `cms-json-builder`, `ManualClipboardClaudeAdapter`, `ContentPromptBuilder`) actualizado al schema JSON 2.0 bilingüe.
- **Paquete 5**: capa pública (`ContentPublicController`, `SitemapController` con `xhtml:link`, frontend `BlogArticleView`/`BlogContent`/`LocaleSwitcher` consumiendo `alternates`).
- **Paquete 6**: admin React rediseñado (editor con dos pestañas, validación bloqueante en UI, JSON único bilingüe en panel IA).
- **Paquete 7**: i18n del admin del CMS, deuda residual heredada.

### Validación al cerrar el paquete

- El JAR compila tras la neutralización.
- El operador ejecuta el runbook en TEST: baseline + drop tablas CMS + `flyway migrate` aplica V2. Backend arranca con `ddl-auto=validate` sin errores. Endpoints CMS devuelven 500 (esperado).
- Mismo procedimiento en AUDIT (sin paso de drop CMS, porque AUDIT no las tiene).
- `mvn -DskipTests compile` y test del `MarkdownRendererServiceTest` pasan.

## Deudas registradas

- **Endpoints CMS rotos durante la ventana paquete 1 → paquete 5**. Asumido y finalizado conforme se mergeen los paquetes siguientes.
- **`cms-orchestrator` skill no versionada** en `docs/cms/skills/`. Heredada de [ADR-023](./adr-023-bilingual-editorial-pipeline-es-en.md). Pendiente.
- **`sharemechat-voice` necesita sección EN** para coherencia editorial bilingüe. Pendiente, lo redacta el operador antes del primer run productivo bilingüe.
- **Procedimiento de aplicación de futuras migraciones Flyway** más allá del runbook one-shot de este paquete: cuándo aplicar, cómo coordinar con deploy, quién valida. Sub-pasada operativa futura.
- **Política de generación periódica de `V1__baseline.sql`**: si se acumulan muchas migraciones sobre tablas no-CMS, conviene regenerar el baseline periódicamente para acortar la cadena `V1→V2→...→VN` que ejecutará PRO al lanzarse. Sub-pasada futura.
- **Frontend admin del CMS sin i18n** (deuda heredada del análisis 2026-05-15). No entra en paquete 1; se valora si entra como paquete 7.

## Referencias

- [ADR-010](./adr-010-internal-content-cms-ai-assisted-workflow.md) — CMS interno asistido por IA.
- [ADR-016](./adr-016-content-workflow-simplification-and-retraction.md) — Workflow editorial simplificado. Corregida la deuda terminológica "Flyway" por este ADR.
- [ADR-022](./adr-022-blog-cms-multilingual-es-en.md) — Blog y CMS multilingüe ES+EN.
- [ADR-023](./adr-023-bilingual-editorial-pipeline-es-en.md) — Pipeline editorial bilingüe.
- [ADR-024](./adr-024-bilingual-submit-inside-editor.md) — Flujo bilingüe dentro del editor (parcialmente superseded por el modelo satélite de esta ADR; el endpoint `output-bilingual` se reescribe en paquete 2).
- Runbook operativo: [docs/04-operations/runbooks/cms-v2-flyway-introduction.md](../04-operations/runbooks/cms-v2-flyway-introduction.md).
- Archivo histórico: [docs/_archive/db-manual-pre-flyway/README.md](../_archive/db-manual-pre-flyway/README.md).
