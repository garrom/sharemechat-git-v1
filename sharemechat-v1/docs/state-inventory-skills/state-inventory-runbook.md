# Runbook: Generar snapshot de estado con state-inventory

Guía operativa para invocar la skill `state-inventory` y producir un snapshot de un entorno SharemeChat. Pensada para ejecutar el flujo en 5 minutos sin recordar comandos.

Esta guía complementa a `docs/state-inventory-skills/state-inventory.md` (la skill propiamente dicha). Ahí está el procedimiento técnico detallado; aquí está el flujo operativo desde tu máquina Windows.

## Cuándo invocar este flujo

- Al cerrar un frente técnico que haya tocado configuración de un entorno.
- Antes de nivelar un entorno con otro (TEST con AUDIT, AUDIT con PRO).
- Cuando se sospeche que la documentación se ha desincronizado del estado real.

No proactivamente. Tú decides cuándo.

## Prerrequisitos persistentes (una sola vez)

Estos pasos solo se hacen la primera vez en una máquina nueva. Si ya están hechos, saltar al "Flujo de inventariado".

1. **AWS CLI** instalado y configurado con perfil que tenga permisos `cloudfront:GetDistribution*`.
2. **Cliente MySQL Shell** (`mysqlsh`) instalado y disponible en PATH.
3. **Alias SSH** del backend de cada entorno en `~/.ssh/config`. Ejemplo para TEST:

```
Host test-backend
    HostName <ip-publica>
    User ec2-user
    IdentityFile <ruta-completa-al-pem>
    ServerAliveInterval 60
    ServerAliveCountMax 10
```

4. **Mapping local** en `~/.sharemechat/state-mapping.yaml` con el bloque del entorno relleno (ver `docs/state-inventory-skills/state-inventory.md` para el esquema).
5. **Credencial RDS** persistente en User scope:

```powershell
[Environment]::SetEnvironmentVariable("RDS_PASSWORD", "<password>", "User")
```

Tras esto, cerrar y reabrir cualquier PowerShell o Claude Code Desktop para que la herede.

## Flujo de inventariado (cada vez que generas un snapshot)

### Paso 1 — Levantar el backend del entorno (si es TEST)

TEST se levanta y apaga manualmente. Si vas a inventariar TEST con backend "vivo", arranca antes el JAR.

```powershell
ssh test-backend
```

Una vez en la EC2:

```bash
cd ~/sharemechat-v1 && set -a && source /opt/sharemechat/.env && set +a && java -jar sharemechat-v1-0.0.1-SNAPSHOT.jar
```

Esperar a ver `Started SharemechatV1Application in XX seconds`. Dejar la terminal abierta (el JAR queda en foreground).

AUDIT y PRO no requieren este paso (corren con systemd).

### Paso 2 — Abrir el túnel SSH a MySQL

En una PowerShell nueva, desde la raíz del repo:

```powershell
.\ops\scripts\tunnel-rds.ps1 <entorno>
```

Donde `<entorno>` es `test`, `audit` o `prod`.

El script:
- Lee `~/.sharemechat/state-mapping.yaml`.
- Verifica que el puerto 3307 está libre.
- Verifica que el alias SSH responde.
- Abre el túnel.

La PowerShell queda colgada con el banner verde. NO cerrar hasta el final del flujo.

Si el script aborta con error, ver "Errores conocidos" más abajo.

### Paso 3 — Lanzar la skill desde Claude Code Desktop

Abrir Claude Code Desktop apuntando a la raíz del repo. Pegar el prompt de la sección "Prompt para Claude Code Desktop" más abajo (sustituyendo `<entorno>` por el valor real).

Aprobar comando por comando dentro de Claude Code Desktop. Solo deberían ejecutarse comandos de lectura: `aws cloudfront get-*`, `ssh ... "cat / grep / systemctl list-units"`, `mysqlsh ... -e "SELECT ..."`. Si te pide ejecutar algo de escritura (UPDATE, DELETE, modify, push), parar y revisar.

### Paso 4 — Validar el snapshot generado

Claude Code Desktop devuelve al final un bloque markdown con el resumen y la ruta del fichero generado. Verificar que:

- El estado es `COMPLETO` o `PARCIAL` con motivo razonable.
- La ruta apunta a `docs/_snapshots/state-<entorno>-<YYYY-MM-DD-HHMM>.yaml`.
- Las "Discrepancias o sospechas" listadas son entendibles y razonables (no inventos).

Si todo cuadra:

```powershell
git add docs/_snapshots/
git commit -m "Add state snapshot for <entorno> at <fecha>"
git push
```

### Paso 4 bis — Detectar drift contra docs (opcional, recomendado)

Tras commitear el snapshot, conviene ejecutar la skill `state-diff` para detectar drift entre el snapshot recién generado y la prosa narrativa de `docs/03-environments/<entorno>.md`.

Ver `docs/state-inventory-skills/state-diff.md` para el procedimiento completo. En resumen:

1. Abrir Claude Code Desktop en sesión nueva (no reutilizar la del inventariado).
2. Pegar el prompt de state-diff (ver final del runbook o el propio fichero de la skill).
3. Aprobar uno a uno los drifts detectados.
4. Commitear las ediciones aprobadas.

state-diff NO necesita túnel SSH ni backend levantado. Solo lee filesystem local. Es muy rápido.

### Paso 5 — Cerrar el túnel y limpiar

- En la PowerShell del túnel: pulsar `Ctrl+C`.
- Si has levantado el backend de TEST manualmente y no lo necesitas, cerrar la sesión SSH (el JAR muere con ella).

## Prompt para Claude Code Desktop

Copiar el bloque entero, sustituir las dos apariciones de `<entorno>` por `test`, `audit` o `prod`, y pegarlo como primer mensaje en Claude Code Desktop.

---

TAREA — Ejecutar la skill state-inventory contra el entorno <entorno> y producir un snapshot YAML del estado real del sistema.

CONTEXTO

La skill está en docs/state-inventory-skills/state-inventory.md. Cubre cuatro dominios: repo (local), CloudFront (AWS CLI), EC2 backend (SSH), RDS MySQL (vía túnel SSH abierto en localhost:3307).

ENTORNO PRELIMINAR (verificado por el usuario)

- AWS CLI configurado con permisos sobre la distribución del entorno.
- SSH alias del backend operativo en ~/.ssh/config.
- mysqlsh instalado y disponible en PATH.
- Túnel SSH a RDS abierto en localhost:3307 (asumir abierto).
- Tabla de mapeo en ~/.sharemechat/state-mapping.yaml con entrada del entorno rellena.
- Carpeta docs/_snapshots/ existe en el repo.
- Variable de entorno RDS_PASSWORD definida en User scope.

REGLAS GLOBALES

1. Lee primero la skill entera: docs/state-inventory-skills/state-inventory.md.
2. Trabaja desde la raíz del repo. NO crees worktrees, NO cambies de rama.
3. NO hagas git commit. El usuario revisa y commitea.
4. NO modifiques ningún fichero del repo salvo el snapshot final.
5. NO ejecutes comandos correctivos sobre la realidad operativa. Solo lectura.
6. Si un dominio falla, registra el motivo en metadata.notes y continúa.
7. Saneado obligatorio: NUNCA escribas IDs reales en el snapshot. Aliases lógicos del mapeo siempre.
8. La contraseña de RDS está en RDS_PASSWORD (User scope; léela con [Environment]::GetEnvironmentVariable("RDS_PASSWORD","User")).

ENTORNO OBJETIVO

<entorno>

PROCEDIMIENTO

Ejecuta los 7 pasos del procedimiento documentado en la skill, en orden.

ENTREGA

Cuando termines, responde con un bloque markdown copiable con la siguiente estructura:

# State Inventory <entorno> — Resultado

## Estado

[ COMPLETO / PARCIAL / FALLO ]

## Fichero generado

- Ruta: docs/_snapshots/<filename>
- Líneas: <int>

## Resumen por dominio

- Repo: OK / PARCIAL: motivo
- CloudFront: OK / PARCIAL: motivo
- EC2 backend: OK / PARCIAL: motivo
- RDS MySQL: OK / PARCIAL: motivo

## Hallazgos relevantes

[Datos concretos detectados, en bullets]

## Decisiones técnicas tomadas

[Si tuviste que decidir algo no especificado en la skill]

## Discrepancias o sospechas

[Cualquier cosa anómala detectada, sin corregir]

## Siguiente paso para el usuario

1. Revisar el snapshot.
2. Validar con el chat conversacional.
3. Si correcto, git add + commit.

NO hagas commits. NO modifiques nada fuera del snapshot. Si algo no se puede inventariar, dilo y para; no inventes datos.

---

## Errores conocidos y resolución

### "El puerto local 3307 ya está ocupado"

Otro túnel SSH puede estar abierto. Ver procesos `ssh` en ejecución:

```powershell
Get-Process ssh -ErrorAction SilentlyContinue
```

Si hay alguno, identificar el responsable y cerrarlo. Si no hay procesos `ssh` pero el puerto sigue ocupado, esperar 30 segundos (TIME_WAIT) o reiniciar el adaptador.

### "El alias SSH 'test-backend' no responde"

Verificar:

1. Que la EC2 está encendida (consola AWS → EC2 → Instances).
2. Que la IP del Host en `~/.ssh/config` coincide con la IP pública actual de la EC2 (las IPs públicas pueden cambiar al reiniciar).
3. Que `ssh test-backend "echo ok"` funciona desde una PowerShell aparte.

### Claude Code Desktop pide la contraseña RDS interactivamente

Significa que `RDS_PASSWORD` no se está heredando. Verificar:

```powershell
[Environment]::GetEnvironmentVariable("RDS_PASSWORD", "User")
```

Si devuelve vacío, redefinir con `SetEnvironmentVariable` y reiniciar Claude Code Desktop.

### El módulo `powershell-yaml` falla al instalar

El script `tunnel-rds.ps1` lo intenta instalar en el primer uso. Si falla por restricción de PowerShell:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
Install-Module -Name powershell-yaml -Scope CurrentUser -Force
```

### El snapshot reporta "process_present: false" pero el backend SÍ está corriendo

Causa típica: la EC2 no tiene un servicio systemd para el backend; el JAR corre como proceso de `ec2-user`. La skill busca con `pgrep -af 'java.*\.jar'` pero hay falsos negativos en algunos shells.

Verificar manualmente desde la EC2:

```bash
ssh test-backend "ps -ef | grep java | grep -v grep"
```

Si ves el proceso pero el snapshot dice false, ajustar la skill (reportar como mejora futura).

## Versionado

Esta guía es `state-inventory-runbook@v1`. Refleja el flujo operativo del 2026-05-09. Cuando se simplifique algún paso (por ejemplo, si en el futuro existiera un servicio gestionado de túneles), bump de versión y nota en este apartado.
