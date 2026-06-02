# Vision general de integraciones

## Email

El backend abstrae el envio de correo con dos proveedores:

- Microsoft Graph
- SMTP

Es una de las integraciones mejor asentadas en el codigo actual.

## PSP

Existe adaptacion hacia CCBill para iniciar sesiones y recibir notificaciones, pero la integracion no esta cerrada de extremo a extremo. **CCBill** quedo silente en onboarding y la via activa actual es **Segpay**, sin contrato firmado todavia. El principio operativo declarado es de redundancia (no depender de un unico PSP). Direccion y detalle en [psp-strategy.md](../01-business/psp-strategy.md). Riesgos abiertos por PSP no cerrado y por webhook sin validar en [known-risks.md](../04-operations/known-risks.md).

## Verificacion de edad e identidad (Veriff)

Existe integracion con **Veriff** como proveedor unico para los tres flujos de verificacion (decision direccional en [ADR-029](../06-decisions/adr-029-age-and-identity-verification-architecture.md)):

- **KYC de modelos**: activo-manual hoy. Endpoint `/api/kyc/veriff/start` operativo para onboarding del modelo. Automatizacion completa pendiente antes del go-live.
- **Estimacion facial de edad de clientes**: planificada. Se activara en la primera recarga del monedero, con secundaria por tarjeta/open banking y documento como ultimo recurso.
- **Validacion documental secundaria**: planificada.

La configuracion del entorno de test mantiene `kyc.veriff.enabled=false`. La integracion debe documentarse como disponible pero no plenamente activa por defecto.

## Moderacion (vendors de IA)

Pendiente de implementacion. La direccion arquitectonica (control plane propio, clasificadores alquilados) esta en [ADR-030](../06-decisions/adr-030-moderation-pipeline-build-vs-rent.md). Vendors **candidatos en evaluacion**, no seleccionados:

- Clasificacion visual (nudity, violencia, etc.): Sightengine, Hive.
- Deteccion de CSAM: Hive, Thorn Safer, PhotoDNA. **Nunca construir CSAM propio**.

La capa de IA aun no esta integrada en codigo. Lo unico operativo a fecha actual son el corte de sesion, el registro de stream records y la moderacion de assets estaticos del catalogo del modelo (cola admin completa con audit log, ya desplegada).

## Activos legales

El sistema consume activos legales externos desde un dominio dedicado de assets. Esto justifica separar conceptualmente uploads operativos y assets publicados.

## Storage

Los uploads privados del producto ya tienen soporte versionado para:

- storage local transicional
- storage S3 privado

La subida sigue pasando por backend. No existe en esta fase subida directa desde frontend a S3 ni exposicion publica del bucket para documentos privados.
