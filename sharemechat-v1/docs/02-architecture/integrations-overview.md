# Visión general de integraciones

## Email

El backend abstrae el envío de correo con dos proveedores:

- Microsoft Graph
- SMTP

Es una de las integraciones mejor asentadas en el código actual.

## PSP

Existe adaptación hacia CCBill para iniciar sesiones y recibir notificaciones, pero el material actual no permite tratarla como integración completamente cerrada de extremo a extremo.

## KYC

Existe soporte para flujo manual y para Veriff. La configuración del entorno de test mantiene `kyc.veriff.enabled=false`, por lo que la integración debe documentarse como disponible pero no plenamente activa por defecto.

## Activos legales

El sistema consume activos legales externos desde un dominio dedicado de assets. Esto justifica separar conceptualmente uploads operativos y assets publicados.

## Storage

Los uploads del producto siguen un patrón local servido por Nginx. No hay evidencia versionada de un storage S3 para uploads del flujo principal.
