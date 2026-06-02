# ADR-029 - Arquitectura de verificación de edad e identidad

## Estado

Aceptado como dirección de arquitectura. Los requisitos concretos derivan de una relación con PSP (Segpay) en curso y NO cerrada contractualmente; si las exigencias del PSP cambian, el diseño puede ajustarse en consecuencia.

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

Los requisitos derivan en parte de la relación con Segpay como PSP candidato. Si Segpay no cierra y el PSP final exige requisitos distintos, el diseño puede ajustarse — pero las líneas estructurales (KYC modelo obligatorio, estimación facial cliente como método de age assurance, pre-pago SFW) son comunes al régimen adult independientemente del PSP concreto.
