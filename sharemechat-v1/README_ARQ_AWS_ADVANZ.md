# SharemeChat - Arquitectura AWS (Nivel Técnico / Auditoría)

## 1. Overview

SharemeChat es una plataforma de videochat 1:1 tipo dating (similar a Coomeet / LuckyCrush), basada en:
- Matching en tiempo real
- Streaming WebRTC
- Señalización vía WebSocket
- Backend centralizado (Spring Boot)
- Persistencia en MySQL

Arquitectura desacoplada:
CloudFront → S3 / Backend → RDS

Entornos:
- TEST → plataforma completa operativa
- PROD → landing pública

---

## 2. Topología Global

Usuario → CloudFront → 
    ├── S3 (frontend React)
    └── Backend (EC2 + Nginx + Spring Boot)
            └── RDS MySQL

WebSocket:
Usuario → CloudFront → Backend (/match, /messages)

---

## 3. Dominios

### Público
- test.sharemechat.com
- www.test.sharemechat.com

### Admin
- admin.test.sharemechat.com

### Backend
- api.test.sharemechat.com

### Assets
- assets.test.sharemechat.com
- assets.sharemechat.com

---

## 4. CloudFront (detalle técnico)

### Público TEST

Default:
- Origin: S3 frontend
- CachePolicy: Managed-CachingOptimized

Routing:
- /api/* → backend (no cache)
- /match* → backend
- /messages* → backend
- /uploads/* → backend
- /assets/* → backend

Extras:
- Function: redirect-www-to-root-test
- Error 404 → /index.html (SPA routing)

---

### Admin TEST

Default:
- Origin: S3 admin

Routing:
- /api/* → backend

Policies:
- OriginRequestPolicy custom (auth + CORS headers)
- ResponseHeadersPolicy (CORS + security headers)

Errores:
- 403 → /index.html
- 404 → /index.html

---

### Assets

- Distribución simple
- Origin: S3
- OAC activo
- Cache optimizada

---

## 5. S3

Buckets:
- sharemechat-frontend-test
- sharemechat-admin-test
- assets-sharemechat-test1
- assets-sharemechat-prod

Configuración:
- Block Public Access = true
- Encryption = AES256
- Acceso exclusivo via CloudFront (OAC)

Policy patrón:
- Principal: cloudfront.amazonaws.com
- Condition: AWS:SourceArn = distribución concreta

---

## 6. Seguridad

- HTTPS obligatorio (ACM)
- Certificados wildcard (*.test.sharemechat.com)
- OAC con firma SigV4 (no OAI legacy)
- Backend no expuesto directamente (solo vía CF / subdominio API)
- Sin acceso público a S3

---

## 7. Backend

Infraestructura:
- EC2 (t3.medium)
- Nginx (reverse proxy)
- Spring Boot (Java 17)

Responsabilidades:
- API REST
- Matching (WebSocket /match)
- Mensajería (WebSocket /messages)
- Gestión usuarios, gifts, streams

---

## 8. Base de Datos

- RDS MySQL 8.4
- Tablas principales:
  - users
  - stream_records
  - transactions
  - balances

Persistencia:
- estado de sesiones
- economía (gifts)
- histórico de actividad

---

## 9. Flujo completo (end-to-end)

### Login
1. Cliente → CloudFront
2. CloudFront → Backend (/api/auth)
3. Backend → DB
4. JWT / sesión

### Matching
1. Cliente abre WebSocket (/match)
2. Backend registra usuario en pool
3. Matching con modelo disponible
4. Intercambio signaling WebRTC

### Streaming
1. WebRTC directo peer-to-peer
2. Backend solo señalización

### Mensajería
1. WebSocket (/messages)
2. Backend enruta mensajes
3. Persistencia en DB

---

## 10. Diseño AUDIT (objetivo)

Replica de TEST, aislada:

### Dominios
- audit.sharemechat.com
- admin.audit.sharemechat.com
- api.audit.sharemechat.com
- assets.audit.sharemechat.com

### Infraestructura
- Nuevas distribuciones CloudFront
- Nuevos buckets S3
- Misma configuración (policies, routing, OAC)

### Objetivo
- entorno auditable (PSP, compliance)
- aislamiento de datos
- sin impacto en TEST

---

## 11. Decisiones clave de arquitectura

- CloudFront como entrypoint único → control total de tráfico
- S3 privado + OAC → seguridad fuerte
- separación admin/public → reduce superficie de ataque
- backend único → simplifica lógica y consistencia
- WebSocket centralizado → control de matching

---

## 12. Estado actual

- Infraestructura estable
- Arquitectura coherente
- Lista para:
  - despliegue AUDIT
  - auditoría PSP
  - escalado progresivo

---

## 13. Conclusión

El sistema está en estado:
→ MVP industrial (pre-producción sólida)

Permite:
- escalar horizontalmente
- replicar entornos fácilmente
- cumplir requisitos técnicos de PSP

