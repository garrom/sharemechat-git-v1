# Entorno TEST

## Proposito

TEST actua como entorno principal de trabajo y validacion funcional del producto.

## Lo que esta claramente soportado

- frontend de producto
- frontend de backoffice
- backend Spring Boot
- MySQL
- Redis
- realtime por `/match` y `/messages`
- assets legales externos
- uploads privados servidos por backend

## Configuracion versionada relevante

El codigo versionado apunta de forma explicita a dominios de test para:

- cookies de autenticacion
- verificacion de email
- reset de password
- callback KYC
- separacion entre superficie de producto y admin

El storage de uploads privados ya es configurable por proveedor:

- local
- S3 privado

La activacion efectiva depende de variables de entorno y no queda fijada de forma dura en este documento.

## Observaciones

- TEST es la principal fuente de verdad funcional del repositorio
- varias rutas y constantes frontend siguen acopladas a este entorno
- la documentacion previa indicaba que la topologia edge y buckets privados de frontend ya estaban operativos, pero ese detalle se ha saneado aqui

## Estado de activacion de storage privado

TEST ya esta en paridad de aplicacion con AUDIT para operar uploads privados sobre S3:

- la abstraccion `StorageService` ya soporta proveedor local y proveedor S3
- la seleccion de proveedor depende de configuracion por entorno
- el acceso a contenido privado sigue pasando por `/api/storage/content`
- la politica de acceso al proxy privado ya esta resuelta en codigo y no depende del entorno

Por tanto, a nivel Spring Boot no se observa un bloqueo especifico de TEST distinto del que ya tuvo AUDIT antes de activarse. Si TEST sigue en local, el trabajo pendiente pasa por activacion operativa del entorno, como minimo:

- `APP_STORAGE_TYPE=s3`
- `APP_STORAGE_S3_BUCKET`
- `APP_STORAGE_S3_REGION`

Y por validar que el host del backend disponga de credenciales AWS resolubles en runtime mediante el mecanismo estandar del proveedor, sin secretos hardcodeados en el codigo ni en properties versionadas.
