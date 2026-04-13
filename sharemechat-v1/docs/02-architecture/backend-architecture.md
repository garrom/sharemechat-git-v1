# Arquitectura backend

El backend es una aplicacion Spring Boot sobre Java 17 que concentra:

- autenticacion y sesion
- APIs REST de producto
- APIs de backoffice
- senalizacion realtime
- logica economica
- trazabilidad operativa

## Areas funcionales principales

- autenticacion con JWT y refresh token persistido
- usuarios, perfiles y onboarding
- wallet, gifts, payout y refund
- mensajes, favoritos y bloqueos
- streams y su trazabilidad
- moderacion
- backoffice y permisos
- auditoria contable interna

## Persistencia y estado

- MySQL como persistencia principal
- Redis para rate limiting, estado online, locks y seen state

## Observaciones relevantes

- el storage versionado para uploads privados soporta proveedor local y proveedor S3
- el backend mantiene el control de acceso a documentos privados mediante proxy propio
- el proxy de storage exige autenticacion para todo acceso
- el media funcional de modelos se sirve a owner, CLIENT, MODEL o backoffice; el media funcional de clientes se sirve a owner, MODEL o backoffice
- verification y KYC quedan limitados a propietario o backoffice
- el backend esta preparado para operar detras de proxy
- las integraciones de email estan mejor asentadas que PSP y KYC externo

## Incertidumbres que se preservan

El codigo muestra evolucion incremental en varias areas. Hay piezas que parecen operativas y otras transicionales. La documentacion debe tratar como parciales, salvo nueva validacion, la integracion PSP final y la activacion plena del proveedor KYC.
