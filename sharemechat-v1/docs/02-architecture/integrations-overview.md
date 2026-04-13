# Vision general de integraciones

## Email

El backend abstrae el envio de correo con dos proveedores:

- Microsoft Graph
- SMTP

Es una de las integraciones mejor asentadas en el codigo actual.

## PSP

Existe adaptacion hacia CCBill para iniciar sesiones y recibir notificaciones, pero el material actual no permite tratarla como integracion completamente cerrada de extremo a extremo.

## KYC

Existe soporte para flujo manual y para Veriff. La configuracion del entorno de test mantiene `kyc.veriff.enabled=false`, por lo que la integracion debe documentarse como disponible pero no plenamente activa por defecto.

## Activos legales

El sistema consume activos legales externos desde un dominio dedicado de assets. Esto justifica separar conceptualmente uploads operativos y assets publicados.

## Storage

Los uploads privados del producto ya tienen soporte versionado para:

- storage local transicional
- storage S3 privado

La subida sigue pasando por backend. No existe en esta fase subida directa desde frontend a S3 ni exposicion publica del bucket para documentos privados.
