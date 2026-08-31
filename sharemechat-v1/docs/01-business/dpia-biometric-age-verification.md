# DPIA — Verificación biométrica de edad e identidad

> **Data Protection Impact Assessment (GDPR Art. 35).** Documento de compliance durable.
> Describe y evalúa el tratamiento de datos biométricos y de categoría especial que la
> plataforma **ya realiza** para verificar la edad del cliente y la identidad del modelo.
> No introduce tratamiento nuevo: formaliza el que está implementado y activo en código.
>
> **Estado:** BORRADOR redactado 2026-08-31. Pendiente de revisión/firma a criterio del operador.
> No sustituye a una validación legal externa.

## 0. Control del documento

| Campo | Valor |
|---|---|
| Responsable del tratamiento | Shareme Technologies OÜ — Registro 17444422 — Lõõtsa tn 5, 11415 Tallinn, Estonia |
| Contacto | contact@sharemechat.com |
| DPO / responsable de datos | Alain Garmendia (Director / Founder) — pendiente de designación formal de DPO si el volumen lo exige |
| Encargado del tratamiento (processor) | Didit (proveedor único de verificación de identidad y estimación de edad, [ADR-035](../06-decisions/adr-035-age-and-identity-verification-vendor-consolidation-on-didit.md)) |
| Versión | 1.0 (borrador) |
| Fecha | 2026-08-31 |
| Revisión | Anual, o ante cambio de vendor, de finalidad o del flujo |

> **Copias y custodia.** Fuente autoritativa: este documento en el repo (git, versionado).
> Copia PDF entregable (regulador / PSP *on request*) en el bucket **privado**
> `sharemechat-content-private-<env>/compliance/` — **nunca** en el bucket público `assets/legal/`.
> Copia inmutable archivada en `ops/legal-history/compliance/`. Regenerable con
> `ops/legal-pdfs/generate_dpia_pdf.py`. Desplegada en TEST el 2026-08-31 (`v1`, sha256
> `9ee25ac9…`).

## 1. Necesidad de la DPIA

Bajo el Art. 35 GDPR, una DPIA es obligatoria cuando un tratamiento es susceptible de entrañar un
alto riesgo para los derechos y libertades de las personas. Este tratamiento lo desencadena por dos
motivos independientes:

- **Tratamiento a gran escala de categorías especiales de datos** (Art. 9): datos biométricos con el
  propósito de identificar/estimar la edad de una persona física.
- **Evaluación o puntuación sistemática** (estimación automatizada de edad) que condiciona el acceso a
  un servicio.

Por tanto se realiza esta DPIA. El tratamiento está clasificado dentro del régimen adult/streaming de
[ADR-028](../06-decisions/adr-028-business-classification-adult-streaming.md), que exige verificación de
edad del consumidor bajo la regulación de los mercados objetivo (UK Online Safety Act / guía Ofcom
2025, UE DSA art. 28, US post *Free Speech Coalition v. Paxton*) y bajo las reglas de las redes de
tarjeta (Mastercard AN 5196, Visa Rule ID 0003356).

## 2. Descripción del tratamiento

### 2.1 Naturaleza

Dos flujos distintos, ambos operados por Didit como encargado:

- **Cliente (consumidor) — estimación de edad.** Antes de acceder a funciones adultas de pago o a un
  emparejamiento privado, el cliente completa una **estimación facial de edad** (workflow Didit "Age
  Estimation"), con verificación documental como *fallback* cuando la estimación es concluyente o se
  requiere mayor garantía. Referencia de arquitectura: [ADR-029](../06-decisions/adr-029-age-and-identity-verification-architecture.md).
- **Modelo (proveedor de contenido) — verificación de identidad completa.** Antes del onboarding y de
  iniciar cualquier sesión: verificación de documento oficial, captura de selfie con detección de
  vivacidad (*liveness*), *face match* selfie↔documento, y análisis de dispositivo/IP.

### 2.2 Alcance de los datos

| Dato | Quién lo trata | Dónde reside |
|---|---|---|
| Imagen facial / selfie, documento, señales de vivacidad (biometría en bruto) | **Didit** (processor) | Infraestructura de Didit, **no** en SharemeChat |
| Resultado de la decisión (`APPROVED`/`DECLINED`/estado) | SharemeChat | `users.client_kyc_status`, `users.verification_status` |
| Edad estimada (número) | SharemeChat | `users.client_kyc_estimated_age` (decimal) |
| Marca temporal de la decisión | SharemeChat | `users.client_kyc_decided_at` |
| Metadatos de verificación (dispositivo/IP en el momento) | SharemeChat / Didit | logs de verificación |

**Minimización clave (implementada en código):** SharemeChat **no almacena la biometría en bruto**. El
DTO interno de sesión KYC (`LatestKycSessionDTO`) excluye explícitamente los datos biométricos y la
razón de decisión cruda del proveedor. La plataforma retiene únicamente el *veredicto* y la *edad
estimada*; el material biométrico permanece en el processor.

### 2.3 Contexto

Plataforma de videochat privado 1-a-1 entre adultos verificados, régimen adult/streaming. GDPR aplica
plenamente al ser Shareme Technologies OÜ una sociedad estonia. Mercados objetivo con verificación de
edad exigida por ley. El tratamiento es un **habilitador de cumplimiento** (excluir a menores, verificar
identidad de proveedores) y no una finalidad comercial en sí.

### 2.4 Finalidades

1. Impedir el acceso de menores a contenido adulto (protección de menores).
2. Verificar la identidad y la mayoría de edad de los proveedores de contenido (obligación 2257 / reglas
   de red de tarjeta / defensa frente a fraude e identidades falsas).
3. Prevención de fraude y de abuso de cuentas.

No se usa para publicidad, elaboración de perfiles comerciales ni cesión a terceros con fines de
marketing.

## 3. Necesidad y proporcionalidad

### 3.1 Base jurídica

- **Categoría especial (Art. 9):** **consentimiento explícito** del interesado (Art. 9(2)(a)),
  recabado antes de iniciar el flujo de verificación. Se considera adicionalmente el Art. 9(2)(g)
  (interés público sustancial: protección de menores y cumplimiento regulatorio) como base de refuerzo
  donde el Derecho aplicable lo habilite.
- **Datos personales base (Art. 6):** Art. 6(1)(c) (obligación legal: verificación de edad exigida por
  la regulación aplicable y por las reglas de red de tarjeta) y Art. 6(1)(b) (necesario para la
  prestación del servicio contratado).

El consentimiento es **libre** porque existe la alternativa de no usar el servicio (adult, 18+), es
**informado** (política de privacidad + aviso en el flujo) y **específico** (limitado a verificación de
edad/identidad).

### 3.2 Principios

- **Limitación de finalidad:** los datos se usan solo para verificación de edad/identidad, no para otros
  fines.
- **Minimización:** la plataforma conserva solo decisión + edad estimada; la biometría bruta la retiene
  el processor (ver §2.2).
- **Exactitud:** doble capa (estimación + *fallback* documental) y re-verificación cuando hay indicios de
  que una verificación previa dejó de ser fiable.
- **Limitación del plazo de conservación:** retención de la verificación del proveedor ≥ 7 años tras la
  última actividad (obligación 2257 / reglas de red). Retención en el processor configurada a un plazo
  acotado (objetivo 6 meses en Didit, [ADR-035](../06-decisions/adr-035-age-and-identity-verification-vendor-consolidation-on-didit.md); no dejar el default "unlimited").
- **Integridad y confidencialidad:** conexiones cifradas, control de acceso, webhooks firmados
  (HMAC + anti-replay), separación de la biometría (en el processor) del veredicto (en la plataforma).

### 3.3 Encargado del tratamiento (Didit)

- Contrato de encargo (DPA) y medidas técnicas y organizativas (TOMs) a formalizar con Didit
  (`hello@didit.me`).
- Ubicación de datos y transferencias internacionales a confirmar en el DPA; aplicar cláusulas
  contractuales tipo (SCC) o salvaguarda equivalente si hay tratamiento fuera del EEE.
- Configuración de retención en la consola de Didit a plazo acotado (no "unlimited").

## 4. Consulta

- **Interesados:** informados vía política de privacidad y aviso en el flujo de verificación; el
  consentimiento se recaba de forma explícita.
- **DPO / responsable:** revisión interna por el responsable de datos. Designación formal de DPO a
  valorar según volumen (Art. 37).
- **Processor:** iteración de la DPIA con Didit sobre la base del DPA/TOMs.

## 5. Evaluación de riesgos y medidas

| # | Riesgo para el interesado | Prob. | Sev. | Medidas de mitigación | Riesgo residual |
|---|---|---|---|---|---|
| R1 | Acceso no autorizado a biometría en bruto | Baja | Alta | La plataforma no almacena biometría bruta (§2.2); reside en el processor bajo su DPA/TOMs; cifrado en tránsito | Bajo |
| R2 | Falso rechazo (edad estimada errónea deniega acceso a un adulto) | Media | Media | *Fallback* documental cuando la estimación no es concluyente; vía de re-verificación; revisión humana | Bajo-Medio |
| R3 | *Function creep* (uso de la biometría para fines distintos) | Baja | Alta | Limitación de finalidad documentada; solo se retiene decisión + edad; sin uso publicitario | Bajo |
| R4 | Brecha en el processor | Baja | Alta | Selección de vendor especializado; DPA/TOMs; notificación de brechas 72h; minimización en la plataforma | Bajo-Medio |
| R5 | Transferencia internacional sin salvaguarda | Media | Media | Confirmar ubicación en el DPA; SCC o equivalente si fuera del EEE | Bajo (tras DPA) |
| R6 | Tratamiento de datos de un menor que intentó registrarse | Baja | Alta | El propósito mismo es detectar y excluir menores; borrado y bloqueo ante detección | Bajo |
| R7 | Retención excesiva | Media | Media | Plazo acotado en el processor; retención de proveedor limitada a la obligación legal (7 años) | Bajo |

## 6. Riesgo residual y conclusión

Con las medidas descritas —minimización estructural (la biometría no toca la plataforma), consentimiento
explícito, limitación de finalidad y de plazo, y encargo formalizado con Didit— el **riesgo residual es
bajo** y proporcionado a la finalidad de proteger a menores y cumplir la regulación aplicable. El
tratamiento se considera **necesario y proporcionado**.

**Acciones pendientes para cerrar la DPIA (no técnicas):**

1. Formalizar el **DPA + TOMs** con Didit y confirmar ubicación de datos / transferencias.
2. Confirmar el **plazo de retención** configurado en la consola de Didit (objetivo 6 meses).
3. **Enriquecer la política de privacidad** con el detalle del flujo biométrico, el processor (Didit) y
   los plazos (hoy la Privacy Policy lo trata de forma genérica).
4. Valorar la **designación formal de DPO** según volumen.
5. Revisión/validación legal externa a criterio del operador.

## 7. Referencias

- [ADR-028](../06-decisions/adr-028-business-classification-adult-streaming.md) — clasificación adult/streaming.
- [ADR-029](../06-decisions/adr-029-age-and-identity-verification-architecture.md) — arquitectura de verificación de edad e identidad.
- [ADR-035](../06-decisions/adr-035-age-and-identity-verification-vendor-consolidation-on-didit.md) — consolidación del vendor en Didit.
- [compliance-deliverables.md](compliance-deliverables.md) §6.1 — entregable GDPR biométrico.
- Código: `User.java` (`client_kyc_*`), `MatchingHandlerSupport.java` (enforcement `CLIENT_KYC_REQUIRED`), `LatestKycSessionDTO.java` (minimización), `KycSessionService` (webhook HMAC + anti-replay).
