# Arquitectura backend

El backend es una aplicación Spring Boot sobre Java 17 que concentra:

- autenticación y sesión
- APIs REST de producto
- APIs de backoffice
- señalización realtime
- lógica económica
- trazabilidad operativa

## Áreas funcionales principales

- autenticación con JWT y refresh token persistido
- usuarios, perfiles y onboarding
- wallet, gifts, payout y refund
- mensajes, favoritos y bloqueos
- streams y su trazabilidad
- moderación
- backoffice y permisos
- auditoría contable interna

## Persistencia y estado

- MySQL como persistencia principal
- Redis para rate limiting, estado online, locks y seen state

## Observaciones relevantes

- el storage versionado es local, no S3
- el backend está preparado para operar detrás de proxy
- las integraciones de email están mejor asentadas que PSP y KYC externo

## Incertidumbres que se preservan

El código muestra evolución incremental en varias áreas. Hay piezas que parecen operativas y otras transicionales. La documentación debe tratar como parciales, salvo nueva validación, la integración PSP final y la activación plena del proveedor KYC.
