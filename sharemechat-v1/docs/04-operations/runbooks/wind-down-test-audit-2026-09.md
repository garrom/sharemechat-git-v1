# Runbook — Apagado y restauración de TEST / AUDIT (pausa por pivote a Ritmelo)

**Fecha del apagado: 2026-09-10.** Contexto: SharemeChat queda en pausa (pivote a Ritmelo, la OÜ sigue). Se apagan **TEST y AUDIT** para eliminar coste, **sin borrar contenido** (Opción B: snapshot + terminar). **PROD, la zona Route53 de `sharemechat.com` y el correo Microsoft 365 `operations@` NO se tocan.** Todas las operaciones se hicieron/se hacen con el perfil elevado **`sharemechat-provisioner`**, región **`eu-central-1`** (el perfil `sharemechat-deployer` solo tiene read + deploy y NO puede parar/borrar).

## ⚠️ Punta suelta: liberar una EIP obliga a BORRAR su registro DNS (cerrado 2026-09-11)

Al liberar las EIP el 2026-09-10 **no se borraron los registros A** que las apuntaban → quedaron colgando (*dangling DNS*: la IP vuelve al pool de AWS y un tercero puede re-asignársela y servir contenido bajo nuestro subdominio = *subdomain takeover*):
- `api.audit.sharemechat.com` → 18.195.185.25 · `api.test.sharemechat.com` → 63.180.48.12

Detectado por aviso externo (patrón *beg-bounty*: informe real + petición de pago; **no se paga**, no hay programa de recompensas). **Corregido el 2026-09-11**: ambos registros A borrados de la zona Route53 `sharemechat.com` (`Z054470823PMZQENFZHHZ`) con `change-resource-record-sets`. MX/TXT (correo M365) y registros de PROD intactos.

**Regla para futuros apagados (incluido PROD):** al liberar una Elastic IP, **borrar en la misma pasada** el/los registros DNS que la apuntan. Al restaurar se recrean con la IP nueva (ver §restaurar). Verificación: `list-resource-record-sets` no debe devolver ningún A apuntando a una IP ya liberada.

## Estado tras el apagado

| Recurso | TEST | AUDIT | PROD (intacto) |
|---|---|---|---|
| EC2 | `i-088341cf8d122920f` **terminated** | `i-0d9149cd8a0e24104` **terminated** | `i-0e0a3b5fee271592f` running |
| RDS | `db1-sharemechat-test-v2` **borrada** | `db1-sharemechat-audit` **borrada** | `db1-sharemechat-prod` available |
| Elastic IP | 63.180.48.12 (`eipalloc-0248fb7f8bd9995f7`) **liberada** | 18.195.185.25 (`eipalloc-039ec5def4a95b898`) **liberada** | 3.77.59.1 (`eipalloc-0fcef8cfccdf19f49`) |
| CloudFront | E2Q4VNDDWD5QBU, E28YCPVIRB4ASH, E1WZ44LRD39ZAO **Disabled** | E1ILXV7P6ENUV8, E21IB0VBKYNNBW, E2NC4TEJAWOI3L **Disabled** | E2FWNC80D4QDJC, E3UAOU6AUNI0CM, E3O40LHJ4PC6LE enabled |
| S3 | intacto (contenido) | intacto (contenido) | intacto |

Nota EBS: los discos raíz tenían `DeleteOnTermination=true` → se borraron al terminar, pero **el AMI de cada entorno contiene su snapshot** (contenido preservado).

## Red de seguridad (copias para restaurar)

- **AMI TEST**: `ami-060e74afdc8d7d21c` (`sharemechat-test-final-shutdown-2026-09-10`)
- **AMI AUDIT**: `ami-0ff1874f4c8ad5f7a` (`sharemechat-audit-final-shutdown-2026-09-10`)
- **Snapshot RDS TEST**: `db1-sharemechat-test-v2-final-shutdown-2026-09-10`
- **Snapshot RDS AUDIT**: `db1-sharemechat-audit-final-shutdown-2026-09-10`
- Los snapshots RDS son **manuales** (persisten; los `automated` se borraron con la instancia). Reflejan el estado del **2026-09-05** (último automated antes del apagado; los entornos llevaban parados desde entonces, sin escrituras nuevas).

## Restaurar un entorno

Ejemplo **TEST** (AUDIT es idéntico cambiando los IDs por los suyos). Prefijo `P="--profile sharemechat-provisioner"`, región `eu-central-1`. Referencia de VPC/subnet/security-group/keypair: describir la instancia **PROD** (`i-0e0a3b5fee271592f`) y reutilizar los mismos.

1. **RDS desde snapshot** (el endpoint será NUEVO):
   ```
   aws rds restore-db-instance-from-db-snapshot $P \
     --db-instance-identifier db1-sharemechat-test-v2 \
     --db-snapshot-identifier db1-sharemechat-test-v2-final-shutdown-2026-09-10 \
     --db-instance-class db.t3.micro --no-multi-az
   ```
   Esperar `available` y anotar `Endpoint.Address` (cambia respecto al anterior).

2. **EC2 desde AMI** (trae systemd + JAR; arranca solo):
   ```
   aws ec2 run-instances $P --image-id ami-060e74afdc8d7d21c \
     --instance-type t3.medium --subnet-id <subnet PROD> \
     --security-group-ids <sg PROD> --key-name <keypair>
   ```

3. **Elastic IP nueva** (la anterior se liberó):
   ```
   aws ec2 allocate-address $P
   aws ec2 associate-address $P --instance-id <nuevo> --allocation-id <nuevo>
   ```

4. **DNS (Route53, zona `sharemechat.com`)**: `api.test.sharemechat.com` A → nueva IP.

5. **Config del backend**: en `/opt/sharemechat/config.env` actualizar el **endpoint RDS** (cambió); `sudo systemctl restart sharemechat-test.service`; smoke: `401` en `/api/users/me`.

6. **Re-habilitar CloudFront TEST** (`Enabled=true` en E2Q4VNDDWD5QBU público, E28YCPVIRB4ASH admin, E1WZ44LRD39ZAO assets). Si el **origin** de la distribución pública apuntaba a la IP/hostname del backend viejo (origen `api-test-backend`), actualizarlo a la nueva.

7. **Verificar**: `test.sharemechat.com` carga, la API responde, login OK.

**Reversibilidad**: datos 100% preservados; lo único que cambia respecto al estado previo es la **IP pública** (nueva EIP → re-apuntar DNS + origin CloudFront) y el **endpoint RDS** (→ actualizar `config.env`). Coste: al restaurar vuelven los cargos de EC2 + RDS + EIP.

## AUDIT — IDs equivalentes
AMI `ami-0ff1874f4c8ad5f7a` · snapshot `db1-sharemechat-audit-final-shutdown-2026-09-10` · RDS id `db1-sharemechat-audit` · CloudFront E1ILXV7P6ENUV8 (público `audit.sharemechat.com`), E21IB0VBKYNNBW (admin), E2NC4TEJAWOI3L (assets) · DNS `api.audit.sharemechat.com`.
