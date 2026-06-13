# aws-scheduler / audit-weekend

Automatización del apagado y arranque del entorno **AUDIT** los fines de
semana usando **Amazon EventBridge Scheduler**. SOLO AUDIT. TEST y PROD
no se tocan jamás desde este frente.

Estado al crearse el frente (2026-06-13):

- Los 4 schedules quedan en **`State=DISABLED`** y no se activan hasta el
  OK explícito del operador. Hasta que se activen, AUDIT sigue 24/7 como
  hasta ahora.
- IAM rol y policies creadas; ventana de backup RDS movida fuera del
  rango del apagado. Resto del trabajo pendiente: pulsar
  `./toggle.sh enable` cuando el operador avise a Segpay (y a cualquier
  otro tercero que dependa de AUDIT).

## Objetivo y horario

| Cuándo | Qué | Acción |
|---|---|---|
| Vie 22:00 Madrid | EC2 AUDIT | `stop` (drena conexiones HTTP/WS antes que la BD) |
| Vie 22:20 Madrid | RDS AUDIT | `stop` |
| Lun 07:00 Madrid | RDS AUDIT | `start` (BD lista antes que la app) |
| Lun 07:20 Madrid | EC2 AUDIT | `start` (`sharemechat-audit.service` enabled at boot) |

Timezone `Europe/Madrid` interpretada por EventBridge; cambio CET ↔ CEST
automático.

### Recursos AUDIT que controla

| Tipo | Identificador |
|---|---|
| EC2 | `i-0d9149cd8a0e24104` (Name=Server-Audit-Sharemechat) |
| RDS | `db1-sharemechat-audit` |
| Cuenta | `430118829334` |
| Región | `eu-central-1` |

`sharemechat-audit.service` está `enabled` en el host: tras `ec2 start`,
systemd arranca el servicio al boot sin intervención manual.

## Arquitectura

```
EventBridge Scheduler
└── schedule-group: sharemechat-audit-weekend
    ├── audit-weekend-stop-ec2   cron(0 22 ? * FRI *)   -> aws-sdk:ec2:stopInstances
    ├── audit-weekend-stop-rds   cron(20 22 ? * FRI *)  -> aws-sdk:rds:stopDBInstance
    ├── audit-weekend-start-rds  cron(0 7 ? * MON *)    -> aws-sdk:rds:startDBInstance
    └── audit-weekend-start-ec2  cron(20 7 ? * MON *)   -> aws-sdk:ec2:startInstances

  Cada schedule asume el rol IAM:
    sharemechat-scheduler-audit-role
  Trust: scheduler.amazonaws.com con Condition aws:SourceAccount=430118829334
  Permissions: ec2:Start/StopInstances + rds:Start/StopDBInstance
               acotados a los ARNs literales del EC2 y la RDS de AUDIT.
```

Targets universales `arn:aws:scheduler:::aws-sdk:<service>:<action>` —
ahorra Lambdas/EventBridge Bus intermedios.

## Modelo de permisos (dos perfiles AWS)

| Perfil | Cuándo se usa | Por qué |
|---|---|---|
| `sharemechat-provisioner` | Bootstrap único: crear el rol IAM + crear/attach la policy del deployer + (uso puntual) mover ventana backup RDS AUDIT | Control plane potente. Uso acotado y documentado, no se usa día a día |
| `sharemechat-deployer` (default) | Día a día: aplicar/actualizar el schedule group y los 4 schedules, leer estado, smoke tests, ejecutar `toggle.sh` | Permisos mínimos. Sin IAM, sin RDS write, sin EC2 write — las acciones de Start/Stop las hace el rol IAM al disparar el schedule, NO el deployer |

**`apply.sh` y `toggle.sh` NO hardcodean ningún perfil.** Usan el default
del entorno. La única referencia al perfil `sharemechat-provisioner` en
este directorio aparece en este README a efectos de auditoría.

## Policies versionadas

### Policy del rol del scheduler — `policy-scheduler-audit.json`

Adjuntada al rol IAM `sharemechat-scheduler-audit-role`. Trust policy en
[`trust-policy-scheduler.json`](trust-policy-scheduler.json).

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AuditEC2StartStopOnly",
      "Effect": "Allow",
      "Action": ["ec2:StartInstances", "ec2:StopInstances"],
      "Resource": "arn:aws:ec2:eu-central-1:430118829334:instance/i-0d9149cd8a0e24104"
    },
    {
      "Sid": "AuditRDSStartStopOnly",
      "Effect": "Allow",
      "Action": ["rds:StartDBInstance", "rds:StopDBInstance"],
      "Resource": "arn:aws:rds:eu-central-1:430118829334:db:db1-sharemechat-audit"
    }
  ]
}
```

ARNs literales (no comodines, no tag conditions) porque la EC2 AUDIT no
lleva `Env=audit` etiquetado y limitar por ARN es trivialmente correcto
para este caso.

### Policy del deployer — `policy-deployer-scheduler.json`

Adjuntada al usuario IAM `sharemechat-deployer` (policy ARN
`arn:aws:iam::430118829334:policy/sharemechat-scheduler-audit-deployer`).
Da exactamente lo necesario para manejar este frente y nada más:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PassSchedulerRoleToSchedulerOnly",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::430118829334:role/sharemechat-scheduler-audit-role",
      "Condition": {
        "StringEquals": {"iam:PassedToService": "scheduler.amazonaws.com"}
      }
    },
    {
      "Sid": "ManageAuditWeekendGroup",
      "Effect": "Allow",
      "Action": [
        "scheduler:CreateScheduleGroup",
        "scheduler:DeleteScheduleGroup",
        "scheduler:GetScheduleGroup",
        "scheduler:TagResource",
        "scheduler:UntagResource",
        "scheduler:ListTagsForResource"
      ],
      "Resource": "arn:aws:scheduler:eu-central-1:430118829334:schedule-group/sharemechat-audit-weekend"
    },
    {
      "Sid": "ManageAuditWeekendSchedules",
      "Effect": "Allow",
      "Action": [
        "scheduler:CreateSchedule",
        "scheduler:UpdateSchedule",
        "scheduler:DeleteSchedule",
        "scheduler:GetSchedule"
      ],
      "Resource": "arn:aws:scheduler:eu-central-1:430118829334:schedule/sharemechat-audit-weekend/*"
    },
    {
      "Sid": "ListSchedulerAccountWideRequired",
      "Effect": "Allow",
      "Action": [
        "scheduler:ListSchedules",
        "scheduler:ListScheduleGroups"
      ],
      "Resource": "*"
    }
  ]
}
```

Notas de auditoría:

1. **`iam:PassRole` con doble condición**: scope al ARN del rol del
   scheduler **y** `iam:PassedToService=scheduler.amazonaws.com`. Aunque
   el deployer pudiera nombrar este rol en otro contexto, solo Scheduler
   lo podría recibir.
2. **`scheduler:Create/Update/Delete/Get` acotados al grupo
   `sharemechat-audit-weekend`** — el deployer no puede mutar nada fuera
   de ese grupo.
3. **`scheduler:ListSchedules` y `scheduler:ListScheduleGroups` requieren
   `Resource: *`** porque las API de listado del servicio Scheduler son
   nivel cuenta y no aceptan filtrado IAM por nombre de grupo. El listado
   es solo lectura y no expone datos sensibles más allá de los nombres de
   schedules de la cuenta, así que el "*" es aceptable y necesario para
   que `aws scheduler list-schedules` funcione (sin él, `apply.sh` ni
   siquiera arrancaría).

## Decisiones operativas registradas

### D1 — Ventana de backup RDS AUDIT (cambio aplicado 2026-06-13)

**Antes**: `21:33-22:03 UTC` (diaria). En invierno (CET=UTC+1) el viernes
RDS se apaga a las 21:20 UTC (= 22:20 Madrid) por este scheduler, **13
minutos antes** del inicio de la ventana de backup. Resultado: el
snapshot automático del viernes no se ejecutaba ese día.

**Después**: `02:00-02:30 UTC` (diaria). Fuera del rango de apagado del
viernes (apagado 21:20 UTC). El viernes a las 02:00 UTC RDS está
encendida → el snapshot del viernes sí corre. Sábado y domingo (RDS
apagada) y lunes 02:00 UTC (RDS aún apagada; arranca 05:00–06:00 UTC
según DST) el snapshot no corre, lo cual es esperado y coherente con el
ahorro de fin de semana.

**Cómo se aplicó**: `AWS_PROFILE=sharemechat-provisioner aws rds
modify-db-instance --db-instance-identifier db1-sharemechat-audit
--preferred-backup-window 02:00-02:30 --apply-immediately`. Uso puntual
del perfil provisioner para esta sola operación. **No** se creó una
policy permanente al deployer para `rds:ModifyDBInstance`: si en el
futuro hace falta volver a tocarla, se repite el patrón provisioner
puntual, igual que con la creación del rol IAM.

**Lo que NO se tocó**: `BackupRetentionPeriod=1`, `MultiAZ=false`,
`DeletionProtection=false`, `PreferredMaintenanceWindow=mon:03:32-mon:04:02`.

**Lo que NO se tocó en otros entornos**: `db1-sharemechat-test-v2`
sigue con `21:33-22:03`, `db1-sharemechat-prod` sigue con `21:00-22:00`.

**Nota sobre `PreferredBackupWindow` vs `PreferredMaintenanceWindow`**:
la primera es **diaria** (`hh:mi-hh:mi`), la segunda es **semanal**
(`ddd:hh:mi-ddd:hh:mi`). En este frente solo cambia la primera.

### D2 — Orden de apagado y arranque

Al apagar, EC2 primero (drena WebSockets) y RDS después con 20 min de
margen para que el JVM termine flushes/conexiones limpias.

Al arrancar, RDS primero porque `sharemechat-audit.service` falla si la
BD no responde; 20 min margen para `available`.

### D3 — `ScheduleExpressionTimezone: Europe/Madrid`

Evitar pelearse con DST manualmente. EventBridge convierte a UTC al
disparo y mantiene la hora local fija (07:00 Madrid es siempre 07:00
Madrid, sea CET o CEST).

### D4 — Targets universales `aws-sdk:*`

No requiere Lambda intermedia ni EventBridge Bus extra. Costes ~0 para
4 disparos/semana. Si en el futuro hace falta orquestación más rica
(p.ej. esperar a `running` antes de seguir) se cambia el target a una
Step Functions state machine.

### D5 — Schedules nacen DISABLED

El operador activa cuando avisa a Segpay (los webhooks de Segpay
seguirán llegando en fin de semana y fallarán mientras AUDIT esté
apagado; deben acordar tolerancia o desactivación). Mientras tanto los
schedules existen pero no disparan.

## Scripts

- `apply.sh` — Idempotente. Crea o actualiza el schedule group y los 4
  schedules en `DISABLED`. Usa el AWS profile por defecto. Pre-condición:
  el rol IAM `sharemechat-scheduler-audit-role` ya existe.
- `toggle.sh enable | disable | status` — Cambia el estado de los 4
  schedules a la vez. Por defecto: `status`.

```bash
./apply.sh                # crea/actualiza, todo DISABLED
./toggle.sh status        # ¿en qué estado están?
./toggle.sh enable        # activa los 4 (tras avisar a Segpay)
./toggle.sh disable       # los desactiva todos
```

## Troubleshooting

| Síntoma | Diagnóstico |
|---|---|
| Lunes 07:30 y AUDIT no responde | `aws rds describe-db-instances --db-instance-identifier db1-sharemechat-audit --query 'DBInstances[0].DBInstanceStatus'`. Si `starting`, esperar; si `stopped`, revisar `audit-weekend-start-rds` en CloudWatch Logs del Scheduler |
| RDS no arranca (`InvalidDBInstanceState`) | Verificar que no se ha pasado el límite de **7 días apagada** (RDS auto-inicia al 7º día); si pasó, el siguiente lunes vuelve a la pauta normal |
| Backup automático del viernes no aparece en consola RDS | Comprobar que en CET (invierno) el viernes a las 02:00 UTC = 03:00 Madrid RDS estaba `available`. Si la habían apagado manualmente antes, no hay snapshot ese día |
| `aws scheduler` devuelve `AccessDeniedException` desde deployer | La policy `sharemechat-scheduler-audit-deployer` no está attached o se editó. Reattach con `AWS_PROFILE=sharemechat-provisioner` |

## Anti-patterns evitados

- ❌ No se usa Instance Scheduler (CloudFormation solution oficial): trae
  Lambdas, DynamoDB y CloudWatch logs — overhead injustificado para 2
  recursos.
- ❌ No se mete una Lambda intermediaria: target universal aws-sdk:* basta.
- ❌ No se programa con cron-on-EC2: requeriría una EC2 management
  siempre encendida.
- ❌ No se hardcodea `AWS_PROFILE` en scripts: el repo es portable y la
  CI/CD futura no necesita conocer nombres de perfil locales.
