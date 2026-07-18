# Entregables de compliance

> **Nota interna (actualizada 2026-06-27, post Fase 2 del refactor de lenguaje)**: el posicionamiento operativo real de SharemeChat es **adult dating intimate 1-a-1 entre adultos verificados, con nudity consensual permitida**, alineado con Mastercard AN 5196, Visa Rule ID 0003356 y con la práctica de comparables del vertical (CooMeet, LuckyCrush, Chatspin). Dentro del régimen MCC adult/streaming de ADR-028 (cerrado, no se reabre), el matiz "adult dating intimate" describe la experiencia de usuario y la modalidad técnica (1-a-1 privado con KYC obligatorio Didit y moderación visual real-time delegada al workflow Sightengine), no la clasificación regulatoria.
>
> Tras el refactor de Fase 2 (commit ver bitácora 2026-06-27), el lenguaje del producto está alineado en tres frentes: (a) `frontend/src/footer/Legal.jsx` (público vivo, 8 tabs); (b) `docs/01-business/business-model.md`, `compliance-scope.md`, `product-overview.md` (docs internos); (c) `ops/legal-pdfs/generate_legal_pdfs.py` (script generador de los 8 PDFs entregables a CardBilling / Verotel).
>
> **Lo que sigue pendiente** y por tanto este documento aún NO se reescribe:
> - El Model Collaboration Agreement vivo (PDF `v4_2026-03-23` firmado por 18 modelos en TEST + cuentas en PROD/AUDIT) sigue con lenguaje del régimen previo. Su refactor exige bump v5, re-aceptación forzada y coordinación legal (sub-paquete R5 con deuda registrada en `known-debt.md` entrada 2026-06-27 puntos R5 / G4).
> - Las cinco políticas formales que el PSP exige (§2 abajo) siguen como "estado PLANIFICADO" en este documento porque ninguna está aún firmada legalmente; existen como textos en `Legal.jsx` y en los PDFs generables por el script, pero la firma legal definitiva exige revisión por asesoría externa. Bloqueante para cerrar onboarding CardBilling / Verotel y para go-live público.
> - Tracking de aceptación versionada de policies públicas (deuda G3): cuando `Legal.jsx` se modifique en el futuro, no hay flag forzando re-aceptación de usuarios existentes. Gap regulatorio para go-live PROD.
>
> Las tres pendencias viven como deudas estratégicas en `docs/04-operations/known-debt.md` entrada 2026-06-27. Este documento se mantiene direccional (lista accionable de obligaciones de compliance), no se convierte en cuerpo de las policies formales.

Documento accionable que recoge las obligaciones operativas concretas derivadas de la clasificación adult/streaming ([ADR-028](../06-decisions/adr-028-business-classification-adult-streaming.md)) y del onboarding con CardBilling / Verotel como PSP en curso (ver [psp-strategy.md](psp-strategy.md)).

A diferencia de [compliance-scope.md](compliance-scope.md), que define el alcance funcional de compliance dentro del producto, este documento enumera **qué hay que producir, formalizar o desplegar** antes del go-live público y durante operación. Es una lista accionable, no un marco conceptual.

## Estado general

Ningún entregable está cerrado al cierre de este documento. Se listan como obligaciones direccionales con estado segregado HECHO / EN CURSO / PLANIFICADO por bloque.

## 1. Declaración 2257 y Records Custodian

**Qué es**: declaración legal exigida por la sección 2257 del US Code (Title 18) para merchants de contenido adulto que muestren producción visual real. Aplica como obligación derivada de operar adult/streaming, con independencia de la jurisdicción societaria.

**Estado**: PLANIFICADO. No hay declaración 2257 visible en el footer del SPA actual. No hay Records Custodian nombrado ni dirección de custodia declarada.

**Antes del go-live público**:

- Texto de la declaración 2257 redactado y desplegado en el footer del SPA producto en todas las páginas relevantes.
- Records Custodian nombrado (persona física con responsabilidad operativa formal).
- Dirección física de custodia declarada.
- Procedimiento interno de almacenamiento y acceso a los records de verificación de modelos definido por escrito.

## 2. Políticas formales exigidas por adquirente adult-specialist (Sección 3 del checklist)

> **Nota 2026-07-18**: la sección enumeraba originalmente el checklist de Segpay. Tras el descarte de Segpay 2026-07-18 (incompatibilidad residencia director), las mismas cinco políticas siguen siendo obligatorias porque son requisito **estándar** de cualquier adquirente adult-specialist (CardBilling, Verotel, RocketGate, Epoch). El checklist mantiene su valor operativo con o sin Segpay.

Cinco documentos a producir antes de cerrar el onboarding con CardBilling / Verotel. Aplican aunque el PSP final cambie: son obligaciones derivadas del régimen adult, no específicas de CardBilling / Verotel.

**Estado**: PLANIFICADO. Ninguna de las cinco está producida formalmente, aunque el contenido conceptual de varias se desprende de otras decisiones (ADR-029, ADR-030, ADR-011, ADR-012).

### 2.1 Content Management Policy & Procedures

Qué cubre:

- Quién puede publicar contenido (criterios para modelos: KYC superado, contrato firmado).
- Qué tipos de contenido se permiten y cuáles no.
- Procedimiento de moderación (cola, decisiones, vías de apelación).
- Vías de takedown solicitado por terceros.

Base interna existente: ADR-030 (pipeline de moderación) y la moderación de assets estáticos ya implementada. Falta formalizar como política externa.

### 2.2 Consumer Age Verification Policy

Qué cubre:

- Cómo se verifica la edad del cliente antes de acceder a contenido adulto.
- Procedimiento de bloqueo si la verificación falla.
- Procedimiento de re-verificación periódica si procede.
- Almacenamiento de evidencia de verificación.

Base interna existente: ADR-029 (estimación facial + secundaria) consolidada en ADR-035 sobre Didit como vendor único KYC. Falta producir el documento externo.

### 2.3 Complaint & Content Removal Policy

Qué cubre:

- Cómo el público (no solo usuarios registrados) puede presentar quejas sobre contenido o sobre actuaciones de la plataforma.
- Plazo de respuesta comprometido (5 días hábiles según el régimen CardBilling / Verotel).
- Procedimiento de takedown de contenido por reclamación de tercero.
- Procedimiento ante sospecha de contenido ilegal (CSAM, no consentido, suplantación).

Base interna existente: endpoint `/api/reports/abuse` parcial y entity `ModerationReport`. Falta superficie pública de reclamación y formalización del compromiso de plazo.

### 2.4 Modelo de acuerdo con modelos (Model Agreement)

Qué cubre:

- Términos contractuales entre la plataforma y la modelo.
- Verificación de mayoría de edad y identidad como condición de emisión.
- Consentimiento explícito para grabación, distribución y comercialización del contenido.
- Política de payouts, retenciones y bloqueos.
- Procedimiento de baja y de retención de records post-baja.

Base interna existente: `modelContractService` con versionado de contrato (`contractInfo.currentVersion` en `PerfilModel.jsx`). Falta alinear el contenido del contrato con el formato CardBilling / Verotel exige.

### 2.5 Chargeback–Fraud Mitigation Policy

Qué cubre:

- Procedimiento ante chargebacks.
- Evidencia recolectada para defensa (attendance log, stream records, logs de wallet).
- Procedimiento antifraude (señales detectadas, umbrales, acciones automáticas).
- Cooperación con el PSP en disputas.

Base interna existente: auth-risk progresivo ([ADR-008](../06-decisions/adr-008-auth-risk-progressive-response.md)), ledger de transacciones, stream records con `billable_start` confirmado. Falta consolidar la política externa y conectarla con el attendance log (planificado en ADR-030).

## 3. Resolución de quejas en 5 días hábiles

**Qué es**: compromiso operativo de respuesta a quejas formales en plazo máximo de 5 días hábiles.

**Estado**: PLANIFICADO. Hoy no hay SLA documentado ni canal formal de quejas. La capacidad técnica de recibirlas existe parcialmente (`/api/reports/abuse`) pero sin compromiso de plazo ni superficie admin de seguimiento.

**Antes del go-live**:

- Canal de quejas accesible desde superficie pública (no solo logged-in).
- Cola admin con SLA visible.
- Audit log de tiempos de respuesta para reporting al PSP.

## 4. Reporting periódico al PSP

**Qué es**: reporte mensual de contenido flaggeado, removals y takedowns, enviado al portal del PSP. Cuando no hay actividad relevante en el mes, se envía **nil report** (reporte vacío explícito) antes del día 5 del mes siguiente.

**Estado**: PLANIFICADO. No hay job automatizado, no hay endpoint de export, no hay procedimiento operativo definido. Los datos crudos existen (`backoffice_access_audit_log`, `moderation_reports`, `model_asset_reviews`) y serían base para el reporte cuando se construya.

**Antes del go-live**:

- Endpoint admin que extraiga las métricas mensuales agregadas.
- Procedimiento operativo de envío al portal del PSP.
- Job o recordatorio que dispare nil report si no hay actividad antes del día 5.

## 5. Membresía ASACP

**Qué es**: Association of Sites Advocating Child Protection. Membresía profesional reconocida del sector adult-streaming. No es obligatoria pero es señal positiva en due diligence ante PSPs y en defensa ante reguladores.

**Estado**: PLANIFICADO — a valorar. Decisión pendiente de revisar coste/beneficio antes del go-live.

## 6. GDPR y DSA

### 6.1 Procesamiento biométrico bajo GDPR

La estimación facial de edad para clientes (ADR-029) procesa datos biométricos. Como OÜ estonia, GDPR aplica plenamente.

**Estado**: PLANIFICADO. No hay DPIA del flujo biométrico, no hay base jurídica documentada para el procesamiento.

**Antes de activar el flujo de cliente**:

- DPIA del flujo de estimación facial.
- Base jurídica explícita para el procesamiento biométrico (consentimiento explícito como mínimo; valorar interés legítimo si aplica).
- Política de privacidad actualizada con detalle del flujo y los proveedores (Didit como vendor único KYC, ADR-035).
- Procedimiento de borrado y retención.

### 6.2 UE DSA (Digital Services Act) art. 28

Aplicable a plataformas online que ofrecen servicios a usuarios en la UE. Obligaciones de transparencia, mecanismos de queja interna y reporting.

**Estado**: PLANIFICADO. No hay alineación formal con DSA.

**Antes del go-live europeo**:

- Punto único de contacto para autoridades.
- Mecanismo interno de quejas alineado con DSA (solapamiento parcial con la Complaint Policy del punto 2.3).
- Transparencia sobre moderación (reportes públicos periódicos, alineados con el reporting al PSP del punto 4 cuando se puedan reusar).

## Referencias internas

- [ADR-028](../06-decisions/adr-028-business-classification-adult-streaming.md) — clasificación adult/streaming.
- [ADR-029](../06-decisions/adr-029-age-and-identity-verification-architecture.md) — verificación de edad e identidad.
- [ADR-030](../06-decisions/adr-030-moderation-pipeline-build-vs-rent.md) — pipeline de moderación.
- [psp-strategy.md](psp-strategy.md) — estrategia de PSP.
- [compliance-scope.md](compliance-scope.md) — marco conceptual de compliance.
- [geographic-strategy.md](geographic-strategy.md) — qué mercados aplican y en qué orden.
- [known-risks.md](../04-operations/known-risks.md) — riesgos abiertos por entregables no cerrados.
