# shareme-aws-context.md — Inventario AWS

Apéndice de identificadores concretos de recursos AWS. No es documentación del proyecto.

**Para contexto funcional de entornos** ver `sharemechat-v1/docs/03-environments/`.
**Para operaciones y runbooks** ver `sharemechat-v1/docs/04-operations/`.

**Región:** `eu-central-1` (Frankfurt) · **Cuenta:** `430118829334` · **Actualizado:** 2026-04-21

---

## EC2

| Entorno | Nombre | Instance ID | IP pública | AZ |
|---|---|---|---|---|
| TEST | Server-Test-Sharemechat | `i-088341cf8d122920f` | `63.180.48.12` (EIP) | eu-central-1a |
| AUDIT | Server-Audit-Sharemechat | `i-0d9149cd8a0e24104` | `18.195.185.25` (EIP) | eu-central-1a |
| PROD | — | — | — | — |

## RDS (MySQL 8.4.7, db.t3.micro, Single-AZ, 20 GB)

| Entorno | Nombre | Endpoint | AZ |
|---|---|---|---|
| AUDIT | `db1-sharemechat-audit` | `db1-sharemechat-audit.c1gsc6qg4l8y.eu-central-1.rds.amazonaws.com` | eu-central-1a |
| TEST | `db1-sharemechat-test-v2` | `db1-sharemechat-test-v2.c1gsc6qg4l8y.eu-central-1.rds.amazonaws.com` | eu-central-1c |
| PROD | — | — | — |

## S3 buckets

**TEST:** `sharemechat-frontend-test`, `sharemechat-admin-test`, `assets-sharemechat-test1`, `sharemechat-storage-test`
**AUDIT:** `sharemechat-frontend-audit`, `sharemechat-admin-audit`, `assets-sharemechat-audit`, `sharemechat-storage-audit`, `sharemechat-cf-logs-audit`
**PROD (parcial):** `sharemechat-landing-prod`, `assets-sharemechat-prod` — faltan `frontend`, `admin`, `storage`, `cf-logs`

## CloudFront

### TEST
| ID | Dominio | Subdominio | Origen |
|---|---|---|---|
| `E2Q4VNDDWD5QBU` | `d38hgrd7fbqsch.cloudfront.net` | `test.sharemechat.com`, `media.test.*`, `www.test.*` | EC2 TEST (api.test) |
| `E28YCPVIRB4ASH` | `d3ml1axp2tpmmv.cloudfront.net` | `admin.test.sharemechat.com` | S3 admin-test |
| `E1WZ44LRD39ZAO` | `d25qzf8rg01we9.cloudfront.net` | `assets.test.sharemechat.com` | S3 assets-test1 |

### AUDIT
| ID | Dominio | Subdominio | Origen |
|---|---|---|---|
| `E1ILXV7P6ENUV8` | `d29esb7rgaknry.cloudfront.net` | `audit.sharemechat.com` | EC2 AUDIT (api.audit) |
| `E21IB0VBKYNNBW` | `d9f1r48ceuajf.cloudfront.net` | `admin.audit.sharemechat.com` | S3 admin-audit |
| `E2NC4TEJAWOI3L` | `d1qngef3001u8q.cloudfront.net` | `assets.audit.sharemechat.com` | S3 assets-audit |

### PROD
| ID | Dominio | Subdominio | Origen |
|---|---|---|---|
| `E2FWNC80D4QDJC` | `dzwmag96rivxf.cloudfront.net` | `sharemechat.com`, `www.sharemechat.com` | S3 landing-prod |
| `E3UAOU6AUNI0CM` | `d99amkbl8rwf7.cloudfront.net` | `assets.sharemechat.com` | S3 assets-prod |

Faltan: `admin.sharemechat.com`, frontend prod.

## Route53

**Hosted Zone:** `sharemechat.com` · ID `Z054470823PMZQENFZHHZ` · 31 registros.
Detalle de registros funcionales por entorno en `docs/03-environments/`.

## Email

- **Transaccional:** Microsoft 365 (MX → `mail.protection.outlook.com`, SPF + DKIM configurados)
- **Fallback SMTP:** `smtp.mail.eu-west-1.awsapps.com:465`
