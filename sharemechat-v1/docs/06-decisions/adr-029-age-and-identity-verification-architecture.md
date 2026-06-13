# ADR-029 - Arquitectura de verificación de edad e identidad

## Estado

Aceptado. Para clientes (consumidores) el método queda **fijado como requisito firme de producto**: estimación facial vía Veriff + comprobación secundaria solo para casos borderline (tarjeta/open banking; documento como último recurso). Queda explícitamente descartado exigir documento de identidad al 100% de los consumidores. Para modelos la dirección (KYC con documento + selfie + liveness vía Veriff) se mantiene como antes.

La relación con el PSP queda **condicionada** a aceptar este método de verificación del cliente: si el PSP final exige documento para todos los consumidores, se cambia de PSP, no de método. Esta condicionalidad y el plan B de PSP viven en [psp-strategy.md](../01-business/psp-strategy.md). La implementación del flujo de cliente sigue PLANIFICADA (ver sección de estado más abajo); lo que cambia respecto a la versión inicial de este ADR es que la dirección de producto deja de estar abierta a alternativa.

## Contexto

Tras la clasificación como adult/streaming (ADR-028), SharemeChat queda sujeto a tres bloques de obligación de verificación de edad e identidad:

1. **Modelos (content providers)**: las redes de tarjeta y el PSP adult-specialist exigen verificación de identidad real y de mayoría de edad antes de que un modelo pueda emitir contenido remunerado. No hay margen: ninguna modelo puede emitir sin pasar el control.
2. **Clientes (consumers)**: la regulación de los mercados objetivos exige verificación de edad del consumidor antes de acceder a contenido adulto. El checkbox "soy mayor de edad" y la declaración de fecha de nacimiento ya no constituyen prueba válida bajo la guía Ofcom de enero 2025 (UK Online Safety Act), bajo UE DSA art. 28 ni bajo la jurisprudencia US tras Free Speech Coalition v. Paxton.
3. **Trazabilidad y reporting**: tanto modelos como clientes deben tener evidencia auditable de la verificación realizada, almacenada con base jurídica explícita.

La implementación actual cubre parcialmente el primer bloque (KYC de modelo manual con Veriff) y el segundo bloque solo con age gate de checkbox + log de consent, que ya no es defendible para la fase pública.

## Opciones consideradas

### Opción 1 — Construir verificación propia

Construir clasificadores propios de age estimation y de identidad, almacenar documentos y biometría en infraestructura propia.

Pros:
- Control total sobre el dato.
- Sin coste por verificación.

Contras:
- Coste de construcción y de mantenimiento elevadísimo para un equipo pequeño.
- Responsabilidad regulatoria desnuda: cualquier error de clasificación lo asume la plataforma sin red.
- Tiempo de salida muy largo respecto al go-live previsto.
- Los reguladores y PSPs adult-specialist esperan vendors reconocidos del sector: un vendor propio es difícil de defender en due diligence.

### Opción 2 — Subcontratar a un proveedor único

Seleccionar un único proveedor que cubra estimación facial de edad (clientes), validación con documento (clientes en casos borderline) y KYC con documento + selfie + liveness (modelos).

Pros:
- Una sola integración técnica.
- Una sola relación contractual.
- Coherencia operativa entre flujos.
- Diligencia ante reguladores y PSPs mucho más simple.

Contras:
- Dependencia operativa del proveedor.
- Coste por verificación.

### Opción 3 — Subcontratar a proveedores distintos por flujo

Un proveedor para KYC del modelo, otro para estimación facial del cliente, otro para validación documental secundaria.

Pros:
- Optimización por flujo si los precios o capacidades difieren.

Contras:
- Tres integraciones técnicas, tres contratos, tres puntos de fallo.
- Coordinación más compleja del flujo "estimación → secundaria si borderline".
- Más superficie de exposición de datos personales a terceros.

## Decisión

Se adopta la **Opción 2**: subcontratar a un proveedor único que cubra los tres flujos. El proveedor seleccionado es **Veriff** (cubre estimación facial de edad, validación con documento, y KYC completo con documento + selfie + liveness).

### Arquitectura objetivo

**Modelos (KYC obligatorio antes de emitir)**:

- Documento oficial + selfie + liveness vía Veriff.
- Documentos conservados según política Segpay (detalle en `docs/01-business/compliance-deliverables.md`).
- Ninguna modelo emite contenido sin pasar el control.

**Clientes (verificación de edad antes de acceder a contenido adulto)**:

- Estimación facial de edad vía Veriff (selfie, sin documento) en la **primera recarga del monedero**, antes de cualquier acceso de pago.
- Casos borderline (la estimación facial no devuelve confianza suficiente): verificación secundaria altamente efectiva — comprobación de tarjeta y/u open banking como primer fallback (señales del propio flujo de pago), documento como último recurso.
- Disparador legal del gate: "antes de acceder a contenido adulto". Esto exige una condición de diseño explícita: **el pre-pago se mantiene SFW** (sin contenido adulto visible) hasta que el cliente complete el gate. El disparador va en el pago porque es el momento en que el flujo deja de ser SFW.

### Estado de implementación

Hecho:

- KYC de modelos: implementado de forma **manual** con Veriff (sesiones creadas vía `VeriffClient` desde `KycProviderController`/`ModelKycController`). Funcional en entorno controlado, sin automatización end-to-end.

Planificado:

- Automatización del KYC de modelos antes del go-live público (eliminación del paso manual; integración completa con la decisión admin sobre `verification_status`).
- Estimación facial de edad de clientes en la primera recarga, con secundaria (tarjeta/open banking/documento).
- DPIA del flujo biométrico bajo GDPR y formalización de la base jurídica para el procesamiento.

## Justificación

La estimación facial de edad cumple el criterio de "highly effective age assurance" descrito en la guía Ofcom de enero 2025 para UK Online Safety Act, al mismo nivel que la verificación con documento, y es la opción menos invasiva para el cliente (sin documento, sin almacenamiento de PII adicional). Reservar la verificación documental para el cliente al caso último (cuando la facial es borderline y la secundaria por flujo de pago tampoco resuelve) reduce el roce y el almacenamiento de datos sensibles innecesarios.

La fricción del cliente es el segundo criterio decisivo: el cliente es el generador de ingresos del negocio. Exigir documento de identidad al 100% de los consumidores introduce un nivel de roce que se considera inaceptable para un producto de pago recurrente en este vertical, especialmente cuando existe un método legalmente válido (Ofcom) que evita esa fricción para la mayoría de los casos. Por eso esta línea queda como requisito firme de producto y no se reabre por exigencia de PSP: si el PSP exige documento para todos, se cambia de PSP (ver `psp-strategy.md`, plan B).

Para modelos, la verificación con documento + liveness no es opcional: viene impuesta por el PSP adult-specialist y por las redes de tarjeta. Veriff cubre ese flujo y el del cliente con un único proveedor, lo que simplifica la diligencia ante PSP y reguladores.

El requisito de "pre-pago SFW" se desprende del propio diseño regulatorio: el gate se dispara cuando el cliente accede a contenido adulto, y si la plataforma muestra contenido adulto antes del gate el control pierde efecto. Esto obliga a mantener una superficie pública estricta hasta el monedero.

## Impacto

### Arquitectura

- Endpoint `/api/kyc/veriff/start` ya existe y queda como base de la integración (hoy solo accesible al onboarding de modelo). El alcance se ampliará a clientes cuando se implemente el flujo facial.
- El campo `User.dateOfBirth` existe en schema y se rellena hoy solo para modelos vía KYC. Cuando se active estimación facial para cliente, hay que decidir si se persiste un derivado del resultado de Veriff (edad estimada, banda, marca de gate superado) o solo el evento.
- `AgeGatePolicyService` actual (checkbox `confirAdult` + `acceptedTerm`) queda como capa legal-defensiva mínima, no como verificación. Se mantiene mientras no esté operativa la estimación facial, pero deja de ser defendible una vez la plataforma sea pública.
- Las sesiones Veriff webhook (`POST /api/kyc/veriff/webhook`) son `permitAll`: cuando se active el flujo de cliente, hay que validar firma del webhook por el mismo principio que `ccbill/notify` (ver `pending-hardening.md` parte 1C).

### Operaciones

- Onboarding de modelo: hoy manual, debe automatizarse antes del go-live. La decisión admin sobre `verification_status` debe integrarse con el resultado Veriff (ya existen modos `VERIFF` y `MANUAL` en `Constants.KycModes`).
- Primera recarga del cliente: debe interceptarse para disparar gate facial; sin gate superado el flujo de recarga no completa.
- DPIA + base jurídica para procesamiento biométrico antes del go-live. Listado como entregable en `compliance-deliverables.md`.

### Riesgos

- Dependencia operativa de Veriff: si el proveedor cae o cambia precio agresivamente, hay que tener un plan secundario. Análogo al principio de redundancia de PSP (ver `psp-strategy.md`); aquí la decisión actual asume Veriff como proveedor único por simplicidad de integración, asumiendo el riesgo de single-vendor.
- Procesamiento biométrico bajo GDPR exige DPIA y base jurídica documentada antes de activar el flujo de cliente. Bloqueante para go-live.
- El requisito "pre-pago SFW" impone disciplina sobre toda la superficie pública: cualquier asset que se muestre antes del gate debe ser SFW de forma verificable.

## Consecuencias

Positivas:

- Defendible bajo el régimen regulatorio actual de los mercados objetivos (UK OSA, UE DSA, US post-Paxton).
- Mínima fricción para el cliente (estimación facial sin documento) en el caso normal.
- KYC de modelo en línea con lo que el PSP adult-specialist espera.
- Una única relación contractual con vendor de verificación.

Negativas:

- Dependencia single-vendor (Veriff).
- Carga regulatoria adicional bajo GDPR por procesamiento biométrico.
- Disciplina permanente sobre superficie pública pre-pago (debe mantenerse SFW).

Trade-off asumido:

- Se prefiere la simplicidad de un único vendor sobre la resiliencia de multi-vendor, asumiendo el riesgo de dependencia.

## Notas

Veriff es la elección direccional. Sustitución del proveedor en el futuro es posible sin reabrir esta decisión arquitectónica (el principio "proveedor único que cubra los tres flujos" se mantendría); requeriría un ADR menor de cambio de proveedor.

El método de verificación de cliente (estimación + secundaria + documento solo como último recurso) queda fijado como requisito de producto. Si el PSP final no acepta este método, se cambia de PSP — no se cambia el método. La condicionalidad de Segpay y el plan B de PSP viven en [psp-strategy.md](../01-business/psp-strategy.md).

Para modelos, los requisitos sí pueden ajustarse marginalmente según las exigencias del PSP final (formato de los records, retención, custodian). Las líneas estructurales (KYC modelo obligatorio con documento + selfie + liveness, pre-pago SFW) son comunes al régimen adult independientemente del PSP concreto y no se reabren.

---

## Status update (2026-06-13): SUPERSEDED by [ADR-035](adr-035-age-and-identity-verification-vendor-consolidation-on-didit.md)

Veriff Support confirmó por escrito que **Age Estimation no está disponible en el plan Essential** (~49 USD/mes, self-serve) sino en el plan **Enterprise** (~199 USD/mes, contrato anual, mínimo 1000 verificaciones/mes), incompatible con la restricción presupuestaria de una OÜ pre-ingresos. El método decidido en este ADR (estimación facial + step-up documental para cliente; KYC documental + selfie + liveness obligatorio para modelo; pre-pago SFW como condición de diseño) **se mantiene íntegro**: el cambio es de vendor, no de método. Detalle, planes alternativos y justificación en [ADR-035](adr-035-age-and-identity-verification-vendor-consolidation-on-didit.md). El frente Veriff backend (commits `27796bb`..`53c3036`) queda **dormido pero integrado** en el repositorio como contingencia técnica reactivable.
