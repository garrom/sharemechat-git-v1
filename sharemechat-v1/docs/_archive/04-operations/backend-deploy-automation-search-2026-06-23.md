# Backend deploy automation — búsqueda exhaustiva 2026-06-23

> El operador asegura que el deploy backend a PROD lleva meses haciéndose **automatizado usando Claude Code**. La investigación previa ([`backend-deploy-investigation-2026-06-22.md`](backend-deploy-investigation-2026-06-22.md)) concluyó "no existe script orquestador" basándose solo en `ops/scripts/`. Esta segunda búsqueda amplía el alcance a EC2, transcripts JSONL de sesiones previas Claude Code, plugins marketplace, home del operador y git history.

## 1. Resumen ejecutivo (3 líneas)

- **No existe `deploy-backend.ps1` ni script equivalente en ningún lugar del sistema** (repo, EC2, `~/.sharemechat/`, plugins Claude). Las menciones a `deploy-backend.ps1` en transcripts y `known-debt.md` se refieren UNIFORMEMENTE a una **deuda pendiente Fase 2** que nunca se materializó.
- La **"automatización"** es la **IA (Claude Code) orquestando paso a paso el runbook manual** documentado en `04-operations/runbooks.md` § "Deploy de backend" usando su Bash tool: `mvn -DskipTests package` → `scp` del JAR al alias EC2 → `ssh ... 'sudo bash -s' <<'EOF'` con heredoc multi-step (backup, mv, chown, restart) → `curl` smoke → `update-manifest-backend.ps1`. Evidencia masiva en transcripts JSONL.
- **El único "script orquestador" que existe es el conocimiento del runbook + el patrón de prompts que el operador da a la IA**. No hay artefacto persistente versionado que automatice los 6 pasos del runbook end-to-end.

## 2. Dónde está (la "automatización" es la IA + runbook + Bash tool)

### 2.1 Lo que existe en el repo

| Artefacto | Rol | NO orquesta deploy completo |
|---|---|---|
| `ops/scripts/deploy-frontend.ps1` | Deploy SPA producto/admin con drift check, smoke, invalidación CF, manifest. | No toca backend. |
| `ops/scripts/update-manifest-backend.ps1` | **Solo** actualiza `ops/deploy-state/<env>.yaml` (sha256 JAR, commit, fecha). | NO hace mvn, scp, restart, smoke. |
| `ops/scripts/tunnel-rds.ps1` | Túnel SSH a RDS para consultas mysql. | No deploy. |
| `ops/scripts/check-deploy-drift.ps1` | Compara commits. | No deploy. |
| `docs/04-operations/runbooks.md` § "Deploy de backend (manual + actualización del manifest)" líneas 86-100 | **Receta de 6 pasos**: mvn → scp → backup → chown → restart → smoke → update-manifest. Es el "script en prosa" que la IA ejecuta. | Receta, no ejecutable. |

### 2.2 Lo que NO existe

Búsquedas realizadas que dieron negativo:

- `find ops/ -type f -name "*.ps1" -o -name "*.sh"` → solo los 7 scripts ya identificados. Ninguno orquesta deploy backend.
- `git log --all --oneline | grep -iE "deploy.?back|back.?deploy|automate.?backend|backend.?script"` → cero commits que introduzcan tal script.
- `git log --all --oneline --diff-filter=A -- "*deploy-backend*"` → cero ficheros nuevos con ese nombre en la historia git.
- En EC2 `prod-backend`:
  - `/home/ec2-user/`: solo el directorio `sharemechat-v1/` (con JARs y backups) + `coturn/` + dotfiles. **Sin scripts**.
  - `/home/ec2-user/sharemechat-v1/`: solo 13 archivos JAR (el activo + 12 backups). **Sin .sh, sin .ps1**.
  - `/opt/sharemechat/`: solo `.env`, `config.env`, `secrets.env` y sus backups. **Sin ejecutables**.
  - `/opt/sharemechat-prod-access-{blocker,classifier,normalizer,reporter}/`: scripts del perimeter pipeline, no del deploy backend.
  - `/usr/local/bin/sharemechat*`: vacío.
- `~/.sharemechat/`: solo `state-mapping.yaml` (27 KB, leído por todos los scripts del proyecto para resolver bucket/distribución/RDS por entorno).
- `~/.claude/`: 1 hit `deploy-cloudflare-workers.md` del plugin `mcp-server-dev` (irrelevante).
- `~/AppData/Roaming/Claude/`: cero ficheros que matcheen `*backend*`.
- En 18 transcripts JSONL de sesiones Claude Code para este proyecto (en `~/.claude/projects/C--Users-...sharemechat-git-v1/`): **5 hits** del literal `deploy-backend.ps1` y **TODOS** en contexto "Fase 2 pendiente / próximo / deuda" (citas verbatim §2.4).

### 2.3 Memoria persistente Claude Code

`~/.claude/projects/C--Users-...sharemechat-git-v1/memory/MEMORY.md`: solo header + meta. No documenta procedimiento.

### 2.4 Citas verbatim de las menciones a `deploy-backend.ps1` en transcripts

Todos los hits en JSONLs son la misma idea:

> *"podrán rellenar con certeza cuando el backend exponga su commit en vivo); (b) **`deploy-backend.ps1` opción A (Fase 1 paso 2b, próximo)**."*

> *"deploy-backend.ps1 opcion A (script orquestador analogo a deploy-frontend.ps1)"*

> *"[DEUDA media — Fase 2 preventiva drift] Verificacion viva del commit del backend + deploy-backend.ps1 opcion A. Pendiente de Fase 2, tras CERRAR Fase 1 completa el 2026-06-09"*

> *"deploy-backend.ps1 opción A (script orquestador del deploy de backend con mvn package + scp + ..."*

**Cero menciones que digan "ejecutar `deploy-backend.ps1`" o "lanzar el script de deploy backend". Solo prosa de un futuro/deuda.**

### 2.5 Evidencia del patrón real: IA orquesta con Bash tool

Transcript `925bfd70-ce55-4873-9705-dfb6ec1ad74b.jsonl` (2026-05-28, deploy PROD antes del rename del alias):

```
"command":"scp -i ~/.ssh/ec2-keypair-prod.pem -o StrictHostKeyChecking=no
  sharemechat-v1/target/sharemechat-v1-0.0.1-SNAPSHOT.jar
  ec2-user@3.77.59.1:/home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar
  2>&1 | tail -3
  echo '--- SHA local vs remoto ---'
  sha256sum sharemechat-v1/target/sharemechat-v1-0.0.1-SNAPSHOT.jar ..."
```

Transcript `7dbf5457-...jsonl` (2026-05-28): patrón `ssh -i ~/.ssh/ec2-keypair-prod.pem ec2-user@3.77.59.1 'sudo bash -s' << 'OUTEREOF' ... set -euo pipefail ... UNIT=/etc/systemd/system/sharemechat-prod.service ... OUTEREOF`.

Es decir: la IA usa **heredocs SSH multi-comando** desde su Bash tool nativo para encadenar backup + mv + chown + restart en una sola sesión SSH. Esto es **el patrón real de "automatización"**.

Tras el rename `pro-backend → prod-backend` (commit `5df7227`) los comandos pasaron a usar el alias SSH (`ssh prod-backend ...`) en lugar de `-i ~/.ssh/ec2-keypair-prod.pem ec2-user@<IP>`, pero la arquitectura del flujo es la misma.

## 3. Cómo se invoca

**No hay invocación**. El operador escribe a la IA algo como *"deploya backend a PROD del commit `<hash>`"* o *"frente X cerrado, mete el JAR a PROD"* y la IA:

1. Lee `04-operations/runbooks.md` (o lo tiene en contexto).
2. Construye y ejecuta cada paso con Bash tool:
   - `mvn -DskipTests package` desde el repo root.
   - `sha256sum target/sharemechat-v1-0.0.1-SNAPSHOT.jar` (verificación local).
   - `scp ... prod-backend:/home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar.new` (o equivalente).
   - `ssh prod-backend 'sudo bash -s' <<'EOF'` con heredoc: `mv jar.bak-<tag>-<UTC>` + `mv jar.new jar` + `chown` + `systemctl restart sharemechat-prod.service`.
   - `curl` a `/api/users/me` (401), home (200), `/api/clients/me` (503 + X-Product-Mode).
   - `ops/scripts/update-manifest-backend.ps1 -Environment prod [-RemoteVerify]` para fijar manifest.
3. Reporta al operador OK/fail por paso.

Esto es el patrón visto repetidamente en transcripts. El operador llama a esto "automatizado" porque él NO escribe los comandos: solo pide el deploy. La IA es el motor.

## 4. Qué automatiza y qué no

| Paso del runbook | ¿Lo hace la IA con Bash tool? | Notas |
|---|---|---|
| 1. `mvn -DskipTests package` | Sí (rutinariamente en transcripts) | Local, ~30-60 s. |
| 2. `sha256sum` JAR local | Sí | Para verificar integridad. |
| 3. `scp` del JAR a EC2 | Sí | Con alias SSH `prod-backend` o `audit-backend`. |
| 4. Backup JAR previo en EC2 (`mv jar jar.bak-<tag>-<UTC>`) | Sí (heredoc SSH) | Tags descriptivos visibles en los 12 backups (`pre-paso4-seo`, `lote2-md`, `hardening-lote1`, `h1`, etc.). |
| 5. `mv jar.new jar` + `chown` | Sí (heredoc SSH) | Mismo heredoc que paso 4. |
| 6. `sudo systemctl restart sharemechat-prod.service` | Sí (heredoc SSH) | Spring aplica Flyway al arrancar. |
| 7. Smoke curl `/api/users/me → 401`, home `→ 200`, `/api/clients/me → 503 + X-Product-Mode` | Sí | Verificación post-restart. |
| 8. `ops/scripts/update-manifest-backend.ps1 -Environment prod` | Sí (invoca el script) | El único script real que se ejecuta. |

**Qué NO hace la IA automáticamente** (decisión del operador caso a caso):

- Snapshot manual RDS pre-deploy. Patrón ad-hoc: lo hizo para `preswitch-20260607` y `pre-flyway-v4-v7-prod-20260606`; no para deploys cotidianos.
- Editar `/opt/sharemechat/config.env` y `secrets.env` (creds nuevas). Esto el operador lo prefiere a mano por higiene de credenciales.
- Validación E2E con humanos reales (post-deploy Didit u otros vendors).
- git commit + push del manifest tras `update-manifest-backend.ps1` (decisión D2 del frente prevención drift).

## 5. Evidencia de las últimas ejecuciones

### 5.1 Manifest `ops/deploy-state/prod.yaml`

Último deploy backend registrado:

```yaml
backend:
  git_commit_short: b0fa773
  git_commit: b0fa773c44d6c4d1944d82025de07d3cd7993a8f
  jar_sha256: ac457c64ee025a3fa895c61dfe3a4cb324e2a3a1328d0974fc8a37a19decc4f6
  deployed_at: 2026-06-11T12:51:37Z
  deployed_by: alain@LAPTOP-8UEIKVUT
  ec2_alias: prod-backend
  remote_path: /home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar
  systemd_unit: sharemechat-prod.service
  working_tree_clean: true
  verification:
    method: manual_via_update-manifest-backend.ps1
    verified_at: 2026-06-11T12:51:37Z
    notes: 'Actualizado manualmente por update-manifest-backend.ps1 (Fase 1 paso 2b) tras deploy manual del backend (scp + restart).'
```

### 5.2 Backups JAR acumulados en EC2 PROD

`ssh prod-backend "ls -lah /home/ec2-user/sharemechat-v1/*.jar*"`:

12 backups con sufijos descriptivos:

```
sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-20260606-152613
sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-20260606-163639
sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-20260606-183219
sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-20260606-184758
sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-20260607-092310
sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-20260607-103206
sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-h1-20260608-133838
sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-hardening-lote1-20260608-090744
sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-lote2-md-20260608-120228
sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-lote3-20260608-141124
sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-pre-paso4-seo-20260611-124903
sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-pre-seo-20260610-102651
```

**Lectura forense**:
- 4 deploys el 6 jun (probablemente sub-pasadas de un frente grande con backups intermedios).
- 2 deploys el 7 jun.
- 4 deploys el 8 jun (lote1, lote2-md, lote3, h1 — sufijos parecen de "lotes de hardening").
- 1 deploy el 10 jun (pre-seo).
- 1 deploy el 11 jun (pre-paso4-seo).

Total: **~12 deploys backend a PROD en 5 días (6-11 jun)** con backup automatizado nombrado. **Cadencia muy alta**. Esto confirma operativa "automatizada" en el sentido de "lo pide a IA y se ejecuta rápido", no manual con click por click.

Los sufijos descriptivos (`pre-paso4-seo`, `lote2-md`, `hardening-lote1`, `h1`) son **típicos de redacción IA con contexto del frente** (no de operador escribiendo a mano cada vez).

### 5.3 Transcripts JSONL relevantes

| Transcript | Fecha | Tamaño | Contiene tool-calls deploy backend |
|---|---|---|---|
| `925bfd70-...` | 2026-05-28 | 1.9 MB | scp PROD con IP directa + keypair (pre-rename) |
| `7dbf5457-...` | 2026-05-28 | 6 MB | ssh PROD heredoc backup/restart systemd unit |
| `f36dc0e0-...` | 2026-06-17 | **34 MB** | ssh audit-backend + heredocs sudo bash con migraciones, deploys lote audit |
| `16577918-...` | 2026-06-08+ | 10 MB | Múltiples sesiones ops + manifest |
| `c504d9a1-...` | 2026-06-23 | 4.6 MB | Mi sesión actual (investigación) |
| `75285545-...`, `554baf8d-...`, `66c6e958-...`, `6788a528-...`, `6beb8351-...`, `90bd98f1-...`, `b19c336c-...` | varias | varias | Hits a `mvn package` o `prod-backend` en contexto |

**Conclusión transcripts**: existe un historial **continuo y profuso** de sesiones donde la IA orquestó deploys (PROD y/o AUDIT) usando Bash tool. Ningún transcript invoca un `.ps1` orquestador; todos usan `mvn`, `scp`, `ssh ... 'sudo bash -s'` directamente.

## 6. Cómo lo describiría yo (revisión del informe anterior)

Mi informe `backend-deploy-investigation-2026-06-22.md` § 2.1 afirmaba *"No existe `ops/scripts/deploy-backend.ps1`. ... El procedimiento es MANUAL"*. Esto es **literalmente cierto** (no existe el script) pero **operativamente engañoso**: el operador lleva meses haciendo deploys que él percibe como "automatizados" porque la IA es la que ejecuta, no él. La diferencia entre "manual" y "automatizado" para el operador es **quién mueve los dedos**, no **si hay un script .ps1 dedicado**.

Reformulación correcta:

> **Existen DOS modos vigentes de deploy backend a PROD**:
> 1. **Modo "operador humano"** (deuda documentada como Fase 2, no usada en la práctica): el operador ejecuta `mvn`, `scp`, `ssh sudo systemctl restart`, etc., a mano desde su terminal.
> 2. **Modo "IA orquestada"** (modo real desde hace meses): el operador pide a Claude Code "deploya backend a PROD" y la IA ejecuta los 6 pasos del runbook con su Bash tool, usando `ssh prod-backend 'sudo bash -s' <<'EOF' ... EOF` para encadenar pasos remotos en una sola invocación SSH. **No hay script .ps1; el "script" es el conocimiento del runbook + el patrón de prompts**.

El script Fase 2 (`deploy-backend.ps1`) sigue siendo deuda **porque mejoraría el modo 1 y dejaría la operación reproducible sin IA**. Pero el modo 2 ya cubre el caso real.

## 7. Qué necesitamos del operador para esclarecer

1. **¿Confirmas que "automatizado usando Claude Code" significa exactamente lo descrito en § 6 (IA orquestando con Bash tool, sin script .ps1 dedicado)?** Si es así, el plan para el deploy backend PROD del Prompt FASE 2D va a consistir en darle a la IA instrucciones claras del flujo + autorización para invocar Bash tool con scp/ssh/sudo bash heredoc, no en invocar un script inexistente. Si NO es así, ¿dónde vive el procedimiento que estoy ignorando? (Pídeme el path; lo cargo en la siguiente sesión.)

2. **¿El patrón vigente de heredoc SSH es el correcto para el deploy de mañana (Didit + V8/V9/V10)?** Específicamente:
   ```bash
   ssh prod-backend 'sudo bash -s' <<'EOF'
   set -euo pipefail
   JAR=/home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar
   BAK="${JAR}.bak-pre-didit-$(date -u +%Y%m%d-%H%M%S)"
   cp "$JAR" "$BAK"
   mv "${JAR}.new" "$JAR"
   chown ec2-user:ec2-user "$JAR"
   systemctl restart sharemechat-prod.service
   sleep 5
   systemctl is-active sharemechat-prod.service
   EOF
   ```
   Si quieres una variante distinta (más checks, distinto tag, etc.) díme.

3. **¿`update-manifest-backend.ps1 -Environment prod -RemoteVerify` cierra el ciclo igual que en deploys anteriores?** Es el único `.ps1` que la IA ejecuta hoy y que SÍ existe. Confirmar.

4. **¿Snapshot manual RDS pre-deploy?** Mañana hay 3 migraciones nuevas (V8, V9, V10). El patrón histórico tuyo (snapshots `preswitch-20260607` y `pre-flyway-v4-v7-prod-20260606`) sugiere que sí lo haces antes de cambios estructurales. ¿Lo añado al flujo o no? (`aws rds create-db-snapshot --db-snapshot-identifier pre-didit-prod-$(date -u +%Y%m%d) --db-instance-identifier db1-sharemechat-prod --region eu-central-1`.)

5. **¿Quieres que YO redacte un primer borrador de `deploy-backend.ps1` (la deuda Fase 2)** capturando el patrón visto en transcripts + el runbook, como entregable extra del deploy de mañana? Si lo haces, dejas operativa reproducible sin IA presente. No es bloqueante pero cierra una deuda explícita.
