# README AUDIT BUILD - SHAREMECHAT

## Estado actual

Se ha iniciado la construcción del entorno AUDIT como clon estructural de TEST, pero aislado.

## Certificado ACM

- ARN: `arn:aws:acm:us-east-1:430118829334:certificate/bf74657b-db2f-4227-8a69-28f4052329d2`
- Dominios:
    - `audit.sharemechat.com`
    - `*.audit.sharemechat.com`

## Buckets S3 creados

- `sharemechat-frontend-audit`
- `sharemechat-admin-audit`
- `assets-sharemechat-audit`

Configuración aplicada:
- Block Public Access: activo
- cifrado AES256: activo

## OAC creados

- frontend audit: `E9CNPDX4QA0DA`
- admin audit: `E21PRW32UY6Q6K`
- assets audit: `E1KC2M03HYWYG7`

## CloudFront creados

### Público AUDIT
- Distribution ID: `E1ILXV7P6ENUV8`
- Domain: `d29esb7rgaknry.cloudfront.net`
- Alias: `audit.sharemechat.com`

### Admin AUDIT
- Distribution ID: `E21IB0VBKYNNBW`
- Domain: `d9f1r48ceuajf.cloudfront.net`
- Alias: `admin.audit.sharemechat.com`

### Assets AUDIT
- Distribution ID: `E2NC4TEJAWOI3L`
- Domain: `d1qngef3001u8q.cloudfront.net`
- Alias: `assets.audit.sharemechat.com`

## Route53 creado

- `audit.sharemechat.com` -> `d29esb7rgaknry.cloudfront.net`
- `admin.audit.sharemechat.com` -> `d9f1r48ceuajf.cloudfront.net`
- `assets.audit.sharemechat.com` -> `d1qngef3001u8q.cloudfront.net`

## Security Groups creados

### EC2 AUDIT
- Group ID: `sg-0c4004761f249976f`
- Nombre: `launch-wizard-audit`

Ingress:
- 80 desde `0.0.0.0/0`
- 22 desde `90.175.201.51/32`
- ICMP desde `90.175.201.51/32`
- 443 desde prefix list CloudFront `pl-a3a144ca`

Egress:
- all -> `0.0.0.0/0`

### RDS AUDIT
- Group ID: `sg-0b52bbc8e06eda968`
- Nombre: `rds-ec2-audit`

Ingress:
- 3306 desde `sg-0c4004761f249976f`

## DB Subnet Group creado

- Nombre: `rds-ec2-db-subnet-group-audit`

Subnets:
- `subnet-0fb8eb71fcb35ca25`
- `subnet-0e700a48a5643319b`
- `subnet-07a24ede1fd35042a`

## TEST tomado como referencia

### EC2 TEST
- Instance ID: `i-088341cf8d122920f`
- Name: `Server-Test-Sharemechat`
- Type: `t3.medium`
- Public IP: `63.180.48.12`
- Private IP: `172.31.29.117`
- Subnet: `subnet-0c26def4988099e1b`
- VPC: `vpc-096f6cdfa42ca7ba6`

### RDS TEST
- Identifier: `db1-sharemechat-test-v2`
- Engine: `mysql 8.4.7`
- Class: `db.t3.micro`
- Storage: `20 GB gp2`
- Subnet group: `rds-ec2-db-subnet-group-1`

## Pendiente

- crear RDS AUDIT
- esperar endpoint RDS AUDIT
- crear EC2 AUDIT
- crear `api.audit.sharemechat.com`
- desplegar backend audit
- ajustar `application-audit.properties`
- desplegar frontend product audit
- desplegar frontend admin audit
- validar conectividad end-to-end

## EC2 AUDIT creada

- Instance ID: `i-0d9149cd8a0e24104`
- Name: `Server-Audit-Sharemechat`
- Type: `t3.medium`
- Private IP: `172.31.19.114`
- Public IP: `18.184.208.32`
- Subnet: `subnet-0c26def4988099e1b`
- Security Group: `sg-0c4004761f249976f`

## RDS AUDIT creada

- Identifier: `db1-sharemechat-audit`
- Engine: `mysql 8.4.7`
- Class: `db.t3.micro`
- Endpoint: `db1-sharemechat-audit.c1gsc6qg4l8y.eu-central-1.rds.amazonaws.com`
- Security Group: `sg-0b52bbc8e06eda968`
- DB Subnet Group: `rds-ec2-db-subnet-group-audit`

## DNS backend AUDIT

- `api.audit.sharemechat.com` -> `18.184.208.32`

## Base de datos AUDIT preparada

Se ha creado la base de datos lógica dentro de la instancia RDS AUDIT:

- DB Name: `db1_sharemechat_audit`
- Charset: `utf8mb4`
- Collation: `utf8mb4_unicode_ci`

## Migración de datos TEST → AUDIT

Se ha realizado export/import manual desde TEST a AUDIT:

### Export en EC2 TEST
- fichero generado: `dump.sql`
- tamaño aproximado: ~3.7MB

### Transferencia
- descarga a local mediante `scp`
- subida a EC2 AUDIT mediante `scp`

### Import en EC2 AUDIT
- comando ejecutado:


### Resultado
- estructura y datos replicados correctamente
- validación:
  - `SHOW TABLES` OK
  - datos presentes

## Cliente MySQL alineado

Se ha detectado inconsistencia entre entornos:

- TEST:
  - MySQL client 8.0
- AUDIT:
  - MariaDB client 10.5 (inicialmente)

Acción tomada:

- eliminado MariaDB client en AUDIT
- instalado MySQL Community Client 8.0.45

Resultado:

- ambos entornos alineados
- evita problemas de dump / restore / compatibilidad

## Nginx AUDIT bootstrap

Se ha configurado servidor inicial para:

- dominio: `api.audit.sharemechat.com`
- puerto: `80`
- soporte ACME challenge
- endpoint de test:


## Certificado SSL (Let's Encrypt)

Certificado generado correctamente:

- dominio: `api.audit.sharemechat.com`
- path:
  - `/etc/letsencrypt/live/api.audit.sharemechat.com/fullchain.pem`
  - `/etc/letsencrypt/live/api.audit.sharemechat.com/privkey.pem`
- expiración: 2026-07-09
- renovación automática: activa

## Estado actual AUDIT

Infraestructura completamente operativa a nivel base:

- DNS OK
- CloudFront OK
- S3 OK
- EC2 OK
- RDS OK
- conexión EC2 → RDS OK
- datos replicados desde TEST OK
- SSL OK en backend

## Siguiente fase (inmediata)

- creación `.env` en EC2 AUDIT
- despliegue del `.jar`
- arranque backend con profile `audit`
- ajuste Nginx final (reverse proxy a 8080)
- validación endpoint `/api/*`
- pruebas WebSocket `/match` y `/messages`

## Pendiente

- desplegar backend audit (JAR)
- configurar variables de entorno seguras
- configurar nginx final HTTPS + proxy
- desplegar frontend audit (product + admin)
- validar flujo completo:
  - login
  - match
  - video
  - messaging

## Reimport y saneado final de base de datos AUDIT

Se rehízo correctamente la preparación de la base de datos lógica `db1_sharemechat_audit` en RDS AUDIT.

### Incidencia detectada
La importación inicial no dejó el estado deseado para AUDIT, por lo que se decidió rehacer el proceso de base de datos.

### Actuación realizada
- eliminación de la base lógica `db1_sharemechat_audit`
- recreación con:
  - charset: `utf8mb4`
  - collation: `utf8mb4_unicode_ci`
- reimportación completa de `dump.sql` desde EC2 AUDIT
- validación estructural posterior:
  - `43` tablas importadas correctamente

### Saneado funcional posterior
Tras reimportar la copia de TEST, se realizó un vaciado selectivo de datos operativos manteniendo tablas de catálogo y configuración necesarias para el entorno.

#### Tablas conservadas
- `backoffice_roles`
- `permissions`
- `role_permissions`
- `gifts`
- `kyc_provider_config`
- `model_earning_tiers`

#### Resultado final
La base AUDIT queda con:
- estructura completa replicada desde TEST
- catálogos y configuración base preservados
- datos operativos eliminados

### Verificación final
Datos operativos principales a `0`:
- `users`
- `clients`
- `models`
- `messages`
- `transactions`
- `balances`
- `stream_records`
- `refresh_tokens`
- `accounting_anomalies`

Catálogos/configuración preservados:
- `gifts`: `30`
- `permissions`: `27`
- `backoffice_roles`: `3`
- `role_permissions`: `27`
- `kyc_provider_config`: `1`
- `model_earning_tiers`: `3`

### Estado resultante
Base de datos AUDIT lista como entorno limpio funcional:
- sin usuarios ni actividad histórica
- con esquema completo
- con configuración base mínima necesaria para backend y backoffice