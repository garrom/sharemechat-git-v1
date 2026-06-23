# Backend deploy investigation 2026-06-22

> Investigación read-only previa al deploy backend PROD (JAR `6cebf90`, migraciones V8/V9/V10, Didit en MOCK). Sin modificar nada, sin desplegar, sin crear snapshots. Aprovecha acceso AWS read-only + SSH a `prod-backend`.

## 1. Resumen ejecutivo

- **NO existe script automatizado** de deploy backend. El procedimiento es **MANUAL** (build mvn → scp → backup → restart → smoke → `update-manifest-backend.ps1`). Documentado en `04-operations/runbooks.md` líneas 86-100. Hay deuda explícita: `deploy-backend.ps1` queda como Fase 2 del frente prevención de drift, pendiente.
- **Backups RDS PROD están en buen estado**. La instancia `db1-sharemechat-prod` es **MySQL 8.4.7 standalone** (NO Aurora), con `BackupRetention=7` días, snapshots automáticos diarios a las 21:11 UTC. **8 snapshots automáticos vivos** (15-22 jun) + **2 manuales históricos**. Último point-in-time restorable: 2026-06-23T14:07:54Z (≈ 5h atrás).
- **El operador tiene una rutina disciplinada de backup del JAR**: 12 backups acumulados en `/home/ec2-user/sharemechat-v1/` con sufijos descriptivos (`.bak-<motivo>-<UTC>`). Patrón establecido, no hay que inventarlo.
- **Backend PROD activo y sano**: `sharemechat-prod.service` running desde 2026-06-11 12:49 UTC (12 días), 993 MB memoria, 39 min CPU, sirviendo tráfico (logs muestran requests cada segundo). JAR de 102 MB. Java 17 Corretto.
- **Acceso operativo confirmado desde esta sesión**: SSH `prod-backend` responde + `aws rds describe-db-snapshots` autorizado en `eu-central-1`. Todo lo necesario para el deploy está al alcance.

---

## 2. Script de deploy backend

### 2.1 Localización

**No existe** `ops/scripts/deploy-backend.ps1`. Scripts relacionados en `ops/scripts/`:

| Script | Rol |
|---|---|
| `deploy-frontend.ps1` | Deploy SPA producto/admin. NO toca backend. |
| `update-manifest-backend.ps1` | Solo actualiza `ops/deploy-state/<env>.yaml` tras deploy manual. NO orquesta. |
| `tunnel-rds.ps1` | Túnel SSH a RDS para consultas mysql. NO deploy. |
| `check-deploy-drift.ps1` | Compara commits desplegados vs HEAD vs origin/main. NO deploy. |
| `prerender-blog-prod.ps1` | Pre-render blog SEO. Solo frontend. |
| `social-thread-finder.ps1`, `sync-skills-to-cowork.ps1` | Frente social. NO backend. |

### 2.2 Funcionamiento

**Procedimiento manual documentado** en `docs/04-operations/runbooks.md` § "Deploy de backend (manual + actualización del manifest)" líneas 86-100. Pasos:

1. `mvn -DskipTests package` desde `sharemechat-v1/` (build local).
2. `scp target/sharemechat-v1-0.0.1-SNAPSHOT.jar prod-backend:/home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar.new` (o equivalente).
3. **Backup del JAR previo en EC2** con sufijo `.bak-<motivo>-<UTC>` (`mv` antes de sobrescribir).
4. `chown ec2-user:ec2-user` del JAR nuevo.
5. `sudo systemctl restart sharemechat-prod.service`.
6. Smoke mínimo: `/api/users/me` → 401, home → 200, `/api/clients/me` → 503 + `X-Product-Mode` (en PRELAUNCH).
7. Inmediatamente después: `ops/scripts/update-manifest-backend.ps1 -Environment prod [-RemoteVerify]`.

**Autenticación contra EC2 PROD**: SSH key del operador con alias `prod-backend` configurado en `~/.ssh/config`. `sudo NOPASSWD` asumido en EC2 (mismo patrón que el resto del proyecto). En esta sesión: `ssh -o BatchMode=yes prod-backend "echo ok"` devuelve `ok` → **acceso confirmado**.

**Drift check propio**: NO. `check-deploy-drift.ps1` se invoca **solo desde `deploy-frontend.ps1`**, no como pre-flight del deploy backend manual. El operador debe verificar a mano que el JAR que sube corresponde al HEAD del repo (manifest opera bajo esa asunción documentada como "limitación conocida" en `update-manifest-backend.ps1` líneas 32-41).

**Rollback**: manual. `mv` del `.bak-...` al nombre activo + `systemctl restart`. Tiempo: 1-2 min.

**Backup del JAR actual antes de sobrescribir**: el procedimiento lo prescribe (paso 3). El operador lo cumple disciplinadamente (12 backups acumulados en el EC2, ver § 4.2).

**Migraciones**: las deja a **Flyway al arrancar Spring**. No hay invocación CLI explícita. Spring Boot ejecuta `flyway:migrate` durante el `ApplicationContext` startup, antes de que la app empiece a aceptar tráfico. Si una migración falla, el JAR no arranca (fail-fast) y `systemctl restart` deja el service en `failed`.

### 2.3 Runbook

**Existe** en `docs/04-operations/runbooks.md`:

- § "Runbook de despliegue (frontend con check de drift, backend manual con actualización del manifest)" cubre AMBOS: el frontend automatizado y el backend manual, en el mismo documento.
- El backend tiene su propia sub-sección "Deploy de backend (manual + actualización del manifest)" (líneas 86-100). Es lo que la sección 2.2 resume.
- Adicionalmente `docs/04-operations/runbooks/cms-v2-flyway-introduction.md` documenta el procedimiento manual de **introducción de Flyway** en TEST y AUDIT (no aplica a PROD ya operativo con Flyway). Útil como referencia para entender el patrón de `mysqldump` + `flyway baseline` históricos.

[gap menor] No existe runbook específico de "deploy backend a PROD paso a paso con checks" como sí lo hay para frontend (con tabla de severidades, casos de uso para IA, etc.). La sub-sección backend del runbook es de 10 líneas, asume contexto. Es suficiente para un operador experimentado pero merece expansión.

### 2.4 Último deploy backend registrado

De `ops/deploy-state/prod.yaml` bloque `backend`:

| Campo | Valor |
|---|---|
| `git_commit` | `b0fa773c44d6c4d1944d82025de07d3cd7993a8f` |
| `git_commit_short` | `b0fa773` |
| `jar_sha256` | `ac457c64ee025a3fa895c61dfe3a4cb324e2a3a1328d0974fc8a37a19decc4f6` |
| `built_at` | `2026-06-11T12:51:37Z` |
| `deployed_at` | `2026-06-11T12:51:37Z` |
| `deployed_by` | `alain@LAPTOP-8UEIKVUT` |
| `ec2_alias` | `prod-backend` |
| `remote_path` | `/home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar` |
| `systemd_unit` | `sharemechat-prod.service` |
| `working_tree_clean` | `true` |
| `verification.method` | `manual_via_update-manifest-backend.ps1` |
| `verification.verified_at` | `2026-06-11T12:51:37Z` |

Confirma: hace 12 días, commit `b0fa773`, working tree limpio en el momento del deploy. **Sin logs de ejecución históricos** en el repo (no hay file de log persistente del proceso manual).

---

## 3. Esquema de backups

### 3.1 Lo que dice el repo

Búsqueda `snapshot|backup|mysqldump|create-db-cluster-snapshot` en `ops/` y `docs/` → 30+ hits. Resumen relevante:

- **`docs/04-operations/runbooks/cms-v2-flyway-introduction.md`** § 2 "Backup obligatorio": prescribe `mysqldump --single-transaction --routines --triggers --events` para TEST y AUDIT antes de introducir Flyway. PROD no aplica (Flyway ya activo). Patrón documentado pero no automatizado.
- **`docs/04-operations/runbooks.md`** § "Runbook de rollback de frontend (S3 + CloudFront)" líneas 134-176: usa `s3://sharemechat-backups/<env>/frontend/<surface>/` para restaurar bundle frontend. **Solo AUDIT cableado**; TEST y PROD pendientes (deuda en `known-debt.md`).
- **`docs/04-operations/known-debt.md`** entry 2026-05-31 "[DEUDA operativa] Nivelar a TEST y PROD el patrón de backup de frontend estrenado en AUDIT": confirma el gap para frontend.
- **Cero ADR sobre backup strategy de RDS**. La estrategia es implícita: AWS hace snapshots automáticos diarios via `BackupRetentionPeriod`.

**Sin scripts** de `mysqldump` automatizados en `ops/scripts/`. Sin scripts de `aws rds create-db-snapshot` programados. Sin job systemd ni Lambda de backup.

### 3.2 Snapshots RDS existentes en AWS

`aws rds describe-db-clusters` (Aurora) devuelve vacío. La instancia PROD es **MySQL 8.4.7 standalone, NO Aurora cluster**.

`aws rds describe-db-snapshots --region eu-central-1 --db-instance-identifier db1-sharemechat-prod`:

**Snapshots automáticos** (8 vivos, retention 7 días, snapshot diario ~21:11 UTC):

| Id | Created | Status | Size (GB) |
|---|---|---|---:|
| `rds:db1-sharemechat-prod-2026-06-22-21-11` | 2026-06-22T21:11:29Z | available | 20 |
| `rds:db1-sharemechat-prod-2026-06-21-21-11` | 2026-06-21T21:11:17Z | available | 20 |
| `rds:db1-sharemechat-prod-2026-06-20-21-11` | 2026-06-20T21:11:18Z | available | 20 |
| `rds:db1-sharemechat-prod-2026-06-19-21-11` | 2026-06-19T21:11:17Z | available | 20 |
| `rds:db1-sharemechat-prod-2026-06-18-21-11` | 2026-06-18T21:11:26Z | available | 20 |
| `rds:db1-sharemechat-prod-2026-06-17-21-11` | 2026-06-17T21:11:22Z | available | 20 |
| `rds:db1-sharemechat-prod-2026-06-16-21-11` | 2026-06-16T21:11:23Z | available | 20 |
| `rds:db1-sharemechat-prod-2026-06-15-21-11` | 2026-06-15T21:11:21Z | available | 20 |

**Snapshots manuales** (2 históricos, ambos pre-deploys conscientes):

| Id | Created | Status | Motivo (inferido del nombre) |
|---|---|---|---|
| `db1-sharemechat-prod-preswitch-20260607` | 2026-06-07T14:24:40Z | available | Pre-switch del switch público (origin CF de landing legacy → SPA prod) |
| `pre-flyway-v4-v7-prod-20260606` | 2026-06-06T14:45:33Z | available | Pre-aplicación V4-V7 (introducción Flyway PROD) |

El más reciente: snapshot automático de hace ~22h. **PROD recuperable a cualquier punto entre 2026-06-15 21:11 UTC (snapshot más antiguo retenido) y 2026-06-23T14:07:54Z (`LatestRestorableTime`)** via point-in-time recovery sobre los transaction logs.

### 3.3 Config de backup del cluster

`aws rds describe-db-instances --db-instance-identifier db1-sharemechat-prod`:

| Campo | Valor |
|---|---|
| `EngineVersion` | `8.4.7` (MySQL Community LTS) |
| `BackupRetentionPeriod` | **7 días** |
| `PreferredBackupWindow` | `21:00-22:00` UTC |
| `LatestRestorableTime` | `2026-06-23T14:07:54Z` |
| `DBInstanceClass` | `db.t3.micro` |
| `StorageType` | `gp2` |
| `AllocatedStorage` | `20 GB` |

`BackupRetentionPeriod=7` → **snapshots automáticos activos**. AWS gestiona retención: cada día se crea un nuevo snapshot y se borra el más antiguo de hace 8 días. Adicionalmente, point-in-time recovery hasta cualquier segundo dentro de los últimos 7 días (transaction logs almacenados separadamente).

### 3.4 Buckets S3 relacionados

`aws s3 ls`: 20 buckets en la cuenta. Relacionados con backup:

| Bucket | Creado | Tamaño | Propósito |
|---|---|---|---|
| `sharemechat-backups` | 2026-05-20 | 14.8 MiB / 39 objetos | Backups frontend AUDIT + 1 dump BD test viejo |

Contenido `sharemechat-backups`:

- `audit/frontend/product/...` (33 objetos): bundle frontend producto AUDIT del 2026-06-08 (último backup pre-deploy).
- `audit/frontend/product/img/` (4 objetos brand): SVGs y PNGs base.
- `test/test-backup-pre-10A11-2026-05-23-0902.sql.gz` (1 objeto, 667 KiB): dump BD TEST de mayo, anterior a Flyway PROD.
- **NO HAY backup del JAR backend** (ningún `prod/backend/...`).
- **NO HAY backup BD de PROD** (`mysqldump` no se sube aquí; los backups BD viven solo en snapshots RDS).

Otros buckets potencialmente relacionados pero no backup activo:

- `sharemechat-cf-logs-prod` (2026-05-26): logs CloudFront PROD (operativos, no backup).
- `sharemechat-cf-logs-audit` (2026-04-17): idem AUDIT.
- `sharemechat-maintenance` (2026-05-21): probable página de mantenimiento.

### 3.5 Contraste repo vs AWS (drift)

| Aspecto | Repo dice | AWS realidad | Drift |
|---|---|---|---|
| Snapshots RDS automáticos | No documentado explícitamente | 8 vivos + 2 manuales, retention 7d | **AWS hace más de lo que el repo documenta** (positivo) |
| `mysqldump` PROD | No documentado | No ejecutado | OK (no esperado; los snapshots RDS cubren) |
| Backup frontend bucket | Solo AUDIT cableado | Solo AUDIT presente | OK (coherente; deuda registrada para TEST/PROD) |
| Backup JAR backend | "Backup del JAR previo en el EC2 con sufijo `.bak-<motivo>-<UTC>`" | 12 backups acumulados con esa convención exacta | OK (procedimiento seguido) |
| Snapshot manual pre-deploy | No prescrito formalmente | 2 históricos manuales detectados (preswitch, pre-flyway-v4-v7) | El operador SÍ los hace cuando juzga necesario, sin estar prescrito en runbook |

**Conclusión**: el repo subestima la red de seguridad real. AWS y el operador conjuntamente cubren mejor que lo que el runbook documenta. No hay drift problemático; hay drift documental (la documentación es más austera que la práctica). [propuesta menor] añadir a `runbooks.md` § "Deploy backend" una nota *"Antes de deploys con migraciones de schema, hacer snapshot manual con tag descriptivo en RDS además del retention 7d que ya cubre. Patrón: `pre-<frente>-prod-YYYYMMDD`."*

---

## 4. Estado actual backend en PROD

### 4.1 Servicio systemd

`ssh prod-backend "sudo systemctl status sharemechat-prod.service --no-pager"`:

```
● sharemechat-prod.service - SharemeChat PROD Backend
     Loaded: loaded (/etc/systemd/system/sharemechat-prod.service; enabled; preset: disabled)
     Active: active (running) since Thu 2026-06-11 12:49:18 UTC; 1 week 5 days ago
   Main PID: 251716 (java)
      Tasks: 44 (limit: 4507)
     Memory: 993.3M
        CPU: 39min 36.247s
     CGroup: /system.slice/sharemechat-prod.service
             └─251716 /usr/lib/jvm/java-17-amazon-corretto.x86_64/bin/java -Dspring.profiles.active=prod -jar /home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar
```

Logs recientes muestran requests cada segundo (`GET /api/admin/models`, `GET /api/admin/finance/summary`, `GET /api/users/me`), incluyendo el log `[CONSENT][NON_COMPLIANT]` esperado para users sin `missing_adult` ack.

| Campo | Valor |
|---|---|
| Estado | `active (running)` |
| Uptime | **12 días** (desde 2026-06-11T12:49:18 UTC) |
| PID | 251716 |
| Memoria | 993 MB |
| Java | OpenJDK 17.0.19 LTS Amazon Corretto |
| Spring profile | `prod` |
| Servicio enabled | sí (arranca con el SO) |

### 4.2 JAR en disco

`ssh prod-backend "ls -lah /home/ec2-user/sharemechat-v1/"`:

```
total 1.3G
-rw-r--r--. ec2-user 102M Jun 11 12:49 sharemechat-v1-0.0.1-SNAPSHOT.jar           ← ACTIVO
-rw-r--r--. root     102M Jun  6 15:26 sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-20260606-152613
-rw-r--r--. root     102M Jun  6 16:36 sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-20260606-163639
-rw-r--r--. root     102M Jun  6 18:32 sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-20260606-183219
-rw-r--r--. root     102M Jun  6 18:47 sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-20260606-184758
-rw-r--r--. root     102M Jun  7 09:23 sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-20260607-092310
-rw-r--r--. root     102M Jun  7 10:32 sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-20260607-103206
-rw-r--r--. ec2-user 102M Jun  8 12:02 sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-h1-20260608-133838
-rw-r--r--. ec2-user 102M Jun  7 10:32 sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-hardening-lote1-20260608-090744
-rw-r--r--. ec2-user 102M Jun  8 09:07 sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-lote2-md-20260608-120228
-rw-r--r--. ec2-user 102M Jun  8 13:38 sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-lote3-20260608-141124
-rw-r--r--. root     102M Jun 11 12:49 sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-pre-paso4-seo-20260611-124903
-rw-r--r--. ec2-user 102M Jun  8 14:11 sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-pre-seo-20260610-102651
```

- **JAR activo**: 102 MB, fecha `Jun 11 12:49` UTC (idéntica al systemd start, coherente).
- **12 backups previos** con sufijos descriptivos (`lote1`, `lote2`, `lote3`, `pre-seo`, `pre-paso4-seo`, `hardening-lote1`, `h1`, etc.). Mezcla owners `root`/`ec2-user` por operaciones SSH con/sin sudo.
- Espacio total `/home/ec2-user/sharemechat-v1/`: 1.3 GB. Hay margen.

[observación] convendría purgar backups muy antiguos cuando se acumulen >20. Hoy 13 archivos JAR × 102 MB = 1.3 GB; en un disco gp2 de 20 GB asignados al RDS (no al EC2) hay holgura, pero merece monitor.

Configuración:

`ssh prod-backend "sudo ls -la /opt/sharemechat/"`:

```
-rw-r-----. root root 2424 May 25 21:54 .env                                       ← legacy, sigue ahí
-rw-r-----. root root 2424 May 25 21:54 .env.bak.pre-refactor-secrets-2026-05-26
-rw-r--r--. root root 2360 Jun  6 15:27 config.env                                 ← no-sensitive vigente
-rw-r--r--. root root 1430 Jun  6 13:09 config.env.bak-20260606-130945
-rw-r--r--. root root 1575 Jun  6 15:26 config.env.bak-pre-country-20260606-152613
-rw-------. root root  560 May 26 21:30 secrets.env                                ← sensitive (0600) vigente
```

Esquema dual `config.env` + `secrets.env` confirmado (refactor 2026-05-26, descrito en `runbooks/didit-setup.md`). `.env` legacy persiste como backup. Permisos correctos: `secrets.env` con `0600 root:root`.

### 4.3 Healthcheck

`/actuator/health` y `/api/public/health` NO existen como endpoints públicos backend (CF reescribe `/actuator/health` a `/index.html` shell SPA porque no contiene punto antes de los segmentos; `/api/public/health` da 401 porque el path pasa por SecurityConfig pero no matchea ningún controller). Probes que SÍ funcionan para confirmar backend vivo:

| URL | HTTP | Content-Type | Significado |
|---|---|---|---|
| `https://sharemechat.com/sitemap.xml` | **200** | `application/xml;charset=UTF-8` | Backend vivo, SitemapController responde + ADR-033 (apex PROD canónico) |
| `https://sharemechat.com/api/users/me` | **401** | (sin body) | Backend vivo, SecurityFilter rechaza sin token |
| `https://sharemechat.com/api/auth/login` GET | **503** | `application/json;charset=UTF-8` | Backend vivo, ProductOperationalModeService devuelve 503 (PRELAUNCH) por método incorrecto en endpoint específico |

**Recomendación**: usar `/sitemap.xml` como healthcheck "backend vivo" más fiable. Es 200 OK con content-length conocido (~7 KB), Content-Type específico, y matchea un controller backend real.

[gap] No hay `/actuator/health` ni `/api/health/version` expuestos. La limitación está documentada en `update-manifest-backend.ps1:32-41` y es el motivo de que el manifest asuma `HEAD = commit del JAR` (fase 2 introduciría `git-commit-id` plugin para versión viva).

### 4.4 Flyway state (comando para consultar)

Script existe: `ops/scripts/tunnel-rds.ps1`. Parámetros:

```
.\tunnel-rds.ps1 prod [-LocalPort 3307]
```

Lee `~/.sharemechat/state-mapping.yaml` para resolver `rds_endpoint_real` y `ec2_backend_ssh_alias` del entorno, abre túnel SSH local con port forwarding a 3306 del RDS via el bastion (el propio EC2 backend). El túnel queda foreground, se cierra con Ctrl+C.

Una vez levantado el túnel, en otra terminal:

```bash
mysql -h 127.0.0.1 -P 3307 -u admin -p db1_sharemechat_prod -e "
SELECT installed_rank, version, description, type, success, installed_on, execution_time
FROM flyway_schema_history
ORDER BY installed_rank DESC
LIMIT 15;"
```

(O usar `mysqlsh` si se prefiere.)

**Comando que NO ejecuto en esta investigación** (solo inventario). Resultado esperado en PROD actual: las últimas filas deberían ser de Flyway V1-V7 (introducidas el 2026-06-06 con el frente `pre-flyway-v4-v7-prod`). Las V8, V9, V10 son justamente las que va a aplicar el deploy backend pendiente.

---

## 5. Dudas / decisiones que quedan para el operador

Antes de redactar el prompt definitivo de deploy backend a PROD, conviene que el operador resuelva o confirme:

1. **¿Snapshot manual pre-deploy adicional?** El retention 7d ya cubre, y el snapshot automático más reciente es de hace ~22 horas. Patrón histórico del operador: hizo manuales para "preswitch" y "pre-flyway-v4-v7" cuando hubo cambios estructurales importantes. ¿Quiere uno para "pre-didit-deploy" (tag `pre-didit-prod-20260623` o similar) como red extra antes de las 3 migraciones nuevas? Recomendable sí; coste ~$0.10 + storage marginal.

2. **¿Esquema de invocación SSH para el deploy desde sesión IA?** SSH a `prod-backend` funciona desde esta sesión (BatchMode ok). ¿La IA orquesta los pasos SSH directamente (scp, ssh sudo mv, ssh sudo systemctl restart) o el operador prefiere ejecutar manualmente los comandos críticos y la IA solo prepara el JAR y los comandos para copy-paste? Decisión de control.

3. **¿Edición de `config.env` y `secrets.env` en EC2 PROD: por IA o por humano?** Los 7 env vars Didit nuevos (`KYC_DIDIT_*`) deben quedar en `/opt/sharemechat/config.env` (5 no-sensitive) y `/opt/sharemechat/secrets.env` (2 sensitive). El operador puede preferir editar a mano por higiene de credenciales (nunca en chat / nunca en historial shell IA). Si IA lo hace, vía heredoc + redirect a sudo tee, las creds tendrían que llegar de algún lado al prompt. Aclarar antes.

4. **¿Qué endpoint(s) cuentan como "smoke OK post-restart"?** El runbook indica `/api/users/me → 401`, `home → 200`, `/api/clients/me → 503 + X-Product-Mode`. ¿Añadir comprobación específica de que las migraciones V8/V9/V10 quedaron aplicadas (consulta `flyway_schema_history` vía túnel)? Sería paso extra coherente con la naturaleza del deploy.

5. **¿Qué hacer si Flyway falla al aplicar migración?** El service no arrancará (fail-fast). Plan de rollback: `mv` del `.bak-...` previo → restart. Las migraciones V8/V9/V10 son safe-online (analizadas en `backend-deploy-backlog-2026-06-22.md` § 3.2), riesgo bajo, pero si por edge case `RENAME TABLE` o `ADD COLUMN` falla en PROD, ¿el operador prefiere que el script aborte limpiamente o que intente reintento automático? Recomendado: abortar y avisar.

6. **¿Coordinación con deploy frontend post-backend?** Una vez backend en `6cebf90` + migraciones aplicadas + smoke OK + `update-manifest-backend.ps1 -Environment prod` ejecutado, el drift check del Prompt 2 frontend pasará. ¿La IA encadena los dos deploys en la misma sesión o cierra el backend y deja el frontend para una sesión nueva? Cuestión de carga cognitiva del operador, no técnica.

7. **¿Validación E2E Didit real (modelo y cliente con documento real) entra en la misma sesión o se difiere?** El runbook `didit-setup.md` § 4-6 prescribe la validación. Requiere humanos con documento real. Si se difiere, marcar como pending pero el deploy backend ya está "técnicamente cerrado" en el momento de smoke OK; lo del documento real es validación de extremo a extremo del integrador externo, no del JAR.
