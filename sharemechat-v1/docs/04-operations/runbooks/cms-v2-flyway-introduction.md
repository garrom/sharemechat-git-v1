# Runbook — Introducción de Flyway y aplicación de V2 (rediseño CMS bilingüe)

> Marco: [ADR-025](../../06-decisions/adr-025-flyway-introduction-and-cms-v2-schema.md). Procedimiento operativo único, ejecutable sobre TEST y AUDIT por el operador con acceso al bastión RDS. Tiempo estimado total: 30-45 minutos por entorno con pausa de validación entre pasos.

## 1. Pre-requisitos

Antes de empezar, confirmar que se cumple todo lo siguiente. Si algo falla, **parar y resolver antes de continuar**.

- Branch del paquete 1 mergeada en `main` (o disponible localmente para build).
- Acceso al bastión RDS y a las dos instancias EC2 (TEST y AUDIT) desde el portátil del operador. Túneles `ops/scripts/tunnel-rds.ps1` operativos contra ambos entornos.
- Herramientas en el portátil/bastión:
  - `mysql` CLI cliente, versión compatible con MySQL 8.x.
  - `mysqldump` (suele venir con el cliente `mysql`).
  - Java 17 y Maven (para construir el JAR localmente si hace falta).
  - `flyway` CLI **opcional** pero recomendado para los pasos de baseline. Si no se tiene, los comandos `flyway baseline` pueden ejecutarse vía el endpoint `/actuator/flyway` con `flyway.enabled=true` y arranque puntual, pero el flujo más simple es instalar el CLI. Versión sugerida: 10.x (alineada con la dependencia managed por Spring Boot 3.5).
- Credenciales BD para `admin` accesibles vía variable de entorno o secret manager (no en disco plano).
- Bucket S3 disponible para subir el dump de backup pre-aplicación.
- Confirmación operativa de que ningún tráfico productivo está usando los endpoints CMS de TEST o AUDIT en este momento (CMS en TEST y AUDIT es interno; PRO no existe). Esta ventana es **ruptura funcional asumida del CMS**.

### Confirmación de inventario antes de actuar

Conectarse con `mysql` a TEST y a AUDIT, y ejecutar `SHOW TABLES;` en cada uno. Esperado:

- AUDIT: 43 tablas, ninguna empieza por `content_`. Si aparece `content_*`, **parar**: AUDIT no debería tener tablas CMS según el inventario del operador; reportar la discrepancia antes de seguir.
- TEST: 43 tablas no-CMS + 4 tablas CMS (`content_articles`, `content_article_versions`, `content_generation_runs`, `content_review_events`). Si las cuentas no cuadran, parar y reportar.
- En ambos: la tabla `flyway_schema_history` **no debe existir**. Si existe, alguien introdujo Flyway antes; parar y reconciliar.

## 2. Backup obligatorio

Antes de tocar cualquier cosa, dump completo de TEST y AUDIT. Sin esto, el rollback es imposible.

### TEST

```
mysqldump --single-transaction --routines --triggers --events \
          -h <bastion-rds-test> -P <port> \
          -u admin -p \
          db1_sharemechat_test \
  > backup-pre-flyway-test-$(date +%Y%m%d-%H%M).sql
```

Subir inmediatamente el `.sql` al bucket S3 privado de backups operativos (no commitear a git). Verificar tamaño del fichero no nulo y que las primeras líneas contengan `-- MySQL dump`.

### AUDIT

```
mysqldump --single-transaction --routines --triggers --events \
          -h <bastion-rds-audit> -P <port> \
          -u admin -p \
          db1_sharemechat_audit \
  > backup-pre-flyway-audit-$(date +%Y%m%d-%H%M).sql
```

Idéntico procedimiento de subida y validación.

## 3. Generación de `V1__baseline.sql`

`V1` se genera del schema de AUDIT (43 tablas no-CMS limpias). Ejecutar desde el bastión o desde el portátil con túnel activo:

```
mysqldump --no-data --skip-add-drop-table \
          --routines --triggers --events \
          -h <bastion-rds-audit> -P <port> \
          -u admin -p \
          db1_sharemechat_audit \
  > V1__baseline.sql
```

Validación del fichero generado:

- `wc -l V1__baseline.sql` — esperado: del orden de cientos a miles de líneas (depende del número de columnas total).
- `grep -c "CREATE TABLE" V1__baseline.sql` — esperado: **43** (las 43 tablas no-CMS de AUDIT). Si el número es distinto, parar y reportar.
- `grep "content_" V1__baseline.sql` — esperado: **0 matches**. Si aparece cualquier tabla `content_*`, parar: AUDIT tendría inadvertidamente tablas CMS y la pre-condición del paso 1 no se cumple.
- Abrir el fichero y verificar que no contiene ninguna sentencia `INSERT INTO` (debería ser sólo DDL gracias a `--no-data`).
- Verificar que no aparece el nombre de la BD en `USE` ni `CREATE DATABASE` salvo en comentarios. Si aparece `CREATE DATABASE`, eliminarlo manualmente (Flyway no quiere tocar BD-level).

Reemplazar el placeholder `src/main/resources/db/migration/V1__baseline.sql` por el contenido del dump generado. **Commitear** este fichero como parte de la rama del paquete 1 (antes del merge a `main`).

## 4. Introducción de Flyway en TEST

### 4.1 Build del backend con la dependencia nueva

Construir el JAR desde la rama del paquete 1:

```
mvn -DskipTests clean package
```

Esperado: build exitoso. El JAR `target/sharemechat-v1-0.0.1-SNAPSHOT.jar` ya tiene `flyway-core` y `flyway-mysql` como dependencias.

### 4.2 Arranque verificación con Flyway desactivado

Antes de hacer baseline, validar que el código de la rama paquete 1 arranca contra TEST con `SPRING_FLYWAY_ENABLED=false`. Esto ejercita la red de seguridad `ddl-auto=validate` sobre el schema viejo:

```
SPRING_FLYWAY_ENABLED=false \
java -jar target/sharemechat-v1-0.0.1-SNAPSHOT.jar
```

Esperado: el backend **NO arranca**. Hibernate fallará con error de validación, porque las entidades CMS nuevas (`ContentArticle` con menos columnas, `ContentArticleTranslation`, etc.) no encajan con el schema viejo aún en BD. Este fallo es la confirmación de que el código nuevo necesita V2.

Si arranca limpiamente, algo está mal: parar y revisar.

### 4.3 Baseline manual sobre TEST

Con `flyway` CLI configurado para apuntar a TEST:

```
flyway -url=jdbc:mysql://<bastion-rds-test>:<port>/db1_sharemechat_test \
       -user=admin -password=<pwd> \
       -locations=filesystem:src/main/resources/db/migration \
       baseline -baselineVersion=1 -baselineDescription="Pre-CMS-v2 state"
```

Esperado: salida `Successfully baselined schema with version: 1`.

Validación inmediata, conectado por `mysql`:

```
SELECT * FROM flyway_schema_history;
```

Debería devolver **una fila** con `version=1`, `description='<< Flyway Baseline >>'` o similar, `script='<< Flyway Baseline >>'`, `success=1`.

### 4.4 DROP de las tablas CMS viejas en TEST

Conectado a TEST con `mysql`, en orden inverso de FK:

```
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS content_review_events;
DROP TABLE IF EXISTS content_article_versions;
DROP TABLE IF EXISTS content_generation_runs;
DROP TABLE IF EXISTS content_articles;
SET FOREIGN_KEY_CHECKS = 1;
```

Validación: `SHOW TABLES LIKE 'content_%';` debe devolver vacío. `SHOW TABLES;` debe devolver las 43 tablas no-CMS + la nueva `flyway_schema_history`.

### 4.5 Aplicación de V2 sobre TEST

Tres opciones equivalentes:

**Opción A (recomendada): arrancar el backend con Flyway activo**

```
SPRING_FLYWAY_ENABLED=true \
java -jar target/sharemechat-v1-0.0.1-SNAPSHOT.jar
```

Esperado en logs:

- `Flyway Community Edition 10.x.x by Redgate`.
- `Database: jdbc:mysql://... (MySQL 8.x)`.
- `Successfully validated 2 migrations` (V1 y V2 en classpath).
- `Current version of schema: 1` (porque baseline).
- `Migrating schema to version "2 - cms v2 schema"`.
- `Successfully applied 1 migration to schema` (V2).
- A continuación, Hibernate ejecuta `ddl-auto=validate` y debe pasar sin errores.
- Banner Spring Boot, backend operativo en puerto 8080.

**Opción B: aplicar V2 explícitamente con CLI antes de arrancar backend**

```
flyway -url=... -user=admin -password=... \
       -locations=filesystem:src/main/resources/db/migration \
       migrate
```

Y luego arrancar el backend igual que en arranque normal.

**Opción C: si la opción A falla por motivo del orden de FK o similar**, ejecutar el SQL de V2 manualmente con `mysql ... < V2__cms_v2_schema.sql` y después insertar manualmente la fila correspondiente en `flyway_schema_history`. Es ruta de emergencia; preferible diagnosticar el fallo de A antes.

### 4.6 Validación post-aplicación en TEST

Con `mysql`:

```
SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;
```

Esperado: dos filas. La primera (`version=1`) es el baseline. La segunda (`version=2`) tiene `description='cms v2 schema'` y `success=1`.

```
SHOW TABLES LIKE 'content_%';
```

Esperado: 6 tablas (`content_articles`, `content_article_translations`, `content_article_versions`, `content_article_translation_versions`, `content_generation_runs`, `content_review_events`).

```
DESCRIBE content_articles;
DESCRIBE content_article_translations;
```

Verificar que los campos coinciden con el schema declarado en `V2__cms_v2_schema.sql`. Especial atención: `content_articles` NO tiene `slug`, `locale`, `title`, `parent_article_id`, `body_s3_key` (movidos a `content_article_translations` o eliminados). `content_articles` SÍ tiene `hero_image_url`.

Backend operativo (sin reiniciar): los endpoints CMS devuelven HTTP 500 con `UnsupportedOperationException` mientras paquete 2 no esté en su sitio. **Esto es esperado**. Los endpoints no-CMS (login, matching, etc.) operan normales. `/robots.txt` operativo.

## 5. Introducción de Flyway en AUDIT

Procedimiento simétrico al de TEST, **sin el paso de drop de tablas CMS** (porque AUDIT no las tiene):

1. Backup obligatorio (paso 2 ya ejecutado al inicio).
2. Baseline manual (`flyway baseline -baselineVersion=1`) contra AUDIT.
3. Validar `flyway_schema_history` con una fila baseline.
4. Aplicar V2 (cualquiera de las opciones A/B/C del paso 4.5). En AUDIT V2 sólo crea tablas (no drop, no exist desde antes).
5. Validar `flyway_schema_history` con dos filas. `SHOW TABLES LIKE 'content_%';` debe devolver las 6 nuevas.
6. Reiniciar el servicio `sharemechat-audit.service` (en AUDIT el backend corre como systemd, no manual como en TEST) tras commitear que Flyway está en su sitio:

```
sudo systemctl restart sharemechat-audit.service
sudo journalctl -u sharemechat-audit -n 200 --no-pager
```

Buscar en los logs las líneas de Flyway y el banner de Spring Boot. Si el backend falla al arrancar con error de Hibernate `ddl-auto=validate`, **NO ha aplicado V2 correctamente**; investigar la fila de V2 en `flyway_schema_history` y comparar `DESCRIBE` de las tablas contra las entidades JPA.

## 6. Rollback de emergencia

Si en cualquier punto algo va catastróficamente mal y necesitas volver al estado pre-Flyway:

### En TEST

```
# Conectado a TEST con mysql, en orden inverso de FK:
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS content_review_events;
DROP TABLE IF EXISTS content_article_translation_versions;
DROP TABLE IF EXISTS content_article_versions;
DROP TABLE IF EXISTS content_article_translations;
DROP TABLE IF EXISTS content_generation_runs;
DROP TABLE IF EXISTS content_articles;
DROP TABLE IF EXISTS flyway_schema_history;
SET FOREIGN_KEY_CHECKS = 1;

# Después, restaurar desde el dump del paso 2:
mysql -h <bastion-rds-test> -P <port> -u admin -p db1_sharemechat_test \
  < backup-pre-flyway-test-YYYYMMDD-HHMM.sql
```

Tras el restore, arrancar el backend con el JAR **anterior** al paquete 1 (no el nuevo, que no compila contra el schema viejo). Verificar con `mysql` que el schema viejo está intacto.

### En AUDIT

Procedimiento idéntico, sustituyendo nombres de host y BD. Las tablas CMS no existían pre-Flyway en AUDIT, así que el drop sólo afecta a `flyway_schema_history` y a las 6 tablas CMS que V2 creó.

## 7. Verificaciones post-aplicación finales

Una vez aplicados V1 baseline + V2 en ambos entornos, ejecutar las siguientes comprobaciones manuales antes de cerrar el paquete:

- `SHOW TABLES LIKE 'flyway_schema_history';` en TEST y AUDIT — ambas devuelven la tabla.
- `SELECT COUNT(*) FROM flyway_schema_history WHERE success = 1;` — en ambos entornos, **2**.
- `SHOW TABLES LIKE 'content_%';` — en ambos entornos, **6 tablas**.
- Backend en TEST arrancado con `SPRING_FLYWAY_ENABLED=true`: log incluye `Successfully applied 1 migration to schema` la primera vez; siguientes arranques muestran `Schema is up to date. No migration necessary.`.
- Backend en AUDIT arrancado vía systemd: equivalente en `journalctl`.
- `curl https://test.sharemechat.com/robots.txt` — responde 200 con texto válido (no afectado por la neutralización).
- `curl https://test.sharemechat.com/sitemap.xml` — responde 500 (esperado mientras paquete 5 no esté).
- `curl -i https://test.sharemechat.com/api/public/content/articles?locale=es` — responde 500 (esperado mientras paquete 5 no esté).
- Endpoints no-CMS (login, refresh, matching, etc.) operan normales en ambos entornos.

## 8. Cierre operativo

Tras validar:

- Anotar en `docs/04-operations/incident-notes.md` (sección con fecha 2026-05-16, encabezado "Introducción Flyway + V2 CMS aplicado") los timestamps de aplicación en TEST y AUDIT, el hash del JAR usado y cualquier anomalía observada.
- Si se observó alguna divergencia entre `V1__baseline.sql` (lo que dice el repo) y el schema real de AUDIT post-baseline (lo que efectivamente quedó), abrir nota en `known-debt.md` para regenerar V1 cuando convenga.
- Confirmar al owner que la ventana paquete 1 → paquete 2 está activa: endpoints CMS rotos hasta que paquete 2 se mergee.

A partir de aquí, cualquier cambio futuro de schema entra como `V3__...sql`, `V4__...sql` bajo `src/main/resources/db/migration/`. Flyway lo aplicará automáticamente en el siguiente arranque. **No volver a aplicar SQL a mano**.
