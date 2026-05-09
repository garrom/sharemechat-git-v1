============================================================
STATE-INVENTORY + STATE-DIFF — Cheatsheet de pasos manuales
============================================================
Procedimiento limpio para generar un snapshot de un entorno
y detectar drift contra docs.

Sustituir <env> por: test | audit | pro
Sustituir <repo> por la ruta absoluta del repo:
C:\Users\alain\Desktop\ALAIN_Escritorio\INFORMATICA\EMPRENDIMIENTO\sharemechat-git-v1\sharemechat-v1


============================================================
PARTE 1 — GENERAR SNAPSHOT
============================================================

----------------------------------------
[1] (Solo TEST) Levantar backend en EC2
----------------------------------------
Ruta: cualquier PowerShell

ssh test-backend

Una vez dentro de la EC2 (ruta: ~/sharemechat-v1):

cd ~/sharemechat-v1 && set -a && source /opt/sharemechat/.env && set +a && java -jar sharemechat-v1-0.0.1-SNAPSHOT.jar

Esperar a ver: "Started SharemechatV1Application in XX seconds"
Dejar la terminal abierta.

(AUDIT y PRO no necesitan este paso — corren con systemd.)


----------------------------------------
[2] Abrir túnel SSH a RDS
----------------------------------------
Ruta: PowerShell nueva, en <repo>

cd <repo>
.\ops\scripts\tunnel-rds.ps1 <env>

La PowerShell queda colgada con banner verde.
NO cerrar hasta el final del flujo.


----------------------------------------
[3] Lanzar state-inventory
----------------------------------------
Ruta: Claude Code Desktop, sesión NUEVA, apuntando a <repo>

Pegar este prompt (sustituir <env>):

------------- INICIO DEL PROMPT -------------
TAREA — Ejecutar la skill state-inventory contra el entorno test y producir un snapshot YAML del estado real del sistema.

Lee primero la skill: docs/skills/state-inventory.md.

Reglas:
- Trabaja desde la raíz del repo. NO worktrees, NO commits, NO push.
- Solo lectura. NO comandos correctivos sobre la realidad.
- Saneado: NUNCA escribas IDs reales en el snapshot. Aliases lógicos siempre.
- RDS_PASSWORD está en User scope: léela con
  [Environment]::GetEnvironmentVariable("RDS_PASSWORD","User")
- Si un dominio falla, regístralo en metadata.notes y continúa.

Entorno objetivo: test

Procedimiento: los 7 pasos documentados en la skill.

Al terminar, devuelve un bloque markdown con:
- Estado: COMPLETO / PARCIAL / FALLO
- Fichero generado: ruta y líneas
- Resumen por dominio (Repo, CloudFront, EC2, RDS)
- Hallazgos relevantes
- Decisiones técnicas tomadas
- Discrepancias o sospechas
- Siguiente paso para el usuario

NO hagas commits. Si algo no se puede inventariar, dilo y para; no inventes datos.
-------------- FIN DEL PROMPT --------------

Aprobar comando por comando. Solo deben ejecutarse comandos de lectura.


----------------------------------------
[4] Validar snapshot y commitear
----------------------------------------
Ruta: PowerShell, en <repo>

cd <repo>
git status
git add docs/_snapshots/
git commit -m "Add state snapshot for <env> at <fecha>"
git push


----------------------------------------
[5] Cerrar túnel y backend
----------------------------------------
- En la PowerShell del túnel (banner verde): Ctrl+C
- Si levantaste backend de TEST manualmente: Ctrl+C en la sesión SSH
  (el JAR muere con la sesión)


============================================================
PARTE 2 — DETECTAR DRIFT (state-diff)
============================================================
NO necesita túnel SSH ni backend levantado. Solo filesystem local.


----------------------------------------
[6] Lanzar state-diff
----------------------------------------
Ruta: Claude Code Desktop, sesión NUEVA (no reutilizar la del paso 3),
apuntando a <repo>

Pegar este prompt (sustituir <env>):

------------- INICIO DEL PROMPT -------------
TAREA — Ejecutar la skill state-diff contra el entorno <env>,
comparando el snapshot más reciente con docs/03-environments/<env>.md.

Lee primero la skill: docs/skills/state-diff.md.

Reglas:
- Trabaja desde la raíz del repo. NO worktrees, NO commits, NO push.
- Solo modifica docs/03-environments/<env>.md, y solo cuando yo apruebe
  cada cambio (s/n/skip).
- NO añadas información que no esté en el snapshot.
- NO inferencia: solo los 4 patrones de la skill (listas, cuentas,
  versiones, valores de configuración).
- Filtra falsos positivos según el Paso 4 de la skill.

Entorno objetivo: <env>

Procedimiento: los 7 pasos de la skill.

Al inicio: resumen con N drifts detectados.
Durante: una pregunta por drift, esperar respuesta.
Al final: resumen con aplicados/rechazados/pendientes y líneas modificadas.

NO hagas commits. La revisión humana del diff es invariante.
-------------- FIN DEL PROMPT --------------

Responder s/n/skip a cada drift propuesto.


----------------------------------------
[7] Revisar diff y commitear
----------------------------------------
Ruta: PowerShell, en <repo>

cd <repo>
git diff docs/03-environments/<env>.md

Si convence:
git add docs/03-environments/<env>.md
git commit -m "Sync <env>.md with snapshot via state-diff"
git push

Si NO convence:
git checkout -- docs/03-environments/<env>.md


============================================================
ERRORES COMUNES
============================================================

"Puerto 3307 ya ocupado" al lanzar tunnel-rds.ps1
→ Get-Process ssh -ErrorAction SilentlyContinue
→ Cerrar el ssh.exe que está bloqueando, o esperar 30s (TIME_WAIT)

"Alias SSH no responde"
→ Verificar que la EC2 está encendida en consola AWS
→ Verificar que la IP del Host en ~/.ssh/config es la actual

Claude Code pide RDS_PASSWORD interactivamente
→ [Environment]::GetEnvironmentVariable("RDS_PASSWORD", "User")
Si vacío:
[Environment]::SetEnvironmentVariable("RDS_PASSWORD", "<pwd>", "User")
Reiniciar Claude Code Desktop

powershell-yaml falla al instalar
→ Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
→ Install-Module -Name powershell-yaml -Scope CurrentUser -Force


============================================================
FIN
============================================================