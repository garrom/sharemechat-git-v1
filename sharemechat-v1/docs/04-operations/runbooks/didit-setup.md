# Runbook — Activación de Didit (Age + Identity Verification) en un entorno

> Marco: [ADR-035](../../06-decisions/adr-035-age-and-identity-verification-vendor-consolidation-on-didit.md) (vendor único Plan A) + [ADR-029](../../06-decisions/adr-029-age-and-identity-verification-architecture.md) (arquitectura). Procedimiento operativo único, ejecutable por entorno (TEST, AUDIT, PROD). Tiempo estimado total: 30-45 minutos con pausas de validación. Última activación TEST: 2026-06-14 (frente Didit cliente cerrado).

Este runbook cubre la activación de Didit desde el estado "código integrado, MOCK por defecto" hasta "vendor real procesando webhooks". Asume que el código backend Didit (DiditClient, KycSessionService, processDiditWebhook, helpers) ya está en HEAD del repo. Si no, mirar [project-log.md](../../project-log.md) entradas del 2026-06-14 (frente Didit cliente) y 2026-06-19 (frente Didit modelo).

## 1. Pre-requisitos

Antes de empezar, confirmar lo siguiente. Si algo falla, **parar y resolver antes de continuar**.

### Acceso

- Cuenta admin de consola Didit (`https://app.didit.me`). Workspace creado:
  - Sandbox para TEST y AUDIT (el mismo workspace puede servir a ambos).
  - Workspace producción separado para PROD (requiere DPA firmado con Didit, contacto `hello@didit.me`).
- IAM operador con permisos de modificación de `config.env` y `secrets.env` en `/opt/sharemechat/` del EC2 backend del entorno (SSH + `sudo`).
- SSH al EC2 backend del entorno con alias `<env>-backend` (ver [access-and-tooling.md](../access-and-tooling.md)).
- AWS CLI configurado para snapshots RDS si se quiere backup pre-activación (opcional pero recomendado en AUDIT/PROD).

**Esquema dual de ficheros de entorno** (refactor 2026-05-27, project-log:696-722 + 1762-1764). El systemd unit `sharemechat-<env>.service` carga DOS ficheros vía `EnvironmentFile=`:

| Fichero | Permisos | Contenido | Cargado por systemd |
|---|---|---|---|
| `/opt/sharemechat/config.env` | `0644 root:root` | Configuración NO sensible: flags, URLs, IDs públicos, UUIDs de workflows externos, modos operativos. | Sí (primero). |
| `/opt/sharemechat/secrets.env` | `0600 root:root` | Secretos: passwords, API keys, shared secrets HMAC, JWT/CONSENT secrets, SMTP passwords. | Sí (segundo). |

El reparto de las 7 env vars Didit entre ambos ficheros se detalla en §3.2.

### Estado del entorno

- Backend desplegado con el JAR del HEAD del repo (o posterior al commit que introdujo la integración Didit). Comprobar `sha256sum /home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar` contra el manifest del entorno en `ops/deploy-state/<env>.yaml`.
- Schema BD del entorno actualizado vía Flyway al menos a la versión que incluye `V8__rename_model_kyc_sessions_to_kyc_sessions.sql` y `V9__add_client_kyc_fields.sql`. Verificar con:
  ```
  SELECT version, description FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 3;
  ```
- `PRODUCT_ACCESS_MODE=OPEN` en `/opt/sharemechat/config.env` (deuda P10 del proyecto). Si está en `PRELAUNCH`, activar Didit no rompe nada, pero los flujos E2E no podrán ejecutarse hasta levantar el modo.
- Frontend desplegado a la misma altura del HEAD repo (las páginas `/client-kyc`, `/client-kyc/processing`, `/model-kyc-didit`, `/model-kyc-didit/processing` y los dashboards con gates `ensureClientKycApproved` y `handleActivateCamera` deben estar en el bundle activo). Verificar contra `ops/deploy-state/<env>.yaml` bloques `frontend_product` y `frontend_admin`.

## 2. Pasos en consola Didit (operador en navegador)

Estos pasos los ejecuta el operador con sesión iniciada en `https://app.didit.me`. **Ningún valor sensible se captura en chat ni se commitea al repo**. Los valores se anotan localmente y se inyectan en el paso 3 vía stdin.

### 2.1 Workspace

- TEST + AUDIT: workspace sandbox compartido. Si el workspace TEST ya está activo (`shareme-test-kyc` destino webhook existente), AUDIT reutiliza credenciales del mismo workspace y solo crea su propio destino webhook en el paso 2.4.
- PROD: workspace producción separado. Requiere DPA firmado con Didit. Una vez creado, regenerar **todos** los IDs/keys siguientes (los del sandbox no se reutilizan en PROD).

### 2.2 API Key

Captura desde "API Settings" (o equivalente en la consola Didit) la API key del workspace. Es una cadena alfanumérica que aplica a todas las requests `POST /v3/session/`. **Una sola key por workspace**: se reutiliza entre cliente y modelo.

→ Anotar para `KYC_DIDIT_API_KEY` del paso 3.

### 2.3 Workflows

Confirmar o crear en "Workflow Builder" los dos workflows del proyecto. Si reutilizas workspace sandbox compartido con TEST, los UUIDs son los mismos:

| Workflow | Tipo | UUID (sandbox compartido TEST/AUDIT) |
|---|---|---|
| `shareme-client-age` | Adaptive Age Verification (Age Estimation primaria + Liveness Pasivo plan gratuito + step-up documental opcional) | `59af04f3-3bb9-44d1-ae7a-853e41034f0d` |
| `shareme-model-kyc` | Document + Selfie + Liveness | `57f2d4b6-02f7-497a-a3df-fad6bb9fe830` |

**Configuración obligatoria en consola Didit**:
- `shareme-client-age` con **modo privacidad facial DESACTIVADO** (lección del frente Didit cliente del 2026-06-14: cámara borrosa con privacidad activa, nítida sin ella).
- Minimización GDPR aplicada en datos devueltos (mínimo Age Estimation + score, sin metadatos personales innecesarios).

→ Anotar UUIDs para `KYC_DIDIT_CLIENT_WORKFLOW_ID` y `KYC_DIDIT_MODEL_WORKFLOW_ID` del paso 3.

### 2.4 Destino webhook (por entorno)

Cada entorno tiene su propio destino webhook. Crear en consola Didit la sección "Webhooks" (a nivel proyecto, no a nivel workflow):

| Campo | Valor |
|---|---|
| Nombre | `shareme-<env>-kyc` (ej. `shareme-audit-kyc`) |
| URL | `https://<env>.sharemechat.com/api/kyc/didit/webhook` (TEST/AUDIT) o `https://sharemechat.com/api/kyc/didit/webhook` (PROD) |
| Workflows asociados | `shareme-client-age` + `shareme-model-kyc` (el mismo destino sirve ambos; el backend discrimina por `workflow_id` del payload) |
| Eventos suscritos | `status.updated` (único evento que el handler espera) |

Tras guardar, Didit genera un `secret_shared_key` único para ese destino. Capturarlo. **NO se reutiliza entre entornos** (cada destino genera su propio secret).

→ Anotar para `KYC_DIDIT_API_SECRET` del paso 3 (a pesar del nombre, esta key es el secret HMAC del destino webhook, no la API key del workspace).

## 2.5 Configuración del workflow por entorno

El workspace Didit puede compartirse entre TEST y AUDIT (sandbox) pero PROD requiere workspace separado. Los workflows pueden tener módulos distintos por entorno según las necesidades de compliance.

### Workflow `shareme-model-kyc`

**Módulos base (los 4, activos en TEST/AUDIT/PROD)**:

- **Verificación de ID** (500 gratis/mes, luego $0.15): OCR + template match + hologramas + portrait integrity.
- **Prueba de vida** (Passive Liveness iBeta L1, $0.10).
- **Coincidencia facial** (face match selfie ↔ documento, $0.05).
- **Análisis de dispositivo e IP** ($0.03).

Coste base por sesión: **$0.00 – $0.33** (gratis dentro del cupo 500/mes, $0.33 después).

**Módulos adicionales recomendados SOLO en PROD**:

- **Validación en base de datos** (variable): valida contra registros oficiales gubernamentales del país emisor del documento (DGT España, etc.). **Crítico para compliance regulatorio adulto-content**. Activar al menos para España.
- **Verificación NFC** ($0.15): lectura del chip NFC del DNI 4.0 / pasaporte electrónico. Más fiable que OCR. Recomendable para modelos cuyos documentos lo soporten.

**Módulos NO recomendados para SharemeChat**:

- Detección AML, Verificación de dirección: no aplicables (SharemeChat no es fintech, no requiere prueba de domicilio).
- Verificación de correo: SharemeChat ya tiene email verification propia ([`EmailVerificationService`](../../../src/main/java/com/sharemechat/service/EmailVerificationService.java)).

### Workflow `shareme-client-age`

**Configuración única** (TEST/AUDIT/PROD igual):

- **Age Estimation Adaptive**: IA estima edad por selfie, con step-up a documento si la confidence baja.
- **Passive Liveness**.

Sin Database Validation ni NFC: el flujo cliente no requiere identificación nominal, solo confirmación de edad ≥ 18.

### Restricciones por país

En PROD restringir la lista de países permitidos del workflow a los mercados objetivo de SharemeChat (verificar con marketing/legal). Documentar la lista final en el ADR del frente PROD cuando se ejecute.

### Workspace separation

| Entorno | Workspace Didit | API Key |
|---|---|---|
| TEST | Sandbox compartido | Compartida con AUDIT |
| AUDIT | Sandbox compartido | Compartida con TEST |
| PROD | Workspace "Producción" separado | Única PROD |

**DPA firmado con Didit obligatorio antes de aprovisionar el workspace PROD** (contacto `hello@didit.me`).

## 3. Pasos en backend (operador o agente con SSH al EC2)

### 3.1 Backup proactivo (recomendado en AUDIT/PROD)

```
aws rds create-db-snapshot \
  --db-instance-identifier db1-sharemechat-<env> \
  --db-snapshot-identifier didit-activation-pre-$(date -u +%Y%m%d-%H%M%S)
```

Coste mínimo (almacenamiento RDS). Si no se puede por permisos IAM del operador, registrar en chat y continuar (los datos KYC son nuevos, sin downside catastrófico).

Backup de los dos ficheros activos:
```
ssh <env>-backend 'TS=$(date -u +%Y%m%d-%H%M%S); sudo cp /opt/sharemechat/config.env  /opt/sharemechat/config.env.bak.pre-didit-activation-$TS && sudo cp /opt/sharemechat/secrets.env /opt/sharemechat/secrets.env.bak.pre-didit-activation-$TS'
```

### 3.2 Inyección de env vars Didit (reparto dual)

**Higiene de credenciales** (CLAUDE.md sección "Convenciones de código y operación"): los secretos viajan únicamente por stdin/heredoc, nunca por argv, ni a disco persistente local, ni al chat, ni a logs, ni al historial de shell. Las 7 env vars Didit se reparten entre `config.env` (5 no-sensibles) y `secrets.env` (2 sensibles) según la tabla de §1.

#### 3.2.a Bloque NO sensible en `config.env` (0644)

UUIDs públicos de workflows (visibles en la URL del navegador del usuario al hacer KYC), flags y callback URLs públicas. Heredoc seguro aunque los valores no son secretos:

```
ssh <env>-backend 'sudo tee -a /opt/sharemechat/config.env > /dev/null' <<'EOF'

# --- Didit (no-sensible) ---
KYC_DIDIT_ENABLED=true
KYC_DIDIT_MODEL_WORKFLOW_ID=<UUID del workflow shareme-model-kyc, paso 2.3>
KYC_DIDIT_CLIENT_WORKFLOW_ID=<UUID del workflow shareme-client-age, paso 2.3>
KYC_DIDIT_MODEL_CALLBACK_URL=https://<env>.sharemechat.com/model-kyc-didit/processing
KYC_DIDIT_CLIENT_CALLBACK_URL=https://<env>.sharemechat.com/client-kyc/processing
EOF
```

Tras la inyección, confirmar perms intactos:
```
ssh <env>-backend 'sudo stat -c "%a %U:%G %n" /opt/sharemechat/config.env'
```
Esperado: `644 root:root /opt/sharemechat/config.env`.

#### 3.2.b Bloque SENSIBLE en `secrets.env` (0600)

API key del workspace + secret HMAC del destino webhook. Heredoc obligatorio para no pasar valores por argv ni dejarlos en historial:

```
ssh <env>-backend 'sudo tee -a /opt/sharemechat/secrets.env > /dev/null' <<'EOF'

# --- Didit (sensible) ---
KYC_DIDIT_API_KEY=<workspace API key, paso 2.2>
KYC_DIDIT_API_SECRET=<webhook secret_shared_key, paso 2.4>
EOF
```

Tras la inyección, confirmar perms intactos:
```
ssh <env>-backend 'sudo stat -c "%a %U:%G %n" /opt/sharemechat/secrets.env'
```
Esperado: `600 root:root /opt/sharemechat/secrets.env` (en TEST puede ser `600 ec2-user:ec2-user` por su arranque manual sin systemd, asimetría consciente — project-log:1764).

Notas comunes a ambos bloques:
- Heredoc `<<'EOF'` con comillas simples: impide expansión `$VAR`/backticks/glob, preserva el valor literal.
- `sudo tee -a` anexa sin sobrescribir y no muestra el payload por stdout (`> /dev/null`); el historial del shell local solo guarda la línea `ssh ... <<'EOF'`, NO el payload.
- Ni `config.env` ni `secrets.env` se commitean al repo (`.gitignore` + gobernanza, `access-and-tooling.md`:140-156).
- `KYC_DIDIT_CALLBACK_URL` legacy NO es necesario si las dos callback URLs específicas están pobladas; cae al fallback automáticamente si falta una (helpers `getEffective*CallbackUrl` en `DiditProperties`).

### 3.3 Restart del servicio backend

```
ssh <env>-backend 'sudo systemctl restart sharemechat-<env>.service && sleep 30 && sudo systemctl show sharemechat-<env>.service -p MainPID,ActiveState,ExecMainStartTimestamp'
```

Esperar a que `ActiveState=active` y `MainPID` cambie respecto al previo.

### 3.4 Verificar logs limpios

```
ssh <env>-backend 'sudo journalctl -u sharemechat-<env> --since "<timestamp del restart>" --no-pager | grep -E "Started SharemechatV1Application|ERROR|Exception" | grep -v "SpringApplicationShutdownHook" | head -10'
```

Esperado: `Started SharemechatV1Application in NN seconds`, 0 ERROR/Exception (salvo el warning conocido de Flyway sobre MySQL 8.4).

## 4. Verificación post-config

### 4.1 Env vars cargadas en el proceso vivo (filtración preventiva)

**Regla anti-transcripción** (lección permanente del incidente SMTP_PASSWORD/DB_PASSWORD, project-log:702-722 + 770-783): cualquier inspección de variables del proceso vivo debe enmascarar el valor antes de mostrarlo. NUNCA `cat` un `secrets.env` directo. El `sed "s/=.*$/=<set>/"` debe estar SIEMPRE en el pipeline.

```
ssh <env>-backend 'sudo cat /proc/<MainPID>/environ | tr "\0" "\n" | grep -E "^KYC_DIDIT_" | sed "s/=.*$/=<set>/" | sort'
```

Esperado (7 líneas en orden alfabético):
```
KYC_DIDIT_API_KEY=<set>
KYC_DIDIT_API_SECRET=<set>
KYC_DIDIT_CLIENT_CALLBACK_URL=<set>
KYC_DIDIT_CLIENT_WORKFLOW_ID=<set>
KYC_DIDIT_ENABLED=<set>
KYC_DIDIT_MODEL_CALLBACK_URL=<set>
KYC_DIDIT_MODEL_WORKFLOW_ID=<set>
```

Si se necesita inspeccionar los ficheros origen directamente (NO recomendado salvo diagnóstico), aplicar el filtro de saneado de project-log:714-722 antes de mostrar contenido:

```
ssh <env>-backend 'sudo grep -vE "^(SMTP_PASSWORD|DB_PASSWORD|JWT_SECRET[_A-Z]*|CONSENT_SECRET[_A-Z]*|AUTHRISK_EMAIL_HASH_SALT|EMAIL_GRAPH_CLIENT_SECRET|WEBRTC_TURN_CREDENTIAL|WEBRTC_TURN_USERNAME|REDIS_PASSWORD|MAIL_PASSWORD|KYC_DIDIT_API_KEY|KYC_DIDIT_API_SECRET|KYC_VERIFF_API_KEY|KYC_VERIFF_API_SECRET)=" /opt/sharemechat/secrets.env'
```

La lista de keys filtradas crece con cada vendor nuevo; mantenerla sincronizada con el contenido real de `secrets.env`.

### 4.2 Smokes endpoints (sin auth)

```
curl -s -o /dev/null -w "GET / -> %{http_code}\n" https://<env>.sharemechat.com/
curl -s -o /dev/null -w "GET /api/users/me sin auth -> %{http_code}\n" https://<env>.sharemechat.com/api/users/me
```

Esperado: `200` y `401` respectivamente.

### 4.3 kyc_provider_config bootstrap

```
SELECT provider_key, active_mode, enabled FROM kyc_provider_config;
```

Esperado: una fila `MODEL_ONBOARDING / DIDIT / 1`. Si no existe, el service `KycProviderConfigService.getOrCreateModelOnboardingConfig` la crea con default `MODE_DIDIT` en el primer arranque tras V8+V9 aplicadas (frente Didit modelo paso 1, commit `3537c25`).

### 4.4 Smoke webhook negativo (firma falsa)

```
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<env>.sharemechat.com/api/kyc/didit/webhook \
  -H "X-Signature: fake-not-hex" \
  -H "X-Timestamp: $(date +%s)" \
  -H "Content-Type: application/json" \
  -d '{"event_id":"smoke-fake"}'
```

Esperado: `401`. Verificar persistencia en BD:
```
SELECT id, provider, is_signature_valid, processing_error_message FROM kyc_webhook_events ORDER BY id DESC LIMIT 1;
```

Esperado: fila con `provider=DIDIT`, `is_signature_valid=0`, `processing_error_message="invalid_signature"`.

## 5. Validación E2E (opcional pero recomendada)

Antes de declarar el entorno productivo para Didit, validar un flujo end-to-end con un user de test específico del entorno. **NO reutilizar cuentas Segpay o cuentas con tráfico monitorizado**: crear `demo+<env>_didit_test_1@sharemechat.com` nuevo.

### 5.1 Flujo cliente (Activar cámara → KYC → matching)

1. Registro como cliente vía `/register-client` o equivalente. Email `demo+<env>_didit_test_1@sharemechat.com`.
2. Verificar email clicando el link real recibido.
3. Login → `/dashboard-user-client` → click "Activar cámara".
4. Frontend gate (`ensureClientKycApproved` en `handleActivateCamera`) detecta `client_kyc_status=NULL` → redirect a `/client-kyc?return=/dashboard-user-client`.
5. Aceptar consentimiento biométrico GDPR Art. 9.2.a → POST `/api/kyc/didit/client/start` → backend devuelve `verificationUrl` de Didit.
6. Completar el flujo dummy en móvil con un documento real (el operador usa su propio DNI/pasaporte; Didit sandbox no exige documento de identidad real).
7. Didit redirige el navegador a `https://<env>.sharemechat.com/model-kyc-didit/processing` (la callback URL del body, no la consola).

Para el flujo cliente la URL es `/client-kyc/processing`. Polling del `clientKycStatus` cada 3s detecta APPROVED → redirige a `/dashboard-user-client`.

8. Click "Activar cámara" otra vez → gate no-op → cámara real activa → click "Buscar" → matching exitoso con un modelo verificado.

Verificar en BD:
```
SELECT id, user_id, session_type, kyc_status FROM kyc_sessions WHERE user_id=<id>;
SELECT id, role, user_type, client_kyc_status FROM users WHERE id=<id>;
```

### 5.2 Flujo modelo (registro → KYC → admin promueve)

1. Registro como modelo `demo+<env>_didit_model_1@sharemechat.com` (`user_type=FORM_MODEL`).
2. Verificar email.
3. Login → `/dashboard-user-model` → aceptar contrato → click "Iniciar verificación de identidad" → `/model-kyc-didit`.
4. Consentimiento + flujo Didit + APPROVED → callback `/model-kyc-didit/processing` → polling del `verificationStatus` → vuelta al dashboard en bucket `awaiting-admin`.
5. Login con cuenta admin del entorno (en AUDIT: `operations+admin@sharemechat.com`) → AdminModelsPanel → localizar al user → click "Promover a MODEL" → user pasa a `role=MODEL`.

## 6. Histórico de activaciones por entorno

Esta tabla se actualiza tras cada activación o desactivación de Didit en un entorno. Mantener cronológica con la más reciente arriba.

| Entorno | Fecha activación | Commit JAR desplegado | Workspace Didit | Destino webhook | Particularidades |
|---|---|---|---|---|---|
| AUDIT | 2026-06-20 | `5419c80` (JAR base) + sub-frentes A (endpoint `/api/kyc/sessions/me/latest` + UX modelo) y B (admin REPEAT action) integrados en el commit de cierre del megafrente (ver `project-log.md` 2026-06-20) | sandbox compartido con TEST | `shareme-audit-kyc` (creado por el operador en consola Didit, asociado a ambos workflows, suscrito a `status.updated`) | Workspace sandbox reutilizado: workflow UUIDs y `KYC_DIDIT_API_KEY` propagados desde TEST vía pipeline `ssh test-backend \| ssh audit-backend tee` (técnica T1 documentada en [`incident-notes.md:2196`](../incident-notes.md)). `KYC_DIDIT_API_SECRET` AUDIT específico (cada destino webhook genera su propio `secret_shared_key`). **Esquema dual aplicado correctamente desde el día 1**: 5 vars no-sensibles (`ENABLED`, `MODEL/CLIENT_WORKFLOW_ID`, `MODEL/CLIENT_CALLBACK_URL`) en `config.env` (0644), 2 sensibles (`API_KEY`, `API_SECRET`) en `secrets.env` (0600). Corrige en AUDIT la deuda P21 (en TEST `KYC_DIDIT_API_KEY` quedó en `config.env` por historia, pendiente de mover en próxima ventana). Flyway aplicó V8/V9/V10 automáticamente al arrancar (schema TEST estaba V7). P15 (email modelo tras admin APPROVE/REJECT/REPEAT) implementado durante el frente. Sub-frente A (UX modelo): dashboard reorganizado Contrato→KYC, sub-bucket `kyc-in-progress` gated por backend (no por sessionStorage), pill compacta "Esperando revisión" en awaiting-admin. Sub-frente B (REPEAT): admin puede pedir al modelo repetir verificación → reset `verification_status=NULL` + cancel última `kyc_session MODEL` (`kyc_status=CANCELLED`) + email REPEAT genérico. Validación E2E completa con 3 users de prueba (`demo+trial` cliente, `demo+modeldidit1` ciclo REPEAT, `demo+modeldidit2` promote-to-MODEL). `PRODUCT_REGISTRATION_MODEL_ENABLED` abierto temporalmente durante validación, revertido a `false` al cierre. |
| TEST | 2026-06-14 | `70ca63e` (frente Didit cliente paso 2) | sandbox | `shareme-test-kyc` | Workflow `shareme-client-age` UUID `59af04f3-…034f0d`. Workflow `shareme-model-kyc` UUID `57f2d4b6-…fbe830`. Un solo destino webhook sirve ambos workflows. Modo privacidad facial DESACTIVADO en `shareme-client-age` tras lección operativa (cámara borrosa con privacidad activa). Sucesivos refinos: paso 2-bis del frente Didit modelo (commit `6ee8ee5`, 2026-06-19) añade `KYC_DIDIT_MODEL_CALLBACK_URL` y `KYC_DIDIT_CLIENT_CALLBACK_URL` separadas en config.env. Gate WS sub-frente videochat (commit `fb8744e`, 2026-06-20). Hardening P1 idempotencia (commit `3680f2f`, 2026-06-20) sin redeploy aún. |

## 7. Anexos

### 7.1 Variables KYC_DIDIT_* — referencia

| Variable | Propósito | Origen | Fichero |
|---|---|---|---|
| `KYC_DIDIT_ENABLED` | `true` activa el cliente real; `false` (default) → modo MOCK (`didit_mock_<UUID>`). | Decisión operativa. | `config.env` |
| `KYC_DIDIT_BASE_URL` | Base URL del API Didit. Default `https://verification.didit.me`. | No requiere override salvo cambio Didit. | `config.env` (si se overridea) |
| `KYC_DIDIT_API_KEY` | Cabecera `x-api-key` del POST a Didit. | Workspace Didit, sección API Settings. | **`secrets.env`** |
| `KYC_DIDIT_API_SECRET` | Secret HMAC del destino webhook (NO el API key). Verifica webhooks entrantes. | Destino webhook en consola Didit, generado al crear. | **`secrets.env`** |
| `KYC_DIDIT_MODEL_WORKFLOW_ID` | UUID del workflow modelo. | Workflow Builder Didit. | `config.env` |
| `KYC_DIDIT_CLIENT_WORKFLOW_ID` | UUID del workflow cliente Age Estimation. | Workflow Builder Didit. | `config.env` |
| `KYC_DIDIT_MODEL_CALLBACK_URL` | Redirect del navegador tras flujo modelo (página polling). | Convención: `https://<env>.sharemechat.com/model-kyc-didit/processing`. | `config.env` |
| `KYC_DIDIT_CLIENT_CALLBACK_URL` | Redirect del navegador tras flujo cliente. | Convención: `https://<env>.sharemechat.com/client-kyc/processing`. | `config.env` |
| `KYC_DIDIT_CALLBACK_URL` (legacy) | Fallback si las dos específicas están vacías. NO necesario si las dos arriba están pobladas. | Default en `application-<env>.properties` apuntando a `/api/kyc/didit/webhook`. | `config.env` (si se overridea) |

### 7.2 Desactivación

Para volver a modo MOCK (sin desactivar el código Didit ni revertir migrations):
1. `sudo sed -i 's|^KYC_DIDIT_ENABLED=true|KYC_DIDIT_ENABLED=false|' /opt/sharemechat/config.env` (backup previo siempre).
2. Restart del servicio. El `DiditClientImpl.createSession` detecta `!enabled || apiKey blank` y devuelve `didit_mock_<UUID>` sin llamar al exterior.

Los webhooks entrantes (si llegan retries de Didit reales) se rechazarán con `invalid_signature` porque el handler valida HMAC en todo caso. Sin riesgo.

### 7.3 Rollback en caso de fallo durante la activación

1. Restaurar AMBOS ficheros desde los backups `pre-didit-activation-<UTC>`:
   ```
   ssh <env>-backend 'sudo cp /opt/sharemechat/config.env.bak.pre-didit-activation-<UTC>  /opt/sharemechat/config.env && sudo cp /opt/sharemechat/secrets.env.bak.pre-didit-activation-<UTC> /opt/sharemechat/secrets.env'
   ```
2. Restart del servicio. Backend vuelve a MOCK Didit.
3. Si el JAR se desplegó nuevo y Flyway aplicó migrations: los cambios de schema persisten (V8 V9 V10 son aditivos, no destructivos). NO hace falta rollback de schema.
4. Si por algún motivo crítico hay que volver al JAR previo: restaurar el `.jar.bak.pre-didit-activation-<UTC>` y restart. Schema queda más adelantado que el JAR, pero el código viejo no usa las nuevas columnas (campos NULL en filas viejas).
