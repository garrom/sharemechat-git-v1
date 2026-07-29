# ADR-056 — Sistema Master/Studio para captación de estudios de webcam

> Estado: VIGENTE
> Fecha: 2026-07-29
> Vigencia esperada: hasta que el volumen real de estudios captados permita renegociar % PSP y/o aparezca un frente estructural nuevo (ej. modelo "big studios enterprise" con contrato negociado, extensión Master a modelos, o pivote de mercado geográfico).
> Reemplaza parcialmente: [ADR-052](adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D1 (%reparto 75-79%) y §D5 (umbrales tramos 3.500/5.000/6.500 EUR). Los umbrales y porcentajes ADR-052 se sobrescriben por los de este ADR (D3). El resto de ADR-052 (motor unificado en `StreamService.endSession`, `chosen_rate_eur_per_min` autoservicio modelo, primer minuto trial plano, snapshot diario rolling 30d, retirada afiliadas) queda vigente.
> Ver también: [ADR-046](adr-046-panel-soporte-humano.md), [ADR-051](adr-051-psp-puente-cripto-nowpayments.md), [ADR-052](adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md), [ADR-054](adr-054-sistema-tickets-incidencias.md), [`../01-business/sistema-tiers-modelos.md`](../01-business/sistema-tiers-modelos.md), [`../01-business/pricing.md`](../01-business/pricing.md).

## Estado

Aceptada. Cero implementación en esta iteración. La materialización técnica (migration V42 + entities + servicios + endpoints + frontend + rails payout) se planifica en 8 fases S1-S8 detalladas al final del ADR, ejecutables en 4-6 sesiones dedicadas.

## Contexto

Al cierre de este ADR el proyecto ha completado el rediseño estructural del reparto (ADR-052 sub-frente 3 técnico, migraciones V39-V40, servicios `ModelTierService`+`PricingService`, endpoints `/api/models/me/economics|pricing|pro-status`, motor `StreamService.endSession` unificado). El régimen económico vigente:

- Modelo individual: 75 % → 79 % escalonado por facturación bruta rolling 30d (umbrales 0/3500/5000/6500 €). SharemeChat retiene 21-25 %.
- Trial primer minuto: 0,07 €/min plano (plataforma absorbe coste).
- Gifts P2P: 90 % modelo (fijo, independiente tramo).

La captación de modelos individuales **no ha funcionado** en 6 meses de esfuerzo comercial. El motivo NO es económico (el 75-79 % ya es 2× lo que ofrece LiveJasmin al broadcaster de tier top). El motivo es **de acceso**: llegar a modelos individuales requiere navegación por canales adult adyacentes (r/adultwork, plataformas competencia, agregadores talent) donde el mensaje comercial se percibe como sospechoso ("¿es un moderador de otra plataforma haciendo trampa? ¿un scam?"). Prueba directa del operador: registro como cliente en Coomeet + oferta directa a modelos → 0 conversiones, patrón "desconfían, cierran chat".

Pivote estratégico decidido 2026-07-29: **captar estudios de webcam en lugar de modelos individuales**. Especialmente estudios colombianos (mercado ~$1B/año, ~400.000 modelos activas en Colombia según investigación ICIJ 2024, ecosistema profesionalizado con canales B2B ya establecidos). Cada estudio captado aporta entre 5 y 15 modelos ya entrenadas, con equipamiento, con horario, con supervisión — resuelve el problema de acceso a la modelo individual convirtiéndolo en acceso a un decisor B2B.

Realidad del mercado colombiano (fuente ICIJ 2024): la modelo neto queda con ~10-15 % del bruto tras el corte del estudio (~40-50 % del bruto) y de la plataforma (~50 % en LiveJasmin/BongaCams). En LiveJasmin oficial, el broadcaster (individual o estudio) cobra según 9 niveles escalonados: L1 30 % (0-500 €/30d), L3 40 % (1.000-2.000 €), L5 50 % (4.000-8.000 €), L7 65 % (15.000-30.000 €), L9 80 % (60.000+). El reparto interno estudio↔modelo es opaco a LiveJasmin, contrato privado, típicamente 60-75 % para el estudio del bruto que recibe.

Con ese contexto, el diseño Master/Studio de SharemeChat debe: (a) ser competitivo frente a LJ/BongaCams para captar el estudio, (b) mantener la propuesta agresiva a modelos individuales para no perder ese vector, (c) ser sostenible económicamente para SharemeChat (nunca cobrar menos de 30 % del bruto), (d) alinear con GDPR/Estonia + AML + 2257 al añadir un tercer actor (Master) al triángulo modelo↔plataforma↔cliente.

Al cierre de este ADR: **cero primitivas técnicas de Master/Studio en el código** (verificado por grep exhaustivo — cero ocurrencias `STUDIO`/`MASTER`/`AGENCY`/`UMBRELLA` en Java, SQL, properties; las menciones en docs son estratégicas/comerciales, no técnicas — hoy se tratan estudios off-platform con contabilidad manual, `docs/01-business/launch-strategy.md:65`). Es diseño desde cero, ventaja no despreciable.

Contexto operativo relevante: **4 clientes registrados** al momento de este ADR con incorporaciones semanales lentas. La introducción de Master no debe romper su experiencia. Cliente no interactúa con Master en ningún punto — la modelo bajo Master aparece con su alias público estándar, indistinguible.

## Análisis previo

### Mapeo del código actual afectado

Cambios estructurales al entorno económico existente (todos vigentes tras ADR-052):

- **Tabla `model_pricing_tiers`** ([V39__model_pricing_tiers_v1.sql:26-46](../../src/main/resources/db/migration/V39__model_pricing_tiers_v1.sql), luego V40 rename): 4 filas T1-T4. Este ADR **sobrescribe umbrales y porcentajes** (D3) y **añade columna `target_type ENUM('INDIVIDUAL','MASTER')`** para regímenes duales (D2).
- **Motor reparto `StreamService.endSession`** ([`StreamService.java:717-840`](../../src/main/java/com/sharemechat/service/StreamService.java)): reparto `cost × modelSharePct / 100` con tramo resuelto vía `resolveEffectiveTierForPayout(modelId)`. Este ADR extiende la resolución para detectar si `modelId` tiene `master_user_id != NULL` y en tal caso: (a) calcular tramo sobre bruto agregado del Master, (b) usar régimen `target_type=MASTER`, (c) atribuir `STREAM_EARNING` al Master (`user=master`) con nota `attributed_model_id`.
- **Motor trial `UserTrialService.closeTrialStreamAndSettle`** ([`UserTrialService.java:346-451`](../../src/main/java/com/sharemechat/service/UserTrialService.java)): trial 0,07 €/min plano no se altera. Cuando la modelo trial tiene Master, el `TRIAL_EARNING` va al Master (mismo patrón que STREAM_EARNING).
- **`ModelTierService.computeAndUpsertSnapshot`** ([`ModelTierService.java:121`](../../src/main/java/com/sharemechat/service/ModelTierService.java)): hoy calcula bruto por modelo individual. Extiende para: si `master_user_id != NULL`, calcular snapshot a nivel Master agregando todas sus modelos activas.
- **`users` + `models` schema**: añadir `models.master_user_id BIGINT NULL FK users(id)` + índice.
- **`Constants.Roles`** ([`Constants.java:9-20`](../../src/main/java/com/sharemechat/constants/Constants.java)): añadir `MASTER = "MASTER"`.
- **`KycSessionService`**: añadir método `startDiditMasterSession(userId)` análogo a `startDiditModelSession`, + `Constants.KycSessionTypes.MASTER`.
- **`ModelContractService` + `ModelContractManifestService`**: patrón replicable para `MasterContractService` (PDF en S3 versionado + manifest + sha256 + tabla `master_contract_acceptances`).
- **`payout_requests` + servicio en `TransactionService`**: hoy 1 rail implícito. Extender con `payout_methods` para multi-rail + adaptar validaciones per-rail.
- **`SecurityConfig`** matchers: nuevos `/api/masters/**` con role MASTER; `/api/admin/masters/**` con ADMIN.

### Referencias sectoriales que informan las decisiones

- LiveJasmin — 9 niveles oficiales L1-L9 con umbrales $250/500/1000/2000/4000/8000/15000/30000 pay period 15d (fuente [LJ Wiki Level Dependent Payment System](https://livejasminwiki.com/level-dependent-payment-system/)). Umbrales SharemeChat T1-T4 elegidos en L1/L3/L5/L7 equivalente mensual EUR (0/1.000/4.000/15.000 €).
- LiveJasmin — reset de nivel cada 15 días. SharemeChat mantiene rolling 30d sin reset (más estable, no penaliza quincenas malas). ADR-052 §D6.
- LiveJasmin — Master ve stats + KYC status pero NO PII de sus modelos (fuente [LJ Model Center Wiki](https://livejasminwiki.com/model-center/): *"Personal details (real name, date of birth, ID number) are not visible in the Model Center after registration"*). SharemeChat alinea con esa política (D9).
- Stripchat — "Account Holder" feature 2024 para group accounts. Alineación conceptual pero SharemeChat elige entidad Master separada del modelo, no "cuenta grupo".
- Chaturbate — sin cuenta studio formal; estudio usa cuenta broadcaster estándar. SharemeChat rechaza este modelo (menos control operativo, difícil aplicar régimen económico dual).
- Realidad colombiana ICIJ 2024 — modelo neto ~10-15 %. SharemeChat con reparto interno Master↔modelo 50/50 daría modelo neto ~25-30 %, sustancialmente superior. Es el gancho vs competencia para atraer estudios que quieran diferenciarse ofreciendo mejor % a sus modelos.

## Decisiones

### D1 — Rol MASTER como entidad de dominio propia (tabla `masters` 1-a-1 con `users`)

Master es un actor con identidad propia (persona física, opcionalmente representante empresa), no un concepto abstracto agrupador. Encaja como rol nuevo en `Constants.Roles.MASTER = "MASTER"` + tabla `masters` 1-a-1 con `users` (patrón simétrico a `models` y `clients`). Reutiliza toda la infra existente (KYC, contrato, auth, sesión).

Alternativa descartada: entidad `agencies` desacoplada de `users` (crearía dominio paralelo, complicaría permisos, dashboards, auth).

### D2 — Reparto económico dual (INDIVIDUAL vs MASTER)

Régimen económico distinto para modelo individual (sin `master_user_id`) vs modelo bajo Master (con `master_user_id != NULL`). Justificación: apuesta estratégica hacia estudios requiere ventaja competitiva explícita al Master; premiar el volumen agregado que el estudio aporta es el gancho comercial principal.

Tabla `model_pricing_tiers` gana columna `target_type ENUM('INDIVIDUAL','MASTER')`. Vigencia versionada preservada por `effective_from/effective_to`.

### D3 — Tabla de tramos post-ADR-056 (sobrescribe ADR-052)

Umbrales absolutos idénticos entre INDIVIDUAL y MASTER (motor de tramos unificado, código simple). Escalado agregado por Master (D4). Umbrales inspirados en LiveJasmin oficial (L1/L3/L5/L7 equivalente EUR/30d).

**INDIVIDUAL**:
| tier_code | min_billed_gross_eur_30d | model_share_pct | rate_min | rate_max |
|-----------|--------------------------|-----------------|----------|----------|
| T1 | 0 | **50,00** | 1,00 | 1,00 |
| T2 | 1.000 | **54,00** | 1,00 | 3,00 |
| T3 | 4.000 | **57,00** | 1,00 | 6,00 |
| T4 | 15.000 | **60,00** | 1,00 | 9,00 |

**MASTER**:
| tier_code | min_billed_gross_eur_30d | model_share_pct | rate_min | rate_max |
|-----------|--------------------------|-----------------|----------|----------|
| T1 | 0 | **50,00** | 1,00 | 1,00 |
| T2 | 1.000 | **60,00** | 1,00 | 3,00 |
| T3 | 4.000 | **65,00** | 1,00 | 6,00 |
| T4 | 15.000 | **70,00** | 1,00 | 9,00 |

SharemeChat retiene 40-50 % en INDIVIDUAL y 30-50 % en MASTER — siempre ≥ 30 % (sostenibilidad protegida). Sin grandfathering: modelos individuales existentes pasan al nuevo régimen desde el momento de aplicación (D5).

Rango `rate_min/rate_max` autoservicio idéntico al ADR-052 §D5. La modelo elige libremente su tarifa dentro de rango — el Master NO regula la tarifa de sus modelos (respeta autonomía modelo, coherente con "modelo firma personalmente"). Master puede recomendar tarifa off-platform.

### D4 — Motor reparto unificado + escalado agregado por Master (Opción C)

`StreamService.endSession` mantiene el patrón actual `modelEarning = cost × modelSharePct / 100`, con extensión:

1. Si `stream.model.master_user_id IS NULL` → resolveEffectiveTierForPayout(modelId) sobre bruto propio, régimen INDIVIDUAL, STREAM_EARNING a `stream.model`.
2. Si `stream.model.master_user_id IS NOT NULL` → resolveEffectiveTierForPayout(masterId) sobre bruto agregado del Master (suma STREAM_CHARGE + TRIAL_EARNING de TODAS sus modelos activas rolling 30d), régimen MASTER, STREAM_EARNING a `master` con `Transaction.description` incluyendo `attributed_model_id=<modelId>` para trazabilidad + nueva columna `transactions.attributed_model_user_id BIGINT NULL FK users(id)` para consultas eficientes.

Alternativa descartada: motor dual con dos code paths separados. Complica mantenimiento sin beneficio.

### D5 — Sin grandfathering para modelos individuales existentes

Modelos individuales actualmente activas (75-79 % ADR-052) pasan automáticamente al nuevo régimen 50-60 % desde el momento de aplicación de este ADR. Justificación: (a) 0 modelos activas en T3-T4 hoy, coste real ≈ 0, (b) mantener dos regímenes coexistiendo para 0 modelos afectadas es deuda técnica innecesaria, (c) el gancho comercial vs LJ sigue siendo fuerte (50 % vs 30 % LJ L1, 60 % vs 45 % LJ L4 — ver umbrales D3 comparados con L1/L3/L5/L7).

Comunicación al operador: si aparece modelo real ya facturando en T2+ del régimen viejo antes del deploy de este ADR, evaluar caso por caso — puede considerarse compensación puntual (bono equivalente a la diferencia) sin refactor del sistema.

### D6 — Onboarding Master: KYC persona física + contrato Master + sin KYB empresarial

Master hace KYC como persona física (Didit persona, mismo flujo que modelo). Sin KYB empresarial obligatorio en v1 — alineado con LiveJasmin (no exigen presentación como empresa; persona física siempre es responsable). Si el Master representa a una empresa, esos datos son opcionales (campos `masters.company_name`, `company_registration_number`, `company_country`) y no bloquean onboarding.

Nuevo `Constants.KycSessionTypes.MASTER` + método `KycSessionService.startDiditMasterSession(userId)` análogo a `startDiditModelSession` con:
- Requiere `role=USER + user_type=FORM_MASTER` (nuevo user_type).
- Requiere email verificado.
- Requiere aceptación previa contrato Master (`MasterContractService.isAcceptedCurrent`).
- Workflow ID Didit dedicado configurable via property `kyc.didit.master-workflow-id`.

Contrato Master: PDF en S3 (`assets.sharemechat.com/legal/master_contract.pdf`) + manifest + sha256, mismo patrón que modelo (fichero `ModelContractManifestService` sirve de template). Tabla `master_contract_acceptances` simétrica a `model_contract_acceptances`.

### D7 — Onboarding modelo bajo Master: modelo crea su password, firma personalmente

Cuando un Master registra a una modelo bajo su umbrella, el flujo es:

1. Master rellena formulario `POST /api/masters/me/models` con: **email personal de la modelo** (obligatorio, propio de la modelo — no reutilizado del Master), nickname público sugerido, alias opcional.
2. Sistema crea `User(role=USER, user_type=FORM_MODEL, is_active=0)` sin password + envía **email de activación** a la modelo con token único de un solo uso (patrón registro estándar).
3. La modelo abre el email, entra por primera vez, **crea su propia password**. En ningún momento el Master conoce o gestiona esa password.
4. La modelo completa el registro estándar (foto perfil, biografía, etc.), acepta contrato modelo (versión v6 con cláusula Master D8), pasa KYC Didit con su propio DNI.
5. Solo tras KYC APPROVED + contrato aceptado + revisión admin (patrón actual promoción `USER → MODEL`), la modelo queda operativa con `models.master_user_id = <master>`.

Justificación: eliminar el vector de coacción/GDPR viciado que existiría si el Master tuviera credenciales de la modelo al momento de firmar. Con este flujo, la firma del contrato ocurre bajo control exclusivo de la modelo. Log inmutable `first_password_change_at` en `users` permite auditoría posterior si aparece disputa.

Fricción añadida al Master: mínima (rellenar 1 formulario, esperar a que la modelo complete su parte). Compara favorablemente con LiveJasmin donde el Master también envía invitación por email.

### D8 — Cláusula AML en contrato modelo v6 cuando hay Master

Contrato modelo actual v4 (`model_contract_v4_2026-03-23`) es genérico para modelo individual. Se crea versión v6 (v5 ya reservada para cláusulas D7 chargebacks ADR-052) con adición explícita:

> **Cláusula X.N — Autorización de abono a Master.** Reconozco que estoy vinculada contractualmente al Master `[nombre + identificador único plataforma]` con quien mantengo relación privada. Autorizo que los importes generados por mi actividad en la plataforma sean abonados a dicho Master, quien asume la responsabilidad de liquidarme según acuerdo privado entre las partes. Esta autorización queda registrada de forma inmutable en la plataforma con el hash del presente contrato y fecha de aceptación.

Justificación AML/Estonia: el KYC de la modelo está a su nombre pero el dinero se abona a persona distinta (Master). Sin cláusula expresa, un auditor podría alegar "pago a tercero sin justificación auditable". La cláusula cumple con el requisito de trazabilidad + consentimiento expreso.

Modelo individual (sin Master) sigue firmando la versión v6 sin esa cláusula (o versión v6-individual paralela; decisión operativa: mantener un único v6 con la cláusula condicionada a "si aplica Master" — más simple, mismo contrato).

### D9 — Visibilidad restringida Master → modelo (no PII, alineado con LiveJasmin + GDPR)

Master SÍ ve de sus modelos:
- Nickname público, avatar, disponibilidad, rating apariencia, idiomas.
- Estado KYC (APPROVED / PENDING / REJECTED — no el documento en sí).
- Estatus operativo (activa/inactiva/suspendida moderación).
- Estadísticas económicas: bruto facturado 30d, tramo actual, minutos streamed, sesiones.
- Tarifa actual `chosen_rate_eur_per_min`.
- Historial de sesiones (fecha, duración, ingreso).

Master NO ve:
- Nombre real, apellidos, fecha nacimiento.
- Número documento, foto documento (ID Front/Back/Face).
- Email personal, teléfono, dirección postal.
- Historial de complaints/reports internos.
- Password.

Justificación: (a) alineación con LiveJasmin (fuente citada arriba), (b) GDPR minimización datos art. 5.1.c — el Master no necesita PII para operar día a día, (c) reducción riesgo data breach expandido (si SharemeChat sufre breach de PII modelos, el Master no es superficie de ataque adicional), (d) si el Master necesita PII para su contabilidad interna, la propia modelo se la facilita off-platform.

Enforcement: endpoints admin restringidos `/api/masters/me/models/{id}` sirven proyección `MasterModelViewDTO` que EXCLUYE por diseño todos los campos PII. Endpoint distinto `/api/admin/users/{id}/kyc-details` (con permiso admin `USERS_READ_KYC`) accede a PII solo para roles ADMIN/SUPPORT, nunca para MASTER.

### D10 — Opacidad interna Master↔modelo (modelo ve dashboard reducido)

Modelo bajo Master ve:
- Su propio dashboard reducido: streams realizados, minutos, calificación cliente.
- Lo que el Master le informa que le va a pagar (Master registra un `internal_share_pct` en la relación master↔modelo que la modelo puede consultar como referencia).

Modelo bajo Master NO ve:
- Su ledger crudo `STREAM_EARNING` (que va al Master en la plataforma).
- El % SharemeChat retiene sobre el bruto de sus streams (opaco al par modelo↔plataforma cuando hay Master).

Justificación: alineación con LiveJasmin (opacidad interna es el estándar del sector). El reparto Master↔modelo es contrato privado, la plataforma no expone la caja del Master a la modelo. Trazabilidad interna preservada en BD (`master_model_splits` con % pactado + fechas) para auditoría admin si aparece reclamación.

Modelo individual (sin Master) sigue viendo ledger completo transparente (patrón actual).

### D11 — Suspensión Master → modelos liberadas como individuales

Cuando SharemeChat suspende un Master (moderación, fraude, incumplimiento contrato) o el Master cierra cuenta voluntariamente:

1. Todas sus modelos activas quedan automáticamente con `models.master_user_id = NULL` (liberadas como individuales).
2. Cada modelo mantiene: histórico completo de streams, saldo pendiente (transferido de la relación Master a la propia modelo), rating, favoritos cliente, biografía, tarifa `chosen_rate_eur_per_min` actual.
3. Cada modelo automáticamente se recalifica en el régimen INDIVIDUAL (50-60 % T1-T4) sobre su bruto propio rolling 30d.
4. El saldo pendiente del Master (Balance no retirado) queda congelado hasta resolución admin (patrón similar a suspensión modelo actual).
5. Log auditoría `master_suspension_events` con `master_id`, `suspended_at`, `reason`, `affected_model_ids`, `admin_id`.

Cliente no ve cambio alguno — la modelo sigue apareciendo con su alias público. Modelo ve notificación en dashboard "Ya no estás vinculada al Master X, ahora operas como modelo individual" + auto-restart en régimen INDIVIDUAL.

### D12 — Payouts multi-rail (Paxum → Yoursafe → cripto) + min 100 €

Sistema actual: 1 rail implícito (SEPA manual off-platform). Se refactoriza a multi-rail con nueva tabla `payout_methods`.

Rails soportados en v1 (orden priorización implementación):
- **Paxum** (prioridad 1): e-wallet adult-friendly, muy usada Colombia/LATAM, API directa. Adapter dedicado `PaxumPayoutAdapter`.
- **Yoursafe/Bitsafe** (prioridad 2): IBAN europeo + tarjeta prepago virtual, popular estudios europeos. Adapter dedicado `YoursafePayoutAdapter`.
- **NOWPayments cripto** (prioridad 3): BTC/USDT/USDC. Reutiliza infra ADR-051 (endpoint payout distinto al de cobros). Adapter dedicado `NowPaymentsPayoutAdapter`.

SEPA manual off-platform sigue vigente como fallback (adapter noop, requiere intervención admin).

Min payout 100 € para todos (Master + modelo individual). Simplifica UX y protege la plataforma del coste operativo de payouts pequeños. Frecuencia: on-demand, con "próximo cierre quincenal" (día 1 y 16 del mes) mostrado en dashboard como referencia comercial informativa.

Extensión schema:
```sql
CREATE TABLE payout_methods (
    id BIGINT PK AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    rail VARCHAR(30) NOT NULL,        -- PAXUM | YOURSAFE | NOWPAYMENTS_CRYPTO | SEPA_MANUAL
    account_ref VARCHAR(255) NOT NULL, -- email Paxum, IBAN, dirección cripto, etc.
    display_alias VARCHAR(80) NULL,    -- "Paxum principal", "BTC wallet", ...
    is_default TINYINT(1) DEFAULT 0,
    verified_at DATETIME NULL,         -- alta manual admin o via handshake automático
    created_at, updated_at,
    UNIQUE(user_id, rail, account_ref),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

ALTER TABLE payout_requests
    ADD COLUMN payout_method_id BIGINT NULL,
    ADD COLUMN rail VARCHAR(30) NULL,  -- denormalizado
    ADD CONSTRAINT fk_payout_method FOREIGN KEY (payout_method_id) REFERENCES payout_methods(id);
```

## Modelo de datos

### Migration V42 — `V42__add_master_studio_system.sql`

```sql
-- V42 (ADR-056, 2026-07-29): sistema Master/Studio.

-- ============================================================
-- Bloque 1: nuevo rol MASTER + user_type
-- ============================================================
-- No hay CHECK en users.role (verificado); Constants.java se actualiza
-- en la fase Java para incluir Roles.MASTER = "MASTER" y
-- UserTypes.FORM_MASTER = "FORM_MASTER".

-- ============================================================
-- Bloque 2: tabla masters (1-a-1 con users)
-- ============================================================
CREATE TABLE masters (
    user_id                       BIGINT       PRIMARY KEY,
    company_name                  VARCHAR(200) NULL,
    company_registration_number   VARCHAR(100) NULL,
    company_country               VARCHAR(2)   NULL,
    total_models_active           INT          NOT NULL DEFAULT 0,
    total_paid_out_eur            DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    onboarded_at                  DATETIME     NULL,
    created_at                    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_masters_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- Bloque 3: relación modelo -> master
-- ============================================================
ALTER TABLE models
    ADD COLUMN master_user_id BIGINT NULL,
    ADD CONSTRAINT fk_models_master FOREIGN KEY (master_user_id) REFERENCES users(id),
    ADD INDEX idx_models_master (master_user_id);

-- ============================================================
-- Bloque 4: acuerdo interno Master ↔ modelo (opaco, para auditoría)
-- ============================================================
CREATE TABLE master_model_splits (
    id                     BIGINT       PRIMARY KEY AUTO_INCREMENT,
    master_user_id         BIGINT       NOT NULL,
    model_user_id          BIGINT       NOT NULL,
    internal_share_pct     DECIMAL(5,2) NOT NULL,   -- % que Master paga a la modelo del bruto que ella factura
    effective_from         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    effective_to           DATETIME     NULL,       -- NULL = vigente
    set_by_master_at       DATETIME     NOT NULL,
    notes                  TEXT         NULL,
    CONSTRAINT fk_mms_master FOREIGN KEY (master_user_id) REFERENCES users(id),
    CONSTRAINT fk_mms_model FOREIGN KEY (model_user_id) REFERENCES users(id),
    CONSTRAINT chk_mms_share CHECK (internal_share_pct >= 0 AND internal_share_pct <= 100),
    INDEX idx_mms_master (master_user_id, effective_to),
    INDEX idx_mms_model (model_user_id, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- Bloque 5: aceptación contrato Master (simétrico a model_contract_acceptances)
-- ============================================================
CREATE TABLE master_contract_acceptances (
    id                BIGINT       PRIMARY KEY AUTO_INCREMENT,
    user_id           BIGINT       NOT NULL,
    contract_version  VARCHAR(50)  NOT NULL,
    contract_sha256   VARCHAR(64)  NOT NULL,
    accepted_at       DATETIME     NOT NULL,
    ip_address        VARCHAR(64)  NULL,
    user_agent        VARCHAR(255) NULL,
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_master_contract_user_version (user_id, contract_version),
    INDEX idx_mca_user (user_id),
    CONSTRAINT fk_master_contract_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- Bloque 6: refactor model_pricing_tiers para régimen dual
-- ============================================================
-- Cerrar vigencia actual de las 4 filas T1-T4 (que tienen umbrales
-- y % del ADR-052 sistema anterior).
UPDATE model_pricing_tiers
   SET effective_to = CURRENT_TIMESTAMP
 WHERE effective_to IS NULL;

-- Añadir columna target_type y desactivar UNIQUE previo (nombre real
-- V39: uq_mpt_code_effective, verificado en el fichero fuente V39).
ALTER TABLE model_pricing_tiers
    ADD COLUMN target_type VARCHAR(15) NOT NULL DEFAULT 'INDIVIDUAL' AFTER tier_code,
    DROP INDEX uq_mpt_code_effective,
    ADD CONSTRAINT chk_mpt_target_type CHECK (target_type IN ('INDIVIDUAL','MASTER')),
    ADD CONSTRAINT uq_mpt_target_code_effective UNIQUE (target_type, tier_code, effective_from);

-- Seed 4 filas régimen INDIVIDUAL post-ADR-056.
INSERT INTO model_pricing_tiers
    (tier_code, target_type, min_billed_gross_eur_30d, model_share_pct, rate_min_eur_per_min, rate_max_eur_per_min)
VALUES
    ('T1', 'INDIVIDUAL', 0.00,     50.00, 1.00, 1.00),
    ('T2', 'INDIVIDUAL', 1000.00,  54.00, 1.00, 3.00),
    ('T3', 'INDIVIDUAL', 4000.00,  57.00, 1.00, 6.00),
    ('T4', 'INDIVIDUAL', 15000.00, 60.00, 1.00, 9.00);

-- Seed 4 filas régimen MASTER post-ADR-056.
INSERT INTO model_pricing_tiers
    (tier_code, target_type, min_billed_gross_eur_30d, model_share_pct, rate_min_eur_per_min, rate_max_eur_per_min)
VALUES
    ('T1', 'MASTER', 0.00,     50.00, 1.00, 1.00),
    ('T2', 'MASTER', 1000.00,  60.00, 1.00, 3.00),
    ('T3', 'MASTER', 4000.00,  65.00, 1.00, 6.00),
    ('T4', 'MASTER', 15000.00, 70.00, 1.00, 9.00);

-- ============================================================
-- Bloque 7: extensión model_tier_daily_snapshots con target_type
-- ============================================================
ALTER TABLE model_tier_daily_snapshots
    ADD COLUMN target_type VARCHAR(15) NULL COMMENT 'INDIVIDUAL o MASTER (post ADR-056)',
    ADD COLUMN master_user_id BIGINT NULL COMMENT 'presente si target_type=MASTER; representa el bruto agregado',
    ADD INDEX idx_mtds_master (master_user_id, snapshot_date),
    ADD CONSTRAINT fk_mtds_master FOREIGN KEY (master_user_id) REFERENCES users(id);

-- ============================================================
-- Bloque 8: atribución de STREAM_EARNING a Master + modelo original
-- ============================================================
ALTER TABLE transactions
    ADD COLUMN attributed_model_user_id BIGINT NULL COMMENT 'Modelo que originó el ingreso cuando user=Master (ADR-056)',
    ADD CONSTRAINT fk_tx_attributed_model FOREIGN KEY (attributed_model_user_id) REFERENCES users(id),
    ADD INDEX idx_tx_attributed_model (attributed_model_user_id);

-- ============================================================
-- Bloque 9: password_temporary flag (ADR-056 D7)
-- ============================================================
ALTER TABLE users
    ADD COLUMN password_temporary TINYINT(1) NOT NULL DEFAULT 0
        COMMENT 'ADR-056 D7: si 1, forzar cambio password al primer login antes de firmar/KYC',
    ADD COLUMN first_password_change_at DATETIME NULL
        COMMENT 'Auditoría: instante en que el usuario cambió password por primera vez';

-- ============================================================
-- Bloque 10: payout_methods multi-rail (ADR-056 D12)
-- ============================================================
CREATE TABLE payout_methods (
    id             BIGINT       PRIMARY KEY AUTO_INCREMENT,
    user_id        BIGINT       NOT NULL,
    rail           VARCHAR(30)  NOT NULL,
    account_ref    VARCHAR(255) NOT NULL,
    display_alias  VARCHAR(80)  NULL,
    is_default     TINYINT(1)   NOT NULL DEFAULT 0,
    verified_at    DATETIME     NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_payout_methods_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT chk_payout_methods_rail CHECK (rail IN (
        'PAXUM', 'YOURSAFE', 'NOWPAYMENTS_CRYPTO', 'SEPA_MANUAL'
    )),
    UNIQUE KEY uq_payout_methods_user_rail_ref (user_id, rail, account_ref),
    INDEX idx_payout_methods_user (user_id, is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE payout_requests
    ADD COLUMN payout_method_id BIGINT NULL,
    ADD COLUMN rail VARCHAR(30) NULL COMMENT 'Denormalizado desde payout_methods.rail',
    ADD CONSTRAINT fk_payout_requests_method FOREIGN KEY (payout_method_id) REFERENCES payout_methods(id),
    ADD INDEX idx_payout_requests_rail (rail, status);
```

## Endpoints REST nuevos

Cliente Master (`/api/masters/**`, `hasRole("MASTER")`):

- `POST /api/masters/register` (public, análogo `POST /api/users/register/model`).
- `POST /api/masters/me/contract/accept` (firma contrato Master, análogo endpoint modelo).
- `POST /api/masters/me/kyc/didit` (arranca sesión KYC Didit persona física).
- `POST /api/masters/me/models` (crea modelo bajo umbrella, envía email activación).
- `GET /api/masters/me/models?status=&page=&size=` (listado con filtros).
- `GET /api/masters/me/models/{id}` (detalle sin PII — `MasterModelViewDTO`).
- `PATCH /api/masters/me/models/{id}/active` (activar/desactivar).
- `PATCH /api/masters/me/models/{id}/pricing` (proxy a `PUT /api/models/me/pricing` con guard `masterOwnsModel`).
- `PATCH /api/masters/me/models/{id}/internal-share` (registra `internal_share_pct` en `master_model_splits`).
- `GET /api/masters/me/economics` (dashboard consolidado — bruto agregado 30d, tramo Master, ingresos por modelo).
- `POST /api/masters/me/payout-methods` + `GET` + `DELETE` (gestión rails).
- `POST /api/masters/me/payouts` (solicitar retiro).
- `GET /api/masters/me/payouts?status=&page=&size=` (histórico).

Admin Master (`/api/admin/masters/**`, `hasRole("ADMIN")` o permiso dedicado `MASTERS_MANAGE`):

- `GET /api/admin/masters?status=&page=&size=` (listado paginado con filtros).
- `GET /api/admin/masters/{id}` (detalle admin — SÍ ve PII vía join con `users`).
- `PATCH /api/admin/masters/{id}/suspend` (suspensión → dispara D11 liberación modelos).
- `GET /api/admin/masters/{id}/models` (listado modelos umbrella con PII visible para admin).

Extensión modelo (nuevo endpoint self-service):
- `GET /api/models/me/master-info` (modelo bajo Master ve nombre Master + `internal_share_pct` pactado + nada más).

## Alternativas descartadas

**A) Régimen económico unificado (INDIVIDUAL = MASTER)**: descartada en el análisis previo por el operador (2026-07-29). Al no diferenciar económicamente al Master, se elimina el gancho comercial ("¿por qué venir con estudio si cobro igual que como individual?").

**B) Régimen dual con tablas separadas (`model_pricing_tiers_individual` + `model_pricing_tiers_studio`)**: descartada por complejidad (doble tabla, doble motor de resolución, doble migración cada vez que cambian umbrales) sin beneficio operativo respecto a la columna `target_type` en una sola tabla (D2).

**C) Escalado agregado con umbrales proporcionales a número de modelos activas** (Opción Y del análisis): descartada porque elimina el gancho comercial (Master requiere modelos top-performers para acceder a T4).

**D) Escalado agregado con umbrales duplicados para Master** (Opción Z del análisis): descartada porque introduce arbitrariedad (¿por qué 2x y no 1.5x o 3x?) sin fundamento sectorial. Los umbrales L1/L3/L5/L7 de LiveJasmin son referencia clara y comparable.

**E) Master fija password de sus modelos**: descartada por riesgo GDPR grave (consentimiento viciado al firmar contrato bajo credenciales controladas por tercero). Fix D7: modelo crea su propia password vía email activación.

**F) Master ve PII de sus modelos (nombre real, DNI, DoB)**: descartada por GDPR minimización + política sectorial (LiveJasmin oculta PII al Master post-registro).

**G) Grandfathering para modelos individuales existentes**: descartada por coste ≈ 0 (0 modelos activas en T3-T4 al momento del ADR) + deuda técnica innecesaria (mantener dos regímenes coexistiendo).

**H) KYB empresarial obligatorio para Master**: descartada por alineación con LiveJasmin (persona física siempre es responsable) + fricción excesiva en onboarding.

**I) Modelo bajo Master ve su ledger crudo**: descartada por opacidad interna sector-estándar (LiveJasmin). El reparto Master↔modelo es contrato privado.

**J) Suspensión Master → modelos migran a otro Master**: descartada por complejidad + riesgo (¿qué Master receptor? ¿consentimiento modelo?). Fix D11: liberación como individual + auto-recalificación régimen INDIVIDUAL.

**K) Modelo puede tener múltiples Masters simultáneos**: descartada por complejidad de atribución (¿a qué Master va el STREAM_EARNING?). Marco de negocio del operador: una modelo bajo un solo Master.

## Fases de implementación planificadas

Ejecutable en 4-6 sesiones dedicadas. Cada fase desplegable por sí sola.

1. **Fase S1 — backend base**: migration V42 completa, entities (`Master`, `MasterModelSplit`, `MasterContractAcceptance`, `PayoutMethod`), repositorios, `Constants.Roles.MASTER` + `UserTypes.FORM_MASTER` + `KycSessionTypes.MASTER`. Actualización `ModelPricingTierRepository.findCurrentByBilledGross` con parámetro `targetType`. Tests unitarios.

2. **Fase S2 — KYC + contrato Master**: `MasterContractService` + `MasterContractManifestService` (patrón simétrico modelo). Generación PDF `master_contract_v1_2026-XX-XX.pdf` + manifest. Extensión `KycSessionService.startDiditMasterSession` + nuevo workflow ID Didit. Endpoints `POST /api/masters/register` + `POST /api/masters/me/contract/accept` + `POST /api/masters/me/kyc/didit`. Tests.

3. **Fase S3 — motor reparto extendido**: refactor `ModelTierService.resolveEffectiveTierForPayout` para aceptar contexto Master (agregación bruto). Refactor `StreamService.endSession` para: detectar `stream.model.master_user_id`, resolver tier apropiado, atribuir `STREAM_EARNING` al Master con `attributed_model_user_id` set. Tests exhaustivos de reparto en 4 escenarios (individual T1, individual T4, Master T1, Master T4).

4. **Fase S4 — endpoints Master gestión modelos**: `POST /api/masters/me/models` (crear + email activación con token), `GET /api/masters/me/models`, `PATCH /api/masters/me/models/{id}/active|pricing|internal-share`. Flujo activación email modelo (`AuthActivationController` extensión para activation-first-login → password change forzado → firma contrato → KYC). Tests MockMvc.

5. **Fase S5 — frontend Master**: nuevo dashboard `/master` (React) con: overview económico consolidado, listado modelos, gestión CRUD, formulario nueva modelo, botón payout, historial. Nuevo login flow modelo activation via email. i18n `master.*` ES+EN.

6. **Fase S6 — payouts multi-rail**: nueva tabla `payout_methods` + endpoints CRUD (`/api/users/me/payout-methods`). Adapter `PaxumPayoutAdapter` primero (con credenciales sandbox). Refactor `TransactionService.requestPayout` + `adminReviewPayoutRequest` para aceptar `payout_method_id`. Sin implementar Yoursafe ni cripto payouts en esta fase (deuda diferida).

7. **Fase S7 — frontend admin Masters + suspensión**: nueva sub-sección admin para Masters. Listado + drill-down + suspensión que dispara D11 (liberación modelos). Extensión `AdminSupportPanel` o nuevo `AdminMastersPanel`.

8. **Fase S8 — nivelación TEST → AUDIT → PROD**: patrón habitual (JAR + V42 aplicada Flyway automáticamente + bundles frontend).

## Deudas y evoluciones futuras

- **#D-52**: adapter `YoursafePayoutAdapter` (S6 diferido).
- **#D-53**: adapter `NowPaymentsPayoutAdapter` (cripto payouts, S6 diferido).
- **#D-54**: refactor histórico snapshots `model_tier_daily_snapshots` para retropoblar `target_type='INDIVIDUAL'` en snapshots pre-V42 (compat reporting histórico). Coste: script SQL puntual + validación.
- **#D-55**: extensión Master a modelos internacionales fuera de Colombia (política operativa, sin cambio técnico salvo textos i18n del contrato Master).
- **#D-56**: sistema de tickets extendido a Masters (aliada #D-51 del ADR-054) — futuro ADR cuando haya 2-3 Masters operativos.
- **#D-57**: sistema de "recomendación de tarifa" del Master a sus modelos (hoy tarifa la elige la modelo dentro del rango; posible feature: Master sugiere tarifa + modelo confirma).
- **#D-58**: onboarding Master con vídeo tutorial + checklist guiado (UX, no bloqueante).
- **#D-59**: reporting fiscal por Master (extracción datos año fiscal para Master → 1099/A1/similar según jurisdicción).
- **#D-60**: rate limit de creación de modelos por Master (antifraude — Master creando 100 modelos zombis).

## Referencias

- [ADR-052 — Rediseño estructural reparto](adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) (motor unificado, `chosen_rate`, tramos T1-T4)
- [ADR-051 — PSP puente cripto NOWPayments](adr-051-psp-puente-cripto-nowpayments.md) (infra cripto reutilizable para payouts D12)
- [ADR-046 — Panel soporte humano](adr-046-panel-soporte-humano.md) (patrón permisos + roles + sub-tabs admin)
- [ADR-054 — Sistema tickets incidencias](adr-054-sistema-tickets-incidencias.md) (#D-51 extensión modelos aliada)
- [LiveJasmin Level-Dependent Payment System — 9 tiers oficial](https://livejasminwiki.com/level-dependent-payment-system/) (umbrales L1-L9 fuente D3)
- [LJ Model Center Wiki — datos personales no visibles al Master post-registro](https://livejasminwiki.com/model-center/) (fuente D9)
- [ICIJ 2024 — Colombian webcam studios industry investigation](https://www.icij.org/news/2024/12/as-billion-dollar-webcam-industry-booms-models-suffer-at-hands-of-colombian-studios/) (contexto mercado destino)
- [EDPB — Data controller vs processor guide GDPR](https://www.edpb.europa.eu/sme/learn-the-basics/data-controller-or-data-processor_en) (justificación D9 GDPR)
- [`StreamService.endSession` — motor reparto](../../src/main/java/com/sharemechat/service/StreamService.java)
- [`ModelTierService`](../../src/main/java/com/sharemechat/service/ModelTierService.java)
- [`PricingService` + `ModelEconomicsDTO`](../../src/main/java/com/sharemechat/service/PricingService.java)
- [`KycSessionService`](../../src/main/java/com/sharemechat/service/KycSessionService.java)
- [`ModelContractService` + `ModelContractManifestService`](../../src/main/java/com/sharemechat/service/ModelContractService.java)
- [`TransactionService.requestPayout` + `adminReviewPayoutRequest`](../../src/main/java/com/sharemechat/service/TransactionService.java)
